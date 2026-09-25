/**
 * Turns an imported item into bytes pdf-lib can embed (browser only).
 */

import { extractJpegIccProfile, isPdfPassthroughJpeg, stripJpegForPdf } from '../../../lib/image/jpeg-info.ts';
import { isPdfLibSafePng, readPngColorChunks } from '../../../lib/image/png-pdf.ts';
import { readPngInfo } from '../../../lib/image/sniff.ts';
import type { PreparedImage } from '../../../lib/pdf/build-images-pdf.ts';
import { canvasToBlob, hasTransparency, releaseCanvas } from './canvas.ts';
import { renderUpright, throwIfAborted } from './decode.ts';
import type { ImageItem, Quality } from './types.ts';

const ORIGINAL_JPEG_QUALITY = 0.92;
const COMPRESSED_LONG_SIDE = 2000;
const COMPRESSED_JPEG_QUALITY = 0.8;
/**
 * Larger PNGs are re-encoded by the browser instead of being passed to pdf-lib, whose
 * JavaScript PNG decoder needs about 11 bytes per pixel of working memory.
 */
const MAX_PASSTHROUGH_PNG_PIXELS = 8_000_000;

async function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** Inflates zlib data with the browser's native decompressor; null when unavailable or invalid. */
async function inflate(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream !== 'function') return null;
  try {
    const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

function sourceOrientation(item: ImageItem) {
  return item.format === 'jpeg' ? (item.jpegInfo?.orientation ?? 1) : 1;
}

/** Full resolution (within canvas limits); PNG when any pixel is transparent, else JPEG 0.92. */
async function transcodeFull(item: ImageItem, signal?: AbortSignal): Promise<PreparedImage> {
  // JPEG cannot carry alpha: draw on white and skip the transparency scan.
  const opaqueSource = item.format === 'jpeg';
  const rendered = await renderUpright(item.file, sourceOrientation(item), {
    background: opaqueSource ? '#ffffff' : null,
    willReadFrequently: !opaqueSource,
    signal,
  });
  const { canvas, context } = rendered;
  const width = canvas.width;
  const height = canvas.height;
  let transparent: boolean;
  let blob: Blob;
  try {
    throwIfAborted(signal);
    transparent = !opaqueSource && hasTransparency(context, width, height);
    throwIfAborted(signal);
    blob = transparent
      ? await canvasToBlob(canvas, 'image/png')
      : await canvasToBlob(canvas, 'image/jpeg', ORIGINAL_JPEG_QUALITY);
  } finally {
    // Free the pixel buffer before copying the encoded bytes (phone memory).
    releaseCanvas(canvas);
  }
  throwIfAborted(signal);
  return { kind: transparent ? 'png' : 'jpeg', bytes: await readBytes(blob), width, height, orientation: 1 };
}

/** Longest side <= 2000 px, white background, JPEG 0.8, orientation baked in. */
async function transcodeCompressed(item: ImageItem, signal?: AbortSignal): Promise<PreparedImage> {
  const { canvas } = await renderUpright(item.file, sourceOrientation(item), {
    maxLongSide: COMPRESSED_LONG_SIDE,
    background: '#ffffff',
    signal,
  });
  const width = canvas.width;
  const height = canvas.height;
  let blob: Blob;
  try {
    throwIfAborted(signal);
    blob = await canvasToBlob(canvas, 'image/jpeg', COMPRESSED_JPEG_QUALITY);
  } finally {
    releaseCanvas(canvas);
  }
  throwIfAborted(signal);
  return { kind: 'jpeg', bytes: await readBytes(blob), width, height, orientation: 1 };
}

/**
 * The JPEG's compressed image data unchanged, without camera metadata (Exif incl. GPS,
 * XMP, embedded videos after the image). Its ICC profile is kept for the PDF colour space.
 */
async function passthroughJpeg(item: ImageItem, signal?: AbortSignal): Promise<PreparedImage | null> {
  const info = item.jpegInfo;
  if (item.format !== 'jpeg' || !info || !isPdfPassthroughJpeg(info)) return null;
  const original = await readBytes(item.file);
  throwIfAborted(signal);
  return {
    kind: 'jpeg',
    bytes: stripJpegForPdf(original),
    width: info.width,
    height: info.height,
    orientation: info.orientation,
    icc: extractJpegIccProfile(original) ?? undefined,
  };
}

async function passthroughPng(item: ImageItem, signal?: AbortSignal): Promise<PreparedImage | null> {
  if (item.format !== 'png' || item.displayWidth * item.displayHeight > MAX_PASSTHROUGH_PNG_PIXELS) return null;
  const bytes = await readBytes(item.file);
  throwIfAborted(signal);
  const info = readPngInfo(bytes);
  if (!info || info.width * info.height > MAX_PASSTHROUGH_PNG_PIXELS || !isPdfLibSafePng(info)) return null;
  const color = readPngColorChunks(bytes);
  const icc = color?.compressedIccProfile && !color.hasSrgbChunk ? await inflate(color.compressedIccProfile) : null;
  throwIfAborted(signal);
  return { kind: 'png', bytes, width: info.width, height: info.height, orientation: 1, icc: icc ?? undefined };
}

export async function prepareImage(item: ImageItem, quality: Quality, signal?: AbortSignal): Promise<PreparedImage> {
  throwIfAborted(signal);
  if (quality === 'compressed') {
    const compressed = await transcodeCompressed(item, signal);
    // Never make a small JPEG bigger: keep the original image data when re-encoding does not help.
    const info = item.jpegInfo;
    if (info && isPdfPassthroughJpeg(info) && Math.max(info.width, info.height) <= COMPRESSED_LONG_SIDE) {
      const passthrough = await passthroughJpeg(item, signal);
      if (passthrough && passthrough.bytes.byteLength <= compressed.bytes.byteLength) return passthrough;
    }
    return compressed;
  }

  return (await passthroughJpeg(item, signal)) ?? (await passthroughPng(item, signal)) ?? transcodeFull(item, signal);
}

/** Used when pdf-lib cannot embed the prepared bytes: re-render through a canvas. */
export function prepareFallback(item: ImageItem, quality: Quality, signal?: AbortSignal): Promise<PreparedImage> {
  return quality === 'compressed' ? transcodeCompressed(item, signal) : transcodeFull(item, signal);
}
