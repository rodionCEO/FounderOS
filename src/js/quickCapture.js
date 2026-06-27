/**
 * Quick Capture — create a Task / Idea / Note / Link in a few clicks from any
 * screen. Restores the last unfinished input via the drafts layer and offers a
 * "Current tab" shortcut for links.
 */
import * as store from './store.js';
import { t } from './i18n.js';
import { icon } from './icons.js';
import { openModal, toast, submitOnEnter } from './ui.js';
import { attachMic, voiceSupported } from './voice.js';
import { createAutosave } from './drafts.js';
import { normalizeUrl } from './utils.js';
import { deadlineField, wireDeadlineField } from './deadline.js';

const TYPES = ['task', 'idea', 'note', 'link'];

/** Read the active browser tab (for the "Current tab" link shortcut). */
function getActiveTab() {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs && tabs[0] ? tabs[0] : null);
      });
    } catch {
      resolve(null);
    }
  });
}

function fieldsMarkup(type) {
  const mic = (id, ph, textarea = false) => `
    <div class="field">
      <div class="input-with-mic">
        ${
          textarea
            ? `<textarea class="textarea" id="${id}" placeholder="${ph}"></textarea>`
            : `<input class="input" id="${id}" placeholder="${ph}" />`
        }
      </div>
    </div>`;

  if (type === 'task') {
    return (
      mic('qc-title', t('tasks.title')) +
      `<div class="field">
        <select class="select" id="qc-importance">
          <option value="high">${t('tasks.high')}</option>
          <option value="mid" selected>${t('tasks.mid')}</option>
          <option value="low">${t('tasks.low')}</option>
        </select>
      </div>
      <div class="field">
        <label class="field__label">${t('tasks.deadline')}</label>
        ${deadlineField({ withTime: false, inputId: 'qc-deadline' })}
      </div>`
    );
  }
  if (type === 'idea') {
    return mic('qc-title', t('ideas.title')) + mic('qc-desc', t('ideas.desc'), true);
  }
  if (type === 'note') {
    return mic('qc-title', t('notes.title')) + mic('qc-text', t('notes.text'), true);
  }
  // link
  return (
    `<div class="field">
      <button class="btn btn--sm" id="qc-currenttab" type="button">
        ${icon('open', { size: 14 })} ${t('links.currentTab')}
      </button>
    </div>` +
    `<div class="field"><input class="input" id="qc-url" placeholder="${t('links.url')}" /></div>` +
    mic('qc-title', t('links.title')) +
    mic('qc-desc', t('links.desc'), true)
  );
}

/**
 * Open the Quick Capture modal.
 * @param {object} opts
 * @param {(s:string)=>void} opts.navigate
 * @param {string} [opts.type] - preselected type
 */
export function openQuickCapture({ navigate, type } = {}) {
  const draft = store.getDraft('quick');
  let activeType = type || (draft && draft.type) || 'task';

  const tabs = TYPES.map(
    (ty) =>
      `<button class="type-switch__btn${ty === activeType ? ' active' : ''}" data-type="${ty}">${t(
        'quick.' + ty
      )}</button>`
  ).join('');

  const { el, close } = openModal(`
    <div class="modal__head">
      <span class="modal__title">${t('quick.title')}</span>
      <button class="icon-btn" data-close>${icon('x')}</button>
    </div>
    <div class="modal__body">
      <div class="type-switch">${tabs}</div>
      <div id="qc-fields"></div>
      <div class="form-actions">
        <button class="btn btn--ghost" data-close>${t('action.cancel')}</button>
        <button class="btn btn--primary" id="qc-save">${t('action.save')}</button>
      </div>
    </div>
  `);

  const fieldsEl = el.querySelector('#qc-fields');

  const autosave = createAutosave({
    kind: 'quick',
    collect: () => ({ type: activeType, fields: collectFields() }),
    isEmpty: (s) => Object.values(s.fields).every((v) => !String(v || '').trim()),
    wait: 1200,
  });

  function collectFields() {
    const out = {};
    fieldsEl.querySelectorAll('input, textarea, select').forEach((f) => {
      out[f.id] = f.value;
    });
    return out;
  }

  function applyDraftValues() {
    if (!draft || draft.type !== activeType || !draft.fields) return;
    Object.entries(draft.fields).forEach(([id, val]) => {
      const f = fieldsEl.querySelector('#' + CSS.escape(id));
      if (f) f.value = val;
    });
  }

  function mountFields() {
    fieldsEl.innerHTML = fieldsMarkup(activeType);
    if (voiceSupported()) {
      fieldsEl.querySelectorAll('.input-with-mic').forEach(attachMic);
    }
    applyDraftValues();
    if (activeType === 'task') wireDeadlineField(fieldsEl, { withTime: false });
    fieldsEl.addEventListener('input', () => autosave.schedule());

    if (activeType === 'link') {
      fieldsEl.querySelector('#qc-currenttab')?.addEventListener('click', async () => {
        const tab = await getActiveTab();
        if (tab) {
          fieldsEl.querySelector('#qc-url').value = tab.url || '';
          fieldsEl.querySelector('#qc-title').value = tab.title || '';
          fieldsEl.querySelector('#qc-desc').focus();
        }
      });
    }
    fieldsEl.querySelector('input, textarea')?.focus();
  }

  // Type switching
  el.querySelectorAll('.type-switch__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeType = btn.dataset.type;
      el.querySelectorAll('.type-switch__btn').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
      mountFields();
    });
  });

  el.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => {
      autosave.flush();
      close();
    })
  );

  const doSave = async () => {
    const ok = await save(activeType, collectFields());
    if (!ok) return;
    autosave.clear();
    close();
    toast(t('app.saved'));
    if (navigate) navigate(pluralOf(activeType));
  };
  el.querySelector('#qc-save').addEventListener('click', doSave);
  submitOnEnter(el, doSave);

  if (draft && draft.type === activeType) toast(t('quick.draftRestored'));
  mountFields();
}

function pluralOf(type) {
  return { task: 'tasks', idea: 'ideas', note: 'notes', link: 'links' }[type];
}

async function save(type, f) {
  if (type === 'task') {
    if (!f['qc-title']?.trim()) return false;
    await store.add('tasks', {
      title: f['qc-title'].trim(),
      desc: '',
      importance: f['qc-importance'] || 'mid',
      deadline: f['qc-deadline'] ? new Date(f['qc-deadline']).getTime() : null,
    });
  } else if (type === 'idea') {
    if (!f['qc-title']?.trim()) return false;
    await store.add('ideas', { title: f['qc-title'].trim(), desc: (f['qc-desc'] || '').trim(), pinned: false });
  } else if (type === 'note') {
    if (!f['qc-title']?.trim() && !f['qc-text']?.trim()) return false;
    await store.add('notes', {
      title: (f['qc-title'] || '').trim(),
      text: (f['qc-text'] || '').trim(),
      pinned: false,
    });
  } else if (type === 'link') {
    if (!f['qc-url']?.trim()) return false;
    await store.add('links', {
      url: normalizeUrl(f['qc-url']),
      title: (f['qc-title'] || '').trim() || f['qc-url'].trim(),
      desc: (f['qc-desc'] || '').trim(),
      pinned: false,
    });
  }
  return true;
}
