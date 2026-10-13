// "Añadir ejercicio", step 1: pick from the library. Type to search (Spanish or English, accents don't matter)
// or tap a muscle group. Picking opens the exercise form already filled in (type, per side, sensible sets).
// "Crear …" opens the same form empty for your own exercise.
import { openSheet, replaceSheet } from '../ui/sheet.js';
import { t, getLang } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { loadLibrary, searchLibrary, libraryExercise, GROUPS } from '../services/library.js';
import { openExerciseForm } from './exercise-form.js';

// opts.replace = swap the open sheet's content (coming back from the form).
export function openExercisePicker(routineId, { replace = false } = {}) {
  const L = t();
  let group = '';
  let failed = false;

  (replace ? replaceSheet : openSheet)(`<h2>${L.addExercise}</h2>
    <input id="lib-q" class="input lib-q" type="search" enterkeyhint="search" autocomplete="off" spellcheck="false"
      placeholder="${esc(L.libSearchPh)}" aria-label="${esc(L.libSearchPh)}">
    <div class="lib-groups" role="group" aria-label="${L.libGroups}">
      ${GROUPS.map(g => `<button type="button" class="lib-chip" data-group="${g}" aria-pressed="false">${L.groups[g]}</button>`).join('')}
    </div>
    <div id="lib-results" class="lib-results" aria-live="polite"><p class="hint">${L.libLoading}</p></div>
    <button type="button" class="btn secondary lib-custom" data-k="custom"></button>`,
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
      results.innerHTML = list.length
        ? `${title ? `<p class="flabel lib-title">${esc(title)}</p>` : ''}<ul class="lib-list">${list.map(itemHTML).join('')}</ul>`
        : `<p class="hint">${esc(L.libNoResults(query()))}</p>`;
    };

    input.addEventListener('input', draw);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
    s.querySelectorAll('[data-group]').forEach(b => b.onclick = () => {
      group = group === b.dataset.group ? '' : b.dataset.group;
      s.querySelectorAll('[data-group]').forEach(x => x.setAttribute('aria-pressed', x.dataset.group === group));
      draw();
    });
    results.addEventListener('click', e => {
      const btn = e.target.closest('[data-pick]');
      if (btn) openExerciseForm(routineId, null, prefillFor(libraryExercise(btn.dataset.pick)), { replace: true });
    });
    custom.onclick = () => openExerciseForm(routineId, null, { name: query() }, { replace: true });

    custom.textContent = L.libCustomEmpty;
    loadLibrary().then(draw, () => { failed = true; draw(); });
  });
}

const nameOf = e => (getLang() === 'en' ? e.en : e.n);

function itemHTML(e) {
  const L = t();
  const tags = [];
  if (e.type === 'time') tags.push(L.typeTime);
  if (e.type === 'reps') tags.push(L.typeReps);
  if (e.side) tags.push(L.tagSide);
  return `<li><button type="button" class="lib-item" data-pick="${esc(e.id)}">
    <span class="lib-name">${esc(nameOf(e))}</span>
    <span class="lib-meta">${esc(L.groups[e.g] || '')}${e.eq ? ` · ${esc(e.eq)}` : ''}</span>
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
