import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareSizes } from '../src/lib/image/compress/stats.ts';
import { formatters } from '../src/i18n/format.ts';
import { imageCompressorMessages } from '../src/i18n/tools/image-compressor.ts';

const MB = 1024 * 1024;
const KB = 1024;

test('reductions round down to whole percents', () => {
  const result = compareSizes(2.4 * MB, 860 * KB);
  assert.equal(result.outcome, 'smaller');
  assert.equal(result.savedBytes, 2.4 * MB - 860 * KB);
  // 1 − 860 KB / 2.4 MB = 0.6500…
  assert.equal(result.fraction, 0.65);
  assert.ok(Math.abs(result.barRatio - 0.35) < 0.001);

  assert.equal(compareSizes(1000, 351).fraction, 0.64, '64.9% shows as 64%');
  assert.equal(compareSizes(100, 71).fraction, 0.29, 'floating point: 0.29 * 100 is 28.999…');
  assert.equal(compareSizes(1000, 1).fraction, 0.99, 'never "100%" for a file that still exists');
});

test('tiny changes keep their exact value (shown as "<1%")', () => {
  const result = compareSizes(100_000, 99_700);
  assert.equal(result.outcome, 'smaller');
  assert.equal(result.fraction, 0.003);
  assert.equal(formatters('en').percent(result.fraction), '<1%');
  assert.equal(formatters('tr').percent(result.fraction), '<%1');
});

test('increases round up, so the page never understates them', () => {
  const result = compareSizes(1000, 1121);
  assert.equal(result.outcome, 'larger');
  assert.equal(result.savedBytes, -121);
  assert.equal(result.fraction, 0.13);
  assert.equal(result.barRatio, 1);
  assert.equal(compareSizes(1000, 2000).fraction, 1, 'twice the size is 100% larger');
});

test('same size and degenerate inputs', () => {
  assert.deepEqual(compareSizes(500, 500), {
    outcome: 'same',
    originalBytes: 500,
    outputBytes: 500,
    savedBytes: 0,
    fraction: 0,
    barRatio: 1,
  });
  assert.equal(compareSizes(0, 10).outcome, 'same');
  assert.equal(compareSizes(-5, 10).originalBytes, 0);
});

test('the summary line reads naturally in both languages', () => {
  const result = compareSizes(2.4 * MB, 905_000);
  for (const [locale, expected] of [
    ['en', 'Reduced by 64% — 2.4 MB → 883.8 KB'],
    ['tr', '%64 küçüldü — 2,4 MB → 883,8 KB'],
  ] as const) {
    const f = formatters(locale);
    const m = imageCompressorMessages[locale].result;
    const line = m.summary(m.reduced(f.percent(result.fraction)), f.bytes(result.originalBytes), f.bytes(result.outputBytes));
    assert.equal(line, expected);
  }
  const larger = compareSizes(100_000, 112_100);
  assert.equal(imageCompressorMessages.en.result.larger(formatters('en').percent(larger.fraction)), '13% larger than the original');
  assert.equal(imageCompressorMessages.tr.result.larger(formatters('tr').percent(larger.fraction)), 'Orijinalden %13 büyük');
});
