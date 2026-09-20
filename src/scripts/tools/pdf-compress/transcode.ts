/**
 * Decodes and re-encodes one PDF image as JPEG with the browser's own codecs (browser only).
 * The worker has no reliable canvas (OffscreenCanvas is missing in older Safari), so it
 * sends each image here.
 */

import type { TranscodeRequest, TranscodeResult } from '../../../lib/pdf/compress/compress-pdf.ts';
import { MAX_CANVAS_SIDE, fitsCanvas, targetImageSize } from '../../../lib/pdf/compress/plan.ts';

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Frees the backing store right away (Safari keeps it until garbage collection otherwise). */
function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas 2D is not available (the image may be too large for this device)');
  return context;
}

function encodeJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob && blob.type === 'image/jpeg') resolve(blob);
        else reject(new Error('Could not encode the image as JPEG (the device may be out of memory)'));
      },
      'image/jpeg',
      quality,
    );
  });
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  close(): void;
}

let resizeQualitySupport: boolean | null = null;

/**
 * Whether createImageBitmap understands resizeQuality. Browsers read every dictionary
 * member they know while converting the options, synchronously, so a getter reveals it.
 * Without it, resizing may be low quality (nearest neighbour), which ruins text in scans.
 */
function supportsHighQualityBitmapResize(): boolean {
  if (resizeQualitySupport !== null) return resizeQualitySupport;
  let read = false;
  const probe = {
    get resizeQuality() {
      read = true;
      return 'high';
    },
  };
  try {
    createImageBitmap(new ImageData(1, 1), probe as ImageBitmapOptions).then(
      (bitmap) => bitmap.close(),
      () => undefined,
    );
  } catch {
    read = false;
  }
  resizeQualitySupport = read;
  return read;
}

/**
 * Decodes JPEG bytes. Where the browser can resize with high quality, it is asked for the
 * target size directly, which also needs less memory for large JPEGs. Otherwise the full
 * size is decoded and drawn scaled. Falls back to an <img> element.
 */
async function decodeJpeg(bytes: Uint8Array, targetWidth: number, targetHeight: number, resize: boolean): Promise<Decoded> {
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' });
  if (typeof createImageBitmap === 'function') {
    // The worker already removed EXIF orientation and ICC profiles, so the samples match
    // what PDF viewers show; 'none' also stops any remaining colour conversion.
    const base: ImageBitmapOptions = { colorSpaceConversion: 'none' };
    const attempts: Array<ImageBitmapOptions | undefined> =
      resize && supportsHighQualityBitmapResize()
        ? [{ ...base, resizeWidth: targetWidth, resizeHeight: targetHeight, resizeQuality: 'high' }, base, undefined]
        : [base, undefined];
    for (const options of attempts) {
      try {
        const bitmap = await createImageBitmap(blob, options);
        if (bitmap.width > 0 && bitmap.height > 0) {
          return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
        }
        bitmap.close();
      } catch {
        // try the next way
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const image = new Image();
  const close = () => {
    image.removeAttribute('src');
    URL.revokeObjectURL(url);
  };
  try {
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Decoded image is empty');
  } catch (error) {
    close();
    throw error;
  }
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, close };
}

/**
 * Draws `source` into a canvas of exactly width x height. Large reductions are done in
 * halving steps: a single drawImage at a small scale skips source pixels in some browsers
 * (Safari), which makes text and fine lines in scans look broken.
 */
function drawScaled(decoded: Decoded, width: number, height: number): HTMLCanvasElement {
  let source: CanvasImageSource = decoded.source;
  let sourceWidth = decoded.width;
  let sourceHeight = decoded.height;
  let intermediate: HTMLCanvasElement | null = null;
  try {
    while (sourceWidth / 2 >= width && sourceHeight / 2 >= height) {
      let stepWidth = Math.max(width, Math.round(sourceWidth / 2));
      let stepHeight = Math.max(height, Math.round(sourceHeight / 2));
      if (!fitsCanvas(stepWidth, stepHeight)) {
        // Halving a huge image still exceeds the canvas limits (iOS): take a bigger step.
        const fitted = targetImageSize(stepWidth, stepHeight, MAX_CANVAS_SIDE);
        stepWidth = Math.max(width, fitted.width);
        stepHeight = Math.max(height, fitted.height);
      }
      const step = createCanvas(stepWidth, stepHeight);
      try {
        const context = context2d(step);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(source, 0, 0, stepWidth, stepHeight);
      } catch (error) {
        releaseCanvas(step);
        throw error;
      }
      if (intermediate) releaseCanvas(intermediate);
      intermediate = step;
      source = step;
      sourceWidth = stepWidth;
      sourceHeight = stepHeight;
    }
    const canvas = createCanvas(width, height);
    try {
      const context = context2d(canvas);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(source, 0, 0, width, height);
    } catch (error) {
      releaseCanvas(canvas);
      throw error;
    }
    return canvas;
  } finally {
    if (intermediate) releaseCanvas(intermediate);
  }
}

/** Raw 8-bit gray or RGB samples (already at the target size) into an opaque canvas. */
function drawPixels(request: TranscodeRequest): HTMLCanvasElement {
  const { width, height, channels, data } = request;
  if (data.length < width * height * channels) throw new Error('Pixel data is incomplete');
  const canvas = createCanvas(width, height);
  try {
    const context = context2d(canvas);
    // Row bands keep the RGBA copy small (about 16 MB at most at a time).
    const rowsPerBand = Math.max(1, Math.floor(4_000_000 / width));
    for (let y = 0; y < height; y += rowsPerBand) {
      const rows = Math.min(rowsPerBand, height - y);
      const imageData = context.createImageData(width, rows);
      const rgba = imageData.data;
      let src = y * width * channels;
      for (let dst = 0; dst < rgba.length; dst += 4) {
        if (channels === 1) {
          const gray = data[src++]!;
          rgba[dst] = gray;
          rgba[dst + 1] = gray;
          rgba[dst + 2] = gray;
        } else {
          rgba[dst] = data[src++]!;
          rgba[dst + 1] = data[src++]!;
          rgba[dst + 2] = data[src++]!;
        }
        rgba[dst + 3] = 255;
      }
      context.putImageData(imageData, 0, y);
    }
    return canvas;
  } catch (error) {
    releaseCanvas(canvas);
    throw error;
  }
}

/**
 * A draw that failed silently (for example an image too large for iOS to decode) leaves
 * an opaque canvas black. Such a result must never replace a real image; a genuinely
 * all-black image simply stays as it was.
 */
function looksBlank(canvas: HTMLCanvasElement): boolean {
  const probe = createCanvas(8, 8);
  try {
    const context = probe.getContext('2d', { willReadFrequently: true });
    if (!context) return false;
    context.imageSmoothingEnabled = true;
    context.drawImage(canvas, 0, 0, 8, 8);
    const data = context.getImageData(0, 0, 8, 8).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== 0 || data[i + 1] !== 0 || data[i + 2] !== 0) return false;
    }
    return true;
  } catch {
    return false;
  } finally {
    releaseCanvas(probe);
  }
}

let readbackCheck: boolean | null = null;

/**
 * Whether pixels written to a canvas can be read back unchanged. Privacy protections
 * (Firefox/Tor "resist fingerprinting") return blank or random data instead, which would
 * turn every image into garbage. Small noise (Brave) is tolerated. Memoized.
 */
export function canvasReadbackWorks(): boolean {
  if (readbackCheck !== null) return readbackCheck;
  const size = 4;
  const canvas = createCanvas(size, size);
  try {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return (readbackCheck = false);
    const pattern = context.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      pattern.data.set([(i * 53 + 17) % 256, (255 - i * 16) & 0xff, (i * 97 + 40) % 256, 255], i * 4);
    }
    context.putImageData(pattern, 0, 0);
    const read = context.getImageData(0, 0, size, size).data;
    let worst = 0;
    for (let i = 0; i < read.length; i++) worst = Math.max(worst, Math.abs(read[i]! - pattern.data[i]!));
    readbackCheck = worst <= 4;
  } catch {
    readbackCheck = false;
  } finally {
    releaseCanvas(canvas);
  }
  return readbackCheck;
}

/**
 * Re-encodes one image as a JPEG of exactly targetWidth x targetHeight. Returns null when
 * the result would not be used (not smaller than request.maxBytes, or the image cannot be
 * drawn at that size on this device).
 */
export async function transcodeOnPage(request: TranscodeRequest, signal: AbortSignal): Promise<TranscodeResult | null> {
  throwIfAborted(signal);
  const { targetWidth, targetHeight } = request;
  if (!fitsCanvas(targetWidth, targetHeight)) return null;

  let canvas: HTMLCanvasElement;
  if (request.kind === 'jpeg') {
    const resize = targetWidth !== request.width || targetHeight !== request.height;
    const decoded = await decodeJpeg(request.data, targetWidth, targetHeight, resize);
    try {
      throwIfAborted(signal);
      // The PDF says how big the image is; a decoder that disagrees misread it.
      const matchesSource = decoded.width === request.width && decoded.height === request.height;
      const matchesTarget = decoded.width === targetWidth && decoded.height === targetHeight;
      if (!matchesSource && !matchesTarget) return null;
      canvas = drawScaled(decoded, targetWidth, targetHeight);
    } finally {
      decoded.close();
    }
  } else {
    if (request.width !== targetWidth || request.height !== targetHeight) return null;
    canvas = drawPixels(request);
  }

  let blob: Blob;
  try {
    throwIfAborted(signal);
    if (looksBlank(canvas)) return null;
    blob = await encodeJpeg(canvas, request.quality);
  } finally {
    releaseCanvas(canvas);
  }
  throwIfAborted(signal);
  if (blob.size > request.maxBytes) return null;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  throwIfAborted(signal);
  return { bytes, width: targetWidth, height: targetHeight };
}
