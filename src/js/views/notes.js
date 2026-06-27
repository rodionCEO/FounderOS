/** Notes view: pinned block, local filter, with draft autosave in the editor. */
import * as store from '../store.js';
import { t, getLang } from '../i18n.js';
import { icon } from '../icons.js';
import { escapeHtml, formatDate } from '../utils.js';
import { actionBtn, emptyState, toast, openModal, confirmDialog, submitOnEnter } from '../ui.js';
import { attachMic, voiceSupported } from '../voice.js';
import { createAutosave } from '../drafts.js';

let query = '';

function noteCard(note) {
  const lang = getLang();
  const edited = note.updatedAt && note.updatedAt !== note.createdAt;
  return `
    <div class="card${note.pinned ? ' pinned' : ''}" data-id="${note.id}">
      <div class="card__head">
        <div style="flex:1;min-width:0">
          ${note.title ? `<div class="card__title">${escapeHtml(note.title)}</div>` : ''}
          ${note.text ? `<div class="card__desc">${escapeHtml(note.text)}</div>` : ''}
          <div class="card__meta">
            ${t('notes.created')} ${formatDate(note.createdAt, lang)}
            ${edited ? `· ${t('notes.edited')} ${formatDate(note.updatedAt, lang)}` : ''}
          </div>
        </div>
        <div class="card__actions">
          ${actionBtn('pin', 'pin', note.pinned ? 'action.unpin' : 'action.pin', note.pinned ? 'icon-btn--accent' : '')}
          ${actionBtn('edit', 'edit', 'action.edit')}
          ${actionBtn('archive', 'archiveBox', 'action.archive')}
          ${actionBtn('delete', 'trash', 'action.delete')}
        </div>
      </div>
    </div>`;
}

export default function render(container) {
  let items = store.all('notes').filter((x) => !x.archived);
  if (query) {
    const q = query.toLowerCase();
    items = items.filter(
      (n) => (n.title || '').toLowerCase().includes(q) || (n.text || '').toLowerCase().includes(q)
    );
  }
  const pinned = items.filter((x) => x.pinned);
  const rest = items.filter((x) => !x.pinned).sort((a, b) => b.createdAt - a.createdAt);

  let body = '';
  if (!store.all('notes').filter((x) => !x.archived).length) {
    body = emptyState('note', t('notes.empty'), t('notes.emptyHint'));
  } else if (!items.length) {
    body = emptyState('search', t('search.empty'), '', true);
  } else {
    if (pinned.length) {
      body += `<div class="section-title"><span class="section-title__icon">${icon('pin', { size: 14 })}</span>${t('notes.pinned')}<span class="section-title__count">${pinned.length}</span></div>`;
      body += pinned.map(noteCard).join('');
    }
    if (rest.length) {
      body += `<div class="section-title">${t('notes.all')}<span class="section-title__count">${rest.length}</span></div>`;
      body += rest.map(noteCard).join('');
    }
  }

  container.innerHTML = `
    <div class="view-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px">
      <div class="topbar__search" style="flex:1">
        <span class="topbar__search-icon">${icon('search', { size: 14 })}</span>
        <input class="topbar__search-input" id="noteFilter" placeholder="${t('search.placeholder')}" value="${escapeHtml(query)}" />
      </div>
      <button class="btn btn--primary btn--sm" id="newNote">${icon('plus', { size: 14 })} ${t('notes.new')}</button>
    </div>
    ${body}`;

  const filterInput = container.querySelector('#noteFilter');
  filterInput.addEventListener('input', () => {
    query = filterInput.value;
    const pos = filterInput.selectionStart;
    render(container);
    const next = container.querySelector('#noteFilter');
    next.focus();
    next.setSelectionRange(pos, pos);
  });
  container.querySelector('#newNote').addEventListener('click', () => openEditor(null, container));

  container.querySelectorAll('.card[data-id]').forEach((card) => {
    const id = card.dataset.id;
    card.querySelectorAll('[data-action]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const a = btn.dataset.action;
        if (a === 'pin') await store.togglePin('notes', id);
        else if (a === 'edit') openEditor(store.all('notes').find((x) => x.id === id), container);
        else if (a === 'archive') {
          await store.archive('notes', id);
          toast(t('app.archived'));
        } else if (a === 'delete') {
          if (await confirmDialog(t('common.confirmDelete'))) await store.remove('notes', id);
        }
      })
    );
  });
}

function openEditor(note, container) {
  const isEdit = Boolean(note);
  const draftId = note ? note.id : null;

  const autosave = createAutosave({
    kind: 'note',
    collect: () => ({
      id: draftId,
      title: el.querySelector('#ne-title').value,
      text: el.querySelector('#ne-text').value,
    }),
    isEmpty: (s) => !s.title.trim() && !s.text.trim(),
  });

  const { el, close } = openModal(`
    <div class="modal__head">
      <span class="modal__title">${isEdit ? t('action.edit') : t('notes.new')}</span>
      <button class="icon-btn" data-close>${icon('x')}</button>
    </div>
    <div class="modal__body">
      <div class="field">
        <div class="input-with-mic"><input class="input" id="ne-title" placeholder="${t('notes.title')}" value="${note ? escapeHtml(note.title || '') : ''}" /></div>
      </div>
      <div class="field">
        <div class="input-with-mic"><textarea class="textarea" id="ne-text" placeholder="${t('notes.text')}" style="min-height:140px">${note ? escapeHtml(note.text || '') : ''}</textarea></div>
      </div>
      <div class="form-actions">
        <button class="btn btn--ghost" data-close>${t('action.cancel')}</button>
        <button class="btn btn--primary" id="ne-save">${t('action.save')}</button>
      </div>
    </div>`);

  // Restore an unsaved draft for this note (or for a new note).
  const draft = autosave.load();
  if (draft && (draft.id ?? null) === draftId && (draft.title || draft.text)) {
    el.querySelector('#ne-title').value = draft.title || '';
    el.querySelector('#ne-text').value = draft.text || '';
    toast(t('notes.draftRestored'));
  }

  if (voiceSupported()) el.querySelectorAll('.input-with-mic').forEach(attachMic);
  el.querySelector('.modal__body').addEventListener('input', () => autosave.schedule());

  el.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => {
      autosave.flush();
      close();
    })
  );
  el.querySelector('#ne-title').focus();

  const doSave = async () => {
    const title = el.querySelector('#ne-title').value.trim();
    const text = el.querySelector('#ne-text').value.trim();
    if (!title && !text) return;
    if (isEdit) await store.update('notes', note.id, { title, text });
    else await store.add('notes', { title, text, pinned: false });
    autosave.clear();
    close();
    toast(t('app.saved'));
    render(container);
  };
  el.querySelector('#ne-save').addEventListener('click', doSave);
  submitOnEnter(el, doSave);
}
