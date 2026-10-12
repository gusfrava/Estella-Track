// ─────────────────────────────────────────────────────────────
// App configuration. This is the ONLY file you edit to connect Firebase.
// Firebase console → Project settings → Your apps → Web app → SDK setup → Config
// These values are public by design; the data is protected by firestore.rules.
// ─────────────────────────────────────────────────────────────

export const FIREBASE_CONFIG = {
  apiKey: "PEGA_AQUI_TU_API_KEY",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Firebase JS SDK version loaded from Google's CDN (www.gstatic.com/firebasejs/...).
export const FIREBASE_SDK_VERSION = '10.12.2';

export function isFirebaseConfigured() {
  const c = FIREBASE_CONFIG;
  return !!(c.apiKey && !/PEGA_AQUI/.test(c.apiKey) && c.projectId);
}
