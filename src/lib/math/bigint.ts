/**
 * BigInt building blocks for the factorizer: gcd, modular powers, integer roots and
 * perfect-power detection. Pure (no DOM), so the worker, the page and the tests share them.
 *
 * Every function works on arbitrary BigInts; the factorizer only ever feeds them values of
 * at most ~133 bits (40 decimal digits), where the simple textbook algorithms are fast enough.
 */

export function abs(n: bigint): bigint {
  return n < 0n ? -n : n;
}

/** Greatest common divisor (always ≥ 0; gcd(0, 0) = 0). */
export function gcd(a: bigint, b: bigint): bigint {
  let x = abs(a);
  let y = abs(b);
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

/** base^exponent mod modulus by square-and-multiply (modulus > 0, exponent ≥ 0). */
export function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  if (modulus === 1n) return 0n;
  let result = 1n;
  let b = ((base % modulus) + modulus) % modulus;
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus;
    e >>= 1n;
    if (e > 0n) b = (b * b) % modulus;
  }
  return result;
}

/** Number of bits of |n| (0 for 0). */
export function bitLength(n: bigint): number {
  const value = abs(n);
  return value === 0n ? 0 : value.toString(2).length;
}

/** Number of decimal digits of |n| (1 for 0). */
export function digitCount(n: bigint): number {
  return abs(n).toString().length;
}

/**
 * ⌊n^(1/k)⌋ for n ≥ 0 and k ≥ 1, by Newton's method from an overestimate. The iterates
 * decrease monotonically until they reach the root, so the loop stops at the first rise.
 */
export function iroot(n: bigint, k: number): bigint {
  if (n < 0n) throw new RangeError('iroot of a negative number');
  if (!Number.isInteger(k) || k < 1) throw new RangeError('iroot needs a positive integer degree');
  if (n < 2n || k === 1) return n;
  const K = BigInt(k);
  // 2^⌈bits/k⌉ ≥ n^(1/k): a safe starting point above the root.
  let x = 1n << BigInt(Math.ceil(bitLength(n) / k));
  for (;;) {
    const y = ((K - 1n) * x + n / x ** (K - 1n)) / K;
    if (y >= x) return x;
    x = y;
  }
}

/** ⌊√n⌋ for n ≥ 0. */
export function isqrt(n: bigint): bigint {
  return iroot(n, 2);
}

/** Quadratic residues mod 64: a cheap filter before the exact square root. */
const SQUARE_MOD_64 = (() => {
  const residues = new Array<boolean>(64).fill(false);
  for (let i = 0; i < 64; i++) residues[(i * i) % 64] = true;
  return residues;
})();

/** The square root of n when n is a perfect square (n ≥ 0), otherwise null. */
export function exactSqrt(n: bigint): bigint | null {
  if (n < 0n) return null;
  if (!SQUARE_MOD_64[Number(n & 63n)]) return null;
  const root = isqrt(n);
  return root * root === n ? root : null;
}

function isSmallPrime(k: number): boolean {
  if (k < 2) return false;
  for (let d = 2; d * d <= k; d++) if (k % d === 0) return false;
  return true;
}

/**
 * Writes n ≥ 2 as base^exponent with the largest possible exponent (so the base itself is not a
 * perfect power): 1024 → { base: 2, exponent: 10 }, 360 → { base: 360, exponent: 1 }.
 * Only prime exponents up to the bit length need testing (b^6 is found as (b^2)^3, one prime
 * step at a time, and b^k ≥ 2^k).
 */
export function perfectPower(n: bigint): { base: bigint; exponent: number } {
  if (n < 2n) return { base: n, exponent: 1 };
  let base = n;
  let exponent = 1;
  search: for (;;) {
    const bits = bitLength(base);
    for (let k = 2; k <= bits; k++) {
      if (!isSmallPrime(k)) continue;
      const root = iroot(base, k);
      if (root > 1n && root ** BigInt(k) === base) {
        base = root;
        exponent *= k;
        continue search;
      }
    }
    return { base, exponent };
  }
}
