// Log / edit a free activity: sport, duration, date, note.
import { openSheet, closeSheet } from '../ui/sheet.js';
import { t } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { todayStr } from '../utils/dates.js';
import { findActivity, addActivity, updateActivity } from '../state/store.js';
import { stepper, wireSteppers, readNumber } from './fields.js';

// activityId = null to log a new one.
export function openActivityForm(activityId) {
  const L = t();
  const s = activityId ? findActivity(activityId) : null;   // an activity session
  const a = s ? s.activity : null;
  const isNew = !a;
  const mins = a ? a.minutes : 60;

  openSheet(`<h2>${isNew ? L.freeActivity : L.editActivity}</h2>
    <form id="f-act" novalidate>
      <div class="field"><label for="f-sport">${L.sport}</label>
        <input id="f-sport" class="input" maxlength="40" autocomplete="off" placeholder="${esc(L.sportPh)}" value="${esc(a ? a.sport : '')}" ${isNew ? 'autofocus' : ''}>
        <span class="err" hidden id="f-sport-err">${L.nameRequired}</span></div>
      <div class="field" style="margin-bottom:6px"><span class="flabel">${L.duration}</span></div>
      <div class="row">
        <div class="field"><label for="f-h" class="hint">${L.hours}</label>${stepper('f-h', Math.floor(mins / 60), 1, 0)}</div>
        <div class="field"><label for="f-m" class="hint">${L.minutes}</label>${stepper('f-m', mins % 60, 15, 0)}</div>
      </div>
      <span class="err" hidden id="f-dur-err" style="display:block;margin:-8px 0 14px">${L.durationRequired}</span>
      <div class="field"><label for="f-date">${L.date}</label>
        <input id="f-date" class="input" type="date" value="${s ? s.date : todayStr()}" max="${todayStr()}"></div>
      <div class="field"><label for="f-note">${L.note}</label>
        <textarea id="f-note" class="input" maxlength="140" placeholder="${esc(L.notePh)}">${esc(a ? a.note : '')}</textarea></div>
      <div class="actions"><button class="btn" type="submit">${isNew ? L.saveActivity : L.save}</button></div>
    </form>`,
  s => {
    wireSteppers(s);
    s.querySelector('#f-act').onsubmit = e => {
      e.preventDefault();
      const sport = s.querySelector('#f-sport').value.trim();
      const minutes = Math.round(readNumber(s, 'f-h') * 60 + readNumber(s, 'f-m'));
      s.querySelector('#f-sport-err').hidden = !!sport;
      s.querySelector('#f-dur-err').hidden = minutes > 0;
      if (!sport) { s.querySelector('#f-sport').focus(); return; }
      if (minutes <= 0) return;
      const data = { sport, minutes, date: s.querySelector('#f-date').value || todayStr(), note: s.querySelector('#f-note').value.trim() };
      if (isNew) addActivity(data);
      else updateActivity(s.id, data);
      closeSheet();
    };
  });
}
