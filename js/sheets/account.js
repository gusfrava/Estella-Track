// Account sheet (avatar button): who you are, edit profile, privacy, sign out — or local-mode info + leave.
import { openSheet, closeSheet } from '../ui/sheet.js';
import { t } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { getSession } from '../state/session.js';
import { getState } from '../state/store.js';
import { signOutUser, exitLocalMode } from '../services/sync.js';
import { initial, displayNameOf } from '../views/home.js';
import { openPrivacySheet } from './privacy.js';
import { openProfileSheet } from './profile-form.js';
import { logger } from '../utils/log.js';

const log = logger('auth');

export function openAccountSheet() {
  const L = t();
  const { user, localMode } = getSession();
  const profile = getState().profile;

  if (localMode) {
    openSheet(`<h2>${L.account}</h2>
      <div class="acct"><span class="avatar big" aria-hidden="true">·</span><span><b>${L.localMode}</b><span>${L.localModeBody}</span></span></div>
      <div class="actions"><button class="btn secondary" data-k="out">${L.exitLocal}</button></div>`,
    s => { s.querySelector('[data-k=out]').onclick = () => { closeSheet(true); exitLocalMode(); }; });
    return;
  }

  const name = displayNameOf(profile, user);
  const handle = profile && profile.username ? `@${profile.username}` : '';
  openSheet(`<h2>${L.account}</h2>
    <div class="acct"><span class="avatar big" aria-hidden="true">${esc(initial({ user, profile }))}</span>
      <span>${name ? `<b>${esc(name)}</b>` : ''}${handle ? `<span class="handle-text">${esc(handle)}</span>` : ''}<span>${esc(user.email || '')}</span></span></div>
    <div class="actions">
      <button class="btn secondary" data-k="edit">${L.editProfile}</button>
      <button class="btn secondary" data-k="privacy">${L.privacy}</button>
      <button class="textbtn danger" data-k="out">${L.signOut}</button>
    </div>`,
  s => {
    s.querySelector('[data-k=edit]').onclick = () => openProfileSheet();
    s.querySelector('[data-k=privacy]').onclick = () => openPrivacySheet();
    s.querySelector('[data-k=out]').onclick = () => {
      closeSheet(true);
      signOutUser().catch(err => log.warn('sign out failed', err));
    };
  });
}
