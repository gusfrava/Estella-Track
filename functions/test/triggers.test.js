// The two triggers against a tiny in-memory stand-in for Firestore (no emulator needed).
const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');

// ---------- fake firebase-admin ----------
const store = new Map();   // 'path/to/doc' → data
class FieldPath { constructor(...parts) { this.parts = parts; } }
const DELETE = { delete: true };
const clone = x => JSON.parse(JSON.stringify(x));
function snapOf(path) { const d = store.get(path); return { exists: !!d, id: path.split('/').pop(), data: () => (d ? clone(d) : undefined) }; }
function docRef(path) {
  return {
    path,
    collection: name => colRef(`${path}/${name}`),
    get: async () => snapOf(path),
    set: async (data, opts) => { store.set(path, opts && opts.merge ? { ...(store.get(path) || {}), ...clone(data) } : clone(data)); },
    delete: async () => { store.delete(path); },
    update: async (...args) => {
      if (!store.has(path)) { const e = new Error('not found'); e.code = 5; throw e; }
      const d = store.get(path);
      const pairs = args.length === 1 ? Object.entries(args[0]).map(([k, v]) => [k.split('.'), v]) : [];
      for (let i = 0; args.length > 1 && i < args.length; i += 2) pairs.push([args[i] instanceof FieldPath ? args[i].parts : args[i].split('.'), args[i + 1]]);
      for (const [parts, v] of pairs) {
        let o = d;
        for (const p of parts.slice(0, -1)) o = o[p] = o[p] || {};
        if (v === DELETE) delete o[parts[parts.length - 1]]; else o[parts[parts.length - 1]] = clone(v);
      }
    },
  };
}
function colRef(path, filters = [], order = null, lim = null) {
  return {
    doc: id => docRef(`${path}/${id}`),
    where: (f, op, v) => colRef(path, [...filters, [f, op, v]], order, lim),
    orderBy: (f, dir) => colRef(path, filters, [f, dir], lim),
    limit: n => colRef(path, filters, order, n),
    get: async () => {
      let docs = [...store.keys()].filter(k => k.startsWith(path + '/') && !k.slice(path.length + 1).includes('/')).map(snapOf);
      for (const [f, op, v] of filters) docs = docs.filter(d => { const x = d.data()[f]; return op === '>=' ? x >= v : op === '<=' ? x <= v : x === v; });
      if (order) docs.sort((a, b) => String(a.data()[order[0]]).localeCompare(String(b.data()[order[0]])) * (order[1] === 'desc' ? -1 : 1));
      if (lim) docs = docs.slice(0, lim);
      return { docs };
    },
  };
}
const db = {
  collection: name => colRef(name),
  runTransaction: async fn => { const writes = []; await fn({ get: ref => ref.get(), set: (ref, d) => writes.push(() => ref.set(d)) }); for (const w of writes) await w(); },
};
const realLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === 'firebase-admin/app') return { initializeApp: () => {} };
  if (req === 'firebase-admin/firestore') return { getFirestore: () => db, FieldPath, FieldValue: { delete: () => DELETE } };
  return realLoad.call(this, req, ...rest);
};
const fns = require('../index');

const ev = (params, before, after) => ({ params, data: { before: { exists: !!before, data: () => before }, after: { exists: !!after, data: () => after } } });
const gym = (date, done = true, name = 'Pierna A') => ({ kind: 'gym', date, routineName: name, exercises: [{ sets: [{ done }] }] });
const profile = { username: 'jaz', displayName: 'Jazmin', weeklyGoals: { '2026-10-05': 3 } };

test('profile write builds the card, sessions update it, deleting the account removes it', async () => {
  store.clear();
  store.set('users/u1', profile);
  store.set('users/u1/sessions/s1', gym('2026-10-06'));
  store.set('users/u1/exerciseStats/e1', { points: [{ d: '2026-09-01' }] });

  // a session write before any card exists does nothing
  await fns.cardOnSession.run(ev({ uid: 'u1', sid: 's1' }, null, gym('2026-10-06')));
  assert.ok(!store.has('profileCards/u1'));

  await fns.cardOnProfile.run(ev({ uid: 'u1' }, null, profile));
  let c = store.get('profileCards/u1');
  assert.deepStrictEqual(c.weeks, { '2026-10-05': '1', '2026-08-31': '1' });
  assert.strictEqual(c.last.name, 'Pierna A');
  assert.strictEqual(c.visibility, 'friends');

  // new workout on Wednesday: the week gets a new day and it's the last workout
  const s2 = gym('2026-10-14', true, 'Torso');
  store.set('users/u1/sessions/s2', s2);
  await fns.cardOnSession.run(ev({ uid: 'u1', sid: 's2' }, { ...s2, exercises: [{ sets: [{ done: false }] }] }, s2));
  c = store.get('profileCards/u1');
  assert.strictEqual(c.weeks['2026-10-12'], '2');
  assert.strictEqual(c.last.name, 'Torso');

  // unchecking it removes the day again (and the week, since it's empty)
  const s2off = { ...s2, exercises: [{ sets: [{ done: false }] }] };
  store.set('users/u1/sessions/s2', s2off);
  await fns.cardOnSession.run(ev({ uid: 'u1', sid: 's2' }, s2, s2off));
  c = store.get('profileCards/u1');
  assert.ok(!('2026-10-12' in c.weeks));
  assert.strictEqual(c.last.name, 'Pierna A');

  // making the profile private: visibility follows; workouts private hides the last workout
  const p2 = { ...profile, sharing: { profile: 'private', workouts: 'private' } };
  store.set('users/u1', p2);
  await fns.cardOnProfile.run(ev({ uid: 'u1' }, profile, p2));
  c = store.get('profileCards/u1');
  assert.strictEqual(c.visibility, 'private');
  assert.strictEqual(c.last, null);
  assert.deepStrictEqual(c.weeks, { '2026-10-05': '1', '2026-08-31': '1' });   // untouched

  // goal change
  const p3 = { ...p2, weeklyGoals: { '2026-10-05': 3, '2026-10-12': 5 } };
  store.set('users/u1', p3);
  await fns.cardOnProfile.run(ev({ uid: 'u1' }, p2, p3));
  assert.deepStrictEqual(store.get('profileCards/u1').goals, { '2026-10-05': 3, '2026-10-12': 5 });

  // the app asks for a rebuild: ignored when the card was rebuilt less than an hour ago…
  store.get('profileCards/u1').weeks = {};
  const p4 = { ...p3, cardRefreshAt: 5 };
  await fns.cardOnProfile.run(ev({ uid: 'u1' }, p3, p4));
  assert.deepStrictEqual(store.get('profileCards/u1').weeks, {});
  // …and done when it's older
  store.get('profileCards/u1').builtAt = Date.now() - 2 * 3600000;
  const p5 = { ...p4, cardRefreshAt: 6 };
  await fns.cardOnProfile.run(ev({ uid: 'u1' }, p4, p5));
  assert.deepStrictEqual(store.get('profileCards/u1').weeks, { '2026-10-05': '1', '2026-08-31': '1' });

  // shared routines were built with the card
  assert.deepStrictEqual(store.get('sharedRoutines/u1').routines.map(r => r.name), []);

  // account deleted
  store.delete('users/u1');
  await fns.cardOnProfile.run(ev({ uid: 'u1' }, p5, null));
  assert.ok(!store.has('profileCards/u1'));
  assert.ok(!store.has('sharedRoutines/u1'));
  // a late session delete doesn't bring it back
  await fns.cardOnSession.run(ev({ uid: 'u1', sid: 's1' }, gym('2026-10-06'), null));
  assert.ok(!store.has('profileCards/u1'));
});

test('a profile without username yet gets no card', async () => {
  store.clear();
  await fns.cardOnProfile.run(ev({ uid: 'u2' }, null, { displayName: 'X' }));
  assert.ok(!store.has('profileCards/u2'));
});

test('routines: shared without weights, follow the Rutinas setting, skip progress-only changes', async () => {
  store.clear();
  const p = { username: 'jaz' };
  store.set('users/u1', p);
  await fns.cardOnProfile.run(ev({ uid: 'u1' }, null, p));
  assert.deepStrictEqual(store.get('sharedRoutines/u1').routines, []);

  const r1 = { name: 'Pierna A', order: 1, exercises: [{ id: 'x', exerciseId: 'sentadilla', name: 'Sentadilla', type: 'weight_reps', note: 'rodilla', target: { sets: 4, reps: 6, weight: 80, unit: 'kg' } }] };
  store.set('users/u1/routines/r1', r1);
  await fns.sharedOnRoutine.run(ev({ uid: 'u1', rid: 'r1' }, null, r1));
  const s1 = store.get('sharedRoutines/u1');
  assert.deepStrictEqual(s1.routines, [{ id: 'r1', name: 'Pierna A', exercises: [{ exerciseId: 'sentadilla', name: 'Sentadilla', type: 'weight_reps', perSide: false, sets: 4, reps: 6, seconds: 60 }] }]);
  assert.ok(!JSON.stringify(s1).includes('80') && !JSON.stringify(s1).includes('rodilla'));

  // only this week's progress changed: no rebuild
  store.get('sharedRoutines/u1').updatedAt = 1;
  const r1b = { ...r1, current: { sessionId: 's9', weekKey: '2026-10-12' }, updatedAt: 99 };
  await fns.sharedOnRoutine.run(ev({ uid: 'u1', rid: 'r1' }, r1, r1b));
  assert.strictEqual(store.get('sharedRoutines/u1').updatedAt, 1);

  // archived and empty routines are not shared
  store.set('users/u1/routines/r2', { name: 'Vacía', order: 0, exercises: [] });
  store.set('users/u1/routines/r1', { ...r1, archived: true });
  await fns.sharedOnRoutine.run(ev({ uid: 'u1', rid: 'r1' }, r1, { ...r1, archived: true }));
  assert.deepStrictEqual(store.get('sharedRoutines/u1').routines, []);

  // Rutinas → private
  const p2 = { ...p, sharing: { routines: 'private' } };
  store.set('users/u1', p2);
  await fns.cardOnProfile.run(ev({ uid: 'u1' }, p, p2));
  assert.strictEqual(store.get('sharedRoutines/u1').visibility, 'private');
});

test('rewards: workout + weekly goal points, records, cheers, friends, copies; wallet deleted with the account', async () => {
  store.clear();
  const today = new Date().toISOString().slice(0, 10);
  const wk = require('../card').weekKeyOf(today);
  const p = { username: 'jaz', weeklyGoals: { [wk]: 1 } };
  store.set('users/u1', p);
  await fns.cardOnProfile.run(ev({ uid: 'u1' }, null, p));            // card
  const s1 = gym(today);
  store.set('users/u1/sessions/s1', s1);
  await fns.cardOnSession.run(ev({ uid: 'u1', sid: 's1' }, null, s1));
  let w = store.get('users/u1/wallet/main');
  assert.strictEqual(w.points, 10 + 15 + 5);                          // workout + goal (1 day) + streak 1 week
  assert.ok(w.badges.w1 && !w.badges.s2);
  assert.strictEqual(store.get('profileCards/u1').badges, 1);

  // the same session written again: nothing new
  await fns.cardOnSession.run(ev({ uid: 'u1', sid: 's1' }, { ...s1, exercises: [{ sets: [{ done: false }] }] }, s1));
  assert.strictEqual(store.get('users/u1/wallet/main').points, 30);

  // a record
  const pt = (d, wt) => ({ d, w: wt, r: 8, u: 'kg' });
  await fns.rewardsOnStats.run(ev({ uid: 'u1', sid: 'e1' }, { points: [pt('2026-01-01', 50)] }, { points: [pt('2026-01-01', 50), pt(today, 60)] }));
  assert.strictEqual(store.get('users/u1/wallet/main').points, 50);

  // a cheer from u2 (u2 exists) → +1 for u1, a badge for u2
  store.set('users/u2', { username: 'est' });
  await fns.rewardsOnCheer.run({ params: { id: 'u2_u1_x' }, data: { exists: true, data: () => ({ from: 'u2', to: 'u1' }) } });
  assert.strictEqual(store.get('users/u1/wallet/main').points, 51);
  assert.ok(store.get('users/u2/wallet/main').badges.c1);

  // friend + copied routine
  store.set('users/u1/friends/u2', { since: 1 });
  await fns.rewardsOnFriend.run({ params: { uid: 'u1', fid: 'u2' }, data: { exists: true, data: () => ({}) } });
  const copied = { name: 'X', source: { type: 'friend', id: 'u2', routineId: 'r' }, exercises: [] };
  await fns.sharedOnRoutine.run(ev({ uid: 'u1', rid: 'rc' }, null, copied));
  w = store.get('users/u1/wallet/main');
  assert.ok(w.badges.f1 && w.badges.cp1);

  // nobody gets a wallet for an account that doesn't exist
  await fns.rewardsOnCheer.run({ params: { id: 'zz' }, data: { exists: true, data: () => ({ from: 'ghost', to: 'u1' }) } });
  assert.ok(!store.has('users/ghost/wallet/main'));

  store.delete('users/u1');
  await fns.cardOnProfile.run(ev({ uid: 'u1' }, p, null));
  assert.ok(!store.has('users/u1/wallet/main'));
});
