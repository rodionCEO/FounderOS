/** Settings view: language, data (export/import/clear), about, statistics. */
import * as store from '../store.js';
import { t, getLang, setLang } from '../i18n.js';
import { icon } from '../icons.js';
import { toast, confirmDialog } from '../ui.js';
import { voiceSupported, requestMicPermission } from '../voice.js';

const SHORTCUTS = [
  ['t', 'sc.newTask'],
  ['i', 'sc.newIdea'],
  ['n', 'sc.newNote'],
  ['l', 'sc.newLink'],
  ['/', 'sc.search'],
  ['Esc', 'sc.close'],
];

export default function render(container) {
  const lang = getLang();
  const s = store.stats();

  const statRows = [
    ['stats.totalTasks', s.totalTasks],
    ['stats.completedTasks', s.completedTasks],
    ['stats.totalIdeas', s.totalIdeas],
    ['stats.totalNotes', s.totalNotes],
    ['stats.totalLinks', s.totalLinks],
    ['stats.journalEntries', s.journalEntries],
  ];

  container.innerHTML = `
    <!-- Language -->
    <div class="settings-section">
      <div class="settings-section__title">${t('settings.language')}</div>
      <div class="radio-row">
        <button class="radio-pill${lang === 'en' ? ' active' : ''}" data-lang="en">English</button>
        <button class="radio-pill${lang === 'ru' ? ' active' : ''}" data-lang="ru">Русский</button>
      </div>
    </div>

    ${
      voiceSupported()
        ? `<!-- Voice -->
    <div class="settings-section">
      <div class="settings-section__title">${t('voice.title')}</div>
      <button class="btn btn--block" id="micBtn">${icon('mic', { size: 15 })} ${t('voice.enable')}</button>
      <div class="about-meta" style="margin-top:8px">${t('voice.needPermission')}</div>
    </div>`
        : ''
    }

    <!-- Data -->
    <div class="settings-section">
      <div class="settings-section__title">${t('settings.data')}</div>
      <button class="btn btn--block" id="exportBtn" style="margin-bottom:8px">${icon('download', { size: 15 })} ${t('settings.export')}</button>
      <button class="btn btn--block" id="importBtn" style="margin-bottom:8px">${icon('upload', { size: 15 })} ${t('settings.import')}</button>
      <button class="btn btn--block btn--danger" id="clearBtn">${icon('trash', { size: 15 })} ${t('settings.clearArchive')}</button>
      <input type="file" id="importFile" accept="application/json,.json" hidden />
    </div>

    <!-- About -->
    <div class="settings-section">
      <div class="settings-section__title">${t('settings.about')}</div>
      <div class="about-meta">
        <strong>FounderOS</strong> v${chrome.runtime.getManifest().version}<br/>
        ${t('settings.aboutText')}
      </div>
      <div style="margin-top:12px">
        <div class="settings-section__title">${t('settings.shortcuts')}</div>
        ${SHORTCUTS.map(([k, d]) => `<div class="shortcut-row"><span class="kbd">${k}</span> ${t(d)}</div>`).join('')}
      </div>
    </div>

    <!-- Statistics (least important — kept at the bottom) -->
    <div class="settings-section">
      <div class="settings-section__title">${t('settings.statistics')}</div>
      <div class="stat-row">
        ${statRows
          .map(
            ([label, val]) =>
              `<div class="stat"><span class="stat__num">${val}</span><span class="stat__label">${t(label)}</span></div>`
          )
          .join('')}
      </div>
    </div>`;

  // Language
  container.querySelectorAll('[data-lang]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const next = btn.dataset.lang;
      if (next === getLang()) return;
      await store.setSetting('lang', next);
      setLang(next);
    })
  );

  // Voice — request microphone permission for the extension origin
  const micBtn = container.querySelector('#micBtn');
  if (micBtn) {
    micBtn.addEventListener('click', async () => {
      const ok = await requestMicPermission();
      toast(ok ? t('voice.enabled') : t('voice.denied'));
    });
  }

  // Export
  container.querySelector('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([store.exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `founderos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(t('settings.exported'));
  });

  // Import
  const fileInput = container.querySelector('#importFile');
  container.querySelector('#importBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      await store.importData(text);
      setLang(store.getSetting('lang') || 'en');
      toast(t('settings.imported'));
    } catch {
      toast(t('settings.importError'));
    }
    fileInput.value = '';
  });

  // Clear archive
  container.querySelector('#clearBtn').addEventListener('click', async () => {
    if (await confirmDialog(t('settings.clearArchiveConfirm'))) {
      await store.clearArchive();
      toast(t('settings.archiveCleared'));
    }
  });
}
