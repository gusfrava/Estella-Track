// Which screen inside the app is showing: { name: 'home' } or { name: 'routine', id }.
// Uses browser history so the phone's back button/gesture returns to the home screen.
import { logger } from '../utils/log.js';

const log = logger('router');
let view = { name: 'home' };
const listeners = new Set();

export const getView = () => view;

export function onRouteChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setView(next) {
  view = next;
  log.debug('view', next.name, next.id || '');
  listeners.forEach(fn => fn(view));
}

const historyHasRoutine = () => { try { return !!(history.state && history.state.v === 'r'); } catch (e) { return false; } };

export function openRoutine(id) {
  try { history.pushState({ v: 'r', id }, ''); } catch (e) {}
  setView({ name: 'routine', id });
  window.scrollTo(0, 0);
}

export function goHome() {
  const pushed = historyHasRoutine();
  setView({ name: 'home' });
  window.scrollTo(0, 0);
  if (pushed) { try { history.back(); } catch (e) {} }
}

// Back to home without touching history (used when the session changes).
export function resetRoute() {
  if (view.name !== 'home') setView({ name: 'home' });
}

export function initRouter({ onBack } = {}) {
  try { history.replaceState({ v: 'home' }, ''); } catch (e) {}
  window.addEventListener('popstate', e => {
    if (onBack) onBack();
    const st = e.state;
    setView(st && st.v === 'r' ? { name: 'routine', id: st.id } : { name: 'home' });
  });
}
