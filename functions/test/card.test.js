// Run: cd functions && npm test   (Node's built-in test runner; nothing to install)
const test = require('node:test');
const assert = require('node:assert');
const card = require('../card');

const gym = (date, done = true, name = 'Pierna A') => ({ kind: 'gym', date, routineName: name, exercises: [{ sets: [{ done: false }, { done }] }] });
const act = (date, sport = 'swim') => ({ kind: 'activity', date, activity: { sport, minutes: 30 } });

test('weeks start on Monday', () => {
  assert.strictEqual(card.weekKeyOf('2026-10-12'), '2026-10-12');   // Monday
  assert.strictEqual(card.weekKeyOf('2026-10-18'), '2026-10-12');   // Sunday
  assert.strictEqual(card.weekKeyOf('2026-10-19'), '2026-10-19');
  assert.strictEqual(card.weekKeyOf('2026-01-01'), '2025-12-29');   // across the year
  assert.strictEqual(card.weekday('2026-10-18'), 6);
  assert.strictEqual(card.addDays('2026-10-12', 6), '2026-10-18');
});

test('a day counts with a checked set or an activity', () => {
  assert.ok(card.sessionCounts(gym('2026-10-12')));
  assert.ok(!card.sessionCounts(gym('2026-10-12', false)));
  assert.ok(card.sessionCounts(act('2026-10-12')));
  assert.ok(!card.sessionCounts({ kind: 'gym', date: 'bad', exercises: [{ sets: [{ done: true }] }] }));
});

test('checking a second set does not change the key (no card update)', () => {
  const a = gym('2026-10-12'), b = JSON.parse(JSON.stringify(a));
  b.exercises[0].sets[0].done = true;
  assert.strictEqual(card.sessionKey(a), card.sessionKey(b));
  assert.notStrictEqual(card.sessionKey(gym('2026-10-12', false)), card.sessionKey(a));
  assert.strictEqual(card.sessionKey(null), null);
});

test('goal history: weeklyGoals, or onboarding for older accounts', () => {
  assert.deepStrictEqual(card.goalHistory({ weeklyGoals: { '2026-10-05': 3, '2026-10-12': '4', x: 2, '2026-10-19': 9 } }),
    { '2026-10-05': 3, '2026-10-12': 4 });
  const completedAt = Date.UTC(2026, 9, 14, 12);   // Wednesday
  assert.deepStrictEqual(card.goalHistory({ onboarding: { daysPerWeek: 3, completedAt } }), { '2026-10-12': 3 });
  assert.deepStrictEqual(card.goalHistory({}), {});
});

test('header follows sharing.profile and never includes private things', () => {
  const h = card.header({ username: 'jaz', displayName: 'Jazmin', sharing: { profile: 'private' }, onboarding: { character: 'diego' }, email: 'x' });
  assert.deepStrictEqual(h, { visibility: 'private', username: 'jaz', displayName: 'Jazmin', character: 'diego' });
  assert.strictEqual(card.header({ username: 'a' }).visibility, 'friends');
  assert.strictEqual(card.header({ username: 'a', sharing: { profile: 'weird' } }).visibility, 'friends');
});

test('buildCard: weeks from sessions + old exercise history, last workout, goals', () => {
  const sessions = [gym('2026-10-12'), act('2026-10-14'), gym('2026-10-15', false), gym('2026-10-05', true, 'Torso')];
  const stats = [{ points: [{ d: '2026-10-05' }, { d: '2026-09-01' }] }, { points: [{ d: '2026-10-12' }] }];
  const c = card.buildCard({ username: 'jaz', weeklyGoals: { '2026-09-28': 3 } }, sessions, stats, 123);
  assert.deepStrictEqual(c.weeks, { '2026-10-12': '02', '2026-10-05': '0', '2026-08-31': '1' });
  assert.deepStrictEqual(c.pts, { '2026-08-31': '1' });
  assert.deepStrictEqual(c.last, { kind: 'activity', name: '', sport: 'swim', date: '2026-10-14' });
  assert.deepStrictEqual(c.goals, { '2026-09-28': 3 });
  assert.strictEqual(c.v, card.CARD_VERSION);
  assert.strictEqual(c.updatedAt, 123);
  assert.ok(!('sessions' in c) && !('email' in c));
});

test('last workout hidden when workouts are private', () => {
  const c = card.buildCard({ username: 'jaz', sharing: { workouts: 'private' } }, [gym('2026-10-12')], []);
  assert.strictEqual(c.last, null);
  assert.deepStrictEqual(c.weeks, { '2026-10-12': '0' });
});

test('weekDigits keeps history-only days and drops unchecked workouts', () => {
  assert.strictEqual(card.weekDigits([gym('2026-10-13'), gym('2026-10-16', false)], '5'), '15');
  assert.strictEqual(card.weekDigits([gym('2026-10-13', false)], ''), '');
});
