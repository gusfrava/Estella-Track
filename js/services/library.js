// Exercise library: the built-in list of exercises (data/exercises.json) and their technique videos
// (data/exercise-videos.json). Same for everyone, read-only, shipped with the app (no Firestore reads).
//
// LibraryExercise = { id, n /* Spanish name */, en /* English name */, g /* group key */, eq /* equipment */,
//                     lv /* 0 any, 1 beginner, 2 intermediate, 3 advanced */, type, side /* 1 = per side */,
//                     s /* popularity score, higher first */, sv, cw /* muscle weights, for muscle maps later */ }
// Videos file: { [id]: { name, video /* YouTube link, '' = none yet */ } }
import { youTubeId } from '../utils/youtube.js';
import { logger } from '../utils/log.js';

const log = logger('library');

// Browse groups, in the order the chips show. Labels live in i18n (L.groups[key]).
export const GROUPS = ['pecho', 'espalda', 'hombros', 'brazos', 'piernas', 'gluteos', 'core', 'cardio', 'movilidad'];

// Extra words people search with, per group (Spanish + English).
const GROUP_WORDS = {
  pecho: 'pecho pectoral pectorales chest pecs',
  espalda: 'espalda dorsal dorsales back lats',
  hombros: 'hombro hombros deltoides shoulders delts',
  brazos: 'brazo brazos biceps triceps antebrazo arms forearms',
  piernas: 'pierna piernas cuadriceps femoral femorales isquios pantorrilla gemelos legs quads hamstrings calves',
  gluteos: 'gluteo gluteos glutes butt',
  core: 'core abdomen abdominales abs oblicuos',
  cardio: 'cardio correr running bici bike',
  movilidad: 'movilidad estiramiento stretching yoga mobility',
};

// Shown first when nothing is typed and no group is picked: the everyday gym exercises.
const POPULAR = ['press_de_banca_con_barra', 'sentadilla_trasera_alta', 'peso_muerto_convencional', 'hip_thrust_con_barra',
  'jalon_al_pecho_agarre_ancho', 'remo_con_mancuerna_a_una_mano', 'press_militar_de_pie', 'elevacion_lateral_con_mancuernas',
  'curl_con_mancuernas_de_pie', 'extension_de_triceps_en_maquina', 'prensa_45_grados', 'zancada_caminando',
  'split_squat_bulgaro', 'sentadilla_goblet', 'dominada_agarre_neutro', 'flexion_de_pecho', 'plancha_frontal', 'running_suave'];

// English gym words also findable in Spanish (many exercises are named "Hack squat", "Split squat búlgaro"…).
const SYNONYMS = {
  squat: 'sentadilla', lunge: 'zancada', row: 'remo', pulldown: 'jalon', deadlift: 'peso muerto', fly: 'aperturas',
  raise: 'elevacion', dip: 'fondos', dips: 'fondos', push: 'flexion', pull: 'dominada', chin: 'dominada', calf: 'pantorrilla gemelos',
  plank: 'plancha', crunch: 'abdominal abdominales', bridge: 'puente', thrust: 'puente', step: 'subida', curl: 'flexion',
};
const withSynonyms = text => `${text} ${text.split(' ').map(w => (Object.hasOwn(SYNONYMS, w) ? SYNONYMS[w] : '')).join(' ')}`.replace(/\s+/g, ' ').trim();

let lib = null;        // { list, byId, videos } once loaded
let loading = null;    // the promise while loading

export const isLibraryLoaded = () => !!lib;

// Loads both files once. Safe to call many times. A failed load can be retried.
export function loadLibrary() {
  if (lib) return Promise.resolve(lib);
  if (!loading) {
    const get = path => fetch(path).then(r => { if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); });
    loading = Promise.all([get('data/exercises.json'), get('data/exercise-videos.json').catch(() => ({}))])
      .then(([list, videos]) => {
        lib = indexLibrary(list, videos);
        log.debug('library loaded', list.length, 'exercises');
        return lib;
      })
      .catch(err => { loading = null; log.warn('library failed to load', err); throw err; });
  }
  return loading;
}

export function indexLibrary(list, videos = {}) {
  const byId = {};
  for (const e of list) {
    e.k = withSynonyms(norm(`${e.n} ${e.en} ${e.eq} ${GROUP_WORDS[e.g] || ''}`));   // what search looks at
    e.kn = withSynonyms(norm(`${e.n} ${e.en}`));                       // names only (ranked higher)
    byId[e.id] = e;
  }
  return { list, byId, videos };
}

// Only for tests: use an in-memory library.
export function setLibraryForTests(list, videos) { lib = list ? indexLibrary(list, videos) : null; }

export const libraryExercise = id => (lib && id && lib.byId[id]) || null;

// The library's technique video for an exercise id → YouTube id, or ''.
export function libraryVideoId(id) {
  const v = lib && id && lib.videos[id];
  return v ? youTubeId(v.video) : '';
}

// ---------- search ----------
// Lowercase, no accents, only letters/numbers and single spaces: "Press de Banca (Barra)" → "press de banca barra".
export const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

// A typed word matches the start of a word. Plurals and gender match too: "sentadillas" → "sentadilla",
// "búlgara" → "búlgaro" (we also try the word without a final s/es and without its last vowel).
function hasWord(hay, w) {
  if (hay.includes(` ${w}`)) return true;
  if (w.length < 5) return false;
  const single = w.replace(/(es|s)$/, '');
  const stem = single.replace(/[aeo]$/, '');
  return hay.includes(` ${single}`) || (stem.length >= 4 && hay.includes(` ${stem}`));
}

// query: what was typed; group: a GROUPS key or ''. Every typed word must start a word in the exercise's
// names, equipment or group words. Best matches first; with nothing typed, the group's (or overall) most popular.
export function searchLibrary(query, group = '', limit = 40) {
  if (!lib) return [];
  const words = norm(query).split(' ').filter(Boolean);
  const pool = group ? lib.list.filter(e => e.g === group) : lib.list;
  if (!words.length) {
    if (group) return [...pool].sort((a, b) => b.s - a.s).slice(0, limit);
    return POPULAR.map(id => lib.byId[id]).filter(Boolean);
  }
  const q = words.join(' ');
  const hits = [];
  for (const e of pool) {
    const hay = ` ${e.k}`;
    if (!words.every(w => hasWord(hay, w))) continue;
    const names = ` ${e.kn}`;
    let score = e.s / 10 + (POPULAR.includes(e.id) ? 30 : 0);   // everyday exercises first among similar ones
    if (norm(e.n).startsWith(q) || norm(e.en).startsWith(q)) score += 100;
    else if (names.includes(` ${q}`)) score += 50;
    score += words.filter(w => hasWord(names, w)).length * 10;
    hits.push({ e, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit).map(h => h.e);
}
