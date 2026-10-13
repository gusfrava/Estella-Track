// Routine screen: progress bar, title, exercise list (finished ones at the bottom), add button.
// Tapping an exercise opens it in place with one row per set (reps × weight, ✓). ui.openId = the open one.
import { ICONS } from '../ui/icons.js';
import { t, getLang } from '../i18n/index.js';
import { esc, fmtDay, fmtNum } from '../utils/format.js';
import { nextMonday, pad2 } from '../utils/dates.js';
import { orderedExercises, routineProgress, weightChange, isRoutineDone, setsToShow, lastTime } from '../state/selectors.js';
import { editDeleteButtons, progressBar } from './partials.js';

export function routineView(state, r, ui = {}) {
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
    ? `<ul class="list exlist">${[...pending, ...checked].map(i => exerciseItem(state, r, i, i.ex.id === ui.openId)).join('')}</ul>`
    : `<div class="empty" style="margin-top:26px"><h3>${L.emptyRoutineTitle}</h3><p>${L.emptyRoutineBody}</p></div>`;

  h += `<button class="add-ex" data-action="new-ex">${ICONS.plus}<span>${L.addExercise}</span></button>`;
  if (done) h += `<button class="textbtn reset" data-action="reset">${L.resetProgress}</button>`;
  return h;
}

// item = { ex: routine exercise, logged: this session's entry or null, done: every set checked }
function exerciseItem(state, r, item, open) {
  const L = t();
  const { ex, logged, done } = item;
  const tg = ex.target;
  const sets = setsToShow(item);
  const nDone = sets.filter(x => x.done).length;
  const partial = !done && nDone > 0;
  const diff = weightChange(state, ex);
  const delta = diff ? `<span class="delta${diff < 0 ? ' down' : ''}">${diff > 0 ? '↑ +' : '↓ '}${fmtNum(diff)} ${tg.unit}</span>` : '';
  const stats = done ? setsSummary(logged.sets) : setsSummary(setsFromPlan(tg));
  const checkLabel = done ? L.markUndone : partial ? L.setsDoneOf(nDone, sets.length) + '. ' + L.markDone : L.markDone;
  return `<li class="ex${done ? ' done' : ''}${open ? ' open' : ''}${partial ? ' partial' : ''}" data-flip="${ex.id}">
    <div class="ex-row">
      <button class="check" data-action="toggle" data-id="${ex.id}" aria-pressed="${done}" aria-label="${checkLabel}: ${esc(ex.name)}">${partial ? `<span class="check-n num">${nDone}/${sets.length}</span>` : ICONS.check}</button>
      <button class="ex-body" data-action="expand" data-id="${ex.id}" aria-expanded="${open}" aria-controls="sets-${ex.id}">
        <span class="ex-name">${esc(ex.name)}</span>
        <span class="stats">${stats}${delta}</span>
      </button>
      ${editDeleteButtons('ex', ex.id, ex.name)}
    </div>
    ${open ? setsPanel(state, r, ex, sets) : ''}
  </li>`;
}

// Number for an input box: no thousands separator; decimal comma in Spanish (both are accepted when reading).
const inputNum = n => String(n).replace('.', getLang() === 'es' ? ',' : '.');

const setsFromPlan = tg => Array.from({ length: tg.sets }, () => ({ reps: tg.reps, weight: tg.weight, unit: tg.unit }));

// "3 series · 10 reps · 60 kg" when all sets are the same, otherwise "10×60 · 10×62,5 · 8×62,5 kg".
function setsSummary(sets) {
  const L = t();
  if (!sets.length) return '';
  const a = sets[0];
  const same = sets.every(x => x.reps === a.reps && x.weight === a.weight && x.unit === a.unit);
  if (same) {
    const weight = a.weight > 0 ? `<span><b>${fmtNum(a.weight)}</b> ${a.unit}</span>` : `<span>${L.bodyweight}</span>`;
    return `<span><b>${sets.length}</b> ${L.setsU(sets.length)}</span><span><b>${a.reps}</b> ${L.repsU}</span>${weight}`;
  }
  return `<span class="setline">${sets.map(x => `<b>${x.reps}</b>×${x.weight > 0 ? fmtNum(x.weight) : '–'}`).join(' · ')} ${a.unit}</span>`;
}

function lastTimeLine(last) {
  const L = t();
  if (!last) return '';
  const when = fmtDay(new Date(last.date + 'T12:00:00'));
  const what = last.sets
    ? last.sets.map(x => `${x.reps}×${x.weight > 0 ? fmtNum(x.weight) : '–'}`).join(' · ') + ` ${last.sets[0].unit}`
    : `${last.point.s}×${last.point.r} · ${fmtNum(last.point.w)} ${last.point.u}`;
  return `<p class="last"><b>${L.lastTime}</b> (${esc(when)}): <span class="num">${esc(what)}</span></p>`;
}

// The open exercise: one row per set. Inputs save when you leave them (change event, see main.js).
function setsPanel(state, r, ex, sets) {
  const L = t();
  const rows = sets.map((x, i) => {
    const n = i + 1;
    return `<li class="set${x.done ? ' done' : ''}">
      <span class="set-n num" aria-hidden="true">${n}</span>
      <input class="set-in num" type="text" inputmode="numeric" enterkeyhint="done" autocomplete="off" data-set="reps" data-id="${ex.id}" data-i="${i}" value="${x.reps}" aria-label="${L.setN(n)}: ${L.repsU}">
      <span class="set-x" aria-hidden="true">×</span>
      <input class="set-in num" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" data-set="weight" data-id="${ex.id}" data-i="${i}" value="${inputNum(x.weight)}" aria-label="${L.setN(n)}: ${L.weight} (${x.unit})">
      <span class="set-u">${x.unit}</span>
      <button class="set-check" data-action="set-tick" data-id="${ex.id}" data-i="${i}" aria-pressed="${!!x.done}" aria-label="${L.setN(n)}: ${x.done ? L.markUndone : L.markDone}">${ICONS.check}</button>
      ${sets.length > 1 ? `<button class="set-del" data-action="set-del" data-id="${ex.id}" data-i="${i}" aria-label="${L.removeSet}: ${L.setN(n)}">×</button>` : '<span></span>'}
    </li>`;
  }).join('');
  return `<div class="sets" id="sets-${ex.id}">
    ${lastTimeLine(lastTime(state, r, ex.id))}
    <div class="set-head" aria-hidden="true"><span>#</span><span>${L.repsU}</span><span></span><span>${L.weight}</span><span></span><span></span><span></span></div>
    <ol class="setlist">${rows}</ol>
    ${sets.length < 50 ? `<button class="add-set" data-action="set-add" data-id="${ex.id}">${ICONS.plus}<span>${L.addSet}</span></button>` : ''}
  </div>`;
}
