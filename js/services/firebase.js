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

export const consumeRedirectResult = () => FB.a.getRedirectResult(FB.auth);
export const signOut = () => FB.a.signOut(FB.auth);

// ---------- user data (v2: one document per routine / session / exercise history) ----------
// Firestore collection names for the store's collections.
export const COLLECTIONS = { routines: 'routines', sessions: 'sessions', stats: 'exerciseStats' };
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
