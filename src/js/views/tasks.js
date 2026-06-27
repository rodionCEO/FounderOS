/** Tasks view: importance filter + group/all views, collapsible deadline groups,
 *  pin (to top) and Focus Day (max 3) as separate actions, drag-and-drop. */
import * as store from '../store.js';
import { t, getLang } from '../i18n.js';
import { icon } from '../icons.js';
import { escapeHtml, taskBucket, formatDate, formatTime } from '../utils.js';
import { actionBtn, emptyState, toast, openModal, confirmDialog, importanceBadge, submitOnEnter } from '../ui.js';
import { attachMic, voiceSupported } from '../voice.js';
import { deadlineField, wireDeadlineField } from '../deadline.js';

const IMPORTANCE = [
  ['all', 'tasks.filterAll'],
  ['high', 'tasks.high'],
  ['mid', 'tasks.mid'],
  ['low', 'tasks.low'],
];

const GROUPS = [
  { key: 'overdue', label: 'tasks.group.overdue', icon: 'flame', accent: true },
  { key: 'today', label: 'tasks.group.today', icon: 'calendar' },
  { key: 'tomorrow', label: 'tasks.group.tomorrow', icon: 'hourglass' },
  { key: 'later', label: 'tasks.group.later', icon: 'inbox' },
];

// Which deadline groups start expanded (Overdue + Today). Remembered per-user.
const GROUP_DEFAULTS = { overdue: true, today: true, tomorrow: false, later: false };

let importanceFilter = 'all';
let viewMode = 'grouped'; // 'grouped' | 'all'

function passesImportance(task) {
  return importanceFilter === 'all' || task.importance === importanceFilter;
}

/** Pinned tasks float to the top of their group; otherwise keep manual order. */
function pinnedFirst(a, b) {
  return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (a.order ?? 0) - (b.order ?? 0);
}

function groupExpanded(key) {
  const tg = store.getUi('taskGroups') || {};
  return tg[key] ?? GROUP_DEFAULTS[key] ?? false;
}

function taskCard(task) {
  const lang = getLang();
  const time = formatTime(task.deadline, lang);
  const date = formatDate(task.deadline, lang);
  const overdue = taskBucket(task) === 'overdue';
  return `
    <div class="card card--task card--${task.importance}${task.pinned ? ' pinned' : ''}"
         data-id="${task.id}" draggable="${viewMode === 'grouped'}">
      <div class="card__head">
        <span class="drag-handle" title="">${dragDots()}</span>
        <div style="flex:1;min-width:0">
          <div class="card__title">${escapeHtml(task.title)}</div>
          ${task.desc ? `<div class="card__desc">${escapeHtml(task.desc)}</div>` : ''}
          <div class="card__meta">
            ${importanceBadge(task.importance)}
            ${
              task.deadline
                ? `<span class="badge ${overdue ? 'badge--overdue' : 'badge--date'}">${icon(
                    'clock',
                    { size: 11 }
                  )}${t('tasks.due')} ${date}${time ? ' ' + time : ''}</span>`
                : ''
            }
          </div>
        </div>
        <div class="card__actions">
          ${actionBtn('pin', 'pin', task.pinned ? 'action.unpin' : 'action.pin', task.pinned ? 'icon-btn--accent' : '')}
          ${actionBtn('focus', 'star', task.focus ? 'tasks.focusRemove' : 'tasks.focusAdd', task.focus ? 'icon-btn--accent' : '')}
          ${actionBtn('complete', 'checkCircle', 'action.complete')}
          ${actionBtn('edit', 'edit', 'action.edit')}
          ${actionBtn('archive', 'archiveBox', 'action.archive')}
          ${actionBtn('delete', 'trash', 'action.delete')}
        </div>
      </div>
    </div>`;
}

function dragDots() {
  return '<svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor"><circle cx="4" cy="3" r="1.4"/><circle cx="10" cy="3" r="1.4"/><circle cx="4" cy="8" r="1.4"/><circle cx="10" cy="8" r="1.4"/><circle cx="4" cy="13" r="1.4"/><circle cx="10" cy="13" r="1.4"/></svg>';
}

export default function render(container) {
  const active = store
    .all('tasks')
    .filter((tk) => !tk.archived && !tk.done && passesImportance(tk));

  const impSeg = IMPORTANCE.map(
    ([k, l]) =>
      `<button class="type-switch__btn${importanceFilter === k ? ' active' : ''}" data-imp="${k}">${t(l)}</button>`
  ).join('');
  const viewSeg = [
    ['grouped', 'tasks.viewGrouped'],
    ['all', 'tasks.viewAll'],
  ]
    .map(
      ([k, l]) =>
        `<button class="type-switch__btn${viewMode === k ? ' active' : ''}" data-view="${k}">${t(l)}</button>`
    )
    .join('');

  const filterBar = `
    <div class="filter-bar">
      <div class="filter-bar__row">
        <span class="filter-bar__label">${t('tasks.importanceLabel')}</span>
        <div class="type-switch">${impSeg}</div>
      </div>
      <div class="filter-bar__row">
        <span class="filter-bar__label">${t('tasks.view')}</span>
        <div class="type-switch">${viewSeg}</div>
        <button class="btn btn--primary btn--sm" id="newTask">${icon('plus', { size: 14 })} ${t('tasks.new')}</button>
      </div>
    </div>`;

  const totalActive = store.all('tasks').filter((tk) => !tk.archived && !tk.done).length;

  let body;
  if (totalActive === 0) {
    body = emptyState('tasks', t('tasks.empty'), t('tasks.emptyHint'));
  } else if (viewMode === 'all') {
    // Flat list: pinned first, then newest added.
    const flat = active
      .slice()
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.createdAt || 0) - (a.createdAt || 0));
    body = flat.length
      ? `<div class="task-list" data-group="all">${flat.map(taskCard).join('')}</div>`
      : emptyState('tasks', t('tasks.allEmpty'), '', true);
  } else {
    body = GROUPS.map((g) => {
      const items = active.filter((tk) => taskBucket(tk) === g.key).sort(pinnedFirst);
      const expanded = groupExpanded(g.key);
      return `
        <div class="task-group${expanded ? '' : ' collapsed'}" data-group="${g.key}">
          <button class="task-group__head" data-toggle="${g.key}" type="button">
            <span class="task-group__chevron">${icon('chevronDown', { size: 16 })}</span>
            <span class="task-group__icon${g.accent ? ' accent' : ''}">${icon(g.icon, { size: 15 })}</span>
            ${t(g.label)}
            <span class="task-group__count">${items.length}</span>
          </button>
          <div class="task-group__body">
            <div class="task-group__inner">
              <div class="task-list" data-group="${g.key}">
                ${items.length ? items.map(taskCard).join('') : emptyState('check', t('tasks.groupEmpty'), '', true)}
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  container.innerHTML = `${filterBar}${body}`;

  container.querySelectorAll('[data-imp]').forEach((b) =>
    b.addEventListener('click', () => {
      importanceFilter = b.dataset.imp;
      render(container);
    })
  );
  container.querySelectorAll('[data-view]').forEach((b) =>
    b.addEventListener('click', () => {
      viewMode = b.dataset.view;
      render(container);
    })
  );
  container.querySelector('#newTask').addEventListener('click', () => openEditor(null, container));

  // Collapse / expand groups — animate in place and remember the choice.
  container.querySelectorAll('[data-toggle]').forEach((head) =>
    head.addEventListener('click', () => {
      const key = head.dataset.toggle;
      const groupEl = head.closest('.task-group');
      const collapsed = groupEl.classList.toggle('collapsed');
      const tg = { ...GROUP_DEFAULTS, ...(store.getUi('taskGroups') || {}) };
      tg[key] = !collapsed;
      store.setUi('taskGroups', tg);
    })
  );

  wireCardActions(container);
  if (viewMode === 'grouped') wireDragDrop(container);
}

function wireCardActions(container) {
  container.querySelectorAll('.card[data-id]').forEach((card) => {
    const id = card.dataset.id;
    card.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'complete') {
          card.classList.add('card--completing');
          setTimeout(async () => {
            await store.completeTask(id);
            toast(t('tasks.done'));
          }, 280);
        } else if (action === 'edit') {
          openEditor(store.all('tasks').find((x) => x.id === id), container);
        } else if (action === 'archive') {
          card.classList.add('card--removing');
          setTimeout(async () => {
            await store.archive('tasks', id);
            toast(t('app.archived'));
          }, 220);
        } else if (action === 'delete') {
          if (await confirmDialog(t('common.confirmDelete'))) {
            card.classList.add('card--removing');
            setTimeout(() => store.remove('tasks', id), 220);
          }
        } else if (action === 'pin') {
          await store.togglePin('tasks', id);
        } else if (action === 'focus') {
          const res = await store.toggleFocus(id);
          if (res && res.error === 'focusLimit') toast(t('tasks.focusLimit'));
        }
      });
    });
  });
}

/** Native HTML5 drag & drop reordering. New order is persisted to the store. */
function wireDragDrop(container) {
  let dragId = null;

  container.querySelectorAll('.card[draggable="true"]').forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      dragId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      container.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
      persistOrder();
    });
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      const dragging = container.querySelector('.dragging');
      if (!dragging || dragging === card) return;
      const list = card.parentElement;
      const rect = card.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      list.insertBefore(dragging, after ? card.nextSibling : card);
    });
  });

  // Allow dropping into empty group lists.
  container.querySelectorAll('.task-list').forEach((list) => {
    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      const dragging = container.querySelector('.dragging');
      if (dragging && !list.querySelector('.card')) list.appendChild(dragging);
    });
  });

  function persistOrder() {
    if (!dragId) return;
    const ids = [...container.querySelectorAll('.task-list .card[data-id]')].map((c) => c.dataset.id);
    dragId = null;
    if (ids.length) store.reorderTasks(ids);
  }
}

/** Create / edit a task in a modal. */
function openEditor(task, container) {
  const isEdit = Boolean(task);
  const { el, close } = openModal(`
    <div class="modal__head">
      <span class="modal__title">${isEdit ? t('action.edit') : t('tasks.new')}</span>
      <button class="icon-btn" data-close>${icon('x')}</button>
    </div>
    <div class="modal__body">
      <div class="field">
        <label class="field__label">${t('tasks.title')}</label>
        <div class="input-with-mic"><input class="input" id="te-title" value="${task ? escapeHtml(task.title) : ''}" /></div>
      </div>
      <div class="field">
        <label class="field__label">${t('tasks.desc')}</label>
        <div class="input-with-mic"><textarea class="textarea" id="te-desc">${task ? escapeHtml(task.desc || '') : ''}</textarea></div>
      </div>
      <div class="field">
        <label class="field__label">${t('tasks.importance')}</label>
        <select class="select" id="te-importance">
          <option value="high"${imp(task, 'high')}>${t('tasks.high')}</option>
          <option value="mid"${imp(task, 'mid')}>${t('tasks.mid')}</option>
          <option value="low"${imp(task, 'low')}>${t('tasks.low')}</option>
        </select>
      </div>
      <div class="field">
        <label class="field__label">${t('tasks.deadline')}</label>
        ${deadlineField({ value: task && task.deadline ? task.deadline : null, withTime: true })}
      </div>
      <div class="form-actions">
        <button class="btn btn--ghost" data-close>${t('action.cancel')}</button>
        <button class="btn btn--primary" id="te-save">${t('action.save')}</button>
      </div>
    </div>
  `);

  if (voiceSupported()) el.querySelectorAll('.input-with-mic').forEach(attachMic);
  el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  const deadline = wireDeadlineField(el, { withTime: true });
  el.querySelector('#te-title').focus();

  const doSave = async () => {
    const title = el.querySelector('#te-title').value.trim();
    if (!title) return;
    const patch = {
      title,
      desc: el.querySelector('#te-desc').value.trim(),
      importance: el.querySelector('#te-importance').value,
      deadline: deadline.getValue(),
    };
    if (isEdit) await store.update('tasks', task.id, patch);
    else await store.add('tasks', patch);
    close();
    toast(t('app.saved'));
    render(container);
  };

  el.querySelector('#te-save').addEventListener('click', doSave);
  submitOnEnter(el, doSave);
}

function imp(task, level) {
  const cur = task ? task.importance : 'mid';
  return cur === level ? ' selected' : '';
}
