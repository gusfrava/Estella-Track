// "Añadir ejercicio": pick from the library. Type to search (Spanish or English, accents don't matter) or tap a muscle
// group. Tap as many exercises as you want (they stay picked while you search) and add them all with one button;
// each gets its library type, per side and a sensible target (weights empty: you fill them in as you train).
// With exactly one picked, "Ajustar antes de añadir" opens the full form for it. "Crear …" = your own exercise.
// From the form's "Cambiar" (opts.change) it's the old one-tap pick: the tapped exercise goes back to the form.
import { openSheet, replaceSheet, closeSheet } from '../ui/sheet.js';
import { t, getLang } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { loadLibrary, searchLibrary, libraryExercise, GROUPS } from '../services/library.js';
import { openExerciseForm } from './exercise-form.js';
import { getState, findRoutine, addExercises } from '../state/store.js';
import { lastUsedUnit } from '../state/selectors.js';
import { toast } from '../ui/toast.js';
import { ICONS } from '../ui/icons.js';
import { feel } from '../ui/feel.js';

// opts.replace = swap the open sheet's content (coming back from the form).
export function openExercisePicker(routineId, { replace = false, change = false } = {}) {
  const L = t();
  let group = '';
  let failed = false;
  const picked = [];   // library ids, in the order they were tapped
  const routine = findRoutine(routineId);
  const inRoutine = new Set(((routine && routine.exercises) || []).map(e => e.exerciseId).filter(Boolean));

  (replace ? replaceSheet : openSheet)(`<h2>${L.addExercise}</h2>
    <input id="lib-q" class="input lib-q" type="search" enterkeyhint="search" autocomplete="off" spellcheck="false"
      placeholder="${esc(L.libSearchPh)}" aria-label="${esc(L.libSearchPh)}">
    <div class="lib-groups" role="group" aria-label="${L.libGroups}">
      ${GROUPS.map(g => `<button type="button" class="lib-chip" data-group="${g}" aria-pressed="false">${L.groups[g]}</button>`).join('')}
    </div>
    <div id="lib-results" class="lib-results" aria-live="polite"><p class="hint">${L.libLoading}</p></div>
    <button type="button" class="btn secondary lib-custom" data-k="custom"></button>
    ${change ? '' : `<div class="lib-bar" hidden>
      <button type="button" class="btn" data-k="add"></button>
      <button type="button" class="textbtn" data-k="tune" hidden>${L.libTune}</button>
    </div>`}`,
  s => {
    const input = s.querySelector('#lib-q');
    const results = s.querySelector('#lib-results');
    const custom = s.querySelector('[data-k=custom]');
    const query = () => input.value.trim();

    const draw = () => {
      custom.textContent = query() ? L.libCustom(query()) : L.libCustomEmpty;
      if (failed) { results.innerHTML = `<p class="hint">${L.libError}</p>`; return; }
      const list = searchLibrary(query(), group, 40);
      const title = !query() ? (group ? L.groups[group] : L.libPopular) : '';
      const item = e => itemHTML(e, { picked: picked.includes(e.id), inRoutine: inRoutine.has(e.id), multi: !change });
      results.innerHTML = list.length
        ? `${title ? `<p class="flabel lib-title">${esc(title)}</p>` : ''}<ul class="lib-list">${list.map(item).join('')}</ul>`
        : `<p class="hint">${esc(L.libNoResults(query()))}</p>`;
    };

    input.addEventListener('input', draw);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
    s.querySelectorAll('[data-group]').forEach(b => b.onclick = () => {
      group = group === b.dataset.group ? '' : b.dataset.group;
      s.querySelectorAll('[data-group]').forEach(x => x.setAttribute('aria-pressed', x.dataset.group === group));
      draw();
    });
    const bar = s.querySelector('.lib-bar');
    const drawBar = () => {
      if (!bar) return;
      bar.hidden = !picked.length;
      bar.querySelector('[data-k=add]').textContent = L.libAddN(picked.length);
      bar.querySelector('[data-k=tune]').hidden = picked.length !== 1;
    };
    results.addEventListener('click', e => {
      const btn = e.target.closest('[data-pick]');
      if (!btn) return;
      const id = btn.dataset.pick;
      if (change) { openExerciseForm(routineId, null, prefillFor(libraryExercise(id)), { replace: true }); return; }
      const i = picked.indexOf(id);
      if (i >= 0) picked.splice(i, 1); else picked.push(id);
      btn.setAttribute('aria-pressed', i < 0);
      btn.classList.toggle('pop', i < 0);
      if (i < 0) feel('select');
      drawBar();
    });
    if (bar) {
      bar.querySelector('[data-k=add]').onclick = () => {
        const unit = lastUsedUnit(getState());
        const list = picked.map(libraryExercise).filter(Boolean).map(e => ({ ...prefillFor(e), weight: 0, unit }));
        addExercises(routineId, list);
        feel('done');
        closeSheet();
        toast(`${ICONS.check}<span><b>${esc(L.libAdded(list.length))}</b></span>`);
      };
      bar.querySelector('[data-k=tune]').onclick = () =>
        openExerciseForm(routineId, null, prefillFor(libraryExercise(picked[0])), { replace: true });
    }
    custom.onclick = () => openExerciseForm(routineId, null, { name: query() }, { replace: true });

    custom.textContent = L.libCustomEmpty;
    loadLibrary().then(draw, () => { failed = true; draw(); });
  });
}

const nameOf = e => (getLang() === 'en' ? e.en : e.n);
// Equipment in the app's language, "barra, banco" / "barbell, bench".
const equipmentOf = e => ((getLang() === 'en' ? e.eqEn : e.eq) || e.eq || '').split(';').map(s => s.trim()).filter(Boolean).join(', ');

function itemHTML(e, { picked = false, inRoutine = false, multi = true } = {}) {
  const L = t();
  const tags = [];
  if (inRoutine) tags.push(L.libInRoutine);
  if (e.type === 'time') tags.push(L.typeTime);
  if (e.type === 'reps') tags.push(L.typeReps);
  if (e.side) tags.push(L.tagSide);
  return `<li><button type="button" class="lib-item${multi ? ' multi' : ''}" data-pick="${esc(e.id)}"${multi ? ` aria-pressed="${picked}"` : ''}>
    ${multi ? `<span class="lib-check" aria-hidden="true">${ICONS.check}</span>` : ''}
    <span class="lib-name">${esc(nameOf(e))}</span>
    <span class="lib-meta">${esc(L.groups[e.g] || '')}${equipmentOf(e) ? ` · ${esc(equipmentOf(e))}` : ''}</span>
    ${tags.length ? `<span class="lib-tags">${tags.map(x => `<span>${esc(x)}</span>`).join('')}</span>` : ''}
  </button></li>`;
}

// What the form starts with for a library exercise: its name, type and per side, and a sensible target.
export function prefillFor(e) {
  const base = { name: nameOf(e), type: e.type, perSide: !!e.side, exerciseId: e.id, sets: 3, reps: 10 };
  if (e.type !== 'time') return base;
  if (e.g === 'cardio') return { ...base, sets: 1, seconds: 20 * 60 };
  if (e.g === 'movilidad') return { ...base, sets: 1, seconds: 10 * 60 };
  return { ...base, sets: 3, seconds: 30 };
}
