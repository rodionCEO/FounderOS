/** Tasks view: time-grouped, filterable, drag-and-drop reorderable. */
import * as store from '../store.js';
import { t, getLang } from '../i18n.js';
import { icon } from '../icons.js';
import { escapeHtml, taskBucket, formatDate, formatTime } from '../utils.js';
import { actionBtn, emptyState, toast, openModal, confirmDialog, importanceBadge } from '../ui.js';
import { attachMic, voiceSupported } from '../voice.js';

const FILTERS = [
  { key: 'all', label: 'tasks.filterAll' },
  { key: 'high', label: 'tasks.high' },
  { key: 'mid', label: 'tasks.mid' },
  { key: 'low', label: 'tasks.low' },
  { key: 'today', label: 'tasks.filterToday' },
  { key: 'overdue', label: 'tasks.filterOverdue' },
];

const GROUPS = [
  { key: 'overdue', label: 'tasks.group.overdue', icon: 'flame', accent: true },
  { key: 'today', label: 'tasks.group.today', icon: 'calendar' },
  { key: 'tomorrow', label: 'tasks.group.tomorrow', icon: 'hourglass' },
  { key: 'later', label: 'tasks.group.later', icon: 'inbox' },
];

let filter = 'all';

function passesFilter(task) {
  if (filter === 'all') return true;
  if (filter === 'high' || filter === 'mid' || filter === 'low') return task.importance === filter;
  if (filter === 'today') return taskBucket(task) === 'today';
  if (filter === 'overdue') return taskBucket(task) === 'overdue';
  return true;
}

function taskCard(task) {
  const lang = getLang();
  const time = formatTime(task.deadline, lang);
  const date = formatDate(task.deadline, lang);
  const overdue = taskBucket(task) === 'overdue';
  return `
    <div class="card card--task card--${task.importance}${task.focus ? ' pinned' : ''}"
         data-id="${task.id}" draggable="true">
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
          ${actionBtn('focus', 'star', task.focus ? 'action.unpin' : 'dash.focus', task.focus ? 'icon-btn--accent' : '')}
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
    .filter((tk) => !tk.archived && !tk.done && passesFilter(tk))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const chips = FILTERS.map(
    (f) => `<button class="chip${filter === f.key ? ' active' : ''}" data-filter="${f.key}">${t(f.label)}</button>`
  ).join('');

  const groupsHtml = GROUPS.map((g) => {
    const items = active.filter((tk) => taskBucket(tk) === g.key);
    return `
      <div class="section-title${g.accent ? '' : ''}">
        <span class="section-title__icon${g.accent ? ' section-title__accent' : ''}">${icon(g.icon, { size: 15 })}</span>
        ${t(g.label)}
        <span class="section-title__count">${items.length}</span>
      </div>
      <div class="task-list" data-group="${g.key}">
        ${items.length ? items.map(taskCard).join('') : emptyState('check', t('tasks.groupEmpty'), '', true)}
      </div>`;
  }).join('');

  const totalActive = store.all('tasks').filter((tk) => !tk.archived && !tk.done).length;

  container.innerHTML = `
    <div class="view-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px">
      <div class="chips" style="margin:0">${chips}</div>
      <button class="btn btn--primary btn--sm" id="newTask">${icon('plus', { size: 14 })} ${t('tasks.new')}</button>
    </div>
    ${totalActive === 0 && filter === 'all'
      ? emptyState('tasks', t('tasks.empty'), t('tasks.emptyHint'))
      : groupsHtml}
  `;

  container.querySelectorAll('.chip').forEach((c) =>
    c.addEventListener('click', () => {
      filter = c.dataset.filter;
      render(container);
    })
  );
  container.querySelector('#newTask').addEventListener('click', () => openEditor(null, container));

  wireCardActions(container);
  wireDragDrop(container);
}

function wireCardActions(container) {
  container.querySelectorAll('.card[data-id]').forEach((card) => {
    const id = card.dataset.id;
    card.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'complete') {
          // Play the completion flourish, then move the task to the Completed view.
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
      persistOrder(container);
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
  const dl = task && task.deadline ? toDateInput(task.deadline) : '';
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
      <div class="form-row">
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
          <input class="input" type="datetime-local" id="te-deadline" value="${dl}" />
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn--ghost" data-close>${t('action.cancel')}</button>
        <button class="btn btn--primary" id="te-save">${t('action.save')}</button>
      </div>
    </div>
  `);

  if (voiceSupported()) el.querySelectorAll('.input-with-mic').forEach(attachMic);
  el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  el.querySelector('#te-title').focus();

  el.querySelector('#te-save').addEventListener('click', async () => {
    const title = el.querySelector('#te-title').value.trim();
    if (!title) return;
    const patch = {
      title,
      desc: el.querySelector('#te-desc').value.trim(),
      importance: el.querySelector('#te-importance').value,
      deadline: el.querySelector('#te-deadline').value
        ? new Date(el.querySelector('#te-deadline').value).getTime()
        : null,
    };
    if (isEdit) await store.update('tasks', task.id, patch);
    else await store.add('tasks', patch);
    close();
    toast(t('app.saved'));
    render(container);
  });
}

function imp(task, level) {
  const cur = task ? task.importance : 'mid';
  return cur === level ? ' selected' : '';
}

function toDateInput(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}
