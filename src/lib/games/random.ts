/**
 * Randomness for the games. Pure: no DOM.
 *
 * Every function that makes a random choice takes an Rng (a function returning a uniform number
 * in [0, 1), like Math.random), so tests can pass a seeded generator and replay whole games
 * deterministically. Browsers seed one generator per game instance with randomSeed().
 */

/** A source of uniform random numbers in [0, 1). */
export type Rng = () => number;

/**
 * mulberry32: a small, fast 32-bit PRNG with a full 2^32 period. Not cryptographic, which is fine
 * for games: the point is reproducible sequences in tests and cheap draws in the browser.
 */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh 32-bit seed from the Web Crypto API (available in browsers and in Node). */
export function randomSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] ?? 0;
}

/** A uniform integer in [0, n). `n` must be a positive integer. */
export function randomInt(rng: Rng, n: number): number {
  if (!Number.isInteger(n) || n <= 0) throw new RangeError(`randomInt: n must be a positive integer, got ${n}`);
  // min() guards against a generator that returns exactly 1.
  return Math.min(n - 1, Math.floor(rng() * n));
}

/** A uniformly chosen element; throws on an empty list (a caller bug, never a game state). */
export function pickOne<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new RangeError('pickOne: empty list');
  return items[randomInt(rng, items.length)] as T;
}
