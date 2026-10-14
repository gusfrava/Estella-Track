// Animations: screens sliding in, lists appearing one by one, numbers counting up, progress bars gliding,
// list reordering (FLIP), sparkles, confetti, and the "routine complete" card.
import { mascotHTML } from './mascot.js';
import { t } from '../i18n/index.js';

export const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- screens ----------
// A new screen slides in (forward / back), rises (tabs) or fades, and its cards appear one after another.
// The classes are removed once it's done, so later re-draws of the same screen don't replay it.
let enterTimer = null;
export function enterScreen(root, dir = 'fade') {
  settleScreen(root, { first: true });
  if (reducedMotion() || dir === 'none') return;
  root.classList.remove('enter-forward', 'enter-back', 'enter-tab', 'enter-fade', 'stagger');
  void root.offsetWidth;                                   // restart the animation
  root.classList.add(`enter-${dir}`, 'stagger');
  const top = root.children.length === 1 ? root.firstElementChild : root;   // onboarding: one .ob wrapper
  if (dir === 'forward') { const m = root.querySelector('.mascot'); if (m) pop(m, 'hop'); }
  const items = [...top.children].filter(el => !el.matches('.tabbar, .fab, header, .ob-top'))
    .flatMap(el => (el.matches('ul, ol, .ob-list, .lib-list') ? [...el.children] : [el]));
  items.slice(0, 14).forEach((el, i) => el.style.setProperty('--i', i));
  clearTimeout(enterTimer);
  enterTimer = setTimeout(() => root.classList.remove('enter-forward', 'enter-back', 'enter-tab', 'enter-fade', 'stagger'), 900);
}

// After every draw: numbers count up from what they showed before, progress bars glide from their old width.
const shown = new Map();
export function settleScreen(root, { first = false } = {}) {
  root.querySelectorAll('[data-count-key]').forEach(el => {
    const key = el.dataset.countKey, to = Number(el.dataset.count), before = shown.get(key);
    shown.set(key, to);
    if (first || before === undefined || before === to || reducedMotion() || !Number.isFinite(to)) return;
    countUp(el, before, to);
  });
  root.querySelectorAll('.bar[data-bar] > span').forEach(span => {
    const key = `bar:${span.parentElement.dataset.bar}`, to = span.style.width, before = shown.get(key);
    shown.set(key, to);
    if (before === undefined || before === to || reducedMotion()) return;
    span.style.transition = 'none'; span.style.width = before;
    void span.offsetWidth;
    span.style.transition = ''; span.style.width = to;
  });
}

function countUp(el, from, to) {
  const suffix = el.dataset.countSuffix || '', fmt = new Intl.NumberFormat(document.documentElement.lang || undefined);
  const start = performance.now(), dur = Math.min(900, 250 + Math.abs(to - from) * 60);
  (function frame(now) {
    const k = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt.format(Math.round(from + (to - from) * e)) + suffix;
    if (k < 1 && el.isConnected) requestAnimationFrame(frame);
  })(start);
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}

// A one-off "pop" on an element (a set just checked, an answer just picked).
export function pop(el, cls = 'pop') {
  if (!el || reducedMotion()) return;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
}

// Small stars that twinkle out around an element (badges, "Reclamar"). Calmer than confetti.
export function sparkle(el, count = 10) {
  if (!el || reducedMotion()) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const layer = document.createElement('div');
  layer.className = 'sparkles';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.5, d = r.width * 0.55 + 18 + Math.random() * 26;
    const s = document.createElement('i');
    s.style.cssText = `left:${cx}px;top:${cy}px;--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d}px;--s:${0.6 + Math.random() * 0.7};--d:${Math.random() * 180}ms;--c:${['#FFC94D', '#FF6A2B', '#3DC4B3', '#FFFFFF'][i % 4]}`;
    s.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/></svg>';
    layer.appendChild(s);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 1300);
}

// ---------- FLIP: smoothly move list items to their new position after a re-render ----------
// Usage: const before = capturePositions(root); ...re-render...; animateMoves(root, before);
export function capturePositions(root) {
  const m = new Map();
  root.querySelectorAll('[data-flip]').forEach(el => m.set(el.dataset.flip, el.getBoundingClientRect()));
  return m;
}

export function animateMoves(root, before) {
  if (reducedMotion() || !before) return;
  root.querySelectorAll('[data-flip]').forEach(el => {
    const a = before.get(el.dataset.flip);
    if (!a) return;
    const dy = a.top - el.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) return;
    el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
  });
}

// ---------- confetti ----------
export function confetti() {
  if (reducedMotion()) return;
  const c = document.createElement('canvas');
  c.id = 'confetti';
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = innerWidth, H = innerHeight;
  c.width = W * dpr; c.height = H * dpr; ctx.scale(dpr, dpr);
  const colors = ['#FF6A2B', '#3DC4B3', '#FFC94D', '#2B1B12', '#FFFFFF'];
  const parts = [];
  const burst = (x, y, dir) => {
    for (let i = 0; i < 80; i++) {
      const ang = -Math.PI / 2 + dir * 0.45 + (Math.random() - 0.5) * 1.1;
      const sp = 9 + Math.random() * 9;
      parts.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, w: 7 + Math.random() * 7, h: 4 + Math.random() * 6,
        r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.35, c: colors[i % colors.length], round: Math.random() < 0.3 });
    }
  };
  burst(W * 0.12, H * 0.95, 1); burst(W * 0.88, H * 0.95, -1); burst(W * 0.5, H * 0.9, 0);
  const start = performance.now();
  (function frame(now) {
    ctx.clearRect(0, 0, W, H);
    parts.forEach(p => {
      p.vy += 0.32; p.vx *= 0.99; p.vy *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.strokeStyle = '#2B1B12'; ctx.lineWidth = 1.5;
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      else { ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h); }
      ctx.restore();
    });
    if (now - start < 2600) requestAnimationFrame(frame); else c.remove();
  })(start);
}

// ---------- "¡Rutina completada!" ----------
// Shows the card + confetti, then calls onDone after ~2 s (or when tapped).
export function celebrate(routine, onDone) {
  const L = t();
  const el = document.createElement('div');
  el.className = 'celebrate';
  el.setAttribute('role', 'status');
  el.innerHTML = `<div class="card">${mascotHTML({ mood: 'excited', hop: true, size: '260px' })}
    <h2>${L.completedTitle}</h2><p>${routine.recurring ? L.completedWeekly : L.completedOnce}</p></div>`;
  document.body.appendChild(el);
  confetti();
  let timer = null;
  const finish = () => {
    clearTimeout(timer);
    if (!el.isConnected) return;
    el.remove();
    onDone();
  };
  el.addEventListener('click', finish);
  timer = setTimeout(finish, 2100);
}
