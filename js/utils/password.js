// Checks a password against PASSWORD_POLICY (js/config.js). Returns one entry per active rule.
import { PASSWORD_POLICY as P } from '../config.js';

export function passwordChecks(pw = '') {
  const checks = [{ key: 'min', ok: pw.length >= P.minLength }];
  if (P.uppercase) checks.push({ key: 'upper', ok: /[A-Z]/.test(pw) });
  if (P.lowercase) checks.push({ key: 'lower', ok: /[a-z]/.test(pw) });
  if (P.number) checks.push({ key: 'number', ok: /[0-9]/.test(pw) });
  if (P.special) checks.push({ key: 'special', ok: /[^A-Za-z0-9]/.test(pw) });
  return checks;
}

export const passwordOk = pw => passwordChecks(pw).every(c => c.ok);
