// Read-only calculations on the data (no changes here). Views use these.
// "Done this week" is never stored: it comes from the routine's current session.
import { ymd, weekRange, todayStr } from '../utils/dates.js';
import { currentSession } from './store.js';
import { entryDone, planSets } from './model.js';

export const routinesList = state =>
  Object.values(state.routines).filter(r => !r.archived).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);

export function isRoutineDone(r) {
  const s = currentSession(r);
  return !!(s && s.status === 'done');
}

// The logged entry for one exercise in the routine's current session (done or still in progress), or null.
export function loggedEntry(r, exId) {
  const s = currentSession(r);
  return (s && s.exercises.find(e => e.id === exId)) || null;
}

export function routineProgress(r) {
  const s = currentSession(r);
  const total = r.exercises.length;
  const done = s ? r.exercises.filter(e => entryDone(s.exercises.find(x => x.id === e.id))).length : 0;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

// Unfinished routines first, finished ones at the bottom.
export function orderedRoutines(state) {
  const list = routinesList(state);
  return [...list.filter(r => !isRoutineDone(r)), ...list.filter(r => isRoutineDone(r))];
}

// Unfinished exercises in their order, then finished ones in the order they were finished.
// Each item: { ex, logged, done } – logged is the session entry (or null), done = all its sets checked.
export function orderedExercises(r) {
  const items = r.exercises.map(ex => { const logged = loggedEntry(r, ex.id); return { ex, logged, done: entryDone(logged) }; });
  return {
    pending: items.filter(i => !i.done),
    done: items.filter(i => i.done).sort((a, b) => (a.logged.doneAt || 0) - (b.logged.doneAt || 0)),
  };
}

// The sets shown when an exercise is opened: what's logged this session, or the plan (nothing checked yet).
export const setsToShow = item => (item.logged ? item.logged.sets : planSets(item.ex, false));

// What you did last time (before this session): { date, sets } from the newest earlier session,
// or { date, point } from the history if that session is older than what's loaded. null if never done.
export function lastTime(state, r, exId) {
  const cur = currentSession(r);
  let best = null;
  for (const s of Object.values(state.sessions)) {
    if (s.kind !== 'gym' || s === cur) continue;
    const e = s.exercises.find(x => x.id === exId);
    const sets = e ? e.sets.filter(x => x.done) : [];
    if (!sets.length) continue;
    const when = s.date + String(e.doneAt || s.finishedAt || s.startedAt || 0).padStart(14, '0');
    if (!best || when > best.when) best = { when, date: s.date, sets };
  }
  if (best) return { date: best.date, sets: best.sets };
  const before = cur ? cur.date : todayStr();
  const p = exerciseHistory(state, exId).filter(x => x.d < before).pop();
  return p ? { date: p.d, point: p } : null;
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

// The plan compared with the last time it was done ("↑ +2.5 kg", "↑ +2 reps", "↑ +15 s"): { diff, kind }.
// kind = 'weight' | 'reps' | 'time'. diff 0 when there's nothing to compare (or the last point was another type).
export function planChange(state, ex) {
  const prev = previousEntry(state, ex.id);
  const tg = ex.target;
  if (!prev) return { diff: 0, kind: 'weight' };
  if (ex.type === 'time') return { diff: prev.t != null ? tg.seconds - prev.t : 0, kind: 'time' };
  if (prev.t != null) return { diff: 0, kind: 'weight' };
  if (ex.type === 'reps') return { diff: tg.reps - prev.r, kind: 'reps' };
  return { diff: prev.u === tg.unit ? Number(tg.weight) - Number(prev.w) : 0, kind: 'weight' };
}

export function lastUsedUnit(state) {
  for (const r of routinesList(state)) for (const e of r.exercises) if (e.target && e.target.unit) return e.target.unit;
  return 'kg';
}
