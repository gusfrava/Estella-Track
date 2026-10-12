// Language layer. t() returns the strings for the current language.
// To change wording, edit es.js / en.js — never hard-code text in views.
import es from './es.js';
import en from './en.js';
import { KEYS, lsGet, lsSet, readJSON } from '../services/storage.js';

const STRINGS = { es, en };
const listeners = new Set();

let lang = (() => {
  const saved = lsGet(KEYS.lang);
  if (STRINGS[saved]) return saved;
  const old = readJSON(KEYS.local);            // v1 stored the language inside the data
  return old && old.lang === 'en' ? 'en' : 'es';
})();

export const getLang = () => lang;
export const t = () => STRINGS[lang] || es;
export const locale = () => (lang === 'en' ? 'en-US' : 'es-ES');

export function setLang(next) {
  if (!STRINGS[next] || next === lang) return;
  lang = next;
  lsSet(KEYS.lang, next);
  listeners.forEach(fn => fn(lang));
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
