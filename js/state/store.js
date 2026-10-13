// The store holds the user's data in memory and is the ONLY place that changes it.
// Every change calls emit(source, action, writes):
//   source 'local'  – the user did something on this device → sync saves `writes` to Firestore
//   source 'remote' – a document changed in Firestore (other phone, or our own write echoing back)
//   source 'load'   – loaded from the device cache / local mode
//   source 'reset'  – cleared on sign-out
//   writes = [{ op: 'set'|'delete', col: 'routines'|'sessions'|'stats', id, data }]  – one entry per document
// It knows nothing about the screen or Firebase.

import {
  blankState, normalizeState, normalizeRoutine, normalizeSession, normalizeStat, normalizeProfile,
  makeRoutine, makeRoutineExercise, makeGymSession, makeActivitySession, normalizeTarget, setsFromTarget, MAX_POINTS,
} from './model.js';
import { todayStr, weekKey, weekKeyOf, ymdOf } from '../utils/dates.js';
import { stable } from '../utils/data.js';
import { logger } from '../utils/log.js';

const log = logger('store');
let state = blankState();
const listeners = new Set();

export const getState = () => state;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(source, action, writes = []) {
  log.debug(action, `(${source})`, writes.length ? `${writes.length} write(s)` : '');
  listeners.forEach(fn => fn(state, { source, action, writes }));
}

// ---------- lookups ----------
export const findRoutine = id => state.routines[id] || null;
export const findSession = id => state.sessions[id] || null;
export function findActivity(id) {
  const s = state.sessions[id];
  return s && s.kind === 'activity' ? s : null;
}

// The session holding this routine's check marks right now (this week if recurring), or null.
export function currentSession(r) {
  if (!r || !r.current) return null;
  const s = state.sessions[r.current.sessionId];
  if (!s) return null;
  if (r.recurring && s.weekKey !== weekKey()) return null;
  return s;
}

// ---------- write helpers ----------
const setW = (col, obj) => ({ op: 'set', col, id: obj.id, data: obj });
const delW = (col, id) => ({ op: 'delete', col, id });
const touch = obj => { obj.updatedAt = Date.now(); return obj; };

function statFor(ex) {
  if (!state.stats[ex.id]) state.stats[ex.id] = normalizeStat(ex.id, { name: ex.name });
  const st = state.stats[ex.id];
  st.name = ex.name;
  return st;
}

function setPoint(ex, date) {
  const st = statFor(ex);
  st.points = st.points.filter(p => p.d !== date);
  st.points.push({ d: date, s: ex.target.sets, r: ex.target.reps, w: ex.target.weight, u: ex.target.unit });
  st.points.sort((a, b) => (a.d < b.d ? -1 : 1));
  if (st.points.length > MAX_POINTS) st.points = st.points.slice(-MAX_POINTS);
  return st;
}

function removePoint(exId, date) {
  const st = state.stats[exId];
  if (!st) return null;
  st.points = st.points.filter(p => p.d !== date);
  return st;
}

// ---------- whole-state ----------
export function loadState(data, source = 'load') {
  state = normalizeState(data);
  emit(source, 'load');
}

export function clearState() {
  state = blankState();
  emit('reset', 'clear');
}

// Firestore sent the current contents of a collection (or of a window of it).
// inScope(doc) says which local docs that listener is responsible for, so docs outside it are kept.
const NORMALIZE = { routines: normalizeRoutine, sessions: normalizeSession, stats: normalizeStat };
export function applyRemoteCollection(col, docs, inScope = () => true) {
  const map = state[col], norm = NORMALIZE[col];
  let changed = false;
  for (const id of Object.keys(map)) {
    if (!(id in docs) && inScope(map[id])) { delete map[id]; changed = true; }
  }
  for (const [id, raw] of Object.entries(docs)) {
    const next = norm(id, raw);
    if (!map[id] || stable(map[id]) !== stable(next)) { map[id] = next; changed = true; }
  }
  if (changed) emit('remote', `remote-${col}`);
}

export function applyRemoteDoc(col, id, raw) {
  const map = state[col];
  if (raw == null) { if (map[id]) { delete map[id]; emit('remote', `remote-${col}`); } return; }
  const next = NORMALIZE[col](id, raw);
  if (!map[id] || stable(map[id]) !== stable(next)) { map[id] = next; emit('remote', `remote-${col}`); }
}

export function applyRemoteProfile(raw) {
  const next = normalizeProfile(raw);
  if (stable(next) !== stable(state.profile)) { state.profile = next; emit('remote', 'remote-profile'); }
}

// ---------- profile & settings (users/{uid}) ----------
// patch = { sharing: {...} } | { discoverable: bool } | … – merged into the profile document.
export function updateProfile(patch) {
  state.profile = { ...(state.profile || {}), ...patch };
  emit('local', 'update-profile', [{ op: 'profile', data: patch }]);
}

// A new week started while the app was open: nothing to change, the screens just need to recalculate.
export const checkNewWeek = () => emit('local', 'tick');

// ---------- routines ----------
export function addRoutine({ name, recurring }) {
  const order = Math.max(-1, ...Object.values(state.routines).map(r => r.order)) + 1;
  const r = makeRoutine({ name, recurring, order });
  state.routines[r.id] = r;
  emit('local', 'add-routine', [setW('routines', r)]);
  return r;
}

export function updateRoutine(id, { name, recurring }) {
  const r = findRoutine(id); if (!r) return;
  r.name = name;
  r.recurring = !!recurring;
  if (r.current) r.current.weekKey = r.current.weekKey || weekKey();
  emit('local', 'update-routine', [setW('routines', touch(r))]);
}

// Deletes the plan. Finished workouts stay in history; an unfinished one is removed.
export function deleteRoutine(id) {
  const r = findRoutine(id); if (!r) return;
  const writes = [delW('routines', id)];
  const s = r.current && state.sessions[r.current.sessionId];
  if (s && s.status === 'in_progress') { delete state.sessions[s.id]; writes.push(delW('sessions', s.id)); }
  delete state.routines[id];
  emit('local', 'delete-routine', writes);
}

// "Desmarcar todo": throws away the current check marks (and their history points).
export function resetRoutine(id) {
  const r = findRoutine(id); if (!r) return;
  const s = currentSession(r);
  const writes = [];
  if (s) {
    for (const e of s.exercises) {
      const st = removePoint(e.id, e.doneAt ? ymdOf(e.doneAt) : s.date);
      if (st) writes.push(setW('stats', st));
    }
    delete state.sessions[s.id];
    writes.push(delW('sessions', s.id));
  }
  r.current = null;
  writes.push(setW('routines', touch(r)));
  emit('local', 'reset-routine', writes);
}

// ---------- exercises ----------
export function addExercise(routineId, data) {
  const r = findRoutine(routineId); if (!r) return;
  r.exercises.push(makeRoutineExercise(data));
  const writes = [setW('routines', touch(r))];
  const s = currentSession(r);
  if (s && s.status === 'done') {            // a new unchecked exercise means the routine isn't finished anymore
    s.status = 'in_progress'; s.finishedAt = null;
    writes.push(setW('sessions', touch(s)));
  }
  emit('local', 'add-exercise', writes);
}

export function updateExercise(routineId, exId, data) {
  const r = findRoutine(routineId);
  const ex = r && r.exercises.find(e => e.id === exId); if (!ex) return;
  ex.name = data.name;
  ex.target = normalizeTarget(data);
  const writes = [setW('routines', touch(r))];
  // Already checked in the current session → the logged sets and today's history point follow the edit.
  const s = currentSession(r);
  const logged = s && s.exercises.find(e => e.id === exId);
  if (logged) {
    logged.name = ex.name;
    logged.sets = setsFromTarget(ex.target);
    writes.push(setW('sessions', touch(s)));
    writes.push(setW('stats', setPoint(ex, logged.doneAt ? ymdOf(logged.doneAt) : s.date)));
  }
  emit('local', 'update-exercise', writes);
}

export function deleteExercise(routineId, exId) {
  const r = findRoutine(routineId); if (!r) return;
  r.exercises = r.exercises.filter(e => e.id !== exId);
  const writes = [setW('routines', touch(r))];
  const s = currentSession(r);
  if (s && s.exercises.some(e => e.id === exId)) {
    s.exercises = s.exercises.filter(e => e.id !== exId);
    writes.push(setW('sessions', touch(s)));
  }
  emit('local', 'delete-exercise', writes);
}

// Checks/unchecks an exercise. Returns { completed: true } when this check finished the routine.
export function toggleExercise(routineId, exId) {
  const r = findRoutine(routineId);
  const ex = r && r.exercises.find(e => e.id === exId);
  if (!ex) return { completed: false };
  const writes = [];
  let s = currentSession(r);
  const logged = s && s.exercises.find(e => e.id === exId);

  if (logged) {
    // ---- uncheck ----
    s.exercises = s.exercises.filter(e => e.id !== exId);
    const st = removePoint(exId, logged.doneAt ? ymdOf(logged.doneAt) : s.date);
    if (st) writes.push(setW('stats', st));
    if (!s.exercises.length) {                 // nothing left checked → drop the empty session
      delete state.sessions[s.id];
      writes.push(delW('sessions', s.id));
      r.current = null;
      writes.push(setW('routines', touch(r)));
    } else {
      s.status = 'in_progress'; s.finishedAt = null;
      writes.push(setW('sessions', touch(s)));
    }
    emit('local', 'uncheck-exercise', writes);
    return { completed: false };
  }

  // ---- check ----
  if (!s) {
    s = makeGymSession(r);
    state.sessions[s.id] = s;
    r.current = { sessionId: s.id, weekKey: s.weekKey };
    writes.push(setW('routines', touch(r)));
  }
  s.routineName = r.name;
  s.exercises.push({ id: ex.id, name: ex.name, doneAt: Date.now(), sets: setsFromTarget(ex.target) });
  writes.push(setW('stats', setPoint(ex, todayStr())));

  let completed = false;
  const allDone = r.exercises.every(e => s.exercises.some(x => x.id === e.id));
  if (allDone && s.status !== 'done') {
    s.status = 'done'; s.finishedAt = Date.now();
    completed = true;
  }
  writes.push(setW('sessions', touch(s)));
  emit('local', 'check-exercise', writes);
  return { completed };
}

// ---------- activities (sessions with kind 'activity') ----------
export function addActivity({ sport, minutes, date, note }) {
  const s = makeActivitySession({ sport, minutes, date, note });
  state.sessions[s.id] = s;
  emit('local', 'add-activity', [setW('sessions', s)]);
}

export function updateActivity(id, { sport, minutes, date, note }) {
  const s = findActivity(id); if (!s) return;
  s.activity = { sport, minutes, note };
  s.date = date;
  s.weekKey = weekKeyOf(date);
  emit('local', 'update-activity', [setW('sessions', touch(s))]);
}

export function deleteActivity(id) {
  if (!findActivity(id)) return;
  delete state.sessions[id];
  emit('local', 'delete-activity', [delW('sessions', id)]);
}
