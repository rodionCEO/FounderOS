/** Dashboard: Today's Focus, Morning Overview and compact recent widgets. */
import * as store from '../store.js';
import { t, getLang } from '../i18n.js';
import { icon } from '../icons.js';
import {
  escapeHtml,
  taskBucket,
  formatTime,
  dateKey,
  parseDateKey,
  relativeDayKey,
  formatDate,
} from '../utils.js';
import { emptyState } from '../ui.js';

/** Count consecutive days (ending today or yesterday) with journal entries. */
function journalStreak() {
  const dates = new Set(store.all('journal').map((e) => e.date));
  if (!dates.size) return 0;
  let streak = 0;
  const d = new Date();
  if (!dates.has(dateKey(d))) d.setDate(d.getDate() - 1); // allow streak to count up to yesterday
  while (dates.has(dateKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function lastEntryLabel(lang) {
  const entries = store.all('journal');
  if (!entries.length) return t('dash.never');
  const last = entries[0].date; // journal is kept date-desc
  const rel = relativeDayKey(parseDateKey(last).getTime());
  if (rel === 'today') return t('journal.today');
  if (rel === 'yesterday') return getLang() === 'ru' ? 'вчера' : 'yesterday';
  return formatDate(parseDateKey(last).getTime(), lang);
}

function line(text, time, go, id) {
  return `<div class="dash-line" data-go="${go}"${id ? ` data-id="${id}"` : ''}>
    <span class="dash-line__dot"></span>
    <span class="dash-line__text">${escapeHtml(text)}</span>
    ${time ? `<span class="dash-line__time">${time}</span>` : ''}
  </div>`;
}

export default function render(container, { navigate } = {}) {
  const lang = getLang();
  const tasks = store.all('tasks').filter((x) => !x.archived && !x.done);
  const focus = tasks.filter((x) => x.focus).slice(0, 3);
  const todays = tasks.filter((x) => taskBucket(x) === 'today');
  const overdue = tasks.filter((x) => taskBucket(x) === 'overdue');
  const ideas = store.all('ideas').filter((x) => !x.archived).slice(0, 3);
  const notes = store.all('notes').filter((x) => !x.archived).slice(0, 3);
  const streak = journalStreak();

  // Today's Focus
  const focusWidget = `
    <div class="widget widget--full">
      <div class="widget__title">${icon('star', { size: 14 })} ${t('dash.focus')}</div>
      ${
        focus.length
          ? `<div class="focus-list">${focus
              .map(
                (tk) =>
                  `<div class="focus-item" data-go="tasks">${escapeHtml(tk.title)}</div>`
              )
              .join('')}</div>`
          : emptyState('star', t('dash.focusEmpty'), '', true)
      }
    </div>`;

  // Morning Overview
  const overviewWidget = `
    <div class="widget widget--full">
      <div class="widget__title">${icon('dashboard', { size: 14 })} ${t('dash.overview')}</div>
      <div class="stat-row">
        <div class="stat"><span class="stat__num">${tasks.length}</span><span class="stat__label">${t('dash.active')}</span></div>
        <div class="stat"><span class="stat__num${overdue.length ? ' alert' : ''}">${overdue.length}</span><span class="stat__label">${t('dash.overdue')}</span></div>
        <div class="stat"><span class="stat__num">${store.all('ideas').filter((x) => !x.archived).length}</span><span class="stat__label">${t('dash.ideas')}</span></div>
        <div class="stat"><span class="stat__num">${store.all('notes').filter((x) => !x.archived).length}</span><span class="stat__label">${t('dash.notes')}</span></div>
      </div>
      <div class="card__meta" style="margin-top:10px">${t('dash.lastEntry')}: ${lastEntryLabel(lang)}</div>
    </div>`;

  const todayTasksWidget = `
    <div class="widget">
      <div class="widget__title">${icon('tasks', { size: 14 })} ${t('dash.todayTasks')}
        <span class="widget__link" data-go="tasks">${icon('chevronRight', { size: 13 })}</span>
      </div>
      ${
        todays.length
          ? todays.slice(0, 4).map((tk) => line(tk.title, formatTime(tk.deadline, lang), 'tasks')).join('')
          : emptyState('check', t('tasks.groupEmpty'), '', true)
      }
    </div>`;

  const ideasWidget = `
    <div class="widget">
      <div class="widget__title">${icon('idea', { size: 14 })} ${t('dash.recentIdeas')}
        <span class="widget__link" data-go="ideas">${icon('chevronRight', { size: 13 })}</span>
      </div>
      ${ideas.length ? ideas.map((i) => line(i.title, '', 'ideas')).join('') : emptyState('idea', t('ideas.empty'), '', true)}
    </div>`;

  const notesWidget = `
    <div class="widget">
      <div class="widget__title">${icon('note', { size: 14 })} ${t('dash.recentNotes')}
        <span class="widget__link" data-go="notes">${icon('chevronRight', { size: 13 })}</span>
      </div>
      ${notes.length ? notes.map((n) => line(n.title || n.text, '', 'notes')).join('') : emptyState('note', t('notes.empty'), '', true)}
    </div>`;

  const journalWidget = `
    <div class="widget">
      <div class="widget__title">${icon('journal', { size: 14 })} ${t('dash.journal')}
        <span class="widget__link" data-go="journal">${icon('chevronRight', { size: 13 })}</span>
      </div>
      <div class="stat" style="margin-bottom:8px">
        <span class="stat__num">${streak}</span>
        <span class="stat__label">${streak ? t('dash.streak', { n: streak }) : t('dash.noStreak')}</span>
      </div>
      <button class="btn btn--sm btn--block" data-go="journal">${icon('plus', { size: 14 })} ${t('dash.writeToday')}</button>
    </div>`;

  container.innerHTML = `
    ${focusWidget}
    <div style="height:12px"></div>
    ${overviewWidget}
    <div style="height:12px"></div>
    <div class="dash-grid">
      ${todayTasksWidget}
      ${ideasWidget}
      ${notesWidget}
      ${journalWidget}
    </div>`;

  container.querySelectorAll('[data-go]').forEach((el) =>
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      navigate(el.dataset.go);
    })
  );
}
