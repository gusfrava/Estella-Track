// Run with: node tests/routine-video.cjs
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

(async () => {
  const load = file => import(pathToFileURL(path.resolve(__dirname, '..', file)).href);
  const { setLibraryForTests, techniqueVideo } = await load('js/services/library.js');
  const { routineView } = await load('js/views/routine.js');
  const { blankState, makeRoutine, makeRoutineExercise } = await load('js/state/model.js');
  const { previewLang } = await load('js/i18n/index.js');
  const id = 'test_exercise';
  const libraryId = 'dQw4w9WgXcQ';
  const personalId = 'aqz-KE-bpKQ';
  const entry = { id, n: 'Ejercicio de prueba', en: 'Test exercise', g: 'piernas', eq: '', eqEn: '' };
  const routine = makeRoutine({ name: 'Test routine', recurring: true, order: 0 });
  const exercise = makeRoutineExercise({ name: entry.en, exerciseId: id, type: 'weight_reps', sets: 4, reps: 8 });
  routine.exercises = [exercise];
  const state = blankState();
  state.routines[routine.id] = routine;
  const scenarios = [
    ['library exercise without a video', [entry], {}, '', id, null],
    ['custom exercise without a video', [entry], {}, '', null, null],
    ['library video', [entry], { [id]: { video: `https://youtu.be/${libraryId}` } }, '', id, libraryId],
    ['personal video overrides library', [entry], { [id]: { video: `https://youtu.be/${libraryId}` } }, `https://youtu.be/${personalId}`, id, personalId],
    ['invalid personal link falls back to library', [entry], { [id]: { video: `https://youtu.be/${libraryId}` } }, 'invalid', id, libraryId],
    ['invalid library link', [entry], { [id]: { video: 'invalid' } }, '', id, null],
    ['library not loaded', null, {}, '', id, null],
  ];
  for (const lang of ['en', 'es']) {
    previewLang(lang);
    for (const [name, list, videos, video, exerciseId, expected] of scenarios) {
      setLibraryForTests(list, videos);
      Object.assign(exercise, { video, exerciseId });
      assert.equal(techniqueVideo(exercise)?.id || null, expected, name);
      const closed = routineView(state, routine);
      assert.ok(!closed.includes(`id="sets-${exercise.id}"`), name + ' starts collapsed');
      const open = routineView(state, routine, { openId: exercise.id });
      assert.ok(open.includes(`id="sets-${exercise.id}"`), name + ' expands');
      assert.equal((open.match(/class="set-check"/g) || []).length, 4, name + ' renders every set');
      assert.ok(open.includes(expected ? 'data-action="video"' : 'youtube.com/results?search_query='), name + ' technique action');
      assert.ok(open.includes('data-action="edit-video"'), name + ' allows video editing');
    }
  }
  setLibraryForTests(null);
  console.log('PASS: 14 EN/ES routine expansion cases, with no video, library/personal videos, invalid links, and unloaded library.');
})().catch(error => { console.error(error); process.exitCode = 1; });
