/**
 * Arithmetic functions and properties computed from a prime factorization (pure, BigInt):
 * the divisors, τ(n), σ(n), φ(n), and flags such as perfect square, perfect number and
 * Carmichael number. analyze() gathers everything the factorizer page shows about one integer.
 *
 * Functions of n are those of |n|: divisors of −360 are ±d for the divisors d of 360, and τ,
 * σ and φ are defined on positive integers. Callers say so where the sign matters.
 */
import { abs, exactSqrt } from './bigint.ts';
import type { Factorization, PrimePower } from './factorize.ts';

/** τ(n), the number of positive divisors: ∏ (eᵢ + 1). */
export function divisorCount(factors: readonly PrimePower[]): bigint {
  return factors.reduce((product, [, e]) => product * BigInt(e + 1), 1n);
}

/** σ(n), the sum of the positive divisors: ∏ (pᵢ^(eᵢ+1) − 1) / (pᵢ − 1). */
export function divisorSum(factors: readonly PrimePower[]): bigint {
  return factors.reduce((product, [p, e]) => product * ((p ** BigInt(e + 1) - 1n) / (p - 1n)), 1n);
}

/** φ(n), Euler's totient (how many of 1 … n are coprime to n): ∏ pᵢ^(eᵢ−1) (pᵢ − 1). */
export function totient(factors: readonly PrimePower[]): bigint {
  return factors.reduce((product, [p, e]) => product * p ** BigInt(e - 1) * (p - 1n), 1n);
}

/** Merges two ascending lists without repeats, keeping at most `limit` values. */
function mergeUnique(a: readonly bigint[], b: readonly bigint[], limit: number): bigint[] {
  const out: bigint[] = [];
  let i = 0;
  let j = 0;
  while (out.length < limit && (i < a.length || j < b.length)) {
    const x = a[i];
    const y = b[j];
    if (y === undefined || (x !== undefined && x < y)) {
      out.push(x as bigint);
      i++;
    } else if (x === undefined || y < x) {
      out.push(y);
      j++;
    } else {
      out.push(x);
      i++;
      j++;
    }
  }
  return out;
}

/**
 * The `limit` smallest positive divisors, ascending (all of them when τ(n) ≤ limit).
 *
 * Built one prime at a time: D(m·p) = D(m) ∪ p·D(m). Truncating after every step is exact,
 * because each of the k smallest divisors of m·p is either one of the k smallest of m, or p
 * times one of them (anything smaller than d also lies below p·d). So the work stays
 * proportional to limit × Ω(n), even for numbers with millions of divisors.
 */
export function smallestDivisors(factors: readonly PrimePower[], limit: number): bigint[] {
  if (!(limit >= 1)) return [];
  let divisors: bigint[] = [1n];
  for (const [p, e] of factors) {
    for (let i = 0; i < e; i++) {
      divisors = mergeUnique(
        divisors,
        divisors.map((d) => d * p),
        limit,
      );
    }
  }
  return divisors;
}

export function isSquarefree(factors: readonly PrimePower[]): boolean {
  return factors.every(([, e]) => e === 1);
}

/**
 * Korselt's criterion: a composite n is a Carmichael number (a^(n−1) ≡ 1 mod n for every a
 * coprime to n, so Fermat's test never exposes it) exactly when it is square-free and p − 1
 * divides n − 1 for every prime p | n. `n` is positive with the given factorization.
 */
export function isCarmichael(n: bigint, factors: readonly PrimePower[]): boolean {
  const composite = factors.length > 1 || (factors.length === 1 && (factors[0] as PrimePower)[1] > 1);
  if (!composite || !isSquarefree(factors)) return false;
  return factors.every(([p]) => (n - 1n) % (p - 1n) === 0n);
}

/** Compares σ(n) with 2n: below, a deficient number; equal, a perfect one; above, abundant. */
export type Abundance = 'deficient' | 'perfect' | 'abundant';

export function abundance(n: bigint, sigma: bigint): Abundance {
  const twice = 2n * n;
  return sigma < twice ? 'deficient' : sigma === twice ? 'perfect' : 'abundant';
}

/** 'zero', a 'unit' (±1: neither prime nor composite), 'prime' or 'composite' (of |n|). */
export type IntegerKind = 'zero' | 'unit' | 'prime' | 'composite';

export interface Analysis {
  value: bigint;
  /** |value|: the number everything below describes. */
  magnitude: bigint;
  negative: boolean;
  kind: IntegerKind;
  /** The factorization of |n|; null for 0. */
  factorization: Factorization | null;
  /** True when every factor is known (always true for 0 and ±1). */
  complete: boolean;
  /** Prime factorization rests on a probable-prime test for at least one factor. */
  probable: boolean;
  /** ω(n): distinct prime factors (null while incomplete or for 0). */
  distinctPrimes: number | null;
  /** Ω(n): prime factors counted with multiplicity (null while incomplete or for 0). */
  primeFactors: number | null;
  divisorCount: bigint | null;
  divisorSum: bigint | null;
  totient: bigint | null;
  /** σ(n) − n, the sum of the proper divisors. */
  aliquotSum: bigint | null;
  /** √|n| when |n| is a perfect square (known without factoring), otherwise null. */
  squareRoot: bigint | null;
  squarefree: boolean | null;
  abundance: Abundance | null;
  carmichael: boolean | null;
}

/**
 * Everything the page shows about n, from its (possibly incomplete) factorization. Values that
 * need every prime factor are null until the factorization is complete; whether |n| is a
 * perfect square is always known (an integer square root settles it).
 */
export function analyze(value: bigint, factorization: Factorization | null): Analysis {
  const magnitude = abs(value);
  const negative = value < 0n;
  const squareRoot = exactSqrt(magnitude);
  const empty = {
    distinctPrimes: null,
    primeFactors: null,
    divisorCount: null,
    divisorSum: null,
    totient: null,
    aliquotSum: null,
    squarefree: null,
    abundance: null,
    carmichael: null,
  } as const;

  if (magnitude === 0n) {
    return { value, magnitude, negative, kind: 'zero', factorization: null, complete: true, probable: false, squareRoot, ...empty };
  }
  const result: Factorization = factorization ?? { factors: [], unfactored: [], probable: [] };
  const complete = result.unfactored.length === 0;
  const probable = result.probable.length > 0;
  const kind: IntegerKind =
    magnitude === 1n
      ? 'unit'
      : complete && result.factors.length === 1 && (result.factors[0] as PrimePower)[1] === 1
        ? 'prime'
        : 'composite';

  if (!complete) {
    return { value, magnitude, negative, kind, factorization: result, complete, probable, squareRoot, ...empty };
  }

  const factors = result.factors;
  const sigma = divisorSum(factors);
  return {
    value,
    magnitude,
    negative,
    kind,
    factorization: result,
    complete,
    probable,
    squareRoot,
    distinctPrimes: factors.length,
    primeFactors: factors.reduce((sum, [, e]) => sum + e, 0),
    divisorCount: divisorCount(factors),
    divisorSum: sigma,
    totient: totient(factors),
    aliquotSum: sigma - magnitude,
    squarefree: isSquarefree(factors),
    abundance: abundance(magnitude, sigma),
    carmichael: isCarmichael(magnitude, factors),
  };
}
