// Routine screen: progress bar, title, exercise list (checked ones at the bottom), add button.
import { ICONS } from '../ui/icons.js';
import { t } from '../i18n/index.js';
import { esc, fmtDay, fmtNum } from '../utils/format.js';
import { nextMonday, pad2 } from '../utils/dates.js';
import { orderedExercises, routineProgress, weightChange, isRoutineDone } from '../state/selectors.js';
import { editDeleteButtons, progressBar } from './partials.js';

export function routineView(state, r) {
  const L = t();
  const { done, total, pct } = routineProgress(r);
  const { pending, done: checked } = orderedExercises(r);

  let h = `
  <div class="topbar">
    <button class="round" data-action="home" aria-label="${L.back}">${ICONS.back}</button>
    ${progressBar(pct, `role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"`)}
    <span class="count num">${pad2(done)}/${pad2(total)}</span>
  </div>
  <div class="rhead">
    <div><h1>${esc(r.name)}</h1><p class="sub">${esc(L.exercisesN(total))} · ${r.recurring ? L.weekly : L.once}</p></div>
    ${editDeleteButtons('routine', r.id, r.name)}
  </div>`;

  if (isRoutineDone(r)) {
    const nextReset = fmtDay(nextMonday(), { weekday: 'long', day: 'numeric', month: 'short' });
    h += `<div class="banner">${ICONS.star}<span>${esc(r.recurring ? L.doneThisWeek(nextReset) : L.doneOnce)}</span></div>`;
  }

  h += total
    ? `<ul class="list exlist">${pending.map(i => exerciseItem(state, i)).join('')}${checked.map(i => exerciseItem(state, i)).join('')}</ul>`
    : `<div class="empty" style="margin-top:26px"><h3>${L.emptyRoutineTitle}</h3><p>${L.emptyRoutineBody}</p></div>`;

  h += `<button class="add-ex" data-action="new-ex">${ICONS.plus}<span>${L.addExercise}</span></button>`;
  if (done) h += `<button class="textbtn reset" data-action="reset">${L.resetProgress}</button>`;
  return h;
}

// item = { ex: routine exercise, logged: this session's entry or null }
function exerciseItem(state, { ex, logged }) {
  const L = t();
  const tg = ex.target;
  const done = !!logged;
  const diff = weightChange(state, ex);
  const delta = diff ? `<span class="delta${diff < 0 ? ' down' : ''}">${diff > 0 ? '↑ +' : '↓ '}${fmtNum(diff)} ${tg.unit}</span>` : '';
  const weight = Number(tg.weight) > 0 ? `<span><b>${fmtNum(tg.weight)}</b> ${tg.unit}</span>` : `<span>${L.bodyweight}</span>`;
  return `<li class="ex${done ? ' done' : ''}" data-flip="${ex.id}">
    <button class="check" data-action="toggle" data-id="${ex.id}" aria-pressed="${done}" aria-label="${done ? L.markUndone : L.markDone}: ${esc(ex.name)}">${ICONS.check}</button>
    <button class="ex-body" data-action="edit-ex" data-id="${ex.id}">
      <span class="ex-name">${esc(ex.name)}</span>
      <span class="stats"><span><b>${tg.sets}</b> ${L.setsU(tg.sets)}</span><span><b>${tg.reps}</b> ${L.repsU}</span>${weight}${delta}</span>
    </button>
    ${editDeleteButtons('ex', ex.id, ex.name)}
  </li>`;
}
