/**
 * Messages between the page and the encode worker (encode-worker.ts).
 */

import type { OutputMime } from '../../../lib/image/compress/formats.ts';

/** One encode: the exact output the page wants. */
export interface EncodeSpec {
  width: number;
  height: number;
  mime: OutputMime;
  /** 0–1, or null for lossless PNG. */
  quality: number | null;
  /** Fill under the image (JPEG output of a transparent image), or null. */
  background: string | null;
}

/**
 * Why rasterizing failed: 'canvas' (no 2D context: too large for this device), 'encode'
 * (the encoder returned nothing), 'memory' (an allocation failed).
 */
export type RasterFailure = 'canvas' | 'encode' | 'memory';

export type ToEncodeWorker =
  /** Hands over the decoded image (transferred) and asks whether it has transparent pixels. */
  | { type: 'load'; id: number; bitmap: ImageBitmap; scanAlpha: boolean }
  | { type: 'encode'; id: number; spec: EncodeSpec }
  | { type: 'unload' };

export type FromEncodeWorker =
  /** Sent once at start: whether OffscreenCanvas 2D works here and whether it writes WebP. */
  | { type: 'ready'; ok: boolean; webp: boolean }
  | { type: 'loaded'; id: number; hasAlpha: boolean }
  | { type: 'encoded'; id: number; blob: Blob }
  | { type: 'error'; id: number; code: RasterFailure; message: string };
