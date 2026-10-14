// Sync layer: connects the store to Firestore and to this device's storage.
//
// Signed in:
//   - Listens to users/{uid} and its routines, sessions (last 120 days), exerciseStats and body; every change lands in the store.
//   - Every 'local' store change sends its document writes to Firestore (works offline: Firestore queues them).
//   - Keeps a copy on the device so the app opens instantly next time.
//   - First time on v2: moves the v1 data (account backup or pre-account device data) into the new structure.
// Local mode (no account, only while Firebase isn't configured): everything lives on the device.

import * as fb from './firebase.js';
import { KEYS, lsGet, lsSet, lsDel, readJSON, writeJSON } from './storage.js';
import { convertV1, hasV1Data, writesFor } from './migrate.js';
import {
  getState, loadState, clearState, subscribe, applyRemoteCollection, applyRemoteDoc, applyRemoteProfile,
} from '../state/store.js';
import { SCHEMA_VERSION, DEFAULT_SHARING } from '../state/model.js';
import { getSession, setSession } from '../state/session.js';
import { setFriends, setRequests, clearSocial, setCard, dropCard, setCheers } from '../state/social.js';
import { setWallet, clearWallet } from '../state/rewards.js';
import { daysAgo } from '../utils/dates.js';
import { logger } from '../utils/log.js';

const log = logger('sync');
const SESSION_WINDOW_DAYS = 120;   // sessions kept live in memory; older ones load on demand
const LOADING_TIMEOUT_MS = 10000;  // offline on a brand-new device: show the app anyway after this

let unsubs = [];
let migrating = false;
let requested = new Set();         // current sessions fetched individually (older than the window)
let saveTimer = null;

// ---------- saving ----------
function deviceKey() {
  const s = getSession();
  if (s.localMode) return KEYS.localV2;
  return s.user ? KEYS.userV2(s.user.uid) : null;
}

function saveToDeviceSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const k = deviceKey();
    if (k) writeJSON(k, getState());
  }, 300);
}

subscribe((state, { source, writes }) => {
  const s = getSession();
  if (source === 'reset' || (!s.user && !s.localMode)) return;
  saveToDeviceSoon();
  if (source === 'local' && s.user && writes.length) {
    fb.applyWrites(s.user.uid, writes).then(
      () => log.debug('saved', writes.length, 'doc(s)'),
      err => log.warn('save failed', err)
    );
  }
});

// ---------- signed-in session ----------
export function startUserSession(user) {
  log.debug('session start', user.uid);
  stopListeners();
  migrating = false;
  requested = new Set();

  const cached = readJSON(KEYS.userV2(user.uid));
  setSession({ user, localMode: false, mode: cached ? 'app' : 'loading', synced: { routines: false, sessions: false } });
  if (cached) loadState(cached, 'load');            // instant start from this device's copy

  listen(user);
  setTimeout(() => {
    const s = getSession();
    if (s.user === user && s.mode === 'loading') { log.warn('still no answer from the server — showing the app'); setSession({ mode: 'app' }); }
  }, LOADING_TIMEOUT_MS);
}

function listen(user) {
  const uid = user.uid;
  const mine = () => getSession().user === user;
  const onErr = what => err => log.warn(`${what} listener error`, err);

  unsubs.push(fb.watchProfile(uid, ({ exists, data, fromCache }) => {
    if (!mine()) return;
    if (exists && data.schemaVersion >= SCHEMA_VERSION) {
      applyRemoteProfile(data);
      if (getSession().mode !== 'app') setSession({ mode: 'app' });
      return;
    }
    if (fromCache || migrating) return;              // decide only on the server's answer, and only once
    migrating = true;
    migrate(user, exists ? data : null).catch(err => { log.error('migration failed — will retry on next open', err); migrating = false; });
  }, onErr('profile')));

  // synced.<col> = the server has answered at least once (onboarding waits for it: an empty list from this
  // device's cache doesn't mean the account is new).
  const synced = col => { const s = getSession().synced || {}; if (!s[col]) setSession({ synced: { ...s, [col]: true } }); };

  unsubs.push(fb.watchCollection(uid, 'routines', ({ docs, fromCache }) => {
    if (mine() && !fromCache) synced('routines');
    if (!mine() || (fromCache && !Object.keys(docs).length)) return;
    applyRemoteCollection('routines', docs);
    fetchMissingCurrentSessions(user);
  }, onErr('routines')));

  const since = daysAgo(SESSION_WINDOW_DAYS);
  unsubs.push(fb.watchCollection(uid, 'sessions', ({ docs, fromCache }) => {
    if (mine() && !fromCache) synced('sessions');
    if (!mine() || (fromCache && !Object.keys(docs).length)) return;
    applyRemoteCollection('sessions', docs, s => s.date >= since && !requested.has(s.id));
  }, onErr('sessions'), { sinceDate: since }));

  unsubs.push(fb.watchCollection(uid, 'stats', ({ docs, fromCache }) => {
    if (!mine() || (fromCache && !Object.keys(docs).length)) return;
    applyRemoteCollection('stats', docs);
  }, onErr('exerciseStats')));

  unsubs.push(fb.watchCollection(uid, 'body', ({ docs, fromCache }) => {
    if (!mine() || (fromCache && !Object.keys(docs).length)) return;
    applyRemoteCollection('body', docs);
  }, onErr('body')));

  // Friends and friend requests (state/social.js, not part of the training data).
  unsubs.push(fb.watchFriends(uid, friends => { if (mine()) { setFriends(friends); watchFriendCards(friends, mine); } }, onErr('friends')));
  unsubs.push(() => watchFriendCards({}, mine));
  // My own card: if the server hasn't built it yet (or it's from an older version), ask for it once.
  // (Checked again when the profile loads: no username yet = the server builds it once the username is set.)
  let myCard = null, askedForCard = false;
  const askForCard = () => {
    const outdated = myCard && (myCard.state === 'none' || (myCard.state === 'ok' && myCard.card.v !== fb.CARD_VERSION));
    const p = getState().profile;
    if (!mine() || !outdated || askedForCard || !p || !p.username) return;
    askedForCard = true;
    fb.requestCardRefresh(uid).then(() => log.debug('asked for my friend card'), err => log.warn('card refresh request failed', err));
  };
  unsubs.push(fb.watchCard(uid, e => { myCard = e; askForCard(); }));
  unsubs.push(subscribe(askForCard));
  unsubs.push(fb.watchRequests(uid, lists => { if (mine()) setRequests(lists); }, onErr('friendRequests')));
  // Points and badges (the server writes them; we only listen).
  unsubs.push(fb.watchWallet(uid, w => { if (mine()) setWallet(w); }, onErr('wallet')));

  // Cheers I received. If the listener fails (e.g. the database index is still being built right after a deploy),
  // try again a minute later instead of staying empty until the app is reopened.
  let offCheers = null, cheersRetry = null;
  const startCheers = () => {
    offCheers = fb.watchCheersToMe(uid, list => { if (mine()) setCheers(list); }, err => {
      log.warn('cheers listener error, retrying in 60 s', err);
      if (mine()) cheersRetry = setTimeout(startCheers, 60000);
    });
  };
  startCheers();
  unsubs.push(() => { clearTimeout(cheersRetry); if (offCheers) offCheers(); });
}

// One listener per friend's card (profileCards/{uid}); added and removed as the friends list changes.
const cardUnsubs = new Map();
function watchFriendCards(friends, mine) {
  for (const uid of Object.keys(friends)) {
    if (cardUnsubs.has(uid)) continue;
    cardUnsubs.set(uid, fb.watchCard(uid, entry => { if (mine()) setCard(uid, entry); }));
  }
  for (const [uid, off] of cardUnsubs) {
    if (friends[uid]) continue;
    try { off(); } catch (e) { /* already closed */ }
    cardUnsubs.delete(uid);
    dropCard(uid);
  }
}

// A routine that doesn't repeat can point at a session older than the 120-day window: load it on its own.
function fetchMissingCurrentSessions(user) {
  const { routines, sessions } = getState();
  for (const r of Object.values(routines)) {
    const id = r.current && r.current.sessionId;
    if (!id || sessions[id] || requested.has(id)) continue;
    requested.add(id);
    fb.getSubDoc(user.uid, 'sessions', id).then(
      data => { if (getSession().user === user && data) applyRemoteDoc('sessions', id, data); },
      err => { requested.delete(id); log.warn('could not load session', id, err); }
    );
  }
}

// ---------- v1 → v2 ----------
// Data saved on this device before accounts existed moves into the first account that signs in here (only once).
function takePreAccountData(uid) {
  const legacy = readJSON(KEYS.local);
  if (!hasV1Data(legacy) || lsGet(KEYS.migrated)) return null;
  lsSet(KEYS.migrated, uid);
  return legacy;
}

async function migrate(user, profileData) {
  let v1 = profileData && profileData.state;
  let from = hasV1Data(v1) ? 'account' : null;
  if (!from) {
    const local = takePreAccountData(user.uid);
    if (local) { v1 = local; from = 'device'; }
  }
  const v2 = convertV1(from ? v1 : null);
  log.debug('migrating to v2 from', from || 'nothing (new account)', {
    routines: Object.keys(v2.routines).length, sessions: Object.keys(v2.sessions).length, stats: Object.keys(v2.stats).length,
  });
  loadState(v2, 'load');                              // show it right away
  const writes = writesFor(v2);
  // The profile goes last: if anything above fails, the next open simply runs the migration again (same ids).
  // The v1 `state` field is left untouched as a backup.
  writes.push({ op: 'profile', data: {
    schemaVersion: SCHEMA_VERSION,
    displayName: user.displayName || '',
    sharing: DEFAULT_SHARING,
    createdAt: (profileData && profileData.createdAt) || Date.now(),
    migratedAt: Date.now(),
    migratedFrom: from,
  } });
  await fb.applyWrites(user.uid, writes);
  log.debug('migration saved');
}

// ---------- ending ----------
function stopListeners() {
  unsubs.forEach(u => { try { u(); } catch (e) {} });
  unsubs = [];
  clearSocial();
  clearWallet();
}

// Account deletion: stop listening so the profile listener doesn't recreate the account while it's being deleted.
export function stopSyncForDeletion() {
  stopListeners();
  clearTimeout(saveTimer);
  migrating = true;   // blocks any migration from starting
}

export function endUserSession() {
  log.debug('session end');
  stopListeners();
  clearTimeout(saveTimer);
  migrating = false;
  setSession({ user: null, localMode: false, mode: 'auth' });
  clearState();
}

export async function signOutUser() {
  const user = getSession().user;
  await fb.flushWrites();                             // last changes to the server first (waits at most 3 s)
  await fb.signOut();                                 // triggers endUserSession via onAuthChange
  if (user) { lsDel(KEYS.userV2(user.uid)); lsDel(KEYS.user(user.uid)); }   // don't leave someone's data on a shared phone
  // Also erase Firestore's offline copy on this phone, then start fresh (Firestore can't be reused after that).
  if (await fb.clearOfflineCache()) location.reload();
}

// ---------- local mode (no account) ----------
export const wantsLocalMode = () => lsGet(KEYS.localMode) === '1';

export function enterLocalMode() {
  log.debug('local mode on');
  lsSet(KEYS.localMode, '1');
  setSession({ localMode: true, user: null, mode: 'app' });
  let data = readJSON(KEYS.localV2);
  if (!data) {
    const v1 = readJSON(KEYS.local);
    data = hasV1Data(v1) ? convertV1(v1) : {};
  }
  loadState(data, 'load');
}

export function exitLocalMode() {
  log.debug('local mode off');
  lsDel(KEYS.localMode);
  setSession({ localMode: false, mode: 'auth' });
  clearState();
}
