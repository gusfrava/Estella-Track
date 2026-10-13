// The store holds the user's data in memory and is the ONLY place that changes it.
// Every change calls emit(source, action, writes):
//   source 'local'  – the user did something on this device → sync saves `writes` to Firestore
//   source 'remote' – a document changed in Firestore (other phone, or our own write echoing back)
//   source 'load'   – loaded from the device cache / local mode
//   source 'reset'  – cleared on sign-out
//   writes = [{ op: 'set'|'delete', col: 'routines'|'sessions'|'stats'|'body', id, data }]  – one entry per document
// It knows nothing about the screen or Firebase.

import {
  blankState, normalizeState, normalizeRoutine, normalizeSession, normalizeStat, normalizeProfile, normalizeBody,
  makeRoutine, makeRoutineExercise, normalizeSource, makeGymSession, makeActivitySession, normalizeTarget, normalizeSet, normalizeType, planSets,
  entryDone, pointFromSets, MAX_POINTS, MAX_SETS,
} from './model.js';
import { weekKey, weekKeyOf, ymdOf, todayStr } from '../utils/dates.js';
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

// point = { d, s, r, w, u, t? } (see pointFromSets). Replaces that day's point.
function setPoint(ex, point) {
  const st = statFor(ex);
  st.points = st.points.filter(p => p.d !== point.d);
  st.points.push(point);
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
const NORMALIZE = { routines: normalizeRoutine, sessions: normalizeSession, stats: normalizeStat, body: normalizeBody };
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

// ---------- body data (users/{uid}/body/{date}) ----------
// One entry per day; saving again the same day updates it. Only what's given is stored (null = not given).
// Weekly goal (days a week). Applies from this week on; earlier weeks keep theirs (see selectors.weeklyGoalFor).
export function setWeeklyGoal(days) {
  const n = Math.min(7, Math.max(1, Math.round(Number(days) || 0)));
  const goals = { ...((state.profile && state.profile.weeklyGoals) || {}) };
  goals[weekKey()] = n;
  updateProfile({ weeklyGoals: goals });
}

export function saveBody({ weight = null, weightUnit = 'kg', heightCm = null, source = 'manual' }) {
  if (!weight && !heightCm) return;
  const date = todayStr();
  const prev = state.body[date] || {};
  const entry = normalizeBody(date, { ...prev, date, weight: weight ?? prev.weight, weightUnit, heightCm: heightCm ?? prev.heightCm, source, updatedAt: Date.now() });
  state.body[date] = entry;
  emit('local', 'save-body', [setW('body', entry)]);
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

// Several routines with their exercises at once (the starter plan). list = [{ name, exercises: [makeRoutineExercise data] }]
// source (optional) = where it came from, see model.normalizeSource ("Copiar rutina" passes the friend).
export function addRoutines(list) {
  let order = Math.max(-1, ...Object.values(state.routines).map(r => r.order));
  const created = list.map(({ name, exercises = [], source = null }) => {
    const r = makeRoutine({ name, recurring: true, order: ++order });
    r.exercises = exercises.map(makeRoutineExercise);
    r.source = normalizeSource(source);
    state.routines[r.id] = r;
    return r;
  });
  if (created.length) emit('local', 'add-routines', created.map(r => setW('routines', r)));
  return created;
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

// "Hacer otra vez": a finished routine starts fresh today, keeping the finished workout in your history
// (unlike "Desmarcar todo", which throws it away). The next check-off creates a new session.
export function repeatRoutine(id) {
  const r = findRoutine(id); if (!r || !r.current) return;
  r.current = null;
  emit('local', 'repeat-routine', [setW('routines', touch(r))]);
}

// "Desmarcar todo": throws away the current check marks (and their history points).
export function resetRoutine(id) {
  const r = findRoutine(id); if (!r) return;
  const s = currentSession(r);
  const writes = [];
  if (s) {
    for (const e of s.exercises.filter(entryDone)) {
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

// Pen icon: changes the plan (name + target). Sets already logged this session keep what you actually did,
// unless they still match the old plan exactly – then they follow the new plan (fixing a typo after a quick check-off).
export function updateExercise(routineId, exId, data) {
  const r = findRoutine(routineId);
  const ex = r && r.exercises.find(e => e.id === exId); if (!ex) return;
  const old = { target: ex.target, type: ex.type, perSide: ex.perSide };
  ex.name = data.name;
  if ('video' in data) ex.video = (data.video || '').trim();
  if ('exerciseId' in data) ex.exerciseId = data.exerciseId || null;
  ex.type = normalizeType(data.type || ex.type);
  ex.perSide = !!data.perSide && ex.type !== 'time';
  ex.target = normalizeTarget(data);
  const writes = [setW('routines', touch(r))];
  const s = currentSession(r);
  const e = s && s.exercises.find(x => x.id === exId);
  if (e) {
    e.name = ex.name;
    if (matchesPlan(e, old)) {
      const all = entryDone(e);
      e.sets = planSets(ex, false).map((x, i) => ({ ...x, done: all || !!(e.sets[i] && e.sets[i].done) }));
    } else if (old.perSide !== ex.perSide) {    // per side switched: right side starts as a copy of the left
      e.sets.forEach(x => { x.repsR = ex.perSide ? x.reps : null; });
    }
    settle(r, ex, s, e, writes);
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
    updateStatus(r, s);
    writes.push(setW('sessions', touch(s)));
  }
  emit('local', 'delete-exercise', writes);
}

// ---------- logging what you did (entries in the routine's current session) ----------
// Entry = { id, name, doneAt, sets: [{ reps, weight, unit, done, kind }] }. It's done when every set is done.

// True when the entry's sets are exactly the plan (nothing typed or added by hand).
// ex = the routine exercise (or its old { target, type, perSide } before an edit).
function matchesPlan(e, ex) {
  const plan = planSets(ex, false);
  return e.sets.length === plan.length
    && e.sets.every((x, i) => x.kind === 'normal' && x.reps === plan[i].reps && x.repsR === plan[i].repsR
      && x.weight === plan[i].weight && x.seconds === plan[i].seconds && x.unit === plan[i].unit);
}

// A set and the drops right after it: indexes [start, end) in entry.sets.
function groupAt(sets, i) {
  let start = i; while (start > 0 && sets[start].kind === 'drop') start--;
  let end = start + 1; while (end < sets.length && sets[end].kind === 'drop') end++;
  return { start, end };
}

// Drop weight: about 20% less, rounded down to 2.5 kg / 5 lb.
function dropWeight(w, unit) {
  const step = unit === 'lb' ? 5 : 2.5;
  return Math.max(0, Math.floor((w * 0.8) / step) * step);
}

// This exercise's entry in the current session. With create, makes the session and/or entry (sets from the plan, unchecked).
function entryFor(r, ex, create, writes) {
  let s = currentSession(r);
  let e = s && s.exercises.find(x => x.id === ex.id);
  if (e || !create) return { s, e };
  if (!s) {
    s = makeGymSession(r);
    state.sessions[s.id] = s;
    r.current = { sessionId: s.id, weekKey: s.weekKey };
    writes.push(setW('routines', touch(r)));
  }
  s.routineName = r.name;
  e = { id: ex.id, name: ex.name, doneAt: null, sets: planSets(ex, false) };
  s.exercises.push(e);
  return { s, e };
}

// Session status follows its entries. Returns true when this change finished the routine.
function updateStatus(r, s) {
  const all = r.exercises.length > 0 && r.exercises.every(x => entryDone(s.exercises.find(y => y.id === x.id)));
  if (all && s.status !== 'done') { s.status = 'done'; s.finishedAt = Date.now(); return true; }
  if (!all && s.status === 'done') { s.status = 'in_progress'; s.finishedAt = null; }
  return false;
}

// After any change to an entry: keep doneAt, the history point and the session status in step.
function settle(r, ex, s, e, writes) {
  if (entryDone(e)) {
    if (!e.doneAt) e.doneAt = Date.now();
    writes.push(setW('stats', setPoint(ex, pointFromSets(ymdOf(e.doneAt), e.sets, ex.type))));
  } else if (e.doneAt) {
    const st = removePoint(ex.id, ymdOf(e.doneAt));
    if (st) writes.push(setW('stats', st));
    e.doneAt = null;
  }
  const completed = updateStatus(r, s);
  writes.push(setW('sessions', touch(s)));
  return completed;
}

// Removes an entry; an empty session is deleted so "nothing logged" leaves nothing behind.
function dropEntry(r, s, e, writes) {
  if (e.doneAt) { const st = removePoint(e.id, ymdOf(e.doneAt)); if (st) writes.push(setW('stats', st)); }
  s.exercises = s.exercises.filter(x => x !== e);
  if (!s.exercises.length) {
    delete state.sessions[s.id];
    writes.push(delW('sessions', s.id));
    r.current = null;
    writes.push(setW('routines', touch(r)));
  } else {
    updateStatus(r, s);
    writes.push(setW('sessions', touch(s)));
  }
}

const NOTHING = { completed: false, exerciseDone: false, setDone: false };

// Big checkbox. Not done → every set done (as planned, or with the values typed so far).
// Done → unchecked: dropped if it was exactly the plan, otherwise the typed values stay with the sets unchecked.
// Returns { completed } – true when this finished the routine.
export function toggleExercise(routineId, exId) {
  const r = findRoutine(routineId);
  const ex = r && r.exercises.find(e => e.id === exId);
  if (!ex) return NOTHING;
  const writes = [];
  const found = entryFor(r, ex, false, writes);

  if (entryDone(found.e)) {
    if (matchesPlan(found.e, ex)) dropEntry(r, found.s, found.e, writes);
    else { found.e.sets.forEach(x => { x.done = false; }); settle(r, ex, found.s, found.e, writes); }
    emit('local', 'uncheck-exercise', writes);
    return NOTHING;
  }

  const { s, e } = entryFor(r, ex, true, writes);
  e.sets.forEach(x => { x.done = true; });
  const completed = settle(r, ex, s, e, writes);
  emit('local', 'check-exercise', writes);
  return { completed, exerciseDone: true, setDone: false };
}

// Shared by the per-set actions: find/create the entry, apply fn(entry, ex) (false = nothing changed), settle, save.
function changeSets(routineId, exId, action, fn) {
  const r = findRoutine(routineId);
  const ex = r && r.exercises.find(e => e.id === exId);
  if (!ex) return NOTHING;
  const writes = [];
  const before = { current: r.current, updatedAt: r.updatedAt, existed: !!entryFor(r, ex, false, writes).e };
  const { s, e } = entryFor(r, ex, true, writes);
  const result = fn(e, ex);
  if (result === false) {                       // nothing changed → undo a session/entry made just now
    if (!before.existed) {
      s.exercises = s.exercises.filter(x => x !== e);
      if (!s.exercises.length && r.current && r.current.sessionId === s.id) { delete state.sessions[s.id]; r.current = before.current; r.updatedAt = before.updatedAt; }
    }
    return NOTHING;
  }
  const completed = settle(r, ex, s, e, writes);
  emit('local', action, writes);
  return { completed, exerciseDone: entryDone(e), setDone: result === 'set-done' };
}

// ✓ on one set.
export const toggleSet = (routineId, exId, i) => changeSets(routineId, exId, 'toggle-set', e => {
  const x = e.sets[i]; if (!x) return false;
  x.done = !x.done;
  return x.done ? 'set-done' : true;
});

// "+ Serie": a copy of the last normal set (not its drops), unchecked.
export const addSet = (routineId, exId) => changeSets(routineId, exId, 'add-set', (e, ex) => {
  if (e.sets.length >= MAX_SETS) return false;
  const last = [...e.sets].reverse().find(x => x.kind !== 'drop') || planSets(ex, false)[0];
  e.sets.push({ ...last, kind: 'normal', done: false });
});

// "↓ Drop": a lighter set added to the set you just did (the last checked one, or the last set if none is checked
// yet), after any drops it already has. Same reps, about 20% less weight.
export const addDrop = (routineId, exId) => changeSets(routineId, exId, 'add-drop', e => {
  if (e.sets.length >= MAX_SETS) return false;
  let i = -1;
  e.sets.forEach((x, k) => { if (x.done && x.kind !== 'drop') i = k; });
  if (i < 0) i = e.sets.length - 1;
  const { end } = groupAt(e.sets, i);
  const prev = e.sets[end - 1];
  e.sets.splice(end, 0, { ...prev, kind: 'drop', weight: dropWeight(prev.weight, prev.unit), done: false });
});

// × on a row. A drop just goes; a set goes with its drops (an exercise always keeps at least one set).
export const removeSet = (routineId, exId, i) => changeSets(routineId, exId, 'remove-set', e => {
  const x = e.sets[i]; if (!x) return false;
  if (x.kind === 'drop') { e.sets.splice(i, 1); return; }
  if (e.sets.filter(y => y.kind !== 'drop').length <= 1) return false;
  const { start, end } = groupAt(e.sets, i);
  e.sets.splice(start, end - start);
});

// Typed values for one set. patch = { reps } | { repsR } | { weight } | { seconds }.
// Action 'edit-set': the screen already shows the typed value, so main.js waits until you leave the field to re-render.
export const updateSet = (routineId, exId, i, patch) => changeSets(routineId, exId, 'edit-set', e => {
  const x = e.sets[i]; if (!x) return false;
  const next = normalizeSet({ ...x, ...patch });
  if (next.reps === x.reps && next.repsR === x.repsR && next.weight === x.weight && next.seconds === x.seconds) return false;
  e.sets[i] = next;
});

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
