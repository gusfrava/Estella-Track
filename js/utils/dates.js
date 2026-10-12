// Date helpers. Dates are stored as local "YYYY-MM-DD" strings. Weeks start on Monday.

export const pad2 = n => String(n).padStart(2, '0');

export const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayStr = () => ymd(new Date());

export function weekStart(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

// Identifies the current week, e.g. "2026-10-12" (that week's Monday).
export const weekKey = () => ymd(weekStart());

export function weekRange() {
  const start = weekStart();
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

export function nextMonday() {
  const x = weekStart();
  x.setDate(x.getDate() + 7);
  return x;
}

// Week of a given 'YYYY-MM-DD' date (that week's Monday).
export const weekKeyOf = dateStr => ymd(weekStart(parseYmd(dateStr)));

// 'YYYY-MM-DD' of a timestamp (ms).
export const ymdOf = ms => ymd(new Date(ms));

// 'YYYY-MM-DD' of N days ago.
export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
}
