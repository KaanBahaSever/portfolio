/**
 * Random password generation and a strength estimate. Pure: no DOM.
 *
 * Randomness comes from the Web Crypto API (crypto.getRandomValues), which exists in browsers
 * and in Node. Every function that draws random numbers also accepts a RandomSource, so tests
 * can pass a deterministic one. Nothing here stores, logs or sends a password.
 */

/**
 * The character sets. Symbols are printable ASCII punctuation that paste safely into most
 * password fields. Left out on purpose:
 * - space: trimmed or rejected by many forms, and invisible when the password is written down;
 * - quotes ' " and backtick `: break naive quoting in shells, CSV, JSON and config files;
 * - backslash \: an escape character almost everywhere;
 * - < > and &: need escaping in HTML and XML, and trip HTML-injection filters on some sites
 *   (ASP.NET request validation rejects "<" followed by a letter and "&#" with a generic error page).
 */
export const CHARSETS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  symbols: '!#$%*+-=?@^_~()[]{}.,:;/|',
} as const;

export type CharsetName = keyof typeof CHARSETS;

/** Fixed order in which the sets are combined into the pool. */
export const CHARSET_NAMES: readonly CharsetName[] = ['lowercase', 'uppercase', 'numbers', 'symbols'];

/**
 * Removed by "Avoid look-alike characters": capital I, lowercase l, digit 1 and the pipe |
 * (a vertical stroke in many fonts), capital O, lowercase o and digit 0 (a ring).
 */
export const LOOK_ALIKES = 'Il1|O0o';

export const MIN_LENGTH = 4;
export const MAX_LENGTH = 128;
export const DEFAULT_LENGTH = 20;

export interface PasswordOptions {
  /** Whole number from MIN_LENGTH to MAX_LENGTH. */
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeLookAlikes: boolean;
  /** Put at least one character of every enabled set in the password. */
  requireEachType: boolean;
}

export const DEFAULT_OPTIONS: Readonly<PasswordOptions> = {
  length: DEFAULT_LENGTH,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
  excludeLookAlikes: false,
  requireEachType: true,
};

/** Fills the array with uniformly random 32-bit values and returns it (like crypto.getRandomValues). */
export type RandomSource = (array: Uint32Array) => Uint32Array;

const UINT32_RANGE = 0x1_0000_0000;
/**
 * Each draw is rejected with probability below 1/2, so a working source practically never needs
 * more than a few tries. The cap only turns a broken source into an error instead of a hang.
 */
const MAX_DRAWS = 1000;

const cryptoRandom: RandomSource = (array) => {
  const webCrypto = globalThis.crypto;
  if (!webCrypto || typeof webCrypto.getRandomValues !== 'function') {
    throw new Error('Secure random numbers are not available: the Web Crypto API is missing');
  }
  return webCrypto.getRandomValues(array as Uint32Array<ArrayBuffer>);
};

/**
 * Unbiased random integer in [0, maxExclusive). Uses rejection sampling: 32-bit values at or above
 * the largest multiple of maxExclusive are drawn again, because `value % maxExclusive` would
 * otherwise favour small results.
 */
export function randomInt(maxExclusive: number, random: RandomSource = cryptoRandom): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32_RANGE) {
    throw new RangeError(`randomInt: maxExclusive must be a whole number from 1 to 2^32, got ${String(maxExclusive)}`);
  }
  if (maxExclusive === 1) return 0;
  const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
  const buffer = new Uint32Array(1);
  for (let draw = 0; draw < MAX_DRAWS; draw++) {
    const value = random(buffer)[0];
    if (value === undefined) throw new Error('randomInt: the random source returned no values');
    if (value < limit) return value % maxExclusive;
  }
  throw new Error('randomInt: the random source keeps returning rejected values');
}

/** Validates the options and returns the enabled sets (in CHARSET_NAMES order), look-alikes removed. */
function enabledSets(options: PasswordOptions): string[] {
  const { length } = options;
  if (!Number.isInteger(length) || length < MIN_LENGTH || length > MAX_LENGTH) {
    throw new RangeError(
      `Password length must be a whole number from ${MIN_LENGTH} to ${MAX_LENGTH}, got ${String(length)}`,
    );
  }
  const sets = CHARSET_NAMES.filter((name) => options[name]).map((name) => {
    const set: string = CHARSETS[name];
    return options.excludeLookAlikes ? [...set].filter((char) => !LOOK_ALIKES.includes(char)).join('') : set;
  });
  if (sets.length === 0) throw new Error('Select at least one character type');
  // Cannot happen with the sets above; guards against future edits to CHARSETS or LOOK_ALIKES.
  if (sets.some((set) => set.length === 0)) throw new Error('A character type has no characters left');
  // Also unreachable today (MIN_LENGTH equals the number of sets), kept so the rule stays explicit.
  if (options.requireEachType && length < sets.length) {
    throw new RangeError(`A ${length}-character password cannot include all ${sets.length} selected types`);
  }
  return sets;
}

/** Every character the password can contain with these options. Throws for invalid options. */
export function characterPool(options: PasswordOptions): string {
  return enabledSets(options).join('');
}

function pickFrom(chars: string, random: RandomSource): string {
  return chars.charAt(randomInt(chars.length, random));
}

/**
 * Generates a password. Every character comes from the pool (the enabled sets, minus look-alikes
 * when requested). With requireEachType one character is first taken from each enabled set, the
 * rest is filled from the pool, and a Fisher–Yates shuffle puts the required characters at random
 * positions.
 */
export function generatePassword(options: PasswordOptions, random: RandomSource = cryptoRandom): string {
  const sets = enabledSets(options);
  const pool = sets.join('');
  const chars: string[] = [];

  if (options.requireEachType) {
    for (const set of sets) chars.push(pickFrom(set, random));
  }
  while (chars.length < options.length) chars.push(pickFrom(pool, random));

  if (options.requireEachType) {
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(i + 1, random);
      const swap = chars[i]!;
      chars[i] = chars[j]!;
      chars[j] = swap;
    }
  }
  return chars.join('');
}

/**
 * Entropy estimate in bits: length × log2(pool size), exact for a password drawn uniformly from
 * the pool. requireEachType rules out the passwords that miss a selected type, which lowers the
 * true figure slightly: a fraction of a bit at typical lengths (12+ characters), a few bits only
 * near the 4-character minimum, where the estimate is "Very weak" anyway. Throws for invalid options.
 */
export function entropyBits(options: PasswordOptions): number {
  return options.length * Math.log2(characterPool(options).length);
}

export type StrengthScore = 0 | 1 | 2 | 3 | 4;

/**
 * Strength levels by score, as stable codes. The page turns them into words from its message
 * catalogue (src/i18n/tools/password-generator.ts), so this module stays language-free.
 */
export const STRENGTH_LEVELS = ['very-weak', 'weak', 'fair', 'strong', 'very-strong'] as const;
export type StrengthLevel = (typeof STRENGTH_LEVELS)[number];

export interface Strength {
  score: StrengthScore;
  level: StrengthLevel;
}

/**
 * Maps entropy bits to a score. Rough guide for random passwords facing offline guessing at
 * billions of guesses per second:
 * - under 40 bits: 0, very weak (found in minutes or less);
 * - 40 to under 60: 1, weak (hours to days);
 * - 60 to under 80: 2, fair (years for a single machine, much less for well-funded attackers);
 * - 80 to under 100: 3, strong (beyond practical brute force today);
 * - 100 and above: 4, very strong (a comfortable margin for the future).
 * NaN counts as 0.
 */
export function strength(bits: number): Strength {
  const score: StrengthScore = !(bits >= 40) ? 0 : bits < 60 ? 1 : bits < 80 ? 2 : bits < 100 ? 3 : 4;
  return { score, level: STRENGTH_LEVELS[score] };
}

/** Which set a character belongs to (for colouring). Characters outside every set count as symbols. */
export function characterKind(char: string): CharsetName {
  for (const name of CHARSET_NAMES) {
    if (char.length === 1 && CHARSETS[name].includes(char)) return name;
  }
  return 'symbols';
}
