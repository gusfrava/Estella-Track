// Starter plan: the routines Estella proposes at the end of onboarding, built from the answers with fixed rules
// (no AI, no network). Same answers → same plan. Later an AI version can return the same shape and fall back to this.
//
//   buildStarterPlan(answers, { lang, unit }) → [{ key, name, exercises: [{ exerciseId, name, type, perSide, sets, reps, seconds, weight, unit }] }]
//   weeklyVolume(plan, daysPerWeek) → { chest, back, shoulders, arms, glutes, quads, hamstrings }  sets per week
//   answers = profile.onboarding: { goal, experience, place, daysPerWeek, minutes, focus }
//
// How it decides (change the tables below to change the plan):
//   SPLITS     days per week → which routines (full body / torso-pierna / empuje-tirón-pierna…)
//   ROUTINES   each routine = movement slots in order of importance; the first N are used (N from the minutes)
//   SLOTS      each slot = exercise options per place (gym / small / home / body) and level (easy / std / adv);
//              each day takes an option the plan hasn't used yet, so days differ
//   CARDIO     perder grasa: cardio at the end of every workout, 10–25 min by workout length
//   DOSE       goal + slot kind → sets × reps
//   FOCUS      the area the person wants to prioritize: its slots come earlier and it gets ~30% more weekly sets
//   VOLUME     sets per muscle per week, counted across the whole plan; sets are moved from the muscle with the
//              most (relative to its target) to the one with the least, within the time the person has
// Weights start at 0 (empty): people fill them in the first time; we don't guess.
import { libraryExercise } from './library.js';

export const PLAN_VERSION = 2;

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
    ['remo_con_mancuerna_a_una_mano', 'remo_invertido'], ['remo_con_mancuerna_a_una_mano', 'remo_con_banda'], ['remo_invertido_en_mesa', 'superman']),
  hpull2: S('acc', ['remo_sentado_en_cable', 'remo_con_mancuerna_a_una_mano', 'remo_unilateral_en_cable'],
    ['remo_con_mancuerna_a_una_mano', 'remo_invertido'], ['remo_con_banda', 'remo_con_mancuerna_a_una_mano'], ['superman', 'remo_invertido_en_mesa']),
  vpush: S('big',
    { easy: ['press_de_hombro_en_maquina', 'press_de_hombro_con_mancuernas_sentado'],
      std: ['press_de_hombro_con_mancuernas_sentado', 'press_militar_de_pie', 'press_de_hombro_en_maquina'] },
    ['press_de_hombro_con_mancuernas_sentado', 'press_arnold'], ['press_de_hombro_con_mancuernas_de_pie', 'press_arnold'], ['flexion_pica']),
  vpull: S('big',
    { easy: ['jalon_al_pecho_agarre_ancho', 'jalon_al_pecho_agarre_neutro', 'pullover_en_maquina'],
      std: ['jalon_al_pecho_agarre_neutro', 'jalon_al_pecho_agarre_ancho', 'jalon_unilateral_medio_arrodillado'],
      adv: ['dominada_agarre_neutro', 'dominada_agarre_ancho', 'jalon_al_pecho_agarre_neutro'] },
    ['pullover_con_mancuerna_para_dorsal', 'remo_invertido'], ['pullover_con_mancuerna_para_dorsal', 'remo_con_banda'], ['remo_invertido_en_mesa', 'bird_dog']),
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
const JUMP_IDS = new Set(Object.values(JUMP));

// ---------- focus ----------
// Slots of the focus area move up in every routine (after the first three, so no routine loses its push, pull or
// legs). Days that train the area get up to 2 extra focus slots; other days get 1 small one when it fits any day
// (a glute or arm exercise is fine on an upper or leg day; a chest press on leg day isn't). FOCUS_BOOST
// multiplies the area's weekly target, and the balancer moves sets towards it.
export const FOCUS_BOOST = 1.3;
const FOCUS = {
  balanced: { slots: [], extra: [], anyDay: [], muscles: [] },
  legs: { slots: ['squat', 'squat2', 'hinge', 'lunge', 'glute', 'quadacc', 'hamacc', 'abduct', 'calves'], extra: ['glute', 'abduct', 'hamacc'],
    anyDay: ['abduct', 'glute'], muscles: ['glutes', 'quads', 'hamstrings'] },
  upper: { slots: ['hpush', 'hpush2', 'hpull', 'hpull2', 'vpull', 'fly'], extra: ['hpush2', 'hpull2', 'fly'], anyDay: [], muscles: ['chest', 'back'] },
  arms: { slots: ['biceps', 'triceps', 'hammer', 'lateral', 'vpush', 'rear'], extra: ['biceps', 'triceps', 'lateral'],
    anyDay: ['biceps', 'triceps'], muscles: ['shoulders', 'arms'] },
};
const focusOf = f => FOCUS[f] || FOCUS.balanced;

// ---------- weekly volume ----------
// Muscle groups shown and balanced, with the library's muscle keys (exercises.json "sv") that count for each.
// A set counts 1 for a muscle the exercise works hard (weight ≥ 70) and ½ for one it helps (40–69).
const MUSCLES = {
  chest: ['chest'], back: ['lats', 'midBack'], shoulders: ['shouldersF', 'shouldersB'], arms: ['bicepsF', 'triceps'],
  glutes: ['glutes'], quads: ['quads'], hamstrings: ['hamstrings'],
};
export const MUSCLE_GROUPS = Object.keys(MUSCLES);
// Weekly target for a big muscle by level; smaller groups get a share. Real volume depends on days × minutes,
// so targets are used as proportions: the plan is balanced relative to them, not forced to reach them.
const TARGET = { easy: 8, std: 11, adv: 14 };
// Shoulders also count half from every press, so their target is higher (otherwise lateral raises lose sets).
const SHARE = { chest: 1, back: 1, shoulders: 1.3, arms: 0.8, glutes: 1, quads: 1, hamstrings: 0.8 };
const MAX_SETS = 4;
// Fewest sets the balancer may leave: main lifts and focus exercises keep 3, the rest 2 (never below the start for beginners).
const minSets = ex => (ex.kind === 'big' || ex.focus ? 3 : 2);
// Extra sets per workout the balancer may add on top of the starting dose (beginners: none, they start lighter).
const EXTRA_SETS = { easy: 0, std: 2, adv: 4 };

function contribution(ex, group) {
  const e = libraryExercise(ex.exerciseId);
  if (!e || !e.sv || ex.type === 'time' || ex.jump || JUMP_IDS.has(ex.exerciseId)) return 0;
  const w = Math.max(0, ...MUSCLES[group].map(k => e.sv[k] || 0));
  return w >= 70 ? 1 : w >= 40 ? 0.5 : 0;
}

// Sets per muscle group per week. Each routine is done daysPerWeek / routines times a week.
export function weeklyVolume(plan, daysPerWeek) {
  const list = plan.filter(r => r.exercises.length);
  const freq = list.length ? (daysPerWeek || list.length) / list.length : 0;
  const v = Object.fromEntries(MUSCLE_GROUPS.map(g => [g, 0]));
  for (const r of list) for (const ex of r.exercises) for (const g of MUSCLE_GROUPS) v[g] += ex.sets * contribution(ex, g) * freq;
  return Object.fromEntries(MUSCLE_GROUPS.map(g => [g, Math.round(v[g])]));
}

function targetsFor(level, focus) {
  const boosted = new Set(focusOf(focus).muscles);
  return Object.fromEntries(MUSCLE_GROUPS.map(g => [g, TARGET[level] * SHARE[g] * (boosted.has(g) ? FOCUS_BOOST : 1)]));
}

// Adds and moves sets so every muscle group gets a similar share of its target (see VOLUME above).
// "Similar share" = the groups' volume ÷ target ratios are as close to each other as possible (we measure the
// spread of their logarithms, so 6 vs 12 counts as much as 12 vs 24). Groups this plan can't train
// (no arm exercises without equipment, for example) are left out.
function balance(plan, { daysPerWeek, level, focus }) {
  const T = targetsFor(level, focus);
  const freq = daysPerWeek / plan.length;
  const adjustable = ex => !ex.cardio && !ex.jump && ex.type !== 'time' && ex.kind !== 'core';
  const items = [];   // every adjustable exercise with what one set of it adds per week, per group
  plan.forEach((r, ri) => r.exercises.forEach(ex => {
    if (adjustable(ex)) items.push({ ex, ri, c: MUSCLE_GROUPS.map(g => contribution(ex, g) * freq) });
  }));
  const groups = MUSCLE_GROUPS.map((g, gi) => gi).filter(gi => items.some(it => it.c[gi] >= 0.5 * freq));
  const v = MUSCLE_GROUPS.map(g => 0);
  for (const r of plan) for (const ex of r.exercises) MUSCLE_GROUPS.forEach((g, gi) => { v[gi] += ex.sets * contribution(ex, g) * freq; });
  const spread = vol => {
    const logs = groups.map(gi => Math.log((vol[gi] + 0.5) / T[MUSCLE_GROUPS[gi]]));
    const mean = logs.reduce((x, y) => x + y, 0) / logs.length;
    return logs.reduce((x, y) => x + (y - mean) ** 2, 0);
  };
  const withSet = (it, sign) => v.map((x, gi) => x + sign * it.c[gi]);
  const sessionSets = ri => plan[ri].exercises.reduce((n, ex) => n + (ex.cardio ? 0 : ex.sets), 0);
  const start = plan.map((r, ri) => sessionSets(ri));
  const apply = (it, sign) => { it.ex.sets += sign; it.c.forEach((x, gi) => { v[gi] += sign * x; }); };

  // 1) Use the extra room (intermediate/advanced): one set at a time, where it helps the balance most.
  for (;;) {
    let best = null;
    for (const it of items) {
      if (it.ex.sets >= MAX_SETS || sessionSets(it.ri) >= start[it.ri] + EXTRA_SETS[level]) continue;
      const sc = spread(withSet(it, 1));
      if (!best || sc < best.sc) best = { it, sc };
    }
    if (!best) break;
    apply(best.it, 1);
  }
  // 2) Move single sets from one exercise to another while it makes the plan more even. A workout stays
  //    within ±2 sets of where it started, so its length barely changes.
  for (let i = 0; i < 60; i++) {
    const now = spread(v);
    let best = null;
    for (const from of items) {
      if (from.ex.sets <= minSets(from.ex) || sessionSets(from.ri) <= start[from.ri] - 3) continue;
      const less = withSet(from, -1);
      for (const to of items) {
        if (to === from || to.ex.sets >= MAX_SETS) continue;
        if (to.ri !== from.ri && sessionSets(to.ri) >= start[to.ri] + 3) continue;
        const sc = spread(less.map((x, gi) => x + to.c[gi]));
        if (sc < now - 1e-3 && (!best || sc < best.sc)) best = { from, to, sc };
      }
    }
    if (!best) break;
    apply(best.from, -1); apply(best.to, 1);
  }
}

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
  const focus = focusOf(answers.focus);
  const isFocus = slotKey => focus.slots.includes(slotKey);
  // Slot order for a routine with the focus: the first three stay (each routine keeps its main movements),
  // then focus slots and the extra ones, then the rest.
  const slotOrder = key => {
    const base = ROUTINES[key];
    const head = base.slice(0, 3), tail = base.slice(3);
    const extra = base.some(isFocus) ? focus.extra.filter(k => !base.includes(k)).slice(0, 2)
      : focus.anyDay.filter(k => !base.includes(k)).slice(0, 1);
    return [...head, ...tail.filter(isFocus), ...extra, ...tail.filter(k => !isFocus(k))];
  };

  const planUsed = new Set();   // exercises already in earlier routines of this plan (for variety)
  const plan = split.map(key => {
    const used = new Set();
    const exercises = [];
    const add = (id, d, type, tags = {}) => {
      const e = libraryExercise(id);
      if (!e || used.has(id)) return;
      used.add(id); planUsed.add(id);
      exercises.push({ ...exerciseFrom(type ? { ...e, type } : e, d, ctx), ...tags });
    };
    // first option not in this routine; prefer one the plan hasn't used yet (unless it's a strength main lift)
    const choose = (options, varied = true) => {
      const free = options.filter(id => !used.has(id) && libraryExercise(id));
      return (varied && free.find(id => !planUsed.has(id))) || free[0];
    };
    // athletic: one jump first (fresh legs), counted in reps; it takes one of the spots
    if (goal === 'athletic') add(JUMP[place], { sets: 3, reps: 5, seconds: 30 }, 'reps', { jump: true });
    const room = goal === 'fat' ? count - 1 : count;   // fat loss: the last spot is cardio
    for (const slotKey of [...slotOrder(key), ...FILLERS]) {
      if (exercises.length >= room) break;
      const slot = SLOTS[slotKey];
      const id = choose(optionsFor(slot, place, level), !(goal === 'strength' && slot.kind === 'big'));
      if (id) add(id, dose(slot.kind, answers, level), null, { kind: slot.kind, focus: isFocus(slotKey) });
    }
    // Order in the workout: jump, focus compounds, other main lifts, the rest; cardio last.
    const rank = ex => (ex.jump ? 0 : ex.focus && (ex.kind === 'big' || ex.kind === 'acc') ? 1 : ex.kind === 'big' ? 2
      : ex.kind === 'acc' ? 3 : ex.focus ? 4 : ex.kind === 'iso' ? 5 : 6);
    exercises.sort((a, b) => rank(a) - rank(b));
    if (goal === 'fat') {
      const id = choose(CARDIO[level === 'easy' ? 'easy' : 'hard'][place]);
      if (id) add(id, { sets: 1, reps: 1, seconds: (CARDIO_MINUTES[minutes] || 15) * 60 }, null, { cardio: true });
    }
    return { key, name: names[key] || key, exercises };
  });
  balance(plan, { daysPerWeek, level, focus: answers.focus });
  // kind / focus / jump / cardio were only for building; the saved exercise has the usual fields
  for (const r of plan) r.exercises = r.exercises.map(({ kind, focus: f, jump, cardio, ...ex }) => ex);
  return plan;
}

// Every exercise id the tables use (for the tests: they must all exist in data/exercises.json).
export function allPlanIds() {
  const ids = new Set(Object.values(JUMP));
  const addAll = v => { if (!v) return; if (Array.isArray(v)) v.forEach(x => ids.add(x)); else Object.values(v).forEach(addAll); };
  for (const s of Object.values(SLOTS)) for (const p of ['gym', 'small', 'home', 'body']) addAll(s[p]);
  Object.values(CARDIO).forEach(addAll);
  return [...ids];
}

// What the plan screen explains: which kind of split, the weekly sets per muscle group, and how much more the
// focus area gets than it would in a balanced plan (measured, not assumed). plan = buildStarterPlan(answers).
//   → { split: 'full'|'upperLower'|'byArea'|'fullRotate', level, volume, focusMuscles, focusExtra /* % or 0 */, light }
export function planSummary(answers = {}, plan = []) {
  const { daysPerWeek, place, goal, experience } = answers;
  const level = levelOf(experience, goal);
  const keys = plan.map(r => r.key);
  const split = keys[0] === 'upA' ? 'upperLower' : keys[0] === 'push' ? 'byArea'
    : place === 'body' && daysPerWeek >= 4 ? 'fullRotate' : 'full';
  const volume = weeklyVolume(plan, daysPerWeek);
  const focusMuscles = focusOf(answers.focus).muscles;
  let focusExtra = 0;
  if (focusMuscles.length) {
    const base = weeklyVolume(buildStarterPlan({ ...answers, focus: 'balanced' }), daysPerWeek);
    const sum = v => focusMuscles.reduce((n, g) => n + v[g], 0);
    if (sum(base) > 0) focusExtra = Math.max(0, Math.round((sum(volume) / sum(base) - 1) * 100 / 5) * 5);   // to the nearest 5 %
  }
  // little total time (1–2 short days): fewer sets per muscle than the usual range — fine to start
  const big = ['chest', 'back', 'glutes', 'quads'].map(g => volume[g]);
  const light = big.reduce((n, x) => n + x, 0) / big.length < 6;
  return { split, level, volume, focusMuscles, focusExtra, light };
}
