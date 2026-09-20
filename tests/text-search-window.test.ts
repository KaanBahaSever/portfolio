import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceIndex,
  compileSearch,
  expandReplacement,
  findAllMatches,
  findMatchWindow,
  findMatches,
  firstMatchAtOrAfter,
  offsetAfterReplacement,
  replaceAllInText,
} from '../src/lib/text/search.ts';
import type { MatchWindow, SearchOptions } from '../src/lib/text/search.ts';

function compile(query: string, overrides: Partial<SearchOptions> = {}): RegExp {
  const compiled = compileSearch({
    query,
    matchCase: false,
    wholeWord: false,
    regex: true,
    multiline: true,
    dotAll: false,
    ...overrides,
  });
  assert.equal(compiled.status, 'ok', `expected "${query}" to compile`);
  return (compiled as { regex: RegExp }).regex;
}

function texts(text: string, regex: RegExp): string[] {
  return findAllMatches(text, regex).map((match) => match.text);
}

function starts(window: MatchWindow | { matches: { start: number }[] }): number[] {
  return window.matches.map((match) => match.start);
}

/** "a0 a1 … a9": matches of a\d start at 0, 3, 6, … 27. */
const TEN = Array.from({ length: 10 }, (_, index) => `a${index}`).join(' ');

test('findMatches from an offset keeps the context before it', () => {
  const regex = compile('a\\d');
  const later = findMatches(TEN, regex, 3, 7);
  assert.deepEqual(starts(later), [9, 12, 15]);
  assert.equal(later.truncated, true);
  assert.deepEqual([starts(findMatches(TEN, regex, 3, 21)), findMatches(TEN, regex, 3, 21).truncated], [[21, 24, 27], false]);
  assert.equal(findMatches(TEN, regex, 3, 1000).matches.length, 0);
  assert.deepEqual(starts(findMatches(TEN, regex, 1, Number.NaN)), [0]);
  assert.deepEqual(starts(findMatches(TEN, regex, 1, -5)), [0]);

  // \b, lookbehind and ^ see the text before the offset (a sliced text would match at the offset).
  assert.deepEqual(starts(findMatches('ab b', compile('\\bb'), 10, 1)), [3]);
  assert.deepEqual(starts(findMatches('xa ya', compile('(?<=x)a'), 10, 1)), [1]);
  assert.deepEqual(starts(findMatches('ba\na', compile('^a'), 10, 1)), [3]);

  // An offset inside a surrogate pair moves past it.
  assert.deepEqual(starts(findMatches('😀x', compile('x*'), 10, 1)), [2, 3]);
  assert.equal(advanceIndex('😀x', 0), 2);
  assert.equal(advanceIndex('😀x', 2), 3);
});

test('findMatchWindow around an offset', () => {
  const regex = compile('a\\d');
  const around = (offset: number, hint?: number) => findMatchWindow(TEN, regex, { kind: 'around', offset, hint }, 3);

  assert.deepEqual([starts(around(0)), around(0).start, around(0).truncated], [[0, 3, 6], 0, true]);
  assert.deepEqual([starts(around(5)), around(5).start], [[0, 3, 6], 0]);
  assert.deepEqual([starts(around(10)), around(10).start, around(10).truncated], [[12, 15, 18], 10, true]);
  // A hint that still reaches the offset keeps the list where it was.
  assert.deepEqual([starts(around(10, 7)), around(10, 7).start], [[9, 12, 15], 7]);
  assert.deepEqual([starts(around(20, 7)), around(20, 7).start, around(20, 7).truncated], [[21, 24, 27], 20, false]);
  // A hint after the offset is ignored.
  assert.deepEqual([starts(around(10, 15)), around(10, 15).start], [[12, 15, 18], 10]);
  // Nothing starts at or after the offset: wrap around to the first matches.
  assert.deepEqual([starts(around(28)), around(28).start], [[0, 3, 6], 0]);
  assert.deepEqual([starts(around(28, 25)), around(28, 25).start], [[0, 3, 6], 0]);
  // Within the limit every match is listed from the start.
  const all = findMatchWindow(TEN, regex, { kind: 'around', offset: 20 });
  assert.deepEqual([starts(all), all.start, all.truncated], [starts(findMatches(TEN, regex)), 0, false]);
  assert.deepEqual(findMatchWindow('', regex, { kind: 'around', offset: 0 }), { matches: [], start: 0, truncated: false });
});

test('findMatchWindow after and before an offset', () => {
  const regex = compile('a\\d');
  const after = (offset: number) => findMatchWindow(TEN, regex, { kind: 'after', offset }, 3);
  assert.deepEqual([starts(after(8)), after(8).start, after(8).truncated], [[9, 12, 15], 8, true]);
  assert.deepEqual([starts(after(0)), after(0).start], [[0, 3, 6], 0]);
  // Nothing after: wrap around to the first matches.
  assert.deepEqual([starts(after(28)), after(28).start], [[0, 3, 6], 0]);

  const before = (offset: number) => findMatchWindow(TEN, regex, { kind: 'before', offset }, 3);
  assert.deepEqual([starts(before(10)), before(10).start, before(10).truncated], [[3, 6, 9], 3, true]);
  assert.deepEqual([starts(before(3)), before(3).start, before(3).truncated], [[0], 0, true]);
  // Nothing before: wrap around to the last matches.
  assert.deepEqual([starts(before(0)), before(0).start, before(0).truncated], [[21, 24, 27], 21, false]);
  assert.deepEqual([starts(before(Infinity)), before(Infinity).truncated], [[21, 24, 27], false]);
  const few = findMatchWindow('a1 a2', regex, { kind: 'before', offset: Infinity }, 3);
  assert.deepEqual([starts(few), few.start, few.truncated], [[0, 3], 0, false]);
  assert.deepEqual(findMatchWindow('b', regex, { kind: 'before', offset: 1 }, 3), { matches: [], start: 0, truncated: false });
});

test('findMatchWindow looks further back until it finds earlier matches', () => {
  const text = `${'x'.repeat(200_000)}a0 a1${'y'.repeat(300_000)}a2`;
  const regex = compile('a\\d');
  const all = findMatchWindow(text, regex, { kind: 'before', offset: text.length }, 3);
  assert.deepEqual([starts(all), all.start, all.truncated], [[200_000, 200_003, 500_005], 0, false]);
  const lastTwo = findMatchWindow(text, regex, { kind: 'before', offset: Infinity }, 2);
  assert.deepEqual([starts(lastTwo), lastTwo.start], [[200_003, 500_005], 200_003]);
  const beforeLast = findMatchWindow(text, regex, { kind: 'before', offset: 500_005 }, 3);
  assert.deepEqual([starts(beforeLast), beforeLast.start, beforeLast.truncated], [[200_000, 200_003], 0, true]);
});

test('windows continued after their last match add up to the complete list', () => {
  const text = 'ab 😀 a\n\nbb x a😀b\n';
  for (const pattern of ['a|b', 'x*', '^', '$', '\\b', '(?<=a)b?', '(?:)']) {
    const regex = compile(pattern);
    const expected = findAllMatches(text, regex).map((match) => [match.start, match.end]);
    const collected: number[][] = [];
    let window = findMatchWindow(text, regex, { kind: 'around', offset: 0 }, 2);
    for (let guard = 0; guard < 100; guard++) {
      collected.push(...window.matches.map((match) => [match.start, match.end]));
      if (!window.truncated) break;
      const last = window.matches[window.matches.length - 1]!;
      const offset = last.end > last.start ? last.end : advanceIndex(text, last.end);
      window = findMatchWindow(text, regex, { kind: 'after', offset }, 2);
    }
    assert.deepEqual(collected, expected, pattern);
  }
});

/** Presses Replace `times` times the way the notepad does: the match at or after the anchor, then move on. */
function replaceRepeatedly(text: string, pattern: string, template: string, times: number): string {
  const regex = compile(pattern);
  let anchor = 0;
  for (let i = 0; i < times; i++) {
    const { matches } = findMatches(text, regex);
    if (matches.length === 0) break;
    const index = firstMatchAtOrAfter(matches, anchor);
    const match = matches[index === -1 ? 0 : index]!;
    const replacement = expandReplacement(template, match, text, true);
    text = text.slice(0, match.start) + replacement + text.slice(match.end);
    anchor = offsetAfterReplacement(match, replacement.length);
  }
  return text;
}

test('replacing one match at a time moves past empty matches', () => {
  assert.equal(replaceRepeatedly('a\nb\nc', '$', ';', 3), 'a;\nb;\nc;');
  assert.equal(replaceRepeatedly('1234567', '(?=(?:\\d{3})+$)', ',', 2), '1,234,567');
  assert.equal(replaceRepeatedly('one two', '\\b', '|', 4), '|one| |two|');
  assert.equal(replaceRepeatedly('aXbXc', '(?=X)', '-', 2), 'a-Xb-Xc');
  assert.equal(replaceRepeatedly('a\nb', '^', '> ', 2), '> a\n> b');
  assert.equal(replaceRepeatedly('a\n\nb', '^', '> ', 3), '> a\n> \n> b');
  assert.equal(replaceRepeatedly('aa', '(?=a)', '', 2), 'aa');
  // Non-empty matches continue right after the inserted text.
  assert.equal(replaceRepeatedly('aaa', 'a', 'aa', 3), 'aaaaaa');
  assert.equal(replaceRepeatedly('a b', '\\w', '', 2), ' ');
  // Replacing every match one by one gives the same text as Replace all.
  const text = 'x = 1;\ny = 22;\n';
  assert.equal(replaceRepeatedly(text, '$', ' //', 3), replaceAllInText(text, compile('$'), ' //', true).text);
  assert.equal(offsetAfterReplacement({ start: 4, end: 4, text: '', groups: [] }, 2), 7);
  assert.equal(offsetAfterReplacement({ start: 4, end: 6, text: 'ab', groups: [] }, 2), 6);
});

test('regular expression examples on the tips page', () => {
  const text = 'Title  \n\nFirst paragraph.   \n \t \nSecond line\n\n\nLast paragraph.\n';
  // Trailing spaces and tabs go; blank lines and the final line break stay.
  assert.equal(
    replaceAllInText(text, compile('[ \\t]+$'), '', true).text,
    'Title\n\nFirst paragraph.\n\nSecond line\n\n\nLast paragraph.\n',
  );
  const blank = compile('^[ \\t]+$');
  assert.deepEqual(texts(text, blank), [' \t ']);
  assert.deepEqual(texts('a\n   \n\n\t\nb', blank), ['   ', '\t']);
  assert.deepEqual(texts('abc 123 x9', compile('\\d+')), ['123', '9']);
  assert.deepEqual(texts('color colour colr', compile('colou?r')), ['color', 'colour']);
  assert.deepEqual(texts('Çağrı İstanbul ankara', compile('\\p{Lu}\\p{Ll}+', { matchCase: true })), ['Çağrı', 'İstanbul']);
  assert.equal(replaceAllInText('a\nb', compile('^'), '> ', true).text, '> a\n> b');
});
