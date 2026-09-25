/**
 * Pure helpers for the page grid: keyboard movement, thumbnail scale, placeholder shape and
 * when to ask before rendering previews. No DOM, so tests run them under Node.
 */

/** Pages shown in the grid at most; longer PDFs are split by typing pages (the DOM would get heavy). */
export const MAX_GRID_PAGES = 2000;
/** Previews for more pages than this wait until the person asks for them. */
export const ASK_PREVIEW_PAGES = 500;
/** On touch devices, previews of files larger than this wait until the person asks (two copies live in memory). */
export const ASK_PREVIEW_BYTES_TOUCH = 100 * 1024 * 1024;
/** Upper bound for one thumbnail canvas (pixels): keeps very tall or wide pages cheap. */
export const MAX_THUMBNAIL_PIXELS = 1_500_000;

/**
 * The tile focus moves to for a navigation key, or null when the key doesn't move focus.
 * Arrow keys move by one tile or one row; Home and End go to the first and last page.
 * Movement stops at the edges instead of wrapping.
 */
export function gridTarget(key: string, index: number, count: number, columns: number): number | null {
  if (count < 1) return null;
  const cols = Math.max(1, Math.floor(columns));
  const last = count - 1;
  const clamp = (value: number) => Math.min(last, Math.max(0, value));
  switch (key) {
    case 'ArrowRight':
      return clamp(index + 1);
    case 'ArrowLeft':
      return clamp(index - 1);
    case 'ArrowDown':
      // The last row may be short: stay put rather than jumping to an unrelated column.
      return index + cols <= last ? index + cols : index;
    case 'ArrowUp':
      return index - cols >= 0 ? index - cols : index;
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return null;
  }
}

/** Pages from `a` to `b` inclusive, in either direction, as an ascending list. */
export function pagesBetween(a: number, b: number): number[] {
  const from = Math.min(a, b);
  const to = Math.max(a, b);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/**
 * Width / height of the tiles' sheet, from the first page's size. Extreme shapes are clamped
 * so a receipt-like page 1 doesn't make every tile a sliver; other pages are letterboxed.
 * Falls back to A4 portrait.
 */
export function sheetAspect(size?: { width: number; height: number } | null): number {
  const ratio = size && size.width > 0 && size.height > 0 ? size.width / size.height : NaN;
  if (!Number.isFinite(ratio)) return 1 / Math.SQRT2;
  return Math.min(1.6, Math.max(0.5, ratio));
}

/**
 * Render scale for a thumbnail: the page (in PDF units at scale 1) fits inside the tile's box
 * (CSS pixels), times the device pixel ratio (at most 2), and the canvas stays under `maxPixels`.
 */
export function thumbnailScale(
  pageWidth: number,
  pageHeight: number,
  boxWidth: number,
  boxHeight: number,
  pixelRatio: number,
  maxPixels = MAX_THUMBNAIL_PIXELS,
): number {
  if (!(pageWidth > 0 && pageHeight > 0 && boxWidth > 0 && boxHeight > 0)) return 1;
  const ratio = Math.min(2, Math.max(1, Number.isFinite(pixelRatio) ? pixelRatio : 1));
  let scale = Math.min(boxWidth / pageWidth, boxHeight / pageHeight) * ratio;
  const pixels = pageWidth * scale * (pageHeight * scale);
  if (pixels > maxPixels) scale *= Math.sqrt(maxPixels / pixels);
  return scale;
}

export type PreviewGate = 'show' | 'ask-pages' | 'ask-size' | 'too-many';

/**
 * Whether to render thumbnails at once: 'too-many' when the grid isn't shown at all,
 * 'ask-…' when rendering waits for the person (many pages, or a large file on a touch
 * device, where the preview engine's own copy of the file may exhaust memory).
 */
export function previewGate(pageCount: number, fileSize: number, coarsePointer: boolean): PreviewGate {
  if (pageCount > MAX_GRID_PAGES) return 'too-many';
  if (coarsePointer && fileSize > ASK_PREVIEW_BYTES_TOUCH) return 'ask-size';
  if (pageCount > ASK_PREVIEW_PAGES) return 'ask-pages';
  return 'show';
}
