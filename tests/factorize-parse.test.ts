import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mayBeIncomplete, parseInteger, type ParseOptions, type ParseResult } from '../src/lib/math/parse.ts';

const EN: ParseOptions = { groupSeparator: ',', maxDigits: 40 };
const TR: ParseOptions = { groupSeparator: '.', maxDigits: 40 };

function value(result: ParseResult): bigint {
  assert.ok(result.ok, `expected a number, got ${JSON.stringify(result.ok ? null : result.error)}`);
  return result.value;
}

function code(result: ParseResult): string {
  assert.ok(!result.ok, 'expected an error');
  return result.error.code;
}

test('plain digits, signs and leading zeros', () => {
  assert.equal(value(parseInteger('360', EN)), 360n);
  assert.equal(value(parseInteger('  360  ', EN)), 360n);
  assert.equal(value(parseInteger('+360', EN)), 360n);
  assert.equal(value(parseInteger('-360', EN)), -360n);
  assert.equal(value(parseInteger('−360', EN)), -360n); // U+2212
  assert.equal(value(parseInteger('- 360', EN)), -360n);
  assert.equal(value(parseInteger('000360', EN)), 360n);
  assert.equal(value(parseInteger('0', EN)), 0n);
  assert.equal(value(parseInteger('-0', EN)), 0n);
  const result = parseInteger('0007', EN);
  assert.ok(result.ok && result.digits === 1);
});

test('spaces and underscores group digits freely', () => {
  assert.equal(value(parseInteger('18 446 744 073 709 551 615', EN)), 18_446_744_073_709_551_615n);
  assert.equal(value(parseInteger('1_000_000', EN)), 1_000_000n);
  assert.equal(value(parseInteger('12 34', EN)), 1234n);
  assert.equal(value(parseInteger('1 000 000', TR)), 1_000_000n); // no-break and narrow no-break spaces
  assert.equal(value(parseInteger('1  000', EN)), 1000n);
});

test('thousands separators follow the page language', () => {
  assert.equal(value(parseInteger('1,000,000', EN)), 1_000_000n);
  assert.equal(value(parseInteger('1.000.000', TR)), 1_000_000n);
  assert.equal(value(parseInteger('6,700,417', EN)), 6_700_417n);
  assert.equal(value(parseInteger('1,000', EN)), 1000n);
  assert.equal(value(parseInteger('1.000', TR)), 1000n);
  // The other mark is the decimal separator once, but a thousands separator when repeated.
  assert.equal(code(parseInteger('1.000', EN)), 'decimal');
  assert.equal(code(parseInteger('1,000', TR)), 'decimal');
  assert.equal(value(parseInteger('1.000.000', EN)), 1_000_000n);
  assert.equal(value(parseInteger('1,000,000', TR)), 1_000_000n);
});

test('non-integers are rejected as decimals', () => {
  assert.equal(code(parseInteger('3.5', EN)), 'decimal');
  assert.equal(code(parseInteger('3,5', TR)), 'decimal');
  assert.equal(code(parseInteger('1,234.5', EN)), 'decimal');
  assert.equal(code(parseInteger('1.234,5', TR)), 'decimal');
  assert.equal(code(parseInteger('.5', EN)), 'decimal');
  assert.equal(code(parseInteger('360.', EN)), 'decimal');
  assert.equal(code(parseInteger('360,', TR)), 'decimal');
  // A dangling thousands separator is a grouping mistake, not a decimal.
  assert.equal(code(parseInteger('360,', EN)), 'grouping');
  assert.equal(code(parseInteger('360.', TR)), 'grouping');
  assert.equal(code(parseInteger('1.5.6', EN)), 'decimal');
});

test('misplaced separators are grouping errors', () => {
  assert.equal(code(parseInteger('12,34', EN)), 'grouping');
  assert.equal(code(parseInteger('1,0000', EN)), 'grouping');
  assert.equal(code(parseInteger('1234,567', EN)), 'grouping');
  assert.equal(code(parseInteger('1,,000', EN)), 'grouping');
  assert.equal(code(parseInteger('1 000,000', EN)), 'grouping');
  assert.equal(code(parseInteger('_360', EN)), 'grouping');
  assert.equal(code(parseInteger('360_', EN)), 'grouping');
  assert.equal(code(parseInteger('1__000', EN)), 'grouping');
});

test('letters, formulas and stray signs are reported with the character', () => {
  const caret = parseInteger('2^64', EN);
  assert.ok(!caret.ok && caret.error.code === 'invalid-char' && caret.error.char === '^');
  const exponent = parseInteger('1e9', EN);
  assert.ok(!exponent.ok && exponent.error.code === 'invalid-char' && exponent.error.char === 'e');
  const letter = parseInteger('12a', EN);
  assert.ok(!letter.ok && letter.error.code === 'invalid-char' && letter.error.char === 'a');
  const emoji = parseInteger('7😀', EN);
  assert.ok(!emoji.ok && emoji.error.code === 'invalid-char' && emoji.error.char === '😀');
  assert.equal(code(parseInteger('12-3', EN)), 'sign');
  assert.equal(code(parseInteger('--3', EN)), 'sign');
  assert.equal(code(parseInteger('-', EN)), 'no-digits');
  assert.equal(code(parseInteger('- ,', EN)), 'no-digits');
  assert.equal(code(parseInteger('', EN)), 'empty');
  assert.equal(code(parseInteger('   ', EN)), 'empty');
});

test('the digit limit counts significant digits only', () => {
  const forty = '9'.repeat(40);
  assert.equal(value(parseInteger(forty, EN)), 10n ** 40n - 1n);
  assert.equal(value(parseInteger(`000${forty}`, EN)), 10n ** 40n - 1n);
  const tooLong = parseInteger(`1${forty}`, EN);
  assert.ok(!tooLong.ok && tooLong.error.code === 'too-long' && tooLong.error.digits === 41 && tooLong.error.max === 40);
  const small = parseInteger('12345', { groupSeparator: ',', maxDigits: 4 });
  assert.ok(!small.ok && small.error.code === 'too-long');
});

test('mayBeIncomplete holds back errors that more typing can fix', () => {
  for (const text of ['-', '+', '- ', '1,', '1,0', '1,00', '1,000,', '1,000,0']) {
    assert.equal(mayBeIncomplete(text, EN), true, `en: ${JSON.stringify(text)}`);
  }
  for (const text of ['1.', '1.00', '1.000.0']) assert.equal(mayBeIncomplete(text, TR), true, `tr: ${text}`);
  // Finished mistakes, and decimal marks, are shown at once.
  for (const text of ['2^64', '12a', '3.5', '1.', '1,234.5', '1,,0', `${'9'.repeat(41)}`, '12-3']) {
    assert.equal(mayBeIncomplete(text, EN), false, `en: ${JSON.stringify(text)}`);
  }
  assert.equal(mayBeIncomplete('3,5', TR), false);
  // Valid input is not "incomplete".
  assert.equal(mayBeIncomplete('360', EN), false);
});
