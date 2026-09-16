/**
 * Page size / image placement math, in PDF points (1/72 inch). Pure: no DOM.
 */

export const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792],
} as const;

export type PageSizeOption = 'fit' | 'a4' | 'letter';
export type OrientationOption = 'auto' | 'portrait' | 'landscape';
export type MarginOption = 'none' | 'small' | 'large';

export interface PlacementOptions {
  pageSize: PageSizeOption;
  orientation: OrientationOption;
  margin: MarginOption;
}

export interface Placement {
  pageWidth: number;
  pageHeight: number;
  /** Image rectangle in PDF user space (origin bottom-left). */
  x: number;
  y: number;
  width: number;
  height: number;
}

const MM_TO_PT = 72 / 25.4;
/** CSS reference pixel: 96 px per inch -> 0.75 pt per px. */
const PX_TO_PT = 72 / 96;
/** PDF implementation limits for page dimensions (ISO 32000-1, Annex C). */
export const MAX_PAGE_SIDE = 14400;
export const MIN_PAGE_SIDE = 3;

export const MARGINS_PT: Record<MarginOption, number> = {
  none: 0,
  small: 10 * MM_TO_PT,
  large: 20 * MM_TO_PT,
};

function assertDimension(name: string, value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid image ${name}: expected a positive finite number, got ${String(value)}`);
  }
}

/**
 * Computes the page size and the image rectangle for one image.
 * imgW / imgH are DISPLAYED (already oriented) pixel dimensions.
 */
export function computePlacement(imgW: number, imgH: number, opts: PlacementOptions): Placement {
  assertDimension('width', imgW);
  assertDimension('height', imgH);
  const margin = MARGINS_PT[opts.margin];
  if (margin === undefined) throw new Error(`Unknown margin option: ${String(opts.margin)}`);

  if (opts.pageSize === 'fit') {
    let scale = 1;
    let width = imgW * PX_TO_PT;
    let height = imgH * PX_TO_PT;
    let pageWidth = width + 2 * margin;
    let pageHeight = height + 2 * margin;
    const longest = Math.max(pageWidth, pageHeight);
    if (longest > MAX_PAGE_SIDE) scale = MAX_PAGE_SIDE / longest;
    width *= scale;
    height *= scale;
    pageWidth *= scale;
    pageHeight *= scale;
    const scaledMargin = margin * scale;
    let x = scaledMargin;
    let y = scaledMargin;
    // Extremely thin images: grow the page to the minimum and keep the image centered.
    if (pageWidth < MIN_PAGE_SIDE) {
      x += (MIN_PAGE_SIDE - pageWidth) / 2;
      pageWidth = MIN_PAGE_SIDE;
    }
    if (pageHeight < MIN_PAGE_SIDE) {
      y += (MIN_PAGE_SIDE - pageHeight) / 2;
      pageHeight = MIN_PAGE_SIDE;
    }
    return { pageWidth, pageHeight, x, y, width, height };
  }

  const size = PAGE_SIZES[opts.pageSize];
  if (!size) throw new Error(`Unknown page size option: ${String(opts.pageSize)}`);
  let landscape: boolean;
  if (opts.orientation === 'landscape') landscape = true;
  else if (opts.orientation === 'portrait') landscape = false;
  else if (opts.orientation === 'auto') landscape = imgW > imgH;
  else throw new Error(`Unknown orientation option: ${String(opts.orientation)}`);

  const short = Math.min(size[0], size[1]);
  const long = Math.max(size[0], size[1]);
  const pageWidth = landscape ? long : short;
  const pageHeight = landscape ? short : long;
  const boxWidth = pageWidth - 2 * margin;
  const boxHeight = pageHeight - 2 * margin;
  const scale = Math.min(boxWidth / imgW, boxHeight / imgH);
  const width = imgW * scale;
  const height = imgH * scale;
  return {
    pageWidth,
    pageHeight,
    x: margin + (boxWidth - width) / 2,
    y: margin + (boxHeight - height) / 2,
    width,
    height,
  };
}
