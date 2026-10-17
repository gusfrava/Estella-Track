// Points and badges (the mascot's currency). Pure rules, tested in functions/test/rewards.test.js; index.js runs them
// inside a transaction on users/{uid}/wallet/main, which only the server can write.
//
// wallet = {
//   v, points, since: 'YYYY-MM-DD',            // the day points started for this person (earlier training doesn't count)
//   counters: { workouts, records, cheersSent, cheersReceived, copies, friends, bestStreak },
//   badges: { badgeId: earnedAt },
//   awarded: { eventKey: points },             // each event pays once (a workout, a week's goal, a record, a cheer…)
//   daily: { 'YYYY-MM-DD': { w, r, c } },      // per-day caps (kept 14 days)
//   log: [{ at, why, pts, badge? }],           // the latest 20, newest first (toasts in the app, weekly recap)
//   updatedAt
// }

// Balanced so working out is the biggest source: a regular user (3 days a week, goal met) earns ~350–400 a month.
const POINTS = { workout: 10, activity: 5, record: 10, goal: 20, streakPerWeek: 2, streakMax: 20, cheer: 1 };
const CAPS = { workoutsPerDay: 2, recordsPerDay: 2, cheersPerDay: 5 };
// Earning a badge also pays points, by its artwork tier (icons/badges, design/estella-sticker-pack/milestones).
const TIER_POINTS = { bronze: 25, silver: 50, gold: 75, platinum: 100, diamond: 150, titanium: 200 };
const ACTIVITY_MIN_MINUTES = 20;

// The badges. KEEP IN SYNC with js/data/badges.js (a test checks they match).
//   counter = which counter it watches, at = the value that earns it, tier = its artwork tier (sets its points).
const BADGES = [
  ['w1', 'workouts', 1, 'bronze'], ['w10', 'workouts', 10, 'silver'], ['w25', 'workouts', 25, 'gold'], ['w50', 'workouts', 50, 'platinum'], ['w100', 'workouts', 100, 'diamond'], ['w250', 'workouts', 250, 'titanium'],
  ['s2', 'bestStreak', 2, 'bronze'], ['s4', 'bestStreak', 4, 'silver'], ['s8', 'bestStreak', 8, 'gold'], ['s12', 'bestStreak', 12, 'platinum'], ['s26', 'bestStreak', 26, 'diamond'], ['s52', 'bestStreak', 52, 'titanium'],
  ['r1', 'records', 1, 'bronze'], ['r10', 'records', 10, 'silver'], ['r25', 'records', 25, 'gold'], ['r50', 'records', 50, 'platinum'], ['r100', 'records', 100, 'diamond'], ['r250', 'records', 250, 'titanium'],
  ['f1', 'friends', 1, 'bronze'], ['f5', 'friends', 5, 'silver'], ['f10', 'friends', 10, 'gold'], ['f25', 'friends', 25, 'platinum'], ['f50', 'friends', 50, 'diamond'], ['f100', 'friends', 100, 'titanium'],
  ['c1', 'cheersSent', 1, 'bronze'], ['c10', 'cheersSent', 10, 'silver'], ['c25', 'cheersSent', 25, 'gold'], ['c50', 'cheersSent', 50, 'platinum'], ['c100', 'cheersSent', 100, 'diamond'], ['c250', 'cheersSent', 250, 'titanium'],
  ['cr1', 'cheersReceived', 1, 'bronze'], ['cr10', 'cheersReceived', 10, 'silver'], ['cr25', 'cheersReceived', 25, 'gold'], ['cr50', 'cheersReceived', 50, 'platinum'], ['cr100', 'cheersReceived', 100, 'diamond'], ['cr250', 'cheersReceived', 250, 'titanium'],
  ['cp1', 'copies', 1, 'bronze'],
].map(([id, counter, at, tier]) => ({ id, counter, at, tier, points: TIER_POINTS[tier] }));

const COUNTERS = ['workouts', 'records', 'cheersSent', 'cheersReceived', 'copies', 'friends', 'bestStreak'];

function newWallet(today) {
  return { v: 1, points: 0, since: today, counters: Object.fromEntries(COUNTERS.map(c => [c, 0])), badges: {}, awarded: {}, daily: {}, log: [] };
}

const clone = o => JSON.parse(JSON.stringify(o));

// event = { type, key, date, ... } (see below). Returns { wallet, gained, badges: [new badge ids] } — a new object,
// the input isn't changed. gained = 0 and badges = [] when the event doesn't pay (already paid, over a cap, before `since`).
//   workout       { key: 'session:<id>', date, kind: 'gym'|'activity', minutes }
//   goal          { key: 'goal:<weekKey>', date: weekKey, streak }   // weekly goal reached; streak = weeks in a row now
//   record        { key: 'record:<exerciseId>:<date>', date }
//   cheerReceived { key: 'cheerIn:<cheerId>', date }
//   cheerSent     { key: 'cheerOut:<cheerId>', date }
//   copy          { key: 'copy:<routineId>', date }
//   friends       { count }                                          // how many friends now (no key, no points)
function applyEvent(input, ev, now = Date.now()) {
  const w = clone(input);
  for (const c of COUNTERS) w.counters[c] = Number(w.counters[c]) || 0;
  let gained = 0, why = ev.type;

  if (ev.type === 'friends') {
    w.counters.friends = Math.max(w.counters.friends, Number(ev.count) || 0);
  } else {
    if (!ev.key || w.awarded[ev.key] !== undefined) return { wallet: input, gained: 0, badges: [] };
    if (ev.date && ev.date < w.since) return { wallet: input, gained: 0, badges: [] };
    const day = w.daily[ev.date] = w.daily[ev.date] || { w: 0, r: 0, c: 0 };
    if (ev.type === 'workout') {
      // An activity under 20 minutes isn't a workout: no points and it doesn't count toward workout badges.
      // Not marked as paid, so lengthening it later (to 20+ minutes) still counts.
      if (ev.kind === 'activity' && (Number(ev.minutes) || 0) < ACTIVITY_MIN_MINUTES) return { wallet: input, gained: 0, badges: [] };
      if (day.w >= CAPS.workoutsPerDay) return { wallet: input, gained: 0, badges: [] };
      day.w++;
      w.counters.workouts++;
      gained = ev.kind === 'activity' ? POINTS.activity : POINTS.workout;
      why = ev.kind === 'activity' ? 'activity' : 'workout';
    } else if (ev.type === 'goal') {
      const streak = Math.max(0, Number(ev.streak) || 0);
      w.counters.bestStreak = Math.max(w.counters.bestStreak, streak);
      gained = POINTS.goal + Math.min(POINTS.streakMax, POINTS.streakPerWeek * streak);
    } else if (ev.type === 'record') {
      if (day.r >= CAPS.recordsPerDay) return { wallet: input, gained: 0, badges: [] };
      day.r++;
      w.counters.records++;
      gained = POINTS.record;
    } else if (ev.type === 'cheerReceived') {
      w.counters.cheersReceived++;
      if (day.c < CAPS.cheersPerDay) { day.c++; gained = POINTS.cheer; }
    } else if (ev.type === 'cheerSent') {
      w.counters.cheersSent++;
    } else if (ev.type === 'copy') {
      w.counters.copies++;
    } else {
      return { wallet: input, gained: 0, badges: [] };
    }
    w.awarded[ev.key] = gained;
  }

  const earned = BADGES.filter(b => !w.badges[b.id] && w.counters[b.counter] >= b.at);
  for (const b of earned) { w.badges[b.id] = now; gained += b.points; }
  w.points = (Number(w.points) || 0) + gained;
  if (gained || earned.length) {
    w.log = [{ at: now, why, pts: gained, ...(earned.length ? { badges: earned.map(b => b.id) } : {}) }, ...(w.log || [])].slice(0, 20);
  }
  // keep the per-day caps for two weeks only
  const cutoff = new Date(now - 14 * 864e5).toISOString().slice(0, 10);
  for (const d of Object.keys(w.daily)) if (d < cutoff) delete w.daily[d];
  w.updatedAt = now;
  return { wallet: w, gained, badges: earned.map(b => b.id) };
}

// ---------- records from exercise history (exerciseStats points { d, r, w, u, t? }) ----------
const LB = 0.45359237;
function pointScore(p, type) {
  if (type === 'time') return p.t != null ? [Number(p.t)] : null;
  if (p.t != null) return null;
  if (type === 'reps') return [Number(p.r)];
  if (!(Number(p.w) > 0)) return null;   // reps logged without a weight on a weighted lift: never a record
  return [p.u === 'lb' ? Number(p.w) * LB : Number(p.w), Number(p.r)];
}
const beats = (a, b) => { for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) return a[i] > b[i]; } return false; };
function typeOf(points) {
  if (points.some(p => p && p.t != null)) return 'time';
  return points.some(p => p && Number(p.w) > 0) ? 'weight_reps' : 'reps';
}
// The best point (first day it was reached) and whether there was an earlier best (a first-ever entry isn't a record;
// on a weighted lift, reps-only entries don't count as earlier bests, so the first weighted log isn't one either).
function bestOf(points, type) {
  let best = null, hadPrev = false;
  for (const p of points || []) {
    if (!p || typeof p.d !== 'string') continue;
    const s = pointScore(p, type);
    if (!s || s.some(x => !Number.isFinite(x))) continue;
    if (!best || beats(s, best.score)) { hadPrev = !!best; best = { point: p, score: s }; }
  }
  return best ? { ...best, hadPrev } : null;
}
// A new personal record between two versions of an exerciseStats doc → { date } or null.
function newRecord(before, after) {
  const pa = (after && after.points) || [];
  if (!pa.length) return null;
  const type = typeOf(pa);
  const a = bestOf(pa, type), b = bestOf((before && before.points) || [], type);
  if (!a || !a.hadPrev) return null;
  if (b && !beats(a.score, b.score)) return null;
  return { date: a.point.d };
}

module.exports = { POINTS, CAPS, TIER_POINTS, BADGES, COUNTERS, newWallet, applyEvent, newRecord };
