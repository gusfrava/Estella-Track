// Account sheet (avatar button): who you are, edit profile, privacy, your data, sign out, delete account.
// In local mode: local-mode info + leave.
import { openSheet, closeSheet } from '../ui/sheet.js';
import { t } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { getSession } from '../state/session.js';
import { getState } from '../state/store.js';
import { signOutUser, exitLocalMode } from '../services/sync.js';
import { initial, displayNameOf } from '../views/home.js';
import { legalLinks } from '../views/partials.js';
import { openPrivacySheet } from './privacy.js';
import { openProfileSheet } from './profile-form.js';
import { openDeleteAccountSheet } from './delete-account.js';
import { downloadMyData } from '../controllers/account.js';
import { logger } from '../utils/log.js';

const log = logger('account');

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
      <button class="btn secondary" data-k="export">${L.exportData}</button>
      <div id="acct-msg"></div>
      <button class="textbtn" data-k="out">${L.signOut}</button>
      <button class="textbtn danger" data-k="delete">${L.deleteAccount}</button>
    </div>
    ${legalLinks()}`,
  s => {
    s.querySelector('[data-k=edit]').onclick = () => openProfileSheet();
    s.querySelector('[data-k=privacy]').onclick = () => openPrivacySheet();
    s.querySelector('[data-k=delete]').onclick = () => openDeleteAccountSheet();
    const exportBtn = s.querySelector('[data-k=export]');
    exportBtn.onclick = async () => {
      exportBtn.disabled = true; exportBtn.textContent = L.exporting;
      try { await downloadMyData(); s.querySelector('#acct-msg').innerHTML = `<div class="formmsg ok-box">${esc(L.exportDone)}</div>`; }
      catch (err) { log.warn('export failed', err); s.querySelector('#acct-msg').innerHTML = `<div class="formmsg err-box">${esc(L.exportFailed)}</div>`; }
      exportBtn.disabled = false; exportBtn.textContent = L.exportData;
    };
    s.querySelector('[data-k=out]').onclick = () => {
      closeSheet(true);
      signOutUser().catch(err => log.warn('sign out failed', err));
    };
  });
}
