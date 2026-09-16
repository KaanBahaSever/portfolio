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
