/**
 * Small helpers shared by the fusion post's charts: chart layouts (a compact one for phones and a
 * wide one from sm up, as in the Battleship post), scales and powers of ten written with
 * superscripts.
 */

export interface Layout {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  font: number;
}

export interface Scale {
  (value: number): number;
}

/** A linear map from [d0, d1] onto [r0, r1]. */
export function linear(d0: number, d1: number, r0: number, r1: number): Scale {
  return (value) => r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
}

/** A logarithmic map from [d0, d1] (both positive) onto [r0, r1]. */
export function logarithmic(d0: number, d1: number, r0: number, r1: number): Scale {
  const l0 = Math.log10(d0);
  const l1 = Math.log10(d1);
  return (value) => r0 + ((Math.log10(value) - l0) / (l1 - l0)) * (r1 - r0);
}

const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

/** 10 to an integer power, e.g. power(-22) → "10⁻²²". */
export function power(exponent: number): string {
  return `10${String(exponent)
    .split('')
    .map((c) => SUPERSCRIPT[c] ?? c)
    .join('')}`;
}

/** An exponent for a raised tspan, with a true minus sign: −22. */
export function exponent(value: number): string {
  return String(value).replace('-', '−');
}

/**
 * A number in scientific notation with a locale's decimal comma or point:
 * scientific(1.136e-22, ',') → "1,1 × 10⁻²²".
 */
export function scientific(value: number, decimal: string, digits = 1): string {
  const exponent = Math.floor(Math.log10(value));
  let mantissa = Number((value / 10 ** exponent).toFixed(digits));
  let e = exponent;
  if (mantissa >= 10) {
    mantissa /= 10;
    e += 1;
  }
  return `${mantissa.toFixed(digits).replace('.', decimal)} × ${power(e)}`;
}

/** Path data through points, rounded to tenths. */
export function polyline(points: readonly (readonly [number, number])[]): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
}
