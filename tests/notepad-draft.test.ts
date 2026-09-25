import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DRAFT_FORMAT,
  DRAFT_KEYS,
  autosaveDelay,
  combineDraftWithEarlyText,
  parseAutosavePreference,
  parseDraftMeta,
  restoreDraft,
  serializeDraftMeta,
} from '../src/lib/text/draft.ts';
import type { DraftMeta } from '../src/lib/text/draft.ts';

function meta(overrides: Partial<DraftMeta> = {}): DraftMeta {
  return {
    v: DRAFT_FORMAT,
    filename: 'notes.md',
    lineEnding: 'crlf',
    savedAt: Date.UTC(2026, 8, 25, 11, 5),
    length: 11,
    selectionStart: 2,
    selectionEnd: 5,
    scrollTop: 120,
    wrap: false,
    ...overrides,
  };
}

test('the keys carry the format version', () => {
  for (const key of Object.values(DRAFT_KEYS)) assert.match(key, /^notepad:v1:/);
  assert.equal(new Set(Object.values(DRAFT_KEYS)).size, 3);
});

test('metadata survives a round trip', () => {
  const value = meta();
  assert.deepEqual(parseDraftMeta(serializeDraftMeta(value)), value);
});

test('parseDraftMeta drops unknown fields', () => {
  const raw = JSON.stringify({ ...meta(), extra: 'x' });
  assert.deepEqual(parseDraftMeta(raw), meta());
});

test('parseDraftMeta rejects damaged or foreign metadata', () => {
  const bad: unknown[] = [
    null,
    undefined,
    '',
    'not json',
    '[]',
    '42',
    'null',
    JSON.stringify({ ...meta(), v: 2 }),
    JSON.stringify({ ...meta(), v: '1' }),
    JSON.stringify({ ...meta(), filename: 42 }),
    JSON.stringify({ ...meta(), filename: 'x'.repeat(1001) }),
    JSON.stringify({ ...meta(), lineEnding: 'cr' }),
    JSON.stringify({ ...meta(), savedAt: 0 }),
    JSON.stringify({ ...meta(), savedAt: '2026-09-25' }),
    JSON.stringify({ ...meta(), length: -1 }),
    JSON.stringify({ ...meta(), length: 1.5 }),
    JSON.stringify({ ...meta(), selectionStart: null }),
    JSON.stringify({ ...meta(), scrollTop: -3 }),
    JSON.stringify({ ...meta(), wrap: 'yes' }),
  ];
  for (const raw of bad) assert.equal(parseDraftMeta(raw as string), null, String(raw));
});

test('restoreDraft restores a complete draft', () => {
  const draft = restoreDraft('Hello world', serializeDraftMeta(meta()));
  assert.deepEqual(draft, {
    text: 'Hello world',
    filename: 'notes.md',
    lineEnding: 'crlf',
    savedAt: meta().savedAt,
    selection: { start: 2, end: 5 },
    scrollTop: 120,
    wrap: false,
    complete: true,
  });
});

test('restoreDraft orders a backwards selection', () => {
  const draft = restoreDraft('Hello world', serializeDraftMeta(meta({ selectionStart: 9, selectionEnd: 4 })));
  assert.deepEqual(draft?.selection, { start: 4, end: 9 });
});

test('restoreDraft has nothing to restore without text', () => {
  assert.equal(restoreDraft(null, serializeDraftMeta(meta())), null);
  assert.equal(restoreDraft('', serializeDraftMeta(meta({ length: 0 }))), null);
  assert.equal(restoreDraft(undefined, null), null);
});

test('an interrupted save keeps the newer text but not the old caret', () => {
  // The text was written, the metadata (length 11) still describes the previous text.
  const draft = restoreDraft('Hello world, again', serializeDraftMeta(meta()));
  assert.ok(draft);
  assert.equal(draft.text, 'Hello world, again');
  assert.equal(draft.complete, false);
  assert.equal(draft.filename, 'notes.md');
  assert.equal(draft.lineEnding, 'crlf');
  assert.equal(draft.savedAt, null);
  assert.equal(draft.selection, null);
  assert.equal(draft.scrollTop, 0);
});

test('missing or damaged metadata never discards the text', () => {
  for (const raw of [null, '{', JSON.stringify({ v: 9 })]) {
    const draft = restoreDraft('Only the text survived', raw);
    assert.ok(draft);
    assert.equal(draft.text, 'Only the text survived');
    assert.equal(draft.filename, null);
    assert.equal(draft.lineEnding, null);
    assert.equal(draft.wrap, null);
    assert.equal(draft.complete, false);
  }
});

test('a blank stored file name falls back to the default', () => {
  const draft = restoreDraft('Hello world', serializeDraftMeta(meta({ filename: '   ' })));
  assert.equal(draft?.filename, null);
});

test('a selection beyond the text is dropped', () => {
  const draft = restoreDraft('Hello world', serializeDraftMeta(meta({ selectionEnd: 40 })));
  assert.equal(draft?.selection, null);
});

test('text typed before start-up never replaces the stored draft', () => {
  assert.deepEqual(combineDraftWithEarlyText('Draft', ''), { text: 'Draft', kept: 'draft' });
  assert.deepEqual(combineDraftWithEarlyText('Draft', 'Draft'), { text: 'Draft', kept: 'draft' });
  // The typed text already holds the draft (it was there when typing began).
  assert.deepEqual(combineDraftWithEarlyText('Draft', 'Draft and more'), { text: 'Draft and more', kept: 'early' });
  // Anything else goes after the draft, on its own line.
  assert.deepEqual(combineDraftWithEarlyText('Draft', 'new'), { text: 'Draft\nnew', kept: 'both' });
  assert.deepEqual(combineDraftWithEarlyText('Draft\n', 'new'), { text: 'Draft\nnew', kept: 'both' });
  assert.deepEqual(combineDraftWithEarlyText('Draft', 'Dr'), { text: 'Draft\nDr', kept: 'both' });
});

test('autosave is on unless it was turned off', () => {
  assert.equal(parseAutosavePreference(null), true);
  assert.equal(parseAutosavePreference(undefined), true);
  assert.equal(parseAutosavePreference('1'), true);
  assert.equal(parseAutosavePreference('garbage'), true);
  assert.equal(parseAutosavePreference('0'), false);
});

test('autosaveDelay waits longer for longer texts', () => {
  assert.equal(autosaveDelay(0), 400);
  assert.equal(autosaveDelay(49_999), 400);
  assert.equal(autosaveDelay(50_000), 1200);
  assert.equal(autosaveDelay(499_999), 1200);
  assert.equal(autosaveDelay(500_000), 2500);
  assert.equal(autosaveDelay(20_000_000), 2500);
});
