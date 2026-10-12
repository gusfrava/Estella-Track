// Create / edit a routine (name + "repeats every week").
import { openSheet, closeSheet } from '../ui/sheet.js';
import { t } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { addRoutine, updateRoutine } from '../state/store.js';
import { openRoutine } from '../ui/router.js';

// routine = null to create a new one.
export function openRoutineForm(routine) {
  const L = t();
  const isNew = !routine;
  let recurring = routine ? !!routine.recurring : true;

  openSheet(`<h2>${isNew ? L.newRoutine : L.editRoutine}</h2>
    <form id="f-routine" novalidate>
      <div class="field"><label for="f-rname">${L.routineName}</label>
        <input id="f-rname" class="input" maxlength="60" autocomplete="off" placeholder="${esc(L.routinePh)}" value="${esc(routine ? routine.name : '')}" autofocus>
        <span class="err" hidden id="f-rname-err">${L.nameRequired}</span></div>
      <div class="field"><button type="button" class="switch" role="switch" id="f-recur" aria-checked="${recurring}">
        <span><b>${L.repeatWeekly}</b><span>${L.repeatWeeklyHint}</span></span><span class="track" aria-hidden="true"></span></button></div>
      <div class="actions"><button class="btn" type="submit">${isNew ? L.create : L.save}</button></div>
    </form>`,
  s => {
    const sw = s.querySelector('#f-recur');
    sw.onclick = () => { recurring = !recurring; sw.setAttribute('aria-checked', recurring); };
    s.querySelector('#f-routine').onsubmit = e => {
      e.preventDefault();
      const name = s.querySelector('#f-rname').value.trim();
      if (!name) { s.querySelector('#f-rname-err').hidden = false; s.querySelector('#f-rname').focus(); return; }
      if (isNew) {
        const r = addRoutine({ name, recurring });
        closeSheet(true);
        openRoutine(r.id);
      } else {
        updateRoutine(routine.id, { name, recurring });
        closeSheet();
      }
    };
  });
}
