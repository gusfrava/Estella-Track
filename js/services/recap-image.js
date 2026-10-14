// The shareable picture of the weekly recap: 1080 × 1920 (Instagram / WhatsApp story size), drawn on a canvas in
// Estella's style (cream background, ink outlines, orange days, the mascot). recapImage(r) → Promise<Blob> (PNG).
import { t } from '../i18n/index.js';
import { fmtNum } from '../utils/format.js';
import { parseYmd, ymd } from '../utils/dates.js';
import { mascotSVG } from '../ui/mascot.js';
import { exerciseName } from './library.js';
import { recapHeadline, recapRange, recapStats, recapMood, recordText } from '../views/recap.js';

const W = 1080, H = 1920;
const C = { bg: '#FFF1E1', card: '#FFFFFF', ink: '#2B1B12', muted: '#6E5B4E', orange: '#FF6A2B', teal: '#3DC4B3', yellow: '#FFC94D', soft: '#FFF7DD' };
const DISPLAY = '"Baloo 2", "Arial Rounded MT Bold", sans-serif', BODY = '"Figtree", system-ui, sans-serif';

export async function recapImage(r) {
  await Promise.all([`800 100px "Baloo 2"`, `700 40px "Figtree"`, `500 40px "Figtree"`]
    .map(f => (document.fonts ? document.fonts.load(f).catch(() => null) : null)));
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const R = t().rc, [head, sub] = recapHeadline(r);

  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  // soft circles in the background
  blob(g, 930, 260, 260, C.soft); blob(g, 120, 1720, 220, C.soft);

  // brand + title
  text(g, '★ Estella', 80, 140, `700 44px ${DISPLAY}`, C.ink);
  text(g, R.imgTitle, 80, 290, `800 120px ${DISPLAY}`, C.ink);
  text(g, recapRange(r), 84, 360, `500 42px ${BODY}`, C.muted);

  // mascot on the right
  const m = await mascotImage(recapMood(r));
  if (m) { const h = 520, w = h * m.width / m.height; g.drawImage(m, W - w - 50, 150, w, h); }

  // headline
  wrap(g, head, 80, 520, 600, `800 64px ${DISPLAY}`, C.ink, 70);

  // days card
  card(g, 60, 700, W - 120, 380);
  text(g, R.daysOf(r.days, r.goal), 110, 800, `800 76px ${DISPLAY}`, C.ink);
  text(g, R.daysLabel, 110, 850, `600 36px ${BODY}`, C.muted);
  const letters = t().dayLetters, start = parseYmd(r.from), gap = (W - 120 - 100) / 7;
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i);
    const on = r.dates.has(ymd(d)), cx = 110 + gap * i + gap / 2 - 10, cy = 950;
    g.beginPath(); g.arc(cx, cy, 44, 0, Math.PI * 2);
    g.fillStyle = on ? C.orange : C.card; g.fill(); g.lineWidth = 6; g.strokeStyle = C.ink; g.stroke();
    if (on) check(g, cx, cy);
    text(g, letters[i], cx, 1040, `800 34px ${DISPLAY}`, C.ink, 'center');
  }

  // stats 2 × 2
  const stats = recapStats(r), tw = (W - 120 - 40) / 2;
  stats.forEach((s, i) => {
    const x = 60 + (i % 2) * (tw + 40), y = 1130 + Math.floor(i / 2) * 230;
    card(g, x, y, tw, 200, i % 3 === 0 ? C.yellow : C.card);
    text(g, fmtNum(s.value), x + 40, y + 115, `800 92px ${DISPLAY}`, C.ink);
    text(g, s.label, x + 40, y + 165, `600 34px ${BODY}`, C.ink);
  });

  // records
  let y = 1640;
  if (r.records.length) {
    text(g, R.records, 80, y, `800 44px ${DISPLAY}`, C.ink); y += 60;
    for (const i of r.records.slice(0, 2)) {
      text(g, fit(g, exerciseName(i.ex), 600, `600 36px ${BODY}`), 80, y, `600 36px ${BODY}`, C.ink);
      text(g, recordText(i.ex, i.record.point), W - 80, y, `800 40px ${DISPLAY}`, C.orange, 'right');
      y += 54;
    }
  } else {
    wrap(g, sub, 80, y, W - 160, `500 40px ${BODY}`, C.muted, 52);
  }
  text(g, 'estellatrack.app', W / 2, H - 70, `700 36px ${BODY}`, C.muted, 'center');

  return new Promise((ok, fail) => canvas.toBlob(b => (b ? ok(b) : fail(new Error('toBlob failed'))), 'image/png'));
}

// ---------- drawing helpers ----------
function text(g, s, x, y, font, color, align = 'left') {
  g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(String(s), x, y);
}
function fit(g, s, maxW, font) {
  g.font = font; let out = String(s);
  while (out.length > 1 && g.measureText(out).width > maxW) out = out.slice(0, -2) + '…';
  return out;
}
function wrap(g, s, x, y, maxW, font, color, lh) {
  g.font = font; let line = '';
  for (const word of String(s).split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > maxW && line) { text(g, line, x, y, font, color); y += lh; line = word; } else line = test;
  }
  if (line) text(g, line, x, y, font, color);
}
function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function card(g, x, y, w, h, fill = C.card) {
  rr(g, x + 10, y + 12, w, h, 44); g.fillStyle = C.ink; g.fill();          // the offset "shadow" of Estella's cards
  rr(g, x, y, w, h, 44); g.fillStyle = fill; g.fill(); g.lineWidth = 6; g.strokeStyle = C.ink; g.stroke();
}
function blob(g, x, y, r, color) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = color; g.fill(); }
function check(g, cx, cy) {
  g.beginPath(); g.moveTo(cx - 18, cy + 2); g.lineTo(cx - 5, cy + 15); g.lineTo(cx + 20, cy - 12);
  g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = C.ink; g.stroke();
}
function mascotImage(mood) {
  const { svg } = mascotSVG({ mood });
  return new Promise(ok => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);   // no mascot is better than no picture
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}
