/**
 * Global search across tasks, ideas, notes, links and journal entries.
 * Clicking the top search box opens a slide-down panel; the user types freely
 * and results appear only on Enter or the Search button (no per-keystroke
 * jumping). Recent queries are remembered and offered when the panel opens.
 */
import * as store from './store.js';
import { t, getLang } from './i18n.js';
import { icon } from './icons.js';
import { escapeHtml, formatDate } from './utils.js';
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
  const trigger = document.getElementById('globalSearch');
  const panel = document.getElementById('searchPanel');
  const input = document.getElementById('searchPanelInput');
  const goBtn = document.getElementById('searchPanelGo');
  const closeBtn = document.getElementById('searchPanelClose');
  const recentBox = document.getElementById('searchRecent');
  const recentChips = document.getElementById('searchRecentChips');
  const results = document.getElementById('searchResults');

  document.getElementById('searchPanelIcon').innerHTML = icon('search', { size: 16 });
  closeBtn.innerHTML = icon('x');

  function renderRecent() {
    const recent = store.getUi('recentSearches') || [];
    if (!recent.length) {
      recentBox.hidden = true;
      return;
    }
    recentChips.innerHTML = recent
      .map((q) => `<button class="chip" data-recent="${escapeHtml(q)}">${escapeHtml(q)}</button>`)
      .join('');
    recentBox.hidden = false;
    recentChips.querySelectorAll('[data-recent]').forEach((c) =>
      c.addEventListener('click', () => {
        input.value = c.dataset.recent;
        runSearch();
      })
    );
  }

  function onOutside(e) {
    if (!panel.contains(e.target) && e.target !== trigger) close();
  }

  function open() {
    if (panel.classList.contains('open')) return;
    panel.classList.add('open');
    results.innerHTML = '';
    renderRecent();
    requestAnimationFrame(() => input.focus());
    document.addEventListener('mousedown', onOutside, true);
  }

  function close() {
    if (!panel.classList.contains('open')) return;
    panel.classList.remove('open');
    input.value = '';
    results.innerHTML = '';
    recentBox.hidden = true;
    trigger.blur();
    document.removeEventListener('mousedown', onOutside, true);
  }

  async function runSearch() {
    const raw = input.value.trim();
    if (!raw) {
      results.innerHTML = '';
      renderRecent();
      return;
    }
    recentBox.hidden = true;
    renderResults(raw.toLowerCase(), results, navigate, close);
    await store.addRecentSearch(raw);
  }

  // The top box is a readonly trigger — focusing/clicking it opens the panel.
  trigger.addEventListener('focus', open);
  trigger.addEventListener('click', open);

  goBtn.addEventListener('click', runSearch);
  closeBtn.addEventListener('click', close);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runSearch();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });
}

function renderResults(q, container, navigate, close) {
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

  container.innerHTML = total ? html : emptyState('search', t('search.empty'), '', true);

  container.querySelectorAll('[data-go]').forEach((el) => {
    el.addEventListener('click', () => {
      navigate(el.dataset.go);
      close();
    });
  });
}
