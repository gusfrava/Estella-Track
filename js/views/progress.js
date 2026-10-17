// Progress tab: overall stats (free, from state/progress.js), streak and badges, then personal records — the best
// you've ever done on each exercise, grouped by routine.
// Records come from the history points in exerciseStats (see selectors.personalRecord).
import { rewardsBlock } from './badges.js';
import { weekRecap, hasRecap } from '../state/recap.js';
import { ICONS } from '../ui/icons.js';
import { t, routineName } from '../i18n/index.js';
import { exerciseName } from '../services/library.js';
import { esc, fmtDay, fmtNum, fmtClock, fmtDuration } from '../utils/format.js';
import { parseYmd, daysAgo } from '../utils/dates.js';
import { recordsByRoutine, weeklyStreak, weekGoalProgress, lastUsedUnit } from '../state/selectors.js';
import { overallStats, liftObject, fromKg } from '../state/progress.js';
import { tabBar } from './partials.js';
import { appHeader } from './home.js';

// Tabler Icons (MIT): shield-check
const SHIELD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3"/><path d="M9 12l2 2l4 -4"/></svg>';

const NEW_DAYS = 7;      // a record shows "Nuevo" for a week
const MONTH_DAYS = 30;   // "N récords nuevos este mes"

// opts = same as the home screen (user, localMode) for the header.
export function progressView(state, opts) {
  const L = t();
  const groups = recordsByRoutine(state);
  const monthFrom = daysAgo(MONTH_DAYS - 1);
  const newThisMonth = groups.reduce((n, g) => n + g.items.filter(i => i.record.prev && i.record.point.d >= monthFrom).length, 0);

  let h = `${appHeader(state, opts)}
  <h1>${L.progressTitle}</h1>
  ${overallBlock(state)}
  ${streakCard(weeklyStreak(state), weekGoalProgress(state))}
  ${rewardsBlock()}
  ${hasRecap(weekRecap()) ? `<button class="textbtn recap-link" data-action="recap-open">${ICONS.trophy}<span>${L.rc.fromProgress}</span></button>` : ''}`;

  if (!groups.length) {
    h += `<div class="empty" style="margin-top:26px">${ICONS.trophy}<h3>${L.noRecordsTitle}</h3><p>${L.noRecordsBody}</p></div>`;
  } else {
    h += `<div class="recs-head"><h2>${L.recordsTitle}</h2><p class="sub">${L.recordsSub}</p></div>`;
    if (newThisMonth) h += `<div class="banner rec-banner">${ICONS.trophy}<span>${esc(L.recordsThisMonth(newThisMonth))}</span></div>`;
    for (const g of groups) {
      h += `<div class="section-head"><h2>${esc(routineName(g.routine))}</h2></div>
        <ul class="list">${g.items.map(i => recordItem(i.ex, i.record)).join('')}</ul>`;
    }
  }
  h += tabBar('progress');
  return h;
}

// Overall stats: workouts this month, weeks the goal was met, time and weight lifted in total (+ "that's like
// lifting 2 elephants"). The streak is the card right below.
function overallBlock(state) {
  const L = t(), o = overallStats(state), unit = lastUsedUnit(state);
  const lift = liftObject(o.total.volumeKg, { lifetime: true });
  const tiles = [
    [fmtNum(o.month.workouts), L.ov.monthWorkouts(o.month.workouts)],
    [fmtNum(o.goalWeeks), L.ov.goalWeeks(o.goalWeeks)],
    [fmtDuration(o.total.minutes), L.ov.time],
    [`${fmtNum(Math.round(fromKg(o.total.volumeKg, unit)))} ${unit}`, L.ov.volume],
  ];
  return `<section class="overall" aria-label="${esc(L.ov.label)}">
    <ul class="recap-stats">${tiles.map(([v, l]) => `<li><b class="num">${esc(v)}</b><span>${esc(l)}</span></li>`).join('')}</ul>
    ${lift ? `<p class="overall-like">${esc(L.ov.like(lift.count, lift.id))} ${lift.emoji}</p>` : ''}
  </section>`;
}

// "5 semanas seguidas" + the last 8 weeks as dots. s = selectors.weeklyStreak().
// g = selectors.weekGoalProgress(): with a weekly goal, a week counts once it's reached.
function streakCard(s, g) {
  const L = t();
  const msg = s.thisWeek ? L.streakKept
    : s.savedLast ? L.jokerUsed
    : g.goal ? (s.current ? L.streakLeft(g.left) : g.days ? L.streakStartLeft(g.left) : L.streakStartGoal(g.goal))
    : !s.current ? L.streakStart : L.streakKeepIt;
  // dots: full = goal reached, shield = kept by a comodín, half = trained but short of the goal
  const dots = s.recent.map((w, i) => {
    const now = i === s.recent.length - 1;
    const part = !w.done && !w.saved && w.days > 0;
    const title = `${fmtDay(parseYmd(w.key))}${w.goal ? ` · ${w.days}/${w.goal}` : ''}${w.saved ? ` · ${L.jokerName}` : ''}`;
    return `<span class="sdot${w.done ? ' on' : w.saved ? ' saved' : part ? ' part' : ''}${now ? ' now' : ''}" title="${esc(title)}"></span>`;
  }).join('');
  // comodines: how many you have, when the next one comes, and what they do
  const jokers = s.jokers == null ? '' : `<div class="jokers">
      <span class="jokers-ico" aria-hidden="true">${SHIELD}</span>
      <span class="jokers-text"><b>${esc(L.jokersN(s.jokers))}</b><span>${esc(s.nextJoker ? L.jokerNext(s.nextJoker) : L.jokerFull)}</span></span>
    </div>
    <p class="jokers-how">${esc(L.jokerHow)}</p>`;
  return `<section class="streak" aria-label="${L.streakLabel}">
    <div class="streak-top">${ICONS.flame}
      <div><b class="num">${esc(s.current ? L.streakWeeks(s.current) : L.streakZero)}</b><span>${esc(msg)}</span></div>
    </div>
    <div class="sdots" role="img" aria-label="${esc(L.streakDotsLabel(s.recent.filter(w => w.done).length))}">${dots}</div>
    ${s.best > s.current ? `<p class="streak-best">${esc(L.streakBest(s.best))}</p>` : ''}
    ${jokers}
  </section>`;
}

// One record: name, date and gain on the left, the record value on the right.
// With no earlier best (logged once) it's a "First log": the value goes in the small line and the right
// side is a muted label, so a single workout doesn't look like a record.
function recordItem(ex, { point, prev }) {
  const L = t();
  const isNew = !!prev && point.d >= daysAgo(NEW_DAYS - 1);
  const sameYear = point.d.slice(0, 4) === String(new Date().getFullYear());
  const when = fmtDay(parseYmd(point.d), sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  const gain = gainText(ex.type, point, prev);
  return `<li class="rec${isNew ? ' new' : ''}${prev ? '' : ' first'}">
    <span class="rec-text">
      <b>${esc(exerciseName(ex))}</b>
      <span>${esc(when)}${prev ? (gain ? ` · <span class="delta">${esc(gain)}</span>` : '') : ` · <span class="num">${esc(valueText(ex.type, point))}</span>`}</span>
      ${isNew ? `<span class="chip rec-chip">${L.newRecord}</span>` : ''}
    </span>
    ${prev ? `<span class="rec-val num">${valueHTML(ex.type, point)}</span>` : `<span class="rec-first">${L.firstLog}</span>`}
  </li>`;
}

// "62,5 kg" + "× 9", "15 reps", "1:30"
function valueHTML(type, p) {
  const L = t();
  if (type === 'time') return `<b>${fmtClock(p.t)}</b>`;
  if (type === 'reps' || !(p.w > 0)) return `<b>${p.r}</b><small>${L.repsU}</small>`;
  return `<b>${fmtNum(p.w)}</b><small>${p.u}</small><em>× ${p.r}</em>`;
}

// The same value on one line: "62,5 kg × 9", "15 reps", "1:30"
function valueText(type, p) {
  const L = t();
  if (type === 'time') return fmtClock(p.t);
  if (type === 'reps' || !(p.w > 0)) return `${p.r} ${L.repsU}`;
  return `${fmtNum(p.w)} ${p.u} × ${p.r}`;
}

// How much better than the previous best: "↑ +2,5 kg", "↑ +1 rep", "↑ +0:15". '' for a first record.
function gainText(type, p, prev) {
  const L = t();
  if (!prev) return '';
  if (type === 'time') return `↑ +${fmtClock(p.t - prev.t)}`;
  const moreReps = d => `↑ +${d} ${d === 1 ? L.repU : L.repsU}`;
  if (type === 'reps' || !(p.w > 0)) return moreReps(p.r - prev.r);
  if (prev.u !== p.u) return '';
  return p.w > prev.w ? `↑ +${fmtNum(p.w - prev.w)} ${p.u}` : moreReps(p.r - prev.r);
}
