/**
 * Draft autosave helper. Wires a set of fields to debounced persistence so that
 * unsaved text (notes, journal entries, quick capture) survives popup closes
 * and browser restarts. Backed by the dedicated drafts key in the store.
 */
import * as store from './store.js';
import { debounce } from './utils.js';

/**
 * Create an autosaver.
 * @param {object} cfg
 * @param {string} cfg.kind   - 'note' | 'journal' | 'quick'
 * @param {string} [cfg.key]  - sub-key (e.g. journal date)
 * @param {() => object} cfg.collect - returns the current field snapshot
 * @param {(snapshot:object)=>boolean} [cfg.isEmpty] - skip saving empty drafts
 * @param {number} [cfg.wait] - debounce ms (default 2000 per spec)
 */
export function createAutosave({ kind, key, collect, isEmpty, wait = 2000 }) {
  const save = debounce(() => {
    const snapshot = collect();
    if (isEmpty && isEmpty(snapshot)) {
      store.clearDraft(kind, key);
    } else {
      store.setDraft(kind, snapshot, key);
    }
  }, wait);

  return {
    /** Call on every input event. */
    schedule: () => save(),
    /** Flush immediately (e.g. before unload). */
    flush: () => save.flush(),
    /** Cancel a pending save and clear the stored draft. */
    clear: () => {
      save.cancel();
      store.clearDraft(kind, key);
    },
    /** Read an existing draft snapshot, if any. */
    load: () => store.getDraft(kind, key),
  };
}
