// ─────────────────────────────────────────────────────────────
// App configuration. This is the ONLY file you edit to connect Firebase.
// Firebase console → Project settings → Your apps → Web app → SDK setup → Config
// These values are public by design; the data is protected by firestore.rules.
// ─────────────────────────────────────────────────────────────

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB93EDnh5-wCgxP2BuBPy7W1Rl5wWHEi8k",
  authDomain: "estella-track---official.firebaseapp.com",
  projectId: "estella-track---official",
  storageBucket: "estella-track---official.firebasestorage.app",
  messagingSenderId: "436604220343",
  appId: "1:436604220343:web:5bf769d570eb99b867ae32",
  measurementId: "G-QVXZ3L6ZTS"
};

// Firebase JS SDK version loaded from Google's CDN (www.gstatic.com/firebasejs/...).
export const FIREBASE_SDK_VERSION = '10.12.2';

export function isFirebaseConfigured() {
  const c = FIREBASE_CONFIG;
  return !!(c.apiKey && !/PEGA_AQUI/.test(c.apiKey) && c.projectId);
}
