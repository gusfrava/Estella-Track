// Device storage (localStorage). Every key the app uses is listed here.
// All reads/writes are wrapped so a blocked or full storage never crashes the app.

export const KEYS = {
  opening: 'estellatrack.opening.v1', // 'pending' while viewing the opening; 'done' after choosing a route
  local: 'estellatrack.v1',            // v1 data from before accounts existed (moved into the first account that signs in)
  lang: 'estellatrack.lang',           // 'es' | 'en'
  localMode: 'estellatrack.localmode', // '1' when using the app without an account
  migrated: 'estellatrack.migrated',   // uid that received the pre-account data (so it only moves once)
  debug: 'estellatrack.debug',         // '1' turns on debug logs
  user: uid => 'estellatrack.u.' + uid,       // v1 copy of a signed-in user's data (no longer written; removed on sign-out)
  userV2: uid => 'estellatrack.v2.u.' + uid,  // this device's copy of a signed-in user's data (v2)
  localV2: 'estellatrack.v2.local',           // data used without an account (v2)
};

export const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
export const lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };

export function readJSON(k) {
  try { const raw = lsGet(k); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
export const writeJSON = (k, v) => lsSet(k, JSON.stringify(v));
