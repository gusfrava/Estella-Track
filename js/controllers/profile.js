// Name + username form logic. Used by the one-time "choose your username" screen and by the "Edit profile" sheet
// (only one of them is on screen at a time; both use the same form ids: f-username, u-display, u-name, u-status).
import * as fb from '../services/firebase.js';
import { getSession } from '../state/session.js';
import { getState } from '../state/store.js';
import { t } from '../i18n/index.js';
import { cleanUsername, usernameProblem, suggestUsername } from '../utils/username.js';
import { logger } from '../utils/log.js';

const log = logger('profile');
const CHECK_DELAY_MS = 400;
const SAVE_TIMEOUT_MS = 12000;

// status: 'idle' | 'checking' | 'available' | 'mine' | 'taken' | 'invalid' | 'reserved'
let ui = null;
let checkTimer = null, checkSeq = 0;
const listeners = new Set();

export const getProfileForm = () => ui;
// kind: 'status' (only the status line / button changed) | 'all' (re-render the form)
export function onProfileFormChange(fn) { listeners.add(fn); }
function changed(kind) { listeners.forEach(fn => fn(ui, kind)); }

// Prepares the form from the current profile. editing = true for the "Edit profile" sheet.
export function startProfileForm(editing = false) {
  const p = getState().profile || {};
  const user = getSession().user;
  const displayName = p.displayName || (user && user.displayName) || '';
  const current = p.username || '';
  ui = { editing, previous: current, displayName, username: current || suggestUsername(displayName), status: 'idle', error: '', busy: false };
  scheduleCheck(0);
  return ui;
}

export const ensureProfileForm = () => ui || startProfileForm(false);
export function resetProfileForm() { ui = null; clearTimeout(checkTimer); }

// Called on every keystroke (no full re-render, so the cursor never jumps).
export function onProfileInput(id, value, inputEl) {
  if (!ui) return;
  if (id === 'u-display') ui.displayName = value;
  if (id === 'u-name') {
    const clean = cleanUsername(value);
    if (inputEl && inputEl.value !== clean) inputEl.value = clean;
    if (clean !== ui.username) { ui.username = clean; ui.error = ''; scheduleCheck(CHECK_DELAY_MS); }
  }
}

function scheduleCheck(delay) {
  clearTimeout(checkTimer);
  const name = ui.username;
  const problem = usernameProblem(name);
  if (problem) { ui.status = problem === 'reserved' ? 'reserved' : (name ? 'invalid' : 'idle'); changed('status'); return; }
  if (name === ui.previous) { ui.status = 'mine'; changed('status'); return; }
  ui.status = 'checking'; changed('status');
  const seq = ++checkSeq;
  checkTimer = setTimeout(async () => {
    try {
      const owner = await fb.usernameOwner(name);
      if (seq !== checkSeq || !ui) return;
      const me = getSession().user;
      ui.status = !owner ? 'available' : (me && owner === me.uid ? 'mine' : 'taken');
    } catch (err) {
      if (seq !== checkSeq || !ui) return;
      log.warn('availability check failed', err);
      ui.status = 'idle';
    }
    changed('status');
  }, delay);
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'timeout' })), ms))]);

// Saves name + username. Resolves true when saved.
export async function submitProfileForm() {
  if (!ui || ui.busy) return false;
  const L = t();
  const user = getSession().user;
  const displayName = ui.displayName.trim();
  const username = ui.username;
  if (!displayName) { ui.error = L.nameReq; changed('status'); return false; }
  const problem = usernameProblem(username);
  if (problem) { ui.error = problem === 'reserved' ? L.uReserved : L.uInvalid; changed('status'); return false; }
  if (ui.status === 'taken') { ui.error = L.uTaken; changed('status'); return false; }
  if (!navigator.onLine) { ui.error = L.uOffline; changed('status'); return false; }

  ui.busy = true; ui.error = ''; changed('status');
  try {
    await withTimeout(fb.claimUsername(user.uid, { username, displayName, previous: ui.previous || null }), SAVE_TIMEOUT_MS);
    log.debug('username saved', username);
    ui.busy = false;
    ui.previous = username;
    ui.status = 'mine';
    changed('status');
    return true;
  } catch (err) {
    log.warn('username save failed', err);
    ui.busy = false;
    ui.error = err && err.code === 'permission-denied' ? L.uTaken : err && err.code === 'timeout' ? L.uOffline : L.errors.default;
    if (err && err.code === 'permission-denied') ui.status = 'taken';
    changed('status');
    return false;
  }
}
