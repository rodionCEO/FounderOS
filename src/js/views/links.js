/** Links view: pinned block on top, clickable links, add-from-current-tab. */
import * as store from '../store.js';
import { t } from '../i18n.js';
import { icon } from '../icons.js';
import { escapeHtml, normalizeUrl, hostname } from '../utils.js';
import { actionBtn, emptyState, toast, openModal, confirmDialog, submitOnEnter } from '../ui.js';
import { attachMic, voiceSupported } from '../voice.js';

function getActiveTab() {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs?.[0] || null));
    } catch {
      resolve(null);
    }
  });
}

function linkCard(link) {
  const url = normalizeUrl(link.url);
  return `
    <div class="card${link.pinned ? ' pinned' : ''}" data-id="${link.id}">
      <div class="card__head">
        <div style="flex:1;min-width:0">
          <div class="card__title">${escapeHtml(link.title || hostname(url))}</div>
          ${link.desc ? `<div class="card__desc">${escapeHtml(link.desc)}</div>` : ''}
          <div class="card__meta"><a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(hostname(url))}</a></div>
        </div>
        <div class="card__actions">
          <a class="icon-btn icon-btn--accent" href="${escapeHtml(url)}" target="_blank" rel="noopener" title="${t('action.open')}">${icon('open')}</a>
          ${actionBtn('pin', 'pin', link.pinned ? 'action.unpin' : 'action.pin', link.pinned ? 'icon-btn--accent' : '')}
          ${actionBtn('edit', 'edit', 'action.edit')}
          ${actionBtn('archive', 'archiveBox', 'action.archive')}
          ${actionBtn('delete', 'trash', 'action.delete')}
        </div>
      </div>
    </div>`;
}

export default function render(container) {
  const items = store.all('links').filter((x) => !x.archived);
  const pinned = items.filter((x) => x.pinned);
  const rest = items.filter((x) => !x.pinned).sort((a, b) => b.createdAt - a.createdAt);

  let body = '';
  if (!items.length) {
    body = emptyState('link', t('links.empty'), t('links.emptyHint'));
  } else {
    if (pinned.length) {
      body += `<div class="section-title"><span class="section-title__icon">${icon('pin', { size: 14 })}</span>${t('links.pinned')}<span class="section-title__count">${pinned.length}</span></div>`;
      body += pinned.map(linkCard).join('');
    }
    if (rest.length) {
      body += `<div class="section-title">${t('links.all')}<span class="section-title__count">${rest.length}</span></div>`;
      body += rest.map(linkCard).join('');
    }
  }

  container.innerHTML = `
    <div class="view-head" style="display:flex;gap:8px;margin-bottom:12px">
      <button class="btn btn--sm" id="currentTab" title="${t('links.addCurrentHint')}">${icon('plus', { size: 14 })} ${t('links.addCurrent')}</button>
      <button class="btn btn--primary btn--sm" id="newLink" style="margin-left:auto">${icon('plus', { size: 14 })} ${t('links.new')}</button>
    </div>
    ${body}`;

  container.querySelector('#newLink').addEventListener('click', () => openEditor(null, container));
  // One-click: grab the page the user is currently on and save it straight away.
  container.querySelector('#currentTab').addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab || !tab.url) {
      // Fallback: no readable tab — open the manual editor instead.
      openEditor(null, container, true);
      return;
    }
    const url = normalizeUrl(tab.url);
    await store.add('links', {
      url,
      title: (tab.title || '').trim() || hostname(url),
      desc: '',
      pinned: false,
    });
    toast(t('links.added'));
  });

  container.querySelectorAll('.card[data-id]').forEach((card) => {
    const id = card.dataset.id;
    card.querySelectorAll('[data-action]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const a = btn.dataset.action;
        if (a === 'pin') await store.togglePin('links', id);
        else if (a === 'edit') openEditor(store.all('links').find((x) => x.id === id), container);
        else if (a === 'archive') {
          await store.archive('links', id);
          toast(t('app.archived'));
        } else if (a === 'delete') {
          if (await confirmDialog(t('common.confirmDelete'))) await store.remove('links', id);
        }
      })
    );
  });
}

/**
 * @param {object|null} link - existing link (edit) or prefilled values
 * @param {boolean} prefillOnly - when true, link is a value template, not a record
 */
function openEditor(link, container, prefillOnly = false) {
  const isEdit = Boolean(link) && !prefillOnly && link.id;
  const { el, close } = openModal(`
    <div class="modal__head">
      <span class="modal__title">${isEdit ? t('action.edit') : t('links.new')}</span>
      <button class="icon-btn" data-close>${icon('x')}</button>
    </div>
    <div class="modal__body">
      <div class="field">
        <label class="field__label">${t('links.url')}</label>
        <input class="input" id="le-url" placeholder="https://" value="${link ? escapeHtml(link.url || '') : ''}" />
      </div>
      <div class="field">
        <label class="field__label">${t('links.title')}</label>
        <div class="input-with-mic"><input class="input" id="le-title" value="${link ? escapeHtml(link.title || '') : ''}" /></div>
      </div>
      <div class="field">
        <label class="field__label">${t('links.desc')}</label>
        <div class="input-with-mic"><textarea class="textarea" id="le-desc">${link ? escapeHtml(link.desc || '') : ''}</textarea></div>
      </div>
      <div class="form-actions">
        <button class="btn btn--ghost" data-close>${t('action.cancel')}</button>
        <button class="btn btn--primary" id="le-save">${t('action.save')}</button>
      </div>
    </div>`);

  if (voiceSupported()) el.querySelectorAll('.input-with-mic').forEach(attachMic);
  el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  el.querySelector(prefillOnly ? '#le-desc' : '#le-url').focus();

  const doSave = async () => {
    const url = el.querySelector('#le-url').value.trim();
    if (!url) return;
    const patch = {
      url: normalizeUrl(url),
      title: el.querySelector('#le-title').value.trim() || hostname(url),
      desc: el.querySelector('#le-desc').value.trim(),
    };
    if (isEdit) await store.update('links', link.id, patch);
    else await store.add('links', { ...patch, pinned: false });
    close();
    toast(t('app.saved'));
    render(container);
  };
  el.querySelector('#le-save').addEventListener('click', doSave);
  submitOnEnter(el, doSave);
}
