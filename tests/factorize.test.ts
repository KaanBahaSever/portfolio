import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  continueFactorization,
  factorize,
  mergeFactorizations,
  mergePrimePowers,
  primeList,
  productOf,
  type Factorization,
  type PrimePower,
} from '../src/lib/math/factorize.ts';
import { primality } from '../src/lib/math/primality.ts';

/** Brute-force factorization of a small positive integer. */
function bruteFactor(n: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    let e = 0;
    while (m % p === 0) {
      m /= p;
      e++;
    }
    if (e > 0) out.push([p, e]);
  }
  if (m > 1) out.push([m, 1]);
  return out;
}

const toNumbers = (factors: readonly PrimePower[]) => factors.map(([p, e]) => [Number(p), e]);

/** Checks a factorization of n: complete, sorted, every factor prime, product equal to |n|. */
function assertComplete(n: bigint, result: Factorization): void {
  assert.deepEqual(result.unfactored, [], `${n} left unfactored parts`);
  assert.equal(productOf(result), n < 0n ? -n : n, `${n}: product mismatch`);
  for (let i = 1; i < result.factors.length; i++) {
    assert.ok((result.factors[i - 1] as PrimePower)[0] < (result.factors[i] as PrimePower)[0], `${n}: not sorted`);
  }
  for (const [p, e] of result.factors) {
    assert.ok(e >= 1, `${n}: exponent ${e}`);
    assert.notEqual(primality(p), 'composite', `${n}: factor ${p} is composite`);
  }
}

test('matches brute force for every n from 1 to 5000', () => {
  for (let n = 1; n <= 5000; n++) {
    const result = factorize(BigInt(n));
    assert.deepEqual(toNumbers(result.factors), bruteFactor(n), `n = ${n}`);
    assert.deepEqual(result.unfactored, []);
    assert.deepEqual(result.probable, []);
  }
});

test('1 and −1 are the empty product; 0 has no factorization', () => {
  assert.deepEqual(factorize(1n).factors, []);
  assert.deepEqual(factorize(-1n).factors, []);
  assert.throws(() => factorize(0n), RangeError);
});

test('a negative number is factored through its absolute value', () => {
  assert.deepEqual(factorize(-360n), factorize(360n));
  assert.deepEqual(toNumbers(factorize(-97n).factors), [[97, 1]]);
});

test('known factorizations', () => {
  const cases: Array<[bigint, Array<[bigint, number]>]> = [
    [360n, [[2n, 3], [3n, 2], [5n, 1]]],
    // 2⁶⁴ − 1 = (2³² − 1)(2³² + 1) = 3 · 5 · 17 · 257 · 65537 · 641 · 6700417
    [2n ** 64n - 1n, [[3n, 1], [5n, 1], [17n, 1], [257n, 1], [641n, 1], [65537n, 1], [6700417n, 1]]],
    // Fermat's F5, whose factor 641 Euler found in 1732.
    [4_294_967_297n, [[641n, 1], [6_700_417n, 1]]],
    // F6 = 2⁶⁴ + 1: the factor 274,177 is above the trial-division bound, so rho finds it.
    [2n ** 64n + 1n, [[274_177n, 1], [67_280_421_310_721n, 1]]],
    // Project Euler, problem 3.
    [600_851_475_143n, [[71n, 1], [839n, 1], [1471n, 1], [6857n, 1]]],
    // Carmichael numbers.
    [561n, [[3n, 1], [11n, 1], [17n, 1]]],
    [1105n, [[5n, 1], [13n, 1], [17n, 1]]],
    [1729n, [[7n, 1], [13n, 1], [19n, 1]]],
    [2465n, [[5n, 1], [17n, 1], [29n, 1]]],
    [8911n, [[7n, 1], [19n, 1], [67n, 1]]],
    // The strong pseudoprimes that bound deterministic Miller–Rabin: two 13-digit factors.
    [3_317_044_064_679_887_385_961_981n, [[1_287_836_182_261n, 1], [2_575_672_364_521n, 1]]],
    [318_665_857_834_031_151_167_461n, [[399_165_290_221n, 1], [798_330_580_441n, 1]]],
    // 10⁴⁰ − 1, the largest 40-digit number.
    [
      10n ** 40n - 1n,
      [
        [3n, 2],
        [11n, 1],
        [41n, 1],
        [73n, 1],
        [101n, 1],
        [137n, 1],
        [271n, 1],
        [3541n, 1],
        [9091n, 1],
        [27961n, 1],
        [1_676_321n, 1],
        [5_964_848_081n, 1],
      ],
    ],
    // An even perfect number: 2⁶⁰ (2⁶¹ − 1), 37 digits.
    [2_658_455_991_569_831_744_654_692_615_953_842_176n, [[2n, 60], [2_305_843_009_213_693_951n, 1]]],
  ];
  for (const [n, expected] of cases) {
    const result = factorize(n);
    assert.deepEqual(result.factors, expected, `n = ${n}`);
    assertComplete(n, result);
  }
});

test('perfect powers of large primes are found without searching', () => {
  const p = 2n ** 61n - 1n; // a Mersenne prime
  let checkpoints = 0;
  const result = factorize(p ** 2n, { checkpoint: () => (checkpoints++, false) });
  assert.deepEqual(result.factors, [[p, 2]]);
  assert.equal(checkpoints, 0, 'no rho search needed');
  assert.deepEqual(factorize(3n ** 80n).factors, [[3n, 80]]);
  assert.deepEqual(factorize(2n ** 132n).factors, [[2n, 132]]);
  assert.deepEqual(factorize((6_700_417n * 641n) ** 3n).factors, [[641n, 3], [6_700_417n, 3]]);
});

test('two large factors close to √n are found by Fermat’s method', () => {
  const p = 2n ** 61n - 1n;
  let q = p + 2n;
  while (primality(q) === 'composite') q += 2n;
  const result = factorize(p * q);
  assert.deepEqual(result.factors, [[p, 1], [q, 1]]);
});

test('the largest prime factor of 25 digits or more is reported as probable', () => {
  const m127 = 2n ** 127n - 1n; // 39 digits
  const result = factorize(m127);
  assert.deepEqual(result.factors, [[m127, 1]]);
  assert.deepEqual(result.probable, [m127]);

  const m89 = 2n ** 89n - 1n; // 27 digits
  const product = factorize(6n * m89);
  assert.deepEqual(product.factors, [[2n, 1], [3n, 1], [m89, 1]]);
  assert.deepEqual(product.probable, [m89]);

  // Below ψ₁₃ the verdict is a proof: nothing is marked probable.
  assert.deepEqual(factorize(2n ** 61n - 1n).probable, []);
});

test('a stopped search lists what it could not split, and can be continued', () => {
  const a = 1_000_000_007n;
  const b = 2_147_483_647n; // far apart, so Fermat's shortcut does not apply
  const n = 360n * a * b;
  let calls = 0;
  const stopped = factorize(n, { checkpoint: () => ++calls >= 1 });
  assert.equal(calls, 1);
  assert.deepEqual(stopped.factors, [[2n, 3], [3n, 2], [5n, 1]]);
  assert.deepEqual(stopped.unfactored, [a * b]);
  assert.equal(productOf(stopped), n);

  const continued = continueFactorization(stopped);
  assert.deepEqual(continued.factors, [[2n, 3], [3n, 2], [5n, 1], [a, 1], [b, 1]]);
  assert.deepEqual(continued.unfactored, []);
  assert.equal(productOf(continued), n);
});

test('a stop still sorts out the cheap parts: primes and powers are not left unfactored', () => {
  // Continue from leftovers a·b, p and (a·b)² with a search that stops at once: p is still
  // recognized as prime and the square is still reduced to a·b (twice), so only a·b remains.
  const a = 1_000_000_007n;
  const b = 2_147_483_647n;
  const p = 2n ** 61n - 1n;
  const stopped = continueFactorization(
    { factors: [[2n, 1]], unfactored: [a * b, p, (a * b) ** 2n], probable: [] },
    { checkpoint: () => true },
  );
  assert.deepEqual(stopped.factors, [[2n, 1], [p, 1]]);
  assert.deepEqual(stopped.unfactored, [a * b, a * b, a * b]);
  assert.equal(productOf(stopped), 2n * (a * b) ** 3n * p);
});

test('checkpoint receives progress while rho runs', () => {
  const seen: number[] = [];
  const n = 1_000_000_007n * 2_147_483_647n * 8n;
  factorize(n, {
    checkpoint: (progress) => {
      seen.push(progress.digits);
      assert.equal(progress.found, 3, 'the three factors of 2 are already found');
      assert.ok(progress.steps >= 0);
      return false;
    },
  });
  assert.ok(seen.length > 1);
  assert.ok(seen.every((digits) => digits === 19));
});

test('mergePrimePowers adds exponents of equal primes', () => {
  assert.deepEqual(
    mergePrimePowers(
      [
        [2n, 1],
        [5n, 2],
      ],
      [
        [3n, 1],
        [5n, 1],
      ],
    ),
    [
      [2n, 1],
      [3n, 1],
      [5n, 3],
    ],
  );
});

test('mergeFactorizations keeps only the continuation’s leftovers', () => {
  const merged = mergeFactorizations(
    { factors: [[2n, 2]], unfactored: [15n], probable: [] },
    { factors: [[3n, 1]], unfactored: [77n], probable: [] },
  );
  assert.deepEqual(merged, { factors: [[2n, 2], [3n, 1]], unfactored: [77n], probable: [] });
});

test('primeList repeats each prime by its exponent', () => {
  assert.deepEqual(primeList(factorize(360n).factors), [2n, 2n, 2n, 3n, 3n, 5n]);
  assert.deepEqual(primeList([]), []);
});
