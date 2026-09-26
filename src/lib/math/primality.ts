/**
 * Primality testing for the factorizer (pure, BigInt throughout).
 *
 * - Below 65,536² trial division by the sieved small primes decides everything.
 * - Below ψ₁₃ = 3,317,044,064,679,887,385,961,981 (≈ 3.3 × 10²⁴) Miller–Rabin with the first
 *   13 primes (2 … 41) as bases is a proof: ψ₁₃ is the smallest odd composite that passes all
 *   of them (Sorenson & Webster, 2015), so the answer is 'prime' or 'composite', never a guess.
 * - From ψ₁₃ up, those 13 rounds plus a strong Lucas test (the Baillie–PSW combination) decide.
 *   No composite is known to pass BPSW, and none exists below 2⁶⁴, but it is not a proof, so
 *   such numbers are reported as 'probable-prime'.
 */
import { exactSqrt, modPow } from './bigint.ts';

export type Primality = 'composite' | 'prime' | 'probable-prime';

/** Trial division covers primes below this bound. */
export const SMALL_PRIME_LIMIT = 65_536;

/** Every prime below SMALL_PRIME_LIMIT (6,542 of them), ascending. */
export const SMALL_PRIMES: readonly bigint[] = (() => {
  const composite = new Uint8Array(SMALL_PRIME_LIMIT);
  const primes: bigint[] = [];
  for (let i = 2; i < SMALL_PRIME_LIMIT; i++) {
    if (composite[i]) continue;
    primes.push(BigInt(i));
    for (let j = i * i; j < SMALL_PRIME_LIMIT; j += i) composite[j] = 1;
  }
  return primes;
})();

/** A number below this with no prime factor under SMALL_PRIME_LIMIT is itself prime (or 1). */
export const TRIAL_DIVISION_BOUND = BigInt(SMALL_PRIME_LIMIT) * BigInt(SMALL_PRIME_LIMIT);

/** The first 13 primes: Miller–Rabin with these bases is deterministic below ψ₁₃. */
export const DETERMINISTIC_BASES: readonly bigint[] = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n];

/** ψ₁₃: the smallest strong pseudoprime to all of DETERMINISTIC_BASES. */
export const DETERMINISTIC_LIMIT = 3_317_044_064_679_887_385_961_981n;

/**
 * One Miller–Rabin round: is the odd number n > 2 a strong probable prime to base a?
 * Write n − 1 = d · 2^s with d odd; n passes when a^d ≡ 1 or a^(d·2^r) ≡ −1 (mod n) for
 * some 0 ≤ r < s. Every prime passes; most composites fail for most bases.
 */
export function isStrongProbablePrime(n: bigint, a: bigint): boolean {
  if (n < 3n || (n & 1n) === 0n) throw new RangeError('isStrongProbablePrime needs an odd n > 2');
  const base = a % n;
  if (base === 0n) return true; // n divides a: this base says nothing.
  let d = n - 1n;
  let s = 0;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    s++;
  }
  let x = modPow(base, d, n);
  if (x === 1n || x === n - 1n) return true;
  for (let r = 1; r < s; r++) {
    x = (x * x) % n;
    if (x === n - 1n) return true;
    if (x === 1n) return false;
  }
  return false;
}

/** The Jacobi symbol (a/n) for odd n > 0: −1, 0 or 1. */
export function jacobi(a: bigint, n: bigint): -1 | 0 | 1 {
  if (n <= 0n || (n & 1n) === 0n) throw new RangeError('jacobi needs an odd positive n');
  let x = ((a % n) + n) % n;
  let m = n;
  let result: -1 | 1 = 1;
  while (x !== 0n) {
    while ((x & 1n) === 0n) {
      x >>= 1n;
      const r = m & 7n;
      if (r === 3n || r === 5n) result = result === 1 ? -1 : 1;
    }
    const t = x;
    x = m;
    m = t;
    if ((x & 3n) === 3n && (m & 3n) === 3n) result = result === 1 ? -1 : 1;
    x %= m;
  }
  return m === 1n ? result : 0;
}

/**
 * Strong Lucas probable-prime test with Selfridge's parameters (method A): D is the first of
 * 5, −7, 9, −11, … with (D/n) = −1, P = 1, Q = (1 − D)/4. Write n + 1 = d · 2^s with d odd; n
 * passes when U_d ≡ 0 or V_(d·2^r) ≡ 0 (mod n) for some 0 ≤ r < s.
 * Needs an odd n > 2 that is not a perfect square (for a square no such D exists).
 */
export function isStrongLucasProbablePrime(n: bigint): boolean {
  if (n < 3n || (n & 1n) === 0n) throw new RangeError('isStrongLucasProbablePrime needs an odd n > 2');
  if (exactSqrt(n) !== null) return false;

  let D = 5n;
  for (;;) {
    const j = jacobi(D, n);
    if (j === -1) break;
    // (D/n) = 0: D and n share a factor, a proper one unless |D| = n.
    if (j === 0 && (D < 0n ? -D : D) !== n) return false;
    D = D > 0n ? -(D + 2n) : -D + 2n;
  }
  const P = 1n;
  const Q = (1n - D) / 4n;

  const mod = (x: bigint): bigint => {
    const r = x % n;
    return r < 0n ? r + n : r;
  };
  /** x / 2 mod n for odd n: an odd residue becomes even by adding n. */
  const half = (x: bigint): bigint => {
    const r = mod(x);
    return (r & 1n) === 0n ? r >> 1n : (r + n) >> 1n;
  };

  let d = n + 1n;
  let s = 0;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    s++;
  }

  // Left-to-right binary ladder from (U_1, V_1, Q^1) to (U_d, V_d, Q^d).
  let U = 1n;
  let V = P;
  let Qk = mod(Q);
  const bits = d.toString(2);
  for (let i = 1; i < bits.length; i++) {
    // Doubling: U_2k = U_k V_k, V_2k = V_k² − 2Q^k.
    U = mod(U * V);
    V = mod(V * V - 2n * Qk);
    Qk = mod(Qk * Qk);
    if (bits[i] === '1') {
      // Increment: U_(k+1) = (P U_k + V_k) / 2, V_(k+1) = (D U_k + P V_k) / 2.
      const nextU = half(P * U + V);
      const nextV = half(D * U + P * V);
      U = nextU;
      V = nextV;
      Qk = mod(Qk * Q);
    }
  }

  if (U === 0n || V === 0n) return true;
  for (let r = 1; r < s; r++) {
    V = mod(V * V - 2n * Qk);
    if (V === 0n) return true;
    Qk = mod(Qk * Qk);
  }
  return false;
}

/** How many small primes primality() tries before Miller–Rabin (the primes below 550). */
const QUICK_TRIAL_PRIMES = 100;

/**
 * Classifies n as 'prime', 'composite' or, from ψ₁₃ up, 'probable-prime' (see the module
 * comment). Numbers below 2 are 'composite' here only in the sense of "not prime"; callers
 * handle 0 and ±1 before asking.
 */
export function primality(n: bigint): Primality {
  if (n < 2n) return 'composite';
  // A little trial division settles small numbers and most composites quickly; it also takes
  // care of n dividing a base (n ≤ 41), where a Miller–Rabin round would say nothing.
  for (let i = 0; i < QUICK_TRIAL_PRIMES; i++) {
    const p = SMALL_PRIMES[i] as bigint;
    if (p * p > n) return 'prime';
    if (n % p === 0n) return n === p ? 'prime' : 'composite';
  }
  return millerRabinVerdict(n);
}

/** 13 Miller–Rabin rounds, then the Lucas half of BPSW above ψ₁₃ (odd n > 41). */
function millerRabinVerdict(n: bigint): Primality {
  for (const base of DETERMINISTIC_BASES) {
    if (!isStrongProbablePrime(n, base)) return 'composite';
  }
  if (n < DETERMINISTIC_LIMIT) return 'prime';
  return isStrongLucasProbablePrime(n) ? 'probable-prime' : 'composite';
}

/**
 * The same verdict for a number already known to have no prime factor below SMALL_PRIME_LIMIT
 * (the factorizer's cofactors), skipping the trial division.
 */
export function primalityOfRoughNumber(n: bigint): Primality {
  if (n < 2n) return 'composite';
  if (n < TRIAL_DIVISION_BOUND) return 'prime';
  return millerRabinVerdict(n);
}

export function isProbablePrime(n: bigint): boolean {
  return primality(n) !== 'composite';
}
