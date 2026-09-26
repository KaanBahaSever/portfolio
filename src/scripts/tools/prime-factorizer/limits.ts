/**
 * The factorizer's limits, shared by the component (hint text), the page (tips) and the
 * controller. Pure constants, so tests and .astro files can import them.
 */

/**
 * Most significant digits accepted. Up to 40 digits (≈ 133 bits) trial division, Miller–Rabin
 * and Pollard's rho finish in milliseconds for most numbers; beyond that, more and more inputs
 * would hit the time limit without an answer.
 */
export const MAX_DIGITS = 40;

/** Time box of the first search, and of each "search longer" run after it. */
export const TIME_LIMIT_MS = 10_000;
export const EXTRA_TIME_MS = 30_000;

/** Divisors listed before "Show all", and the most ever listed (the list is a DOM element each). */
export const DIVISOR_PREVIEW = 60;
export const DIVISOR_CAP = 10_000;

/** A search shorter than this never shows the progress row, so quick results do not flicker. */
export const PROGRESS_DELAY_MS = 200;
