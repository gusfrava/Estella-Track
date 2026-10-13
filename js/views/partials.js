// Small HTML pieces shared by several screens.
// Views only build HTML strings. Buttons carry data-action="..." and main.js decides what each one does.
import { ICONS } from '../ui/icons.js';
import { t, getLang } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { LEGAL } from '../config.js';
import { pendingIncoming, unseenCheers } from '../state/social.js';
import { cheersSeenAt } from '../controllers/friends.js';

export const brand = () => `<div class="brand">${ICONS.star}<span>Estella</span></div>`;

export function langToggle() {
  const lang = getLang();
  return `<div class="lang" role="group" aria-label="Idioma / Language">
    <button data-action="lang" data-lang="es" aria-pressed="${lang === 'es'}">ES</button>
    <button data-action="lang" data-lang="en" aria-pressed="${lang === 'en'}">EN</button>
  </div>`;
}

// Pen (edit) + bin (delete) buttons. kind = 'routine' | 'ex' | 'act' → actions edit-<kind> / del-<kind>.
export function editDeleteButtons(kind, id, name, stacked = false) {
  const L = t();
  return `<div class="ibtns${stacked ? ' stack' : ''}">
    <button class="ib edit" data-action="edit-${kind}" data-id="${id}" aria-label="${L.edit}: ${esc(name)}">${ICONS.pen}</button>
    <button class="ib del" data-action="del-${kind}" data-id="${id}" aria-label="${L.del}: ${esc(name)}">${ICONS.bin}</button>
  </div>`;
}

export function progressBar(pct, extra = '') {
  return `<div class="bar" ${extra}><span data-w="${pct}" style="width:${pct}%"></span></div>`;
}

// "Privacy · Terms" links (open in a new tab so the app keeps its place).
export function legalLinks() {
  const L = t();
  return `<p class="legal-links"><a href="${LEGAL.privacyUrl}" target="_blank" rel="noopener">${L.privacyPolicy}</a> · <a href="${LEGAL.termsUrl}" target="_blank" rel="noopener">${L.terms}</a></p>`;
}

// Bottom tabs on the main screens. active = 'home' | 'progress' | 'friends'.
// Amigos shows a count when friend requests are waiting.
export function tabBar(active) {
  const L = t();
  // Badge on Amigos: friend requests to answer + cheers I haven't seen (not while I'm on Amigos).
  const waiting = pendingIncoming().length + (active === 'friends' ? 0 : unseenCheers(cheersSeenAt()));
  const tab = (name, icon, label, badge = 0) => `<button class="tab" data-action="tab" data-tab="${name}" ${active === name ? 'aria-current="page"' : ''}>${icon}<span>${label}</span>${badge ? `<em class="tab-badge num" aria-label="${esc(L.fr.badgeLabel(badge))}">${badge}</em>` : ''}</button>`;
  return `<nav class="tabbar" aria-label="${L.tabsLabel}">
    ${tab('home', ICONS.dumbbellTab, L.tabRoutines)}${tab('progress', ICONS.trophy, L.tabProgress)}${tab('friends', ICONS.users, L.tabFriends, waiting)}
  </nav>`;
}
