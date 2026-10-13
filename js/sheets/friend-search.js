// "Buscar amigos": type a name or @username; results update as you type, each with the right button
// (Añadir / Pendiente / Aceptar / Amigos). Tapping a result opens their card.
import { openSheet } from '../ui/sheet.js';
import { t } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { onSocialChange } from '../state/social.js';
import * as friends from '../controllers/friends.js';
import { avatarHTML, personText, relationButton } from '../views/people.js';
import { openFriendCard, runFriendAction } from './friend-card.js';

const DEBOUNCE_MS = 300;

export function openFriendSearch() {
  const F = t().fr;
  let results = [], query = '', timer = null, seq = 0, state = 'idle';   // idle | loading | done | error

  openSheet(`<h2>${F.searchTitle}</h2>
    <input id="fr-q" class="input" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false"
      placeholder="${esc(F.searchPh)}" aria-label="${esc(F.searchPh)}" autofocus>
    <div id="fr-results" class="fr-results" aria-live="polite"></div>
    <p class="hint fr-hint">${F.searchHint}</p>`,
  s => {
    const input = s.querySelector('#fr-q'), box = s.querySelector('#fr-results');
    const draw = () => {
      if (!s.isConnected) return;
      if (state === 'idle') { box.innerHTML = ''; return; }
      if (state === 'loading' && !results.length) { box.innerHTML = `<p class="hint">${F.searching}</p>`; return; }
      if (state === 'error') { box.innerHTML = `<p class="hint">${F.searchError}</p>`; return; }
      if (!results.length) { box.innerHTML = `<p class="hint">${esc(F.noResults(query))}</p>`; return; }
      box.innerHTML = `<ul class="list people">${results.map(p => `<li class="person">
        <button type="button" class="person-open" data-open="${esc(p.uid)}">${avatarHTML(p)}${personText(p)}</button>
        <span class="pbtns">${relationButton(p, friends.relationTo(p.uid))}</span></li>`).join('')}</ul>`;
    };
    const run = () => {
      const q = input.value, mine = ++seq;
      query = q.trim();
      if (query.replace(/^@/, '').length < 2) { state = 'idle'; results = []; draw(); return; }
      state = 'loading'; draw();
      friends.search(q).then(list => { if (mine === seq) { results = list; state = 'done'; draw(); } },
        () => { if (mine === seq) { state = 'error'; draw(); } });
    };
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, DEBOUNCE_MS); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); run(); input.blur(); } });
    box.addEventListener('click', e => {
      const open = e.target.closest('[data-open]');
      if (open) { const p = results.find(x => x.uid === open.dataset.open); if (p) openFriendCard(p); return; }
      const b = e.target.closest('[data-fr]');
      if (b) runFriendAction(b);
    });
    // Requests change (sent, accepted…) → redraw the buttons while the sheet is open.
    const off = onSocialChange(() => { if (!s.isConnected) off(); else draw(); });
  });
}
