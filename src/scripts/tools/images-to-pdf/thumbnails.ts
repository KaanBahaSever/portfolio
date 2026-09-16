/**
 * Import: sniff, parse JPEG metadata, decode, build a small thumbnail (browser only).
 */

import { readJpegInfo } from '../../../lib/image/jpeg-info.ts';
import type { JpegInfo } from '../../../lib/image/jpeg-info.ts';
import { orientedSize } from '../../../lib/image/orientation.ts';
import { sniffImageFormat } from '../../../lib/image/sniff.ts';
import type { ImageFormat } from '../../../lib/image/sniff.ts';
import { canvasToBlob, releaseCanvas } from './canvas.ts';
import { renderUpright } from './decode.ts';
import type { ImageItem } from './types.ts';

const SNIFF_BYTES = 64;
const JPEG_HEAD_BYTES = 256 * 1024;
const THUMBNAIL_LONG_SIDE = 400;
const THUMBNAIL_QUALITY = 0.8;

export type ImportResult = { ok: true; item: ImageItem } | { ok: false; name: string; reason: string };

let idCounter = 0;

export function createId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // randomUUID is missing outside secure contexts on some browsers.
  }
  idCounter += 1;
  return `img-${Date.now().toString(36)}-${idCounter}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

async function readJpegMetadata(file: File): Promise<JpegInfo | undefined> {
  const head = readJpegInfo(await readBytes(file.slice(0, JPEG_HEAD_BYTES)));
  if (head) return head;
  // Large APP segments (thumbnails, ICC profiles, MPF) can push SOF past the first 256 KB.
  if (file.size > JPEG_HEAD_BYTES) return readJpegInfo(await readBytes(file)) ?? undefined;
  return undefined;
}

function rejection(file: File, reason: string): ImportResult {
  return { ok: false, name: file.name || 'Unnamed file', reason };
}

export async function importFile(file: File): Promise<ImportResult> {
  let format: ImageFormat;
  try {
    format = sniffImageFormat(await readBytes(file.slice(0, SNIFF_BYTES)));
  } catch {
    return rejection(file, 'Could not read this file');
  }
  if (format === 'svg') return rejection(file, "SVG isn't supported");
  if (format === 'unknown') return rejection(file, 'Not a supported image');

  let jpegInfo: JpegInfo | undefined;
  if (format === 'jpeg') {
    try {
      jpegInfo = await readJpegMetadata(file);
    } catch {
      jpegInfo = undefined;
    }
  }

  let thumbUrl: string;
  let uprightWidth: number;
  let uprightHeight: number;
  try {
    const rendered = await renderUpright(file, jpegInfo?.orientation ?? 1, {
      maxLongSide: THUMBNAIL_LONG_SIDE,
      background: '#ffffff',
    });
    try {
      const blob = await canvasToBlob(rendered.canvas, 'image/jpeg', THUMBNAIL_QUALITY);
      thumbUrl = URL.createObjectURL(blob);
    } finally {
      releaseCanvas(rendered.canvas);
    }
    uprightWidth = rendered.uprightWidth;
    uprightHeight = rendered.uprightHeight;
  } catch {
    return rejection(
      file,
      format === 'heic' ? "HEIC isn't supported by this browser — convert to JPEG first" : 'Could not read this image',
    );
  }

  const display = jpegInfo
    ? orientedSize(jpegInfo.width, jpegInfo.height, jpegInfo.orientation)
    : { width: uprightWidth, height: uprightHeight };

  return {
    ok: true,
    item: {
      id: createId(),
      file,
      name: file.name || 'Untitled image',
      size: file.size,
      format,
      displayWidth: display.width,
      displayHeight: display.height,
      jpegInfo,
      thumbUrl,
    },
  };
}
