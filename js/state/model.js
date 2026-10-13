// Data shapes (v2). Full design: docs/DATA-MODEL.md.
//
// In memory the app keeps:  State = { profile, routines: {id: Routine}, sessions: {id: Session}, stats: {id: ExerciseStat} }
// In Firestore each one is its own document:
//   users/{uid}                        profile + settings
//   users/{uid}/routines/{id}          Routine        – the plan
//   users/{uid}/sessions/{id}          Session        – what actually happened (gym workout or other activity)
//   users/{uid}/exerciseStats/{id}     ExerciseStat   – per-exercise history for prefill, "↑ +2.5 kg" and charts
//
// Routine = { id, name, order, recurring, archived, exercises: RoutineExercise[],
//             current: { sessionId, weekKey } | null,   // the session that holds this week's (or, if not recurring, the latest) check marks
//             createdAt, updatedAt }
// RoutineExercise = { id, exerciseId, name, type: 'weight_reps', target: { sets, reps, weight, unit } }
//
// Session (gym)      = { id, kind: 'gym', routineId, routineName, date, weekKey, status: 'in_progress'|'done',
//                        startedAt, finishedAt, updatedAt,
//                        exercises: [{ id /* routine exercise id */, name, doneAt, sets: Set[] }] }
//                      An exercise entry is "done" when it has sets and every set is done (see entryDone).
//                      An entry with unchecked sets is in progress: the values typed so far, kept while you train.
// Session (activity) = { id, kind: 'activity', date, weekKey, status: 'done', activity: { sport, minutes, note }, createdAt, updatedAt }
// Set = { kind: 'normal'|'drop'|'warmup', reps, weight, unit, done }   // done missing in older data = true
//
// ExerciseStat = { id /* routine exercise id */, name, points: [{ d: 'YYYY-MM-DD', s: sets, r: reps, w: weight, u: unit }] }
//
// Times are milliseconds (Date.now()), dates are local 'YYYY-MM-DD', weekKey is that week's Monday.

import { uid } from '../utils/data.js';
import { todayStr, weekKey, weekKeyOf } from '../utils/dates.js';

export const SCHEMA_VERSION = 2;
export const SHARING_LEVELS = ['private', 'friends', 'public'];
export const DEFAULT_SHARING = { profile: 'friends', routines: 'friends', workouts: 'friends', body: 'private' };
export const MAX_POINTS = 500;   // history points kept per exercise

export const blankState = () => ({ profile: null, routines: {}, sessions: {}, stats: {} });

// ---------- normalizers: fill in missing fields so partial or older data never breaks a screen ----------
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export function normalizeTarget(t = {}) {
  return { sets: Math.max(1, Math.round(num(t.sets, 3))), reps: Math.max(1, Math.round(num(t.reps, 10))), weight: Math.max(0, num(t.weight, 0)), unit: t.unit === 'lb' ? 'lb' : 'kg' };
}

export function normalizeRoutine(id, d = {}) {
  return {
    id, name: d.name || '', order: num(d.order, 0), recurring: d.recurring !== false, archived: !!d.archived,
    exercises: (Array.isArray(d.exercises) ? d.exercises : []).map(e => ({
      id: e.id, exerciseId: e.exerciseId || null, name: e.name || '', type: e.type || 'weight_reps', target: normalizeTarget(e.target),
    })),
    current: d.current && d.current.sessionId ? { sessionId: d.current.sessionId, weekKey: d.current.weekKey || null } : null,
    createdAt: num(d.createdAt, 0), updatedAt: num(d.updatedAt, 0),
  };
}

export const MAX_SETS = 50;
export const normalizeSet = (s = {}) => ({
  kind: s.kind || 'normal', reps: Math.max(0, Math.round(num(s.reps))), weight: Math.max(0, num(s.weight)), unit: s.unit === 'lb' ? 'lb' : 'kg', done: s.done !== false,
});

export function normalizeSession(id, d = {}) {
  const date = d.date || todayStr();
  const base = { id, kind: d.kind === 'activity' ? 'activity' : 'gym', date, weekKey: d.weekKey || weekKeyOf(date), status: d.status === 'in_progress' ? 'in_progress' : 'done', updatedAt: num(d.updatedAt, 0) };
  if (base.kind === 'activity') {
    const a = d.activity || {};
    return { ...base, status: 'done', createdAt: num(d.createdAt, 0), activity: { sport: a.sport || '', minutes: Math.max(0, Math.round(num(a.minutes, 0))), note: a.note || '' } };
  }
  return {
    ...base, routineId: d.routineId || null, routineName: d.routineName || '',
    startedAt: num(d.startedAt, 0), finishedAt: d.finishedAt ? num(d.finishedAt) : null,
    exercises: (Array.isArray(d.exercises) ? d.exercises : []).map(e => ({
      id: e.id, name: e.name || '', doneAt: e.doneAt ? num(e.doneAt) : null,
      sets: (Array.isArray(e.sets) ? e.sets : []).map(normalizeSet),
    })),
  };
}

export function normalizeStat(id, d = {}) {
  return { id, name: d.name || '', points: (Array.isArray(d.points) ? d.points : []).filter(p => p && p.d).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0)) };
}

export function normalizeProfile(d) {
  if (!d) return null;
  const { state, ...rest } = d;        // `state` is the v1 backup – never kept in memory
  return { ...rest, sharing: { ...DEFAULT_SHARING, ...(rest.sharing || {}) } };
}

// ---------- factories ----------
export const makeRoutine = ({ name, recurring, order }) => ({
  id: uid(), name, order, recurring: !!recurring, archived: false, exercises: [], current: null, createdAt: Date.now(), updatedAt: Date.now(),
});

export const makeRoutineExercise = ({ name, sets, reps, weight, unit }) => ({
  id: uid(), exerciseId: null, name, type: 'weight_reps', target: normalizeTarget({ sets, reps, weight, unit }),
});

export const makeGymSession = routine => ({
  id: uid(), kind: 'gym', routineId: routine.id, routineName: routine.name, date: todayStr(), weekKey: weekKey(), status: 'in_progress',
  startedAt: Date.now(), finishedAt: null, updatedAt: Date.now(), exercises: [],
});

export const makeActivitySession = ({ sport, minutes, date, note }) => ({
  id: uid(), kind: 'activity', date, weekKey: weekKeyOf(date), status: 'done', createdAt: Date.now(), updatedAt: Date.now(), activity: { sport, minutes, note },
});

// The sets an exercise starts with: the routine's target, one entry per set. done = checked off already.
export const setsFromTarget = (t, done = true) =>
  Array.from({ length: Math.min(MAX_SETS, t.sets) }, () => ({ kind: 'normal', reps: t.reps, weight: t.weight, unit: t.unit, done }));

// A logged exercise counts as done when every one of its sets is checked.
export const entryDone = e => !!(e && e.sets.length && e.sets.every(s => s.done));

// The history point an exercise's sets produce: heaviest weight, best reps at that weight, number of sets done.
export function pointFromSets(date, sets) {
  const done = sets.filter(s => s.done);
  if (!done.length) return null;
  const top = done.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a));
  return { d: date, s: done.length, r: top.reps, w: top.weight, u: top.unit };
}

// ---------- whole state from plain data (device cache, local mode) ----------
export function normalizeState(d) {
  d = d || {};
  const out = blankState();
  out.profile = normalizeProfile(d.profile);
  for (const [id, r] of Object.entries(d.routines || {})) out.routines[id] = normalizeRoutine(id, r);
  for (const [id, s] of Object.entries(d.sessions || {})) out.sessions[id] = normalizeSession(id, s);
  for (const [id, s] of Object.entries(d.stats || {})) out.stats[id] = normalizeStat(id, s);
  return out;
}
