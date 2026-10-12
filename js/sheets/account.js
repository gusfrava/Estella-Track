// Account sheet (avatar button): who's signed in + sign out, or local-mode info + leave.
import { openSheet, closeSheet } from '../ui/sheet.js';
import { t } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { getSession } from '../state/session.js';
import { signOutUser, exitLocalMode } from '../services/sync.js';
import { initial } from '../views/home.js';
import { logger } from '../utils/log.js';

const log = logger('auth');

export function openAccountSheet() {
  const L = t();
  const { user, localMode } = getSession();
  const card = localMode
    ? `<div class="acct"><span class="avatar big" aria-hidden="true">·</span>
        <span><b>${L.localMode}</b><span>${L.localModeBody}</span></span></div>`
    : `<div class="acct"><span class="avatar big" aria-hidden="true">${esc(initial({ user, localMode }))}</span>
        <span>${user.displayName ? `<b>${esc(user.displayName)}</b>` : ''}<span>${esc(user.email || '')}</span></span></div>`;

  openSheet(`<h2>${L.account}</h2>${card}
    <div class="actions"><button class="btn secondary" data-k="out">${localMode ? L.exitLocal : L.signOut}</button></div>`,
  s => {
    s.querySelector('[data-k=out]').onclick = () => {
      closeSheet(true);
      if (localMode) exitLocalMode();
      else signOutUser().catch(err => log.warn('sign out failed', err));
    };
  });
}
