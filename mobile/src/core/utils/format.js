// Text formatting for display: HTML escaping, dates, numbers, durations.
import { locale } from '../i18n/index.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);

export const fmtDay = (d, opts = { day: 'numeric', month: 'short' }) =>
  new Intl.DateTimeFormat(locale(), opts).format(d).replace('.', '');

export const fmtNum = n => new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(n);

// Seconds as a clock: 90 → "1:30", 3725 → "1:02:05".
export function fmtClock(sec) {
  sec = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function fmtDuration(min) {
  const h = Math.floor(min / 60), m = min % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}
