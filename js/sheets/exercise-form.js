// Add / edit an exercise: name, sets, reps, weight, kg/lb. Editing also shows its history.
import { openSheet, closeSheet } from '../ui/sheet.js';
import { t } from '../i18n/index.js';
import { esc, fmtDay, fmtNum } from '../utils/format.js';
import { parseYmd } from '../utils/dates.js';
import { getState, findRoutine, addExercise, updateExercise } from '../state/store.js';
import { lastUsedUnit } from '../state/selectors.js';
import { stepper, wireSteppers, readNumber } from './fields.js';

// exerciseId = null to add a new one.
export function openExerciseForm(routineId, exerciseId) {
  const L = t();
  const routine = findRoutine(routineId);
  if (!routine) return;
  const ex = exerciseId ? routine.exercises.find(e => e.id === exerciseId) : null;
  const isNew = !ex;
  let unit = ex ? ex.unit : lastUsedUnit(getState());

  openSheet(`<h2>${isNew ? L.newExercise : L.editExercise}</h2>
    <form id="f-ex" novalidate>
      <div class="field"><label for="f-exname">${L.exName}</label>
        <input id="f-exname" class="input" maxlength="60" autocomplete="off" placeholder="${esc(L.exPh)}" value="${esc(ex ? ex.name : '')}" ${isNew ? 'autofocus' : ''}>
        <span class="err" hidden id="f-exname-err">${L.nameRequired}</span></div>
      <div class="row">
        <div class="field"><label for="f-sets">${L.sets}</label>${stepper('f-sets', ex ? ex.sets : 3, 1, 1)}</div>
        <div class="field"><label for="f-reps">${L.reps}</label>${stepper('f-reps', ex ? ex.reps : 10, 1, 1)}</div>
      </div>
      <div class="row">
        <div class="field"><label for="f-weight">${L.weight}</label>${stepper('f-weight', ex ? ex.weight : 0, 2.5, 0)}</div>
        <div class="field"><span class="flabel">${L.unit}</span>
          <div class="seg" role="group" aria-label="${L.unit}">
            <button type="button" data-unit="kg" aria-pressed="${unit === 'kg'}">kg</button>
            <button type="button" data-unit="lb" aria-pressed="${unit === 'lb'}">lb</button>
          </div></div>
      </div>
      ${isNew ? '' : historyBlock(ex)}
      <div class="actions"><button class="btn" type="submit">${isNew ? L.addExercise : L.save}</button></div>
    </form>`,
  s => {
    wireSteppers(s, id => (id === 'f-weight' ? (unit === 'lb' ? 5 : 2.5) : 0));
    s.querySelectorAll('[data-unit]').forEach(b => b.onclick = () => {
      unit = b.dataset.unit;
      s.querySelectorAll('[data-unit]').forEach(x => x.setAttribute('aria-pressed', x.dataset.unit === unit));
    });
    s.querySelector('#f-ex').onsubmit = e => {
      e.preventDefault();
      const name = s.querySelector('#f-exname').value.trim();
      if (!name) { s.querySelector('#f-exname-err').hidden = false; s.querySelector('#f-exname').focus(); return; }
      const data = {
        name,
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

function historyBlock(ex) {
  const L = t();
  const entries = ex.history.slice(-8).reverse();
  const list = entries.length
    ? `<ul class="hist">${entries.map(h => `<li>
        <span>${esc(fmtDay(parseYmd(h.d), { weekday: 'short', day: 'numeric', month: 'short' }))}</span>
        <b>${h.s} × ${h.r} · ${h.w > 0 ? fmtNum(h.w) + ' ' + h.u : L.bodyweight}</b></li>`).join('')}</ul>`
    : `<p class="hint">${L.noHistory}</p>`;
  return `<div class="field"><span class="flabel">${L.history}</span>${list}</div>`;
}
