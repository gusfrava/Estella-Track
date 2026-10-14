// Home screen: greeting, weekly summary, routine cards, other activities, + button.
import { weekRecap, hasRecap, recapHidden } from '../state/recap.js';
import { recapCard } from './recap.js';
import { ICONS } from '../ui/icons.js';
import { t, routineName } from '../i18n/index.js';
import { esc, fmtDay, fmtDuration } from '../utils/format.js';
import { nextMonday, parseYmd, todayStr, ymd } from '../utils/dates.js';
import { orderedRoutines, routineProgress, weekSummary, isRoutineDone, routinesList, activities, weeklyStreak, trainedToday, weekGoalProgress } from '../state/selectors.js';
import { mascotHTML } from '../ui/mascot.js';
import { brand, langToggle, editDeleteButtons, progressBar, tabBar } from './partials.js';

// opts = { user, localMode, highlightId, showOlder, verify: { needed, ui } }
export function homeView(state, opts) {
  const L = t();
  const week = weekSummary(state);
  const name = firstName(displayNameOf(state.profile, opts.user));

  let h = `
  ${appHeader(state, opts)}
  <div class="hello-row">
    ${mascotHTML({ crop: 'bust', size: '64px', mood: trainedToday(state) ? 'excited' : 'amused' })}
    <p class="hello">${esc(name ? L.hello(name) : L.helloAnon)}</p>
  </div>
  ${opts.verify && opts.verify.needed ? verifyBanner(opts.user, opts.verify.ui) : ''}
  <h1>${L.yourRoutines}</h1>
  <p class="sub">${esc(L.weekOf(fmtDay(week.start), fmtDay(week.end)))}</p>`;

  // Monday onwards: last week's recap, until it's hidden (it stays reachable from Progreso).
  const recap = weekRecap();
  if (hasRecap(recap) && !recapHidden(recap.key, opts.user && opts.user.uid)) h += recapCard(recap);

  const hasRoutines = routinesList(state).length > 0, hasActivities = activities(state).length > 0;
  if (hasRoutines || hasActivities) h += weekCard(week, weeklyStreak(state), weekGoalProgress(state));
  h += `<div class="section-head"></div>`;
  h += hasRoutines
    ? `<ul class="list">${orderedRoutines(state).map(r => routineCard(r, opts.highlightId)).join('')}</ul>`
    : `<div class="empty"><h3>${L.emptyTitle}</h3><p>${L.emptyBody}</p></div>`;
  if (hasActivities) h += activitiesSection(week, opts.showOlder);
  h += `<button class="fab" data-action="plus" aria-label="${L.add}">${ICONS.plus}</button>`;
  h += tabBar('home');
  return h;
}

// Logo, language and account button: the top of both tabs.
export function appHeader(state, opts) {
  const L = t();
  return `<header class="top">${brand()}
    <div class="top-right">${langToggle()}
      <button class="avatar" data-action="account" aria-label="${L.account}">${esc(initial({ ...opts, profile: state.profile }))}</button>
    </div>
  </header>`;
}

// "Verify your email" reminder for email + password accounts.
function verifyBanner(user, ui) {
  const L = t();
  const msg = ui.error === 'notYet' ? L.verifyNotYet : ui.error === 'tooMany' ? L.errors['auth/too-many-requests']
    : ui.error === 'failed' ? L.errors.default : ui.sent ? L.verifySent : '';
  return `<div class="notice verify" role="status">
    <b>${L.verifyTitle}</b>
    <span>${esc(L.verifyBody(user.email || ''))}</span>
    ${msg ? `<span class="verify-msg">${esc(msg)}</span>` : ''}
    <span class="verify-actions">
      <button class="textbtn link" data-action="verify-resend">${L.verifyResend}</button>
      <button class="textbtn link" data-action="verify-check" ${ui.checking ? 'disabled' : ''}>${L.verifyDone}</button>
    </span>
  </div>`;
}

// This week: trained days against the weekly goal ("2/4 entrenos"), activities, and the streak.
// Without a goal yet it shows routines done and a button to choose one.
function weekCard(week, streak, g) {
  const L = t();
  const n = week.weekActivities.length;
  // Streak line (only once there is one): tapping it opens the Progreso tab.
  const keep = streak.thisWeek ? '' : ` · ${esc(g.goal ? L.streakLeft(g.left) : L.streakKeepIt)}`;
  const streakLine = streak.current
    ? `<button class="week-streak" data-action="tab" data-tab="progress">${ICONS.flame}<span><b>${esc(L.streakWeeks(streak.current))}</b>${keep}</span></button>`
    : '';
  const main = g.goal
    ? `<div class="week-stat"><b class="num" data-count-key="week-days" data-count="${g.days}" data-count-suffix="/${g.goal}">${g.days}/${g.goal}</b><span>${L.workoutsDone(g.goal)}</span></div>`
    : `<div class="week-stat"><b class="num">${week.doneCount}/${week.total}</b><span>${L.routinesDone}</span></div>`;
  const pct = g.goal ? Math.min(100, Math.round((g.days / g.goal) * 100)) : week.pct;
  return `<section class="week" aria-label="${L.thisWeek}">
    <div class="week-head"><div class="label">${L.thisWeek}</div>
      <button class="week-goal" data-action="weekly-goal">${esc(g.goal ? L.goalChip(g.goal) : L.goalSet)}</button></div>
    <div class="week-stats">
      ${main}
      <div class="week-stat"><b class="num" data-count-key="week-acts" data-count="${n}">${n}</b><span>${L.activitiesN(n)}</span></div>
    </div>
    ${g.goal ? dayStrip(week.start, g.dates) : progressBar(pct)}
    ${g.goal && g.met ? `<p class="week-met">${esc(L.goalMet)}</p>` : ''}
    ${streakLine}
  </section>`;
}

// Monday–Sunday, filled on days you trained (a checked set or an activity), today outlined.
// label(n) = what a screen reader says (default: "Entrenaste n días esta semana"); friends' cards pass their own.
export function dayStrip(start, dates, label) {
  const L = t(), today = todayStr();
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return ymd(d); });
  const n = days.filter(d => dates.has(d)).length;
  return `<div class="wdays" role="img" aria-label="${esc((label || L.daysTrainedLabel)(n))}">${days.map((d, i) =>
    `<span class="wday${dates.has(d) ? ' on' : ''}${d === today ? ' today' : ''}"><i>${dates.has(d) ? ICONS.check : ''}</i><b>${L.dayLetters[i]}</b></span>`).join('')}</div>`;
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
      <span class="rcard-text"><h3>${esc(routineName(r))}</h3><p class="meta">${esc(meta)}</p>${status}</span>
      <span class="badge num" aria-hidden="true">${isDone ? ICONS.check : `${done}/${total}`}</span>
    </button>
    ${editDeleteButtons('routine', r.id, routineName(r), true)}
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

// The name to show: the profile's (editable in the app), else the one from sign-up / Google.
export function displayNameOf(profile, user) {
  return ((profile && profile.displayName) || (user && user.displayName) || '').trim();
}

function firstName(name) {
  return name ? name.split(/\s+/)[0] : '';
}

export function initial({ user, profile, localMode }) {
  if (localMode) return '·';
  const s = displayNameOf(profile, user) || (profile && profile.username) || (user && user.email) || '?';
  return s.trim()[0].toUpperCase();
}
