// Read-only calculations on the data (no changes here). Views use these.
import { ymd, weekRange, todayStr } from '../utils/dates.js';

export function routineProgress(r) {
  const total = r.exercises.length;
  const done = r.exercises.filter(e => e.done).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

// Unfinished routines first, finished ones at the bottom.
export function orderedRoutines(state) {
  return [...state.routines.filter(r => !r.completedAt), ...state.routines.filter(r => r.completedAt)];
}

// Unchecked exercises in their order, then checked ones in the order they were checked.
export function orderedExercises(r) {
  return {
    pending: r.exercises.filter(e => !e.done),
    done: r.exercises.filter(e => e.done).sort((a, b) => (a.doneAt || 0) - (b.doneAt || 0)),
  };
}

export function weekSummary(state) {
  const { start, end } = weekRange();
  const from = ymd(start), to = ymd(end);
  const doneCount = state.routines.filter(r => r.completedAt).length;
  const total = state.routines.length;
  const byNewest = (a, b) => (b.date + (b.created || '')).localeCompare(a.date + (a.created || ''));
  return {
    start, end, doneCount, total,
    pct: total ? Math.round((doneCount / total) * 100) : 0,
    weekActivities: state.activities.filter(a => a.date >= from && a.date <= to).sort(byNewest),
    olderActivities: state.activities.filter(a => a.date < from).sort(byNewest),
  };
}

// The last saved session before today (for "↑ +2.5 kg").
export function previousEntry(ex) {
  const today = todayStr();
  const past = ex.history.filter(h => h.d !== today);
  return past.length ? past[past.length - 1] : null;
}

export function weightChange(ex) {
  const prev = previousEntry(ex);
  if (!prev || prev.u !== ex.unit) return 0;
  return Number(ex.weight) - Number(prev.w);
}

export function lastUsedUnit(state) {
  for (const r of state.routines) for (const e of r.exercises) if (e.unit) return e.unit;
  return 'kg';
}
