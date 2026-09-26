import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_BINARY_CHARS,
  MAX_BYTES,
  breakdown,
  byteToBits,
  charKind,
  decodeBinary,
  encodeText,
  excerpt,
  findUtf8Issue,
  formatBinary,
  formatCodePoint,
  invisibleName,
  parseBinary,
  reformatBinary,
  utf8Bytes,
  utf8MarkerBits,
  type DecodeResult,
  type EncodeResult,
  type FormatOptions,
  type Separator,
  type Grouping,
} from '../src/lib/text/binary.ts';

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

function encoded(text: string, ascii = false): Uint8Array {
  const result: EncodeResult = encodeText(text, { ascii });
  assert.ok(result.ok, `encodeText failed for ${JSON.stringify(text)}`);
  return result.bytes;
}

function decoded(input: string, partial = false): Extract<DecodeResult, { ok: true }> {
  const result = decodeBinary(input, { partial });
  assert.ok(result.ok, `decodeBinary failed for ${JSON.stringify(input)}: ${JSON.stringify(!result.ok && result.error)}`);
  return result;
}

function decodeError(input: string, options: { ascii?: boolean; partial?: boolean } = {}) {
  const result = decodeBinary(input, options);
  assert.ok(!result.ok, `expected an error for ${JSON.stringify(input)}`);
  return result.error;
}

const LAYOUTS: FormatOptions[] = (['space', 'none', 'newline'] as Separator[]).flatMap((separator) =>
  (['byte', 'character'] as Grouping[]).map((grouping) => ({ separator, grouping })),
);

const SAMPLES = [
  '',
  'Hi',
  'Merhaba dünya',
  'ğüşıöç ĞÜŞİÖÇ — Iı İi',
  '🚀',
  '𝔸𝕓𝕔 (U+1D538 and friends, all surrogate pairs)',
  '👩‍💻 👍🏽 🇹🇷',
  'é vs é',
  '﻿starts with a BOM',
  'tabs\tand\nnew\r\nlines',
  '\u0000 NUL and DEL \u007f',
  'Ω ≈ ∑ ∫ ∞ 漢字 한국어 العربية',
];

// ------------------------------------------------------------------ encoding and formatting

test('"Hi" is two ASCII bytes', () => {
  assert.equal(formatBinary(encoded('Hi')), '01001000 01101001');
  assert.equal(formatBinary(encoded('Hi'), { separator: 'none', grouping: 'byte' }), '0100100001101001');
  assert.equal(formatBinary(encoded('Hi'), { separator: 'newline', grouping: 'byte' }), '01001000\n01101001');
});

test('Turkish letters take two bytes each', () => {
  for (const letter of 'ğüşıöçĞÜŞİÖÇ') {
    assert.equal(encoded(letter).length, 2, letter);
  }
  assert.equal(formatBinary(encoded('ü')), '11000011 10111100');
  assert.equal(formatBinary(encoded('ı')), '11000100 10110001');
  assert.equal(formatBinary(encoded('İ')), '11000100 10110000');
});

test('an emoji is one code point, a surrogate pair in UTF-16, and four bytes in UTF-8', () => {
  assert.equal('🚀'.length, 2);
  assert.deepEqual([...encoded('🚀')], [0xf0, 0x9f, 0x9a, 0x80]);
  assert.equal(formatBinary(encoded('🚀')), '11110000 10011111 10011010 10000000');
  assert.equal(
    formatBinary(encoded('a🚀'), { separator: 'space', grouping: 'character' }),
    '01100001 11110000100111111001101010000000',
  );
  assert.equal(
    formatBinary(encoded('dü'), { separator: 'newline', grouping: 'character' }),
    '01100100\n1100001110111100',
  );
});

test('formatBinary of nothing is empty', () => {
  for (const layout of LAYOUTS) assert.equal(formatBinary(new Uint8Array(0), layout), '');
});

test('round trip text → binary → text in every layout', () => {
  for (const text of SAMPLES) {
    const bytes = encoded(text);
    for (const layout of LAYOUTS) {
      const binary = formatBinary(bytes, layout);
      const back = decoded(binary);
      assert.equal(back.text, text, `${JSON.stringify(text)} in ${JSON.stringify(layout)}`);
      assert.deepEqual([...back.bytes], [...bytes]);
      assert.equal(back.pending, null);
    }
  }
});

test('round trip of random strings across all planes (seeded)', () => {
  const next = random(20260926);
  const pickCodePoint = (): number => {
    const r = next();
    if (r < 0.3) return 0x20 + Math.floor(next() * 0x5f);
    if (r < 0.5) return 0x80 + Math.floor(next() * (0x800 - 0x80));
    if (r < 0.75) {
      const value = 0x800 + Math.floor(next() * (0x10000 - 0x800));
      return value >= 0xd800 && value <= 0xdfff ? 0xe000 : value;
    }
    return 0x10000 + Math.floor(next() * (0x110000 - 0x10000));
  };
  for (let round = 0; round < 300; round++) {
    const length = Math.floor(next() * 24);
    const text = String.fromCodePoint(...Array.from({ length }, pickCodePoint));
    const layout = LAYOUTS[round % LAYOUTS.length] ?? LAYOUTS[0]!;
    const binary = formatBinary(encoded(text), layout);
    assert.equal(decoded(binary).text, text);
  }
});

test('utf8Bytes matches TextEncoder at every boundary', () => {
  const encoder = new TextEncoder();
  for (const codePoint of [0, 0x7f, 0x80, 0x7ff, 0x800, 0xd7ff, 0xe000, 0xfffd, 0xffff, 0x10000, 0x10ffff]) {
    assert.deepEqual(utf8Bytes(codePoint), [...encoder.encode(String.fromCodePoint(codePoint))], formatCodePoint(codePoint));
  }
});

test('ASCII mode encodes ASCII and flags the first code point above 127', () => {
  assert.deepEqual([...encoded('Hi!', true)], [0x48, 0x69, 0x21]);
  const result = encodeText('Hi dünya 🚀', { ascii: true });
  assert.ok(!result.ok);
  assert.equal(result.error.code, 'non-ascii');
  if (result.error.code !== 'non-ascii') return;
  assert.equal(result.error.codePoint, 0xfc);
  assert.equal(result.error.count, 2, 'ü and the emoji (one code point, two UTF-16 units)');
  assert.deepEqual(result.error.span, { start: 4, end: 5, line: 1, column: 5 });

  const emoji = encodeText('ok\n🚀', { ascii: true });
  assert.ok(!emoji.ok && emoji.error.code === 'non-ascii');
  if (emoji.ok || emoji.error.code !== 'non-ascii') return;
  assert.deepEqual(emoji.error.span, { start: 3, end: 5, line: 2, column: 1 });
  assert.equal(emoji.error.codePoint, 0x1f680);
});

test('DEL (127) is still ASCII', () => {
  assert.ok(encodeText('\u007f', { ascii: true }).ok);
  assert.ok(decodeBinary('01111111', { ascii: true }).ok);
});

test('a lone surrogate is refused instead of turning into U+FFFD', () => {
  for (const text of ['a\uD83D', '\uDE80b', 'x\uD83Dy']) {
    const result = encodeText(text);
    assert.ok(!result.ok && result.error.code === 'lone-surrogate', JSON.stringify(text));
  }
  const result = encodeText('ab\uDE80');
  assert.ok(!result.ok && result.error.code === 'lone-surrogate');
  if (result.ok || result.error.code !== 'lone-surrogate') return;
  assert.equal(result.error.unit, 0xde80);
  assert.equal(result.error.span.start, 2);
});

test('text over the size limit is refused', () => {
  const ascii = encodeText('a'.repeat(MAX_BYTES + 1));
  assert.ok(!ascii.ok && ascii.error.code === 'too-long');
  // Under the limit in UTF-16 units, over it in bytes.
  const turkish = encodeText('ş'.repeat(MAX_BYTES / 2 + 1));
  assert.ok(!turkish.ok && turkish.error.code === 'too-long');
  assert.ok(encodeText('a'.repeat(MAX_BYTES)).ok);
});

// ------------------------------------------------------------------ parsing binary

test('separators: spaces, tabs, line breaks, commas and exotic whitespace', () => {
  for (const input of [
    '01001000 01101001',
    '01001000,01101001',
    '01001000, 01101001',
    '  01001000\t01101001  ',
    '01001000\r\n01101001\n',
    '01001000 01101001',
    '01001000 01101001',
    ',01001000,,01101001,',
  ]) {
    assert.equal(decoded(input).text, 'Hi', JSON.stringify(input));
  }
});

test('one continuous run of bits whose length is a multiple of 8', () => {
  assert.equal(decoded('0100100001101001').text, 'Hi');
  assert.equal(decoded('1100001110111100').text, 'ü');
  assert.equal(decoded('01001000 0110100101101001').text, 'Hii');
});

test('0b prefixes are optional, per group, in either case', () => {
  assert.equal(decoded('0b01001000 0b01101001').text, 'Hi');
  assert.equal(decoded('0B01001000,01101001').text, 'Hi');
  assert.equal(decoded('0b0100100001101001').text, 'Hi');
});

test('empty and blank input decode to empty text', () => {
  for (const input of ['', '   ', '\n\n', ',']) {
    const result = decoded(input);
    assert.equal(result.text, '');
    assert.equal(result.bytes.length, 0);
    assert.equal(result.pending, null);
  }
});

test('a character that is not a bit is reported with its position', () => {
  const error = decodeError('01001000 01102001');
  assert.equal(error.code, 'invalid-character');
  if (error.code !== 'invalid-character') return;
  assert.equal(error.char, '2');
  assert.equal(error.codePoint, 0x32);
  assert.deepEqual(error.span, { start: 13, end: 14, line: 1, column: 14 });

  const second = decodeError('01001000\n0110x001');
  assert.ok(second.code === 'invalid-character');
  if (second.code !== 'invalid-character') return;
  assert.deepEqual(second.span, { start: 13, end: 14, line: 2, column: 5 });
});

test('an emoji in binary input is reported as one character spanning two UTF-16 units', () => {
  const error = decodeError('01001000 🚀');
  assert.ok(error.code === 'invalid-character');
  if (error.code !== 'invalid-character') return;
  assert.equal(error.char, '🚀');
  assert.equal(error.codePoint, 0x1f680);
  assert.deepEqual(error.span, { start: 9, end: 11, line: 1, column: 10 });
});

test('a b outside a leading 0b, or a prefix in the middle of a group, is invalid', () => {
  for (const [input, char] of [
    ['01b01000', 'b'],
    ['0100b1000', 'b'],
    ['1b01001000', 'b'],
    ['0b0b01001000', 'b'],
    ['01001000;01101001', ';'],
    ['01001000_01101001', '_'],
  ] as const) {
    const error = decodeError(input);
    assert.ok(error.code === 'invalid-character', input);
    if (error.code === 'invalid-character') assert.equal(error.char, char, input);
  }
});

test('groups that are not whole bytes are reported with their number and span', () => {
  const error = decodeError('01001000 0110100 01101001');
  assert.equal(error.code, 'group-length');
  if (error.code !== 'group-length') return;
  assert.equal(error.group, 2);
  assert.equal(error.bits, 7);
  assert.deepEqual(error.span, { start: 9, end: 16, line: 1, column: 10 });

  const long = decodeError('010010000');
  assert.ok(long.code === 'group-length');
  if (long.code === 'group-length') assert.equal(long.bits, 9);

  const bare = decodeError('0b 01001000');
  assert.ok(bare.code === 'group-length');
  if (bare.code === 'group-length') assert.deepEqual([bare.group, bare.bits], [1, 0]);

  // Strict mode: an unfinished last group is an error too.
  const last = decodeError('01001000 0110');
  assert.ok(last.code === 'group-length');
  if (last.code === 'group-length') assert.deepEqual([last.group, last.bits], [2, 4]);
});

test('parseBinary reports groups with and without prefixes', () => {
  const parsed = parseBinary(' 0b0101, 11 ');
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.groups, [
    { start: 1, bitsStart: 3, end: 7 },
    { start: 9, bitsStart: 9, end: 11 },
  ]);
});

test('binary over the size limits is refused', () => {
  const tooManyBytes = decodeBinary('01000001'.repeat(MAX_BYTES + 1));
  assert.ok(!tooManyBytes.ok && tooManyBytes.error.code === 'too-long');
  const tooManyChars = decodeBinary(' '.repeat(MAX_BINARY_CHARS + 1));
  assert.ok(!tooManyChars.ok && tooManyChars.error.code === 'too-long');
  assert.ok(decodeBinary('01000001'.repeat(MAX_BYTES)).ok);
});

// ------------------------------------------------------------------ UTF-8 validity

const bits = (...bytes: number[]) => bytes.map(byteToBits).join(' ');

test('malformed UTF-8 is refused with the problem and the byte', () => {
  const cases: Array<[number[], string, number, number]> = [
    // [bytes, problem, first byte of the sequence, offending byte]
    [[0x41, 0x80], 'unexpected-continuation', 1, 1],
    [[0xbf], 'unexpected-continuation', 0, 0],
    [[0xc3, 0x41], 'missing-continuation', 0, 1],
    [[0xe2, 0x82, 0x41], 'missing-continuation', 0, 2],
    [[0xf0, 0x9f, 0x9a, 0x20], 'missing-continuation', 0, 3],
    [[0xc0, 0x80], 'overlong', 0, 0],
    [[0xc1, 0xbf], 'overlong', 0, 0],
    [[0xe0, 0x80, 0x80], 'overlong', 0, 1],
    [[0xf0, 0x80, 0x80, 0x80], 'overlong', 0, 1],
    [[0xed, 0xa0, 0x80], 'surrogate', 0, 1],
    [[0xf4, 0x90, 0x80, 0x80], 'too-large', 0, 1],
    [[0xf5, 0x80, 0x80, 0x80], 'too-large', 0, 0],
    [[0xf8], 'invalid-byte', 0, 0],
    [[0xff], 'invalid-byte', 0, 0],
    [[0x48, 0x69, 0xc3], 'truncated', 2, 3],
  ];
  for (const [bytes, problem, byte, at] of cases) {
    const error = decodeError(bits(...bytes));
    assert.equal(error.code, 'invalid-utf8', bytes.join());
    if (error.code !== 'invalid-utf8') continue;
    assert.equal(error.issue.problem, problem, bytes.join());
    assert.equal(error.byte, byte, bytes.join());
    assert.equal(error.issue.at, at, bytes.join());
    // Each byte is 8 bits plus a space.
    assert.equal(error.span.start, byte * 9, bytes.join());
  }
});

test('the span of an invalid sequence covers its bytes', () => {
  const error = decodeError('01001000 11000011 01000001');
  assert.ok(error.code === 'invalid-utf8');
  if (error.code !== 'invalid-utf8') return;
  assert.equal(error.issue.problem, 'missing-continuation');
  assert.equal(error.issue.expected, 2);
  assert.deepEqual(error.span, { start: 9, end: 26, line: 1, column: 10 });
  assert.equal(error.value, 0x41);
});

test('findUtf8Issue agrees with a fatal TextDecoder on random bytes (seeded)', () => {
  const next = random(42);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const interesting = [0x00, 0x41, 0x7f, 0x80, 0x9f, 0xa0, 0xbf, 0xc0, 0xc1, 0xc2, 0xdf, 0xe0, 0xed, 0xef, 0xf0, 0xf4, 0xf5, 0xff];
  for (let round = 0; round < 20_000; round++) {
    const length = 1 + Math.floor(next() * 6);
    const bytes = Uint8Array.from({ length }, () =>
      next() < 0.6 ? (interesting[Math.floor(next() * interesting.length)] ?? 0) : Math.floor(next() * 256),
    );
    let valid = true;
    try {
      decoder.decode(bytes);
    } catch {
      valid = false;
    }
    assert.equal(findUtf8Issue(bytes) === null, valid, [...bytes].map((b) => b.toString(16)).join(' '));
  }
});

test('a byte order mark survives the round trip', () => {
  assert.equal(decoded('11101111 10111011 10111111 01100001').text, '﻿a');
});

// ------------------------------------------------------------------ ASCII mode and partial input

test('ASCII mode flags the first byte above 127 and counts them all', () => {
  const error = decodeError('01001000 11000011 10111100', { ascii: true });
  assert.equal(error.code, 'non-ascii');
  if (error.code !== 'non-ascii') return;
  assert.equal(error.byte, 1);
  assert.equal(error.value, 0xc3);
  assert.equal(error.count, 2);
  assert.deepEqual(error.span, { start: 9, end: 17, line: 1, column: 10 });
  assert.equal(decodeBinary('01001000 01101001', { ascii: true }).ok, true);
});

test('partial mode: an unfinished last byte is pending, not an error', () => {
  const result = decoded('01001000 0110', true);
  assert.equal(result.text, 'H');
  assert.deepEqual(result.pending, { bits: 4, bytes: 0, expected: 0, span: { start: 9, end: 13, line: 1, column: 10 } });

  const run = decoded('01001000011', true);
  assert.equal(run.text, 'H');
  assert.equal(run.pending?.bits, 3);
  assert.equal(run.pending?.span.start, 8);

  const prefix = decoded('01001000 0b', true);
  assert.equal(prefix.text, 'H');
  assert.deepEqual([prefix.pending?.bits, prefix.pending?.span.start], [0, 9]);

  // Only the last group may be unfinished.
  const middle = decodeBinary('0110 01001000', { partial: true });
  assert.ok(!middle.ok && middle.error.code === 'group-length');
});

test('partial mode: a character missing its last bytes is pending', () => {
  const result = decoded('01001000 11110000 10011111', true);
  assert.equal(result.text, 'H');
  assert.equal(result.bytes.length, 3);
  assert.deepEqual(
    [result.pending?.bytes, result.pending?.expected, result.pending?.bits, result.pending?.span.start],
    [2, 4, 0, 9],
  );

  const both = decoded('11000011 1011', true);
  assert.equal(both.text, '');
  assert.deepEqual([both.pending?.bytes, both.pending?.expected, both.pending?.bits], [1, 2, 4]);

  // Other UTF-8 problems stay errors.
  const bad = decodeBinary('11000011 01000001', { partial: true });
  assert.ok(!bad.ok && bad.error.code === 'invalid-utf8');
});

test('reformatBinary rewrites valid input in a new layout and keeps an unfinished tail', () => {
  const newline: FormatOptions = { separator: 'newline', grouping: 'byte' };
  assert.equal(reformatBinary('0100100001101001', newline), '01001000\n01101001');
  assert.equal(reformatBinary('0b01001000, 0110', newline), '01001000\n0110');
  assert.equal(reformatBinary('0110', newline), '0110');
  assert.equal(reformatBinary('01001000 0b', newline), '01001000');
  assert.equal(
    reformatBinary('11000011 10111100 01100001', { separator: 'space', grouping: 'character' }),
    '1100001110111100 01100001',
  );
  assert.equal(reformatBinary('01001000 2', newline), null);
  assert.equal(reformatBinary('11000011 01000001', newline), null);
});

// ------------------------------------------------------------------ breakdown

test('breakdown lists code points with their UTF-8 bytes', () => {
  const { rows, total, bytes } = breakdown('Hü🚀');
  assert.equal(total, 3);
  assert.equal(bytes, 7);
  assert.deepEqual(
    rows.map((row) => [row.index, row.offset, row.char, formatCodePoint(row.codePoint), row.bytes, row.kind]),
    [
      [0, 0, 'H', 'U+0048', [0x48], 'printable'],
      [1, 1, 'ü', 'U+00FC', [0xc3, 0xbc], 'printable'],
      [2, 2, '🚀', 'U+1F680', [0xf0, 0x9f, 0x9a, 0x80], 'printable'],
    ],
  );
});

test('breakdown splits emoji sequences into their code points', () => {
  const { rows } = breakdown('👩‍💻');
  assert.deepEqual(
    rows.map((row) => [formatCodePoint(row.codePoint), row.name]),
    [
      ['U+1F469', null],
      ['U+200D', 'ZWJ'],
      ['U+1F4BB', null],
    ],
  );
  assert.equal(rows[1]?.kind, 'format');
});

test('breakdown is capped but totals cover the whole text', () => {
  const text = 'ab'.repeat(200) + 'ş';
  const { rows, total, bytes } = breakdown(text, 10);
  assert.equal(rows.length, 10);
  assert.equal(total, 401);
  assert.equal(bytes, 402);
});

test('breakdown of a lone surrogate has no bytes', () => {
  const { rows } = breakdown('\uD83D');
  assert.deepEqual([rows[0]?.kind, rows[0]?.bytes], ['surrogate', []]);
});

test('invisible characters have names; kinds follow Unicode categories', () => {
  assert.equal(invisibleName(0x0a), 'LF');
  assert.equal(invisibleName(0x20), 'SP');
  assert.equal(invisibleName(0x7f), 'DEL');
  assert.equal(invisibleName(0x85), 'NEL');
  assert.equal(invisibleName(0xfe0f), 'VS16');
  assert.equal(invisibleName(0xe0100), 'VS17');
  assert.equal(invisibleName(0x41), null);
  assert.equal(charKind(0x0a), 'control');
  assert.equal(charKind(0x20), 'space');
  assert.equal(charKind(0x3000), 'space');
  assert.equal(charKind(0x200d), 'format');
  assert.equal(charKind(0x301), 'combining');
  assert.equal(charKind(0x131), 'printable');
});

test('marker bits: how much of each byte is UTF-8 structure', () => {
  assert.deepEqual(
    [0x48, 0xc3, 0xbc, 0xe2, 0xf0, 0xff].map(utf8MarkerBits),
    [1, 3, 2, 4, 5, 8],
  );
});

// ------------------------------------------------------------------ excerpts

test('excerpt shows a one-line window around the problem', () => {
  const input = '01001000\n01102001 01101001';
  const error = decodeError(input);
  assert.ok(error.code === 'invalid-character');
  if (error.code !== 'invalid-character') return;
  const view = excerpt(input, error.span.start, error.span.end, 6);
  assert.deepEqual(view, {
    before: '0↵0110',
    focus: '2',
    after: '001 01',
    clippedStart: true,
    clippedEnd: true,
  });
});

test('excerpt never splits a surrogate pair and shortens a long focus', () => {
  const text = '🚀🚀🚀x🚀🚀';
  // A window edge inside a pair moves back to the pair's start.
  const view = excerpt(text, 6, 7, 3);
  assert.equal(view.focus, 'x');
  assert.equal(view.before, '🚀🚀');
  assert.equal(view.after, '🚀');
  const long = excerpt('0'.repeat(100), 0, 100, 4, 10);
  assert.equal(long.focus, `${'0'.repeat(10)}…`);
  assert.equal(long.before, '');
  assert.equal(long.clippedStart, false);
});
