/**
 * Compression levels and image size planning. Pure: no DOM, runs under Node.
 */

export type CompressionLevel = 'light' | 'balanced' | 'strong';

export interface LevelSettings {
  /** Longest image side in pixels after compression. Images are never upscaled. */
  maxDimension: number;
  /** JPEG quality for the browser encoder (canvas.toBlob), 0–1. */
  jpegQuality: number;
  /** Also turn losslessly stored images (Flate and similar) into JPEG. */
  convertFlate: boolean;
}

/**
 * Tuning notes:
 * - Sizes are in pixels, not DPI (the page size an image is drawn at is not analysed in v1).
 *   An A4 scan at 300 DPI is about 2480 x 3508 px: Light keeps ~200 DPI, Balanced ~150 DPI
 *   (still comfortable for reading and printing text), Strong ~100 DPI (screen reading).
 * - Light never converts lossless images: those are often screenshots, diagrams or line
 *   art where JPEG artefacts are visible. Balanced and Strong do, because in scans and
 *   photos stored losslessly that is where most of the size is.
 * - Browser JPEG encoders map quality differently, so the steps are deliberately wide.
 */
export const LEVELS: Readonly<Record<CompressionLevel, Readonly<LevelSettings>>> = {
  light: { maxDimension: 2400, jpegQuality: 0.82, convertFlate: false },
  balanced: { maxDimension: 1800, jpegQuality: 0.7, convertFlate: true },
  strong: { maxDimension: 1200, jpegQuality: 0.55, convertFlate: true },
};

export const COMPRESSION_LEVELS: readonly CompressionLevel[] = ['light', 'balanced', 'strong'];
export const DEFAULT_LEVEL: CompressionLevel = 'balanced';

export function isCompressionLevel(value: unknown): value is CompressionLevel {
  return typeof value === 'string' && (COMPRESSION_LEVELS as readonly string[]).includes(value);
}

/** A re-encoded image replaces the original only when it is at least this much smaller. */
export const MIN_IMAGE_SAVING = 0.1;

/** Largest encoded size (in bytes) that still counts as a worthwhile replacement. */
export function maxReplacementBytes(originalBytes: number): number {
  return Math.floor(originalBytes * (1 - MIN_IMAGE_SAVING));
}

/** iOS Safari refuses canvases above 16,777,216 pixels (4096 x 4096). */
export const MAX_CANVAS_AREA = 16_777_216;
/** Common per-side canvas limit (Chrome, Firefox, Safari). */
export const MAX_CANVAS_SIDE = 16_384;

export interface TargetSize {
  width: number;
  height: number;
  /** False when the image keeps its pixel size. */
  resized: boolean;
}

/**
 * Pixel size an image is re-encoded at: the longest side at most `maxDimension`, within
 * canvas limits, aspect ratio kept (rounded), never upscaled, never below 1 px.
 */
export function targetImageSize(width: number, height: number, maxDimension: number): TargetSize {
  if (!(width > 0 && height > 0)) throw new RangeError('Image dimensions must be positive');
  const longSide = Math.max(width, height);
  const limit = Number.isFinite(maxDimension) && maxDimension > 0 ? maxDimension : Infinity;
  const scale = Math.min(1, limit / longSide, MAX_CANVAS_SIDE / longSide, Math.sqrt(MAX_CANVAS_AREA / (width * height)));
  if (scale >= 1) return { width, height, resized: false };
  let targetWidth = Math.max(1, Math.round(width * scale));
  let targetHeight = Math.max(1, Math.round(height * scale));
  // Rounding up may cross a limit by a pixel; step back when it does.
  const cap = Math.min(limit, MAX_CANVAS_SIDE);
  if (targetWidth > cap) targetWidth = Math.floor(cap);
  if (targetHeight > cap) targetHeight = Math.floor(cap);
  while (targetWidth * targetHeight > MAX_CANVAS_AREA) {
    if (targetWidth >= targetHeight) targetWidth--;
    else targetHeight--;
  }
  return { width: targetWidth, height: targetHeight, resized: targetWidth !== width || targetHeight !== height };
}

/** True when a size fits the canvas limits without resizing. */
export function fitsCanvas(width: number, height: number): boolean {
  return width <= MAX_CANVAS_SIDE && height <= MAX_CANVAS_SIDE && width * height <= MAX_CANVAS_AREA;
}
