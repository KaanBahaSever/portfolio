/**
 * Integer factorization (pure, BigInt throughout): trial division by the primes below 65,536,
 * then, for each cofactor that is still composite, a perfect-power check, a short run of
 * Fermat's method (factors close to √m) and Pollard's rho in Brent's variant.
 *
 * Rho finds a prime factor p after about √p steps, so a cofactor whose smallest prime factor
 * has 20 digits would need ~10¹⁰ steps. The search can therefore be stopped from outside
 * (`checkpoint`): the result then lists the cofactors it could not split, and
 * continueFactorization() picks them up later.
 *
 * Results are data, never prose: callers turn them into words.
 */
import { abs, exactSqrt, gcd, isqrt, perfectPower } from './bigint.ts';
import { SMALL_PRIMES, TRIAL_DIVISION_BOUND, primalityOfRoughNumber } from './primality.ts';

/** p^e as a [prime, exponent] pair. */
export type PrimePower = readonly [prime: bigint, exponent: number];

export interface Factorization {
  /** The prime powers found, sorted by prime (the canonical form when `unfactored` is empty). */
  factors: PrimePower[];
  /**
   * Composite cofactors the search was stopped before splitting, ascending (with repeats when
   * the same cofactor divides more than once). Empty when the factorization is complete.
   */
  unfactored: bigint[];
  /**
   * Prime factors of 25 digits or more, whose primality rests on the Baillie–PSW probable-prime
   * test rather than a proof (see primality.ts). Ascending.
   */
  probable: bigint[];
}

/** What the search is doing, passed to `checkpoint` between batches of work. */
export interface FactorProgress {
  /** Prime factors found so far, counted with multiplicity. */
  readonly found: number;
  /** Decimal digits of the cofactor being searched now. */
  readonly digits: number;
  /** Composite cofactors still waiting, the current one included. */
  readonly pending: number;
  /** Rho steps taken so far, over all cofactors. */
  readonly steps: number;
}

export interface FactorOptions {
  /**
   * Called every few hundred steps of work; return true to stop. The result then lists the
   * cofactors not split yet in `unfactored`.
   */
  checkpoint?: (progress: FactorProgress) => boolean;
}

/** Steps of Brent's rho between gcds and between checkpoints. */
const RHO_BATCH = 128;
/** Steps of Fermat's method tried on each composite cofactor before rho. */
const FERMAT_STEPS = 4096;

class Stopped extends Error {
  constructor() {
    super('Factorization stopped');
    this.name = 'Stopped';
  }
}

interface Search {
  readonly checkpoint: FactorOptions['checkpoint'];
  readonly progress: { found: number; digits: number; pending: number; steps: number };
}

function check(search: Search): void {
  if (search.checkpoint?.(search.progress)) throw new Stopped();
}

/**
 * Fermat's method: m = a² − b² = (a − b)(a + b), trying a = ⌈√m⌉, ⌈√m⌉ + 1, … It finds a
 * factorization quickly when m has two factors close to √m, which rho would find slowly.
 * m must be odd and not a perfect square. Returns a proper factor, or null.
 */
function fermat(m: bigint, steps: number): bigint | null {
  let a = isqrt(m);
  if (a * a < m) a += 1n;
  let b2 = a * a - m;
  for (let i = 0; i < steps; i++) {
    const b = exactSqrt(b2);
    if (b !== null) {
      const factor = a - b;
      return factor > 1n && factor < m ? factor : null;
    }
    // (a + 1)² − m = a² − m + 2a + 1
    b2 += 2n * a + 1n;
    a += 1n;
  }
  return null;
}

/**
 * Pollard's rho with Brent's cycle detection and batched gcds: iterate y ← y² + c (mod m),
 * multiply |x − y| for RHO_BATCH steps, then take one gcd with m. Returns a proper factor,
 * or null when this c fails (the gcd reached m). m must be composite and not a prime power.
 */
function brentRho(m: bigint, c: bigint, search: Search): bigint | null {
  const f = (v: bigint) => (v * v + c) % m;
  let y = 2n;
  let x = y;
  let ys = y;
  let q = 1n;
  let g = 1n;
  let r = 1;
  while (g === 1n) {
    x = y;
    for (let i = 0; i < r; i++) y = f(y);
    let k = 0;
    while (k < r && g === 1n) {
      ys = y;
      const batch = Math.min(RHO_BATCH, r - k);
      for (let i = 0; i < batch; i++) {
        y = f(y);
        q = (q * (x > y ? x - y : y - x)) % m;
      }
      g = gcd(q, m);
      k += batch;
      search.progress.steps += batch;
      check(search);
    }
    r *= 2;
  }
  if (g === m) {
    // The batch overshot: replay it one step at a time from the saved point.
    do {
      ys = f(ys);
      g = gcd(x > ys ? x - ys : ys - x, m);
    } while (g === 1n);
  }
  return g === m ? null : g;
}

/** A proper factor of the composite, non-power m (odd, no factor below 65,536). */
function splitComposite(m: bigint, search: Search): bigint {
  const close = fermat(m, FERMAT_STEPS);
  if (close !== null) return close;
  for (let c = 1n; ; c++) {
    const factor = brentRho(m, c, search);
    if (factor !== null) return factor;
  }
}

/** Accumulates p^e found anywhere in the search. */
function addPrime(primes: Map<bigint, number>, p: bigint, exponent: number): void {
  primes.set(p, (primes.get(p) ?? 0) + exponent);
}

function toFactorization(primes: Map<bigint, number>, unfactored: bigint[], probable: Set<bigint>): Factorization {
  const ascending = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);
  return {
    factors: [...primes.entries()].sort(([a], [b]) => ascending(a, b)),
    unfactored: unfactored.sort(ascending),
    probable: [...probable].sort(ascending),
  };
}

/**
 * Factors the product of `values` (each ≥ 1) as far as possible. Used for a fresh number and
 * for the cofactors left over by an earlier, stopped search.
 */
function factorValues(values: readonly bigint[], options: FactorOptions): Factorization {
  const primes = new Map<bigint, number>();
  const probable = new Set<bigint>();
  const search: Search = {
    checkpoint: options.checkpoint,
    progress: { found: 0, digits: 0, pending: 0, steps: 0 },
  };

  // 1. Trial division by the primes below 65,536.
  const work: Array<[value: bigint, multiplicity: number]> = [];
  for (const value of values) {
    let m = abs(value);
    if (m === 0n) throw new RangeError('0 has no prime factorization');
    for (const p of SMALL_PRIMES) {
      if (p * p > m) break;
      if (m % p !== 0n) continue;
      let e = 0;
      do {
        m /= p;
        e++;
      } while (m % p === 0n);
      addPrime(primes, p, e);
      search.progress.found += e;
    }
    if (m > 1n) work.push([m, 1]);
  }

  // 2. Every cofactor left has no prime factor below 65,536: test it, then split it. After a
  //    stop, the cheap steps (primality, perfect powers) still run on what is left, so only
  //    genuinely composite cofactors end up in `unfactored`.
  const unfactored: bigint[] = [];
  const pending = work;
  let stopped = false;
  while (pending.length > 0) {
    const [m, multiplicity] = pending.pop() as [bigint, number];
    if (m === 1n) continue;
    if (m < TRIAL_DIVISION_BOUND) {
      addPrime(primes, m, multiplicity);
      search.progress.found += multiplicity;
      continue;
    }
    const verdict = primalityOfRoughNumber(m);
    if (verdict !== 'composite') {
      addPrime(primes, m, multiplicity);
      if (verdict === 'probable-prime') probable.add(m);
      search.progress.found += multiplicity;
      continue;
    }
    const power = perfectPower(m);
    if (power.exponent > 1) {
      pending.push([power.base, multiplicity * power.exponent]);
      continue;
    }
    if (stopped) {
      for (let i = 0; i < multiplicity; i++) unfactored.push(m);
      continue;
    }
    search.progress.digits = m.toString().length;
    search.progress.pending = pending.length + 1;
    try {
      check(search);
      const d = splitComposite(m, search);
      // Both parts keep the multiplicity; equal primes merge in the map later.
      pending.push([d, multiplicity], [m / d, multiplicity]);
    } catch (error) {
      if (!(error instanceof Stopped)) throw error;
      stopped = true;
      for (let i = 0; i < multiplicity; i++) unfactored.push(m);
    }
  }

  return toFactorization(primes, unfactored, probable);
}

/**
 * The prime factorization of |n| (n ≠ 0; 1 and −1 give an empty product). The sign is the
 * caller's business: −360 is reported as the factorization of 360.
 */
export function factorize(n: bigint, options: FactorOptions = {}): Factorization {
  if (n === 0n) throw new RangeError('0 has no prime factorization');
  return factorValues([n], options);
}

/** Merges prime powers from two lists (exponents of equal primes add up), sorted by prime. */
export function mergePrimePowers(a: readonly PrimePower[], b: readonly PrimePower[]): PrimePower[] {
  const primes = new Map<bigint, number>();
  for (const [p, e] of [...a, ...b]) addPrime(primes, p, e);
  return [...primes.entries()].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
}

/**
 * Combines an earlier, stopped result with the factorization of the cofactors it left over:
 * the prime powers of both, and whatever the second search could not split either.
 */
export function mergeFactorizations(previous: Factorization, continuation: Factorization): Factorization {
  const probable = [...new Set([...previous.probable, ...continuation.probable])].sort((x, y) =>
    x < y ? -1 : x > y ? 1 : 0,
  );
  return {
    factors: mergePrimePowers(previous.factors, continuation.factors),
    unfactored: [...continuation.unfactored],
    probable,
  };
}

/**
 * Carries on with the cofactors an earlier search left in `unfactored`, and merges what it
 * finds into that result.
 */
export function continueFactorization(previous: Factorization, options: FactorOptions = {}): Factorization {
  if (previous.unfactored.length === 0) return previous;
  return mergeFactorizations(previous, factorValues(previous.unfactored, options));
}

/** True when nothing is left to split. */
export function isComplete(result: Factorization): boolean {
  return result.unfactored.length === 0;
}

/** The product ∏ p^e · ∏ unfactored, i.e. |n| again (a consistency check for tests and callers). */
export function productOf(result: Factorization): bigint {
  let product = 1n;
  for (const [p, e] of result.factors) product *= p ** BigInt(e);
  for (const m of result.unfactored) product *= m;
  return product;
}

/** Prime factors with multiplicity, ascending: 360 → [2, 2, 2, 3, 3, 5]. */
export function primeList(factors: readonly PrimePower[]): bigint[] {
  return factors.flatMap(([p, e]) => Array.from({ length: e }, () => p));
}
