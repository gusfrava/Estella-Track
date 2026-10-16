// Onboarding: a few one-question screens after sign-up. Every answer is saved as soon as it's given
// (profile.onboarding in users/{uid}), so nothing is lost if the app closes halfway. Weight and height go to
// users/{uid}/body/{date} (private health data), never into the profile.
//
// profile.onboarding = { version, character, goal, focus, experience, place, daysPerWeek, minutes, source,
//                        startedAt, completedAt, skippedAt,
//                        starterPlan: { version, choice: 'saved'|'skipped', routines: ['fbA', …], at } }
// profile.units = 'kg' | 'lb'  (default for new exercises)
//
// The last screen proposes a starter plan (services/starter-plan.js) built from the answers:
// "Guardar mi plan" creates those routines, "Prefiero armarlas yo" goes home without them.
import { getState, updateProfile, saveBody, addRoutines, setWeeklyGoal } from '../state/store.js';
import { getSession } from '../state/session.js';
import { loadLibrary } from '../services/library.js';
import { buildStarterPlan, planSummary, PLAN_VERSION } from '../services/starter-plan.js';
import { t, getLang } from '../i18n/index.js';
import { logger } from '../utils/log.js';

const log = logger('onboarding');
const VERSION = 1;

// The screens, in order. Optional ones show "Saltar".
export const STEPS = ['welcome', 'character', 'goal', 'focus', 'experience', 'place', 'days', 'minutes', 'body', 'source', 'done'];
export const OPTIONAL = new Set(['body', 'source']);
export const CHOICES = {
  character: ['estella', 'diego'],
  goal: ['strength', 'muscle', 'fat', 'athletic', 'health'],
  focus: ['balanced', 'legs', 'upper', 'arms'],
  experience: ['never', 'beginner', 'intermediate', 'advanced'],
  place: ['gym', 'small', 'home', 'body'],
  minutes: [30, 45, 60, 90],
  source: ['instagram', 'tiktok', 'youtube', 'friend', 'search', 'ad', 'other'],
};
export const AVAILABLE_CHARACTERS = new Set(['estella', 'diego']);

// A confirmed choice survives back navigation and replay. Completed legacy
// profiles keep the companion they already have.
export function isCharacterLocked() {
  const saved = getState().profile?.onboarding;
  return !!(saved?.character && saved.completedAt);
}

// ---------- UI state (this device only) ----------
let ui = null;          // { step, answers, body: { unit, weight, height, ft, inch }, error, plan, planInfo }
                        // plan: null (not asked yet) | 'loading' | 'failed' | [routines] (empty = can't build one)
let forced = false;     // "Repetir introducción" from the account menu
const listeners = new Set();
export const onOnboardingChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const changed = () => listeners.forEach(fn => fn());

// Show onboarding to new accounts: not finished or skipped yet, and nothing created so far
// (people who already have routines or workouts — accounts from before onboarding existed — never see it).
export function needsOnboarding(state = getState()) {
  if (forced || (ui && STEPS[ui.step] === 'done')) return true;   // the last screen stays until "Ir a mis rutinas"
  const o = state.profile && state.profile.onboarding;
  if (o && (o.completedAt || o.skippedAt)) return false;
  if (o && o.startedAt) return true;                 // started on this account → finish it, even offline
  const { synced = {} } = getSession();
  if (!synced.routines || !synced.sessions) return false;
  const hasData = Object.keys(state.routines).length > 0 || Object.keys(state.sessions).length > 0;
  return !hasData;
}

export function getOnboardingUI() {
  if (!ui) {
    const p = getState().profile || {};
    const saved = p.onboarding || {};
    ui = {
      step: 0,
      answers: { character: 'estella', focus: 'balanced', ...pick(saved) },
      body: { unit: p.units === 'lb' ? 'lb' : 'kg', weight: '', height: '', ft: '', inch: '' },
      error: '',
      plan: null,
    };
  }
  return ui;
}

// ---------- starter plan (last screen) ----------
// Built when the last screen opens: the exercise library has to be loaded first.
function preparePlan() {
  if (Array.isArray(ui.plan) || ui.plan === 'loading') return;
  ui.plan = 'loading';
  const mine = ui;
  loadLibrary().then(() => {
    if (ui !== mine) return;
    const unit = getState().profile?.units === 'lb' ? 'lb' : 'kg';
    ui.plan = buildStarterPlan(ui.answers, { lang: getLang(), unit, names: t().ob.planNames });
    ui.planInfo = planSummary(ui.answers, ui.plan);
    log.debug('starter plan', ui.plan.map(r => `${r.key}:${r.exercises.length}`).join(' '));
    changed();
  }, err => {
    if (ui !== mine) return;
    log.warn('starter plan: library failed', err);
    ui.plan = 'failed';
    changed();
  });
}

const planRoutines = () => (ui && Array.isArray(ui.plan) ? ui.plan.filter(r => r.exercises.length) : []);

// "Guardar mi plan": creates the routines and goes home. Returns how many were created.
export function savePlan() {
  const list = planRoutines();
  if (!list.length) { finish(); return 0; }
  addRoutines(list.map(r => ({ name: r.name, exercises: r.exercises })));
  save({ starterPlan: { version: PLAN_VERSION, choice: 'saved', routines: list.map(r => r.key), at: Date.now() } });
  finish();
  return list.length;
}

export function resetOnboardingUI() { ui = null; forced = false; }

export function replayOnboarding() { ui = null; forced = true; changed(); }

const pick = o => Object.fromEntries(['character', 'goal', 'focus', 'experience', 'place', 'daysPerWeek', 'minutes', 'source']
  .filter(k => o[k] != null).map(k => [k, o[k]]));

// Writes the answers so far (merged into users/{uid}.onboarding).
function save(extra = {}) {
  const p = getState().profile || {};
  const prev = p.onboarding || {};
  if (isCharacterLocked()) ui.answers.character = prev.character;
  const onboarding = { ...prev, ...ui.answers, version: VERSION, startedAt: prev.startedAt || Date.now(), ...extra };
  updateProfile({ onboarding });
}

const stepName = () => STEPS[ui.step];

// Reaching the last screen: onboarding is complete, and the days a week become the weekly goal (home + streak).
function complete() {
  save({ completedAt: Date.now() });
  if (ui.answers.daysPerWeek) setWeeklyGoal(ui.answers.daysPerWeek);
}

// Can "Continuar" be pressed on this screen?
export function canContinue() {
  const s = stepName(), a = ui.answers;
  if (s === 'goal') return !!a.goal;
  if (s === 'experience') return !!a.experience;
  if (s === 'place') return !!a.place;
  if (s === 'days') return !!a.daysPerWeek;
  if (s === 'minutes') return !!a.minutes;
  if (s === 'source') return !!a.source;
  return true;
}

// key = 'goal' | 'experience' | … ; value from CHOICES (days: 1–7)
export function choose(key, value) {
  getOnboardingUI();
  if (key === 'character' && (!AVAILABLE_CHARACTERS.has(value) || isCharacterLocked())) return;
  ui.answers[key] = key === 'daysPerWeek' || key === 'minutes' ? Number(value) : value;
  ui.error = '';
  save();
  changed();
}

export function setBodyField(field, value) {
  getOnboardingUI();
  ui.body[field] = value;
  ui.error = '';
  if (field === 'unit') { updateProfile({ units: value }); changed(); }   // only the toggle re-draws (typing keeps focus)
}

// Weight 20–400 kg (44–880 lb), height 100–250 cm (3'3"–8'2"). Empty = not given.
const num = v => { const n = parseFloat(String(v || '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
function readBody() {
  const b = ui.body;
  const weight = num(b.weight);
  const heightCm = b.unit === 'lb'
    ? ((num(b.ft) || 0) * 30.48 + (num(b.inch) || 0) * 2.54) || null
    : num(b.height);
  const wOk = weight == null || (b.unit === 'lb' ? weight >= 44 && weight <= 880 : weight >= 20 && weight <= 400);
  const hOk = heightCm == null || (heightCm >= 100 && heightCm <= 250);
  return { ok: wOk && hOk, weight, heightCm: heightCm && Math.round(heightCm * 10) / 10, unit: b.unit };
}

export function next() {
  getOnboardingUI();
  const s = stepName();
  if (s === 'body') {
    const b = readBody();
    if (!b.ok) { ui.error = 'bodyBad'; changed(); return; }
    if (b.weight || b.heightCm) saveBody({ weight: b.weight, weightUnit: b.unit, heightCm: b.heightCm, source: 'onboarding' });
  }
  if (!canContinue()) return;
  if (s === 'character' && !isCharacterLocked()) save({ characterConfirmedAt: Date.now() });
  if (s === 'source') save();
  if (STEPS[ui.step + 1] === 'done') complete();
  ui.step = Math.min(STEPS.length - 1, ui.step + 1);
  log.debug('step', STEPS[ui.step]);
  if (stepName() === 'done') preparePlan();
  changed();
}

// "Saltar" on an optional screen.
export function skipStep() {
  getOnboardingUI();
  if (!OPTIONAL.has(stepName())) return;
  if (stepName() === 'source') delete ui.answers.source;
  ui.error = '';
  if (STEPS[ui.step + 1] === 'done') complete();
  ui.step += 1;
  if (stepName() === 'done') preparePlan();
  changed();
}

export function back() {
  getOnboardingUI();
  if (ui.step > 0) { ui.step -= 1; ui.error = ''; ui.plan = null; changed(); }   // answers may change: plan is rebuilt
}

// "Ahora no" on the welcome screen: never asked again (it can be replayed from the account menu).
export function skipAll() {
  getOnboardingUI();
  save({ skippedAt: Date.now() });
  forced = false;
  ui = null;
  changed();
}

// Last screen: "Prefiero armarlas yo" (or "Ir a mis rutinas" when there's no plan) → home.
export function finish() {
  if (ui && stepName() === 'done' && planRoutines().length && !getState().profile?.onboarding?.starterPlan?.at) {
    save({ starterPlan: { version: PLAN_VERSION, choice: 'skipped', routines: [], at: Date.now() } });
  }
  forced = false;
  ui = null;
  changed();
}
