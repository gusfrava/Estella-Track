// Add / edit an exercise: name, type (weight × reps / reps only / time), per side or not, sets and the target.
// Editing also shows its history.
import { openSheet, closeSheet } from '../ui/sheet.js';
import { t } from '../i18n/index.js';
import { esc, fmtDay, fmtNum, fmtClock } from '../utils/format.js';
import { parseYmd } from '../utils/dates.js';
import { getState, findRoutine, addExercise, updateExercise } from '../state/store.js';
import { lastUsedUnit, exerciseHistory } from '../state/selectors.js';
import { stepper, wireSteppers, readNumber } from './fields.js';

// exerciseId = null to add a new one.
export function openExerciseForm(routineId, exerciseId) {
  const L = t();
  const routine = findRoutine(routineId);
  if (!routine) return;
  const ex = exerciseId ? routine.exercises.find(e => e.id === exerciseId) : null;
  const isNew = !ex;
  const tg = ex ? ex.target : null;
  let unit = tg ? tg.unit : lastUsedUnit(getState());
  let type = ex ? ex.type : 'weight_reps';
  let perSide = ex ? ex.perSide : false;
  const secs = tg ? tg.seconds : 60;
  const typeBtn = (v, label) => `<button type="button" data-type="${v}" aria-pressed="${type === v}">${label}</button>`;

  openSheet(`<h2>${isNew ? L.newExercise : L.editExercise}</h2>
    <form id="f-ex" novalidate>
      <div class="field"><label for="f-exname">${L.exName}</label>
        <input id="f-exname" class="input" maxlength="60" autocomplete="off" placeholder="${esc(L.exPh)}" value="${esc(ex ? ex.name : '')}" ${isNew ? 'autofocus' : ''}>
        <span class="err" hidden id="f-exname-err">${L.nameRequired}</span></div>
      <div class="field"><span class="flabel">${L.exType}</span>
        <div class="seg seg-3" role="group" aria-label="${L.exType}">
          ${typeBtn('weight_reps', L.typeWeightReps)}${typeBtn('reps', L.typeReps)}${typeBtn('time', L.typeTime)}
        </div></div>
      <div class="field" data-for-type="weight_reps reps"><button type="button" class="switch" role="switch" id="f-side" aria-checked="${perSide}">
        <span><b>${L.perSide}</b><span>${L.perSideHint}</span></span><span class="track" aria-hidden="true"></span></button></div>
      <div class="row">
        <div class="field"><label for="f-sets">${L.sets}</label>${stepper('f-sets', tg ? tg.sets : 3, 1, 1)}</div>
        <div class="field" data-for-type="weight_reps reps"><label for="f-reps">${L.reps}</label>${stepper('f-reps', tg ? tg.reps : 10, 1, 1)}</div>
      </div>
      <div class="row" data-for-type="time">
        <div class="field"><label for="f-min">${L.minutes}</label>${stepper('f-min', Math.floor(secs / 60), 1, 0)}</div>
        <div class="field"><label for="f-sec">${L.seconds}</label>${stepper('f-sec', secs % 60, 15, 0)}</div>
      </div>
      <span class="err" hidden id="f-time-err">${L.timeRequired}</span>
      <div class="row" data-for-type="weight_reps">
        <div class="field"><label for="f-weight">${L.weight}</label>${stepper('f-weight', tg ? tg.weight : 0, 2.5, 0)}</div>
        <div class="field"><span class="flabel">${L.unit}</span>
          <div class="seg" role="group" aria-label="${L.unit}">
            <button type="button" data-unit="kg" aria-pressed="${unit === 'kg'}">kg</button>
            <button type="button" data-unit="lb" aria-pressed="${unit === 'lb'}">lb</button>
          </div></div>
      </div>
      ${isNew ? '' : historyBlock(exerciseHistory(getState(), ex.id))}
      <div class="actions"><button class="btn" type="submit">${isNew ? L.addExercise : L.save}</button></div>
    </form>`,
  s => {
    wireSteppers(s, id => (id === 'f-weight' ? (unit === 'lb' ? 5 : 2.5) : 0));
    // Seconds roll over into minutes (45 + 15 → 1:00).
    s.querySelectorAll('[data-for="f-sec"]').forEach(btn => btn.onclick = () => {
      const total = Math.max(0, readTime() + parseFloat(btn.dataset.step));
      s.querySelector('#f-min').value = Math.floor(total / 60);
      s.querySelector('#f-sec').value = total % 60;
    });
    const readTime = () => Math.round(readNumber(s, 'f-min', 0) * 60 + readNumber(s, 'f-sec', 0));
    // Only the fields for the chosen type are shown.
    const showType = () => {
      s.querySelectorAll('[data-type]').forEach(x => x.setAttribute('aria-pressed', x.dataset.type === type));
      s.querySelectorAll('[data-for-type]').forEach(el => { el.hidden = !el.dataset.forType.split(' ').includes(type); });
      s.querySelector('#f-time-err').hidden = true;
    };
    s.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { type = b.dataset.type; showType(); });
    const side = s.querySelector('#f-side');
    side.onclick = () => { perSide = !perSide; side.setAttribute('aria-checked', perSide); };
    showType();
    s.querySelectorAll('[data-unit]').forEach(b => b.onclick = () => {
      unit = b.dataset.unit;
      s.querySelectorAll('[data-unit]').forEach(x => x.setAttribute('aria-pressed', x.dataset.unit === unit));
    });
    s.querySelector('#f-ex').onsubmit = e => {
      e.preventDefault();
      const name = s.querySelector('#f-exname').value.trim();
      if (!name) { s.querySelector('#f-exname-err').hidden = false; s.querySelector('#f-exname').focus(); return; }
      const seconds = readTime();
      if (type === 'time' && seconds < 1) { s.querySelector('#f-time-err').hidden = false; return; }
      const data = {
        name, type, perSide: perSide && type !== 'time', seconds: Math.max(1, seconds),
        sets: Math.round(readNumber(s, 'f-sets', 1)),
        reps: Math.round(readNumber(s, 'f-reps', 1)),
        weight: readNumber(s, 'f-weight', 0),
        unit,
      };
      if (isNew) addExercise(routineId, data);
      else updateExercise(routineId, ex.id, data);
      closeSheet();
    };
  });
}

function historyBlock(points) {
  const L = t();
  const entries = points.slice(-8).reverse();
  const list = entries.length
    ? `<ul class="hist">${entries.map(h => `<li>
        <span>${esc(fmtDay(parseYmd(h.d), { weekday: 'short', day: 'numeric', month: 'short' }))}</span>
        <b>${h.t != null ? `${h.s} × ${fmtClock(h.t)}` : `${h.s} × ${h.r}${h.w > 0 ? ' · ' + fmtNum(h.w) + ' ' + h.u : ''}`}</b></li>`).join('')}</ul>`
    : `<p class="hint">${L.noHistory}</p>`;
  return `<div class="field"><span class="flabel">${L.history}</span>${list}</div>`;
}
