/**
 * Raw image samples: predictor removal, validation and downscaling.
 * Pure: no DOM, runs under Node (and in the compression Web Worker).
 */

import { undoPngPredictors, undoTiffPredictor2 } from './predictors.ts';

export interface PredictorParams {
  kind: 'none' | 'png' | 'tiff';
  colors: number;
  columns: number;
}

export interface RawLayout {
  width: number;
  height: number;
  /** Components per pixel (1 = gray, 3 = RGB). */
  channels: 1 | 3;
  predictor: PredictorParams;
}

/**
 * Turns the output of the stream filters into exactly width x height x channels samples.
 * Returns null when the data is too short (truncated or inconsistent stream); extra
 * trailing bytes are ignored, as PDF viewers do. `decoded` may be consumed (decoded in
 * place) when `owned` is true.
 */
export function samplesFromDecoded(decoded: Uint8Array, layout: RawLayout, owned: boolean): Uint8Array | null {
  const { width, height, channels, predictor } = layout;
  const expected = width * height * channels;
  let samples: Uint8Array;
  try {
    if (predictor.kind === 'png') {
      samples = undoPngPredictors(decoded, predictor.colors, 8, predictor.columns, { inPlace: owned });
    } else if (predictor.kind === 'tiff') {
      samples = undoTiffPredictor2(decoded, predictor.colors, 8, predictor.columns, { inPlace: owned });
    } else {
      samples = decoded;
    }
  } catch {
    return null;
  }
  if (samples.length < expected) return null;
  return samples.length === expected ? samples : samples.subarray(0, expected);
}

interface AxisWeights {
  /** First source index per target index. */
  start: Int32Array;
  /** Number of source indices per target index. */
  count: Int32Array;
  /** Coverage weights, flattened in target order; each target's weights sum to 1. */
  weights: Float64Array;
  /** Offset of each target's first weight in `weights`. */
  offset: Int32Array;
}

/** Area-average (box) weights mapping `source` samples onto `target` samples along one axis. */
function axisWeights(source: number, target: number): AxisWeights {
  const scale = source / target;
  const start = new Int32Array(target);
  const count = new Int32Array(target);
  const offset = new Int32Array(target);
  const list: number[] = [];
  for (let t = 0; t < target; t++) {
    const from = t * scale;
    const to = Math.min(source, (t + 1) * scale);
    const first = Math.floor(from);
    const last = Math.min(source - 1, Math.ceil(to) - 1);
    start[t] = first;
    offset[t] = list.length;
    let n = 0;
    for (let s = first; s <= last; s++) {
      const coverage = Math.min(to, s + 1) - Math.max(from, s);
      if (coverage <= 0) continue;
      if (n === 0) start[t] = s;
      list.push(coverage / scale);
      n++;
    }
    count[t] = n;
  }
  return { start, count, offset, weights: Float64Array.from(list) };
}

/**
 * Downscales interleaved 8-bit samples with area averaging (every source pixel contributes
 * in proportion to the area it covers), which avoids the aliasing of nearest-neighbour or
 * bilinear sampling at large reduction ratios. Works row by row: extra memory is a few
 * rows, not a second full image. Returns `pixels` itself when the size is unchanged.
 */
export function downscalePixels(
  pixels: Uint8Array,
  width: number,
  height: number,
  channels: number,
  targetWidth: number,
  targetHeight: number,
): Uint8Array {
  if (pixels.length < width * height * channels) throw new RangeError('Pixel data is shorter than its dimensions');
  if (targetWidth > width || targetHeight > height || targetWidth < 1 || targetHeight < 1) {
    throw new RangeError('downscalePixels only reduces the size');
  }
  if (targetWidth === width && targetHeight === height) return pixels;

  const xs = axisWeights(width, targetWidth);
  const ys = axisWeights(height, targetHeight);
  const out = new Uint8Array(targetWidth * targetHeight * channels);
  const row = new Float64Array(targetWidth * channels); // one horizontally reduced source row
  const acc = new Float64Array(targetWidth * channels);

  for (let ty = 0; ty < targetHeight; ty++) {
    acc.fill(0);
    const yOffset = ys.offset[ty]!;
    const yStart = ys.start[ty]!;
    for (let k = 0; k < ys.count[ty]!; k++) {
      const wy = ys.weights[yOffset + k]!;
      const srcRow = (yStart + k) * width;
      // Reduce this source row horizontally, then add it with its vertical weight.
      for (let tx = 0; tx < targetWidth; tx++) {
        const xOffset = xs.offset[tx]!;
        const xStart = xs.start[tx]!;
        const base = tx * channels;
        for (let c = 0; c < channels; c++) row[base + c] = 0;
        for (let j = 0; j < xs.count[tx]!; j++) {
          const wx = xs.weights[xOffset + j]!;
          const src = (srcRow + xStart + j) * channels;
          for (let c = 0; c < channels; c++) row[base + c] += pixels[src + c]! * wx;
        }
      }
      for (let i = 0; i < acc.length; i++) acc[i] += row[i]! * wy;
    }
    const dst = ty * targetWidth * channels;
    for (let i = 0; i < acc.length; i++) {
      const value = Math.round(acc[i]!);
      out[dst + i] = value < 0 ? 0 : value > 255 ? 255 : value;
    }
  }
  return out;
}
