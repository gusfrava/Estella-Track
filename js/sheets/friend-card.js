// A person's card: initial, name, @username and what you can do (añadir, cancelar, aceptar / rechazar,
// eliminar de amigos). Opened from search, the friends list, or an invite link.
// Friends also see the other person's week, streak and last workout (views/friend-week.js).
import { openSheet, closeSheet, confirmSheet } from '../ui/sheet.js';
import { t } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { toast } from '../ui/toast.js';
import { ICONS } from '../ui/icons.js';
import { onSocialChange, getSocial } from '../state/social.js';
import * as friends from '../controllers/friends.js';
import { avatarHTML, personName } from '../views/people.js';
import { friendWeekHTML } from '../views/friend-week.js';
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
  const week = () => (friends.relationTo(p.uid) === 'friend' ? friendWeekHTML(p.uid) : '');
  openSheet(`<div class="fr-card">${avatarHTML(p, 'big')}<h2>${esc(personName(p))}</h2>
      ${p.displayName ? `<p class="sub">@${esc(p.username)}</p>` : ''}</div>
    <div class="fr-week-box">${week()}</div>
    <div class="actions fr-actions">${buttons()}</div>`,
  s => {
    const box = s.querySelector('.fr-actions'), weekBox = s.querySelector('.fr-week-box');
    box.addEventListener('click', e => { const b = e.target.closest('[data-fr]'); if (b) runFriendAction(b); });
    const off = onSocialChange(() => {
      if (!s.isConnected) { off(); return; }
      box.innerHTML = buttons();
      weekBox.innerHTML = week();
    });
  });
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
