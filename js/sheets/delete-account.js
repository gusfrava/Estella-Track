// "Delete account" sheet: explains what's deleted, asks to type a word, confirms identity, then deletes everything.
import { openSheet, closeSheet } from '../ui/sheet.js';
import { t } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { getSession } from '../state/session.js';
import * as fb from '../services/firebase.js';
import { deleteAccount } from '../controllers/account.js';
import { wireExportButton } from './account.js';
import { errorMessage, showInfo } from '../controllers/auth.js';
import { logger } from '../utils/log.js';

const log = logger('account');

export function openDeleteAccountSheet() {
  const L = t();
  const user = getSession().user;
  const usesPassword = fb.signInMethod(user) === 'password';
  const word = L.deleteWord;

  openSheet(`<h2>${L.deleteTitle}</h2>
    <p class="confirm-body">${L.deleteBody}</p>
    <ul class="consent-points">
      <li>${L.deleteWhat1}</li><li>${L.deleteWhat2}</li><li>${L.deleteWhat3}</li>
    </ul>
    <button type="button" class="btn secondary small" data-k="export" style="margin-bottom:8px">${L.deleteExportFirst}</button>
    <div id="d-export-msg" style="margin-bottom:8px"></div>
    <form id="f-delete" novalidate>
      ${usesPassword ? `<div class="field"><label for="d-pw">${L.deletePassword}</label>
        <input id="d-pw" class="input" type="password" autocomplete="current-password"></div>` : `<p class="hint" style="margin-bottom:14px">${L.deleteGoogle}</p>`}
      <div class="field"><label for="d-word">${L.deleteType(word)}</label>
        <input id="d-word" class="input" autocomplete="off" autocapitalize="characters" spellcheck="false"></div>
      <div id="d-error"></div>
      <div class="actions">
        <button class="btn danger" type="submit" id="d-go" disabled>${L.deleteConfirm}</button>
        <button class="btn secondary" type="button" data-k="cancel">${L.cancel}</button>
      </div>
    </form>`,
  s => {
    const go = s.querySelector('#d-go');
    const wordInput = s.querySelector('#d-word');
    const errBox = s.querySelector('#d-error');
    const showErr = msg => { errBox.innerHTML = msg ? `<div class="formmsg err-box" role="alert">${esc(msg)}</div>` : ''; };
    wordInput.addEventListener('input', () => { go.disabled = wordInput.value.trim().toUpperCase() !== word; });
    s.querySelector('[data-k=cancel]').onclick = () => closeSheet();
    wireExportButton(s.querySelector('[data-k=export]'), s.querySelector('#d-export-msg'));
    s.querySelector('#f-delete').onsubmit = async e => {
      e.preventDefault();
      if (go.disabled) return;
      const pw = usesPassword ? s.querySelector('#d-pw').value : null;
      if (usesPassword && !pw) { showErr(L.pwReq); return; }
      go.disabled = true; go.textContent = L.deleting; showErr('');
      try {
        await deleteAccount({ password: pw });
        closeSheet(true);
        showInfo(L.deleteDone);
      } catch (err) {
        log.warn('delete failed', err);
        go.disabled = false; go.textContent = L.deleteConfirm;
        const c = err && err.code;
        if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return;
        showErr(c && c.startsWith('auth/') ? errorMessage(err) : L.deleteFailed);
      }
    };
  });
}
