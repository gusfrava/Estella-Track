// The progress engine: every progress number on the Progress tab, the weekly digest and (later) the coach comes from
// here, so web and app never calculate one differently. Pure: reads the store's state, no DOM, no Firebase.
// Rule for every number: warm-ups and sets without weight are left out.
import { routinesList, weeklyStreak, weekStatuses } from './selectors.js';
import { todayStr } from '../utils/dates.js';

export const LB = 0.45359237;
const MAX_GYM_MINUTES = 180;   // a session left open overnight shouldn't count as 14 hours (same as the recap)
export const E1RM_MAX_REPS = 12;   // Epley gets unreliable above ~12 reps

export const toKg = (w, unit) => (unit === 'lb' ? w * LB : w);
export const fromKg = (kg, unit) => (unit === 'lb' ? kg / LB : kg);

// Estimated one-rep max (Epley): weight × (1 + reps / 30). null for sets of more than 12 reps or without weight.
export const e1rm = (weight, reps) => (weight > 0 && reps > 0 && reps <= E1RM_MAX_REPS ? weight * (1 + reps / 30) : null);

// Volume of one set in kg: weight × reps (both sides for per-side exercises). 0 for warm-ups, unchecked sets
// and sets without weight.
export function setVolumeKg(x) {
  if (!x.done || x.kind === 'warmup' || !(x.weight > 0)) return 0;
  return toKg(x.weight, x.unit) * (x.reps + (x.repsR || 0));
}

const gymSetsDone = s => s.exercises.some(e => e.sets.some(x => x.done && x.kind !== 'warmup'));
const gymMinutes = s => (s.startedAt && s.finishedAt && s.finishedAt > s.startedAt
  ? Math.min(MAX_GYM_MINUTES, Math.round((s.finishedAt - s.startedAt) / 60000)) : 0);

// Workouts, minutes and volume (kg) of the sessions dated in [from, to] ('YYYY-MM-DD', either may be omitted).
// A workout = a gym session with a checked set (warm-ups alone don't count) or a logged activity.
export function trainingBetween(state, from = '', to = '9999-99-99') {
  let workouts = 0, minutes = 0, volumeKg = 0;
  for (const s of Object.values(state.sessions)) {
    if (s.date < from || s.date > to) continue;
    if (s.kind === 'activity') { workouts++; minutes += Math.max(0, Number(s.activity && s.activity.minutes) || 0); continue; }
    if (!gymSetsDone(s)) continue;
    workouts++;
    minutes += gymMinutes(s);
    for (const e of s.exercises) for (const x of e.sets) volumeKg += setVolumeKg(x);
  }
  return { workouts, minutes, volumeKg };
}

// Volume from history points on days with no loaded session (signed-in accounts keep only ~120 days of sessions
// in memory): sets × top-set reps × weight, an estimate since a point only keeps the day's top set.
function olderVolumeKg(state) {
  const sessionDays = new Set();
  for (const s of Object.values(state.sessions)) if (s.kind === 'gym') for (const e of s.exercises) sessionDays.add(`${e.id}|${s.date}`);
  let kg = 0;
  for (const [id, st] of Object.entries(state.stats)) {
    for (const p of st.points) {
      if (p.t != null || !(p.w > 0) || sessionDays.has(`${id}|${p.d}`)) continue;
      kg += toKg(p.w, p.u) * (p.r || 0) * (p.s || 1);
    }
  }
  return kg;
}

// The overall stats (free): { month: { workouts, minutes, volumeKg }, total: { workouts, minutes, volumeKg },
// goalWeeks (weeks the goal was met; before a goal was set, weeks trained at all, as the streak counts them;
// weeks kept by a comodín don't count), streak (selectors.weeklyStreak) }.
export function overallStats(state, today = todayStr()) {
  const month = trainingBetween(state, today.slice(0, 8) + '01', today);
  const total = trainingBetween(state);
  total.volumeKg += olderVolumeKg(state);
  const goalWeeks = weekStatuses(state).filter(w => w.status === 'met').length;
  return { month, total, goalWeeks, streak: weeklyStreak(state) };
}

// ---------- comparable improvements (only like with like) ----------
// For one exercise's history points (oldest first, { d, r, w, u, t? }) and its type: every point that beat
// an earlier one, as [{ point, prev, kind }] oldest first. kind:
//   'weight' – more weight at the same reps          'reps' – more reps at the same weight (or reps-only exercise)
//   'e1rm'   – higher estimated 1RM (sets of ≤12 reps) 'time' – longer hold (time exercise)
// A first-ever log is never an improvement, and on weighted lifts points without weight are ignored.
const sameKg = (a, b) => Math.abs(a - b) < 0.05;
export function exerciseImprovements(points, type = 'weight_reps') {
  const out = [], seen = [];
  for (const p of points || []) {
    if (type === 'time') {
      if (p.t == null) continue;
      const prev = seen.reduce((b, q) => (!b || q.t > b.t ? q : b), null);
      if (prev && p.t > prev.t) out.push({ point: p, prev, kind: 'time' });
    } else if (p.t != null) {
      continue;
    } else if (type === 'reps') {
      const prev = seen.reduce((b, q) => (!b || q.r > b.r ? q : b), null);
      if (prev && p.r > prev.r) out.push({ point: p, prev, kind: 'reps' });
    } else {
      if (!(p.w > 0) || !(p.r > 0)) continue;
      const kg = toKg(p.w, p.u);
      const best = (list, score) => list.reduce((b, q) => (!b || score(q) > score(b) ? q : b), null);
      const atReps = best(seen.filter(q => q.r === p.r), q => toKg(q.w, q.u));
      const atWeight = best(seen.filter(q => sameKg(toKg(q.w, q.u), kg)), q => q.r);
      const est = e1rm(kg, p.r);
      const atE1rm = est == null ? null : best(seen.filter(q => e1rm(toKg(q.w, q.u), q.r) != null), q => e1rm(toKg(q.w, q.u), q.r));
      if (atReps && kg > toKg(atReps.w, atReps.u) + 0.01) out.push({ point: p, prev: atReps, kind: 'weight' });
      else if (atWeight && p.r > atWeight.r) out.push({ point: p, prev: atWeight, kind: 'reps' });
      else if (atE1rm && est > e1rm(toKg(atE1rm.w, atE1rm.u), atE1rm.r) + 0.01) out.push({ point: p, prev: atE1rm, kind: 'e1rm' });
    }
    seen.push(p);
  }
  return out;
}

// Improvements across the routines' exercises with the point dated in [from, to], newest first: [{ ex, point, prev, kind }].
export function improvements(state, from = '', to = '9999-99-99') {
  return routinesList(state).flatMap(r => r.exercises.flatMap(ex =>
    exerciseImprovements(state.stats[ex.id] ? state.stats[ex.id].points : [], ex.type)
      .filter(i => i.point.d >= from && i.point.d <= to).map(i => ({ ex, ...i }))))
    .sort((a, b) => b.point.d.localeCompare(a.point.d));
}

// ---------- "that's like lifting…" ----------
export const LIFT_OBJECTS = [
  { id: 'car', kg: 1500, emoji: '🚗' },
  { id: 'elephant', kg: 6000, emoji: '🐘' },
  { id: 'bus', kg: 12000, emoji: '🚌' },
  { id: 'whale', kg: 150000, emoji: '🐋' },
  { id: 'liberty', kg: 200000, emoji: '🗽' },
  { id: 'eiffel', kg: 7300000, emoji: '🗼' },
  { id: 'empire', kg: 330000000, emoji: '🏙️', lifetime: true },
];

// The object that fits a volume (kg): the biggest one lifted at least twice (2 elephants reads better than
// 1 bus), else the biggest lifted once, else a fraction of a car. { id, kg, emoji, count } or null for 0 kg.
// count is whole from 1 up, one decimal (rounded down) below. The Empire State Building is for lifetime totals only.
export function liftObject(volumeKg, { lifetime = false } = {}) {
  if (!(volumeKg > 0)) return null;
  const list = LIFT_OBJECTS.filter(o => lifetime || !o.lifetime).slice().reverse();
  const o = list.find(x => volumeKg / x.kg >= 2) || list.find(x => volumeKg / x.kg >= 1) || LIFT_OBJECTS[0];
  const ratio = volumeKg / o.kg;
  return { ...o, count: ratio >= 1 ? Math.round(ratio) : Math.max(0.1, Math.floor(ratio * 10) / 10) };
}
