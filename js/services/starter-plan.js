// Starter plan: the routines Estella proposes at the end of onboarding, built from the answers with fixed rules
// (no AI, no network). Same answers → same plan. Later an AI version can return the same shape and fall back to this.
//
//   buildStarterPlan(answers, { lang, unit }) → [{ key, name, exercises: [{ exerciseId, name, type, perSide, sets, reps, seconds, weight, unit }] }]
//   answers = profile.onboarding: { goal, experience, place, daysPerWeek, minutes }
//
// How it decides (change the tables below to change the plan):
//   SPLITS     days per week → which routines (full body / torso-pierna / empuje-tirón-pierna…)
//   ROUTINES   each routine = movement slots in order of importance; the first N are used (N from the minutes)
//   SLOTS      each slot = exercise options per place (gym / small / home / body) and level (easy / std / adv);
//              each day takes an option the plan hasn't used yet, so days differ
//   CARDIO     perder grasa: cardio at the end of every workout, 10–25 min by workout length
//   DOSE       goal + slot kind → sets × reps
// Weights start at 0 (empty): people fill them in the first time; we don't guess.
import { libraryExercise } from './library.js';

export const PLAN_VERSION = 1;

// ---------- how many routines ----------
const SPLITS = {
  1: ['fbA', 'fbB'], 2: ['fbA', 'fbB'], 3: ['fbA', 'fbB', 'fbC'], 4: ['upA', 'loA', 'upB', 'loB'],
  5: ['push', 'pull', 'legs', 'upper', 'glutes'], 6: ['push', 'pull', 'legs', 'upper', 'glutes'], 7: ['push', 'pull', 'legs', 'upper', 'glutes'],
};
// Without equipment there isn't enough to fill a push or pull day: 4+ days rotate the three full-body routines.
const splitFor = (days, place) => (place === 'body' && days >= 4 ? SPLITS[3] : SPLITS[days]);

// ---------- how many exercises ----------
const COUNT = { 30: 4, 45: 5, 60: 6, 90: 7 };

// ---------- what each routine trains (most important first) ----------
const ROUTINES = {
  fbA: ['squat', 'hpush', 'hpull', 'hamacc', 'lateral', 'core', 'triceps'],
  fbB: ['hinge', 'vpull', 'vpush', 'glute', 'lunge', 'biceps', 'calves'],
  fbC: ['squat2', 'hpush2', 'hpull2', 'glute', 'hamacc', 'lateral', 'core'],
  upA: ['hpush', 'hpull', 'vpush', 'vpull', 'lateral', 'biceps', 'triceps'],
  loA: ['squat', 'hinge', 'lunge', 'quadacc', 'hamacc', 'calves', 'core'],
  upB: ['hpush2', 'vpull', 'vpush', 'hpull2', 'rear', 'triceps', 'biceps'],
  loB: ['hinge', 'glute', 'squat2', 'hamacc', 'abduct', 'calves', 'core'],
  push: ['hpush', 'vpush', 'hpush2', 'lateral', 'triceps', 'fly', 'core'],
  pull: ['vpull', 'hpull', 'hpull2', 'rear', 'biceps', 'hammer', 'core'],
  legs: ['squat', 'hinge', 'lunge', 'quadacc', 'hamacc', 'calves', 'core'],
  upper: ['hpush', 'hpull', 'vpush', 'vpull', 'lateral', 'biceps', 'triceps'],
  glutes: ['glute', 'squat2', 'hinge', 'abduct', 'lunge', 'hamacc', 'calves'],
};
// Used when a place has nothing for some slots (e.g. no biceps exercise without equipment).
const FILLERS = ['core', 'core2', 'core3', 'calves'];

// ---------- the exercise for each slot ----------
// kind: big (main lift) | acc (second compound) | iso (small muscle) | core
// Per place: a list of options, or { easy, std, adv } lists (easy = never/beginner or the health goal,
// adv = advanced; missing → std). null = this place has no good option; the slot is skipped.
// Variety: each routine takes the first option the plan hasn't used yet, so the same movement (squat, push,
// pull…) shows up on several days with a different exercise. Strength keeps its main lifts the same on
// every day they appear: practicing them often is how they go up.
const S = (kind, gym, small, home, body) => ({ kind, gym, small, home, body });
const SLOTS = {
  squat: S('big',
    { easy: ['prensa_45_grados', 'sentadilla_goblet', 'hack_squat'], std: ['sentadilla_trasera_alta', 'hack_squat', 'sentadilla_en_smith'],
      adv: ['sentadilla_trasera_alta', 'sentadilla_frontal', 'hack_squat'] },
    ['sentadilla_goblet', 'sentadilla_goblet_con_pausa', 'split_squat_estatico'], ['sentadilla_goblet', 'sentadilla_goblet_con_pausa', 'split_squat_estatico'],
    ['sentadilla_con_peso_corporal', 'split_squat_estatico']),
  squat2: S('acc',
    { easy: ['hack_squat', 'prensa_45_grados', 'sentadilla_goblet'], std: ['prensa_45_grados', 'hack_squat', 'sentadilla_en_smith'] },
    ['sentadilla_goblet_con_pausa', 'sentadilla_goblet', 'step_up_alto'], ['sentadilla_goblet_con_pausa', 'sentadilla_goblet', 'step_up_alto'],
    { easy: ['sentadilla_con_peso_corporal', 'split_squat_estatico'], std: ['split_squat_estatico', 'sentadilla_con_peso_corporal'] }),
  hinge: S('big',
    { easy: ['peso_muerto_rumano_con_mancuernas', 'hiperextension_45_grados', 'peso_muerto_rumano_en_smith'],
      std: ['peso_muerto_rumano_con_barra', 'peso_muerto_rumano_con_mancuernas', 'hiperextension_45_grados'],
      adv: ['peso_muerto_convencional', 'peso_muerto_rumano_con_barra', 'trap_bar_deadlift_high_hips'] },
    ['peso_muerto_rumano_con_mancuernas', 'peso_muerto_a_una_pierna', 'peso_muerto_piernas_rigidas_mancuernas'],
    ['peso_muerto_rumano_con_mancuernas', 'peso_muerto_a_una_pierna', 'peso_muerto_piernas_rigidas_mancuernas'],
    ['puente_de_gluteo', 'single_leg_hamstring_bridge_heel_dig']),
  hpush: S('big',
    { easy: ['press_en_maquina_de_pecho', 'press_plano_con_mancuernas', 'press_pecho_convergente'],
      std: ['press_de_banca_con_barra', 'press_plano_con_mancuernas', 'press_en_smith_plano'] },
    ['press_plano_con_mancuernas', 'press_inclinado_con_mancuernas', 'flexion_de_pecho'],
    ['press_en_el_suelo_con_mancuernas', 'flexion_de_pecho', 'flexion_inclinada'],
    { easy: ['flexion_inclinada', 'flexion_de_pecho'], std: ['flexion_de_pecho', 'flexion_inclinada'] }),
  hpush2: S('acc',
    { easy: ['press_inclinado_en_maquina', 'press_inclinado_convergente', 'press_inclinado_con_mancuernas'],
      std: ['press_inclinado_con_mancuernas', 'press_inclinado_con_barra', 'press_inclinado_en_smith'] },
    ['press_inclinado_con_mancuernas', 'press_plano_con_mancuernas', 'flexion_de_pecho'],
    ['flexion_de_pecho', 'press_en_el_suelo_con_mancuernas'], ['flexion_de_pecho', 'flexion_inclinada']),
  hpull: S('big',
    { easy: ['remo_en_maquina_con_pecho_apoyado', 'remo_sentado_en_cable', 'remo_hammer_strength_bajo'],
      std: ['remo_con_barra', 'remo_con_mancuerna_a_una_mano', 'remo_t_bar_con_pecho_apoyado'] },
    ['remo_con_mancuerna_a_una_mano', 'remo_invertido'], ['remo_con_mancuerna_a_una_mano', 'remo_con_banda'], ['superman', 'bird_dog']),
  hpull2: S('acc', ['remo_sentado_en_cable', 'remo_con_mancuerna_a_una_mano', 'remo_unilateral_en_cable'],
    ['remo_con_mancuerna_a_una_mano', 'remo_invertido'], ['remo_con_banda', 'remo_con_mancuerna_a_una_mano'], ['superman', 'bird_dog']),
  vpush: S('big',
    { easy: ['press_de_hombro_en_maquina', 'press_de_hombro_con_mancuernas_sentado'],
      std: ['press_de_hombro_con_mancuernas_sentado', 'press_militar_de_pie', 'press_de_hombro_en_maquina'] },
    ['press_de_hombro_con_mancuernas_sentado', 'press_arnold'], ['press_de_hombro_con_mancuernas_de_pie', 'press_arnold'], ['flexion_pica']),
  vpull: S('big',
    { easy: ['jalon_al_pecho_agarre_ancho', 'jalon_al_pecho_agarre_neutro', 'pullover_en_maquina'],
      std: ['jalon_al_pecho_agarre_neutro', 'jalon_al_pecho_agarre_ancho', 'jalon_unilateral_medio_arrodillado'],
      adv: ['dominada_agarre_neutro', 'dominada_agarre_ancho', 'jalon_al_pecho_agarre_neutro'] },
    ['pullover_con_mancuerna_para_dorsal', 'remo_invertido'], ['pullover_con_mancuerna_para_dorsal', 'remo_con_banda'], ['bird_dog', 'superman']),
  lunge: S('acc',
    { easy: ['zancada_hacia_atras', 'split_squat_estatico', 'step_up_alto'], std: ['split_squat_bulgaro', 'zancada_caminando', 'step_up_alto'] },
    { easy: ['zancada_hacia_atras', 'split_squat_estatico', 'step_up_alto'], std: ['split_squat_bulgaro', 'zancada_caminando', 'step_up_alto'] },
    ['zancada_hacia_atras', 'zancada_caminando', 'split_squat_estatico'], ['zancada_hacia_atras', 'split_squat_estatico']),
  quadacc: S('iso', ['extension_de_piernas', 'extension_de_piernas_asiento_reclinado'], ['step_up_alto', 'zancada_caminando'],
    ['split_squat_estatico', 'zancada_caminando'], ['split_squat_estatico', 'zancada_hacia_atras']),
  hamacc: S('iso', ['curl_femoral_sentado', 'curl_femoral_acostado', 'curl_femoral_de_pie'],
    ['curl_femoral_tumbado_con_mancuerna', 'peso_muerto_a_una_pierna'], ['peso_muerto_a_una_pierna', 'curl_femoral_deslizante'],
    ['marchas_de_isquios_con_puente', 'single_leg_hamstring_bridge_heel_dig', 'curl_femoral_deslizante']),
  glute: S('acc',
    { easy: ['hip_thrust_en_maquina', 'hip_thrust_con_barra', 'patada_de_gluteo_en_maquina'], std: ['hip_thrust_con_barra', 'hip_thrust_en_maquina', 'hip_thrust_b_stance'] },
    ['hip_thrust_con_barra', 'puente_de_gluteo', 'hip_thrust_a_una_pierna'], ['puente_de_gluteo', 'hip_thrust_a_una_pierna', 'frog_pump'],
    ['puente_de_gluteo', 'frog_pump', 'donkey_kick']),
  abduct: S('iso', ['abduccion_de_cadera_en_maquina', 'abduccion_de_cadera_en_cable'], ['abduccion_de_cadera_en_maquina', 'fire_hydrant'],
    ['fire_hydrant', 'donkey_kick'], ['fire_hydrant', 'donkey_kick']),
  calves: S('iso', ['elevacion_de_talones_de_pie', 'elevacion_de_talones_sentado', 'prensa_de_gemelos'],
    ['elevacion_de_talon_a_una_pierna'], ['elevacion_de_talon_a_una_pierna'], ['elevacion_de_talon_a_una_pierna']),
  lateral: S('iso', ['elevacion_lateral_en_maquina_de_pie', 'elevacion_lateral_en_cable', 'elevacion_lateral_con_mancuernas'],
    ['elevacion_lateral_con_mancuernas', 'elevacion_lateral_lean_in'], ['elevacion_lateral_con_mancuernas', 'elevacion_lateral_lean_in'], null),
  rear: S('iso', ['face_pull', 'pajaros_en_maquina_inversa', 'reverse_cable_fly'], ['pajaros_con_mancuernas', 'pajaros_en_banco_inclinado'],
    ['pajaros_con_mancuernas'], null),
  fly: S('iso', ['pec_deck', 'apertura_en_polea_a_media_altura'], ['apertura_con_mancuernas_plana', 'apertura_inclinada_con_mancuernas'], null, null),
  biceps: S('iso', ['curl_en_cable_estandar', 'curl_predicador_en_maquina', 'curl_con_mancuernas_de_pie'],
    ['curl_con_mancuernas_de_pie', 'curl_alterno_con_mancuernas'], ['curl_con_mancuernas_de_pie', 'curl_alterno_con_mancuernas'], null),
  hammer: S('iso', ['curl_martillo', 'curl_en_cable_con_cuerda_tipo_martillo'], ['curl_martillo'], ['curl_martillo'], null),
  triceps: S('iso', ['pressdown_con_cuerda', 'extension_de_triceps_en_maquina', 'extension_overhead_con_cuerda'],
    ['french_press_con_mancuerna', 'kickback_de_triceps_con_mancuerna', 'skull_crusher_con_mancuernas'],
    ['kickback_de_triceps_con_mancuerna', 'french_press_con_mancuerna'], null),
  core: S('core', ['plancha_frontal', 'crunch_en_cable', 'pallof_press'], ['plancha_frontal', 'dead_bug', 'reverse_crunch'],
    ['plancha_frontal', 'dead_bug', 'reverse_crunch'], ['plancha_frontal', 'dead_bug', 'reverse_crunch']),
  core2: S('core', ['crunch_en_cable', 'dead_bug'], ['dead_bug', 'reverse_crunch'], ['dead_bug', 'reverse_crunch'], ['dead_bug', 'reverse_crunch']),
  core3: S('core', ['plancha_lateral', 'reverse_crunch'], ['plancha_lateral', 'crunch'], ['plancha_lateral', 'crunch'], ['reverse_crunch', 'plancha_lateral']),
};

// Extras by goal.
// Perder grasa: every workout ends with cardio, longer when the workout is longer (it takes one exercise's spot).
// Beginners do steady cardio (walk, elliptical); everyone else harder intervals. Options rotate between days.
const CARDIO_MINUTES = { 30: 10, 45: 15, 60: 20, 90: 25 };
const CARDIO = {
  easy: { gym: ['caminata_en_inclinacion', 'eliptica', 'ciclismo_indoor_suave'], small: ['caminata_en_inclinacion', 'eliptica', 'ciclismo_indoor_suave'],
    home: ['caminata_rapida', 'marcha_con_rodillas_altas'], body: ['caminata_rapida', 'marcha_con_rodillas_altas'] },
  hard: { gym: ['ciclismo_indoor_intenso', 'remadora_intensa', 'caminata_en_inclinacion'], small: ['ciclismo_indoor_intenso', 'caminata_en_inclinacion', 'eliptica_intensa'],
    home: ['circuito_de_peso_corporal', 'caminata_rapida'], body: ['circuito_de_peso_corporal', 'caminata_rapida'] },
};
// Rendimiento atlético: one jump first, while the legs are fresh.
const JUMP = { gym: 'box_jump', small: 'box_jump', home: 'sentadilla_con_salto', body: 'sentadilla_con_salto' };

// ---------- sets × reps ----------
// [sets, reps] per slot kind. Core holds are timed (seconds) – see coreDose.
const DOSE = {
  strength: { big: [4, 5], acc: [3, 8], iso: [3, 10] },
  muscle: { big: [3, 10], acc: [3, 10], iso: [3, 12] },
  fat: { big: [3, 12], acc: [3, 12], iso: [3, 12] },
  athletic: { big: [3, 6], acc: [3, 8], iso: [3, 10] },
  health: { big: [3, 12], acc: [3, 12], iso: [3, 12] },
};
const EASY_BIG = [3, 8];   // heavy sets of 5–6 aren't for the first months: strength/athletic beginners do 3 × 8

const levelOf = (experience, goal) => (goal === 'health' || experience === 'never' || experience === 'beginner'
  ? 'easy' : experience === 'advanced' ? 'adv' : 'std');

// The options for a slot at this place and level, best first.
function optionsFor(slot, place, level) {
  const v = slot[place];
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return (level === 'adv' && v.adv) || (level === 'easy' && v.easy) || v.std || v.easy || [];
}

function dose(kind, { goal, experience }, level) {
  const gentle = goal === 'health' && (experience === 'never' || experience === 'beginner');
  if (kind === 'core') return { sets: gentle ? 2 : 3, reps: 10, seconds: level === 'easy' ? 20 : 30 };
  let [sets, reps] = (DOSE[goal] || DOSE.muscle)[kind];
  if (kind === 'big' && level === 'easy' && (goal === 'strength' || goal === 'athletic')) [sets, reps] = EASY_BIG;
  if (gentle) sets = 2;
  return { sets, reps, seconds: 30 };
}

// One routine exercise from a library entry. Bodyweight-only places log reps (there's no weight to write down).
function exerciseFrom(e, d, { place, lang, unit }) {
  let type = e.type;
  if (place === 'body' && type === 'weight_reps') type = 'reps';
  return {
    exerciseId: e.id, name: lang === 'en' ? e.en : e.n, type, perSide: !!e.side && type !== 'time',
    sets: d.sets, reps: d.reps, seconds: d.seconds, weight: 0, unit,
  };
}

// The plan for these answers. Returns [] when an answer is missing or the library isn't loaded yet.
export function buildStarterPlan(answers = {}, { lang = 'es', unit = 'kg', names = {} } = {}) {
  const { goal, experience, place, daysPerWeek, minutes } = answers;
  const split = splitFor(daysPerWeek, place);
  if (!split || !SLOTS.squat[place] || !DOSE[goal] || !libraryExercise('plancha_frontal')) return [];
  const level = levelOf(experience, goal);
  const count = COUNT[minutes] || 5;
  const ctx = { place, lang, unit };

  const planUsed = new Set();   // exercises already in earlier routines of this plan (for variety)
  return split.map(key => {
    const used = new Set();
    const exercises = [];
    const add = (id, d, type) => {
      const e = libraryExercise(id);
      if (!e || used.has(id)) return;
      used.add(id); planUsed.add(id);
      exercises.push(exerciseFrom(type ? { ...e, type } : e, d, ctx));
    };
    // first option not in this routine; prefer one the plan hasn't used yet (unless it's a strength main lift)
    const choose = (options, varied = true) => {
      const free = options.filter(id => !used.has(id) && libraryExercise(id));
      return (varied && free.find(id => !planUsed.has(id))) || free[0];
    };
    // athletic: one jump first (fresh legs), counted in reps; it takes one of the spots
    if (goal === 'athletic') add(JUMP[place], { sets: 3, reps: 5, seconds: 30 }, 'reps');
    const room = goal === 'fat' ? count - 1 : count;   // fat loss: the last spot is cardio
    for (const slotKey of [...ROUTINES[key], ...FILLERS]) {
      if (exercises.length >= room) break;
      const slot = SLOTS[slotKey];
      const id = choose(optionsFor(slot, place, level), !(goal === 'strength' && slot.kind === 'big'));
      if (id) add(id, dose(slot.kind, answers, level));
    }
    if (goal === 'fat') {
      const id = choose(CARDIO[level === 'easy' ? 'easy' : 'hard'][place]);
      if (id) add(id, { sets: 1, reps: 1, seconds: (CARDIO_MINUTES[minutes] || 15) * 60 });
    }
    return { key, name: names[key] || key, exercises };
  });
}

// Every exercise id the tables use (for the tests: they must all exist in data/exercises.json).
export function allPlanIds() {
  const ids = new Set(Object.values(JUMP));
  const addAll = v => { if (!v) return; if (Array.isArray(v)) v.forEach(x => ids.add(x)); else Object.values(v).forEach(addAll); };
  for (const s of Object.values(SLOTS)) for (const p of ['gym', 'small', 'home', 'body']) addAll(s[p]);
  Object.values(CARDIO).forEach(addAll);
  return [...ids];
}
