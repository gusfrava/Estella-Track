// One-time conversion: old app's EXERCISE_DB (olddb.json) → repo data/exercises.json + data/exercise-videos.json
import fs from 'fs';
const old = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outDir = process.argv[3];
const GROUP = g => {
  const f = g.split('/')[0];
  return { 'pecho': 'pecho', 'espalda': 'espalda', 'hombros': 'hombros', 'bíceps': 'brazos', 'tríceps': 'brazos',
    'cuádriceps': 'piernas', 'piernas': 'piernas', 'femorales': 'piernas', 'pantorrillas': 'piernas',
    'glúteos': 'gluteos', 'core': 'core', 'cardio': 'cardio', 'movilidad': 'movilidad' }[f];
};
const LEVEL = { prin: 1, inte: 2, avan: 3, todo: 0, a: 2, b: 2 };
const out = old.map(e => {
  let group = GROUP(e.g);
  if (/wrist|pronaci/i.test(e.n)) group = 'brazos';
  if (/tal[oó]n|gemelos|calf|tibial/i.test(e.n)) group = 'piernas';
  if (e.c === 'm') group = 'movilidad';
  let type = e.m === 'time' ? 'time' : e.m === 'reps_only' ? 'reps' : 'weight_reps';
  if (/^plancha( frontal| lateral)?$/i.test(e.n)) type = 'time';      // planks are held, not counted
  if (/crunch en cable|cable crunch|plancha con peso/i.test(e.n)) type = 'weight_reps';
  // The old list marked many strength moves as "time" (anything with "remo"/"cuerda"); only holds are timed.
  if (e.c === 'f' && type === 'time' && !/plancha|plank/i.test(e.n)) type = /invertido|trx/i.test(e.n) ? 'reps' : 'weight_reps';
  if (group === 'movilidad' || group === 'cardio') type = 'time';
  const side = type !== 'time' && e.u ? 1 : 0;
  if (!group) throw new Error('no group for ' + e.n + ' / ' + e.g);
  return { id: e.id, n: e.n, en: e.en, g: group, eq: e.eq, lv: LEVEL[e.lv] ?? 0, type, side, s: e.s, sv: e.sv, cw: e.cw };
});
const ids = new Set(); for (const e of out) { if (ids.has(e.id)) throw new Error('dup ' + e.id); ids.add(e.id); }
fs.writeFileSync(outDir + '/exercises.json', '[\n' + out.map(e => JSON.stringify(e)).join(',\n') + '\n]\n');
// Videos: one line per exercise, Spanish name included so it's easy to find with Ctrl+F. Paste a YouTube link in "video".
const vids = '{\n' + out.map(e => `  ${JSON.stringify(e.id)}: { "name": ${JSON.stringify(e.n)}, "video": "" }`).join(',\n') + '\n}\n';
if (!fs.existsSync(outDir + '/exercise-videos.json')) fs.writeFileSync(outDir + '/exercise-videos.json', vids);
const cnt = {}; out.forEach(e => { cnt[e.g] = (cnt[e.g] || 0) + 1; });
const tc = {}; out.forEach(e => { tc[e.type] = (tc[e.type] || 0) + 1; });
console.log(out.length, cnt, tc, 'side', out.filter(e => e.side).length);
