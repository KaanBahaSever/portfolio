/**
 * EXIF orientation math. Pure: no DOM, runs under Node.
 *
 * Ground truth (EXIF 2.3) - where the stored image's row 0 / column 0 end up
 * when the image is displayed upright:
 *   1: row0 top,    col0 left      5: row0 left,  col0 top
 *   2: row0 top,    col0 right     6: row0 right, col0 top
 *   3: row0 bottom, col0 right     7: row0 right, col0 bottom
 *   4: row0 bottom, col0 left      8: row0 left,  col0 bottom
 */

export type Orientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** [a, b, c, d, e, f] as used by the PDF `cm` operator and CanvasRenderingContext2D.setTransform. */
export type Matrix = [number, number, number, number, number, number];

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function normalizeOrientation(n: unknown): Orientation {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 8 ? (n as Orientation) : 1;
}

/** True when the orientation swaps width and height (transpose / rotate 90 / transverse / rotate 270). */
export function swapsDimensions(o: Orientation): boolean {
  return o >= 5;
}

/** Displayed (upright) size of a stored w x h image with orientation o. */
export function orientedSize(width: number, height: number, o: Orientation): { width: number; height: number } {
  return swapsDimensions(o) ? { width: height, height: width } : { width, height };
}

// Avoid "-0" in serialized output.
function clean(m: Matrix): Matrix {
  return m.map((v) => (v === 0 ? 0 : v)) as Matrix;
}

/**
 * PDF `cm` matrix so that `q <m> cm /Im Do Q` draws the image XObject upright,
 * exactly filling `rect` (displayed/oriented space, PDF user space with the
 * origin at the bottom-left).
 *
 * PDF image space is the unit square; the stored image's first row is at
 * v = 1 (top) and its first column at u = 0. The matrix maps
 * (u, v) -> (a*u + c*v + e, b*u + d*v + f), so:
 *   (e, f) = where the stored bottom-left corner lands,
 *   (a, b) = stored bottom-right - stored bottom-left,
 *   (c, d) = stored top-left     - stored bottom-left.
 */
export function orientationMatrix(o: Orientation, rect: Rect): Matrix {
  const { x, y, width: w, height: h } = rect;
  switch (o) {
    case 1: // BL->BL, BR->BR, TL->TL
      return clean([w, 0, 0, h, x, y]);
    case 2: // BL->BR, BR->BL, TL->TR
      return clean([-w, 0, 0, h, x + w, y]);
    case 3: // BL->TR, BR->TL, TL->BR
      return clean([-w, 0, 0, -h, x + w, y + h]);
    case 4: // BL->TL, BR->TR, TL->BL
      return clean([w, 0, 0, -h, x, y + h]);
    case 5: // BL->TR, BR->BR, TL->TL
      return clean([0, -h, -w, 0, x + w, y + h]);
    case 6: // BL->TL, BR->BL, TL->TR
      return clean([0, -h, w, 0, x, y + h]);
    case 7: // BL->BL, BR->TL, TL->BR
      return clean([0, h, w, 0, x, y]);
    case 8: // BL->BR, BR->TR, TL->BL
      return clean([0, h, -w, 0, x + w, y]);
  }
}

/**
 * Canvas equivalent (origin top-left, y down). After
 * `ctx.setTransform(...orientationCanvasTransform(o, displayW, displayH))`,
 * `ctx.drawImage(source, 0, 0, drawW, drawH)` renders the stored image upright,
 * filling a displayW x displayH canvas, where drawW x drawH is the stored
 * (unrotated) size at the target scale - see storedDrawSize().
 *
 * The matrix maps source point (px, py) -> (a*px + c*py + e, b*px + d*py + f), so:
 *   (e, f)          = where the stored top-left corner lands,
 *   (a, b) * drawW  = stored top-right   - stored top-left,
 *   (c, d) * drawH  = stored bottom-left - stored top-left.
 */
export function orientationCanvasTransform(o: Orientation, displayW: number, displayH: number): Matrix {
  const W = displayW;
  const H = displayH;
  switch (o) {
    case 1:
      return clean([1, 0, 0, 1, 0, 0]);
    case 2: // TL->TR, TR->TL, BL->BR
      return clean([-1, 0, 0, 1, W, 0]);
    case 3: // TL->BR, TR->BL, BL->TR
      return clean([-1, 0, 0, -1, W, H]);
    case 4: // TL->BL, TR->BR, BL->TL
      return clean([1, 0, 0, -1, 0, H]);
    case 5: // TL->TL, TR->BL, BL->TR
      return clean([0, 1, 1, 0, 0, 0]);
    case 6: // TL->TR, TR->BR, BL->TL
      return clean([0, 1, -1, 0, W, 0]);
    case 7: // TL->BR, TR->TR, BL->BL
      return clean([0, -1, -1, 0, W, H]);
    case 8: // TL->BL, TR->TL, BL->BR
      return clean([0, -1, 1, 0, 0, H]);
  }
}

/** Size to pass to drawImage (stored orientation) for a displayW x displayH upright target. */
export function storedDrawSize(o: Orientation, displayW: number, displayH: number): { width: number; height: number } {
  return swapsDimensions(o) ? { width: displayH, height: displayW } : { width: displayW, height: displayH };
}
