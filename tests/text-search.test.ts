import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compileSearch,
  escapeRegExp,
  expandReplacement,
  findAllMatches,
  findMatches,
  firstMatchAtOrAfter,
  lastMatchBefore,
  replaceAllInText,
  replaceAllMatches,
  replaceMatch,
} from '../src/lib/text/search.ts';
import type { SearchOptions } from '../src/lib/text/search.ts';

function options(query: string, overrides: Partial<SearchOptions> = {}): SearchOptions {
  return { query, matchCase: false, wholeWord: false, regex: false, multiline: true, dotAll: false, ...overrides };
}

function compile(query: string, overrides: Partial<SearchOptions> = {}): RegExp {
  const compiled = compileSearch(options(query, overrides));
  assert.equal(compiled.status, 'ok', `expected "${query}" to compile`);
  return (compiled as { regex: RegExp }).regex;
}

function texts(text: string, regex: RegExp): string[] {
  return findAllMatches(text, regex).map((match) => match.text);
}

test('compileSearch: empty query', () => {
  assert.deepEqual(compileSearch(options('')), { status: 'empty' });
  assert.deepEqual(compileSearch(options('', { regex: true })), { status: 'empty' });
});

test('compileSearch: flags', () => {
  assert.equal(compile('a').flags, 'giu');
  assert.equal(compile('a', { matchCase: true }).flags, 'gu');
  // m and s only apply in regex mode.
  assert.equal(compile('a', { matchCase: true, multiline: true, dotAll: true }).flags, 'gu');
  assert.equal(compile('a', { matchCase: true, regex: true, multiline: true, dotAll: true }).flags, 'gmsu');
  assert.equal(compile('a', { matchCase: true, regex: true, multiline: false, dotAll: false }).flags, 'gu');
});

test('literal mode escapes every regex metacharacter', () => {
  const metacharacters = ['\\', '^', '$', '.', '*', '+', '?', '(', ')', '[', ']', '{', '}', '|', '/', '-'];
  for (const character of metacharacters) {
    const text = `a${character}b ${character}${character}`;
    const regex = compile(character, { matchCase: true });
    assert.deepEqual(texts(text, regex), [character, character, character], `metacharacter ${character}`);
  }
  const tricky = '(a+)?[b-c]{2,}^$\\d.*|x/';
  assert.deepEqual(texts(`start ${tricky} end`, compile(tricky)), [tricky]);
  assert.equal(new RegExp(escapeRegExp(tricky), 'u').test(tricky), true);
});

test('match case', () => {
  const text = 'Kaan kaan KAAN';
  assert.deepEqual(texts(text, compile('kaan')), ['Kaan', 'kaan', 'KAAN']);
  assert.deepEqual(texts(text, compile('kaan', { matchCase: true })), ['kaan']);
  assert.deepEqual(texts('Çiçek ÇİÇEK çiçek', compile('çiçek')), ['Çiçek', 'çiçek']);
});

test('whole word works with Turkish letters', () => {
  const text = 'göz gözlük gözü ögöz göz_ göz-ağrısı göz.';
  assert.deepEqual(
    findAllMatches(text, compile('göz', { wholeWord: true })).map((match) => match.start),
    [0, text.indexOf('göz-'), text.lastIndexOf('göz.')],
  );
  // "ı" and "ş" are letters: "kış" must not match inside "kışlık".
  assert.deepEqual(texts('kış kışlık akış', compile('kış', { wholeWord: true })), ['kış']);
  assert.deepEqual(texts('İstanbul İstanbullu', compile('İstanbul', { wholeWord: true, matchCase: true })), ['İstanbul']);
  // Combining marks belong to the word.
  assert.deepEqual(texts('cafe\u0301 cafe', compile('cafe', { wholeWord: true })), ['cafe']);
});

test('whole word with punctuation and digits', () => {
  const text = 'cat, (cat) cat. cats bobcat cat_1 cat2 "cat"';
  assert.equal(findAllMatches(text, compile('cat', { wholeWord: true })).length, 4);
  assert.deepEqual(texts('a+b a+bc xa+b', compile('a+b', { wholeWord: true })), ['a+b']);
  // Whole word also wraps regex alternatives as one unit.
  assert.deepEqual(texts('cat dog cats dogs', compile('cat|dog', { regex: true, wholeWord: true })), ['cat', 'dog']);
});

test('regex flags m and s', () => {
  const text = 'one\ntwo\nthree';
  assert.deepEqual(texts(text, compile('^t\\w+$', { regex: true, multiline: true })), ['two', 'three']);
  assert.deepEqual(texts(text, compile('^t\\w+$', { regex: true, multiline: false })), []);
  assert.deepEqual(texts(text, compile('one.two', { regex: true, dotAll: true })), ['one\ntwo']);
  assert.deepEqual(texts(text, compile('one.two', { regex: true, dotAll: false })), []);
});

test('invalid regex returns the engine error', () => {
  for (const pattern of ['(', 'a)(b', '[a-', '\\', '*a', 'a{2,1}', '\\-', '(?<n>a)(?<n>b)']) {
    const compiled = compileSearch(options(pattern, { regex: true }));
    assert.equal(compiled.status, 'error', pattern);
    assert.ok((compiled as { message: string }).message.length > 0);
  }
  // Wrapping for whole word must not make an invalid pattern valid.
  assert.equal(compileSearch(options('a)(b', { regex: true, wholeWord: true })).status, 'error');
  // The same characters are fine in literal mode.
  assert.equal(compileSearch(options('a)(b')).status, 'ok');
});

test('zero-length patterns terminate and count correctly', () => {
  const lines = 'a\nb\n\nc';
  assert.equal(findAllMatches(lines, compile('^', { regex: true, multiline: true })).length, 4);
  assert.deepEqual(
    findAllMatches(lines, compile('^', { regex: true, multiline: true })).map((match) => match.start),
    [0, 2, 4, 5],
  );
  assert.equal(findAllMatches(lines, compile('$', { regex: true, multiline: true })).length, 4);
  assert.equal(findAllMatches('', compile('^', { regex: true })).length, 1);

  // (?=a) matches before each "a".
  assert.deepEqual(
    findAllMatches('banana', compile('(?=a)', { regex: true })).map((match) => match.start),
    [1, 3, 5],
  );

  // x* matches at every position, like String.prototype.match.
  const text = 'axxb';
  const matches = findAllMatches(text, compile('x*', { regex: true }));
  assert.deepEqual(
    matches.map((match) => [match.start, match.text]),
    [
      [0, ''],
      [1, 'xx'],
      [3, ''],
      [4, ''],
    ],
  );
  assert.equal(matches.length, text.match(/x*/gu)!.length);
});

test('zero-length matches advance by whole code points (emoji)', () => {
  const text = 'a😀b👨‍👩‍👧';
  assert.equal(compileSearch(options('', { regex: true })).status, 'empty');
  const empty = compile('(?:)', { regex: true });
  const matches = findAllMatches(text, empty);
  assert.equal(matches.length, Array.from(text).length + 1);
  assert.equal(matches.length, text.match(/(?:)/gu)!.length);
  for (const match of matches) {
    const before = text.charCodeAt(match.start - 1);
    assert.ok(!(before >= 0xd800 && before <= 0xdbff), `no match inside a surrogate pair (${match.start})`);
  }
  assert.deepEqual(
    findAllMatches('😀😀', compile('x*', { regex: true })).map((match) => match.start),
    [0, 2, 4],
  );
});

test('lookbehind, groups and named groups are reported', () => {
  const [match] = findAllMatches('date: 2026-09-16', compile('(?<year>\\d{4})-(\\d{2})-(\\d{2})(x)?', { regex: true }));
  assert.ok(match);
  assert.equal(match.start, 6);
  assert.equal(match.end, 16);
  assert.deepEqual(match.groups, ['2026', '09', '16', undefined]);
  assert.deepEqual(match.namedGroups, { year: '2026' });
  const [plain] = findAllMatches('abc', compile('b', { regex: true }));
  assert.equal(plain!.namedGroups, undefined);
  assert.deepEqual(plain!.groups, []);
});

test('findMatches stops at the limit', () => {
  const text = 'a'.repeat(25);
  const regex = compile('a');
  assert.deepEqual(
    { count: findMatches(text, regex, 10).matches.length, truncated: findMatches(text, regex, 10).truncated },
    { count: 10, truncated: true },
  );
  assert.equal(findMatches(text, regex, 25).truncated, false);
  assert.equal(findMatches(text, regex, 25).matches.length, 25);
  assert.equal(findMatches(text, regex, 26).truncated, false);
  assert.equal(findMatches('a'.repeat(20_000), regex).matches.length, 10_000);
  assert.equal(findMatches('a'.repeat(20_000), regex).truncated, true);
  assert.equal(findAllMatches('a'.repeat(20_000), regex).length, 20_000);
  // Zero-length patterns are limited too.
  const zero = findMatches('x'.repeat(50_000), compile('y*', { regex: true }));
  assert.equal(zero.matches.length, 10_000);
  assert.equal(zero.truncated, true);
});

test('findMatches leaves the caller regex untouched', () => {
  const regex = compile('a');
  regex.lastIndex = 3;
  assert.equal(findAllMatches('aaaa', regex).length, 4);
  assert.equal(regex.lastIndex, 3);
  // A regex without the g flag still finds every match.
  assert.equal(findAllMatches('aaaa', /a/u).length, 4);
  assert.equal(findAllMatches('aaaa', /a/uy).length, 4);
});

interface ReplaceCase {
  pattern: string;
  flags?: string;
  input: string;
  template: string;
}

const REPLACE_CASES: ReplaceCase[] = [
  { pattern: 'b', input: 'abcabc', template: 'X' },
  { pattern: 'b', input: 'abcabc', template: '' },
  { pattern: 'b', input: 'abcabc', template: '$$' },
  { pattern: 'b', input: 'abcabc', template: '$$$$' },
  { pattern: 'b', input: 'abcabc', template: '[$&]' },
  { pattern: 'b', input: 'abcabc', template: '[$`]' },
  { pattern: 'b', input: 'abcabc', template: "[$']" },
  { pattern: 'b', input: 'abcabc', template: '$' },
  { pattern: 'b', input: 'abcabc', template: 'x$' },
  { pattern: 'b', input: 'abcabc', template: '$x' },
  { pattern: 'b', input: 'abcabc', template: '$0' },
  { pattern: 'b', input: 'abcabc', template: '$00' },
  { pattern: 'b', input: 'abcabc', template: '$1' },
  { pattern: 'b', input: 'abcabc', template: '$01' },
  { pattern: 'b', input: 'abcabc', template: '$10' },
  { pattern: '(b)', input: 'abcabc', template: '$1$1' },
  { pattern: '(b)', input: 'abcabc', template: '$10' },
  { pattern: '(b)', input: 'abcabc', template: '$01' },
  { pattern: '(b)', input: 'abcabc', template: '$001' },
  { pattern: '(b)', input: 'abcabc', template: '$2' },
  { pattern: '(b)', input: 'abcabc', template: '$11' },
  { pattern: '(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)(k)', input: 'abcdefghijk!', template: '$10|$11|$1|$12|$011|$99' },
  { pattern: '(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)', input: 'abcdefghij', template: '$10$11$9' },
  { pattern: '(\\w+)\\s(\\w+)', input: 'John Smith, Jane Doe', template: '$2, $1' },
  { pattern: '(x)?b', input: 'abc', template: '[$1]' },
  { pattern: '(x)|(b)', input: 'abcxb', template: '<$1|$2>' },
  { pattern: '(?<first>\\w)(?<rest>\\w*)', input: 'hello world', template: '$<rest>$<first>ay' },
  { pattern: '(?<first>\\w)', input: 'ab', template: '$<missing>|$<first' },
  { pattern: '(?<first>\\w)', input: 'ab', template: '$<>|$<toString>|$<__proto__>' },
  { pattern: '(\\w)', input: 'ab', template: '$<first>' },
  { pattern: '(?<x>a)|(?<y>b)', input: 'ab', template: '[$<x>,$<y>]' },
  { pattern: '^', flags: 'gmu', input: 'one\ntwo\n\nthree', template: '> ' },
  { pattern: '$', flags: 'gmu', input: 'one\ntwo', template: ';' },
  { pattern: 'x*', input: 'axxb', template: '-' },
  { pattern: 'x*', input: 'a😀b', template: '[$&]' },
  { pattern: '(?=a)', input: 'banana', template: '|' },
  { pattern: '(?<=a)', input: 'banana', template: '$`' },
  { pattern: '', input: 'ab', template: "<$'>" },
  { pattern: '\\s+', input: 'a  b\t\tc\n', template: ' ' },
  { pattern: 'ı', flags: 'giu', input: 'IıİiI', template: '($&)' },
  { pattern: '(😀)(.)', input: 'x😀y😀z', template: '$2$1' },
  { pattern: '.', flags: 'gsu', input: 'a\nb', template: '<$&>' },
];

test('replaceAllMatches and replaceAllInText match String.prototype.replace', () => {
  assert.ok(REPLACE_CASES.length >= 30);
  for (const { pattern, flags = 'gu', input, template } of REPLACE_CASES) {
    const regex = new RegExp(pattern, flags);
    const expected = input.replace(regex, template);
    const matches = findAllMatches(input, regex);
    const label = `/${pattern}/${flags} ${JSON.stringify(input)} ${JSON.stringify(template)}`;
    assert.equal(replaceAllMatches(input, matches, template, true).text, expected, label);
    assert.equal(replaceAllMatches(input, matches, template, true).count, matches.length, label);
    assert.equal(replaceAllInText(input, regex, template, true).text, expected, label);
    assert.equal(replaceAllInText(input, regex, template, true).count, matches.length, label);
  }
});

test('expandReplacement matches native replacement for a single match', () => {
  for (const { pattern, flags = 'gu', input, template } of REPLACE_CASES) {
    const single = new RegExp(pattern, flags.replace('g', ''));
    const [first] = findAllMatches(input, single);
    if (!first) continue;
    const expected = input.replace(single, template);
    const result = replaceMatch(input, first, template, true);
    assert.equal(result.text, expected, `/${pattern}/ ${JSON.stringify(template)}`);
    const replacement = expandReplacement(template, first, input, true);
    assert.equal(result.replacementEnd, first.start + replacement.length);
  }
});

test('literal mode inserts the template as typed', () => {
  const regex = compile('b');
  const matches = findAllMatches('abcabc', regex);
  assert.equal(replaceAllMatches('abcabc', matches, '$&$1$$', false).text, 'a$&$1$$ca$&$1$$c');
  assert.equal(expandReplacement("$`$'", matches[0]!, 'abcabc', false), "$`$'");
  assert.equal(replaceAllInText('a.b.c', compile('.'), '$&!', false).text, 'a$&!b$&!c');
});

test('replaceAllInText without matches returns the same text', () => {
  const text = 'nothing here';
  const result = replaceAllInText(text, compile('zzz'), 'x', false);
  assert.equal(result.count, 0);
  assert.equal(result.text, text);
});

test('replaceMatch reports where the replacement ends', () => {
  const text = 'one two three';
  const [, second] = findAllMatches(text, compile('\\w+', { regex: true }));
  const result = replaceMatch(text, second!, '[$&]', true);
  assert.equal(result.text, 'one [two] three');
  assert.equal(result.replacementEnd, 9);
  assert.equal(result.text.slice(0, result.replacementEnd), 'one [two]');
});

test('firstMatchAtOrAfter and lastMatchBefore', () => {
  const matches = findAllMatches('a..a..a', compile('a'));
  assert.deepEqual(
    matches.map((match) => match.start),
    [0, 3, 6],
  );
  assert.equal(firstMatchAtOrAfter(matches, 0), 0);
  assert.equal(firstMatchAtOrAfter(matches, 1), 1);
  assert.equal(firstMatchAtOrAfter(matches, 3), 1);
  assert.equal(firstMatchAtOrAfter(matches, 7), -1);
  assert.equal(lastMatchBefore(matches, 0), -1);
  assert.equal(lastMatchBefore(matches, 1), 0);
  assert.equal(lastMatchBefore(matches, 3), 0);
  assert.equal(lastMatchBefore(matches, 4), 1);
  assert.equal(lastMatchBefore(matches, 100), 2);
  assert.equal(firstMatchAtOrAfter([], 0), -1);
  assert.equal(lastMatchBefore([], 5), -1);
});
