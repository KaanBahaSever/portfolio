/**
 * What to tell the user about a loaded PDF and about a finished run. Pure: no DOM, no text.
 * The functions return codes and numbers; the page controller turns them into sentences in
 * the page's language (src/i18n/tools/pdf-compress.ts), so the decisions are testable here.
 */
import type { CompressStats } from './compress-pdf.ts';
import type { CompressionLevel } from './plan.ts';

/** Results that save less than this (1%) are reported as "nothing to gain". */
export const MIN_USEFUL_SAVING = 0.01;

/**
 * What the chosen level can do with the loaded PDF's images:
 * - 'recompressible': `count` images qualify at `level`;
 * - 'lossless-only': Light finds no JPEG photos, but Balanced would convert `count` losslessly
 *   stored images (Light never converts those);
 * - 'none': no image qualifies, so only the clean-up can shrink the file.
 */
export type ImageOutlook =
  | { kind: 'recompressible'; level: CompressionLevel; count: number }
  | { kind: 'lossless-only'; count: number }
  | { kind: 'none' };

export function imageOutlook(imageCounts: Readonly<Record<CompressionLevel, number>>, level: CompressionLevel): ImageOutlook {
  const count = imageCounts[level];
  if (count > 0) return { kind: 'recompressible', level, count };
  if (level === 'light' && imageCounts.balanced > 0) return { kind: 'lossless-only', count: imageCounts.balanced };
  return { kind: 'none' };
}

/**
 * - 'smaller': saved at least MIN_USEFUL_SAVING, worth downloading;
 * - 'light-skipped': not smaller, because Light skipped lossless images that Balanced converts;
 * - 'optimized': not smaller, nothing (much) left to gain at this level.
 */
export type OutcomeKind = 'smaller' | 'light-skipped' | 'optimized';

/**
 * Advice after a result that is not smaller:
 * - 'convert-lossless': Balanced can convert the images Light skipped;
 * - 'stronger-level': images were tried, and a stronger level trades more quality;
 * - 'text-only': no images qualified; text and vector graphics are already compact.
 */
export type OutcomeHint = 'convert-lossless' | 'stronger-level' | 'text-only';

export interface CompressOutcome {
  kind: OutcomeKind;
  /** Share of the original size saved, from 0 up to below 1; negative when the result is larger. */
  saving: number;
  /** The size change, however small. */
  change: 'smaller' | 'larger' | 'same';
  /** Losslessly stored images Light left alone that Balanced would convert (0 at other levels). */
  skippedAtLight: number;
  hint: OutcomeHint | null;
  /** Offer the new file: when it is smaller, or when the user asked for its metadata to be removed. */
  offerDownload: boolean;
}

/**
 * Judges a finished run. `balancedImageCount` is the number of images Balanced would try on this
 * PDF (from its summary); it only matters when a Light run found no JPEG photos to recompress.
 */
export function compressOutcome(
  originalSize: number,
  resultSize: number,
  stats: Readonly<CompressStats>,
  balancedImageCount: number,
): CompressOutcome {
  const saving = originalSize > 0 ? (originalSize - resultSize) / originalSize : 0;
  const change = resultSize < originalSize ? 'smaller' : resultSize > originalSize ? 'larger' : 'same';
  const skippedAtLight = stats.level === 'light' && stats.imagesConsidered === 0 ? Math.max(0, balancedImageCount) : 0;

  let kind: OutcomeKind;
  let hint: OutcomeHint | null = null;
  if (change === 'smaller' && saving >= MIN_USEFUL_SAVING) {
    kind = 'smaller';
  } else if (skippedAtLight > 0) {
    kind = 'light-skipped';
    hint = 'convert-lossless';
  } else {
    kind = 'optimized';
    if (stats.level !== 'strong' && stats.imagesConsidered > 0) hint = 'stronger-level';
    else if (stats.imagesConsidered === 0) hint = 'text-only';
  }

  return {
    kind,
    saving,
    change,
    skippedAtLight,
    hint,
    offerDownload: kind === 'smaller' || stats.metadataRemoved,
  };
}

/**
 * The saving as shown to the user, as a fraction for a percent formatter that rounds to whole
 * percent: a file that got smaller never shows as 100% smaller (it still has bytes left).
 */
export function displayedSaving(saving: number): number {
  return saving < 1 && Math.round(saving * 100) === 100 ? 0.99 : saving;
}
