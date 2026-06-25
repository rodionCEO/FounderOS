/** Archive view: completed tasks and archived ideas/notes/links; restore or delete. */
import * as store from '../store.js';
import { t, getLang } from '../i18n.js';
import { icon } from '../icons.js';
import { escapeHtml, formatDate } from '../utils.js';
import { actionBtn, emptyState, toast, confirmDialog } from '../ui.js';

const FILTERS = [
  { key: 'all', label: 'archive.filterAll' },
  { key: 'tasks', label: 'tab.tasks' },
  { key: 'ideas', label: 'tab.ideas' },
  { key: 'notes', label: 'tab.notes' },
  { key: 'links', label: 'tab.links' },
];
const TYPE_ICON = { tasks: 'tasks', ideas: 'idea', notes: 'note', links: 'link' };

let filter = 'all';

/** Gather all archived items across collections, tagged with their type. */
function archivedItems() {
  const out = [];
  store.all('tasks').forEach((x) => {
    if (x.archived || x.done) out.push({ type: 'tasks', item: x, when: x.completedAt || x.createdAt });
  });
  ['ideas', 'notes', 'links'].forEach((c) =>
    store.all(c).forEach((x) => {
      if (x.archived) out.push({ type: c, item: x, when: x.createdAt });
    })
  );
  return out.sort((a, b) => (b.when || 0) - (a.when || 0));
}

function titleOf(type, item) {
  if (type === 'links') return item.title || item.url;
  if (type === 'notes') return item.title || item.text;
  return item.title;
}

export default function render(container) {
  const lang = getLang();
  let items = archivedItems();
  if (filter !== 'all') items = items.filter((x) => x.type === filter);

  const chips = FILTERS.map(
    (f) => `<button class="chip${filter === f.key ? ' active' : ''}" data-filter="${f.key}">${t(f.label)}</button>`
  ).join('');

  const body = items.length
    ? items
        .map(
          ({ type, item }) => `
      <div class="card" data-id="${item.id}" data-type="${type}">
        <div class="card__head">
          <span class="section-title__icon" style="color:var(--text-faint)">${icon(TYPE_ICON[type], { size: 14 })}</span>
          <div style="flex:1;min-width:0">
            <div class="card__title${type === 'tasks' && item.done ? ' done' : ''}">${escapeHtml(String(titleOf(type, item) || '—'))}</div>
            <div class="card__meta">${type === 'tasks' && item.completedAt ? t('archive.completedOn') : t('archive.archivedOn')} ${formatDate(item.completedAt || item.createdAt, lang)}</div>
          </div>
          <div class="card__actions">
            ${actionBtn('restore', 'restore', 'action.restore')}
            ${actionBtn('delete', 'trash', 'action.deleteForever')}
          </div>
        </div>
      </div>`
        )
        .join('')
    : emptyState('archive', t('archive.empty'), t('archive.emptyHint'));

  container.innerHTML = `<div class="chips">${chips}</div>${body}`;

  container.querySelectorAll('.chip').forEach((c) =>
    c.addEventListener('click', () => {
      filter = c.dataset.filter;
      render(container);
    })
  );

  container.querySelectorAll('.card[data-id]').forEach((card) => {
    const id = card.dataset.id;
    const type = card.dataset.type;
    card.querySelector('[data-action="restore"]').addEventListener('click', async () => {
      const patch = { archived: false };
      if (type === 'tasks') {
        patch.done = false;
        patch.completedAt = null;
      }
      await store.update(type, id, patch);
      toast(t('app.restored'));
    });
    card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      if (await confirmDialog(t('common.confirmDelete'))) await store.remove(type, id);
    });
  });
}
