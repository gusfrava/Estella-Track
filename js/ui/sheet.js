// Bottom sheet (the panel that slides up for forms, menus and confirmations).
// openSheet(html, mount) → shows it; mount(sheetEl) wires up its buttons.
// Closing: the × at the top, tapping the dark area above it, Escape, the phone's back gesture,
// or swiping it down (from the handle, or anywhere once the sheet is scrolled to the top).
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
  sheetEl.innerHTML = topBar() + html;
  layer.append(scrimEl, sheetEl);
  wireTop(sheetEl);
  wireSwipe(sheetEl);
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
  sheetEl.innerHTML = topBar() + html;
  wireTop(sheetEl);
  sheetEl.scrollTop = 0;
  if (mount) mount(sheetEl);
  const first = sheetEl.querySelector('[autofocus]');
  if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
  return sheetEl;
}

// The sticky top of every sheet: the drag handle and a close button.
const topBar = () => `<div class="sheet-top"><div class="grab" aria-hidden="true"></div>
  <button type="button" class="sheet-x" data-sheet-close aria-label="${esc(t().close)}">×</button></div>`;
function wireTop(s) { s.querySelector('[data-sheet-close]').onclick = () => closeSheet(); }

// Swipe down to close. Starts from the handle bar, or from anywhere while the sheet is scrolled to the top,
// so scrolling a long sheet still works. Past 110 px (or a quick flick) it closes; otherwise it springs back.
function wireSwipe(s) {
  let startY = 0, startT = 0, dy = 0, dragging = false, fromTop = false;
  s.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    fromTop = !!e.target.closest('.sheet-top');
    if (!fromTop && s.scrollTop > 0) return;
    if (e.target.closest('input, textarea, select, .lib-groups')) return;
    startY = e.touches[0].clientY; startT = Date.now(); dy = 0; dragging = true;
  }, { passive: true });
  s.addEventListener('touchmove', e => {
    if (!dragging) return;
    dy = e.touches[0].clientY - startY;
    if (dy <= 0) { if (!fromTop) { dragging = false; } s.style.transform = ''; return; }
    if (!fromTop && s.scrollTop > 0) { dragging = false; return; }
    if (e.cancelable) e.preventDefault();               // stop the page bounce while dragging
    s.style.transition = 'none';
    s.style.transform = `translateY(${dy}px)`;
  }, { passive: false });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    s.style.transition = '';
    const fast = dy > 40 && dy / Math.max(1, Date.now() - startT) > 0.6;
    if (dy > 110 || fast) { s.style.transform = ''; closeSheet(); }
    else s.style.transform = '';
  };
  s.addEventListener('touchend', end);
  s.addEventListener('touchcancel', end);
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
  setTimeout(() => closeListeners.forEach(fn => fn(s)), 0);
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
