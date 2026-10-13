// Animations: list reordering (FLIP), confetti, and the "routine complete" card.
import { mascotHTML } from './mascot.js';
import { t } from '../i18n/index.js';

export const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

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
