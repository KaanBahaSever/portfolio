/**
 * Digit grouping for BigInts (pure). Intl.NumberFormat can format BigInts, but the site's
 * formatters(locale).number() takes numbers; the page therefore reads the locale's group
 * separator from formatters(locale) and groups BigInt digits with it here.
 */

/** U+2212 MINUS SIGN: the typographic minus used for displayed negative numbers. */
export const MINUS = '−';

/**
 * Groups the digits of `value` in threes from the right: (18446744073709551615n, ',') →
 * "18,446,744,073,709,551,615". Negative values get a typographic minus sign. Like Intl in
 * English and Turkish, four-digit numbers are grouped too ("8,128" / "8.128").
 */
export function groupDigits(value: bigint, separator: string): string {
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString();
  const head = digits.length % 3 || 3;
  let out = digits.slice(0, head);
  for (let i = head; i < digits.length; i += 3) out += separator + digits.slice(i, i + 3);
  return negative ? MINUS + out : out;
}

/**
 * A short label for a long number, keeping both ends: ("18446744073709551615", 10) →
 * "18446…1615" (10 characters). Values that fit are returned unchanged.
 */
export function abbreviateDigits(digits: string, maxLength: number): string {
  if (digits.length <= maxLength) return digits;
  const keep = Math.max(2, maxLength - 1);
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  return `${digits.slice(0, head)}…${digits.slice(digits.length - tail)}`;
}
