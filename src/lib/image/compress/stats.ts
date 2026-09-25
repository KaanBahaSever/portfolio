/**
 * Size comparison between the original file and the compressed one. Pure: no DOM.
 * The page formats the numbers (formatters(locale).percent/bytes); this module only decides
 * what they are.
 */

export type SizeOutcome = 'smaller' | 'larger' | 'same';

export interface SizeComparison {
  outcome: SizeOutcome;
  originalBytes: number;
  outputBytes: number;
  /** Bytes saved (negative when the output is larger). */
  savedBytes: number;
  /**
   * The change to display, as a fraction of the original: the reduction when smaller, the
   * increase when larger, 0 when the same. Whole percents are rounded towards the less
   * flattering side (64.9% smaller shows as 64%, 12.1% larger as 13%), so the page never
   * overstates a saving; changes below 1% keep their exact value so they read "<1%".
   */
  fraction: number;
  /** outputBytes / originalBytes, capped at 1: the length of the compressed bar in a chart. */
  barRatio: number;
}

function wholePercent(fraction: number, round: (value: number) => number): number {
  if (fraction < 0.01) return fraction;
  // toFixed first: 0.29 * 100 is 28.999999999999996 in floating point.
  return round(Number((fraction * 100).toFixed(6))) / 100;
}

export function compareSizes(originalBytes: number, outputBytes: number): SizeComparison {
  const original = Math.max(0, originalBytes);
  const output = Math.max(0, outputBytes);
  const savedBytes = original - output;
  const barRatio = original > 0 ? Math.min(1, output / original) : 1;

  if (original === 0 || savedBytes === 0) {
    return { outcome: 'same', originalBytes: original, outputBytes: output, savedBytes, fraction: 0, barRatio };
  }
  if (savedBytes > 0) {
    const reduction = savedBytes / original;
    return {
      outcome: 'smaller',
      originalBytes: original,
      outputBytes: output,
      savedBytes,
      fraction: Math.min(0.99, wholePercent(reduction, Math.floor)),
      barRatio,
    };
  }
  return {
    outcome: 'larger',
    originalBytes: original,
    outputBytes: output,
    savedBytes,
    fraction: wholePercent(-savedBytes / original, Math.ceil),
    barRatio,
  };
}
