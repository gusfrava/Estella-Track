// "Before you continue" screen: accept the privacy policy and terms (shown once, and again if they change).
import { t } from '../i18n/index.js';
import { LEGAL } from '../config.js';
import { brand, langToggle, legalLinks } from './partials.js';

export function consentView({ error }) {
  const L = t();
  return `<header class="top">${brand()}${langToggle()}</header>
    <h1>${L.consentTitle}</h1>
    <p class="sub">${L.consentSub}</p>
    <ul class="consent-points">
      <li>${L.consentPoint1}</li>
      <li>${L.consentPoint2}</li>
      <li>${L.consentPoint3}</li>
    </ul>
    <label class="check-row"><input type="checkbox" id="c-accept"><span>${L.consentCheck(LEGAL.minAge, LEGAL.termsUrl, LEGAL.privacyUrl)}</span></label>
    ${error ? `<div class="formmsg err-box" role="alert">${error}</div>` : ''}
    <button class="btn" data-action="accept-legal">${L.continue}</button>
    ${legalLinks()}`;
}
