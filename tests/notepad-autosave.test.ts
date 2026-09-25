import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSafeStorage } from '../src/lib/storage.ts';
import type { StorageLike } from '../src/lib/storage.ts';
import { DRAFT_KEYS, parseDraftMeta } from '../src/lib/text/draft.ts';
import { createAutosave } from '../src/scripts/tools/notepad/autosave.ts';
import type { AutosaveTimers, DraftSnapshot } from '../src/scripts/tools/notepad/autosave.ts';

function quotaError(): Error {
  const error = new Error('full');
  error.name = 'QuotaExceededError';
  return error;
}

function memoryStorage(quota = Infinity) {
  const map = new Map<string, string>();
  let writes = 0;
  const used = () => [...map].reduce((sum, [key, value]) => sum + key.length + value.length, 0);
  const backend: StorageLike = {
    getItem: (key) => map.get(key) ?? null,
    setItem(key, value) {
      const previous = map.get(key);
      const next = used() - (previous === undefined ? 0 : key.length + previous.length) + key.length + value.length;
      if (next > quota) throw quotaError();
      writes++;
      map.set(key, value);
    },
    removeItem: (key) => void map.delete(key),
  };
  return { map, backend, writes: () => writes };
}

/** Timers that only run when the test says so. */
function manualTimers() {
  let next = 1;
  const queue = new Map<number, { callback: () => void; ms: number }>();
  const timers: AutosaveTimers = {
    set(callback, ms) {
      const id = next++;
      queue.set(id, { callback, ms });
      return id;
    },
    clear(id) {
      queue.delete(id as number);
    },
  };
  return {
    timers,
    delays: () => [...queue.values()].map((entry) => entry.ms),
    runAll() {
      const entries = [...queue.values()];
      queue.clear();
      for (const entry of entries) entry.callback();
    },
  };
}

/** A fake editor: the snapshot the autosave reads. */
function editor(text = '') {
  return {
    text,
    version: 0,
    filename: 'untitled.txt',
    lineEnding: 'lf' as const as 'lf' | 'crlf',
    selectionStart: 0,
    selectionEnd: 0,
    scrollTop: 0,
    wrap: true,
    type(value: string) {
      this.text = value;
      this.version++;
    },
    snapshot(): DraftSnapshot {
      return {
        version: this.version,
        length: this.text.length,
        filename: this.filename,
        lineEnding: this.lineEnding,
        selectionStart: this.selectionStart,
        selectionEnd: this.selectionEnd,
        scrollTop: this.scrollTop,
        wrap: this.wrap,
      };
    },
  };
}

function setup(options: { quota?: number; backend?: StorageLike | null; stored?: Record<string, string> } = {}) {
  const memory = memoryStorage(options.quota);
  for (const [key, value] of Object.entries(options.stored ?? {})) memory.map.set(key, value);
  const storage = createSafeStorage(() => (options.backend === undefined ? memory.backend : options.backend));
  const clock = manualTimers();
  const page = editor();
  let changes = 0;
  let time = 1_000;
  const autosave = createAutosave({
    storage,
    snapshot: () => page.snapshot(),
    readText: () => page.text,
    onChange: () => changes++,
    now: () => time,
    timers: clock.timers,
  });
  return {
    autosave,
    memory,
    clock,
    page,
    changes: () => changes,
    advance(ms: number) {
      time += ms;
    },
  };
}

test('starts idle and saves the text after a pause', () => {
  const { autosave, memory, clock, page } = setup();
  assert.equal(autosave.state, 'idle');
  assert.equal(autosave.enabled, true);
  assert.equal(autosave.protects, true);

  page.type('Hello');
  autosave.schedule(page.text.length);
  assert.equal(autosave.pending, true);
  assert.deepEqual(clock.delays(), [400]);
  assert.equal(memory.map.size, 0, 'nothing is written before the pause');

  clock.runAll();
  assert.equal(autosave.pending, false);
  assert.equal(autosave.state, 'saved');
  assert.equal(autosave.savedAt, 1_000);
  assert.equal(memory.map.get(DRAFT_KEYS.text), 'Hello');
  const meta = parseDraftMeta(memory.map.get(DRAFT_KEYS.meta));
  assert.equal(meta?.length, 5);
  assert.equal(meta?.filename, 'untitled.txt');
  assert.equal(meta?.savedAt, 1_000);
});

test('debounces: only the last of several changes is written', () => {
  const { autosave, memory, clock, page } = setup();
  page.type('a');
  autosave.schedule(1);
  page.type('ab');
  autosave.schedule(2);
  assert.equal(clock.delays().length, 1);
  clock.runAll();
  assert.equal(memory.map.get(DRAFT_KEYS.text), 'ab');
  assert.equal(memory.writes(), 2); // text + meta
});

test('longer texts wait longer', () => {
  const { autosave, clock } = setup();
  autosave.schedule(600_000);
  assert.deepEqual(clock.delays(), [2500]);
});

test('meta-only changes do not rewrite the text', () => {
  const { autosave, memory, clock, page, advance } = setup();
  page.type('Hello');
  autosave.schedule(5);
  clock.runAll();
  const writes = memory.writes();

  // The caret moved: flush() refreshes the metadata only, and keeps the saved time.
  page.selectionStart = page.selectionEnd = 3;
  advance(5_000);
  autosave.flush();
  assert.equal(memory.writes(), writes + 1);
  assert.equal(parseDraftMeta(memory.map.get(DRAFT_KEYS.meta))?.selectionStart, 3);
  assert.equal(autosave.savedAt, 1_000);

  // A new file name is content: new saved time, still no text write.
  page.filename = 'notes.md';
  autosave.schedule(5);
  clock.runAll();
  assert.equal(memory.writes(), writes + 2);
  assert.equal(autosave.savedAt, 6_000);
  assert.equal(parseDraftMeta(memory.map.get(DRAFT_KEYS.meta))?.filename, 'notes.md');
});

test('flush writes a waiting change right away', () => {
  const { autosave, memory, page } = setup();
  page.type('Leaving soon');
  autosave.schedule(page.text.length);
  autosave.flush();
  assert.equal(memory.map.get(DRAFT_KEYS.text), 'Leaving soon');
  assert.equal(autosave.pending, false);
});

test('an emptied text removes the stored draft', () => {
  const { autosave, memory, clock, page } = setup();
  page.type('Hello');
  autosave.schedule(5);
  clock.runAll();
  page.type('');
  autosave.schedule(0);
  clock.runAll();
  assert.equal(memory.map.size, 0);
  assert.equal(autosave.state, 'idle');
  assert.equal(autosave.savedAt, null);
});

test('a full quota removes the older draft and is reported', () => {
  const { autosave, memory, clock, page } = setup({ quota: 200 });
  page.type('small');
  autosave.schedule(5);
  clock.runAll();
  assert.equal(autosave.state, 'saved');

  page.type('x'.repeat(500));
  autosave.schedule(500);
  clock.runAll();
  assert.equal(autosave.state, 'full');
  assert.equal(autosave.protects, false);
  assert.equal(autosave.savedAt, null);
  assert.equal(memory.map.has(DRAFT_KEYS.text), false, 'the stale draft must not come back');
  assert.equal(memory.map.has(DRAFT_KEYS.meta), false);

  // Just as long or longer: not tried again.
  const writes = memory.writes();
  page.type('x'.repeat(501));
  autosave.schedule(501);
  clock.runAll();
  assert.equal(memory.writes(), writes);
  assert.equal(autosave.state, 'full');

  // Shorter again: saved.
  page.type('fits again');
  autosave.schedule(10);
  clock.runAll();
  assert.equal(autosave.state, 'saved');
  assert.equal(memory.map.get(DRAFT_KEYS.text), 'fits again');
});

test('blocked storage makes autosave unavailable', () => {
  const blocked: StorageLike = {
    getItem() {
      throw Object.assign(new Error('blocked'), { name: 'SecurityError' });
    },
    setItem() {
      throw Object.assign(new Error('blocked'), { name: 'SecurityError' });
    },
    removeItem() {},
  };
  const { autosave, clock, page } = setup({ backend: blocked });
  assert.equal(autosave.state, 'unavailable');
  assert.equal(autosave.enabled, false);
  assert.equal(autosave.protects, false);
  page.type('Hello');
  autosave.schedule(5);
  assert.deepEqual(clock.delays(), []);
  assert.equal(autosave.load(), null);
});

test('load restores what an earlier visit stored', () => {
  const first = setup();
  first.page.type('Draft from yesterday');
  first.page.filename = 'draft.md';
  first.page.lineEnding = 'crlf';
  first.page.selectionStart = first.page.selectionEnd = 5;
  first.autosave.schedule(20);
  first.clock.runAll();

  const second = setup({ stored: Object.fromEntries(first.memory.map) });
  const draft = second.autosave.load();
  assert.ok(draft);
  assert.equal(draft.text, 'Draft from yesterday');
  assert.equal(draft.filename, 'draft.md');
  assert.equal(draft.lineEnding, 'crlf');
  assert.deepEqual(draft.selection, { start: 5, end: 5 });
  assert.equal(draft.complete, true);

  second.page.type(draft.text);
  second.autosave.markStored(second.page.snapshot(), draft.savedAt ?? 0);
  assert.equal(second.autosave.state, 'saved');
  assert.equal(second.autosave.savedAt, 1_000);

  // Unchanged text: flush writes the metadata only.
  const writes = second.memory.writes();
  second.autosave.flush();
  assert.equal(second.memory.writes(), writes + 1);
});

test('clear removes the draft and cancels a waiting write', () => {
  const { autosave, memory, clock, page } = setup();
  page.type('Hello');
  autosave.schedule(5);
  clock.runAll();
  page.type('Hello again');
  autosave.schedule(11);
  autosave.clear();
  clock.runAll();
  assert.equal(memory.map.size, 0);
  assert.equal(autosave.state, 'idle');
  assert.equal(autosave.pending, false);
});

test('turning autosave off removes the draft and remembers the choice', () => {
  const { autosave, memory, clock, page, changes } = setup();
  page.type('Private');
  autosave.schedule(7);
  clock.runAll();
  const before = changes();

  autosave.setEnabled(false);
  assert.equal(autosave.enabled, false);
  assert.equal(autosave.state, 'off');
  assert.equal(autosave.protects, false);
  assert.ok(changes() > before);
  assert.equal(memory.map.get(DRAFT_KEYS.autosave), '0');
  assert.equal(memory.map.has(DRAFT_KEYS.text), false);
  assert.equal(memory.map.has(DRAFT_KEYS.meta), false);
  assert.equal(autosave.storedPreference(), false);

  // While off nothing is written.
  page.type('Still private');
  autosave.schedule(13);
  autosave.flush();
  assert.equal(memory.map.has(DRAFT_KEYS.text), false);

  // A later visit starts with autosave off and restores nothing.
  const later = setup({ stored: Object.fromEntries(memory.map) });
  assert.equal(later.autosave.enabled, false);
  assert.equal(later.autosave.state, 'off');
  assert.equal(later.autosave.load(), null);

  // Turning it back on saves right away.
  autosave.setEnabled(true);
  assert.equal(autosave.state, 'saved');
  assert.equal(memory.map.get(DRAFT_KEYS.text), 'Still private');
  assert.equal(memory.map.has(DRAFT_KEYS.autosave), false);
});

test('following another tab’s choice does not write the preference again', () => {
  const { autosave, memory, clock, page } = setup();
  page.type('Shared');
  autosave.schedule(6);
  clock.runAll();
  autosave.setEnabled(false, { persist: false });
  assert.equal(autosave.state, 'off');
  assert.equal(memory.map.has(DRAFT_KEYS.autosave), false);
  assert.equal(memory.map.get(DRAFT_KEYS.text), 'Shared', 'the tab that turned it off removes the draft');
});

test('storedMeta reads what another tab wrote', () => {
  const { autosave, memory, clock, page } = setup();
  assert.equal(autosave.storedMeta(), null);
  page.type('Hello');
  autosave.schedule(5);
  clock.runAll();
  assert.equal(autosave.storedMeta()?.savedAt, 1_000);
  memory.map.set(DRAFT_KEYS.meta, 'garbage');
  assert.equal(autosave.storedMeta(), null);
});
