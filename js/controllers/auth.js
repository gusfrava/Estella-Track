// Sign-in logic: holds what the sign-in screens show and runs login / sign-up / reset / Google.
// It calls the Firebase layer; when sign-in succeeds, Firebase notifies main.js, which starts the session.
import * as fb from '../services/firebase.js';
import { t } from '../i18n/index.js';
import { logger } from '../utils/log.js';

const log = logger('auth');
const fresh = () => ({ screen: 'login', error: '', info: '', busy: false, showPw: false, name: '', email: '', password: '' });
let ui = fresh();
const listeners = new Set();

export const getAuthUI = () => ui;
export function onAuthUIChange(fn) { listeners.add(fn); }

function set(patch) {
  ui = { ...ui, ...patch };
  listeners.forEach(fn => fn(ui));
}

// Typing updates the values silently (no re-render, so the cursor never jumps).
export function rememberInput(id, value) {
  if (id === 'a-name') ui.name = value;
  else if (id === 'a-email') ui.email = value;
  else if (id === 'a-pw') ui.password = value;
}

// After sign-out: back to the login tab, keep the email for convenience.
export function resetAuthUI() { ui = { ...fresh(), email: ui.email }; }

export const showScreen = screen => set({ screen, error: '', info: '', password: '' });
export const togglePassword = () => set({ showPw: !ui.showPw });

export function errorMessage(err) {
  const map = t().errors;
  const code = (err && err.code) || err;
  if (!map[code]) log.warn('unmapped error', code, err);
  return map[code] || map.default;
}
export const showError = err => set({ error: errorMessage(err), busy: false });

export async function submitLogin() {
  const L = t();
  const signup = ui.screen === 'signup';
  const name = ui.name.trim(), email = ui.email.trim(), pw = ui.password;
  if (signup && !name) return set({ error: L.nameReq });
  if (!email) return set({ error: L.emailReq });
  if (!pw) return set({ error: L.pwReq });
  if (!fb.isLoaded()) return set({ error: L.errors['not-configured'] });
  set({ busy: true, error: '' });
  try {
    if (signup) await fb.signUp(name, email, pw);
    else await fb.signIn(email, pw);
    log.debug(signup ? 'account created' : 'signed in', email);
    set({ busy: false, password: '' });
  } catch (err) {
    showError(err);
  }
}

export async function submitReset() {
  const L = t();
  const email = ui.email.trim();
  if (!email) return set({ error: L.emailReq, info: '' });
  if (!fb.isLoaded()) return set({ error: L.errors['not-configured'] });
  set({ busy: true, error: '', info: '' });
  try {
    await fb.resetPassword(email);
    set({ busy: false, info: L.resetSent });
  } catch (err) {
    // Same message whether or not the account exists, so the form can't be used to look up emails.
    if (err && err.code === 'auth/user-not-found') set({ busy: false, info: L.resetSent });
    else showError(err);
  }
}

export async function google() {
  if (!fb.isLoaded()) return set({ error: t().errors['not-configured'] });
  set({ error: '' });
  try {
    await fb.signInWithGoogle();
  } catch (err) {
    const c = err && err.code;
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return;
    showError(err);
  }
}
