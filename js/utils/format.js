// Text formatting for display: HTML escaping, dates, numbers, durations.
import { locale } from '../i18n/index.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);

export const fmtDay = (d, opts = { day: 'numeric', month: 'short' }) =>
  new Intl.DateTimeFormat(locale(), opts).format(d).replace('.', '');

export const fmtNum = n => new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(n);

export function fmtDuration(min) {
  const h = Math.floor(min / 60), m = min % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}
