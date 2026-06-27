/**
 * Application entry point: boots the store, renders the chrome (top bar + tabs)
 * and routes between section views. Views are plain modules exposing render().
 */
import * as store from './store.js';
import { t, setLang, getLang, nextLang, applyStatic, onLangChange } from './i18n.js';
import { icon } from './icons.js';
import { voiceSupported } from './voice.js';

import renderDashboard from './views/dashboard.js';
import renderTasks from './views/tasks.js';
import renderIdeas from './views/ideas.js';
import renderNotes from './views/notes.js';
import renderLinks from './views/links.js';
import renderJournal from './views/journal.js';
import renderCompleted from './views/completed.js';
import renderArchive from './views/archive.js';
import renderSettings from './views/settings.js';

import { openQuickCapture } from './quickCapture.js';
import { initSearch } from './search.js';
import { initShortcuts } from './shortcuts.js';
import { applyPopupSize } from './layout.js';

const VIEWS = {
  dashboard: { icon: 'dashboard', label: 'tab.dashboard', render: renderDashboard, tab: true },
  tasks: { icon: 'tasks', label: 'tab.tasks', render: renderTasks, tab: true },
  ideas: { icon: 'idea', label: 'tab.ideas', render: renderIdeas, tab: true },
  notes: { icon: 'note', label: 'tab.notes', render: renderNotes, tab: true },
  links: { icon: 'link', label: 'tab.links', render: renderLinks, tab: true },
  journal: { icon: 'journal', label: 'tab.journal', render: renderJournal, tab: true },
  completed: { icon: 'checkCircle', label: 'tab.completed', render: renderCompleted, tab: true },
  archive: { icon: 'archive', label: 'tab.archive', render: renderArchive, tab: true },
  settings: { icon: 'settings', label: 'settings.title', render: renderSettings, tab: false },
};

let current = 'dashboard';

/** Router: switch to a section and render it. */
export function navigate(section, payload) {
  if (!VIEWS[section]) return;
  current = section;
  document.querySelectorAll('.tab').forEach((el) => {
    el.classList.toggle('active', el.dataset.section === section);
  });
  renderCurrent(payload);
}

/** Re-render the active view (used after data/language changes). */
export function renderCurrent(payload) {
  const container = document.getElementById('view');
  container.innerHTML = '';
  container.classList.remove('fade-in');
  void container.offsetWidth; // restart animation
  container.classList.add('fade-in');
  VIEWS[current].render(container, { navigate, payload });
}

/** Build the section tab bar. */
function renderTabs() {
  const nav = document.getElementById('tabs');
  nav.innerHTML = '';
  Object.entries(VIEWS)
    .filter(([, v]) => v.tab)
    .forEach(([key, v]) => {
      const btn = document.createElement('button');
      btn.className = 'tab' + (key === current ? ' active' : '');
      btn.dataset.section = key;
      btn.innerHTML = `<span class="tab__icon">${icon(v.icon, { size: 15 })}</span>${t(v.label)}`;
      btn.addEventListener('click', () => navigate(key));
      nav.appendChild(btn);
    });
}

/** Inject icons into static header buttons. */
function renderHeaderIcons() {
  document.getElementById('brandLogo').innerHTML = icon('logo', { size: 22 });
  document.getElementById('searchIcon').innerHTML = icon('search', { size: 14 });
  document.getElementById('quickCaptureBtn').innerHTML = icon('plus');
  document.getElementById('dockBtn').innerHTML = icon('sidebar');
  document.getElementById('expandBtn').innerHTML = icon('expand');
  document.getElementById('settingsBtn').innerHTML = icon('settings');
  document.getElementById('langBtn').textContent = getLang().toUpperCase();
}

/** Adapt the chrome depending on how the page is being shown. */
function setupViewMode() {
  const params = new URLSearchParams(location.search);
  const mode = params.get('view');
  const dockBtn = document.getElementById('dockBtn');

  if (mode === 'full') {
    document.body.classList.add('fullpage');
    document.getElementById('expandBtn').style.display = 'none';
  } else if (mode === 'side') {
    // Side panel: fill its container; the user resizes width by dragging it.
    document.documentElement.classList.add('sidepanel');
    document.body.classList.add('sidepanel');
    dockBtn.style.display = 'none';
    document.getElementById('expandBtn').style.display = 'none';
  }

  // Hide the dock button if the Side Panel API is unavailable (older Chrome).
  if (mode !== 'side' && !(chrome.sidePanel && chrome.windows)) {
    dockBtn.style.display = 'none';
  }
}

function wireHeader() {
  document.getElementById('quickCaptureBtn').addEventListener('click', () =>
    openQuickCapture({ navigate })
  );
  document.getElementById('settingsBtn').addEventListener('click', () => navigate('settings'));
  document.getElementById('expandBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?view=full') });
  });
  document.getElementById('dockBtn').addEventListener('click', async () => {
    try {
      const win = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: win.id });
      window.close(); // dismiss the popup; the side panel takes over
    } catch {
      // Side panel unavailable — fall back to a full tab.
      chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?view=full') });
    }
  });
  document.getElementById('langBtn').addEventListener('click', async () => {
    const next = nextLang();
    await store.setSetting('lang', next);
    setLang(next);
  });
}

/** Apply a language switch across the whole chrome and active view. */
function onLanguage() {
  document.getElementById('langBtn').textContent = getLang().toUpperCase();
  applyStatic();
  renderTabs();
  renderCurrent();
}

async function boot() {
  await store.init();
  setLang(store.getSetting('lang') || 'en');

  applyPopupSize(store.getSetting('popupSize') || 'md');
  setupViewMode();
  renderHeaderIcons();
  applyStatic();
  renderTabs();
  wireHeader();

  initSearch({ navigate });
  initShortcuts({ navigate, openQuickCapture: () => openQuickCapture({ navigate }) });

  onLangChange(onLanguage);
  // Re-render the current view whenever underlying data changes.
  store.subscribe(() => renderCurrent());

  navigate('dashboard');

  // Expose for views that need cross-section navigation via events.
  window.__founderos = { navigate, voiceSupported };
}

document.addEventListener('DOMContentLoaded', boot);
