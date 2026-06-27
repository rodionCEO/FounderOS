/** Ideas view: pinned block on top, sortable, with archive/pin/edit/delete. */
import * as store from '../store.js';
import { t, getLang } from '../i18n.js';
import { icon } from '../icons.js';
import { escapeHtml, formatDate } from '../utils.js';
import { actionBtn, emptyState, toast, openModal, confirmDialog, submitOnEnter } from '../ui.js';
import { attachMic, voiceSupported } from '../voice.js';

const SORTS = [
  { key: 'newest', label: 'sort.newest' },
  { key: 'oldest', label: 'sort.oldest' },
  { key: 'pinned', label: 'sort.pinned' },
];
let sort = 'newest';

function ideaCard(idea) {
  return `
    <div class="card${idea.pinned ? ' pinned' : ''}" data-id="${idea.id}">
      <div class="card__head">
        <div style="flex:1;min-width:0">
          <div class="card__title">${escapeHtml(idea.title)}</div>
          ${idea.desc ? `<div class="card__desc">${escapeHtml(idea.desc)}</div>` : ''}
          <div class="card__meta">${formatDate(idea.createdAt, getLang())}</div>
        </div>
        <div class="card__actions">
          ${actionBtn('pin', 'pin', idea.pinned ? 'action.unpin' : 'action.pin', idea.pinned ? 'icon-btn--accent' : '')}
          ${actionBtn('edit', 'edit', 'action.edit')}
          ${actionBtn('archive', 'archiveBox', 'action.archive')}
          ${actionBtn('delete', 'trash', 'action.delete')}
        </div>
      </div>
    </div>`;
}

export default function render(container) {
  const items = store.all('ideas').filter((x) => !x.archived);
  const pinned = items.filter((x) => x.pinned);
  let rest = items.filter((x) => !x.pinned);

  if (sort === 'oldest') rest = rest.slice().sort((a, b) => a.createdAt - b.createdAt);
  else rest = rest.slice().sort((a, b) => b.createdAt - a.createdAt);
  if (sort === 'pinned') rest = []; // show only pinned when that sort is chosen

  const chips = SORTS.map(
    (s) => `<button class="chip${sort === s.key ? ' active' : ''}" data-sort="${s.key}">${t(s.label)}</button>`
  ).join('');

  let body = '';
  if (!items.length) {
    body = emptyState('idea', t('ideas.empty'), t('ideas.emptyHint'));
  } else {
    if (pinned.length) {
      body += `<div class="section-title"><span class="section-title__icon">${icon('pin', { size: 14 })}</span>${t('ideas.pinned')}<span class="section-title__count">${pinned.length}</span></div>`;
      body += pinned.map(ideaCard).join('');
    }
    if (rest.length) {
      body += `<div class="section-title">${t('ideas.all')}<span class="section-title__count">${rest.length}</span></div>`;
      body += rest.map(ideaCard).join('');
    }
  }

  container.innerHTML = `
    <div class="view-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px">
      <div class="chips" style="margin:0">${chips}</div>
      <button class="btn btn--primary btn--sm" id="newIdea">${icon('plus', { size: 14 })} ${t('ideas.new')}</button>
    </div>
    ${body}`;

  container.querySelectorAll('.chip').forEach((c) =>
    c.addEventListener('click', () => {
      sort = c.dataset.sort;
      render(container);
    })
  );
  container.querySelector('#newIdea').addEventListener('click', () => openEditor(null, container));

  container.querySelectorAll('.card[data-id]').forEach((card) => {
    const id = card.dataset.id;
    card.querySelectorAll('[data-action]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const a = btn.dataset.action;
        if (a === 'pin') await store.togglePin('ideas', id);
        else if (a === 'edit') openEditor(store.all('ideas').find((x) => x.id === id), container);
        else if (a === 'archive') {
          await store.archive('ideas', id);
          toast(t('app.archived'));
        } else if (a === 'delete') {
          if (await confirmDialog(t('common.confirmDelete'))) await store.remove('ideas', id);
        }
      })
    );
  });
}

function openEditor(idea, container) {
  const isEdit = Boolean(idea);
  const { el, close } = openModal(`
    <div class="modal__head">
      <span class="modal__title">${isEdit ? t('action.edit') : t('ideas.new')}</span>
      <button class="icon-btn" data-close>${icon('x')}</button>
    </div>
    <div class="modal__body">
      <div class="field">
        <label class="field__label">${t('ideas.title')}</label>
        <div class="input-with-mic"><input class="input" id="ie-title" value="${idea ? escapeHtml(idea.title) : ''}" /></div>
      </div>
      <div class="field">
        <label class="field__label">${t('ideas.desc')}</label>
        <div class="input-with-mic"><textarea class="textarea" id="ie-desc">${idea ? escapeHtml(idea.desc || '') : ''}</textarea></div>
      </div>
      <div class="form-actions">
        <button class="btn btn--ghost" data-close>${t('action.cancel')}</button>
        <button class="btn btn--primary" id="ie-save">${t('action.save')}</button>
      </div>
    </div>`);

  if (voiceSupported()) el.querySelectorAll('.input-with-mic').forEach(attachMic);
  el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  el.querySelector('#ie-title').focus();

  const doSave = async () => {
    const title = el.querySelector('#ie-title').value.trim();
    if (!title) return;
    const patch = { title, desc: el.querySelector('#ie-desc').value.trim() };
    if (isEdit) await store.update('ideas', idea.id, patch);
    else await store.add('ideas', { ...patch, pinned: false });
    close();
    toast(t('app.saved'));
    render(container);
  };
  el.querySelector('#ie-save').addEventListener('click', doSave);
  submitOnEnter(el, doSave);
}
