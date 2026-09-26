import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  abundance,
  analyze,
  divisorCount,
  divisorSum,
  isCarmichael,
  isSquarefree,
  smallestDivisors,
  totient,
} from '../src/lib/math/arithmetic.ts';
import { gcd } from '../src/lib/math/bigint.ts';
import { factorize } from '../src/lib/math/factorize.ts';

function bruteDivisors(n: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= n; d++) if (n % d === 0) out.push(d);
  return out;
}

function bruteTotient(n: number): number {
  let count = 0;
  for (let k = 1; k <= n; k++) if (gcd(BigInt(k), BigInt(n)) === 1n) count++;
  return count;
}

test('τ, σ, φ and the divisor list match brute force for n = 1 … 1500', () => {
  for (let n = 1; n <= 1500; n++) {
    const { factors } = factorize(BigInt(n));
    const divisors = bruteDivisors(n);
    assert.equal(divisorCount(factors), BigInt(divisors.length), `τ(${n})`);
    assert.equal(divisorSum(factors), BigInt(divisors.reduce((a, b) => a + b, 0)), `σ(${n})`);
    assert.equal(totient(factors), BigInt(bruteTotient(n)), `φ(${n})`);
    assert.deepEqual(smallestDivisors(factors, 10_000).map(Number), divisors, `divisors of ${n}`);
  }
});

test('a truncated divisor list is exactly the smallest divisors', () => {
  for (const n of [360, 720, 5040, 27720, 65536, 83160, 1_081_080]) {
    const all = bruteDivisors(n);
    const { factors } = factorize(BigInt(n));
    for (const limit of [1, 2, 5, 17, 60]) {
      assert.deepEqual(smallestDivisors(factors, limit).map(Number), all.slice(0, limit), `n = ${n}, limit ${limit}`);
    }
  }
  assert.deepEqual(smallestDivisors([], 5), [1n]);
  assert.deepEqual(smallestDivisors([[2n, 3]], 0), []);
});

test('numbers with close to a million divisors stay cheap', () => {
  // 2⁶ · 3⁴ · 5³ · 7² · 11 · 13 · 17 · 19 · 23 · 29 · 31 · 37 · 41 · 43 · 47: τ = 7·5·4·3·2¹¹.
  const n = 2n ** 6n * 3n ** 4n * 5n ** 3n * 7n ** 2n * 11n * 13n * 17n * 19n * 23n * 29n * 31n * 37n * 41n * 43n * 47n;
  const { factors } = factorize(n);
  assert.equal(divisorCount(factors), 7n * 5n * 4n * 3n * 2n ** 11n);
  const start = performance.now();
  const first = smallestDivisors(factors, 10_000);
  assert.ok(performance.now() - start < 2000);
  assert.equal(first.length, 10_000);
  for (let i = 1; i < first.length; i++) assert.ok((first[i - 1] as bigint) < (first[i] as bigint));
  for (const d of first) assert.equal(n % d, 0n);
  // Every divisor below the largest listed one is listed.
  const last = first.at(-1) as bigint;
  let count = 0;
  for (let d = 1n; d <= 2000n && d <= last; d++) if (n % d === 0n) count++;
  assert.equal(first.filter((d) => d <= 2000n).length, count);
});

test('perfect numbers, and abundant and deficient ones', () => {
  const perfect = [6n, 28n, 496n, 8128n, 33_550_336n, 8_589_869_056n, 137_438_691_328n, 2_305_843_008_139_952_128n];
  perfect.push(2_658_455_991_569_831_744_654_692_615_953_842_176n);
  for (const n of perfect) {
    assert.equal(abundance(n, divisorSum(factorize(n).factors)), 'perfect', `n = ${n}`);
  }
  assert.equal(abundance(12n, divisorSum(factorize(12n).factors)), 'abundant');
  assert.equal(abundance(945n, divisorSum(factorize(945n).factors)), 'abundant'); // the first odd abundant number
  assert.equal(abundance(1n, 1n), 'deficient');
  assert.equal(abundance(97n, 98n), 'deficient');
  // No other perfect numbers below 10,000.
  for (let n = 1n; n < 10_000n; n++) {
    const kind = abundance(n, divisorSum(factorize(n).factors));
    assert.equal(kind === 'perfect', perfect.includes(n), `n = ${n}`);
  }
});

test('Korselt’s criterion finds exactly the Carmichael numbers below 100,000', () => {
  const found: number[] = [];
  for (let n = 2; n < 100_000; n++) {
    if (isCarmichael(BigInt(n), factorize(BigInt(n)).factors)) found.push(n);
  }
  // OEIS A002997
  assert.deepEqual(found, [561, 1105, 1729, 2465, 2821, 6601, 8911, 10585, 15841, 29341, 41041, 46657, 52633, 62745, 63973, 75361]);
});

test('square-free numbers', () => {
  assert.equal(isSquarefree(factorize(30n).factors), true);
  assert.equal(isSquarefree(factorize(12n).factors), false);
  assert.equal(isSquarefree([]), true); // 1
});

test('analyze: 0, units, negatives, primes', () => {
  const zero = analyze(0n, null);
  assert.equal(zero.kind, 'zero');
  assert.equal(zero.divisorCount, null);
  assert.equal(zero.squareRoot, 0n);

  const one = analyze(1n, factorize(1n));
  assert.equal(one.kind, 'unit');
  assert.equal(one.divisorCount, 1n);
  assert.equal(one.divisorSum, 1n);
  assert.equal(one.totient, 1n);
  assert.equal(one.squareRoot, 1n);
  assert.equal(one.carmichael, false);

  const minusOne = analyze(-1n, factorize(-1n));
  assert.equal(minusOne.kind, 'unit');
  assert.equal(minusOne.negative, true);

  const negative = analyze(-360n, factorize(-360n));
  assert.equal(negative.kind, 'composite');
  assert.equal(negative.magnitude, 360n);
  assert.equal(negative.divisorCount, 24n);
  assert.equal(negative.divisorSum, 1170n);
  assert.equal(negative.totient, 96n);
  assert.equal(negative.aliquotSum, 810n);
  assert.equal(negative.distinctPrimes, 3);
  assert.equal(negative.primeFactors, 6);
  assert.equal(negative.abundance, 'abundant');

  const prime = analyze(97n, factorize(97n));
  assert.equal(prime.kind, 'prime');
  assert.equal(prime.probable, false);
  assert.equal(prime.abundance, 'deficient');

  const probable = analyze(2n ** 89n - 1n, factorize(2n ** 89n - 1n));
  assert.equal(probable.kind, 'prime');
  assert.equal(probable.probable, true);

  assert.equal(analyze(3600n, factorize(3600n)).squareRoot, 60n);
  assert.equal(analyze(3601n, factorize(3601n)).squareRoot, null);
  assert.equal(analyze(561n, factorize(561n)).carmichael, true);
});

test('analyze: an incomplete factorization leaves the dependent values unknown', () => {
  const n = 4n * 1_000_000_007n * 2_147_483_647n;
  const stopped = factorize(n, { checkpoint: () => true });
  const result = analyze(n, stopped);
  assert.equal(result.complete, false);
  assert.equal(result.kind, 'composite');
  assert.equal(result.divisorCount, null);
  assert.equal(result.divisorSum, null);
  assert.equal(result.totient, null);
  assert.equal(result.abundance, null);
  assert.equal(result.squarefree, null);
  assert.equal(result.carmichael, null);
  assert.equal(result.squareRoot, null); // still known: n is not a square
  const square = (1_000_000_007n * 2_147_483_647n) ** 2n;
  assert.equal(analyze(square, factorize(square, { checkpoint: () => true })).squareRoot, 1_000_000_007n * 2_147_483_647n);
});
