// Firebase layer: the only file that talks to Firebase.
// Loads the SDK on demand, then exposes small functions for sign-in and for the user's data.
// Data lives in one Firestore document per user:  users/{uid}  →  { state, updatedAt }

import { FIREBASE_CONFIG, FIREBASE_SDK_VERSION } from '../config.js';
import { clone } from '../utils/data.js';
import { logger } from '../utils/log.js';

const log = logger('firebase');
let FB = null; // { auth, db, a: auth module, f: firestore module }

export async function loadFirebase(lang) {
  if (FB) return FB;
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
  const [appM, a, f] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-firestore.js`),
  ]);
  const app = appM.initializeApp(FIREBASE_CONFIG);
  const auth = a.getAuth(app);
  auth.languageCode = lang;
  let db;
  try {
    // Offline cache so the app works at the gym without signal.
    db = f.initializeFirestore(app, { localCache: f.persistentLocalCache({ tabManager: f.persistentMultipleTabManager() }) });
  } catch (e) {
    log.warn('offline cache unavailable, using default Firestore', e);
    db = f.getFirestore(app);
  }
  FB = { auth, db, a, f };
  log.debug('SDK loaded', FIREBASE_SDK_VERSION, 'project', FIREBASE_CONFIG.projectId);
  return FB;
}

export const isLoaded = () => !!FB;
export function setAuthLanguage(lang) { if (FB) FB.auth.languageCode = lang; }

// ---------- auth ----------
export const onAuthChange = cb => FB.a.onAuthStateChanged(FB.auth, cb);

export async function signIn(email, password) {
  await FB.a.signInWithEmailAndPassword(FB.auth, email, password);
}

export async function signUp(name, email, password) {
  const cred = await FB.a.createUserWithEmailAndPassword(FB.auth, email, password);
  await FB.a.updateProfile(cred.user, { displayName: name });
  try { await FB.a.sendEmailVerification(cred.user); } catch (e) { log.warn('verification email not sent', e); }
  return cred.user;
}

export async function resetPassword(email) {
  await FB.a.sendPasswordResetEmail(FB.auth, email);
}

export async function signInWithGoogle() {
  const provider = new FB.a.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await FB.a.signInWithPopup(FB.auth, provider);
  } catch (err) {
    if (err && err.code === 'auth/popup-blocked') {
      log.debug('popup blocked, using redirect');
      await FB.a.signInWithRedirect(FB.auth, provider);
      return;
    }
    throw err;
  }
}

// ---------- email verification ----------
// Signed in with email + password and hasn't clicked the link yet. (Google accounts are already verified.)
export function needsEmailVerification(user) {
  return !!user && !user.emailVerified && (user.providerData || []).some(p => p.providerId === 'password');
}
export const sendVerificationEmail = () => FB.a.sendEmailVerification(FB.auth.currentUser);
// Asks Firebase again whether the email is verified now. Returns the fresh value.
export async function refreshUser() {
  await FB.a.reload(FB.auth.currentUser);
  return FB.auth.currentUser;
}

// ---------- re-authentication (needed right before deleting an account) ----------
export const signInMethod = user => ((user.providerData || []).some(p => p.providerId === 'password') ? 'password' : 'google');
export async function reauthenticate(user, password) {
  if (signInMethod(user) === 'password') {
    await FB.a.reauthenticateWithCredential(user, FB.a.EmailAuthProvider.credential(user.email, password));
  } else {
    await FB.a.reauthenticateWithPopup(user, new FB.a.GoogleAuthProvider());
  }
}
export const deleteAuthUser = user => FB.a.deleteUser(user);

export const consumeRedirectResult = () => FB.a.getRedirectResult(FB.auth);
export const signOut = () => FB.a.signOut(FB.auth);

// ---------- user data (v2: one document per routine / session / exercise history) ----------
// Firestore collection names for the store's collections.
export const COLLECTIONS = { routines: 'routines', sessions: 'sessions', stats: 'exerciseStats', body: 'body' };
const MAX_BATCH = 450;   // Firestore allows 500 writes per batch

const userDoc = uid => FB.f.doc(FB.db, 'users', uid);
const subDoc = (uid, col, id) => FB.f.doc(FB.db, 'users', uid, COLLECTIONS[col], id);

// Calls cb({ exists, data, fromCache }) whenever users/{uid} changes. Returns an unsubscribe function.
export function watchProfile(uid, cb, onError) {
  return FB.f.onSnapshot(userDoc(uid), { includeMetadataChanges: true }, snap => {
    cb({ exists: snap.exists(), data: snap.exists() ? snap.data() : null, fromCache: snap.metadata.fromCache });
  }, onError);
}

// Calls cb({ docs: { id: data }, fromCache }) with the full contents of a collection (or of `since` onwards for sessions).
export function watchCollection(uid, col, cb, onError, { sinceDate } = {}) {
  let ref = FB.f.collection(FB.db, 'users', uid, COLLECTIONS[col]);
  if (sinceDate) ref = FB.f.query(ref, FB.f.where('date', '>=', sinceDate));
  return FB.f.onSnapshot(ref, snap => {
    const docs = {};
    snap.docs.forEach(d => { docs[d.id] = d.data(); });
    cb({ docs, fromCache: snap.metadata.fromCache });
  }, onError);
}

export async function getSubDoc(uid, col, id) {
  const snap = await FB.f.getDoc(subDoc(uid, col, id));
  return snap.exists() ? snap.data() : null;
}

// Applies the store's writes: [{ op: 'set'|'delete', col, id, data }] and { op: 'profile', data } (merged into users/{uid}).
// Split into batches of up to 450. Resolves when Firestore accepted them (or queued them while offline).
export async function applyWrites(uid, writes) {
  for (let i = 0; i < writes.length; i += MAX_BATCH) {
    const batch = FB.f.writeBatch(FB.db);
    for (const w of writes.slice(i, i + MAX_BATCH)) {
      if (w.op === 'profile') batch.set(userDoc(uid), clone(w.data), { merge: true });
      else if (w.op === 'delete') batch.delete(subDoc(uid, w.col, w.id));
      else batch.set(subDoc(uid, w.col, w.id), clone(w.data));
    }
    await batch.commit();
  }
}

// ---------- usernames ----------
// usernames/{name} → { uid, createdAt }. One document per taken name is what makes names unique.

// The uid that owns this username, or null if it's free.
export async function usernameOwner(name) {
  const snap = await FB.f.getDoc(FB.f.doc(FB.db, 'usernames', name));
  return snap.exists() ? snap.data().uid : null;
}

// Takes a username (and frees the previous one) in one atomic step together with the profile.
// Firestore rules reject it if the name is already someone else's.
export async function claimUsername(uid, { username, displayName, previous }) {
  const batch = FB.f.writeBatch(FB.db);
  if (username !== previous) batch.set(FB.f.doc(FB.db, 'usernames', username), { uid, createdAt: Date.now() });
  batch.set(userDoc(uid), { username, displayName }, { merge: true });
  if (previous && previous !== username) batch.delete(FB.f.doc(FB.db, 'usernames', previous));
  await batch.commit();
}

// ---------- friends ----------
// directory/{uid}               { username, displayName, nameKey, lastKey, character, updatedAt }  — only while "Aparecer en
//                               búsquedas" is on. What anyone signed in can see in search: name, @username, character.
// friendRequests/{from}_{to}    { from, to, fromUsername, fromName, toUsername, toName, status: 'pending'|'accepted', createdAt }
// users/{uid}/friends/{friendUid}  { since, username, displayName }  — written for both people when a request is accepted.
// The rules (firestore.rules) check each step; see docs/DATA-MODEL.md → Friends.
const SEARCH_LIMIT = 10;
const dirDoc = uid => FB.f.doc(FB.db, 'directory', uid);
const reqDoc = id => FB.f.doc(FB.db, 'friendRequests', id);
const friendDoc = (uid, fid) => FB.f.doc(FB.db, 'users', uid, 'friends', fid);
export const requestId = (from, to) => `${from}_${to}`;

// entry = { username, displayName, nameKey, character } or null to leave the directory.
export async function setDirectoryEntry(uid, entry) {
  if (entry) await FB.f.setDoc(dirDoc(uid), { ...entry, updatedAt: Date.now() });
  else await FB.f.deleteDoc(dirDoc(uid));
}

export async function getDirectoryEntry(uid) {
  const snap = await FB.f.getDoc(dirDoc(uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

// Usernames, names and last names (name from its second word) that start with what was typed
// (already lowercase, no accents). Up to 10 of each.
export async function searchDirectory(usernamePrefix, namePrefix) {
  const col = FB.f.collection(FB.db, 'directory');
  const byField = (field, v) => FB.f.getDocs(FB.f.query(col, FB.f.where(field, '>=', v), FB.f.where(field, '<', v + '\uf8ff'),
    FB.f.orderBy(field), FB.f.limit(SEARCH_LIMIT)));
  const snaps = await Promise.all([usernamePrefix ? byField('username', usernamePrefix) : null,
    namePrefix ? byField('nameKey', namePrefix) : null, namePrefix ? byField('lastKey', namePrefix) : null]);
  const out = new Map();
  for (const snap of snaps) if (snap) snap.docs.forEach(d => out.set(d.id, { uid: d.id, ...d.data() }));
  return [...out.values()];
}

// Requests sent by me and to me, and my friends. cb gets the full lists each time something changes.
export function watchRequests(uid, cb, onError) {
  const col = FB.f.collection(FB.db, 'friendRequests');
  const lists = { incoming: null, outgoing: null };
  const emit = () => { if (lists.incoming && lists.outgoing) cb({ incoming: lists.incoming, outgoing: lists.outgoing }); };
  const read = key => snap => { lists[key] = snap.docs.map(d => ({ id: d.id, ...d.data() })); emit(); };
  const u1 = FB.f.onSnapshot(FB.f.query(col, FB.f.where('to', '==', uid)), read('incoming'), onError);
  const u2 = FB.f.onSnapshot(FB.f.query(col, FB.f.where('from', '==', uid)), read('outgoing'), onError);
  return () => { u1(); u2(); };
}

export function watchFriends(uid, cb, onError) {
  return FB.f.onSnapshot(FB.f.collection(FB.db, 'users', uid, 'friends'), snap => {
    const friends = {};
    snap.docs.forEach(d => { friends[d.id] = d.data(); });
    cb(friends);
  }, onError);
}

// me / them = { uid, username, displayName }
export async function sendFriendRequest(me, them) {
  await FB.f.setDoc(reqDoc(requestId(me.uid, them.uid)), {
    from: me.uid, to: them.uid, fromUsername: me.username, fromName: me.displayName || '',
    toUsername: them.username, toName: them.displayName || '', status: 'pending', createdAt: Date.now(),
  });
}

// Cancel (sender) or decline (receiver): the request is simply removed.
export const deleteFriendRequest = id => FB.f.deleteDoc(reqDoc(id));

// Accepting: the request turns 'accepted' and both people get each other in their friends list (one batch).
export async function acceptFriendRequest(me, req) {
  const batch = FB.f.writeBatch(FB.db);
  const since = Date.now();
  batch.update(reqDoc(req.id), { status: 'accepted', respondedAt: since });
  batch.set(friendDoc(me.uid, req.from), { since, username: req.fromUsername, displayName: req.fromName || '' });
  batch.set(friendDoc(req.from, me.uid), { since, username: me.username, displayName: me.displayName || '' });
  await batch.commit();
}

// Removing a friend clears it on both sides, plus any request between the two (requestIds = the ones that exist).
export async function removeFriend(myUid, theirUid, requestIds = []) {
  const batch = FB.f.writeBatch(FB.db);
  batch.delete(friendDoc(myUid, theirUid));
  batch.delete(friendDoc(theirUid, myUid));
  requestIds.forEach(id => batch.delete(reqDoc(id)));
  await batch.commit();
}

// ---------- your data: export and delete ----------
// Every collection under users/{uid} that holds the person's data.
const USER_SUBCOLLECTIONS = ['routines', 'sessions', 'exerciseStats', 'body', 'customExercises', 'friends'];

async function readCollection(uid, name) {
  const snap = await FB.f.getDocs(FB.f.collection(FB.db, 'users', uid, name));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Everything stored about this person, as one plain object (for "Download my data").
export async function exportUserData(user) {
  const profileSnap = await FB.f.getDoc(userDoc(user.uid));
  const out = {
    exportedAt: new Date().toISOString(),
    account: {
      uid: user.uid, email: user.email, emailVerified: !!user.emailVerified,
      signInMethods: (user.providerData || []).map(p => p.providerId),
      createdAt: user.metadata && user.metadata.creationTime, lastSignIn: user.metadata && user.metadata.lastSignInTime,
    },
    profile: profileSnap.exists() ? profileSnap.data() : null,
  };
  for (const name of USER_SUBCOLLECTIONS) out[name] = await readCollection(user.uid, name);
  const reqs = FB.f.collection(FB.db, 'friendRequests');
  out.friendRequests = [];
  for (const field of ['from', 'to']) {
    (await FB.f.getDocs(FB.f.query(reqs, FB.f.where(field, '==', user.uid)))).docs.forEach(d => out.friendRequests.push({ id: d.id, ...d.data() }));
  }
  const dir = await FB.f.getDoc(dirDoc(user.uid));
  out.directory = dir.exists() ? dir.data() : null;
  return out;
}

// Deletes every document of this person (their data, their username, their profile). Auth account is separate.
export async function deleteUserData(user) {
  const uid = user.uid;
  const refs = [];
  for (const name of USER_SUBCOLLECTIONS) {
    const snap = await FB.f.getDocs(FB.f.collection(FB.db, 'users', uid, name));
    snap.docs.forEach(d => refs.push(FB.f.doc(FB.db, 'users', uid, name, d.id)));
  }
  // Friends: remove me from each friend's list, and every friend request to or from me; leave the directory.
  for (const d of (await FB.f.getDocs(FB.f.collection(FB.db, 'users', uid, 'friends'))).docs) refs.push(friendDoc(d.id, uid));
  const reqs = FB.f.collection(FB.db, 'friendRequests');
  for (const field of ['from', 'to']) {
    (await FB.f.getDocs(FB.f.query(reqs, FB.f.where(field, '==', uid)))).docs.forEach(d => refs.push(reqDoc(d.id)));
  }
  if ((await FB.f.getDoc(dirDoc(uid))).exists()) refs.push(dirDoc(uid));
  const profileSnap = await FB.f.getDoc(userDoc(uid));
  const username = profileSnap.exists() ? profileSnap.data().username : null;
  // Data first, in batches; the profile and the username go together in the very last batch.
  for (let i = 0; i < refs.length; i += MAX_BATCH) {
    const batch = FB.f.writeBatch(FB.db);
    refs.slice(i, i + MAX_BATCH).forEach(r => batch.delete(r));
    await batch.commit();
  }
  const last = FB.f.writeBatch(FB.db);
  last.delete(userDoc(uid));
  if (username) last.delete(FB.f.doc(FB.db, 'usernames', username));
  await last.commit();
  log.debug('deleted', refs.length, 'documents + profile');
}
