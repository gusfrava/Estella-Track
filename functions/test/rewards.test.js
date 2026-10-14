const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');
const r = require('../rewards');
const { streakAt } = require('../streak');

const W = () => r.newWallet('2026-10-12');
const run = (w, ...evs) => evs.reduce((acc, ev) => r.applyEvent(acc, ev, 1000).wallet, w);

test('a workout pays once, activities need 20 minutes, max 2 per day', () => {
  let w = run(W(), { type: 'workout', key: 'session:a', date: '2026-10-13', kind: 'gym' });
  assert.strictEqual(w.points, 10);
  w = run(w, { type: 'workout', key: 'session:a', date: '2026-10-13', kind: 'gym' });   // same session again
  assert.strictEqual(w.points, 10);
  w = run(w, { type: 'workout', key: 'session:b', date: '2026-10-13', kind: 'activity', minutes: 15 });
  assert.strictEqual(w.points, 10);                                                       // too short, still counts
  assert.strictEqual(w.counters.workouts, 2);
  w = run(w, { type: 'workout', key: 'session:c', date: '2026-10-13', kind: 'gym' });   // third today: capped
  assert.strictEqual(w.points, 10);
  w = run(w, { type: 'workout', key: 'session:d', date: '2026-10-14', kind: 'activity', minutes: 30 });
  assert.strictEqual(w.points, 15);
  assert.deepStrictEqual(Object.keys(w.badges), ['w1']);
});

test('training from before points started does not count', () => {
  const w = run(W(), { type: 'workout', key: 'session:old', date: '2026-10-01', kind: 'gym' });
  assert.strictEqual(w.points, 0);
});

test('weekly goal + streak bonus (capped), streak badges', () => {
  let w = run(W(), { type: 'goal', key: 'goal:2026-10-12', date: '2026-10-13', streak: 4 });
  assert.strictEqual(w.points, 15 + 20);
  assert.deepStrictEqual(Object.keys(w.badges).sort(), ['s2', 's4']);
  w = run(w, { type: 'goal', key: 'goal:2026-10-19', date: '2026-10-20', streak: 30 });
  assert.strictEqual(w.points, 35 + 15 + 50);
  assert.ok(w.badges.s26 && !w.badges.s52);
});

test('records, cheers and social badges', () => {
  let w = W();
  for (let i = 0; i < 4; i++) w = run(w, { type: 'record', key: `record:x${i}:2026-10-13`, date: '2026-10-13' });
  assert.strictEqual(w.points, 60);   // 3 a day
  for (let i = 0; i < 12; i++) w = run(w, { type: 'cheerReceived', key: `cheerIn:${i}`, date: '2026-10-13' });
  assert.strictEqual(w.points, 65);   // 5 a day
  assert.ok(w.badges.cr10 && w.badges.r1);
  w = run(w, { type: 'cheerSent', key: 'cheerOut:1', date: '2026-10-13' }, { type: 'copy', key: 'copy:r', date: '2026-10-13' },
    { type: 'friends', count: 5 });
  assert.ok(w.badges.c1 && w.badges.cp1 && w.badges.f1 && w.badges.f5);
  assert.strictEqual(w.log[0].badges.join(), 'f1,f5');
});

test('new record detection from exercise history', () => {
  const p = (d, w, reps = 8) => ({ d, w, r: reps, u: 'kg' });
  assert.strictEqual(r.newRecord(null, { points: [p('2026-10-01', 50)] }), null);            // first ever: not a record
  assert.deepStrictEqual(r.newRecord({ points: [p('2026-10-01', 50)] }, { points: [p('2026-10-01', 50), p('2026-10-13', 55)] }), { date: '2026-10-13' });
  assert.strictEqual(r.newRecord({ points: [p('2026-10-01', 50)] }, { points: [p('2026-10-01', 50), p('2026-10-13', 45)] }), null);
  assert.deepStrictEqual(r.newRecord({ points: [p('2026-10-01', 50)] }, { points: [p('2026-10-01', 50), p('2026-10-13', 50, 9)] }), { date: '2026-10-13' });
});

test('server streak matches the app rules (comodín saves a short week)', () => {
  const goals = { '2026-09-14': 3 };
  const weeks = { '2026-09-14': '024', '2026-09-21': '135', '2026-09-28': '01', '2026-10-05': '024' };
  assert.strictEqual(streakAt(weeks, goals, '2026-10-05'), 4);
  assert.strictEqual(streakAt({ ...weeks, '2026-09-28': '' }, goals, '2026-10-05'), 4);   // comodín
  assert.strictEqual(streakAt({ '2026-09-14': '0', '2026-10-05': '024' }, goals, '2026-10-05'), 1);
});

test('badge list matches the app (js/data/badges.js)', async () => {
  const app = await import(pathToFileURL(path.join(__dirname, '../../js/data/badges.js')).href);
  assert.deepStrictEqual(app.BADGES.map(b => [b.id, b.counter, b.at]), r.BADGES.map(b => [b.id, b.counter, b.at]));
});
