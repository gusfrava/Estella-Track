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
    set: async data => { store.set(path, clone(data)); },
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
const db = { collection: name => colRef(name) };
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

  // the app asks for a rebuild
  store.get('profileCards/u1').weeks = {};
  const p4 = { ...p3, cardRefreshAt: 5 };
  await fns.cardOnProfile.run(ev({ uid: 'u1' }, p3, p4));
  assert.deepStrictEqual(store.get('profileCards/u1').weeks, { '2026-10-05': '1', '2026-08-31': '1' });

  // account deleted
  store.delete('users/u1');
  await fns.cardOnProfile.run(ev({ uid: 'u1' }, p4, null));
  assert.ok(!store.has('profileCards/u1'));
  // a late session delete doesn't bring it back
  await fns.cardOnSession.run(ev({ uid: 'u1', sid: 's1' }, gym('2026-10-06'), null));
  assert.ok(!store.has('profileCards/u1'));
});

test('a profile without username yet gets no card', async () => {
  store.clear();
  await fns.cardOnProfile.run(ev({ uid: 'u2' }, null, { displayName: 'X' }));
  assert.ok(!store.has('profileCards/u2'));
});
