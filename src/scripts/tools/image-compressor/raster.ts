/**
 * Drawing and encoding shared by the encode worker (OffscreenCanvas) and the main-thread
 * fallback (<canvas>), so both paths produce identical files. Browser only.
 */

import { fitSize } from '../../../lib/image/compress/fit.ts';
import type { EncodeSpec, RasterFailure } from './types.ts';

/** The part of the 2D context used here; both context types satisfy it. */
export interface Context2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: ImageSmoothingQuality;
  fillRect(x: number, y: number, width: number, height: number): void;
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData;
}

export interface Surface {
  readonly width: number;
  readonly height: number;
  /** The canvas itself, to draw into another surface. */
  readonly image: CanvasImageSource;
  readonly context: Context2D;
  encode(mime: string, quality: number | null): Promise<Blob>;
  /** Frees the pixel memory now: Safari otherwise keeps it until garbage collection. */
  release(): void;
}

export interface SurfaceOptions {
  /** False for opaque output: the encoder can skip the alpha channel. */
  alpha?: boolean;
  willReadFrequently?: boolean;
}

export type SurfaceFactory = (width: number, height: number, options?: SurfaceOptions) => Surface;

export class RasterError extends Error {
  readonly code: RasterFailure;

  constructor(code: RasterFailure, message: string) {
    super(message);
    this.name = 'RasterError';
    this.code = code;
  }
}

/** Maps anything thrown while drawing or encoding to a failure code. */
export function failureCode(error: unknown): RasterFailure {
  if (error instanceof RasterError) return error.code;
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /RangeError|memory|allocat/i.test(text) ? 'memory' : 'encode';
}

function contextSettings(options: SurfaceOptions): CanvasRenderingContext2DSettings {
  return { alpha: options.alpha ?? true, willReadFrequently: options.willReadFrequently ?? false };
}

function noContext(): RasterError {
  return new RasterError('canvas', 'Canvas 2D is not available (the image may be too large for this device)');
}

/** OffscreenCanvas surfaces, for the worker. */
export const offscreenSurface: SurfaceFactory = (width, height, options = {}) => {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d', contextSettings(options));
  if (!context) {
    canvas.width = 0;
    canvas.height = 0;
    throw noContext();
  }
  return {
    width,
    height,
    image: canvas,
    context,
    encode: (mime, quality) => canvas.convertToBlob(quality === null ? { type: mime } : { type: mime, quality }),
    release() {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
};

/** <canvas> surfaces, for the main-thread fallback. */
export const elementSurface: SurfaceFactory = (width, height, options = {}) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', contextSettings(options));
  if (!context) {
    canvas.width = 0;
    canvas.height = 0;
    throw noContext();
  }
  return {
    width,
    height,
    image: canvas,
    context,
    encode: (mime, quality) =>
      new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new RasterError('encode', 'The encoder returned no data'))),
          mime,
          quality ?? undefined,
        );
      }),
    release() {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
};

export interface RasterSource {
  image: CanvasImageSource;
  width: number;
  height: number;
  close(): void;
}

/**
 * Draws `source` at width x height onto a new surface, over `background` if given. Large
 * reductions go in halving steps: a single drawImage at a small scale skips source pixels in
 * some engines, which turns fine detail (text, foliage, hair) into jagged noise.
 */
export function drawScaled(
  source: RasterSource,
  width: number,
  height: number,
  background: string | null,
  create: SurfaceFactory,
): Surface {
  let image = source.image;
  let currentWidth = source.width;
  let currentHeight = source.height;
  let step: Surface | null = null;
  try {
    while (currentWidth / 2 >= width && currentHeight / 2 >= height) {
      const next = create(Math.max(width, Math.round(currentWidth / 2)), Math.max(height, Math.round(currentHeight / 2)));
      try {
        next.context.imageSmoothingEnabled = true;
        next.context.imageSmoothingQuality = 'high';
        next.context.drawImage(image, 0, 0, next.width, next.height);
      } catch (error) {
        next.release();
        throw error;
      }
      step?.release();
      step = next;
      image = next.image;
      currentWidth = next.width;
      currentHeight = next.height;
    }

    const surface = create(width, height, { alpha: background === null });
    try {
      if (background !== null) {
        surface.context.fillStyle = background;
        surface.context.fillRect(0, 0, width, height);
      }
      surface.context.imageSmoothingEnabled = true;
      surface.context.imageSmoothingQuality = 'high';
      surface.context.drawImage(image, 0, 0, width, height);
      return surface;
    } catch (error) {
      surface.release();
      throw error;
    }
  } finally {
    step?.release();
  }
}

/** Largest canvas used to look for transparency (a partly transparent pixel survives smoothing). */
const ALPHA_SCAN_AREA = 4_000_000;

/**
 * Whether any pixel is not fully opaque. The image is scanned at up to 4 MP, a band of rows
 * at a time, so the read-back never needs more than a few MB.
 */
export function scanForAlpha(source: RasterSource, create: SurfaceFactory): boolean {
  const size = fitSize(source.width, source.height, { maxLongSide: null, maxArea: ALPHA_SCAN_AREA, maxSide: 16_384 });
  const surface = create(size.width, size.height, { willReadFrequently: true });
  try {
    surface.context.imageSmoothingEnabled = true;
    surface.context.drawImage(source.image, 0, 0, size.width, size.height);
    const rowsPerBand = Math.max(1, Math.floor(1_048_576 / size.width));
    for (let y = 0; y < size.height; y += rowsPerBand) {
      const rows = Math.min(rowsPerBand, size.height - y);
      const data = surface.context.getImageData(0, y, size.width, rows).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 255) return true;
      }
    }
    return false;
  } finally {
    surface.release();
  }
}

/** Whether this engine's encoder writes WebP (Safari returns a PNG instead). */
export async function probeWebp(create: SurfaceFactory): Promise<boolean> {
  let surface: Surface | null = null;
  try {
    surface = create(2, 2);
    surface.context.fillStyle = '#808080';
    surface.context.fillRect(0, 0, 2, 2);
    const blob = await surface.encode('image/webp', 0.8);
    return blob.type === 'image/webp';
  } catch {
    return false;
  } finally {
    surface?.release();
  }
}

/**
 * Holds one decoded image and encodes it on request. The drawn canvas is kept between
 * encodes, so moving the quality slider only re-runs the encoder, not the resampling.
 */
export class Rasterizer {
  private source: RasterSource | null = null;
  private drawn: { key: string; surface: Surface } | null = null;
  private readonly create: SurfaceFactory;

  constructor(create: SurfaceFactory) {
    this.create = create;
  }

  get loaded(): boolean {
    return this.source !== null;
  }

  /** Takes ownership of `source` (closed on the next load or on clear). */
  load(source: RasterSource, scanAlpha: boolean): { hasAlpha: boolean } {
    this.clear();
    this.source = source;
    return { hasAlpha: scanAlpha ? scanForAlpha(source, this.create) : false };
  }

  async encode(spec: EncodeSpec): Promise<Blob> {
    if (!this.source) throw new RasterError('encode', 'No image is loaded');
    const key = `${spec.width}x${spec.height}|${spec.background ?? ''}`;
    if (this.drawn?.key !== key) {
      this.drawn?.surface.release();
      this.drawn = null;
      this.drawn = { key, surface: drawScaled(this.source, spec.width, spec.height, spec.background, this.create) };
    }
    const blob = await this.drawn.surface.encode(spec.mime, spec.quality);
    if (blob.size === 0) throw new RasterError('encode', 'The encoder returned an empty file');
    return blob;
  }

  clear(): void {
    this.drawn?.surface.release();
    this.drawn = null;
    this.source?.close();
    this.source = null;
  }
}
