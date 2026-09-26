/**
 * Small formatting helpers shared by the figures (build time) and the density lab (browser).
 * Pure: no DOM, no `astro:*`.
 */
import type { Formatters } from '../../../../i18n/format.ts';

/**
 * Splits a density value into base-w digits, lowest first: digit k counts the placements through
 * the cell that cover k unresolved hits. Every digit is below w because no cell lies on more than
 * 2·ΣL placements (L horizontal and L vertical ones per ship), which is why the Hard computer
 * ranks cells by the number of hits covered first and by the count second.
 */
export function weightDigits(value: number, weight: number): number[] {
  const digits: number[] = [];
  let rest = Math.round(value);
  // With no ship afloat the weight is 1, and base 1 has no digits: keep the value whole.
  if (weight < 2) return rest > 0 ? [rest] : [];
  while (rest > 0) {
    digits.push(rest % weight);
    rest = Math.floor(rest / weight);
  }
  return digits;
}

const SUPERSCRIPTS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

function superscript(n: number): string {
  return [...String(n)].map((digit) => SUPERSCRIPTS[Number(digit)] ?? digit).join('');
}

/**
 * A density written in base w, highest digit first: [22, 12] with w = 35 → "12 · 35 + 22", and
 * [21, 5, 7] → "7 · 35² + 5 · 35 + 21". Zero digits are left out; zero itself is "0".
 */
export function weightFormula(digits: readonly number[], weight: number, f: Formatters): string {
  const terms: string[] = [];
  for (let k = digits.length - 1; k >= 0; k--) {
    const digit = digits[k] ?? 0;
    if (digit === 0) continue;
    if (k === 0) terms.push(f.number(digit));
    else terms.push(`${f.number(digit)} · ${f.number(weight)}${k > 1 ? superscript(k) : ''}`);
  }
  return terms.length > 0 ? terms.join(' + ') : f.number(0);
}
