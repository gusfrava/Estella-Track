// Username rules (the same rules are enforced again in firestore.rules).
//   3–20 characters: a–z, 0–9, "_" and "." · lowercase · can't start/end with "." · no ".." · not reserved.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

export const RESERVED = [
  'admin', 'administrator', 'estella', 'support', 'soporte', 'help', 'ayuda', 'root', 'system', 'moderator', 'mod',
  'staff', 'team', 'official', 'oficial', 'null', 'undefined', 'me', 'api', 'www', 'app', 'settings', 'trainer', 'entrenador',
];

const PATTERN = /^[a-z0-9_][a-z0-9_.]{1,18}[a-z0-9_]$/;

const stripAccents = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// What the input box keeps: lowercase, no accents, no spaces or "@".
export const cleanUsername = s => stripAccents(String(s || '')).toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_.]/g, '').slice(0, USERNAME_MAX);

// Returns null when valid, or the reason: 'short' | 'long' | 'invalid' | 'reserved'.
export function usernameProblem(name) {
  if (name.length < USERNAME_MIN) return 'short';
  if (name.length > USERNAME_MAX) return 'long';
  if (!PATTERN.test(name) || name.includes('..')) return 'invalid';
  if (RESERVED.includes(name)) return 'reserved';
  return null;
}

// A starting suggestion from the person's name: "Jazmín Pérez" → "jazminperez".
export function suggestUsername(displayName) {
  let s = cleanUsername(stripAccents(String(displayName || '')).replace(/\s+/g, ''));
  s = s.replace(/^\.+|\.+$/g, '');
  if (s.length && s.length < USERNAME_MIN) s = (s + '123').slice(0, USERNAME_MIN);
  return usernameProblem(s) ? '' : s;
}
