/**
 * Image decoding and upright rendering to canvas (browser only).
 */

import { insertExifOrientation } from '../../../lib/image/jpeg-info.ts';
import { orientationCanvasTransform, orientedSize, storedDrawSize } from '../../../lib/image/orientation.ts';
import type { Orientation } from '../../../lib/image/orientation.ts';
import { canvasToBlob, createCanvas, fitCanvasSize, get2dContext, releaseCanvas } from './canvas.ts';

export type DecodeMethod = 'bitmap' | 'element';

/** Like AbortSignal#throwIfAborted (missing before Safari 15.4), always with an AbortError. */
export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
}

export interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  method: DecodeMethod;
  close(): void;
}

async function decodeWithBitmap(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap !== 'function') throw new Error('createImageBitmap is not supported');
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  if (!bitmap.width || !bitmap.height) {
    bitmap.close();
    throw new Error('Decoded image is empty');
  }
  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    method: 'bitmap',
    close: () => bitmap.close(),
  };
}

async function decodeWithElement(blob: Blob): Promise<DecodedImage> {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  const close = () => {
    image.removeAttribute('src');
    URL.revokeObjectURL(url);
  };
  try {
    image.decoding = 'async';
    image.src = url;
    if (typeof image.decode === 'function') {
      await image.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Image failed to load'));
      });
    }
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Decoded image is empty');
  } catch (error) {
    close();
    throw error;
  }
  // The object URL is revoked in close(), after the caller has drawn the image.
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, method: 'element', close };
}

/** Decodes with createImageBitmap (EXIF applied), falling back to an <img> element. */
export async function decodeImage(blob: Blob): Promise<DecodedImage> {
  try {
    return await decodeWithBitmap(blob);
  } catch {
    return decodeWithElement(blob);
  }
}

const exifSupport = new Map<DecodeMethod, Promise<boolean>>();

async function detectExifSupport(method: DecodeMethod): Promise<boolean> {
  const canvas = createCanvas(2, 1);
  let jpeg: Blob;
  try {
    const context = get2dContext(canvas);
    context.fillStyle = '#000';
    context.fillRect(0, 0, 2, 1);
    jpeg = await canvasToBlob(canvas, 'image/jpeg', 0.9);
  } finally {
    releaseCanvas(canvas);
  }
  const rotated = insertExifOrientation(new Uint8Array(await jpeg.arrayBuffer()), 6);
  const blob = new Blob([rotated as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' });
  const decoded = method === 'bitmap' ? await decodeWithBitmap(blob) : await decodeWithElement(blob);
  try {
    return decoded.width === 1 && decoded.height === 2;
  } finally {
    decoded.close();
  }
}

/**
 * Whether images decoded with `method` already have EXIF orientation applied.
 * Memoized per method: a 2x1 JPEG tagged orientation 6 decodes as 1x2 if so.
 */
export function browserAppliesExif(method: DecodeMethod): Promise<boolean> {
  let promise = exifSupport.get(method);
  if (!promise) {
    // Every current engine applies EXIF by default, so assume so if detection itself fails.
    promise = detectExifSupport(method).catch(() => true);
    exifSupport.set(method, promise);
  }
  return promise;
}

export interface RenderOptions {
  /** Longest side of the output canvas in pixels (never upscales). */
  maxLongSide?: number;
  /** Fill color drawn under the image; null keeps transparency. */
  background: string | null;
  /** Hint for canvases that will be read back with getImageData. */
  willReadFrequently?: boolean;
  /** Stops before drawing when aborted during decoding. */
  signal?: AbortSignal;
}

export interface RenderedImage {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  /** Full-resolution upright size of the source image. */
  uprightWidth: number;
  uprightHeight: number;
}

/**
 * Decodes `blob` and draws it upright into a new canvas within canvas limits.
 * `orientation` is the EXIF orientation of JPEG sources (1 for everything else);
 * it is applied manually only when the browser does not apply EXIF itself.
 * The caller must releaseCanvas() the result.
 */
export async function renderUpright(blob: Blob, orientation: Orientation, options: RenderOptions): Promise<RenderedImage> {
  const decoded = await decodeImage(blob);
  try {
    throwIfAborted(options.signal);
    const manual = orientation !== 1 && !(await browserAppliesExif(decoded.method));
    throwIfAborted(options.signal);
    const upright = manual
      ? orientedSize(decoded.width, decoded.height, orientation)
      : { width: decoded.width, height: decoded.height };
    const size = fitCanvasSize(upright.width, upright.height, options.maxLongSide);
    const canvas = createCanvas(size.width, size.height);
    try {
      const context = get2dContext(canvas, options.willReadFrequently ? { willReadFrequently: true } : undefined);
      if (options.background) {
        context.fillStyle = options.background;
        context.fillRect(0, 0, size.width, size.height);
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      if (manual) {
        context.setTransform(...orientationCanvasTransform(orientation, size.width, size.height));
        const draw = storedDrawSize(orientation, size.width, size.height);
        context.drawImage(decoded.source, 0, 0, draw.width, draw.height);
        context.setTransform(1, 0, 0, 1, 0, 0);
      } else {
        context.drawImage(decoded.source, 0, 0, size.width, size.height);
      }
      return { canvas, context, uprightWidth: upright.width, uprightHeight: upright.height };
    } catch (error) {
      releaseCanvas(canvas);
      throw error;
    }
  } finally {
    decoded.close();
  }
}
