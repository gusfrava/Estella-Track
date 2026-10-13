// Sign-in screens: login, create account, reset password.
// ui = the auth controller's state (screen, error, info, busy, showPw, name, email, password).
import { ICONS } from '../ui/icons.js';
import { t } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { brand, langToggle, legalLinks } from './partials.js';
import { LEGAL, PASSWORD_POLICY } from '../config.js';
import { passwordChecks } from '../utils/password.js';

export function authView(ui, { configured, fatal }) {
  const L = t();
  let h = `<header class="top">${brand()}${langToggle()}</header>`;
  if (!configured) h += `<div class="notice">${esc(L.notConfigured)}</div>`;
  if (fatal) h += `<div class="formmsg err-box" role="alert">${esc(L[fatal] || fatal)}</div>`;

  const error = ui.error ? `<div class="formmsg err-box" role="alert">${esc(ui.error)}</div>` : '';

  if (ui.screen === 'reset') {
    return h + `<h1>${L.resetTitle}</h1><p class="sub">${L.resetSub}</p>
    <form id="f-reset" class="authform" novalidate>
      <div class="field"><label for="a-email">${L.email}</label>
        <input id="a-email" class="input" type="email" autocomplete="email" inputmode="email" placeholder="${esc(L.emailPh)}" value="${esc(ui.email)}"></div>
      ${error}
      ${ui.info ? `<div class="formmsg ok-box" role="status">${esc(ui.info)}</div>` : ''}
      <button class="btn" type="submit" ${ui.busy ? 'disabled' : ''}>${ui.busy ? L.sending : L.sendLink}</button>
    </form>
    <button class="textbtn link center" data-action="auth-screen" data-screen="login">${L.backToLogin}</button>${legalLinks()}`;
  }

  const signup = ui.screen === 'signup';
  h += `<h1>${signup ? L.signUpTitle : L.signInTitle}</h1><p class="sub">${L.authSub}</p>
  <div class="tabs" role="tablist">
    <button role="tab" data-action="auth-screen" data-screen="login" aria-selected="${!signup}">${L.tabLogin}</button>
    <button role="tab" data-action="auth-screen" data-screen="signup" aria-selected="${signup}">${L.tabSignup}</button>
  </div>
  <form id="f-auth" class="authform" novalidate>
    ${signup ? `<div class="field"><label for="a-name">${L.name}</label>
      <input id="a-name" class="input" autocomplete="given-name" maxlength="40" placeholder="${esc(L.namePh)}" value="${esc(ui.name)}"></div>` : ''}
    <div class="field"><label for="a-email">${L.email}</label>
      <input id="a-email" class="input" type="email" autocomplete="email" inputmode="email" placeholder="${esc(L.emailPh)}" value="${esc(ui.email)}"></div>
    <div class="field"><label for="a-pw">${L.password}</label>
      <div class="pw">
        <input id="a-pw" class="input" type="${ui.showPw ? 'text' : 'password'}" autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="${esc(signup ? L.passwordPh : '')}" value="${esc(ui.password)}">
        <button type="button" class="eye" data-action="toggle-pw" aria-label="${ui.showPw ? L.hidePw : L.showPw}" aria-pressed="${ui.showPw}">${ui.showPw ? ICONS.eyeOff : ICONS.eye}</button>
      </div>
      ${signup ? `<ul class="pw-rules" id="pw-rules" aria-live="polite">${pwRulesHTML(ui.password)}</ul>` : `<button type="button" class="textbtn link right" data-action="auth-screen" data-screen="reset">${L.forgot}</button>`}
    </div>
    ${signup ? `<label class="check-row"><input type="checkbox" id="a-consent" ${ui.consent ? 'checked' : ''}><span>${L.consentCheck(LEGAL.minAge, LEGAL.termsUrl, LEGAL.privacyUrl)}</span></label>` : ''}
    ${error}
    ${!signup && ui.info ? `<div class="formmsg ok-box" role="status">${esc(ui.info)}</div>` : ''}
    <button class="btn" type="submit" ${ui.busy ? 'disabled' : ''}>${ui.busy ? (signup ? L.signingUp : L.loggingIn) : (signup ? L.signup : L.login)}</button>
  </form>
  <div class="or"><span>${L.or}</span></div>
  <button class="btn secondary" data-action="google" ${ui.busy ? 'disabled' : ''}>${L.google}</button>
  <p class="fine">${L.googleConsent(LEGAL.termsUrl, LEGAL.privacyUrl)}</p>`;
  if (!configured) h += `<button class="textbtn link center" data-action="local-mode">${L.tryLocal}</button>`;
  return h + legalLinks();
}

// Live password checklist on "Create account" (updated in place while typing, see main.js).
export function pwRulesHTML(pw) {
  const R = t().pwRules;
  return passwordChecks(pw).map(c => `<li class="${c.ok ? 'ok' : ''}">${c.ok ? '✓' : '•'} ${c.key === 'min' ? R.min(PASSWORD_POLICY.minLength) : R[c.key]}</li>`).join('');
}
