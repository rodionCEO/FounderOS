/**
 * Journal view: one entry per day with day navigation. Tasks completed on the
 * selected day are pulled in automatically (read-only). Edits autosave as a
 * draft so nothing is lost if the popup closes.
 */
import * as store from '../store.js';
import { t, getLang } from '../i18n.js';
import { icon } from '../icons.js';
import { escapeHtml, dateKey, parseDateKey, formatFullDate, formatDate, isToday } from '../utils.js';
import { toast } from '../ui.js';
import { attachMic, voiceSupported } from '../voice.js';
import { createAutosave } from '../drafts.js';

const FIELDS = [
  ['mainGoal', 'journal.mainGoal', 'journal.mainGoalPh', false],
  ['did', 'journal.did', 'journal.didPh', true],
  ['learned', 'journal.learned', 'journal.learnedPh', true],
  ['result', 'journal.result', 'journal.resultPh', true],
  ['improve', 'journal.improve', 'journal.improvePh', true],
];

let currentDate = dateKey();

function completedOn(date) {
  return store
    .all('tasks')
    .filter((tk) => tk.done && tk.completedAt && dateKey(new Date(tk.completedAt)) === date);
}

function shiftDate(days) {
  const d = parseDateKey(currentDate);
  d.setDate(d.getDate() + days);
  currentDate = dateKey(d);
}

export default function render(container) {
  const lang = getLang();
  const entry = store.getJournalEntry(currentDate) || {};
  const draft = store.getDraft('journal', currentDate);
  const values = draft ? { ...entry, ...draft } : entry;
  const completed = completedOn(currentDate);
  const isCurrent = currentDate === dateKey();

  const fieldsHtml = FIELDS.map(([id, label, ph, textarea]) => {
    const val = escapeHtml(values[id] || '');
    return `
      <div class="field">
        <label class="field__label">${t(label)}</label>
        <div class="input-with-mic">
          ${
            textarea
              ? `<textarea class="textarea" id="jr-${id}" placeholder="${t(ph)}">${val}</textarea>`
              : `<input class="input" id="jr-${id}" placeholder="${t(ph)}" value="${val}" />`
          }
        </div>
      </div>`;
  }).join('');

  const completedBox =
    completed.length || isCurrent
      ? `<div class="completed-box">
          <div class="completed-box__title">${t('journal.completed')}</div>
          ${
            completed.length
              ? completed
                  .map(
                    (tk) =>
                      `<div class="completed-item">${icon('check', { size: 13 })}${escapeHtml(tk.title)}</div>`
                  )
                  .join('')
              : `<div class="completed-item" style="color:var(--text-faint)">${t('journal.completedEmpty')}</div>`
          }
        </div>`
      : '';

  const recent = store.all('journal').slice(0, 10);
  const recentHtml = recent.length
    ? recent
        .map(
          (e) =>
            `<button class="chip${e.date === currentDate ? ' active' : ''}" data-date="${e.date}">${formatDate(
              parseDateKey(e.date).getTime(),
              lang
            )}</button>`
        )
        .join('')
    : `<span class="empty__hint">${t('journal.noRecent')}</span>`;

  container.innerHTML = `
    <div class="journal-nav">
      <button class="icon-btn" id="jr-prev">${icon('chevronLeft')}</button>
      <div class="journal-date">${formatFullDate(parseDateKey(currentDate).getTime(), lang)}</div>
      <button class="icon-btn" id="jr-next">${icon('chevronRight')}</button>
      <button class="btn btn--sm${isCurrent ? '' : ''}" id="jr-today">${t('journal.today')}</button>
    </div>
    ${completedBox}
    ${fieldsHtml}
    <div class="form-actions">
      <button class="btn btn--primary" id="jr-save">${icon('check', { size: 15 })} ${t('action.save')}</button>
    </div>
    <div class="journal-recent">${recentHtml}</div>`;

  if (draft) toast(t('journal.draftRestored'));

  // Autosave draft for this date.
  const autosave = createAutosave({
    kind: 'journal',
    key: currentDate,
    collect: collect,
    isEmpty: (s) => FIELDS.every(([id]) => !String(s[id] || '').trim()),
  });

  function collect() {
    const out = {};
    FIELDS.forEach(([id]) => {
      out[id] = container.querySelector('#jr-' + id).value;
    });
    return out;
  }

  if (voiceSupported()) container.querySelectorAll('.input-with-mic').forEach(attachMic);
  FIELDS.forEach(([id]) =>
    container.querySelector('#jr-' + id).addEventListener('input', () => autosave.schedule())
  );

  const go = (fn) => {
    autosave.flush();
    fn();
    render(container);
  };
  container.querySelector('#jr-prev').addEventListener('click', () => go(() => shiftDate(-1)));
  container.querySelector('#jr-next').addEventListener('click', () => go(() => shiftDate(1)));
  container.querySelector('#jr-today').addEventListener('click', () => go(() => (currentDate = dateKey())));

  container.querySelectorAll('[data-date]').forEach((b) =>
    b.addEventListener('click', () => go(() => (currentDate = b.dataset.date)))
  );

  container.querySelector('#jr-save').addEventListener('click', async () => {
    const fields = collect();
    await store.saveJournalEntry(currentDate, fields);
    autosave.clear();
    toast(t('app.saved'));
    render(container);
  });
}
