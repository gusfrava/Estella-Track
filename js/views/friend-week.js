// A friend's week, from their card (profileCards/{uid}, built by the server): the short line in the friends list
// and the "Esta semana / Racha / Último entreno" block on their card. Same rules as your own week card and streak.
import { t, routineName } from '../i18n/index.js';
import { esc, fmtDay } from '../utils/format.js';
import { ICONS } from '../ui/icons.js';
import { friendWeek, myCheerFor } from '../state/social.js';
import { CHEER_ICONS } from '../ui/cheer-icons.js';
import { weekStart, todayStr, parseYmd, ymd } from '../utils/dates.js';
import { dayStrip } from './home.js';

const SHIELD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3"/><path d="M9 12l2 2l4 -4"/></svg>';

// "2/3 días · racha 4 sem." under their name (this week; the dots next to it show which days). '' while loading or when there's nothing to show.
export function friendLine(uid) {
  const w = friendWeek(uid), F = t().fr;
  if (!w || w.state !== 'ok') return '';
  const parts = [F.weekShort(w.days, w.goal)];
  if (w.streak.current > 0) parts.push(F.streakShort(w.streak.current));
  return parts.join(' · ');
}

// Small Monday–Sunday dots for the friends list.
export function miniDots(uid) {
  const w = friendWeek(uid);
  if (!w || w.state !== 'ok') return '';
  const start = weekStart(), today = todayStr();
  return `<span class="mdots" aria-hidden="true">${Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(d.getDate() + i); const k = ymd(d);
    return `<i class="${w.dates.has(k) ? 'on' : ''}${k === today ? ' today' : ''}"></i>`;
  }).join('')}</span>`;
}

export function when(date) {
  const F = t().fr, today = todayStr();
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (date === today) return F.today;
  if (date === ymd(y)) return F.yesterday;
  return fmtDay(parseYmd(date));
}

// What their last workout is called: the routine (translated if it's a starter-plan name) or the activity.
export const lastName = last => (last.kind === 'activity' ? (last.sport || t().fr.activity) : (routineName({ name: last.name }) || t().fr.activity));

// Fuego / Fuerza / Bravo for their last workout; the one I sent is pressed.
function cheerRow(uid, last) {
  const F = t().fr, mine = myCheerFor(uid, last.date);
  return `<div class="fr-cheer"><span>${F.cheerPrompt}</span><div class="cheer-btns">${['fire', 'strong', 'clap'].map(k =>
    `<button type="button" class="cheer-btn" data-cheer="${k}" aria-pressed="${!!mine && mine.kind === k}">${CHEER_ICONS[k]}<b>${esc(F.cheerKinds[k])}</b></button>`).join('')}</div>
    ${mine ? `<small>${esc(F.cheerSent(F.cheerKinds[mine.kind]))}</small>` : ''}</div>`;
}

// The block on a friend's card.
export function friendWeekHTML(uid) {
  const L = t(), F = L.fr, w = friendWeek(uid);
  if (!w) return `<p class="hint fr-week-note">${F.loading}</p>`;
  if (w.state === 'hidden') return `<p class="hint fr-week-note">${F.hidden}</p>`;
  if (w.state === 'none') return `<p class="hint fr-week-note">${F.noCard}</p>`;
  if (w.state !== 'ok') return `<p class="hint fr-week-note">${F.cardError}</p>`;

  const s = w.streak;
  let streakSub;
  if (s.current === 0) streakSub = '';
  else if (s.thisWeek) streakSub = F.streakKept;
  else if (w.goal && w.left > 0) streakSub = F.streakLeft(w.left);
  else streakSub = '';

  const last = w.last
    ? `<div class="fr-last"><span>${F.last}</span><b>${esc(lastName(w.last))}</b><small>${esc(when(w.last.date))}</small></div>${cheerRow(uid, w.last)}`
    : '';

  return `<section class="fr-week">
    <div class="fr-week-head"><h3>${F.thisWeek}</h3><span class="chip">${esc(F.daysOfGoal(w.days, w.goal))}</span></div>
    ${dayStrip(weekStart(), w.dates, F.theyTrained)}
    ${w.goal && w.met ? `<p class="week-met">${esc(F.goalMet)}</p>` : ''}
    <div class="fr-streak">${ICONS.flame}
      <div><b>${s.current > 0 ? esc(L.streakWeeks(s.current)) : esc(F.noStreak)}</b>${streakSub ? `<small>${esc(streakSub)}</small>` : ''}</div>
      ${s.jokers ? `<span class="fr-jokers" title="${esc(L.jokersN(s.jokers))}" aria-label="${esc(L.jokersN(s.jokers))}">${SHIELD}<span class="num">${s.jokers}</span></span>` : ''}
    </div>
    ${s.savedLast ? `<p class="hint">${esc(F.savedLast)}</p>` : ''}
    ${last}
  </section>`;
}
