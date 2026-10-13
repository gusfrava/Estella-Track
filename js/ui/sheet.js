// Bottom sheet (the panel that slides up for forms, menus and confirmations).
// openSheet(html, mount) → shows it; mount(sheetEl) wires up its buttons.
import { esc } from '../utils/format.js';
import { t } from '../i18n/index.js';

const layer = document.getElementById('layer');
const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const closeListeners = new Set();

let sheetEl = null, scrimEl = null, lastFocus = null;

// ---------- background scroll lock ----------
// While a sheet is open the page behind it must not move. iPhone Safari ignores
// overflow:hidden on <body>, so we pin the body in place and restore the scroll position on close.
let lockedY = 0;
function lockScroll() {
  if (document.body.classList.contains('scroll-locked')) return;
  lockedY = window.scrollY;
  document.body.classList.add('scroll-locked');
  document.body.style.top = `-${lockedY}px`;
}
function unlockScroll() {
  if (!document.body.classList.contains('scroll-locked')) return;
  document.body.classList.remove('scroll-locked');
  document.body.style.top = '';
  window.scrollTo(0, lockedY);
}

export const isSheetOpen = () => !!sheetEl;
export function onSheetClose(fn) { closeListeners.add(fn); }

export function openSheet(html, mount) {
  closeSheet(true);
  lastFocus = document.activeElement;
  scrimEl = document.createElement('div');
  scrimEl.className = 'scrim';
  sheetEl = document.createElement('div');
  sheetEl.className = 'sheet';
  sheetEl.setAttribute('role', 'dialog');
  sheetEl.setAttribute('aria-modal', 'true');
  sheetEl.innerHTML = `<div class="grab" aria-hidden="true"></div>${html}`;
  layer.append(scrimEl, sheetEl);
  lockScroll();
  scrimEl.addEventListener('click', () => closeSheet());
  requestAnimationFrame(() => { scrimEl && scrimEl.classList.add('open'); sheetEl && sheetEl.classList.add('open'); });
  if (mount) mount(sheetEl);
  const first = sheetEl.querySelector('[autofocus]');
  if (first) setTimeout(() => first.focus({ preventScroll: true }), 60);
  return sheetEl;
}

// Swaps what the open sheet shows (e.g. a two-step form) without closing and re-opening it.
export function replaceSheet(html, mount) {
  if (!sheetEl) return openSheet(html, mount);
  sheetEl.innerHTML = `<div class="grab" aria-hidden="true"></div>${html}`;
  sheetEl.scrollTop = 0;
  if (mount) mount(sheetEl);
  const first = sheetEl.querySelector('[autofocus]');
  if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
  return sheetEl;
}

export function closeSheet(instant) {
  if (!sheetEl) return;
  const s = sheetEl, sc = scrimEl;
  sheetEl = scrimEl = null;
  unlockScroll();
  if (instant || reduced()) { s.remove(); sc.remove(); }
  else {
    s.classList.remove('open'); sc.classList.remove('open');
    setTimeout(() => { s.remove(); sc.remove(); }, 280);
  }
  if (lastFocus && lastFocus.isConnected) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
  setTimeout(() => closeListeners.forEach(fn => fn()), 0);
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

// "Are you sure?" sheet with a red confirm button.
export function confirmSheet(title, body, onYes) {
  const L = t();
  openSheet(`<h2>${esc(title)}</h2><p class="confirm-body">${esc(body)}</p>
    <div class="actions">
      <button class="btn danger" data-k="yes">${L.yesDelete}</button>
      <button class="btn secondary" data-k="no">${L.cancel}</button>
    </div>`, s => {
    s.querySelector('[data-k=yes]').onclick = () => { closeSheet(true); onYes(); };
    s.querySelector('[data-k=no]').onclick = () => closeSheet();
  });
}
