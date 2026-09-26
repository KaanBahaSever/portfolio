/**
 * Turns factorizer results into text: grouped numbers, the spoken form for screen readers
 * ("2 to the power 3 times 5" / "2 üzeri 3 çarpı 5"), the plain-text form the Copy buttons
 * write, and the τ(n) formula. Pure (no DOM), so the tests cover it.
 */
import type { Locale } from '../../../i18n/config.ts';
import { formatters } from '../../../i18n/format.ts';
import type { PrimeFactorizerMessages } from '../../../i18n/tools/prime-factorizer.ts';
import { groupDigits } from '../../../lib/math/digits.ts';
import type { Factorization } from '../../../lib/math/factorize.ts';

/** The locale's thousands separator, as Intl writes it ("," in English, "." in Turkish). */
export function groupSeparator(locale: Locale): ',' | '.' {
  return formatters(locale).number(1_000_000).charAt(1) === '.' ? '.' : ',';
}

/** A BigInt with the locale's digit grouping: "6,700,417" / "6.700.417". */
export function formatBig(value: bigint, locale: Locale): string {
  return groupDigits(value, groupSeparator(locale));
}

/** One factor of the displayed product. */
export interface Term {
  base: bigint;
  exponent: number;
  /** 'probable': prime by the BPSW test only; 'unfactored': composite, not split in time. */
  kind: 'prime' | 'probable' | 'unfactored';
}

/** The product in display order: primes ascending, then unsplit composites (repeats as powers). */
export function factorTerms(result: Factorization): Term[] {
  const probable = new Set(result.probable);
  const terms: Term[] = result.factors.map(([base, exponent]) => ({
    base,
    exponent,
    kind: probable.has(base) ? 'probable' : 'prime',
  }));
  for (const base of result.unfactored) {
    const last = terms.at(-1);
    if (last && last.kind === 'unfactored' && last.base === base) last.exponent++;
    else terms.push({ base, exponent: 1, kind: 'unfactored' });
  }
  return terms;
}

/** Plain text for the clipboard, readable by calculators and CAS: "-1 * 2^3 * 3^2 * 5". */
export function copyText(terms: readonly Term[], negative: boolean): string {
  const parts = terms.map((t) => (t.exponent > 1 ? `${t.base}^${t.exponent}` : `${t.base}`));
  if (negative) parts.unshift('-1');
  return parts.join(' * ');
}

/** The product read aloud, in the page language. */
export function spokenText(
  terms: readonly Term[],
  negative: boolean,
  locale: Locale,
  spoken: PrimeFactorizerMessages['result']['spoken'],
): string {
  const words = terms.map((t) => {
    const base = formatBig(t.base, locale);
    const marked =
      t.kind === 'probable' ? spoken.probable(base) : t.kind === 'unfactored' ? spoken.unfactored(base) : base;
    return t.exponent > 1 ? spoken.power(marked, formatters(locale).number(t.exponent)) : marked;
  });
  if (negative) words.unshift(spoken.minusOne);
  return words.join(` ${spoken.times} `);
}

/** τ(n) worked out: "(3 + 1)(2 + 1)(1 + 1)"; null past `maxTerms` distinct primes (too long to help). */
export function tauFormula(result: Factorization, maxTerms = 6): string | null {
  if (result.factors.length === 0 || result.factors.length > maxTerms) return null;
  return result.factors.map(([, e]) => `(${e} + 1)`).join('');
}

/** Divisors for the clipboard: "1, 2, 3, 4" (no digit grouping, so the commas stay unambiguous). */
export function divisorsCopyText(divisors: readonly bigint[]): string {
  return divisors.map(String).join(', ');
}

/** Seconds with one decimal: "2.4 s" / "2,4 sn". */
export function formatSeconds(ms: number, locale: Locale, seconds: PrimeFactorizerMessages['status']['seconds']): string {
  const value = formatters(locale).number(ms / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return seconds(value);
}
