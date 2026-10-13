// Account controls: accepting the privacy policy/terms, email verification, data export, account deletion.
import * as fb from '../services/firebase.js';
import * as sync from '../services/sync.js';
import { KEYS, lsGet, lsDel } from '../services/storage.js';
import { LEGAL } from '../config.js';
import { getSession, setSession } from '../state/session.js';
import { getState, updateProfile } from '../state/store.js';
import { ymd } from '../utils/dates.js';
import { logger } from '../utils/log.js';

const log = logger('account');

// ---------- privacy policy & terms ----------
export function hasCurrentConsent(profile) {
  return !!(profile && profile.legal && profile.legal.version === LEGAL.version);
}

export function acceptLegal() {
  updateProfile({ legal: { version: LEGAL.version, acceptedAt: Date.now(), minAgeConfirmed: LEGAL.minAge } });
}

// Ticked "I'm 16+ and accept…" while creating an account → recorded as soon as the new profile exists.
let pendingConsent = false;
export const setPendingConsent = v => { pendingConsent = !!v; };
export function recordPendingConsent() {
  const p = getState().profile;
  if (!pendingConsent || !getSession().user || !p || hasCurrentConsent(p)) return;
  pendingConsent = false;
  log.debug('recording consent given at sign-up');
  acceptLegal();
}

// ---------- email verification ----------
// ui.verify = { sent: bool, error: string } — shown in the banner on the home screen.
let verify = { sent: false, error: '', checking: false };
const listeners = new Set();
export const getVerifyUI = () => verify;
export function onVerifyChange(fn) { listeners.add(fn); }
function setVerify(patch) { verify = { ...verify, ...patch }; listeners.forEach(fn => fn(verify)); }
export const resetVerifyUI = () => { verify = { sent: false, error: '', checking: false }; };

export const needsVerification = () => fb.isLoaded() && fb.needsEmailVerification(getSession().user);

export async function resendVerification() {
  try { await fb.sendVerificationEmail(); setVerify({ sent: true, error: '' }); }
  catch (err) { log.warn('resend failed', err); setVerify({ error: err && err.code === 'auth/too-many-requests' ? 'tooMany' : 'failed' }); }
}

export async function checkVerified() {
  setVerify({ checking: true, error: '' });
  try {
    const user = await fb.refreshUser();
    setSession({ user });                         // re-render with the fresh emailVerified value
    setVerify({ checking: false, error: user.emailVerified ? '' : 'notYet' });
  } catch (err) { log.warn('reload failed', err); setVerify({ checking: false, error: 'failed' }); }
}

// ---------- download my data ----------
// Phones (especially the iPhone home-screen app) can't do normal downloads, so there we use the share sheet
// ("Guardar en Archivos", AirDrop, WhatsApp…). The share sheet only opens straight from a tap, so it's two steps:
// prepareMyData() fetches everything, then saveMyData(file) runs from a second tap.
const isTouchDevice = () => window.matchMedia && matchMedia('(pointer: coarse)').matches;

export function usesShareSheet(file) {
  try { return isTouchDevice() && !!navigator.canShare && navigator.canShare({ files: [file] }); } catch (e) { return false; }
}

export async function prepareMyData() {
  const data = await fb.exportUserData(getSession().user);
  const name = `estella-mis-datos-${ymd(new Date())}.json`;
  log.debug('export ready', Object.keys(data));
  return new File([JSON.stringify(data, null, 2)], name, { type: 'application/json' });
}

// Returns 'shared' | 'downloaded' | 'cancelled'. Must be called directly from a tap.
export async function saveMyData(file) {
  if (usesShareSheet(file)) {
    try { await navigator.share({ files: [file], title: file.name }); return 'shared'; }
    catch (err) { if (err && err.name === 'AbortError') return 'cancelled'; log.warn('share failed, trying download', err); }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'downloaded';
}

// ---------- delete account ----------
// 1) confirm identity (password or Google)  2) stop syncing  3) delete all documents  4) delete the sign-in account
// 5) clear this device. Throws Firebase errors from step 1 so the sheet can show them.
export async function deleteAccount({ password }) {
  const user = getSession().user;
  await fb.reauthenticate(user, password);
  log.debug('re-authenticated, deleting data');
  sync.stopSyncForDeletion();
  await fb.deleteUserData(user);
  await fb.deleteAuthUser(user);                  // triggers sign-out → endUserSession
  lsDel(KEYS.userV2(user.uid));
  lsDel(KEYS.user(user.uid));
  if (lsGet(KEYS.migrated) === user.uid) { lsDel(KEYS.local); lsDel(KEYS.migrated); }
  log.debug('account deleted');
}
