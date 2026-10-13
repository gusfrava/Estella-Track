// Friend cards: what friends see about someone's training (their week, weekly goal, streak, last workout).
// Pure calculations, no database here, so they can be tested on their own (functions/test/card.test.js).
// index.js reads the person's data, calls these and writes profileCards/{uid}.
//
// profileCards/{uid} = {
//   v,                                  // CARD_VERSION; an older card is rebuilt from scratch
//   visibility: 'private'|'friends'|'public',   // = the person's sharing.profile; the Firestore rules check it
//   username, displayName, character,
//   goals: { 'YYYY-MM-DD' (Monday): days },     // weekly goal history, same as the app's
//   weeks: { 'YYYY-MM-DD' (Monday): '024' },    // days trained that week: 0 = Monday … 6 = Sunday
//   pts:   { 'YYYY-MM-DD': '13' },             // the part of `weeks` that came only from exercise history (accounts
//                                               // from the old app); kept so updating a week doesn't lose it
//   last:  { kind: 'gym'|'activity', name, sport, date } | null   // only when sharing.workouts isn't 'private'
//   updatedAt, builtAt                  // builtAt = last full rebuild (index.js limits rebuilds on request)
// }
// The app works out "this week", the streak and the comodines from goals + weeks with the same rules as your
// own Progreso screen (js/state/selectors.js → streakFrom), so a card never goes stale when someone stops training.

const CARD_VERSION = 2;   // 2: rebuilding also builds sharedRoutines (Friends part 3)
const LEVELS = ['private', 'friends', 'public'];

// ---------- dates ('YYYY-MM-DD', weeks start on Monday) ----------
const pad2 = n => String(n).padStart(2, '0');
const toYmd = d => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const isYmd = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

// 0 = Monday … 6 = Sunday
const weekday = s => (parse(s).getUTCDay() + 6) % 7;
function weekKeyOf(s) { const d = parse(s); d.setUTCDate(d.getUTCDate() - weekday(s)); return toYmd(d); }
function addDays(s, n) { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return toYmd(d); }

// ---------- what counts as a training day (same rule as the app's trainedDays) ----------
// A gym session with at least one checked set, or an activity.
function sessionCounts(s) {
  if (!s || !isYmd(s.date)) return false;
  if (s.kind === 'activity') return true;
  return (s.exercises || []).some(e => (e.sets || []).some(x => x && x.done));
}

// The bits of a session that matter for the card. If these didn't change, the card doesn't either
// (most session writes are a set being checked in the middle of a workout).
function sessionKey(s) {
  if (!s) return null;
  return JSON.stringify([sessionCounts(s), s.date || null, s.kind || null, s.routineName || null,
    (s.activity && s.activity.sport) || null]);
}

// Set of weekday digits → '024'
const digits = set => [...set].sort().join('');

// sessions: [{ date, kind, exercises, … }] → { weekKey: Set of weekday numbers }
function weeksFromSessions(sessions) {
  const weeks = {};
  for (const s of sessions) {
    if (!sessionCounts(s)) continue;
    const k = weekKeyOf(s.date);
    (weeks[k] = weeks[k] || new Set()).add(String(weekday(s.date)));
  }
  return weeks;
}

// exerciseStats docs → { weekKey: Set } from their history points ({ d: 'YYYY-MM-DD' }).
function weeksFromStats(stats) {
  const weeks = {};
  for (const st of stats) for (const p of (st && st.points) || []) {
    if (!p || !isYmd(p.d)) continue;
    const k = weekKeyOf(p.d);
    (weeks[k] = weeks[k] || new Set()).add(String(weekday(p.d)));
  }
  return weeks;
}

// The weekly goal history (same as the app's goalHistory): profile.weeklyGoals, or for accounts that finished
// onboarding before that existed, onboarding.daysPerWeek from the week onboarding was completed.
function goalHistory(profile) {
  const p = profile || {};
  const out = {};
  if (p.weeklyGoals && typeof p.weeklyGoals === 'object' && Object.keys(p.weeklyGoals).length) {
    for (const [k, v] of Object.entries(p.weeklyGoals)) {
      const n = Number(v);
      if (isYmd(k) && n >= 1 && n <= 7) out[k] = n;
    }
    return out;
  }
  const o = p.onboarding;
  if (o && o.daysPerWeek && typeof o.completedAt === 'number') {
    out[weekKeyOf(toYmd(new Date(o.completedAt)))] = Number(o.daysPerWeek);
  }
  return out;
}

const sharing = profile => ({ profile: 'friends', workouts: 'friends', ...((profile && profile.sharing) || {}) });

// Name, username, character and who can see the card.
function header(profile) {
  const p = profile || {};
  const level = sharing(p).profile;
  return {
    visibility: LEVELS.includes(level) ? level : 'friends',
    username: p.username || '',
    displayName: String(p.displayName || '').slice(0, 60),
    character: (p.onboarding && p.onboarding.character) || 'estella',
  };
}

// The most recent training (sessions newest first), or null. Hidden when workouts are shared with nobody.
function lastWorkout(profile, sessionsNewestFirst) {
  if (sharing(profile).workouts === 'private') return null;
  const s = sessionsNewestFirst.find(sessionCounts);
  if (!s) return null;
  return {
    kind: s.kind === 'activity' ? 'activity' : 'gym',
    name: String(s.kind === 'activity' ? '' : (s.routineName || '')).slice(0, 60),
    sport: s.kind === 'activity' ? String((s.activity && s.activity.sport) || '').slice(0, 40) : '',
    date: s.date,
  };
}

const newestFirst = list => [...list].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

// The whole card from all of someone's data (first time, or after CARD_VERSION changes).
function buildCard(profile, sessions, stats, now = Date.now()) {
  const fromSessions = weeksFromSessions(sessions);
  const fromStats = weeksFromStats(stats);
  const weeks = {}, pts = {};
  for (const k of new Set([...Object.keys(fromSessions), ...Object.keys(fromStats)])) {
    const s = fromSessions[k] || new Set(), p = fromStats[k] || new Set();
    weeks[k] = digits(new Set([...s, ...p]));
    const onlyPts = [...p].filter(d => !s.has(d));
    if (onlyPts.length) pts[k] = digits(new Set(onlyPts));
  }
  return {
    v: CARD_VERSION, ...header(profile), goals: goalHistory(profile), weeks, pts,
    last: lastWorkout(profile, newestFirst(sessions)), updatedAt: now,
  };
}

// One week again, from that week's sessions plus the history-only days we kept. '' = no training that week.
function weekDigits(weekSessions, ptsDigits = '') {
  const set = new Set(String(ptsDigits || '').split('').filter(Boolean));
  for (const s of weekSessions) if (sessionCounts(s)) set.add(String(weekday(s.date)));
  return digits(set);
}

module.exports = {
  CARD_VERSION, weekKeyOf, addDays, weekday, sessionCounts, sessionKey, weeksFromSessions, weeksFromStats,
  goalHistory, header, lastWorkout, buildCard, weekDigits, newestFirst,
};
