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
  if (old && old.lang) return old.lang === 'en' ? 'en' : 'es';
  return phoneLang();
})();

// The phone's language: Spanish if it's any Spanish, otherwise English.
function phoneLang() {
  const list = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
  return list.some(l => /^es\b/i.test(l || '')) ? 'es' : 'en';
}

// True once the person has picked a language (the first screen asks; the ES/EN toggle also counts).
export const hasChosenLang = () => !!STRINGS[lsGet(KEYS.lang)];

// Shows a language without saving it yet (tapping an option on the first screen).
export function previewLang(next) {
  if (!STRINGS[next] || next === lang) return;
  lang = next;
  listeners.forEach(fn => fn(lang));
}

// Saves the choice even when it's the language already showing (the first-screen "Continuar").
export function chooseLang(next) {
  if (!STRINGS[next]) return;
  lsSet(KEYS.lang, next);
  if (next !== lang) setLang(next); else listeners.forEach(fn => fn(lang));
}

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
