import assert from 'node:assert/strict';
import { test } from 'node:test';

import { primeFactorizerMessages } from '../src/i18n/tools/prime-factorizer.ts';
import { abbreviateDigits, groupDigits } from '../src/lib/math/digits.ts';
import { factorTreeLayout } from '../src/lib/math/factor-tree.ts';
import { factorize, type Factorization } from '../src/lib/math/factorize.ts';
import {
  copyText,
  divisorsCopyText,
  factorTerms,
  formatBig,
  groupSeparator,
  spokenText,
  tauFormula,
} from '../src/scripts/tools/prime-factorizer/text.ts';

test('digit grouping matches Intl in both languages', () => {
  assert.equal(groupSeparator('en'), ',');
  assert.equal(groupSeparator('tr'), '.');
  for (const n of [0n, 7n, 999n, 1000n, 8128n, 123_456n, 1_234_567n, 18_446_744_073_709_551_615n]) {
    assert.equal(formatBig(n, 'en'), new Intl.NumberFormat('en-US').format(n), `en ${n}`);
    assert.equal(formatBig(n, 'tr'), new Intl.NumberFormat('tr-TR').format(n), `tr ${n}`);
  }
  assert.equal(groupDigits(-1_234_567n, ','), '−1,234,567');
});

test('long labels keep both ends', () => {
  assert.equal(abbreviateDigits('18446744073709551615', 10), '18446…1615');
  assert.equal(abbreviateDigits('6700417', 10), '6700417');
  assert.equal(abbreviateDigits('12345678901', 10).length, 10);
});

test('the factorization read aloud, in English and Turkish', () => {
  const terms = factorTerms(factorize(360n));
  assert.equal(
    spokenText(terms, false, 'en', primeFactorizerMessages.en.result.spoken),
    '2 to the power 3 times 3 to the power 2 times 5',
  );
  assert.equal(spokenText(terms, false, 'tr', primeFactorizerMessages.tr.result.spoken), '2 üzeri 3 çarpı 3 üzeri 2 çarpı 5');
  assert.equal(
    spokenText(factorTerms(factorize(-4_294_967_297n)), true, 'tr', primeFactorizerMessages.tr.result.spoken),
    'eksi 1 çarpı 641 çarpı 6.700.417',
  );
  assert.equal(
    spokenText(factorTerms(factorize(-4_294_967_297n)), true, 'en', primeFactorizerMessages.en.result.spoken),
    'minus 1 times 641 times 6,700,417',
  );
});

test('probable primes and unsplit factors are named when read aloud', () => {
  const m89 = 2n ** 89n - 1n;
  const result: Factorization = { factors: [[3n, 1], [m89, 1]], unfactored: [77n, 77n], probable: [m89] };
  const terms = factorTerms(result);
  assert.deepEqual(
    terms.map((t) => [t.base, t.exponent, t.kind]),
    [
      [3n, 1, 'prime'],
      [m89, 1, 'probable'],
      [77n, 2, 'unfactored'],
    ],
  );
  const spoken = spokenText(terms, false, 'en', primeFactorizerMessages.en.result.spoken);
  assert.match(spoken, /618,970,019,642,690,137,449,562,111 \(a probable prime\)/);
  assert.match(spoken, /77 \(composite, not split yet\) to the power 2$/);
});

test('copy text is plain ASCII a calculator can read', () => {
  assert.equal(copyText(factorTerms(factorize(360n)), false), '2^3 * 3^2 * 5');
  assert.equal(copyText(factorTerms(factorize(-360n)), true), '-1 * 2^3 * 3^2 * 5');
  assert.equal(copyText(factorTerms(factorize(97n)), false), '97');
  assert.equal(divisorsCopyText([1n, 2n, 1000n]), '1, 2, 1000');
});

test('τ formula', () => {
  assert.equal(tauFormula(factorize(360n)), '(3 + 1)(2 + 1)(1 + 1)');
  assert.equal(tauFormula(factorize(1n)), null);
  assert.equal(tauFormula(factorize(2n * 3n * 5n * 7n * 11n * 13n * 17n)), null); // too many to help
});

test('factor tree: one split per prime factor, labels never overlap, deep trees are cut', () => {
  const layout = factorTreeLayout(360n, factorize(360n));
  assert.ok(layout);
  // 360 → 2 · 180 → 2 · 90 → 2 · 45 → 3 · 15 → 3 · 5: five splits, eleven nodes.
  assert.equal(layout.nodes.length, 11);
  assert.equal(layout.edges.length, 10);
  assert.equal(layout.hiddenSplits, 0);
  assert.deepEqual(
    layout.nodes.filter((n) => n.kind === 'prime').map((n) => n.label),
    ['2', '2', '2', '3', '3', '5'],
  );
  assert.deepEqual(
    layout.nodes.filter((n) => n.kind === 'inner').map((n) => n.label),
    ['360', '180', '90', '45', '15'],
  );
  for (const node of layout.nodes) {
    assert.ok(node.x >= 0 && node.x <= layout.width && node.y >= 0 && node.y <= layout.height);
  }

  const deep = factorTreeLayout(2n ** 40n, factorize(2n ** 40n), { maxSplits: 6 });
  assert.ok(deep);
  assert.equal(deep.hiddenSplits, 39 - 6);
  assert.ok(deep.more);
  assert.ok(deep.edges.some((edge) => edge.more));

  const prime = factorTreeLayout(97n, factorize(97n));
  assert.ok(prime);
  assert.equal(prime.nodes.length, 1);
  assert.equal(prime.nodes[0]?.kind, 'prime');

  assert.equal(factorTreeLayout(1n, factorize(1n)), null);

  const long = factorTreeLayout(2n ** 64n - 1n, factorize(2n ** 64n - 1n));
  assert.ok(long);
  assert.equal(long.nodes[0]?.label, '18446…1615');
});

test('factor tree marks cofactors that were not split', () => {
  const n = 4n * 1_000_000_007n * 2_147_483_647n;
  const stopped = factorize(n, { checkpoint: () => true });
  const layout = factorTreeLayout(n, stopped);
  assert.ok(layout);
  assert.equal(layout.nodes.at(-1)?.kind, 'unfactored');
});
