/**
 * Completed view: tasks you've finished, grouped by the day they were completed.
 * Completed tasks live here (not in the active Tasks list, not auto-archived),
 * so you get a clean log of "what got done, and when". A "Clear" action sweeps
 * them into the Archive without losing any data.
 */
import * as store from '../store.js';
import { t, getLang } from '../i18n.js';
import { icon } from '../icons.js';
import { escapeHtml, dateKey, relativeDayKey, formatFullDate, formatTime } from '../utils.js';
import { actionBtn, emptyState, toast, confirmDialog, importanceBadge } from '../ui.js';

/** Human label for a day group: Today / Yesterday / full date. */
function groupLabel(ts) {
  const rel = relativeDayKey(ts);
  if (rel === 'today') return t('completed.today');
  if (rel === 'yesterday') return t('completed.yesterday');
  return formatFullDate(ts, getLang());
}

function completedCard(task) {
  const time = formatTime(task.completedAt, getLang());
  return `
    <div class="card card--task card--done card--${task.importance}" data-id="${task.id}">
      <div class="card__head">
        <span class="card__check">${icon('checkCircle', { size: 18 })}</span>
        <div style="flex:1;min-width:0">
          <div class="card__title done">${escapeHtml(task.title)}</div>
          ${task.desc ? `<div class="card__desc">${escapeHtml(task.desc)}</div>` : ''}
          <div class="card__meta">
            ${importanceBadge(task.importance)}
            <span class="badge badge--date">${icon('check', { size: 11 })}${t('completed.doneAt')}${
    time ? ' ' + time : ''
  }</span>
        </div>
      </div>
      <div class="card__actions">
        ${actionBtn('uncomplete', 'restore', 'action.uncomplete')}
        ${actionBtn('delete', 'trash', 'action.delete')}
      </div>
    </div>`;
}

export default function render(container) {
  const done = store
    .all('tasks')
    .filter((tk) => tk.done && !tk.archived)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  if (!done.length) {
    container.innerHTML = emptyState('checkCircle', t('completed.empty'), t('completed.emptyHint'));
    return;
  }

  // Group by completion day (YYYY-MM-DD), preserving the desc order above.
  const groups = [];
  const byKey = new Map();
  done.forEach((task) => {
    const key = task.completedAt ? dateKey(new Date(task.completedAt)) : 'unknown';
    if (!byKey.has(key)) {
      const g = { key, ts: task.completedAt, items: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    byKey.get(key).items.push(task);
  });

  const groupsHtml = groups
    .map(
      (g) => `
      <div class="section-title">
        <span class="section-title__icon">${icon('calendar', { size: 15 })}</span>
        ${escapeHtml(groupLabel(g.ts))}
        <span class="section-title__count">${g.items.length}</span>
      </div>
      <div class="task-list">${g.items.map(completedCard).join('')}</div>`
    )
    .join('');

  container.innerHTML = `
    <div class="view-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px">
      <div class="section-title" style="margin:0;border:0;padding:0">${t('completed.title')}<span class="section-title__count">${done.length}</span></div>
      <button class="btn btn--ghost btn--sm" id="clearCompleted">${icon('archiveBox', { size: 14 })} ${t('completed.clear')}</button>
    </div>
    ${groupsHtml}`;

  container.querySelector('#clearCompleted').addEventListener('click', async () => {
    if (await confirmDialog(t('completed.clearConfirm'))) {
      await store.archiveCompleted();
      toast(t('app.archived'));
    }
  });

  container.querySelectorAll('.card[data-id]').forEach((card) => {
    const id = card.dataset.id;
    card.querySelectorAll('[data-action]').forEach((btn) =>
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'uncomplete') {
          card.classList.add('card--removing');
          setTimeout(async () => {
            await store.uncompleteTask(id);
            toast(t('app.restored'));
          }, 220);
        } else if (action === 'delete') {
          if (await confirmDialog(t('common.confirmDelete'))) {
            card.classList.add('card--removing');
            setTimeout(() => store.remove('tasks', id), 220);
          }
        }
      })
    );
  });
}
