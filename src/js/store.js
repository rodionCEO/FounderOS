/**
 * Data layer. The single source of truth for all persisted data.
 * Everything lives in chrome.storage.local under one key; views never touch
 * chrome.storage directly. A small pub/sub lets the UI re-render on change.
 */
import { uid } from './utils.js';

const DATA_KEY = 'founderos';
const DRAFTS_KEY = 'founderos_drafts';
const UI_KEY = 'founderos_ui';
const SCHEMA_VERSION = 1;

const DEFAULT_DATA = {
  version: SCHEMA_VERSION,
  settings: { lang: 'en' },
  tasks: [],
  ideas: [],
  notes: [],
  links: [],
  journal: [],
};

const DEFAULT_DRAFTS = { note: null, journal: {}, quick: null };

/**
 * Lightweight, view-only UI state. Kept in its own storage key so it never
 * touches the core data model (export/import, schema) and changes never trigger
 * a data re-render. Used for things like which task groups are expanded and the
 * recent-search history.
 */
const DEFAULT_UI = {
  taskGroups: { overdue: true, today: true, tomorrow: false, later: false },
  recentSearches: [],
};

let state = structuredClone(DEFAULT_DATA);
let drafts = structuredClone(DEFAULT_DRAFTS);
let ui = structuredClone(DEFAULT_UI);
const listeners = new Set();

/** Promise wrapper around chrome.storage.local.get. */
function rawGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
/** Promise wrapper around chrome.storage.local.set. */
function rawSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

/** Load both data and drafts from storage into memory. Call once on boot. */
export async function init() {
  const res = await rawGet([DATA_KEY, DRAFTS_KEY, UI_KEY]);
  if (res[DATA_KEY]) {
    state = { ...structuredClone(DEFAULT_DATA), ...res[DATA_KEY] };
  } else {
    await rawSet({ [DATA_KEY]: state });
  }
  if (res[DRAFTS_KEY]) {
    drafts = { ...structuredClone(DEFAULT_DRAFTS), ...res[DRAFTS_KEY] };
  }
  if (res[UI_KEY]) {
    ui = { ...structuredClone(DEFAULT_UI), ...res[UI_KEY] };
  }
}

/** Persist current data to storage and notify listeners. */
async function persist() {
  await rawSet({ [DATA_KEY]: state });
  listeners.forEach((fn) => fn(state));
}

/** Subscribe to data changes. Returns an unsubscribe function. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Whole-state read access (returns the live object — do not mutate directly). */
export function getState() {
  return state;
}

/** Collection accessors. */
export function all(collection) {
  return state[collection] || [];
}

/* ---------- Settings ---------- */
export function getSetting(key) {
  return state.settings[key];
}
export async function setSetting(key, value) {
  state.settings[key] = value;
  await persist();
}

/* ---------- UI state (view-only, no re-render) ---------- */
/** Read a UI-state value (or the whole object when called without a key). */
export function getUi(key) {
  return key ? ui[key] : ui;
}
/** Persist a UI-state value WITHOUT notifying data listeners (no re-render). */
export async function setUi(key, value) {
  ui[key] = value;
  await rawSet({ [UI_KEY]: ui });
}
/** Push a query onto the recent-search history (deduped, newest first, max 5). */
export async function addRecentSearch(query) {
  const q = String(query || '').trim();
  if (!q) return;
  const prev = (ui.recentSearches || []).filter((x) => x.toLowerCase() !== q.toLowerCase());
  ui.recentSearches = [q, ...prev].slice(0, 5);
  await rawSet({ [UI_KEY]: ui });
}

/* ---------- Generic CRUD for tasks/ideas/notes/links ---------- */
export async function add(collection, item) {
  const now = Date.now();
  const record = {
    id: uid(),
    createdAt: now,
    archived: false,
    ...item,
  };
  if (collection === 'tasks') {
    record.order = state.tasks.length;
    record.done = record.done || false;
    record.focus = record.focus || false;
    record.pinned = record.pinned || false;
    record.completedAt = null;
  }
  if (collection === 'notes') record.updatedAt = now;
  state[collection].unshift(record);
  await persist();
  return record;
}

export async function update(collection, id, patch) {
  const item = state[collection].find((x) => x.id === id);
  if (!item) return null;
  Object.assign(item, patch);
  if (collection === 'notes') item.updatedAt = Date.now();
  await persist();
  return item;
}

export async function remove(collection, id) {
  state[collection] = state[collection].filter((x) => x.id !== id);
  await persist();
}

export async function archive(collection, id) {
  return update(collection, id, { archived: true });
}
export async function unarchive(collection, id) {
  return update(collection, id, { archived: false });
}

export async function togglePin(collection, id) {
  const item = state[collection].find((x) => x.id === id);
  if (!item) return null;
  return update(collection, id, { pinned: !item.pinned });
}

/* ---------- Task-specific ---------- */
/**
 * Mark a task as done. It stays in the tasks collection (NOT archived) so it
 * shows up in the dedicated "Completed" view, grouped by completion date.
 * It disappears from the active Tasks view automatically (which filters !done).
 */
export async function completeTask(id) {
  return update('tasks', id, {
    done: true,
    focus: false,
    completedAt: Date.now(),
  });
}

/** Re-open a completed task: send it back to the active list. */
export async function uncompleteTask(id) {
  return update('tasks', id, { done: false, completedAt: null });
}

/** Move all completed (done, not yet archived) tasks into the Archive. */
export async function archiveCompleted() {
  state.tasks.forEach((t) => {
    if (t.done && !t.archived) t.archived = true;
  });
  await persist();
}

export async function toggleFocus(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return null;
  if (!task.focus) {
    const focusCount = state.tasks.filter((t) => t.focus && !t.done && !t.archived).length;
    if (focusCount >= 3) return { error: 'focusLimit' };
  }
  return update('tasks', id, { focus: !task.focus });
}

/** Persist a new task order (array of ids in display order). */
export async function reorderTasks(orderedIds) {
  orderedIds.forEach((id, idx) => {
    const t = state.tasks.find((x) => x.id === id);
    if (t) t.order = idx;
  });
  await persist();
}

/* ---------- Journal ---------- */
export function getJournalEntry(date) {
  return state.journal.find((e) => e.date === date) || null;
}

/** Dates of journal drafts that hold non-empty content (autosaved, not yet committed). */
export function journalDraftDates() {
  return Object.keys(drafts.journal || {}).filter((date) => {
    const d = drafts.journal[date];
    if (!d) return false;
    return Object.entries(d).some(([k, v]) => k !== 'ts' && String(v || '').trim());
  });
}

export async function saveJournalEntry(date, fields) {
  let entry = state.journal.find((e) => e.date === date);
  if (entry) {
    Object.assign(entry, fields, { updatedAt: Date.now() });
  } else {
    entry = { date, ...fields, updatedAt: Date.now() };
    state.journal.push(entry);
  }
  state.journal.sort((a, b) => (a.date < b.date ? 1 : -1));
  await persist();
  return entry;
}

/* ---------- Drafts (autosave) ---------- */
export function getDraft(kind, key) {
  if (kind === 'journal') return drafts.journal[key] || null;
  return drafts[kind] || null;
}

export async function setDraft(kind, value, key) {
  if (kind === 'journal') {
    if (value) drafts.journal[key] = { ...value, ts: Date.now() };
    else delete drafts.journal[key];
  } else {
    drafts[kind] = value ? { ...value, ts: Date.now() } : null;
  }
  await rawSet({ [DRAFTS_KEY]: drafts });
}

export async function clearDraft(kind, key) {
  return setDraft(kind, null, key);
}

/* ---------- Import / Export / Maintenance ---------- */
export function exportData() {
  return JSON.stringify(state, null, 2);
}

export async function importData(json) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid data');
  state = { ...structuredClone(DEFAULT_DATA), ...parsed, version: SCHEMA_VERSION };
  await persist();
}

export async function clearArchive() {
  ['tasks', 'ideas', 'notes', 'links'].forEach((c) => {
    state[c] = state[c].filter((x) => !x.archived && !(c === 'tasks' && x.done));
  });
  await persist();
}

/* ---------- Statistics ---------- */
export function stats() {
  const t = state.tasks;
  return {
    totalTasks: t.length,
    completedTasks: t.filter((x) => x.done).length,
    activeTasks: t.filter((x) => !x.done && !x.archived).length,
    totalIdeas: state.ideas.length,
    totalNotes: state.notes.length,
    totalLinks: state.links.length,
    journalEntries: state.journal.length,
  };
}
