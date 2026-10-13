// Entry point. Wires the layers together:
//
//   tap → actions (below) → store mutation → store notifies → render() + sync saves
//
// - render() picks the screen from session.mode and the router's view.
// - ACTIONS maps every data-action="..." in the HTML to one function. Unknown actions log a warning.

import { isFirebaseConfigured } from './config.js';
import { t, getLang, setLang, onLangChange } from './i18n/index.js';
import { logger, DEBUG } from './utils/log.js';
import * as fb from './services/firebase.js';
import * as sync from './services/sync.js';
import * as store from './state/store.js';
import { getSession, setSession, onSessionChange } from './state/session.js';
import * as auth from './controllers/auth.js';
import * as profileForm from './controllers/profile.js';
import * as account from './controllers/account.js';
import { getView, onRouteChange, openRoutine, goHome, resetRoute, initRouter } from './ui/router.js';
import { closeSheet } from './ui/sheet.js';
import { capturePositions, animateMoves, celebrate } from './ui/motion.js';
import { splashView } from './views/splash.js';
import { authView, pwRulesHTML } from './views/auth.js';
import { homeView } from './views/home.js';
import { routineView } from './views/routine.js';
import { orderedExercises } from './state/selectors.js';
import { usernameView, statusHTML, errorHTML } from './views/username.js';
import { consentView } from './views/consent.js';
import { openPlusMenu } from './sheets/plus-menu.js';
import { openRoutineForm } from './sheets/routine-form.js';
import { openExerciseForm } from './sheets/exercise-form.js';
import { openActivityForm } from './sheets/activity-form.js';
import { openAccountSheet } from './sheets/account.js';
import { confirmDeleteRoutine, confirmDeleteExercise, confirmDeleteActivity } from './sheets/delete.js';

const log = logger('ui');
const app = document.getElementById('app');

// Screen-only state (not saved anywhere).
let highlightId = null;   // routine card that "pops" after completing it
let showOlder = false;    // older activities expanded
let consentError = '';    // "tick the box" message on the consent screen
let openId = null;        // exercise opened to log its sets (routine screen)
let renderLater = false;  // a set value changed while typing → re-render once you leave the field

// ---------- render ----------
function render() {
  renderLater = false;
  document.documentElement.lang = getLang();
  const s = getSession();
  if (s.mode === 'loading') { app.innerHTML = splashView(); return; }
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
  const view = getView();
  const routine = view.name === 'routine' ? store.findRoutine(view.id) : null;
  app.innerHTML = routine
    ? routineView(store.getState(), routine, { openId })
    : homeView(store.getState(), { user: s.user, localMode: s.localMode, highlightId, showOlder,
        verify: { needed: account.needsVerification(), ui: account.getVerifyUI() } });
}

store.subscribe((state, { action }) => {
  account.recordPendingConsent();
  // Typing a set's reps/weight: the box already shows the value, and re-drawing now would close the keyboard.
  if (action === 'edit-set') { renderLater = true; return; }
  render();
});
account.onVerifyChange(render);
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
  if (s.user !== prev.user) { profileForm.resetProfileForm(); account.resetVerifyUI(); consentError = ''; }
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
  const result = change(rid);
  // Finished the open exercise from its sets → close it and open the next one to do.
  if (result.exerciseDone && !wasDone && openId === exId) {
    const next = orderedExercises(store.findRoutine(rid)).pending[0];
    openId = result.completed || !next ? null : next.ex.id;
  }
  render();
  animateMoves(app, before);
  // (Phase 1 · rest timer) result.setDone && !result.exerciseDone → start the rest countdown here.
  if (result.completed) {
    celebrate(store.findRoutine(rid), () => {
      highlightId = rid;
      goHome();
      setTimeout(() => { highlightId = null; }, 800);
    });
  }
}

const isExerciseDone = (rid, exId) => orderedExercises(store.findRoutine(rid)).done.some(i => i.ex.id === exId);

const ACTIONS = {
  // general
  lang: d => setLang(d.lang),
  account: () => openAccountSheet(),
  plus: () => openPlusMenu(),
  // sign-in screens
  'auth-screen': d => auth.showScreen(d.screen),
  'toggle-pw': () => { auth.togglePassword(); const pw = document.getElementById('a-pw'); if (pw) pw.focus(); },
  google: () => auth.google(),
  'local-mode': () => sync.enterLocalMode(),
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
  'set-del': d => logChange(d.id, rid => store.removeSet(rid, d.id, Number(d.i))),
  'new-ex': () => openExerciseForm(routineId(), null),
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
function saveSetInput(input) {
  const { id, i, set } = input.dataset;
  const value = parseFloat(String(input.value).replace(',', '.'));
  if (!Number.isFinite(value) || value < 0) { renderLater = true; return; }
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
