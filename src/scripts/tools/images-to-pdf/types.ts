import type { ImageFormat } from '../../../lib/image/sniff.ts';
import type { JpegInfo } from '../../../lib/image/jpeg-info.ts';
import type { BuildOptions, BuildStage, PreparedImage } from '../../../lib/pdf/build-images-pdf.ts';

export interface ImageItem {
  id: string;
  file: File;
  name: string;
  size: number;
  format: ImageFormat;
  /** Upright (EXIF-applied) pixel dimensions. */
  displayWidth: number;
  displayHeight: number;
  jpegInfo?: JpegInfo;
  thumbUrl: string;
}

export type Quality = 'original' | 'compressed';

/**
 * Why a file was not added. The controller words it in the page's language
 * (`reasons` in src/i18n/tools/images-to-pdf.ts).
 */
export type RejectReason =
  /** The file's bytes could not be read at all. */
  | 'unreadable'
  | 'svg'
  /** Not an image format we recognise. */
  | 'unsupported'
  /** A HEIC photo this browser cannot decode. */
  | 'heic'
  /** A recognised format the browser failed to decode. */
  | 'undecodable';

/** Messages from the page to the PDF worker. */
export type ToPdfWorker =
  | { type: 'start'; count: number; options: BuildOptions }
  | { type: 'image'; image: PreparedImage };

/** Messages from the PDF worker to the page. */
export type FromPdfWorker =
  | { type: 'ready' }
  | { type: 'need'; index: number; fallback: boolean }
  | { type: 'progress'; done: number; total: number; stage: BuildStage }
  | { type: 'done'; bytes: Uint8Array }
  | { type: 'error'; name: string; message: string };
