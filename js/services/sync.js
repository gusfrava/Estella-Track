// Sync layer: connects the store to device storage and to the cloud.
// - Starts/ends a signed-in session (load data, migrate old local data, watch for changes from other devices).
// - Saves every store change to this device, and 'local' changes to the cloud (500 ms after the last change).
// - Local mode: no account, data only on this device.

import * as fb from './firebase.js';
import { KEYS, lsGet, lsSet, lsDel, readJSON, writeJSON } from './storage.js';
import { getState, loadState, clearState, subscribe } from '../state/store.js';
import { normalizeState } from '../state/model.js';
import { getSession, setSession } from '../state/session.js';
import { stable } from '../utils/data.js';
import { logger } from '../utils/log.js';

const log = logger('sync');
const SAVE_DELAY_MS = 500;

let cloudReady = false;   // false until we know what the server has (prevents an empty device overwriting cloud data)
let cloudTimer = null;
let unwatch = null;
let pendingRemote = null; // remote data that arrived while a form was open
let canApplyRemote = () => true;

// main.js tells us when it's safe to swap data under the user (not while a form is open).
export function setRemoteGate(fn) { canApplyRemote = fn; }

// ---------- saving ----------
function deviceKey() {
  const s = getSession();
  if (s.localMode) return KEYS.local;
  return s.user ? KEYS.user(s.user.uid) : null;
}

function saveToDevice() {
  const k = deviceKey();
  if (k) writeJSON(k, getState());
}

function scheduleCloudSave() {
  if (!cloudReady || !getSession().user) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(flushCloudSave, SAVE_DELAY_MS);
}

export async function flushCloudSave() {
  clearTimeout(cloudTimer);
  cloudTimer = null;
  const user = getSession().user;
  if (!user) return;
  try {
    await fb.saveUserState(user.uid, getState());
    log.debug('saved to cloud');
  } catch (err) {
    log.warn('cloud save failed', err);
  }
}

subscribe((state, { source }) => {
  const s = getSession();
  if (s.mode !== 'app') return;
  saveToDevice();
  if (source === 'local' && !s.localMode) scheduleCloudSave();
});

// ---------- signed-in session ----------
// Data saved on this device before accounts existed moves into the first account that signs in here.
function takePreAccountData(uid) {
  const legacy = readJSON(KEYS.local);
  const hasData = legacy && ((legacy.routines || []).length || (legacy.activities || []).length);
  if (!hasData || lsGet(KEYS.migrated)) return null;
  lsSet(KEYS.migrated, uid);
  log.debug('moving pre-account data into', uid);
  return legacy;
}

export async function startUserSession(user) {
  log.debug('session start', user.uid);
  cloudReady = false;
  const cached = readJSON(KEYS.user(user.uid));
  if (cached) {
    setSession({ user, localMode: false, mode: 'app' });
    loadState(cached, 'load');                  // instant start from this device's copy
  } else {
    setSession({ user, localMode: false, mode: 'loading' });
  }

  try {
    const remote = await fb.loadUserState(user.uid);
    if (getSession().user !== user) return;     // signed out meanwhile
    if (remote) {
      loadState(remote, 'remote');
    } else {
      loadState(takePreAccountData(user.uid) || cached || {}, 'load');
      cloudReady = true;
      await flushCloudSave();                    // create the user's document
    }
    cloudReady = true;
  } catch (err) {
    log.warn('could not load from cloud (offline?) — using this device’s copy', err);
    if (!cached) loadState({}, 'load');
  }

  if (getSession().user !== user) return;
  if (getSession().mode !== 'app') setSession({ mode: 'app' });
  saveToDevice();
  watch(user);
}

function watch(user) {
  if (unwatch) unwatch();
  unwatch = fb.watchUserState(user.uid, ({ exists, state, fromCache }) => {
    if (!exists) {
      if (!cloudReady && !fromCache) { cloudReady = true; flushCloudSave(); }
      return;
    }
    if (fromCache && !cloudReady) return;
    cloudReady = true;
    if (stable(normalizeState(state)) === stable(getState())) return;
    if (cloudTimer) { log.debug('remote change skipped: a local save is about to go out'); return; }
    if (!canApplyRemote()) { log.debug('remote change waiting for the form to close'); pendingRemote = state; return; }
    log.debug('applying change from another device');
    loadState(state, 'remote');
  }, err => log.warn('watch error', err));
}

export function flushPendingRemote() {
  if (!pendingRemote || !canApplyRemote() || cloudTimer) return;
  const s = pendingRemote;
  pendingRemote = null;
  loadState(s, 'remote');
}

export function endUserSession() {
  log.debug('session end');
  if (unwatch) { unwatch(); unwatch = null; }
  clearTimeout(cloudTimer); cloudTimer = null;
  cloudReady = false;
  pendingRemote = null;
  setSession({ user: null, localMode: false, mode: 'auth' });
  clearState();
}

export async function signOutUser() {
  const user = getSession().user;
  if (cloudTimer) await flushCloudSave();
  await fb.signOut();                          // triggers endUserSession via onAuthChange
  if (user) lsDel(KEYS.user(user.uid));         // don't leave someone's data on a shared phone
}

// ---------- local mode (no account) ----------
export const wantsLocalMode = () => lsGet(KEYS.localMode) === '1';

export function enterLocalMode() {
  log.debug('local mode on');
  lsSet(KEYS.localMode, '1');
  setSession({ localMode: true, user: null, mode: 'app' });
  loadState(readJSON(KEYS.local) || {}, 'load');
}

export function exitLocalMode() {
  log.debug('local mode off');
  lsDel(KEYS.localMode);
  setSession({ localMode: false, mode: 'auth' });
  clearState();
}
