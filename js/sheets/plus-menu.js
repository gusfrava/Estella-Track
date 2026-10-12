// The sheet that opens from the + button: new routine or free activity.
import { openSheet } from '../ui/sheet.js';
import { ICONS } from '../ui/icons.js';
import { t } from '../i18n/index.js';
import { openRoutineForm } from './routine-form.js';
import { openActivityForm } from './activity-form.js';

export function openPlusMenu() {
  const L = t();
  openSheet(`<h2>${L.whatToAdd}</h2>
    <button class="choice" data-k="routine"><span class="ico" style="background:var(--orange)">${ICONS.dumbbell}</span>
      <span><b>${L.newRoutine}</b><span>${L.newRoutineSub}</span></span></button>
    <button class="choice" data-k="act"><span class="ico" style="background:var(--teal)">${ICONS.bolt}</span>
      <span><b>${L.freeActivity}</b><span>${L.freeActivitySub}</span></span></button>`,
  s => {
    s.querySelector('[data-k=routine]').onclick = () => openRoutineForm(null);
    s.querySelector('[data-k=act]').onclick = () => openActivityForm(null);
  });
}
