// Read-only calculations on the data (no changes here). Views use these.
// "Done this week" is never stored: it comes from the routine's current session.
import { ymd, ymdOf, weekRange, todayStr, weekKey, weekKeyOf, weeksBefore } from '../utils/dates.js';
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
  return (state.profile && state.profile.units) === 'lb' ? 'lb' : 'kg';   // chosen in onboarding
}

// ---------- personal records (from the history points in exerciseStats) ----------
// What a point is worth for this exercise type, as a comparable list ([weight in kg, reps] / [reps] / [seconds]),
// or null when the point is of another type (e.g. from before the exercise's type was changed).
const LB = 0.45359237;
function pointScore(p, type) {
  if (type === 'time') return p.t != null ? [p.t] : null;
  if (p.t != null) return null;
  if (type === 'reps') return [p.r];
  return [p.u === 'lb' ? p.w * LB : p.w, p.r];
}
const beats = (a, b) => { for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) return a[i] > b[i]; } return false; };

// The best point ever for this exercise: { point, prev } – prev = the best before it (null if it was the first).
// The record is the first day the best was reached. null when there's no history yet.
export function personalRecord(state, ex) {
  let best = null, prev = null;
  for (const p of exerciseHistory(state, ex.id)) {
    const score = pointScore(p, ex.type);
    if (!score) continue;
    if (!best || beats(score, best.score)) { prev = best; best = { point: p, score }; }
  }
  return best ? { point: best.point, prev: prev && prev.point } : null;
}

// Every exercise with a record, grouped by routine (in routine order). [{ routine, items: [{ ex, record }] }]
export function recordsByRoutine(state) {
  return routinesList(state)
    .map(r => ({ routine: r, items: r.exercises.map(ex => ({ ex, record: personalRecord(state, ex) })).filter(i => i.record) }))
    .filter(g => g.items.length);
}

// True when record `after` is strictly better than `before` (both from personalRecord) for this exercise.
export function beatsRecord(ex, after, before) {
  if (!after || !before) return false;
  return beats(pointScore(after.point, ex.type), pointScore(before.point, ex.type));
}

// ---------- weekly goal + streak ----------
// The weekly goal = how many days a week the person wants to train (chosen in onboarding, editable on home).
// profile.weeklyGoals = { 'YYYY-MM-DD' (Monday the goal started): days } — changing it only affects that week
// and later, so past weeks keep the goal they had and an old streak never breaks retroactively.
// Accounts that finished onboarding before weeklyGoals existed use onboarding.daysPerWeek from that week on.
function goalHistory(state) {
  const p = state.profile || {};
  if (p.weeklyGoals && Object.keys(p.weeklyGoals).length) return p.weeklyGoals;
  const o = p.onboarding;
  if (o && o.daysPerWeek && o.completedAt) return { [weekKeyOf(ymdOf(o.completedAt))]: o.daysPerWeek };
  return {};
}

// The goal for a week (weekKey) from a goal history { weekKey: days }, or null when none was set yet then.
export function goalAt(goals, wk) {
  const from = Object.keys(goals || {}).filter(k => k <= wk).sort().pop();
  return from ? Number(goals[from]) || null : null;
}
export const weeklyGoalFor = (state, wk) => goalAt(goalHistory(state), wk);
export const weeklyGoal = state => weeklyGoalFor(state, weekKey());

// Days trained, per week: Map weekKey → Set of dates. A day counts when there's a gym session with a checked set
// or an activity. Sessions are only loaded for the last 120 days, so older days come from the exercise
// history points (one per day an exercise was finished).
export function trainedDays(state) {
  const weeks = new Map();
  const add = d => { const k = weekKeyOf(d); if (!weeks.has(k)) weeks.set(k, new Set()); weeks.get(k).add(d); };
  for (const s of Object.values(state.sessions)) {
    if (s.kind === 'activity' || s.exercises.some(e => e.sets.some(x => x.done))) add(s.date);
  }
  for (const st of Object.values(state.stats)) for (const p of st.points) add(p.d);
  return weeks;
}

// This week against the goal: { goal, days, left, met, dates } — dates = the days trained ('YYYY-MM-DD').
export function weekGoalProgress(state) {
  const goal = weeklyGoal(state);
  const dates = trainedDays(state).get(weekKey()) || new Set();
  const days = dates.size;
  return { goal, days, left: goal ? Math.max(0, goal - days) : 0, met: goal ? days >= goal : days > 0, dates };
}

// ---------- comodines (streak savers) ----------
// You start with 1 comodín and earn another for every 4 weeks in a row that meet your goal (you can hold 2).
// When a finished week falls short of its goal, a comodín is used automatically and the streak lives on.
// Nothing is stored: it's worked out from the history each time, so it can't drift or be edited by hand.
export const JOKER_START = 1, JOKER_EVERY = 4, JOKER_MAX = 2;

// Every week from the first one with training (or a goal) up to this one, oldest first, with what happened:
//   'met'     – goal reached (with no goal yet: trained at all)
//   'saved'   – fell short, a comodín kept the streak
//   'missed'  – fell short, streak broken (or no streak to keep)
//   'pending' – this week, goal not reached yet (it can still be)
// days = Map weekKey → Set of dates trained, goals = goal history. Also used for friends' cards (their days and
// goals come from profileCards/{uid}), so their streak follows exactly the same rules as yours.
function weekHistory(days, goalHist) {
  const now = weekKey();
  const goals = Object.keys(goalHist);
  const first = [...days.keys(), ...goals].sort()[0];
  const keys = [];
  if (first) for (let k = now; k >= first; k = weeksBefore(k)) keys.unshift(k);
  let jokers = null, run = 0, alive = false;   // run: goal weeks in a row since the last comodín was earned
  const list = keys.map(key => {
    const n = (days.get(key) || new Set()).size, goal = goalAt(goalHist, key);
    if (goal && jokers === null) jokers = JOKER_START;
    let status;
    if (n > 0 && n >= (goal || 1)) {
      status = 'met';
      if (goal && ++run % JOKER_EVERY === 0) jokers = Math.min(JOKER_MAX, jokers + 1);
    } else if (key === now) status = 'pending';
    else if (goal && alive && jokers > 0) { status = 'saved'; jokers -= 1; }
    else { status = 'missed'; run = 0; }
    if (status !== 'pending') alive = status !== 'missed';
    return { key, status, days: n, goal };
  });
  return { list, jokers: jokers || 0, run, hasGoal: jokers !== null };
}

// { current, best, thisWeek, recent, jokers, nextJoker, savedLast }
//   A week counts when its goal was met, or a comodín saved it. Rest days never break a streak.
//   current   – weeks in a row up to now. This week only adds once it counts; until then the streak from last
//               week is still alive (thisWeek = false → "train N more days to keep it").
//   best      – longest run ever (from what's loaded).
//   recent    – the last 8 weeks, oldest first: [{ key, done, saved, days, goal }] (the last one is this week).
//   jokers    – comodines you have now (null without a weekly goal). nextJoker – goal weeks until the next one
//               (0 when you already hold the most). savedLast – last week was kept by a comodín.
export const weeklyStreak = state => streakFrom(trainedDays(state), goalHistory(state));

export function streakFrom(days, goalHist) {
  const h = weekHistory(days, goalHist);
  const counts = w => w.status === 'met' || w.status === 'saved';
  const list = h.list;
  const last = list[list.length - 1];
  const thisWeek = !!last && last.status === 'met';
  let current = 0;
  for (let i = list.length - 1 - (thisWeek ? 0 : 1); i >= 0 && counts(list[i]); i--) current++;
  let best = 0, run = 0;
  for (const w of list) { run = counts(w) ? run + 1 : 0; best = Math.max(best, run); }
  const byKey = new Map(list.map(w => [w.key, w]));
  const now = weekKey();
  const recent = Array.from({ length: 8 }, (_, i) => {
    const key = weeksBefore(now, 7 - i);
    const w = byKey.get(key) || { status: 'missed', days: 0, goal: goalAt(goalHist, key) };
    return { key, done: w.status === 'met', saved: w.status === 'saved', days: w.days, goal: w.goal };
  });
  const prev = list[list.length - 2];
  return {
    current, best: Math.max(best, current), thisWeek, recent,
    jokers: h.hasGoal ? h.jokers : null,
    nextJoker: h.hasGoal && h.jokers < JOKER_MAX ? JOKER_EVERY - (h.run % JOKER_EVERY) : 0,
    savedLast: !!prev && prev.status === 'saved' && current > 0,
  };
}

// Trained today: a gym session with a checked set, or an activity, dated today.
export function trainedToday(state) {
  const today = todayStr();
  return Object.values(state.sessions).some(s => s.date === today
    && (s.kind === 'activity' || s.exercises.some(e => e.sets.some(x => x.done))));
}
