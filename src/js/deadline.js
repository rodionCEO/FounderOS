/**
 * Reusable deadline picker: quick chips (Today / Tomorrow / Next week / No date)
 * plus a native date (or datetime-local) input. Used by the task editor and
 * Quick Capture so a deadline is fast to set without fighting the native picker.
 */
import { icon } from './icons.js';
import { t } from './i18n.js';

const pad = (n) => String(n).padStart(2, '0');

function toDateValue(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toDateTimeValue(ts) {
  const d = new Date(ts);
  return `${toDateValue(ts)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmt(ts, withTime) {
  if (!ts) return '';
  return withTime ? toDateTimeValue(ts) : toDateValue(ts);
}

/** Local-midnight Date offset by `addDays`. */
function dayAt(addDays = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + addDays);
  return d;
}

const QUICK = [
  ['today', 'tasks.dlToday', 0],
  ['tomorrow', 'tasks.dlTomorrow', 1],
  ['nextweek', 'tasks.dlNextWeek', 7],
];

/**
 * Markup for the deadline field.
 * @param {object} opts
 * @param {number|null} [opts.value] - existing deadline timestamp (ms)
 * @param {boolean} [opts.withTime] - allow a time component (datetime-local)
 */
export function deadlineField({ value = null, withTime = false, inputId = '' } = {}) {
  const type = withTime ? 'datetime-local' : 'date';
  const idAttr = inputId ? ` id="${inputId}"` : '';
  const chips =
    QUICK.map(
      ([key, label]) => `<button type="button" class="chip" data-dl="${key}">${t(label)}</button>`
    ).join('') +
    `<button type="button" class="chip" data-dl="clear">${icon('x', { size: 11 })} ${t('tasks.dlClear')}</button>`;
  return `
    <div class="deadline-field" data-deadline>
      <div class="deadline-quick">${chips}</div>
      <input class="input" type="${type}"${idAttr} data-deadline-input value="${fmt(value, withTime)}" />
    </div>`;
}

/**
 * Wire chip clicks + active-state sync within `scopeEl`.
 * @returns {{ getValue: () => (number|null) }} reads the picked timestamp (ms) or null
 */
export function wireDeadlineField(scopeEl, { withTime = false } = {}) {
  const input = scopeEl.querySelector('[data-deadline-input]');
  const chips = [...scopeEl.querySelectorAll('[data-dl]')];
  if (!input) return { getValue: () => null };

  function currentTime() {
    // Preserve an existing time when switching dates (datetime-local only).
    if (!withTime || !input.value) return { h: 9, m: 0 };
    const d = new Date(input.value);
    return { h: d.getHours(), m: d.getMinutes() };
  }

  function setFromDays(days) {
    const d = dayAt(days);
    if (withTime) {
      const { h, m } = currentTime();
      d.setHours(h, m, 0, 0);
      input.value = toDateTimeValue(d.getTime());
    } else {
      input.value = toDateValue(d.getTime());
    }
  }

  function syncActive() {
    const val = input.value ? new Date(input.value) : null;
    chips.forEach((c) => {
      const match = QUICK.find(([k]) => k === c.dataset.dl);
      let on = false;
      if (val && match) {
        const target = dayAt(match[2]);
        on =
          val.getFullYear() === target.getFullYear() &&
          val.getMonth() === target.getMonth() &&
          val.getDate() === target.getDate();
      }
      c.classList.toggle('active', on);
    });
  }

  chips.forEach((c) =>
    c.addEventListener('click', () => {
      const key = c.dataset.dl;
      if (key === 'clear') input.value = '';
      else {
        const match = QUICK.find(([k]) => k === key);
        if (match) setFromDays(match[2]);
      }
      syncActive();
    })
  );
  input.addEventListener('input', syncActive);
  syncActive();

  return {
    getValue: () => (input.value ? new Date(input.value).getTime() : null),
  };
}
