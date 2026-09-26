import { test } from 'node:test';
import assert from 'node:assert/strict';
import { binaryTextMessages, type Utf8Detail } from '../src/i18n/tools/binary-text.ts';

type Tree = { [key: string]: unknown };
type Message = (...args: unknown[]) => string;

/** Every leaf as [path, value]. */
function leaves(tree: Tree, prefix = ''): Array<[string, unknown]> {
  return Object.entries(tree).flatMap(([key, value]) =>
    value && typeof value === 'object'
      ? leaves(value as Tree, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value] as [string, unknown]],
  );
}

const detail: Utf8Detail = { hex: '«HEX»', expected: 3, at: 4, present: 2 };

/**
 * Sample arguments per message, typed as the catalogue expects: numbers where it formats and
 * picks plurals, marked strings («…») where it interpolates ready-made text.
 */
const SAMPLE_ARGS: Record<string, unknown[]> = {
  'counts.characters': [13],
  'counts.bytes': [14],
  'counts.bits': [112],
  'problems.where': [2, 17],
  'problems.invalidCharacter': ['«WHERE»', '«CHAR»', '«CP»'],
  'problems.groupLength': ['«WHERE»', 3, 7],
  'problems.emptyPrefix': ['«WHERE»', 3],
  'problems.nonAsciiText': ['«WHERE»', '«CHAR»', '«CP»', 3],
  'problems.nonAsciiByte': ['«WHERE»', 2, 195, '«BITS»', 2],
  'problems.invalidUtf8': ['«WHERE»', 5, '«DETAIL»'],
  'problems.loneSurrogate': ['«WHERE»', '«CP»'],
  'problems.tooLong': [16384],
  'pending.bits': [5],
  'pending.bytes': [1, 2],
  'announce.example': ['«VALUE»', 13],
  'breakdown.summary': [13, 14],
  'breakdown.capped': [256, 1024],
};

function sample(key: string, value: unknown): string {
  if (typeof value !== 'function') return String(value);
  if (key.startsWith('problems.utf8.')) return (value as Message)(detail);
  const args = SAMPLE_ARGS[key];
  assert.ok(args, `no sample arguments for ${key}`);
  return (value as Message)(...args);
}

/** Leaves that are the same in both languages on purpose: notation and names. */
const SAME_IN_BOTH = new Set([
  'examples.emoji',
  'text.format',
  'binary.placeholder',
  'breakdown.columns.index',
]);

const en = new Map(leaves(binaryTextMessages.en));
const tr = new Map(leaves(binaryTextMessages.tr));

test('Turkish defines exactly the English keys, with the same kinds of value', () => {
  assert.deepEqual([...tr.keys()].sort(), [...en.keys()].sort());
  for (const [key, value] of en) assert.equal(typeof tr.get(key), typeof value, key);
});

test('every message renders, is non-empty and is translated', () => {
  for (const [key, value] of tr) {
    const text = sample(key, value);
    assert.ok(text.trim().length > 0, key);
    if (!SAME_IN_BOTH.has(key)) assert.notEqual(text, sample(key, en.get(key)), `${key} is still English`);
  }
});

test('interpolated values stand alone in Turkish (no case suffix glued to a value)', () => {
  for (const [key, value] of tr) {
    if (typeof value !== 'function') continue;
    const text = sample(key, value);
    assert.doesNotMatch(text, /»['’]/u, key);
    // Numbers formatted by the catalogue: "3'ten", "14’ü" and the like.
    assert.doesNotMatch(text.replace(/\d+’(de|den|in|e)\b/gu, ''), /\d['’]\p{L}/u, key);
  }
});

test('Turkish numbers use Turkish formatting and singular nouns', () => {
  const m = binaryTextMessages.tr;
  assert.equal(m.counts.bytes(16384), '16.384 bayt');
  assert.equal(m.counts.characters(2), '2 karakter');
  assert.equal(binaryTextMessages.en.counts.bytes(1), '1 byte');
  assert.equal(binaryTextMessages.en.counts.bytes(16384), '16,384 bytes');
  assert.equal(m.problems.where(1, 1234), 'Satır 1, sütun 1.234');
});

test('ordinals in problems are formatted for the page language', () => {
  const { en: e, tr: t } = binaryTextMessages;
  const detail: Utf8Detail = { hex: '0xC3', expected: 2, at: 1502, present: 1 };
  assert.match(e.problems.groupLength('W', 1501, 4), /group 1,501 has 4 bits/u);
  assert.match(e.problems.emptyPrefix('W', 1501), /group 1,501 is a 0b prefix/u);
  assert.match(e.problems.nonAsciiByte('W', 1501, 255, '11111111', 1), /byte 1,501 is 255/u);
  assert.match(e.problems.invalidUtf8('W', 1501, ''), /byte 1,501\./u);
  assert.match(e.problems.utf8['missing-continuation'](detail), /byte 1,502 does not/u);
  assert.match(t.problems.groupLength('W', 1501, 4), /1\.501\. grupta 4 bit/u);
  assert.match(t.problems.emptyPrefix('W', 1501), /1\.501\. grup yalnızca/u);
  assert.match(t.problems.nonAsciiByte('W', 1501, 255, '11111111', 1), /1\.501\. baytın değeri 255/u);
  assert.match(t.problems.invalidUtf8('W', 1501, ''), /1\.501\. baytta/u);
  assert.match(t.problems.utf8['missing-continuation'](detail), /1\.502\. bayt 10/u);
});

test('English prose avoids exclamation marks and banned words', () => {
  const banned = /\b(passionate|rockstar|ninja|cutting-edge|revolutionary|seamless(ly)?|leverage|unlock|empower|delve|game-changer)\b/iu;
  for (const [key, value] of en) {
    const text = sample(key, value);
    assert.doesNotMatch(text, /!/u, key);
    assert.doesNotMatch(text, banned, key);
  }
});
