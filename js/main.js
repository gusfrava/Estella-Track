// Entry point. Wires the layers together:
//
//   tap → actions (below) → store mutation → store notifies → render() + sync saves
//
// - render() picks the screen from session.mode and the router's view.
// - ACTIONS maps every data-action="..." in the HTML to one function. Unknown actions log a warning.

import { isFirebaseConfigured } from './config.js';
import { t, getLang, setLang, onLangChange, hasChosenLang, chooseLang, previewLang } from './i18n/index.js';
import { logger, DEBUG } from './utils/log.js';
import * as fb from './services/firebase.js';
import * as sync from './services/sync.js';
import * as store from './state/store.js';
import { getSession, setSession, onSessionChange } from './state/session.js';
import * as auth from './controllers/auth.js';
import * as profileForm from './controllers/profile.js';
import * as account from './controllers/account.js';
import { getView, onRouteChange, openRoutine, goHome, showTab, resetRoute, initRouter } from './ui/router.js';
import { closeSheet } from './ui/sheet.js';
import { capturePositions, animateMoves, celebrate, confetti } from './ui/motion.js';
import { toast } from './ui/toast.js';
import { ICONS } from './ui/icons.js';
import { esc } from './utils/format.js';
import { splashView } from './views/splash.js';
import { authView, pwRulesHTML } from './views/auth.js';
import { homeView } from './views/home.js';
import { routineView } from './views/routine.js';
import { progressView } from './views/progress.js';
import { orderedExercises, personalRecord, beatsRecord } from './state/selectors.js';
import { todayStr } from './utils/dates.js';
import { usernameView, statusHTML, errorHTML } from './views/username.js';
import { consentView } from './views/consent.js';
import { languageView, onboardingView } from './views/onboarding.js';
import * as onboarding from './controllers/onboarding.js';
import { openPlusMenu } from './sheets/plus-menu.js';
import { openRoutineForm } from './sheets/routine-form.js';
import { openExerciseForm } from './sheets/exercise-form.js';
import { openExercisePicker } from './sheets/exercise-picker.js';
import { openVideoSheet } from './sheets/video.js';
import { loadLibrary, techniqueVideo, exerciseName } from './services/library.js';
import { openActivityForm } from './sheets/activity-form.js';
import { openAccountSheet } from './sheets/account.js';
import { openWeeklyGoalSheet } from './sheets/weekly-goal.js';
import { confirmDeleteRoutine, confirmDeleteExercise, confirmDeleteActivity } from './sheets/delete.js';

const log = logger('ui');
const app = document.getElementById('app');

// Screen-only state (not saved anywhere).
let highlightId = null;   // routine card that "pops" after completing it
let showOlder = false;    // older activities expanded
let consentError = '';    // "tick the box" message on the consent screen
let openId = null;        // exercise opened to log its sets (routine screen)
let renderLater = false;  // a set value changed while typing → re-render once you leave the field
let lastObStep = null;    // onboarding screen last shown (scroll to top / confetti only when it changes)

// ---------- render ----------
function render() {
  renderLater = false;
  document.documentElement.lang = getLang();
  const s = getSession();
  if (s.mode === 'loading') { app.innerHTML = splashView(); return; }
  // Very first screen on a phone that hasn't picked a language yet.
  if (s.mode === 'auth' && !hasChosenLang()) { app.innerHTML = languageView(); return; }
  if (s.mode === 'auth') { app.innerHTML = authView(auth.getAuthUI(), { configured: isFirebaseConfigured(), fatal: s.fatal }); return; }
  // One-time gates for signed-in accounts: accept the privacy policy/terms, then pick a username.
  const profile = store.getState().profile;
  if (!s.localMode && s.user && profile && !account.hasCurrentConsent(profile)) {
    app.innerHTML = consentView({ error: consentError });
    return;
  }
  if (!s.localMode && s.user && profile && !profile.username) {
    app.innerHTML = usernameView(profileForm.ensureProfileForm());
    return;
  }
  // New accounts: a few questions (goal, days, weight…), saved as they're answered.
  if (!s.localMode && s.user && profile && onboarding.needsOnboarding()) {
    const ui = onboarding.getOnboardingUI();
    let step = onboarding.STEPS[ui.step];
    if (step === 'done' && (ui.plan === null || ui.plan === 'loading')) step = 'done-loading';   // confetti once the plan shows
    app.innerHTML = onboardingView(ui);
    if (step !== lastObStep) { if (lastObStep !== 'done-loading') window.scrollTo(0, 0); if (step === 'done') confetti(); }
    lastObStep = step;
    return;
  }
  lastObStep = null;
  const view = getView();
  const routine = view.name === 'routine' ? store.findRoutine(view.id) : null;
  if (routine) app.innerHTML = routineView(store.getState(), routine, { openId });
  else if (view.name === 'progress') app.innerHTML = progressView(store.getState(), { user: s.user, localMode: s.localMode });
  else app.innerHTML = homeView(store.getState(), { user: s.user, localMode: s.localMode, highlightId, showOlder,
    verify: { needed: account.needsVerification(), ui: account.getVerifyUI() } });
}

store.subscribe((state, { action }) => {
  account.recordPendingConsent();
  // Typing a set's reps/weight: the box already shows the value, and re-drawing now would close the keyboard.
  if (action === 'edit-set') { renderLater = true; return; }
  render();
});
account.onVerifyChange(render);
onboarding.onOnboardingChange(render);
// The name/username form updates its status line in place (a full re-render would move the cursor).
profileForm.onProfileFormChange((form, kind) => {
  const status = document.getElementById('u-status');
  if (!status) return;
  status.innerHTML = statusHTML(form);
  document.getElementById('u-error').innerHTML = errorHTML(form);
  const btn = document.getElementById('u-submit');
  btn.disabled = form.busy;
  btn.textContent = form.busy ? t().saving : (form.editing ? t().save : t().continue);
});
onRouteChange(() => { openId = null; render(); });
auth.onAuthUIChange(render);
onLangChange(lang => { fb.setAuthLanguage(lang); render(); });
onSessionChange((s, prev) => {
  if (s.user !== prev.user) { profileForm.resetProfileForm(); account.resetVerifyUI(); onboarding.resetOnboardingUI(); consentError = ''; }
  if (s.mode === 'app' && prev.mode !== 'app') resetRoute();
  if (s.mode !== 'app') closeSheet(true);
  render();
});

// ---------- actions ----------
const routineId = () => getView().id;

// Runs a store change that can move cards (an exercise finishing goes to the bottom), animates it,
// and celebrates when it finished the routine. change() returns { completed, exerciseDone, setDone }.
function logChange(exId, change) {
  const rid = routineId();
  const wasDone = !!(store.findRoutine(rid) && isExerciseDone(rid, exId));
  const before = capturePositions(app);
  const ex = store.findRoutine(rid).exercises.find(e => e.id === exId);
  const recordBefore = ex && personalRecord(store.getState(), ex);
  const result = change(rid);
  // Finished the open exercise from its sets → close it and open the next one to do.
  if (result.exerciseDone && !wasDone && openId === exId) {
    const next = orderedExercises(store.findRoutine(rid)).pending[0];
    openId = result.completed || !next ? null : next.ex.id;
  }
  render();
  animateMoves(app, before);
  if (result.exerciseDone && ex) celebrateRecord(ex, recordBefore);
  // (Phase 1 · rest timer) result.setDone && !result.exerciseDone → start the rest countdown here.
  if (result.completed) {
    celebrate(store.findRoutine(rid), () => {
      highlightId = rid;
      goHome();
      setTimeout(() => { highlightId = null; }, 800);
    });
  }
}

// Finishing an exercise beat the previous best → "¡Nuevo récord!" (not for the very first time it's done).
function celebrateRecord(ex, before) {
  const after = personalRecord(store.getState(), ex);
  if (!beatsRecord(ex, after, before) || after.point.d !== todayStr()) return;
  toast(`${ICONS.trophy}<span><b>${t().newRecordToast}</b>${esc(exerciseName(ex))}</span>`);
}

const isExerciseDone = (rid, exId) => orderedExercises(store.findRoutine(rid)).done.some(i => i.ex.id === exId);

const ACTIONS = {
  // general
  lang: d => setLang(d.lang),
  account: () => openAccountSheet(),
  'weekly-goal': () => openWeeklyGoalSheet(),
  plus: () => openPlusMenu(),
  // sign-in screens
  'auth-screen': d => auth.showScreen(d.screen),
  'toggle-pw': () => { auth.togglePassword(); const pw = document.getElementById('a-pw'); if (pw) pw.focus(); },
  google: () => auth.google(),
  'local-mode': () => sync.enterLocalMode(),
  // first screen (language) + onboarding
  'pick-lang': d => previewLang(d.lang),
  'lang-continue': () => chooseLang(getLang()),
  'ob-pick': d => onboarding.choose(d.key, d.value),
  'ob-next': () => onboarding.next(),
  'ob-back': () => onboarding.back(),
  'ob-skip': () => onboarding.skipStep(),
  'ob-skip-all': () => onboarding.skipAll(),
  'ob-unit': d => onboarding.setBodyField('unit', d.unit),
  'ob-finish': () => { onboarding.finish(); resetRoute(); },
  'ob-save-plan': () => {
    const n = onboarding.savePlan();
    resetRoute();
    if (n) toast(`${ICONS.check}<span><b>${esc(t().ob.planSaved(n))}</b></span>`);
  },
  // consent screen + email verification
  'accept-legal': () => {
    const box = document.getElementById('c-accept');
    if (!box || !box.checked) { consentError = t().consentReq; render(); return; }
    consentError = '';
    account.acceptLegal();
  },
  'verify-resend': () => account.resendVerification(),
  'verify-check': () => account.checkVerified(),
  // home
  open: d => openRoutine(d.id),
  tab: d => showTab(d.tab),
  older: () => { showOlder = !showOlder; render(); },
  'edit-routine': d => openRoutineForm(store.findRoutine(d.id)),
  'del-routine': d => confirmDeleteRoutine(d.id),
  'edit-act': d => openActivityForm(d.id),
  'del-act': d => confirmDeleteActivity(d.id),
  // routine screen
  home: () => goHome(),
  toggle: d => logChange(d.id, rid => store.toggleExercise(rid, d.id)),
  expand: d => { openId = openId === d.id ? null : d.id; render(); },
  'set-tick': d => logChange(d.id, rid => store.toggleSet(rid, d.id, Number(d.i))),
  'set-add': d => logChange(d.id, rid => store.addSet(rid, d.id)),
  'set-drop': d => logChange(d.id, rid => store.addDrop(rid, d.id)),
  'set-del': d => logChange(d.id, rid => store.removeSet(rid, d.id, Number(d.i))),
  'new-ex': () => openExercisePicker(routineId()),
  video: d => {
    const ex = store.findRoutine(routineId()).exercises.find(e => e.id === d.id);
    const video = techniqueVideo(ex);
    if (video) openVideoSheet(exerciseName(ex), video, () => openExerciseForm(routineId(), ex.id, null, { replace: true, focus: 'video' }));
  },
  'edit-video': d => openExerciseForm(routineId(), d.id, null, { focus: 'video' }),
  'edit-ex': d => openExerciseForm(routineId(), d.id),
  'del-ex': d => confirmDeleteExercise(routineId(), d.id),
  reset: () => store.resetRoutine(routineId()),
};

app.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || !app.contains(el)) return;
  const fn = ACTIONS[el.dataset.action];
  if (!fn) { log.warn('no handler for data-action =', el.dataset.action); return; }
  log.debug('action', el.dataset.action, el.dataset.id || '');
  fn(el.dataset, el);
});

app.addEventListener('input', e => {
  if (e.target.dataset.obBody) {
    onboarding.setBodyField(e.target.dataset.obBody, e.target.value);
    const err = app.querySelector('.ob .err-box'); if (err) err.remove();     // typing again clears "check the numbers"
    return;
  }
  auth.rememberInput(e.target.id, e.target.value, e.target);
  const rules = e.target.id === 'a-pw' && document.getElementById('pw-rules');
  if (rules) rules.innerHTML = pwRulesHTML(e.target.value);
});
app.addEventListener('change', e => {
  if (e.target.id === 'a-consent') auth.rememberInput(e.target.id, e.target.value, e.target);
  if (e.target.classList.contains('set-in')) saveSetInput(e.target);
});

// ---------- set rows (reps × weight boxes) ----------
// Reads a box ("62,5" or "62.5"); an empty or invalid box goes back to its saved value on the next re-render.
// Time rows have two boxes (min : sec) that are saved together as seconds.
const readBox = el => parseFloat(String(el.value).replace(',', '.'));
function saveSetInput(input) {
  const { id, i, set } = input.dataset;
  const value = readBox(input);
  if (!Number.isFinite(value) || value < 0) { renderLater = true; return; }
  if (set === 'min' || set === 'sec') {
    const row = input.closest('.set');
    const min = readBox(row.querySelector('[data-set=min]')) || 0;
    const sec = readBox(row.querySelector('[data-set=sec]')) || 0;
    store.updateSet(routineId(), id, Number(i), { seconds: Math.round(min * 60 + sec) });
    renderLater = true;               // re-draw later so "75" seconds shows as 1:15
    return;
  }
  store.updateSet(routineId(), id, Number(i), { [set]: value });
}
app.addEventListener('focusin', e => { if (e.target.classList.contains('set-in')) e.target.select(); });
app.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('set-in')) e.target.blur(); });
// Left the boxes (keyboard closed) → catch up. The short wait lets a tap on a button (✓, +) land first:
// re-drawing between the press and the release would swallow that tap.
app.addEventListener('focusout', () => {
  setTimeout(() => {
    const a = document.activeElement;
    if (renderLater && !(a && a.classList && a.classList.contains('set-in'))) render();
  }, 400);
});
// Name/username fields live on the gate screen (#app) or in the Edit profile sheet (#layer).
document.addEventListener('input', e => {
  if (e.target.id === 'u-display' || e.target.id === 'u-name') profileForm.onProfileInput(e.target.id, e.target.value, e.target);
});

app.addEventListener('submit', e => {
  if (e.target.id === 'f-auth') { e.preventDefault(); auth.submitLogin(); }
  else if (e.target.id === 'f-reset') { e.preventDefault(); auth.submitReset(); }
  else if (e.target.id === 'f-username') {
    e.preventDefault();
    profileForm.submitProfileForm().then(ok => { if (ok) profileForm.resetProfileForm(); });
  }
});

// A new week can start while the app sits open in the background.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && getSession().mode === 'app') store.checkNewWeek();
});

// ---------- installable app ----------
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const ok = location.protocol === 'https:' || location.hostname === 'localhost';
  if (!ok) return;
  navigator.serviceWorker.register('./sw.js').then(
    () => log.debug('service worker registered'),
    err => log.debug('service worker not available here', err && err.message)
  );
}

// ---------- start ----------
async function boot() {
  initRouter({ onBack: () => closeSheet(true) });
  // The exercise library loads in the background; once it's there, screens can show exercise names in the
  // current language and the technique videos.
  loadLibrary().then(() => { const f = document.activeElement; if (!f || !f.matches('input, textarea')) render(); }, () => {});
  registerServiceWorker();

  if (DEBUG) {
    window.estella = { state: store.getState, session: getSession, view: getView };
    log.debug('debug helpers: estella.state(), estella.session(), estella.view()');
  }

  if (!isFirebaseConfigured()) {
    log.debug('Firebase not configured — sign-in screen shows the setup notice');
    if (sync.wantsLocalMode()) sync.enterLocalMode();
    else setSession({ mode: 'auth' });
    return;
  }

  setSession({ mode: 'loading' });
  try {
    await fb.loadFirebase(getLang());
  } catch (err) {
    log.error('Firebase failed to load', err);
    setSession({ mode: 'auth', fatal: 'loadFailed' });
    return;
  }
  fb.consumeRedirectResult().catch(err => auth.showError(err));
  fb.onAuthChange(user => {
    const s = getSession();
    if (user) {
      if (!s.user || s.user.uid !== user.uid) sync.startUserSession(user);
    } else if (s.user || s.mode !== 'auth') {
      auth.resetAuthUI();
      sync.endUserSession();
    }
  });
}

boot();
