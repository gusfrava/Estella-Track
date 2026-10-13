// Small pieces for showing a person (Amigos screen, search, friend card): round initial + name + @username,
// and the button that fits how you're related (añadir / pendiente / aceptar / amigos).
import { t } from '../i18n/index.js';
import { esc } from '../utils/format.js';

// Names come from other people's documents: never assume they're text.
const text = v => (typeof v === 'string' ? v : '').trim();
export const personName = p => text(p.displayName) || `@${text(p.username) || '?'}`;

export function avatarHTML(p, size = '') {
  const s = ([...(text(p.displayName) || text(p.username))][0] || '?').toUpperCase();
  return `<span class="pav${size ? ' ' + size : ''}" aria-hidden="true">${esc(s)}</span>`;
}

export function personText(p) {
  return `<span class="ptext"><b>${esc(personName(p))}</b>${p.displayName ? `<span>@${esc(p.username)}</span>` : ''}</span>`;
}

// rel = controllers/friends.relationTo(uid). data-* carry what the action needs.
export function relationButton(p, rel) {
  const L = t().fr;
  const data = `data-uid="${esc(p.uid)}" data-username="${esc(p.username)}" data-name="${esc(p.displayName || '')}"`;
  if (rel === 'friend') return `<span class="pchip">${L.isFriend}</span>`;
  if (rel === 'sent') return `<button type="button" class="pbtn" data-fr="cancel" ${data}>${L.pending}</button>`;
  if (rel === 'received') return `<button type="button" class="pbtn ok" data-fr="accept" ${data}>${L.accept}</button>`;
  if (rel === 'me') return `<span class="pchip">${L.you}</span>`;
  return `<button type="button" class="pbtn ok" data-fr="add" ${data}>${L.add}</button>`;
}
