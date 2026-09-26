import assert from 'node:assert/strict';
import { test } from 'node:test';

import { exactSqrt, gcd, iroot, isqrt, modPow, perfectPower } from '../src/lib/math/bigint.ts';
import {
  DETERMINISTIC_BASES,
  DETERMINISTIC_LIMIT,
  SMALL_PRIMES,
  isStrongLucasProbablePrime,
  isStrongProbablePrime,
  jacobi,
  primality,
} from '../src/lib/math/primality.ts';

function isPrimeBrute(n: number): boolean {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

const LIMIT = 100_000;
const primeTable = Array.from({ length: LIMIT }, (_, n) => isPrimeBrute(n));

test('primality matches trial division for every n below 100,000', () => {
  for (let n = 0; n < LIMIT; n++) {
    assert.equal(primality(BigInt(n)) !== 'composite', primeTable[n], `n = ${n}`);
  }
  for (const n of [-7n, -1n]) assert.equal(primality(n), 'composite');
});

test('the small-prime table holds exactly the 6,542 primes below 65,536', () => {
  assert.equal(SMALL_PRIMES.length, 6542);
  assert.equal(SMALL_PRIMES[0], 2n);
  assert.equal(SMALL_PRIMES.at(-1), 65_521n);
});

/** Odd composites below 100,000 that are strong probable primes to `base`. */
function strongPseudoprimes(base: bigint): number[] {
  const out: number[] = [];
  for (let n = 3; n < LIMIT; n += 2) {
    if (!primeTable[n] && isStrongProbablePrime(BigInt(n), base)) out.push(n);
  }
  return out;
}

test('single-base Miller–Rabin is fooled by exactly the known strong pseudoprimes', () => {
  // OEIS A001262, A020229, A020231, A020233 (all terms below 100,000).
  assert.deepEqual(
    strongPseudoprimes(2n),
    [2047, 3277, 4033, 4681, 8321, 15841, 29341, 42799, 49141, 52633, 65281, 74665, 80581, 85489, 88357, 90751],
  );
  assert.deepEqual(strongPseudoprimes(3n).slice(0, 8), [121, 703, 1891, 3281, 8401, 8911, 10585, 12403]);
  assert.deepEqual(strongPseudoprimes(5n).slice(0, 8), [781, 1541, 5461, 5611, 7813, 13021, 14981, 15751]);
  assert.deepEqual(strongPseudoprimes(7n).slice(0, 8), [25, 325, 703, 2101, 2353, 4525, 11041, 14089]);
  // …but the combined test is never fooled by them.
  for (const n of [2047n, 3277n, 121n, 703n, 781n, 25n, 325n]) assert.equal(primality(n), 'composite', `n = ${n}`);
});

test('every prime passes every Miller–Rabin base', () => {
  for (let n = 3; n < 20_000; n += 2) {
    if (!primeTable[n]) continue;
    for (const base of DETERMINISTIC_BASES) assert.ok(isStrongProbablePrime(BigInt(n), base), `${n} base ${base}`);
  }
});

test('ψₖ: the smallest strong pseudoprimes to the first k prime bases pass them all, yet are composite', () => {
  // OEIS A014233. ψ₁₃ is DETERMINISTIC_LIMIT, the bound below which 13 bases are a proof.
  const psi: bigint[] = [
    2047n,
    1_373_653n,
    25_326_001n,
    3_215_031_751n,
    2_152_302_898_747n,
    3_474_749_660_383n,
    341_550_071_728_321n,
    341_550_071_728_321n,
    3_825_123_056_546_413_051n,
    3_825_123_056_546_413_051n,
    3_825_123_056_546_413_051n,
    318_665_857_834_031_151_167_461n,
    3_317_044_064_679_887_385_961_981n,
  ];
  assert.equal(psi.at(-1), DETERMINISTIC_LIMIT);
  psi.forEach((n, index) => {
    const k = index + 1;
    for (const base of DETERMINISTIC_BASES.slice(0, k)) {
      assert.ok(isStrongProbablePrime(n, base), `ψ${k} = ${n} should pass base ${base}`);
    }
    assert.equal(primality(n), 'composite', `ψ${k} = ${n}`);
  });
});

test('above ψ₁₃ the strong Lucas test catches what the 13 bases miss', () => {
  // ψ₁₃ itself passes all 13 Miller–Rabin rounds; only the Lucas half of BPSW rejects it.
  assert.equal(isStrongLucasProbablePrime(DETERMINISTIC_LIMIT), false);
  assert.equal(primality(DETERMINISTIC_LIMIT), 'composite');
});

test('strong Lucas pseudoprimes (Selfridge parameters) match OEIS A217255', () => {
  const found: number[] = [];
  for (let n = 3; n < LIMIT; n += 2) {
    const lucas = isStrongLucasProbablePrime(BigInt(n));
    if (primeTable[n]) assert.ok(lucas, `prime ${n} must pass`);
    else if (lucas) found.push(n);
  }
  assert.deepEqual(found, [5459, 5777, 10877, 16109, 18971, 22499, 24569, 25199, 40309, 58519, 75077, 97439]);
  // None of them is a strong pseudoprime to base 2, which is why BPSW pairs the two tests.
  for (const n of found) assert.equal(isStrongProbablePrime(BigInt(n), 2n), false);
});

test('primes above ψ₁₃ are probable primes; large composites are rejected', () => {
  assert.equal(primality(2n ** 89n - 1n), 'probable-prime');
  assert.equal(primality(2n ** 107n - 1n), 'probable-prime');
  assert.equal(primality(2n ** 127n - 1n), 'probable-prime');
  assert.equal(primality(2n ** 61n - 1n), 'prime');
  assert.equal(primality(2n ** 31n - 1n), 'prime');
  assert.equal(primality(2n ** 89n + 1n), 'composite');
  assert.equal(primality(2n ** 127n + 1n), 'composite');
  assert.equal(primality((2n ** 61n - 1n) ** 2n), 'composite');
  assert.equal(primality(2n ** 128n + 1n), 'composite'); // F7
});

test('Carmichael numbers fool Fermat’s test but not Miller–Rabin', () => {
  for (const n of [561n, 1105n, 1729n, 2465n, 2821n, 6601n, 8911n, 41041n, 825_265n]) {
    for (const a of [2n, 5n, 7n, 13n, 23n]) {
      if (gcd(a, n) === 1n) assert.equal(modPow(a, n - 1n, n), 1n, `${a}^(n−1) mod ${n}`);
    }
    assert.equal(primality(n), 'composite', `n = ${n}`);
  }
});

test('jacobi agrees with Euler’s criterion for odd primes', () => {
  for (const p of [3n, 5n, 7n, 11n, 13n, 101n, 997n]) {
    for (let a = 0n; a < p; a++) {
      const euler = modPow(a, (p - 1n) / 2n, p);
      const expected = euler === 0n ? 0 : euler === 1n ? 1 : -1;
      assert.equal(jacobi(a, p), expected, `(${a}/${p})`);
    }
  }
  assert.equal(jacobi(2n, 15n), 1); // (2/3)(2/5) = (−1)(−1)
  assert.equal(jacobi(5n, 15n), 0);
});

test('integer roots and perfect powers', () => {
  for (let n = 0n; n < 2000n; n++) {
    const r = isqrt(n);
    assert.ok(r * r <= n && (r + 1n) * (r + 1n) > n, `isqrt(${n})`);
    assert.equal(exactSqrt(n), r * r === n ? r : null);
  }
  const big = 10n ** 39n + 12345n;
  const cube = iroot(big, 3);
  assert.ok(cube ** 3n <= big && (cube + 1n) ** 3n > big);
  assert.deepEqual(perfectPower(1024n), { base: 2n, exponent: 10 });
  assert.deepEqual(perfectPower(3n ** 12n), { base: 3n, exponent: 12 });
  assert.deepEqual(perfectPower(36n), { base: 6n, exponent: 2 });
  assert.deepEqual(perfectPower(360n), { base: 360n, exponent: 1 });
  assert.deepEqual(perfectPower(2n ** 127n), { base: 2n, exponent: 127 });
  assert.deepEqual(perfectPower((10n ** 13n + 37n) ** 3n), { base: 10n ** 13n + 37n, exponent: 3 });
});
