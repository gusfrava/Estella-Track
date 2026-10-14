// The weekly recap ("Tu semana"): what happened in one finished week, worked out from data already on the phone.
// Shown on home during the following week (views/recap.js) and shareable as an image (services/recap-image.js).
import { getState } from './store.js';
import { getSocial } from './social.js';
import { trainedDays, weeklyGoalFor, weeklyStreak, weekStatusOf, recordsBetween } from './selectors.js';
import { weekKey, weeksBefore, parseYmd, ymd } from '../utils/dates.js';

const MAX_GYM_MINUTES = 180;   // a session left open overnight shouldn't count as 14 hours

const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const lastWeekKey = () => weeksBefore(weekKey(), 1);

// { key, from, to, dates (Set), days, goal, status: 'met'|'saved'|'missed', streak (weeks, as of now),
//   workouts, activities, sets, minutes, records: [{ ex, record }], cheers }
export function weekRecap(wk = lastWeekKey(), state = getState()) {
  const from = wk, to = addDays(wk, 6);
  const dates = trainedDays(state).get(wk) || new Set();
  let workouts = 0, activities = 0, sets = 0, minutes = 0;
  for (const s of Object.values(state.sessions)) {
    if (s.date < from || s.date > to) continue;
    if (s.kind === 'activity') {
      activities++;
      minutes += Math.max(0, Number(s.activity && s.activity.minutes) || 0);
      continue;
    }
    const done = s.exercises.reduce((n, e) => n + e.sets.filter(x => x.done && x.kind !== 'drop' && x.kind !== 'warmup').length, 0);
    if (!done) continue;
    workouts++;
    sets += done;
    if (s.startedAt && s.finishedAt && s.finishedAt > s.startedAt) {
      minutes += Math.min(MAX_GYM_MINUTES, Math.round((s.finishedAt - s.startedAt) / 60000));
    }
  }
  const start = parseYmd(from).getTime(), end = parseYmd(to).getTime() + 864e5;
  const cheers = getSocial().cheers.received.filter(c => c.createdAt >= start && c.createdAt < end).length;
  return {
    key: wk, from, to, dates, days: dates.size, goal: weeklyGoalFor(state, wk), status: weekStatusOf(state, wk),
    streak: weeklyStreak(state).current, workouts, activities, sets, minutes,
    records: recordsBetween(state, from, to), cheers,
  };
}

// Worth showing? Only weeks where something happened (no recap that just says "0").
export const hasRecap = r => r.days > 0 || r.status === 'saved';

// "Ocultar" on the home card: remembered on this phone per account (the recap stays in Progreso).
const hiddenKey = uid => `estellatrack.recapHidden.${uid || 'local'}`;
export function recapHidden(wk, uid) {
  try { return localStorage.getItem(hiddenKey(uid)) === wk; } catch (e) { return false; }
}
export function hideRecap(wk, uid) {
  try { localStorage.setItem(hiddenKey(uid), wk); } catch (e) { /* private mode: it shows again next time */ }
}
