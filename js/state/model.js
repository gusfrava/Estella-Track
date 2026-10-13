// Data shapes (v2). Full design: docs/DATA-MODEL.md.
//
// In memory the app keeps:  State = { profile, routines: {id: Routine}, sessions: {id: Session}, stats: {id: ExerciseStat}, body: {date: BodyEntry} }
// In Firestore each one is its own document:
//   users/{uid}                        profile + settings
//   users/{uid}/routines/{id}          Routine        – the plan
//   users/{uid}/sessions/{id}          Session        – what actually happened (gym workout or other activity)
//   users/{uid}/exerciseStats/{id}     ExerciseStat   – per-exercise history for prefill, "↑ +2.5 kg" and charts
//   users/{uid}/body/{YYYY-MM-DD}      BodyEntry      – weight / height on a day (health data: private, only if the person adds it)
//
// Routine = { id, name, order, recurring, archived, exercises: RoutineExercise[],
//             current: { sessionId, weekKey } | null,   // the session that holds this week's (or, if not recurring, the latest) check marks
//             createdAt, updatedAt }
// RoutineExercise = { id, exerciseId, name, type: 'weight_reps'|'reps'|'time', perSide, video, target: { sets, reps, weight, unit, seconds } }
//   exerciseId = the exercise in the library (data/exercises.json) it was picked from, or null for your own.
//   video = your own YouTube link for its technique ('' = use the library's video or a YouTube search).
//   perSide = unilateral (lunges, one-arm rows): reps are logged for the left and right side separately.
//   type = how a set is measured: weight × reps (squat), reps only (pull-ups), or time (plank). The target keeps
//   every field so switching type and back loses nothing; only the fields of the current type are shown and logged.
//
// Session (gym)      = { id, kind: 'gym', routineId, routineName, date, weekKey, status: 'in_progress'|'done',
//                        startedAt, finishedAt, updatedAt,
//                        exercises: [{ id /* routine exercise id */, name, doneAt, sets: Set[] }] }
//                      An exercise entry is "done" when it has sets and every set is done (see entryDone).
//                      An entry with unchecked sets is in progress: the values typed so far, kept while you train.
// Session (activity) = { id, kind: 'activity', date, weekKey, status: 'done', activity: { sport, minutes, note }, createdAt, updatedAt }
// Set = { kind: 'normal'|'drop'|'warmup', reps, repsR, weight, unit, seconds, done }   // done missing in older data = true
//   reps-only sets have weight 0; time sets have reps 0, weight 0 and the time in seconds.
//   Unilateral: reps = left side, repsR = right side (null when the exercise isn't per side).
//   Drop set: a set with kind 'drop' right after the set it belongs to (lower weight, no rest). It isn't counted
//   as an extra set: "3 series" with a drop on the last one is 3 normal sets + 1 drop.
//
// ExerciseStat = { id /* routine exercise id */, name, points: [{ d: 'YYYY-MM-DD', s: sets, r: reps, w: weight, u: unit, t?: seconds }] }
//   t is only there for time exercises.
//
// Times are milliseconds (Date.now()), dates are local 'YYYY-MM-DD', weekKey is that week's Monday.

import { uid } from '../utils/data.js';
import { todayStr, weekKey, weekKeyOf } from '../utils/dates.js';

export const SCHEMA_VERSION = 2;
export const SHARING_LEVELS = ['private', 'friends', 'public'];
export const DEFAULT_SHARING = { profile: 'friends', routines: 'friends', workouts: 'friends', body: 'private' };
export const MAX_POINTS = 500;   // history points kept per exercise
export const EX_TYPES = ['weight_reps', 'reps', 'time'];
export const normalizeType = v => (EX_TYPES.includes(v) ? v : 'weight_reps');

export const blankState = () => ({ profile: null, routines: {}, sessions: {}, stats: {}, body: {} });

// BodyEntry = { id /* = date */, date, weight, weightUnit: 'kg'|'lb', heightCm, source: 'onboarding'|'manual', updatedAt }
// weight / heightCm are null when not given. Height is always stored in cm (feet + inches are converted).

// ---------- normalizers: fill in missing fields so partial or older data never breaks a screen ----------
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export function normalizeTarget(t = {}) {
  return {
    sets: Math.max(1, Math.round(num(t.sets, 3))), reps: Math.max(1, Math.round(num(t.reps, 10))),
    weight: Math.max(0, num(t.weight, 0)), unit: t.unit === 'lb' ? 'lb' : 'kg', seconds: Math.max(1, Math.round(num(t.seconds, 60))),
  };
}

export function normalizeRoutine(id, d = {}) {
  return {
    id, name: d.name || '', order: num(d.order, 0), recurring: d.recurring !== false, archived: !!d.archived,
    exercises: (Array.isArray(d.exercises) ? d.exercises : []).map(e => ({
      id: e.id, exerciseId: e.exerciseId || null, name: e.name || '', type: normalizeType(e.type), perSide: !!e.perSide && e.type !== 'time',
      video: typeof e.video === 'string' ? e.video.trim() : '',
      target: normalizeTarget(e.target),
    })),
    current: d.current && d.current.sessionId ? { sessionId: d.current.sessionId, weekKey: d.current.weekKey || null } : null,
    createdAt: num(d.createdAt, 0), updatedAt: num(d.updatedAt, 0),
  };
}

export const MAX_SETS = 50;
export const normalizeSet = (s = {}) => ({
  kind: s.kind === 'drop' || s.kind === 'warmup' ? s.kind : 'normal',
  reps: Math.max(0, Math.round(num(s.reps))), repsR: s.repsR == null ? null : Math.max(0, Math.round(num(s.repsR))),
  weight: Math.max(0, num(s.weight)), unit: s.unit === 'lb' ? 'lb' : 'kg',
  seconds: Math.max(0, Math.round(num(s.seconds))), done: s.done !== false,
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

export function normalizeBody(id, d = {}) {
  const pos = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
  return { id, date: d.date || id, weight: pos(d.weight), weightUnit: d.weightUnit === 'lb' ? 'lb' : 'kg', heightCm: pos(d.heightCm),
    source: d.source || 'manual', updatedAt: num(d.updatedAt, 0) };
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

export const makeRoutineExercise = ({ name, type, perSide, sets, reps, weight, unit, seconds, exerciseId, video }) => ({
  id: uid(), exerciseId: exerciseId || null, name, type: normalizeType(type), perSide: !!perSide && type !== 'time', video: (video || '').trim(),
  target: normalizeTarget({ sets, reps, weight, unit, seconds }),
});

export const makeGymSession = routine => ({
  id: uid(), kind: 'gym', routineId: routine.id, routineName: routine.name, date: todayStr(), weekKey: weekKey(), status: 'in_progress',
  startedAt: Date.now(), finishedAt: null, updatedAt: Date.now(), exercises: [],
});

export const makeActivitySession = ({ sport, minutes, date, note }) => ({
  id: uid(), kind: 'activity', date, weekKey: weekKeyOf(date), status: 'done', createdAt: Date.now(), updatedAt: Date.now(), activity: { sport, minutes, note },
});

// The sets an exercise starts with: the routine's target, one entry per set, only the fields its type uses.
// done = checked off already. planSets(ex, done) is the same from a routine exercise.
export const planSets = (ex, done = true) => setsFromTarget(ex.target, done, ex.type, ex.perSide);
export function setsFromTarget(t, done = true, type = 'weight_reps', perSide = false) {
  const set = {
    kind: 'normal', unit: t.unit, done,
    reps: type === 'time' ? 0 : t.reps,
    repsR: perSide && type !== 'time' ? t.reps : null,
    weight: type === 'weight_reps' ? t.weight : 0,
    seconds: type === 'time' ? t.seconds : 0,
  };
  return Array.from({ length: Math.min(MAX_SETS, t.sets) }, () => ({ ...set }));
}

// A logged exercise counts as done when every one of its sets is checked.
export const entryDone = e => !!(e && e.sets.length && e.sets.every(s => s.done));

// Reps a set counts for: per side, the weaker side ("10/8" counts as 8).
export const repsOf = x => (x.repsR == null ? x.reps : Math.min(x.reps, x.repsR));

// The history point an exercise's sets produce (one per day): number of sets done plus the best set –
// heaviest weight (then most reps) for weight × reps, most reps for reps only, longest time for time.
export function pointFromSets(date, sets, type = 'weight_reps') {
  const done = sets.filter(s => s.done);
  if (!done.length) return null;
  const better = type === 'time' ? (a, b) => b.seconds > a.seconds
    : type === 'reps' ? (a, b) => repsOf(b) > repsOf(a)
    : (a, b) => b.weight > a.weight || (b.weight === a.weight && repsOf(b) > repsOf(a));
  const top = done.reduce((a, b) => (better(a, b) ? b : a));
  const p = { d: date, s: done.filter(x => x.kind !== 'drop').length, r: repsOf(top), w: top.weight, u: top.unit };
  if (type === 'time') p.t = top.seconds;
  return p;
}

// ---------- whole state from plain data (device cache, local mode) ----------
export function normalizeState(d) {
  d = d || {};
  const out = blankState();
  out.profile = normalizeProfile(d.profile);
  for (const [id, r] of Object.entries(d.routines || {})) out.routines[id] = normalizeRoutine(id, r);
  for (const [id, s] of Object.entries(d.sessions || {})) out.sessions[id] = normalizeSession(id, s);
  for (const [id, s] of Object.entries(d.stats || {})) out.stats[id] = normalizeStat(id, s);
  for (const [id, b] of Object.entries(d.body || {})) out.body[id] = normalizeBody(id, b);
  return out;
}
