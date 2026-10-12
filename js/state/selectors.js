// Read-only calculations on the data (no changes here). Views use these.
// "Done this week" is never stored: it comes from the routine's current session.
import { ymd, weekRange, todayStr } from '../utils/dates.js';
import { currentSession } from './store.js';

export const routinesList = state =>
  Object.values(state.routines).filter(r => !r.archived).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);

export function isRoutineDone(r) {
  const s = currentSession(r);
  return !!(s && s.status === 'done');
}

// The logged entry for one exercise in the routine's current session, or null.
export function loggedEntry(r, exId) {
  const s = currentSession(r);
  return (s && s.exercises.find(e => e.id === exId)) || null;
}

export function routineProgress(r) {
  const s = currentSession(r);
  const total = r.exercises.length;
  const done = s ? r.exercises.filter(e => s.exercises.some(x => x.id === e.id)).length : 0;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

// Unfinished routines first, finished ones at the bottom.
export function orderedRoutines(state) {
  const list = routinesList(state);
  return [...list.filter(r => !isRoutineDone(r)), ...list.filter(r => isRoutineDone(r))];
}

// Unchecked exercises in their order, then checked ones in the order they were checked.
// Each item: { ex, logged } where logged is the session entry (or null).
export function orderedExercises(r) {
  const items = r.exercises.map(ex => ({ ex, logged: loggedEntry(r, ex.id) }));
  return {
    pending: items.filter(i => !i.logged),
    done: items.filter(i => i.logged).sort((a, b) => (a.logged.doneAt || 0) - (b.logged.doneAt || 0)),
  };
}

const byNewest = (a, b) => (b.date + (b.createdAt || 0)).localeCompare(a.date + (a.createdAt || 0));

export function activities(state) {
  return Object.values(state.sessions).filter(s => s.kind === 'activity').sort(byNewest);
}

export function weekSummary(state) {
  const { start, end } = weekRange();
  const from = ymd(start), to = ymd(end);
  const list = routinesList(state);
  const doneCount = list.filter(isRoutineDone).length;
  const acts = activities(state);
  return {
    start, end, doneCount, total: list.length,
    pct: list.length ? Math.round((doneCount / list.length) * 100) : 0,
    weekActivities: acts.filter(a => a.date >= from && a.date <= to),
    olderActivities: acts.filter(a => a.date < from),
  };
}

export const exerciseHistory = (state, exId) => (state.stats[exId] ? state.stats[exId].points : []);

// The last saved session before today (for "↑ +2.5 kg").
export function previousEntry(state, exId) {
  const today = todayStr();
  const past = exerciseHistory(state, exId).filter(p => p.d !== today);
  return past.length ? past[past.length - 1] : null;
}

export function weightChange(state, ex) {
  const prev = previousEntry(state, ex.id);
  if (!prev || prev.u !== ex.target.unit) return 0;
  return Number(ex.target.weight) - Number(prev.w);
}

export function lastUsedUnit(state) {
  for (const r of routinesList(state)) for (const e of r.exercises) if (e.target && e.target.unit) return e.target.unit;
  return 'kg';
}
