// Home screen: greeting, weekly summary, routine cards, other activities, + button.
import { ICONS } from '../ui/icons.js';
import { t } from '../i18n/index.js';
import { esc, fmtDay, fmtDuration } from '../utils/format.js';
import { nextMonday, parseYmd, todayStr } from '../utils/dates.js';
import { orderedRoutines, routineProgress, weekSummary, isRoutineDone, routinesList, activities } from '../state/selectors.js';
import { brand, langToggle, editDeleteButtons, progressBar } from './partials.js';

// opts = { user, localMode, highlightId, showOlder }
export function homeView(state, opts) {
  const L = t();
  const week = weekSummary(state);
  const name = firstName(opts.user);

  let h = `
  <header class="top">${brand()}
    <div class="top-right">${langToggle()}
      <button class="avatar" data-action="account" aria-label="${L.account}">${esc(initial(opts))}</button>
    </div>
  </header>
  ${name ? `<p class="hello">${esc(L.hello(name))}</p>` : ''}
  <h1>${L.yourRoutines}</h1>
  <p class="sub">${esc(L.weekOf(fmtDay(week.start), fmtDay(week.end)))}</p>`;

  const hasRoutines = routinesList(state).length > 0, hasActivities = activities(state).length > 0;
  if (hasRoutines || hasActivities) h += weekCard(week);
  h += `<div class="section-head"></div>`;
  h += hasRoutines
    ? `<ul class="list">${orderedRoutines(state).map(r => routineCard(r, opts.highlightId)).join('')}</ul>`
    : `<div class="empty"><h3>${L.emptyTitle}</h3><p>${L.emptyBody}</p></div>`;
  if (hasActivities) h += activitiesSection(week, opts.showOlder);
  h += `<button class="fab" data-action="plus" aria-label="${L.add}">${ICONS.plus}</button>`;
  return h;
}

function weekCard(week) {
  const L = t();
  const n = week.weekActivities.length;
  return `<section class="week" aria-label="${L.thisWeek}">
    <div class="label">${L.thisWeek}</div>
    <div class="week-stats">
      <div class="week-stat"><b class="num">${week.doneCount}/${week.total}</b><span>${L.routinesDone}</span></div>
      <div class="week-stat"><b class="num">${n}</b><span>${L.activitiesN(n)}</span></div>
    </div>
    ${progressBar(week.pct)}
  </section>`;
}

function routineCard(r, highlightId) {
  const L = t();
  const { done, total, pct } = routineProgress(r);
  const isDone = isRoutineDone(r);
  const meta = `${L.exercisesN(total)} · ${r.recurring ? L.weekly : L.once}`;
  const status = isDone
    ? `<span class="chip">${L.done}${r.recurring ? ' · ' + esc(L.resetsOn(fmtDay(nextMonday(), { weekday: 'short' }))) : ''}</span>`
    : (total ? `<div class="mini"><span style="width:${pct}%"></span></div>` : '');
  return `<li class="rcard${isDone ? ' done' : ''}${highlightId === r.id ? ' pop' : ''}">
    <button class="rcard-open" data-action="open" data-id="${r.id}">
      <span class="rcard-text"><h3>${esc(r.name)}</h3><p class="meta">${esc(meta)}</p>${status}</span>
      <span class="badge num" aria-hidden="true">${isDone ? ICONS.check : `${done}/${total}`}</span>
    </button>
    ${editDeleteButtons('routine', r.id, r.name, true)}
  </li>`;
}

function activitiesSection(week, showOlder) {
  const L = t();
  let h = `<div class="section-head"><h2>${L.otherActivities}</h2></div>`;
  h += week.weekActivities.length
    ? `<ul class="list">${week.weekActivities.map(activityItem).join('')}</ul>`
    : `<p class="hint">${L.nothingThisWeek}</p>`;
  if (week.olderActivities.length) {
    h += `<button class="older" data-action="older">${showOlder ? L.hideOlder : L.showOlder(week.olderActivities.length)}</button>`;
    if (showOlder) h += `<ul class="list" style="margin-top:10px">${week.olderActivities.map(activityItem).join('')}</ul>`;
  }
  return h;
}

// s = an activity session: { id, date, activity: { sport, minutes, note } }
function activityItem(s) {
  const L = t();
  const a = s.activity;
  const when = s.date === todayStr() ? L.today : fmtDay(parseYmd(s.date), { weekday: 'short', day: 'numeric', month: 'short' });
  return `<li class="act">
    <button class="act-main" data-action="edit-act" data-id="${s.id}">
      <span class="act-icon" aria-hidden="true">${esc(a.sport.trim()[0] || '·')}</span>
      <span class="act-text"><b>${esc(a.sport)}</b><span>${esc(fmtDuration(a.minutes))} · ${esc(when)}</span>${a.note ? `<em>${esc(a.note)}</em>` : ''}</span>
    </button>
    ${editDeleteButtons('act', s.id, a.sport)}
  </li>`;
}

function firstName(user) {
  const n = user && user.displayName ? user.displayName.trim() : '';
  return n ? n.split(/\s+/)[0] : '';
}

function initial({ user, localMode }) {
  if (localMode) return '·';
  const s = (user && (user.displayName || user.email)) || '?';
  return s.trim()[0].toUpperCase();
}
export { initial };
