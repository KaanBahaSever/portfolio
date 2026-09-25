/**
 * The Image compressor's user settings and their parsing from form values. Pure: no DOM.
 */

/** What the format control offers. 'original' keeps the input format when the browser can write it. */
export const FORMAT_CHOICES = ['original', 'webp', 'jpeg'] as const;
export type FormatChoice = (typeof FORMAT_CHOICES)[number];

export const MIN_QUALITY = 1;
export const MAX_QUALITY = 100;
/** A common starting point for photos: visibly close to the original at a fraction of the size. */
export const DEFAULT_QUALITY = 75;

/** Longest-side limits offered besides "original size" (null). */
export const MAX_DIMENSION_CHOICES = [3840, 2560, 1920, 1280] as const;

export interface CompressSettings {
  /** 1–100; ignored for lossless (PNG) output. */
  quality: number;
  format: FormatChoice;
  /** Longest side in pixels, or null to keep the original size. */
  maxDimension: number | null;
}

export const DEFAULT_SETTINGS: Readonly<CompressSettings> = {
  quality: DEFAULT_QUALITY,
  format: 'original',
  maxDimension: null,
};

export function isFormatChoice(value: unknown): value is FormatChoice {
  return (FORMAT_CHOICES as readonly unknown[]).includes(value);
}

/** Any input (a range value string, NaN, 0, 250.4) → an integer from 1 to 100. */
export function clampQuality(value: unknown): number {
  const number = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(number)) return DEFAULT_QUALITY;
  return Math.min(MAX_QUALITY, Math.max(MIN_QUALITY, Math.round(number)));
}

/** The 0–1 value canvas encoders take. */
export function encoderQuality(quality: number): number {
  return clampQuality(quality) / 100;
}

/** A <select> value → one of MAX_DIMENSION_CHOICES, or null for "original size" and anything unknown. */
export function parseMaxDimension(value: unknown): number | null {
  const number = Number.parseInt(String(value), 10);
  return (MAX_DIMENSION_CHOICES as readonly number[]).includes(number) ? number : null;
}
