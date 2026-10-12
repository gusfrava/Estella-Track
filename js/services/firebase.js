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

// ---------- user data ----------
const userDoc = uid => FB.f.doc(FB.db, 'users', uid);

// Returns the saved state, or null if this user has never saved anything.
export async function loadUserState(uid) {
  const snap = await FB.f.getDoc(userDoc(uid));
  const data = snap.exists() ? snap.data() : null;
  return data && data.state ? data.state : null;
}

export function saveUserState(uid, state) {
  return FB.f.setDoc(userDoc(uid), { state: clone(state), updatedAt: FB.f.serverTimestamp() });
}

// Calls onData({ exists, state, fromCache }) whenever the document changes on the server
// (e.g. edited from another phone). Our own unsent writes are skipped. Returns an unsubscribe function.
export function watchUserState(uid, onData, onError) {
  return FB.f.onSnapshot(userDoc(uid), snap => {
    if (snap.metadata.hasPendingWrites) return;
    const data = snap.exists() ? snap.data() : null;
    onData({ exists: !!(data && data.state), state: data ? data.state : null, fromCache: snap.metadata.fromCache });
  }, onError);
}
