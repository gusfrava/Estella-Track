// Privacy sheet: who can see each kind of data (private / friends / public) + "show me in search".
// Changes save immediately.
import { openSheet } from '../ui/sheet.js';
import { t } from '../i18n/index.js';
import { getState, updateProfile } from '../state/store.js';
import { DEFAULT_SHARING, SHARING_LEVELS } from '../state/model.js';

const CATEGORIES = ['profile', 'routines', 'workouts', 'body'];

export function openPrivacySheet() {
  const L = t();
  const p = getState().profile || {};
  const sharing = { ...DEFAULT_SHARING, ...(p.sharing || {}) };
  const discoverable = p.discoverable !== false;
  const label = { profile: [L.shareProfile, L.shareProfileHint], routines: [L.shareRoutines, L.shareRoutinesHint], workouts: [L.shareWorkouts, L.shareWorkoutsHint], body: [L.shareBody, L.shareBodyHint] };
  const levelText = { private: L.levelPrivate, friends: L.levelFriends, public: L.levelPublic };

  const rows = CATEGORIES.map(cat => `
    <div class="share-row">
      <div><b>${label[cat][0]}</b><span>${label[cat][1]}</span></div>
      <div class="seg seg-3" role="group" aria-label="${label[cat][0]}">
        ${SHARING_LEVELS.map(lv => `<button type="button" data-cat="${cat}" data-level="${lv}" aria-pressed="${sharing[cat] === lv}">${levelText[lv]}</button>`).join('')}
      </div>
    </div>`).join('');

  openSheet(`<h2>${L.privacyTitle}</h2>
    <p class="confirm-body">${L.privacySub}</p>
    <div class="share-list">${rows}</div>
    <div class="field" style="margin-top:18px"><button type="button" class="switch" role="switch" id="p-disc" aria-checked="${discoverable}">
      <span><b>${L.discoverable}</b><span>${L.discoverableHint}</span></span><span class="track" aria-hidden="true"></span></button></div>`,
  s => {
    s.querySelectorAll('[data-cat]').forEach(btn => btn.onclick = () => {
      const cat = btn.dataset.cat, level = btn.dataset.level;
      const current = { ...DEFAULT_SHARING, ...((getState().profile || {}).sharing || {}) };
      if (current[cat] === level) return;
      updateProfile({ sharing: { ...current, [cat]: level } });
      s.querySelectorAll(`[data-cat="${cat}"]`).forEach(b => b.setAttribute('aria-pressed', b.dataset.level === level));
    });
    const sw = s.querySelector('#p-disc');
    sw.onclick = () => {
      const next = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', next);
      updateProfile({ discoverable: next });
    };
  });
}
