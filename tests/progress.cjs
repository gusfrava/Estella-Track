// The shared progress engine (js/state/progress.js): overall stats, comparable improvements, "that's like lifting…",
// and the record rule (reps logged without weight on a weighted lift is never a record or an improvement).
const assert = require('node:assert/strict');
(async () => {
  const P = await import('../js/state/progress.js');
  const { personalRecord, beatsRecord } = await import('../js/state/selectors.js');
  const { normalizeState } = await import('../js/state/model.js');
  const { todayStr } = await import('../js/utils/dates.js');

  // ---- volume and e1RM basics ----
  assert.equal(P.setVolumeKg({ done: true, kind: 'normal', weight: 50, unit: 'kg', reps: 10, repsR: null }), 500);
  assert.equal(P.setVolumeKg({ done: true, kind: 'warmup', weight: 20, unit: 'kg', reps: 10 }), 0, 'warm-ups are left out');
  assert.equal(P.setVolumeKg({ done: true, kind: 'normal', weight: 0, unit: 'kg', reps: 12 }), 0, 'sets without weight are left out');
  assert.equal(P.setVolumeKg({ done: false, kind: 'normal', weight: 50, unit: 'kg', reps: 10 }), 0, 'unchecked sets are left out');
  assert.equal(P.setVolumeKg({ done: true, kind: 'normal', weight: 10, unit: 'kg', reps: 10, repsR: 8 }), 180, 'both sides count');
  assert(Math.abs(P.setVolumeKg({ done: true, kind: 'drop', weight: 100, unit: 'lb', reps: 10 }) - 453.59237) < 1e-9, 'lb converted, drops count');
  assert.equal(P.e1rm(100, 10), 100 * (1 + 10 / 30));
  assert.equal(P.e1rm(100, 13), null, 'no estimate above 12 reps');
  assert.equal(P.e1rm(0, 5), null);

  // ---- overall stats ----
  const today = todayStr();
  const set = (weight, reps, extra = {}) => ({ kind: 'normal', reps, repsR: null, weight, unit: 'kg', seconds: 0, done: true, ...extra });
  const t0 = Date.now();
  const state = normalizeState({
    sessions: {
      a: { kind: 'gym', date: today, status: 'done', startedAt: t0, finishedAt: t0 + 45 * 60000,
        exercises: [{ id: 'bench', sets: [set(20, 10, { kind: 'warmup' }), set(50, 10), set(50, 8), set(0, 12)] }] },
      b: { kind: 'gym', date: today, status: 'done', startedAt: t0, finishedAt: t0 + 20 * 3600000,   // left open: capped at 3 h
        exercises: [{ id: 'bench', sets: [set(100, 5, { unit: 'lb' })] }] },
      c: { kind: 'activity', date: today, activity: { sport: 'running', minutes: 30 } },
      d: { kind: 'gym', date: today, status: 'in_progress', startedAt: t0, exercises: [{ id: 'bench', sets: [set(20, 10, { kind: 'warmup' })] }] },
      old: { kind: 'gym', date: '2020-01-06', status: 'done', startedAt: t0, finishedAt: t0 + 60 * 60000,
        exercises: [{ id: 'bench', sets: [set(40, 10)] }] },
    },
    stats: { squat: { points: [{ d: '2019-03-04', s: 3, r: 5, w: 100, u: 'kg' }, { d: '2019-03-11', s: 3, r: 10, w: 0, u: 'kg' }] } },
  });
  const o = P.overallStats(state, today);
  assert.equal(o.month.workouts, 3, 'gym sessions with a checked set + activities; warm-up only does not count');
  assert.equal(o.month.minutes, 45 + 180 + 30);
  assert(Math.abs(o.month.volumeKg - (500 + 400 + 500 * LBkg())) < 1e-6, 'month volume');
  assert.equal(o.total.workouts, 4);
  assert(Math.abs(o.total.volumeKg - (500 + 400 + 500 * LBkg() + 400 + 1500)) < 1e-6, 'older history points add their estimate; weightless ones do not');
  assert.equal(typeof o.streak.current, 'number');
  assert(o.goalWeeks >= 0);
  function LBkg() { return P.LB; }

  // ---- improvements: only like with like ----
  const pt = (d, w, r, u = 'kg') => ({ d, w, r, u, s: 3 });
  const imp = P.exerciseImprovements([
    pt('2026-10-01', 50, 10),
    pt('2026-10-03', 52.5, 10),   // more weight, same reps
    pt('2026-10-05', 52.5, 12),   // more reps, same weight
    pt('2026-10-07', 60, 6),      // nothing at 6 reps or 60 kg before: e1RM 72 vs 52.5×1.4 = 73.5 → not better
    pt('2026-10-09', 62.5, 6),    // more weight at 6 reps
    pt('2026-10-11', 0, 20),      // reps only on a weighted lift: ignored
    pt('2026-10-13', 70, 5),      // e1RM 81.7 > 62.5×1.2 = 75 → better estimate
    pt('2026-10-15', 40, 20),     // 20 reps: no estimate, nothing at 40 kg or 20 reps before → not an improvement
  ]);
  assert.deepEqual(imp.map(i => [i.point.d, i.kind]), [['2026-10-03', 'weight'], ['2026-10-05', 'reps'], ['2026-10-09', 'weight'], ['2026-10-13', 'e1rm']]);
  assert.equal(P.exerciseImprovements([pt('2026-10-01', 50, 10)]).length, 0, 'a first-ever log is not an improvement');
  assert.equal(P.exerciseImprovements([pt('2026-10-01', 0, 10), pt('2026-10-02', 0, 12)]).length, 0, 'reps-only logs on a weighted lift never improve');
  assert.equal(P.exerciseImprovements([pt('2026-10-01', 0, 10), pt('2026-10-02', 20, 8)]).length, 0, 'first weighted log after reps-only ones is a first log');
  assert.equal(P.exerciseImprovements([pt('2026-10-01', 45, 8, 'lb'), pt('2026-10-02', 20.4, 9)])[0].kind, 'reps', '45 lb ≈ 20.4 kg counts as the same weight');
  assert.deepEqual(P.exerciseImprovements([{ d: 'a', r: 8 }, { d: 'b', r: 10 }, { d: 'c', r: 9 }], 'reps').map(i => i.point.d), ['b']);
  assert.deepEqual(P.exerciseImprovements([{ d: 'a', t: 30 }, { d: 'b', t: 45 }], 'time').map(i => i.kind), ['time']);

  // ---- "that's like lifting…" ----
  assert.equal(P.liftObject(0), null);
  assert.deepEqual([P.liftObject(12400).id, P.liftObject(12400).count], ['elephant', 2], '12,400 kg = 2 elephants');
  assert.deepEqual([P.liftObject(3000).id, P.liftObject(3000).count], ['car', 2]);
  assert.deepEqual([P.liftObject(7000).id, P.liftObject(7000).count], ['car', 5]);
  assert.deepEqual([P.liftObject(750).id, P.liftObject(750).count], ['car', 0.5]);
  assert.equal(P.liftObject(1440).count, 0.9, 'just under a car is not a whole car');
  assert.equal(P.liftObject(400000).id, 'liberty');
  assert.equal(P.liftObject(1e9).id, 'eiffel', 'the Empire State Building is lifetime only');
  assert.equal(P.liftObject(1e9, { lifetime: true }).id, 'empire');

  // ---- records: reps-only entries on weighted lifts are not records ----
  const ex = { id: 'row', type: 'weight_reps' };
  const withPoints = points => normalizeState({ stats: { row: { points } } });
  assert.equal(personalRecord(withPoints([pt('2026-10-01', 0, 15)]), ex), null, 'reps-only log on a weighted lift is no record');
  const rec = personalRecord(withPoints([pt('2026-10-01', 0, 15), pt('2026-10-02', 20, 8)]), ex);
  assert.equal(rec.point.d, '2026-10-02');
  assert.equal(rec.prev, null, 'the first weighted log is a first log, not a new record');
  const r2 = personalRecord(withPoints([pt('2026-10-01', 20, 8), pt('2026-10-02', 0, 30)]), ex);
  assert.equal(r2.point.d, '2026-10-01', 'more reps without weight does not beat a weighted best');
  assert.equal(beatsRecord(ex, r2, null), false, 'no record without an earlier best');
  console.log('PASS: overall stats, comparable improvements, lift objects and the reps-only record rule.');
})().catch(e => { console.error(e); process.exit(1); });
