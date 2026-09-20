import type {
  CompressProgress,
  CompressStats,
  PdfSummary,
  TranscodeRequest,
  TranscodeResult,
} from '../../../lib/pdf/compress/compress-pdf.ts';
import type { CompressionLevel } from '../../../lib/pdf/compress/plan.ts';

export type FailureCode = 'encrypted' | 'invalid' | 'unknown';

export interface CompressRunOptions {
  level: CompressionLevel;
  stripMetadata: boolean;
}

/** Messages from the page to the compression worker. */
export type ToCompressWorker =
  | { type: 'open'; bytes: ArrayBuffer; maxImagePixels: number }
  | ({ type: 'compress'; runId: number } & CompressRunOptions)
  | { type: 'transcoded'; runId: number; requestId: number; result: TranscodeResult | null };

/** Messages from the compression worker to the page. */
export type FromCompressWorker =
  | { type: 'ready' }
  | { type: 'opened'; summary: PdfSummary }
  | { type: 'progress'; runId: number; progress: CompressProgress }
  | { type: 'need-transcode'; runId: number; requestId: number; request: TranscodeRequest; index: number; total: number }
  | { type: 'done'; runId: number; bytes: Uint8Array; stats: CompressStats }
  | { type: 'error'; runId: number | null; code: FailureCode; name: string; message: string };
