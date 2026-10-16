// Account sheet (avatar button): who you are, edit profile, privacy, your data, sign out, delete account.
// In local mode: local-mode info + leave.
import { feel, feelPrefs, setFeelPref, canVibrate } from '../ui/feel.js';
import { openSheet, closeSheet, replaceSheet } from '../ui/sheet.js';
import { t, setLang } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { getSession } from '../state/session.js';
import { getState } from '../state/store.js';
import { signOutUser, exitLocalMode } from '../services/sync.js';
import { initial, displayNameOf } from '../views/home.js';
import { legalLinks, langToggle } from '../views/partials.js';
import { openPrivacySheet } from './privacy.js';
import { openProfileSheet } from './profile-form.js';
import { openDeleteAccountSheet } from './delete-account.js';
import { replayOnboarding } from '../controllers/onboarding.js';
import { prepareMyData, saveMyData, usesShareSheet } from '../controllers/account.js';
import { logger } from '../utils/log.js';

import { mascotHTML, selectedCharacter } from '../ui/mascot.js';

const log = logger('account');

export function openAccountSheet({ replace = false } = {}) {
  const L = t();
  const show = replace ? replaceSheet : openSheet;
  const { user, localMode } = getSession();
  const profile = getState().profile;

  if (localMode) {
    show(`<h2>${L.account}</h2>
      <div class="acct"><span class="avatar big" aria-hidden="true">·</span><span><b>${L.localMode}</b><span>${L.localModeBody}</span></span></div>
      ${languageSetting()}
      <div class="actions"><button class="btn secondary" data-k="out">${L.exitLocal}</button></div>`,
    s => { wireLanguage(s); s.querySelector('[data-k=out]').onclick = () => { closeSheet(true); exitLocalMode(); }; });
    return;
  }

  const name = displayNameOf(profile, user);
  const handle = profile && profile.username ? `@${profile.username}` : '';
  show(`<h2>${L.account}</h2>
    <div class="acct"><span class="avatar big" aria-hidden="true">${esc(initial({ user, profile }))}</span>
      <span>${name ? `<b>${esc(name)}</b>` : ''}${handle ? `<span class="handle-text">${esc(handle)}</span>` : ''}<span>${esc(user.email || '')}</span></span></div>
    ${languageSetting()}
    <div class="actions">
      <button class="btn secondary" data-k="edit">${L.editProfile}</button>
      <button class="btn secondary" data-k="privacy">${L.privacy}</button>
      <button class="btn secondary" data-k="export">${L.exportData}</button>
      <button class="btn secondary" data-k="intro">${L.ob.replay}</button>
      ${feelSwitches()}
      <div id="acct-msg"></div>
      <button class="textbtn" data-k="out">${L.signOut}</button>
      <button class="textbtn danger" data-k="delete">${L.deleteAccount}</button>
    </div>
    ${legalLinks()}`,
  s => {
    wireLanguage(s);
    s.querySelector('[data-k=edit]').onclick = () => openProfileSheet();
    s.querySelector('[data-k=privacy]').onclick = () => openPrivacySheet();
    s.querySelector('[data-k=delete]').onclick = () => openDeleteAccountSheet();
    s.querySelector('[data-k=intro]').onclick = () => { closeSheet(true); replayOnboarding(); };
    wireExportButton(s.querySelector('[data-k=export]'), s.querySelector('#acct-msg'));
    wireFeelSwitches(s);
    s.querySelector('[data-k=out]').onclick = () => {
      closeSheet(true);
      signOutUser().catch(err => log.warn('sign out failed', err));
    };
  });
}

function languageSetting() {
  return `<div class="account-language"><b>${esc(t().language)}</b>${langToggle()}</div>`;
}
function wireLanguage(sheet) {
  sheet.querySelectorAll('[data-action="lang"]').forEach(button => {
    button.onclick = () => {
      if (button.getAttribute('aria-pressed') === 'true') return;
      setLang(button.dataset.lang);
      openAccountSheet({ replace: true });
      document.querySelector(`.account-language [data-lang="${button.dataset.lang}"]`)?.focus({ preventScroll: true });
    };
  });
}

// "Download my data" button. Step 1 prepares the file; on phones step 2 ("Save file") opens the share sheet.
export function wireExportButton(btn, msgBox) {
  const L = t();
  const msg = (cls, text) => { msgBox.innerHTML = text ? `<div class="formmsg ${cls}">${esc(text)}</div>` : ''; };
  let file = null;
  const save = async () => {
    const result = await saveMyData(file);
    if (result === 'downloaded') msg('ok-box', L.exportDone);
    else if (result === 'shared') msg('ok-box', L.exportShared);
  };
  btn.onclick = async () => {
    if (file) { save(); return; }
    btn.disabled = true; btn.textContent = L.exporting; msg('', '');
    try {
      file = await prepareMyData();
      btn.disabled = false;
      if (usesShareSheet(file)) { btn.textContent = L.exportSave; msg('ok-box', L.exportReady); }
      else { btn.textContent = L.exportData; await save(); file = null; }
    } catch (err) {
      log.warn('export failed', err);
      btn.disabled = false; btn.textContent = L.exportData; file = null;
      msg('err-box', L.exportFailed);
    }
  };
}

// "Sonidos" and "Vibración" (saved on this phone). Vibración only shows where the phone can vibrate.
function feelSwitches() {
  const L = t(), p = feelPrefs();
  const sw = (k, label, hint) => `<button type="button" class="switch" role="switch" data-feel="${k}" aria-checked="${p[k]}">
    <span><b>${label}</b><span>${hint}</span></span><span class="track" aria-hidden="true"></span></button>`;
  return `<div class="feel-switches">${sw('sound', L.feelSound, L.feelSoundHint)}${canVibrate() ? sw('haptics', L.feelHaptics, L.feelHapticsHint) : ''}</div>`;
}
function wireFeelSwitches(s) {
  s.querySelectorAll('[data-feel]').forEach(b => b.onclick = () => {
    const on = b.getAttribute('aria-checked') !== 'true';
    b.setAttribute('aria-checked', on);
    setFeelPref(b.dataset.feel, on);
    if (on) feel(b.dataset.feel === 'sound' ? 'check' : 'done');   // a sample of what you turned on
  });
}
