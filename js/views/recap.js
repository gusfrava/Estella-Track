// The weekly recap ("Tu semana"): a small card on home during the week after, and the full recap in a sheet.
// Data: state/recap.js. Shareable picture: services/recap-image.js.
import { t } from '../i18n/index.js';
import { esc, fmtDay, fmtNum, fmtClock } from '../utils/format.js';
import { parseYmd } from '../utils/dates.js';
import { mascotHTML } from '../ui/mascot.js';
import { ICONS } from '../ui/icons.js';
import { exerciseName } from '../services/library.js';
import { dayStrip } from './home.js';

export const recapMood = r => (r.status === 'met' ? 'excited' : 'amused');

export function recapHeadline(r) {
  const R = t().rc;
  if (r.status === 'met') return [R.headMet, R.subMet];
  if (r.status === 'saved') return [R.headSaved, R.subSaved];
  return [R.headSome, R.subSome(r.goal ? Math.max(0, r.goal - r.days) : 0)];
}

export const recapRange = r => `${fmtDay(parseYmd(r.from))} – ${fmtDay(parseYmd(r.to))}`;

// "62,5 kg × 9", "15 reps", "1:30"
export function recordText(ex, p) {
  const L = t();
  if (ex.type === 'time') return fmtClock(p.t);
  if (ex.type === 'reps' || !(p.w > 0)) return `${p.r} ${L.repsU}`;
  return `${fmtNum(p.w)} ${p.u} × ${p.r}`;
}

// The numbers shown in the recap and the picture: [{ value, label }] — workouts (gym + activities), streak, sets, minutes.
export function recapStats(r) {
  const R = t().rc, n = r.workouts + r.activities;
  const out = [{ value: n, label: R.workouts(n) }, { value: r.streak, label: R.streakWeeks(r.streak) }];
  if (r.sets) out.push({ value: r.sets, label: R.sets });
  if (r.minutes) out.push({ value: r.minutes, label: R.minutes });
  if (r.points) out.splice(2, 0, { value: r.points, label: t().pts.pointsWord(r.points) });
  return out.slice(0, 4);
}

// Home: "Tu semana pasada" with the headline and two buttons.
export function recapCard(r) {
  const R = t().rc, [head] = recapHeadline(r);
  return `<section class="recap-card">
    ${mascotHTML({ crop: 'bust', size: '56px', mood: recapMood(r) })}
    <div class="recap-card-t"><span>${R.cardTitle}</span><b>${esc(head)}</b><small>${esc(R.daysOf(r.days, r.goal))} ${R.daysLabel}</small>
      <button class="pill-btn" data-action="recap-open">${R.open}</button></div>
    <button class="icon-btn" data-action="recap-hide" aria-label="${esc(R.hide)}">${ICONS.close}</button>
  </section>`;
}

// The full recap (inside a sheet).
export function recapHTML(r) {
  const R = t().rc, [head, sub] = recapHeadline(r);
  return `<div class="recap">
    <div class="recap-head">
      ${mascotHTML({ size: '150px', mood: recapMood(r), hop: r.status === 'met' })}
      <div><span class="recap-range">${esc(recapRange(r))}</span><h2>${esc(head)}</h2><p>${esc(sub)}</p></div>
    </div>
    <div class="recap-days"><b class="num">${esc(R.daysOf(r.days, r.goal))}</b> <span>${R.daysLabel}</span></div>
    ${dayStrip(parseYmd(r.from), r.dates)}
    <ul class="recap-stats">${recapStats(r).map(s => `<li><b class="num">${esc(fmtNum(s.value))}</b><span>${esc(s.label)}</span></li>`).join('')}</ul>
    ${r.records.length ? `<div class="recap-recs"><h3>${ICONS.trophy}<span>${R.records}</span></h3>
      <ul>${r.records.slice(0, 3).map(i => `<li><span>${esc(exerciseName(i.ex))}</span><b class="num">${esc(recordText(i.ex, i.record.point))}</b></li>`).join('')}</ul></div>` : ''}
    ${r.cheers ? `<p class="recap-cheers">${ICONS.users}<span>${esc(R.cheers(r.cheers))}</span></p>` : ''}
  </div>`;
}
