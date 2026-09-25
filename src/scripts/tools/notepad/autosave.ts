/**
 * Autosave for the notepad: keeps the latest text in the browser's localStorage.
 *
 * Writes are debounced (autosaveDelay grows with the text length, because every write is
 * synchronous and copies the whole text) and only rewrite the text when it changed; the
 * controller calls flush() when the page is hidden or unloaded. Nothing ever leaves the device.
 *
 * DOM-free (storage, clock and timers are injected), so node:test covers the state machine.
 */

import type { SafeStorage } from '../../../lib/storage.ts';
import {
  DRAFT_FORMAT,
  DRAFT_KEYS,
  autosaveDelay,
  parseAutosavePreference,
  parseDraftMeta,
  restoreDraft,
  serializeDraftMeta,
} from '../../../lib/text/draft.ts';
import type { DraftMeta, RestoredDraft } from '../../../lib/text/draft.ts';
import type { LineEnding } from '../../../lib/text/stats.ts';

/**
 * Outcome of the last write, which the status bar shows:
 * - idle: on, and nothing is stored (the text is empty, or nothing was written yet);
 * - saved: the text is stored (a newer change may be waiting: see `pending`);
 * - off: the visitor turned autosave off;
 * - unavailable: the browser blocks storage;
 * - full: the text doesn't fit in the storage quota;
 * - error: the write failed for another reason (it is tried again after the next change).
 */
export type AutosaveState = 'idle' | 'saved' | 'off' | 'unavailable' | 'full' | 'error';

/** Everything but the text, which is only read when it has to be written. */
export interface DraftSnapshot {
  /** Changes whenever the text changes (compared for equality only). */
  version: number;
  length: number;
  filename: string;
  lineEnding: LineEnding;
  selectionStart: number;
  selectionEnd: number;
  scrollTop: number;
  wrap: boolean;
}

export interface AutosaveTimers {
  set(callback: () => void, ms: number): unknown;
  clear(id: unknown): void;
}

export interface AutosaveOptions {
  storage: SafeStorage;
  snapshot: () => DraftSnapshot;
  readText: () => string;
  /** Called after `state`, `savedAt` or `enabled` changed. */
  onChange: () => void;
  now?: () => number;
  timers?: AutosaveTimers;
}

export interface Autosave {
  readonly state: AutosaveState;
  readonly enabled: boolean;
  /** When the stored text, file name or line endings last changed; null when nothing is stored. */
  readonly savedAt: number | null;
  /** A change is waiting for the next write. */
  readonly pending: boolean;
  /**
   * Leaving the page loses nothing: autosave works, and a waiting change is written by
   * flush() on pagehide. False while it is off or failing.
   */
  readonly protects: boolean;
  /** Something changed; `length` is the text length (it sets the delay). */
  schedule(length: number): void;
  /** Writes a waiting change now, and refreshes the caret position of a stored draft. */
  flush(): void;
  /** The stored draft, or null when there is none (or autosave can't read it). */
  load(): RestoredDraft | null;
  /** The stored metadata as it is now (another tab may have written it). */
  storedMeta(): DraftMeta | null;
  /** The stored preference as it is now (another tab may have changed it). */
  storedPreference(): boolean;
  /** The editor now shows what storage holds: after load() or taking over another tab's save. */
  markStored(snapshot: Pick<DraftSnapshot, 'version' | 'filename' | 'lineEnding'>, savedAt: number): void;
  /** Removes the stored draft (Clear). */
  clear(): void;
  /** Turns autosave on (writes right away) or off (removes the stored draft). */
  setEnabled(on: boolean, options?: { persist?: boolean }): void;
}

const defaultTimers: AutosaveTimers = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (id) => clearTimeout(id as Parameters<typeof clearTimeout>[0]),
};

export function createAutosave(options: AutosaveOptions): Autosave {
  const { storage, snapshot, readText, onChange } = options;
  const now = options.now ?? Date.now;
  const timers = options.timers ?? defaultTimers;

  const usable = storage.available();
  let enabled = usable && parseAutosavePreference(storage.get(DRAFT_KEYS.autosave));
  let state: AutosaveState = !usable ? 'unavailable' : enabled ? 'idle' : 'off';
  let savedAt: number | null = null;
  /** What the stored entries hold, as far as this page knows. */
  let stored: { version: number; filename: string; lineEnding: LineEnding } | null = null;
  let timer: unknown = null;
  let pending = false;
  /** Length of a text that didn't fit: texts at least this long aren't tried again. */
  let tooLong: number | null = null;

  function update(nextState: AutosaveState, nextSavedAt: number | null): void {
    if (nextState === state && nextSavedAt === savedAt) return;
    state = nextState;
    savedAt = nextSavedAt;
    onChange();
  }

  function cancelTimer(): void {
    if (timer !== null) timers.clear(timer);
    timer = null;
  }

  function removeEntries(): void {
    storage.remove(DRAFT_KEYS.text);
    storage.remove(DRAFT_KEYS.meta);
  }

  function write(): void {
    cancelTimer();
    pending = false;
    if (!enabled || state === 'unavailable') return;
    const snap = snapshot();

    // An empty page has nothing worth restoring.
    if (snap.length === 0) {
      removeEntries();
      stored = null;
      tooLong = null;
      update('idle', null);
      return;
    }

    const textChanged = !stored || stored.version !== snap.version;
    const contentChanged =
      textChanged || stored?.filename !== snap.filename || stored?.lineEnding !== snap.lineEnding;

    if (textChanged) {
      if (tooLong !== null && snap.length >= tooLong) {
        update('full', null);
        return;
      }
      const result = storage.set(DRAFT_KEYS.text, readText());
      if (!result.ok) {
        // Never leave an older draft behind: it would come back instead of this text.
        removeEntries();
        stored = null;
        tooLong = result.reason === 'quota' ? snap.length : null;
        update(result.reason === 'quota' ? 'full' : result.reason === 'unavailable' ? 'unavailable' : 'error', null);
        return;
      }
      tooLong = null;
    }

    const time = contentChanged || savedAt === null ? now() : savedAt;
    const meta: DraftMeta = {
      v: DRAFT_FORMAT,
      filename: snap.filename,
      lineEnding: snap.lineEnding,
      savedAt: time,
      length: snap.length,
      selectionStart: snap.selectionStart,
      selectionEnd: snap.selectionEnd,
      scrollTop: Math.max(0, Math.round(snap.scrollTop)),
      wrap: snap.wrap,
    };
    // If only this small write fails, the text is still stored: restoreDraft() recognises the
    // stale metadata by its length and restores the text without the old caret position.
    storage.set(DRAFT_KEYS.meta, serializeDraftMeta(meta));
    stored = { version: snap.version, filename: snap.filename, lineEnding: snap.lineEnding };
    update('saved', time);
  }

  return {
    get state() {
      return state;
    },
    get enabled() {
      return enabled;
    },
    get savedAt() {
      return savedAt;
    },
    get pending() {
      return pending;
    },
    get protects() {
      return enabled && (state === 'saved' || state === 'idle');
    },

    schedule(length) {
      if (!enabled || state === 'unavailable') return;
      pending = true;
      cancelTimer();
      timer = timers.set(write, autosaveDelay(length));
    },

    flush() {
      if (!enabled || state === 'unavailable') return;
      // A stored draft also gets the latest caret and scroll position.
      if (pending || state === 'saved') write();
    },

    load() {
      if (!usable || !enabled) return null;
      return restoreDraft(storage.get(DRAFT_KEYS.text), storage.get(DRAFT_KEYS.meta));
    },

    storedMeta() {
      return usable ? parseDraftMeta(storage.get(DRAFT_KEYS.meta)) : null;
    },

    storedPreference() {
      return usable && parseAutosavePreference(storage.get(DRAFT_KEYS.autosave));
    },

    markStored(snap, time) {
      if (!enabled) return;
      cancelTimer();
      pending = false;
      tooLong = null;
      stored = { version: snap.version, filename: snap.filename, lineEnding: snap.lineEnding };
      update('saved', time);
    },

    clear() {
      cancelTimer();
      pending = false;
      stored = null;
      tooLong = null;
      if (!usable) return;
      removeEntries();
      if (enabled) update('idle', null);
    },

    setEnabled(on, { persist = true } = {}) {
      if (!usable || on === enabled) return;
      enabled = on;
      if (persist) {
        if (on) storage.remove(DRAFT_KEYS.autosave);
        else storage.set(DRAFT_KEYS.autosave, '0');
      }
      if (on) {
        stored = null;
        // Moves the state on from 'off' (to idle, saved or a failure), which calls onChange.
        write();
      } else {
        cancelTimer();
        pending = false;
        stored = null;
        tooLong = null;
        // A tab that only follows another tab's choice leaves the removal to that tab.
        if (persist) removeEntries();
        state = 'off';
        savedAt = null;
        onChange();
      }
    },
  };
}
