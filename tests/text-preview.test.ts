import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReplacementPreview } from '../src/lib/text/preview.ts';
import { compileSearch, findAllMatches } from '../src/lib/text/search.ts';
import type { SearchOptions } from '../src/lib/text/search.ts';

function matchesOf(text: string, query: string, overrides: Partial<SearchOptions> = {}) {
  const compiled = compileSearch({
    query,
    matchCase: true,
    wholeWord: false,
    regex: false,
    multiline: true,
    dotAll: false,
    ...overrides,
  });
  assert.equal(compiled.status, 'ok');
  return findAllMatches(text, (compiled as { regex: RegExp }).regex);
}

test('preview items carry line numbers, context and the expanded replacement', () => {
  const text = 'first line\nsecond cat line\r\nthird\rfourth cat and cat';
  const items = buildReplacementPreview(text, matchesOf(text, 'cat'), 'dog', false);
  assert.deepEqual(
    items.map((item) => [item.line, item.before, item.removed, item.inserted, item.after]),
    [
      [2, 'second ', 'cat', 'dog', ' line'],
      [4, 'fourth ', 'cat', 'dog', ' and cat'],
      [4, 'fourth cat and ', 'cat', 'dog', ''],
    ],
  );
  assert.equal(items[0]!.clippedBefore, false);
  assert.equal(items[0]!.clippedAfter, false);
});

test('regex replacements are expanded per match', () => {
  const text = 'John Smith\nJane Doe';
  const items = buildReplacementPreview(text, matchesOf(text, '(\\w+) (\\w+)', { regex: true }), '$2, $1', true);
  assert.deepEqual(
    items.map((item) => [item.line, item.removed, item.inserted]),
    [
      [1, 'John Smith', 'Smith, John'],
      [2, 'Jane Doe', 'Doe, Jane'],
    ],
  );
});

test('long lines are clipped around the match', () => {
  const text = `${'a'.repeat(100)}X${'b'.repeat(100)}`;
  const [item] = buildReplacementPreview(text, matchesOf(text, 'X'), 'Y', false, { context: 10 });
  assert.ok(item);
  assert.equal(item.before, 'a'.repeat(10));
  assert.equal(item.after, 'b'.repeat(10));
  assert.equal(item.clippedBefore, true);
  assert.equal(item.clippedAfter, true);
});

test('clipping never splits a surrogate pair', () => {
  const text = `${'😀'.repeat(20)}X${'😀'.repeat(20)}`;
  const [item] = buildReplacementPreview(text, matchesOf(text, 'X'), 'Y', false, { context: 5 });
  assert.ok(item);
  assert.ok(!/^[\uDC00-\uDFFF]/.test(item.before), 'before starts with a whole emoji');
  assert.ok(!/[\uD800-\uDBFF]$/.test(item.after), 'after ends with a whole emoji');
  assert.equal(Array.from(item.before).every((char) => char === '😀'), true);
});

test('line breaks inside a change are shown as a symbol', () => {
  const text = 'one\ntwo';
  const [item] = buildReplacementPreview(text, matchesOf(text, 'one\\ntwo', { regex: true }), '1\n2', false);
  assert.ok(item);
  assert.equal(item.removed, 'one↵two');
  assert.equal(item.inserted, '1↵2');
  assert.equal(item.line, 1);
});

test('limit and zero-length matches', () => {
  const text = 'a\nb\nc\nd';
  const matches = matchesOf(text, '^', { regex: true });
  assert.equal(matches.length, 4);
  const items = buildReplacementPreview(text, matches, '- ', false, { limit: 2 });
  assert.equal(items.length, 2);
  assert.deepEqual(
    items.map((item) => [item.line, item.before, item.removed, item.inserted, item.after]),
    [
      [1, '', '', '- ', 'a'],
      [2, '', '', '- ', 'b'],
    ],
  );
  // A match at the very start of the text.
  const [first] = buildReplacementPreview('\nx', matchesOf('\nx', '\n'), '', false);
  assert.equal(first!.line, 1);
  assert.equal(first!.before, '');
});

test('very long removed text is shortened', () => {
  const text = 'x'.repeat(500);
  const [item] = buildReplacementPreview(text, matchesOf(text, 'x+', { regex: true }), '', true, { maxPart: 20 });
  assert.equal(item!.removed, `${'x'.repeat(20)}…`);
  assert.equal(item!.inserted, '');
});
