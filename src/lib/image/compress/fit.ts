/**
 * Output size maths: the user's maximum dimension, the device's canvas limits and the
 * encoder's own limit, applied together. Pure: no DOM. Images are never enlarged.
 */

/**
 * iOS/iPadOS Safari refuses canvases above 16,777,216 pixels (4096 × 4096): drawing into a
 * larger one silently produces nothing. Phones and tablets get this limit in general, since
 * a canvas this size already takes 64 MB.
 */
export const MOBILE_MAX_CANVAS_AREA = 16_777_216;
/** Desktop browsers allow far more; this keeps one canvas at 400 MB at most. */
export const DESKTOP_MAX_CANVAS_AREA = 100_000_000;
/** The per-side limit every current engine supports. */
export const MAX_CANVAS_SIDE = 16_384;
/** libwebp's limit (WEBP_MAX_DIMENSION); larger canvases come back as PNG instead. */
export const WEBP_MAX_SIDE = 16_383;

export interface FitLimits {
  /** The user's "maximum size" (longest side), or null for none. */
  maxLongSide: number | null;
  /** Largest canvas area in pixels on this device. */
  maxArea: number;
  /** Largest canvas side on this device. */
  maxSide: number;
  /** Largest side the output format allows (WebP), when that is below maxSide. */
  encoderMaxSide?: number;
}

/**
 * Which limit set the output size: the user's choice, the device canvas (area or side), or
 * the encoder (WebP side limit). 'none' when the original size fits.
 */
export type FitReason = 'none' | 'max-dimension' | 'canvas' | 'encoder';

export interface FitResult {
  width: number;
  height: number;
  reason: FitReason;
}

interface Candidate {
  scale: number;
  reason: Exclude<FitReason, 'none'>;
  /** For side limits: the exact long side to land on. */
  side?: number;
}

/**
 * Scales width × height down uniformly until every limit holds, rounding to whole pixels
 * without ever exceeding a limit. The reason is the tightest limit, the one that set the
 * size; on a tie the user's own choice wins, since it is what the user asked for.
 */
export function fitSize(width: number, height: number, limits: FitLimits): FitResult {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const long = Math.max(w, h);

  const candidates: Candidate[] = [];
  if (limits.maxLongSide) {
    candidates.push({ scale: limits.maxLongSide / long, reason: 'max-dimension', side: limits.maxLongSide });
  }
  const encoderSide = limits.encoderMaxSide ?? Infinity;
  if (encoderSide < limits.maxSide) {
    candidates.push({ scale: encoderSide / long, reason: 'encoder', side: encoderSide });
  } else {
    candidates.push({ scale: limits.maxSide / long, reason: 'canvas', side: limits.maxSide });
  }
  candidates.push({ scale: Math.sqrt(limits.maxArea / (w * h)), reason: 'canvas' });

  // Stable sort: on equal scales the earlier candidate (the user's choice) stays first.
  const tightest = candidates.filter((c) => c.scale < 1).sort((a, b) => a.scale - b.scale)[0];
  if (!tightest) return { width: w, height: h, reason: 'none' };

  let outW: number;
  let outH: number;
  if (tightest.side !== undefined) {
    // A side limit: the long side lands exactly on it (w * scale could give 1919.999…).
    const short = Math.max(1, Math.round((Math.min(w, h) * tightest.side) / long));
    [outW, outH] = w >= h ? [tightest.side, short] : [short, tightest.side];
  } else {
    outW = Math.max(1, Math.floor(w * tightest.scale));
    outH = Math.max(1, Math.floor(h * tightest.scale));
  }
  // Rounding the short side up may cross the area limit by a row: take pixels off the long side.
  while (outW * outH > limits.maxArea && Math.max(outW, outH) > 1) {
    if (outW >= outH) outW -= 1;
    else outH -= 1;
  }
  return { width: outW, height: outH, reason: tightest.reason };
}

/** The canvas limits for this kind of device. */
export function canvasLimits(mobile: boolean): Pick<FitLimits, 'maxArea' | 'maxSide'> {
  return { maxArea: mobile ? MOBILE_MAX_CANVAS_AREA : DESKTOP_MAX_CANVAS_AREA, maxSide: MAX_CANVAS_SIDE };
}

/**
 * Largest image decoded at all, in pixels. Decoding needs 4 bytes per pixel before anything
 * is scaled down, so a 200 MP photo takes 800 MB: on a phone that reloads the tab instead of
 * failing cleanly. 64 MP still covers 48 MP phone cameras.
 */
export const MOBILE_MAX_DECODE_PIXELS = 64_000_000;
export const DESKTOP_MAX_DECODE_PIXELS = 250_000_000;

/** Whether an image of this stored size may be decoded on this kind of device. */
export function canDecode(width: number, height: number, mobile: boolean): boolean {
  return width * height <= (mobile ? MOBILE_MAX_DECODE_PIXELS : DESKTOP_MAX_DECODE_PIXELS);
}
