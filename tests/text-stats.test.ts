import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeStats,
  convertLineEndings,
  countCharacters,
  countCharactersBounded,
  lineColumnAt,
  utf8ByteLength,
} from '../src/lib/text/stats.ts';

const encoder = new TextEncoder();

function graphemes(text: string): number {
  return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)).length;
}

/** Deterministic pseudo-random numbers (mulberry32). */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('empty text', () => {
  assert.deepEqual(computeStats(''), {
    characters: 0,
    charactersNoSpaces: 0,
    words: 0,
    sentences: 0,
    lines: 0,
    paragraphs: 0,
    bytes: 0,
    readingMinutes: 0,
  });
  assert.equal(computeStats('', { segmenter: false }).words, 0);
});

test('simple English text', () => {
  const stats = computeStats('Hello world. How are you?');
  assert.equal(stats.characters, 25);
  assert.equal(stats.charactersNoSpaces, 21);
  assert.equal(stats.words, 5);
  assert.equal(stats.sentences, 2);
  assert.equal(stats.lines, 1);
  assert.equal(stats.paragraphs, 1);
  assert.equal(stats.bytes, 25);
  assert.equal(stats.readingMinutes, 1);
});

test('an emoji ZWJ family is one character', () => {
  const family = '👨‍👩‍👧‍👦';
  const stats = computeStats(family);
  assert.equal(stats.characters, 1);
  assert.equal(stats.charactersNoSpaces, 1);
  assert.equal(stats.bytes, encoder.encode(family).length);
  assert.equal(computeStats(`a ${family} b`).characters, 5);
  assert.equal(computeStats('🇹🇷🇬🇧').characters, 2);
  assert.equal(countCharacters(family), 1);
});

test('combining marks belong to their base letter', () => {
  const text = 'e\u0301te\u0301'; // "été" written with combining acute accents
  assert.equal(text.length, 5);
  assert.equal(computeStats(text).characters, 3);
  assert.equal(computeStats(text).words, 1);
  assert.equal(countCharacters('a\u0308\u0304'), 1);
});

test('Turkish text', () => {
  const text = 'Iğdır’da ılık şişe çözümü. İstanbul güzel!';
  const stats = computeStats(text);
  assert.equal(stats.characters, Array.from(text).length);
  assert.equal(stats.characters, graphemes(text));
  assert.equal(stats.charactersNoSpaces, Array.from(text.replace(/\s/g, '')).length);
  assert.equal(stats.words, 6);
  assert.equal(stats.sentences, 2);
  assert.equal(stats.bytes, encoder.encode(text).length);
});

test('whitespace of every kind is excluded from charactersNoSpaces', () => {
  const text = 'a\u00a0b\u2003c\u3000d\te\u0085f\u2028g';
  const stats = computeStats(text);
  assert.equal(stats.characters, 13);
  assert.equal(stats.charactersNoSpaces, 7);
});

test('lines with LF, CRLF and CR', () => {
  assert.equal(computeStats('one').lines, 1);
  assert.equal(computeStats('one\n').lines, 2);
  assert.equal(computeStats('one\ntwo\nthree').lines, 3);
  assert.equal(computeStats('one\r\ntwo\r\nthree').lines, 3);
  assert.equal(computeStats('one\rtwo\r\nthree\nfour').lines, 4);
  assert.equal(computeStats('\n').lines, 2);
  assert.equal(computeStats('\r\n\r\n').lines, 3);
  // CR LF is a single character.
  assert.equal(computeStats('a\r\nb').characters, 3);
  assert.equal(computeStats('a\r\nb').charactersNoSpaces, 2);
  assert.equal(computeStats('é\r\nb').characters, graphemes('é\r\nb'));
});

test('bytes follow the chosen line ending', () => {
  const lf = 'one\ntwo\nthree';
  const crlf = 'one\r\ntwo\r\nthree';
  const mixed = 'one\rtwo\r\nthree\nfour';
  for (const text of [lf, crlf, mixed, '\n\n', 'ğ\r\n😀\r']) {
    assert.equal(computeStats(text, { lineEnding: 'lf' }).bytes, encoder.encode(convertLineEndings(text, 'lf')).length);
    assert.equal(
      computeStats(text, { lineEnding: 'crlf' }).bytes,
      encoder.encode(convertLineEndings(text, 'crlf')).length,
    );
  }
  assert.equal(computeStats(lf).bytes, 13);
  assert.equal(computeStats(lf, { lineEnding: 'crlf' }).bytes, 15);
  assert.equal(computeStats(crlf, { lineEnding: 'lf' }).bytes, 13);
});

test('convertLineEndings', () => {
  assert.equal(convertLineEndings('a\r\nb\rc\nd', 'lf'), 'a\nb\nc\nd');
  assert.equal(convertLineEndings('a\r\nb\rc\nd', 'crlf'), 'a\r\nb\r\nc\r\nd');
  assert.equal(convertLineEndings('a\n\nb', 'crlf'), 'a\r\n\r\nb');
  assert.equal(convertLineEndings('a\r\n\r\nb', 'crlf'), 'a\r\n\r\nb');
  assert.equal(convertLineEndings('\r\r\n\n', 'lf'), '\n\n\n');
  assert.equal(convertLineEndings('no breaks', 'crlf'), 'no breaks');
  assert.equal(convertLineEndings('', 'lf'), '');
});

test('paragraphs are separated by blank lines', () => {
  assert.equal(computeStats('one').paragraphs, 1);
  assert.equal(computeStats('one\ntwo').paragraphs, 1);
  assert.equal(computeStats('one\n\ntwo').paragraphs, 2);
  assert.equal(computeStats('one\n   \n\t\ntwo\nthree\n\n\nfour').paragraphs, 3);
  assert.equal(computeStats('\n\none\r\n\r\ntwo\n\n').paragraphs, 2);
  assert.equal(computeStats('   \n\n  ').paragraphs, 0);
  assert.equal(computeStats('  indented\n  still the same paragraph').paragraphs, 1);
});

test('sentences in simple cases', () => {
  assert.equal(computeStats('One. Two! Three?').sentences, 3);
  assert.equal(computeStats('No punctuation at all').sentences, 1);
  assert.equal(computeStats('First line\nSecond line').sentences, 2);
  assert.equal(computeStats('...  !!!').sentences, 0);
  assert.equal(computeStats('Bir. İki! Üç?').sentences, 3);
});

test('words and reading time', () => {
  assert.equal(computeStats("don't stop — it's 3.14 already").words, 5);
  assert.equal(computeStats('Çok güzel, değil mi?').words, 4);
  assert.equal(computeStats('... --- !!!').words, 0);
  assert.equal(computeStats('word '.repeat(200)).readingMinutes, 1);
  assert.equal(computeStats('word '.repeat(201)).readingMinutes, 2);
});

test('fallbacks without Intl.Segmenter give sensible counts', () => {
  const options = { segmenter: false };
  const text = 'Merhaba dünya. Nasılsın?\nİyiyim 😀!';
  const stats = computeStats(text, options);
  assert.equal(stats.words, 4);
  assert.equal(stats.words, computeStats(text).words);
  assert.equal(stats.sentences, 3);
  assert.equal(stats.characters, Array.from(text).length);
  assert.equal(computeStats('a\r\nb😀', options).characters, 4);
  assert.equal(computeStats('a\u00a0\u3000b😀', options).charactersNoSpaces, 3);
  assert.equal(computeStats('One. Two! Three?', options).sentences, 3);
  assert.equal(computeStats("don't stop", options).words, 2);
});

test('fast Latin character count agrees with Intl.Segmenter', () => {
  const next = random(7);
  const alphabet = ['a', 'Z', ' ', '\t', '\r', '\n', 'ç', 'ğ', 'ı', 'İ', 'ş', 'ü', 'Ö', '\u00a0', '\u0085', '©', 'ʼ', '.', '!'];
  for (let round = 0; round < 200; round++) {
    let text = '';
    const length = Math.floor(next() * 40);
    for (let i = 0; i < length; i++) text += alphabet[Math.floor(next() * alphabet.length)];
    assert.equal(computeStats(text).characters, graphemes(text), JSON.stringify(text));
    assert.equal(countCharacters(text), graphemes(text), JSON.stringify(text));
  }
});

test('countCharactersBounded skips segmentation only for long texts that need it', () => {
  const family = '👨‍👩‍👧';
  assert.deepEqual(countCharactersBounded(`a${family}b`, 100), { count: 3, exact: true });
  // Too long to segment: code points instead (the family is 5), marked inexact.
  assert.deepEqual(countCharactersBounded(`a${family}b`, 5), { count: 7, exact: false });
  assert.deepEqual(countCharactersBounded('é\r\n', 2), { count: 3, exact: false });
  // Text below U+0300 never needs segmentation, however long.
  assert.deepEqual(countCharactersBounded('ab\r\ncç'.repeat(1000), 10), { count: 5000, exact: true });
  assert.deepEqual(countCharactersBounded('', 0), { count: 0, exact: true });
  const cyrillic = 'Привет, мир!\r\n'.repeat(20_000);
  assert.deepEqual(countCharactersBounded(cyrillic, 100_000), { count: countCharacters(cyrillic), exact: false });
  assert.deepEqual(countCharactersBounded(cyrillic, Infinity), { count: countCharacters(cyrillic), exact: true });
});

test('utf8ByteLength equals TextEncoder output, including astral characters and lone surrogates', () => {
  const next = random(42);
  const pieces = ['a', 'é', 'ğ', '€', '中', '😀', '👨‍👩‍👧', '\ud800', '\udfff', '\u0000', '\u07ff', '\u0800', '\uffff', '\n', '\r\n'];
  for (let round = 0; round < 500; round++) {
    let text = '';
    const length = Math.floor(next() * 30);
    for (let i = 0; i < length; i++) {
      if (next() < 0.3) {
        text += String.fromCharCode(Math.floor(next() * 0x10000));
      } else {
        text += pieces[Math.floor(next() * pieces.length)];
      }
    }
    const expected = encoder.encode(text).length;
    assert.equal(utf8ByteLength(text), expected, JSON.stringify(text));
    assert.equal(computeStats(text).bytes, encoder.encode(convertLineEndings(text, 'lf')).length);
  }
  assert.equal(utf8ByteLength(''), 0);
  assert.equal(utf8ByteLength('\ud83d'), 3);
  assert.equal(utf8ByteLength('\ude00\ud83d'), 6);
  assert.equal(utf8ByteLength('😀'), 4);
});

test('lineColumnAt', () => {
  const text = 'ab\ncd\r\nef\rgh';
  assert.deepEqual(lineColumnAt(text, 0), { line: 1, column: 1 });
  assert.deepEqual(lineColumnAt(text, 2), { line: 1, column: 3 });
  assert.deepEqual(lineColumnAt(text, 3), { line: 2, column: 1 });
  assert.deepEqual(lineColumnAt(text, 5), { line: 2, column: 3 });
  assert.deepEqual(lineColumnAt(text, 7), { line: 3, column: 1 });
  assert.deepEqual(lineColumnAt(text, 10), { line: 4, column: 1 });
  assert.deepEqual(lineColumnAt(text, text.length), { line: 4, column: 3 });
  assert.deepEqual(lineColumnAt(text, 999), { line: 4, column: 3 });
  assert.deepEqual(lineColumnAt(text, -5), { line: 1, column: 1 });
  assert.deepEqual(lineColumnAt('', 0), { line: 1, column: 1 });
  // Columns count code points.
  assert.deepEqual(lineColumnAt('😀x', 2), { line: 1, column: 2 });
  assert.deepEqual(lineColumnAt('😀x', 3), { line: 1, column: 3 });
  assert.deepEqual(lineColumnAt('\n\n', 2), { line: 3, column: 1 });
});
