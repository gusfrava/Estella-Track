// Who is using the app and which top-level screen to show.
//   mode: 'loading' (splash) | 'auth' (sign-in screens) | 'app' (routines)
//   user: the Firebase user, or null
//   localMode: true when using the app without an account (only while Firebase isn't configured)
//   fatal: i18n key of a blocking error shown on the sign-in screen (e.g. 'loadFailed')
//   synced: { routines, sessions } – true once Firestore's server (not this device's cache) has answered
import { logger } from '../utils/log.js';

const log = logger('session');
let session = { mode: 'loading', user: null, localMode: false, fatal: '', synced: {} };
const listeners = new Set();

export const getSession = () => session;

export function setSession(patch) {
  const prev = session;
  session = { ...session, ...patch };
  if (prev.mode !== session.mode) log.debug('mode', prev.mode, '→', session.mode);
  listeners.forEach(fn => fn(session, prev));
}

export function onSessionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
