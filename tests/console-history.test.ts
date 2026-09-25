import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  HISTORY_LIMIT,
  MAX_REMEMBERED_LENGTH,
  addToHistory,
  freshRecall,
  parseStoredHistory,
  recall,
} from '../src/lib/console/history.ts';
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_PHOSPHOR,
  FONT_SIZES,
  parseFontSize,
  parsePhosphor,
  stepFontSize,
} from '../src/lib/console/prefs.ts';

test('addToHistory trims, skips blanks and immediate repeats, and keeps the newest entries', () => {
  assert.deepEqual(addToHistory([], '  ls  '), ['ls']);
  assert.deepEqual(addToHistory(['ls'], '   '), ['ls']);
  assert.deepEqual(addToHistory(['ls'], 'ls'), ['ls']);
  assert.deepEqual(addToHistory(['ls', 'pwd'], 'ls'), ['ls', 'pwd', 'ls']);
  assert.deepEqual(addToHistory(['a', 'b', 'c'], 'd', 3), ['b', 'c', 'd']);
  assert.deepEqual(addToHistory([], 'x'.repeat(MAX_REMEMBERED_LENGTH + 1)), []);
  const input = ['a'];
  addToHistory(input, 'b');
  assert.deepEqual(input, ['a'], 'the input array is not modified');
});

test('parseStoredHistory accepts only an array of non-empty strings', () => {
  assert.deepEqual(parseStoredHistory(null), []);
  assert.deepEqual(parseStoredHistory('not json'), []);
  assert.deepEqual(parseStoredHistory('{"a":1}'), []);
  assert.deepEqual(parseStoredHistory('["ls", 3, "", null, "pwd"]'), ['ls', 'pwd']);
  const many = JSON.stringify(Array.from({ length: HISTORY_LIMIT + 10 }, (_, i) => `echo ${i}`));
  const parsed = parseStoredHistory(many);
  assert.equal(parsed.length, HISTORY_LIMIT);
  assert.equal(parsed.at(-1), `echo ${HISTORY_LIMIT + 9}`);
});

test('recall walks back through history and returns to the unsent draft', () => {
  const entries = ['help', 'ls', 'cat about.txt'];
  let state = freshRecall(entries);

  let step = recall(entries, state, 'older', 'draft');
  assert.deepEqual(step?.value, 'cat about.txt');
  state = step!.state;
  step = recall(entries, state, 'older', 'cat about.txt');
  assert.equal(step?.value, 'ls');
  state = step!.state;
  step = recall(entries, state, 'older', 'ls');
  assert.equal(step?.value, 'help');
  state = step!.state;
  assert.equal(recall(entries, state, 'older', 'help'), null, 'nothing older than the first entry');

  step = recall(entries, state, 'newer', 'help');
  assert.equal(step?.value, 'ls');
  state = step!.state;
  step = recall(entries, state, 'newer', 'ls');
  assert.equal(step?.value, 'cat about.txt');
  state = step!.state;
  step = recall(entries, state, 'newer', 'cat about.txt');
  assert.equal(step?.value, 'draft', 'back on the line being typed');
  state = step!.state;
  assert.equal(recall(entries, state, 'newer', 'draft'), null);
});

test('recall with an empty history does nothing', () => {
  assert.equal(recall([], freshRecall([]), 'older', 'x'), null);
  assert.equal(recall([], freshRecall([]), 'newer', 'x'), null);
});

test('font sizes: stored values are validated, steps clamp at both ends', () => {
  assert.equal(parseFontSize(null), DEFAULT_FONT_SIZE);
  assert.equal(parseFontSize('18'), 18);
  assert.equal(parseFontSize('17'), DEFAULT_FONT_SIZE);
  assert.equal(parseFontSize('abc'), DEFAULT_FONT_SIZE);
  assert.equal(stepFontSize(15, 1), 16);
  assert.equal(stepFontSize(16, 1), 18);
  assert.equal(stepFontSize(15, -1), 14);
  assert.equal(stepFontSize(FONT_SIZES[0], -1), FONT_SIZES[0]);
  assert.equal(stepFontSize(FONT_SIZES.at(-1)!, 1), FONT_SIZES.at(-1));
  // A size that is not a step snaps to the nearest one.
  assert.equal(stepFontSize(17.2, 1), 18);
  assert.ok((FONT_SIZES as readonly number[]).includes(DEFAULT_FONT_SIZE));
});

test('phosphor colours: only known values are accepted', () => {
  assert.equal(parsePhosphor('amber'), 'amber');
  assert.equal(parsePhosphor('green'), 'green');
  assert.equal(parsePhosphor('red'), DEFAULT_PHOSPHOR);
  assert.equal(parsePhosphor(null), DEFAULT_PHOSPHOR);
});
