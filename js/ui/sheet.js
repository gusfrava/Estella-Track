// Bottom sheet (the panel that slides up for forms, menus and confirmations).
// openSheet(html, mount) → shows it; mount(sheetEl) wires up its buttons.
import { esc } from '../utils/format.js';
import { t } from '../i18n/index.js';

const layer = document.getElementById('layer');
const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const closeListeners = new Set();

let sheetEl = null, scrimEl = null, lastFocus = null;

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
  scrimEl.addEventListener('click', () => closeSheet());
  requestAnimationFrame(() => { scrimEl && scrimEl.classList.add('open'); sheetEl && sheetEl.classList.add('open'); });
  if (mount) mount(sheetEl);
  const first = sheetEl.querySelector('[autofocus]');
  if (first) setTimeout(() => first.focus({ preventScroll: true }), 60);
  return sheetEl;
}

export function closeSheet(instant) {
  if (!sheetEl) return;
  const s = sheetEl, sc = scrimEl;
  sheetEl = scrimEl = null;
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
