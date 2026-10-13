// Name + username form: the one-time "choose your username" screen, and the same form inside "Edit profile".
import { t } from '../i18n/index.js';
import { esc } from '../utils/format.js';
import { brand, langToggle } from './partials.js';

// The fields + status line + button. form = the profile controller's state.
export function profileFormHTML(form, submitLabel) {
  const L = t();
  return `<form id="f-username" class="authform" novalidate>
    <div class="field"><label for="u-display">${L.displayName}</label>
      <input id="u-display" class="input" maxlength="40" autocomplete="given-name" placeholder="${esc(L.displayNamePh)}" value="${esc(form.displayName)}"></div>
    <div class="field"><label for="u-name">${L.username}</label>
      <div class="handle"><span aria-hidden="true">@</span>
        <input id="u-name" class="input" maxlength="20" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="${esc(L.usernamePh)}" value="${esc(form.username)}"></div>
      <div id="u-status" aria-live="polite">${statusHTML(form)}</div>
    </div>
    <div id="u-error">${errorHTML(form)}</div>
    <button class="btn" type="submit" id="u-submit" ${form.busy ? 'disabled' : ''}>${form.busy ? L.saving : submitLabel}</button>
  </form>`;
}

export function statusHTML(form) {
  const L = t();
  const map = {
    idle: ['hint', L.usernameHint], checking: ['hint', L.uChecking], available: ['ok', L.uAvailable], mine: ['ok', L.uMine],
    taken: ['bad', L.uTaken], invalid: ['bad', L.uInvalid], reserved: ['bad', L.uReserved],
  };
  const [cls, text] = map[form.status] || map.idle;
  return `<span class="u-status ${cls}">${esc(text)}</span>`;
}

export const errorHTML = form => (form.error ? `<div class="formmsg err-box" role="alert">${esc(form.error)}</div>` : '');

// Full-screen version shown once after sign-up (or after updating, for existing accounts).
export function usernameView(form) {
  const L = t();
  return `<header class="top">${brand()}${langToggle()}</header>
    <h1>${L.pickTitle}</h1>
    <p class="sub">${L.pickSub}</p>
    <div style="margin-top:26px">${profileFormHTML(form, L.continue)}</div>`;
}
