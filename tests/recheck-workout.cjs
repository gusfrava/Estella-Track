// Checking, unchecking and checking again (by mistake) must stay one workout: the server awards each session id once
// (functions/index.js cardOnSession, key session:<id>), so the session has to survive being emptied.
const assert = require('node:assert/strict');
(async () => {
  const store = await import('../js/state/store.js');
  const { isRoutineDone } = await import('../js/state/selectors.js');
  const counted = new Set(), deleted = [];
  store.subscribe((state, { writes = [] }) => {
    for (const w of writes) {
      if (w.col !== 'sessions') continue;
      if (w.op === 'delete') deleted.push(w.id);
      else if (w.data.exercises.some(e => e.sets.some(x => x.done))) counted.add(w.id);   // what the server would award
    }
  });
  const [r] = store.addRoutines([{ name: 'Test', exercises: [{ name: 'Press', type: 'weight_reps', sets: 3, reps: 10, weight: 40, unit: 'kg' }] }]);
  const ex = r.exercises[0];

  for (let i = 0; i < 3; i++) { store.toggleExercise(r.id, ex.id); store.toggleExercise(r.id, ex.id); }
  store.toggleExercise(r.id, ex.id);
  assert.equal(counted.size, 1, 'check/uncheck/check counts as one workout');
  assert.deepEqual(deleted, [], 'the session is kept when emptied');
  assert(isRoutineDone(store.findRoutine(r.id)));

  store.resetRoutine(r.id);
  assert.equal(isRoutineDone(store.findRoutine(r.id)), false);
  assert.equal((store.getState().stats[ex.id]?.points || []).length, 0, 'reset removes the history point');
  store.toggleExercise(r.id, ex.id);
  assert.equal(counted.size, 1, 'reset then check again is still the same workout');

  // An emptied session from earlier in the week is re-dated when it's used again.
  const s = store.currentSession(store.findRoutine(r.id));
  store.toggleExercise(r.id, ex.id); s.date = '2000-01-01';
  store.toggleExercise(r.id, ex.id);
  assert.notEqual(store.currentSession(store.findRoutine(r.id)).date, '2000-01-01', 'counts on the day it is really done');

  // "Do it again" is a real second workout.
  store.repeatRoutine(r.id); store.toggleExercise(r.id, ex.id);
  assert.equal(counted.size, 2, 'repeating the routine is a new workout');
  console.log('PASS: mistaken check/uncheck/check and reset stay one workout; the day follows the real workout; "Do it again" counts.');
})().catch(e => { console.error(e); process.exit(1); });
