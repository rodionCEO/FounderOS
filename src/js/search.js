/**
 * Global search across tasks, ideas, notes, links and journal entries.
 * Results render in an overlay grouped by type; clicking a result jumps to its
 * section. Searching is debounced and case-insensitive.
 */
import * as store from './store.js';
import { t } from './i18n.js';
import { icon } from './icons.js';
import { escapeHtml, debounce, formatDate } from './utils.js';
import { getLang } from './i18n.js';
import { emptyState } from './ui.js';

const GROUPS = [
  { type: 'tasks', icon: 'tasks', label: 'tab.tasks', fields: ['title', 'desc'], title: (x) => x.title },
  { type: 'ideas', icon: 'idea', label: 'tab.ideas', fields: ['title', 'desc'], title: (x) => x.title },
  { type: 'notes', icon: 'note', label: 'tab.notes', fields: ['title', 'text'], title: (x) => x.title || x.text },
  { type: 'links', icon: 'link', label: 'tab.links', fields: ['title', 'desc', 'url'], title: (x) => x.title },
  {
    type: 'journal',
    icon: 'journal',
    label: 'tab.journal',
    fields: ['mainGoal', 'did', 'learned', 'result', 'improve'],
    title: (x) => x.date,
  },
];

function matches(item, fields, q) {
  return fields.some((f) => String(item[f] || '').toLowerCase().includes(q));
}

export function initSearch({ navigate }) {
  const input = document.getElementById('globalSearch');
  const results = document.getElementById('searchResults');

  const run = debounce(() => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      results.hidden = true;
      results.innerHTML = '';
      return;
    }
    renderResults(q, results, navigate);
  }, 160);

  input.addEventListener('input', run);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      results.hidden = true;
      results.innerHTML = '';
      input.blur();
    }
  });
}

function renderResults(q, container, navigate) {
  let html = '';
  let total = 0;

  for (const g of GROUPS) {
    const hits = store.all(g.type).filter((x) => matches(x, g.fields, q));
    if (!hits.length) continue;
    total += hits.length;
    html += `<div class="search-group">
      <div class="search-group__type">${t(g.label)} · ${hits.length}</div>`;
    for (const item of hits.slice(0, 8)) {
      const title = g.title(item) || '—';
      html += `<div class="card" data-go="${g.type}" data-id="${item.id}" style="cursor:pointer">
        <div class="card__head">
          <span class="section-title__icon" style="color:var(--accent)">${icon(g.icon, { size: 14 })}</span>
          <div class="card__title">${escapeHtml(String(title).slice(0, 80))}</div>
        </div>
        ${
          item.createdAt
            ? `<div class="card__meta">${formatDate(item.createdAt, getLang())}</div>`
            : ''
        }
      </div>`;
    }
    html += `</div>`;
  }

  container.innerHTML = total
    ? html
    : emptyState('search', t('search.empty'), '', true);
  container.hidden = false;

  container.querySelectorAll('[data-go]').forEach((el) => {
    el.addEventListener('click', () => {
      container.hidden = true;
      document.getElementById('globalSearch').value = '';
      navigate(el.dataset.go);
    });
  });
}
