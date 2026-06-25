/** Small shared helpers used across views. */

/** Generate a reasonably unique id. */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Escape a string for safe insertion into innerHTML. */
export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Debounce a function by `wait` ms. */
export function debounce(fn, wait = 200) {
  let t;
  const debounced = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(t);
  debounced.flush = (...args) => {
    clearTimeout(t);
    fn(...args);
  };
  return debounced;
}

/** Local date key YYYY-MM-DD (no timezone drift). */
export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD key into a local Date at midnight. */
export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Start-of-day timestamp for a Date. */
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Classify a task by its deadline into a time bucket.
 * @returns 'overdue' | 'today' | 'tomorrow' | 'later'
 */
export function taskBucket(task, now = new Date()) {
  if (!task.deadline) return 'later';
  const todayStart = startOfDay(now);
  const dl = new Date(task.deadline);
  const dlStart = startOfDay(dl);
  const dayMs = 86400000;
  if (dlStart < todayStart) return 'overdue';
  if (dlStart === todayStart) return 'today';
  if (dlStart === todayStart + dayMs) return 'tomorrow';
  return 'later';
}

/** Whether a deadline falls on the current local day. */
export function isToday(ts, now = new Date()) {
  if (!ts) return false;
  return startOfDay(new Date(ts)) === startOfDay(now);
}

/** Whether a deadline is before today (and not the same day). */
export function isOverdue(ts, now = new Date()) {
  if (!ts) return false;
  return startOfDay(new Date(ts)) < startOfDay(now);
}

/**
 * Human-friendly relative day label key for the i18n layer.
 * @returns one of: 'today' | 'yesterday' | 'tomorrow' | null
 */
export function relativeDayKey(ts, now = new Date()) {
  if (!ts) return null;
  const diff = startOfDay(new Date(ts)) - startOfDay(now);
  const day = 86400000;
  if (diff === 0) return 'today';
  if (diff === -day) return 'yesterday';
  if (diff === day) return 'tomorrow';
  return null;
}

/** Format a timestamp as a short date, locale-aware. */
export function formatDate(ts, locale = 'en') {
  if (!ts) return '';
  const loc = locale === 'ru' ? 'ru-RU' : 'en-US';
  return new Date(ts).toLocaleDateString(loc, { day: 'numeric', month: 'short' });
}

/** Format a timestamp as a full weekday + date. */
export function formatFullDate(ts, locale = 'en') {
  const loc = locale === 'ru' ? 'ru-RU' : 'en-US';
  return new Date(ts).toLocaleDateString(loc, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Format the time portion (HH:MM) of a timestamp if it has one. */
export function formatTime(ts, locale = 'en') {
  if (!ts) return '';
  const d = new Date(ts);
  if (d.getHours() === 0 && d.getMinutes() === 0) return '';
  const loc = locale === 'ru' ? 'ru-RU' : 'en-US';
  return d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
}

/** Normalize a URL so it always has a protocol. */
export function normalizeUrl(url = '') {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return 'https://' + trimmed;
}

/** Extract a clean hostname for display. */
export function hostname(url = '') {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
