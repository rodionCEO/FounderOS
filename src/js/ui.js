/** Shared UI primitives: toast, modal, confirm, icon action buttons, empty state. */
import { icon } from './icons.js';
import { t } from './i18n.js';

let toastTimer = null;

/** Show a transient toast message. */
export function toast(message) {
  document.querySelectorAll('.toast').forEach((el) => el.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2200);
}

/** Render an empty-state block. */
export function emptyState(iconName, title, hint, small = false) {
  return `
    <div class="empty${small ? ' empty--sm' : ''}">
      <span class="empty__icon">${icon(iconName)}</span>
      <div class="empty__title">${title}</div>
      ${hint ? `<div class="empty__hint">${hint}</div>` : ''}
    </div>`;
}

/** Build an icon action button markup with a data-action attribute. */
export function actionBtn(action, iconName, titleKey, extraClass = '') {
  return `<button class="icon-btn ${extraClass}" type="button"
    data-action="${action}" title="${t(titleKey)}">${icon(iconName)}</button>`;
}

/**
 * Save-on-Enter for modal forms. Enter in a single-line <input> submits;
 * in a <textarea> only Cmd/Ctrl+Enter submits (plain Enter keeps the newline).
 * Ignores <select> and other elements. Used for Quick Capture and the
 * task/idea/note/link editors (NOT the journal).
 */
export function submitOnEnter(scopeEl, submit) {
  scopeEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    const tag = e.target.tagName;
    if (tag === 'TEXTAREA') {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        submit();
      }
    } else if (tag === 'INPUT') {
      if (!e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        submit();
      }
    }
  });
}

/** Open a modal with the provided inner markup. Returns the modal element. */
export function openModal(innerHtml, { onClose } = {}) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-overlay">
      <div class="modal" role="dialog" aria-modal="true">${innerHtml}</div>
    </div>`;
  const overlay = root.querySelector('.modal-overlay');

  const close = () => {
    root.innerHTML = '';
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', onKey);

  root._close = close;
  return { el: root.querySelector('.modal'), close };
}

/** Close any open modal. */
export function closeModal() {
  const root = document.getElementById('modalRoot');
  if (root._close) root._close();
  else root.innerHTML = '';
}

/** Whether a modal is currently open. */
export function modalOpen() {
  return document.getElementById('modalRoot').childElementCount > 0;
}

/** Simple confirm dialog. Returns a Promise<boolean>. */
export function confirmDialog(message) {
  return new Promise((resolve) => {
    const { close } = openModal(
      `<div class="modal__body">
        <p style="margin-bottom:16px">${message}</p>
        <div class="form-actions">
          <button class="btn btn--ghost" data-confirm="no">${t('action.cancel')}</button>
          <button class="btn btn--primary" data-confirm="yes">${t('action.delete')}</button>
        </div>
      </div>`,
      { onClose: () => resolve(false) }
    );
    const root = document.getElementById('modalRoot');
    root.querySelector('[data-confirm="yes"]').addEventListener('click', () => {
      resolve(true);
      close();
    });
    root.querySelector('[data-confirm="no"]').addEventListener('click', () => close());
  });
}

/** Pin/importance/date badge helpers reused by views. */
export function importanceBadge(level) {
  const map = {
    high: ['flame', 'badge--high', 'tasks.high'],
    mid: ['bolt', 'badge--mid', 'tasks.mid'],
    low: ['flag', 'badge--low', 'tasks.low'],
  };
  const [ic, cls, key] = map[level] || map.low;
  return `<span class="badge ${cls}">${icon(ic, { size: 11 })}${t(key)}</span>`;
}
