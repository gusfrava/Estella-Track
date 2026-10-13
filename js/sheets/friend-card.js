// A person's card: initial, name, @username and what you can do (añadir, cancelar, aceptar / rechazar,
// eliminar de amigos). Opened from search, the friends list, or an invite link.
// Friends also see the other person's week, streak and last workout (views/friend-week.js), can cheer that workout,
// and can see and copy their routines (without weights).
import { openSheet, closeSheet, confirmSheet } from '../ui/sheet.js';
import { t } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { toast } from '../ui/toast.js';
import { ICONS } from '../ui/icons.js';
import { onSocialChange, getSocial } from '../state/social.js';
import * as friends from '../controllers/friends.js';
import { avatarHTML, personName } from '../views/people.js';
import { friendWeekHTML } from '../views/friend-week.js';
import { friendWeek } from '../state/social.js';
import { routineName } from '../i18n/index.js';
import { exerciseName, loadLibrary } from '../services/library.js';
import { fmtClock } from '../utils/format.js';
import { logger } from '../utils/log.js';

const log = logger('friends');

// person = { uid, username, displayName }
export function openFriendCard(person) {
  const F = t().fr;
  const p = { ...person, ...(getSocial().friends[person.uid] || {}) };
  const buttons = () => {
    const rel = friends.relationTo(p.uid);
    const data = `data-uid="${esc(p.uid)}" data-username="${esc(p.username)}" data-name="${esc(p.displayName || '')}"`;
    if (rel === 'me') return `<p class="hint">${F.thisIsYou}</p>`;
    if (rel === 'friend') return `<p class="fr-since">${ICONS.check}<span>${F.isFriend}</span></p>
      <button class="btn secondary danger-text" data-fr="remove" ${data}>${F.remove}</button>`;
    if (rel === 'sent') return `<p class="hint">${F.sentHint}</p><button class="btn secondary" data-fr="cancel" ${data}>${F.cancelReq}</button>`;
    if (rel === 'received') return `<p class="hint">${F.receivedHint}</p>
      <button class="btn" data-fr="accept" ${data}>${F.accept}</button><button class="btn secondary" data-fr="decline" ${data}>${F.decline}</button>`;
    return `<button class="btn" data-fr="add" ${data}>${F.add}</button>`;
  };
  const isFriend = () => friends.relationTo(p.uid) === 'friend';
  const week = () => (isFriend() ? friendWeekHTML(p.uid) : '');
  let shared = null;   // their routines once loaded: { state, routines }
  const routines = () => (isFriend() ? routinesHTML(p, shared) : '');
  openSheet(`<div class="fr-card">${avatarHTML(p, 'big')}<h2>${esc(personName(p))}</h2>
      ${p.displayName ? `<p class="sub">@${esc(p.username)}</p>` : ''}</div>
    <div class="fr-week-box">${week()}</div>
    <div class="fr-routines-box">${routines()}</div>
    <div class="actions fr-actions">${buttons()}</div>`,
  s => {
    const box = s.querySelector('.fr-actions'), weekBox = s.querySelector('.fr-week-box'), rBox = s.querySelector('.fr-routines-box');
    box.addEventListener('click', e => { const b = e.target.closest('[data-fr]'); if (b) runFriendAction(b); });
    weekBox.addEventListener('click', e => { const b = e.target.closest('[data-cheer]'); if (b) sendCheer(p, b); });
    rBox.addEventListener('click', e => {
      const b = e.target.closest('[data-copy]'); if (!b) return;
      const id = b.dataset.copy;
      copy(p, shared, id, () => {   // redraw with "Ya la copiaste", keeping that routine open
        rBox.innerHTML = routines();
        const btn = [...rBox.querySelectorAll('[data-copy]')].find(x => x.dataset.copy === id);
        if (btn) btn.closest('details').open = true;
      });
    });
    const off = onSocialChange(() => {
      if (!s.isConnected) { off(); return; }
      box.innerHTML = buttons();
      weekBox.innerHTML = week();
      if (!isFriend()) rBox.innerHTML = '';
    });
    if (isFriend()) {
      Promise.all([friends.sharedRoutinesOf(p.uid), loadLibrary().catch(() => null)]).then(([res]) => {
        shared = res;
        if (s.isConnected) rBox.innerHTML = routines();
      });
    }
  });
}

// ---------- cheers ----------
function sendCheer(p, btn) {
  const w = friendWeek(p.uid);
  if (!w || !w.last) return;
  btn.disabled = true;
  friends.cheer(p.uid, btn.dataset.cheer, { date: w.last.date, name: lastNameOf(w.last) })
    .catch(err => { log.warn('cheer failed', err); toast(`<span><b>${esc(t().fr.failed)}</b></span>`); })
    .finally(() => { btn.disabled = false; });   // the row redraws itself when the cheer shows up (listener)
}
const lastNameOf = last => (last.kind === 'activity' ? last.sport : routineName({ name: last.name })) || '';

// ---------- their routines ----------
const time = s => (s < 60 ? `${s} s` : s % 60 === 0 ? `${s / 60} min` : fmtClock(s));
const dose = (e, L) => (e.type === 'time'
  ? (e.sets > 1 ? `${e.sets} × ${time(e.seconds)}` : time(e.seconds))
  : `${e.sets} × ${e.reps}${e.perSide ? ` ${L.ob.planPerSide}` : ''}`);

function routinesHTML(p, shared) {
  const L = t(), F = L.fr;
  const head = `<div class="section-head"><h2>${F.routinesTitle}</h2></div>`;
  if (!shared) return `${head}<p class="hint">${F.loading}</p>`;
  if (shared.state === 'hidden') return `${head}<p class="hint">${F.routinesHidden}</p>`;
  if (shared.state === 'none') return `${head}<p class="hint">${F.routinesLater}</p>`;
  if (shared.state !== 'ok') return `${head}<p class="hint">${F.routinesError}</p>`;
  if (!shared.routines.length) return `${head}<p class="hint">${F.routinesNone}</p>`;
  return `${head}<ul class="ob-plan fr-routines">${shared.routines.map(r => {
    const done = friends.alreadyCopied(p.uid, r.id);
    return `<li><details class="ob-plan-r">
      <summary><span class="ob-plan-t"><b>${esc(routineName(r))}</b><span>${esc(L.ob.planCount(r.exercises.length))}</span></span>
        <span class="ob-plan-chev" aria-hidden="true">${ICONS.back}</span></summary>
      <ol class="ob-plan-ex">${r.exercises.map(e => `<li><span>${esc(exerciseName(e))}</span><b class="num">${esc(dose(e, L))}</b></li>`).join('')}</ol>
      <div class="fr-copy">
        ${done ? `<p class="fr-since">${ICONS.check}<span>${F.copied}</span></p>` : ''}
        <button type="button" class="btn${done ? ' secondary' : ''}" data-copy="${esc(r.id)}">${done ? F.copyAgain : F.copy}</button>
        <p class="hint">${F.copyHint}</p>
      </div>
    </details></li>`;
  }).join('')}</ul>`;
}

function copy(p, shared, routineId, redraw) {
  const r = shared && shared.routines && shared.routines.find(x => x.id === routineId);
  if (!r) return;
  friends.copyRoutine(p, r);
  toast(`${ICONS.check}<span><b>${esc(t().fr.copiedToast)}</b>${esc(routineName(r))}</span>`);
  redraw();
}

// Runs the action of a [data-fr] button (add / cancel / accept / decline / remove). The lists update by
// themselves (Firestore listeners); here we only show "working…" and an error if it fails.
export function runFriendAction(btn) {
  const F = t().fr;
  const kind = btn.dataset.fr, p = { uid: btn.dataset.uid, username: btn.dataset.username, displayName: btn.dataset.name };
  if (kind === 'remove') {
    confirmSheet(F.removeTitle(personName(p)), F.removeBody, () => run(() => friends.remove(p.uid)));
    return;
  }
  const fn = { add: () => friends.add(p), cancel: () => friends.cancel(p.uid), accept: () => friends.accept(p.uid), decline: () => friends.decline(p.uid) }[kind];
  if (!fn) return;
  btn.disabled = true;
  run(fn, () => { btn.disabled = false; });
  if (kind === 'add') toast(`${ICONS.check}<span><b>${esc(F.sentToast)}</b>${esc(personName(p))}</span>`);
}

function run(fn, onError = () => {}) {
  fn().catch(err => {
    log.warn('friend action failed', err);
    onError();
    toast(`<span><b>${esc(t().fr.failed)}</b></span>`);
  });
}

export { closeSheet };
