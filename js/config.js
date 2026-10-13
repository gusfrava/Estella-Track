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

// ─────────────────────────────────────────────────────────────
// Legal. Bump LEGAL_VERSION whenever privacy.html or terms.html change in a way people must accept again.
// ─────────────────────────────────────────────────────────────
export const LEGAL = {
  version: '2026-10-12',
  operator: 'TheFaroLab',
  contactEmail: 'info@estellatrack.app',
  minAge: 16,
  privacyUrl: 'legal/privacy.html',
  termsUrl: 'legal/terms.html',
};

// Password rules for email sign-up. Must match Firebase console → Authentication → Settings → Password policy.
// (Firebase enforces them; the app shows them as a live checklist so people know before they submit.)
export const PASSWORD_POLICY = { minLength: 8, uppercase: true, lowercase: false, number: true, special: true };
