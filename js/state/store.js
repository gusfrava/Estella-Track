// The store holds the user's data and is the ONLY place that changes it.
// Every change calls emit(source, action). Listeners (render, sync) react to it.
//   source 'local'  – the user did something on this device  → saved here and to the cloud
//   source 'remote' – data arrived from the cloud             → saved here only
//   source 'load'   – data loaded at startup / sign-in        → saved here only
//   source 'reset'  – cleared on sign-out
// It knows nothing about the screen or Firebase.

import { blankState, normalizeState, makeRoutine, makeExercise, makeActivity } from './model.js';
import { weekKey, todayStr } from '../utils/dates.js';
import { logger } from '../utils/log.js';

const log = logger('store');
let state = blankState();
const listeners = new Set();

export const getState = () => state;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(source, action) {
  log.debug(action, `(${source})`);
  listeners.forEach(fn => fn(state, { source, action }));
}

// ---------- lookups ----------
export const findRoutine = id => state.routines.find(r => r.id === id);
export const findActivity = id => state.activities.find(a => a.id === id);
const findExercise = (r, id) => (r ? r.exercises.find(e => e.id === id) : null);

// ---------- whole-state ----------
export function loadState(data, source = 'load') {
  state = normalizeState(data);
  rollWeek();
  emit(source, 'load');
}

export function clearState() {
  state = blankState();
  emit('reset', 'clear');
}

// Unchecks recurring routines when a new week starts. Returns true if anything changed.
function rollWeek() {
  const wk = weekKey();
  let changed = false;
  state.routines.forEach(r => {
    if (r.recurring && r.weekKey !== wk) {
      r.exercises.forEach(e => { e.done = false; e.doneAt = null; });
      r.completedAt = null;
      r.weekKey = wk;
      changed = true;
    }
  });
  return changed;
}

export function checkNewWeek() {
  if (rollWeek()) emit('local', 'new-week');
}

const allDone = r => r.exercises.length > 0 && r.exercises.every(e => e.done);

function refreshCompletion(r) {
  if (r.completedAt && !allDone(r)) {
    r.completedAt = null;
    const today = todayStr();
    if (r.completions[r.completions.length - 1] === today) r.completions.pop();
  }
}

// ---------- routines ----------
export function addRoutine({ name, recurring }) {
  const r = makeRoutine({ name, recurring });
  state.routines.push(r);
  emit('local', 'add-routine');
  return r;
}

export function updateRoutine(id, { name, recurring }) {
  const r = findRoutine(id); if (!r) return;
  r.name = name;
  r.recurring = !!recurring;
  if (r.recurring) r.weekKey = weekKey();
  emit('local', 'update-routine');
}

export function deleteRoutine(id) {
  state.routines = state.routines.filter(r => r.id !== id);
  emit('local', 'delete-routine');
}

export function resetRoutine(id) {
  const r = findRoutine(id); if (!r) return;
  const today = todayStr();
  r.exercises.forEach(e => {
    if (e.done) e.history = e.history.filter(h => h.d !== today);
    e.done = false; e.doneAt = null;
  });
  r.completedAt = null;
  emit('local', 'reset-routine');
}

// ---------- exercises ----------
export function addExercise(routineId, data) {
  const r = findRoutine(routineId); if (!r) return;
  r.exercises.push(makeExercise(data));
  refreshCompletion(r);
  emit('local', 'add-exercise');
}

export function updateExercise(routineId, exId, data) {
  const r = findRoutine(routineId), ex = findExercise(r, exId); if (!ex) return;
  Object.assign(ex, data);
  // If it was already checked today, today's history entry follows the edit.
  const entry = ex.history.find(h => h.d === todayStr());
  if (entry && ex.done) Object.assign(entry, { s: ex.sets, r: ex.reps, w: ex.weight, u: ex.unit });
  emit('local', 'update-exercise');
}

export function deleteExercise(routineId, exId) {
  const r = findRoutine(routineId); if (!r) return;
  r.exercises = r.exercises.filter(e => e.id !== exId);
  refreshCompletion(r);
  emit('local', 'delete-exercise');
}

// Checks/unchecks an exercise. Returns { completed: true } when this check finished the routine.
export function toggleExercise(routineId, exId) {
  const r = findRoutine(routineId), ex = findExercise(r, exId);
  if (!ex) return { completed: false };
  const today = todayStr();
  ex.done = !ex.done;
  ex.doneAt = ex.done ? Date.now() : null;
  ex.history = ex.history.filter(h => h.d !== today);
  if (ex.done) ex.history.push({ d: today, s: ex.sets, r: ex.reps, w: ex.weight, u: ex.unit });
  if (r.recurring) r.weekKey = weekKey();

  let completed = false;
  if (allDone(r) && !r.completedAt) {
    r.completedAt = new Date().toISOString();
    r.completions.push(today);
    completed = true;
  } else {
    refreshCompletion(r);
  }
  emit('local', ex.done ? 'check-exercise' : 'uncheck-exercise');
  return { completed };
}

// ---------- activities ----------
export function addActivity(data) {
  state.activities.push(makeActivity(data));
  emit('local', 'add-activity');
}

export function updateActivity(id, data) {
  const a = findActivity(id); if (!a) return;
  Object.assign(a, data);
  emit('local', 'update-activity');
}

export function deleteActivity(id) {
  state.activities = state.activities.filter(a => a.id !== id);
  emit('local', 'delete-activity');
}
