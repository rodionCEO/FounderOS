/**
 * Centralized translation layer.
 * t('key') returns the localized string for the active language; static markup
 * is localized via data-i18n attributes processed by applyStatic().
 */
import en from '../locales/en.js';
import ru from '../locales/ru.js';

const LOCALES = { en, ru };
const LANGS = ['en', 'ru'];

let lang = 'en';
const listeners = new Set();

/** Set the active language (no persistence here — store owns that). */
export function setLang(next) {
  if (!LANGS.includes(next)) return;
  lang = next;
  document.documentElement.lang = next;
  listeners.forEach((fn) => fn(next));
}

export function getLang() {
  return lang;
}

/** Cycle to the next available language (used by the header toggle). */
export function nextLang() {
  const idx = LANGS.indexOf(lang);
  return LANGS[(idx + 1) % LANGS.length];
}

/** Subscribe to language changes. Returns an unsubscribe function. */
export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Translate a key, with optional {placeholder} interpolation.
 * Falls back to English, then to the key itself.
 */
export function t(key, vars) {
  let str = LOCALES[lang][key] ?? LOCALES.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
  }
  return str;
}

/**
 * Apply translations to static markup within `root`:
 *  - data-i18n -> textContent
 *  - data-i18n-placeholder -> placeholder attribute
 *  - data-i18n-title -> title attribute
 */
export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
}
