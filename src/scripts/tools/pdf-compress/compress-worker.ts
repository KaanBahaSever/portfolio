/**
 * Web Worker that compresses one PDF with pdf-lib (browser only).
 *
 * It parses the picked file once and runs one compression on that document. The file's
 * bytes are not kept: pdf-lib copies every stream it parses, so keeping them would double
 * the memory needed. The page terminates the worker after each run and starts a new one,
 * from the File, for the next, so each level starts from the original file. Parsing,
 * clean-up and saving are synchronous and slow for big files; here they never freeze the
 * page, and Cancel simply terminates the worker. Images are decoded and re-encoded by the
 * page (a canvas is needed), one at a time, when the pipeline asks for them.
 */

import type { PDFDocument } from 'pdf-lib';
import {
  PdfCompressError,
  analyzePdf,
  compressPdf,
  decodeWithPdfLib,
  loadPdfForCompression,
} from '../../../lib/pdf/compress/compress-pdf.ts';
import type { StreamDecoder, TranscodeRequest, TranscodeResult } from '../../../lib/pdf/compress/compress-pdf.ts';
import type { CompressRunOptions, FromCompressWorker, ToCompressWorker } from './types.ts';

const scope = self as unknown as {
  postMessage(message: FromCompressWorker, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<ToCompressWorker>) => void) | null;
};

let maxImagePixels = Infinity;
/** The document parsed for the summary, used (and released) by the one run. */
let pristine: PDFDocument | null = null;
let busy = false;
const pendingTranscodes = new Map<number, (result: TranscodeResult | null) => void>();
let nextRequestId = 1;

function postError(runId: number | null, error: unknown): void {
  scope.postMessage({
    type: 'error',
    runId,
    code: error instanceof PdfCompressError ? error.code : 'unknown',
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
  });
}

async function inflateNative(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Native inflate for plain FlateDecode images (much faster than JavaScript). pdf-lib's
 * decoders handle the other filters and streams the native one rejects, such as a
 * missing checksum; a truncated result is then rejected by its length check.
 */
const decodeStream: StreamDecoder = async (stream, filters) => {
  if (filters.length === 1 && filters[0] === 'FlateDecode' && typeof DecompressionStream === 'function') {
    try {
      return await inflateNative(stream.contents);
    } catch {
      // fall through
    }
  }
  return decodeWithPdfLib(stream, filters);
};

function requestTranscode(runId: number, request: TranscodeRequest, index: number, total: number): Promise<TranscodeResult | null> {
  return new Promise((resolve) => {
    const requestId = nextRequestId++;
    pendingTranscodes.set(requestId, resolve);
    // request.data owns its buffer (see TranscodeRequest), so it can be moved instead of copied.
    scope.postMessage({ type: 'need-transcode', runId, requestId, request, index, total }, [
      request.data.buffer as ArrayBuffer,
    ]);
  });
}

async function open(bytes: ArrayBuffer, pixelLimit: number): Promise<void> {
  maxImagePixels = pixelLimit;
  pristine = null;
  try {
    // Only the parsed document is kept; the input buffer can be collected once this returns.
    const doc = await loadPdfForCompression(bytes);
    const summary = analyzePdf(doc, { maxImagePixels });
    pristine = doc;
    scope.postMessage({ type: 'opened', summary });
  } catch (error) {
    postError(null, error);
  }
}

async function run(runId: number, options: CompressRunOptions): Promise<void> {
  if (!pristine || busy) {
    postError(runId, new Error(busy ? 'A compression is already running' : 'No PDF is open'));
    return;
  }
  busy = true;
  try {
    // Compression modifies the document, so it serves one run only.
    const doc = pristine;
    pristine = null;
    const { bytes, stats } = await compressPdf({
      doc,
      level: options.level,
      stripMetadata: options.stripMetadata,
      maxImagePixels,
      decodeStream,
      transcode: (request, position) => requestTranscode(runId, request, position.index, position.total),
      onProgress: (progress) => scope.postMessage({ type: 'progress', runId, progress }),
      // Nothing else runs in this worker, so saving never needs to pause.
      objectsPerTick: Infinity,
    });
    const exact = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes : bytes.slice();
    scope.postMessage({ type: 'done', runId, bytes: exact, stats }, [exact.buffer as ArrayBuffer]);
  } catch (error) {
    postError(runId, error);
  } finally {
    busy = false;
    pendingTranscodes.clear();
  }
}

scope.onmessage = (event) => {
  const message = event.data;
  switch (message.type) {
    case 'open':
      void open(message.bytes, message.maxImagePixels);
      break;
    case 'compress':
      void run(message.runId, { level: message.level, stripMetadata: message.stripMetadata });
      break;
    case 'transcoded': {
      const resolve = pendingTranscodes.get(message.requestId);
      pendingTranscodes.delete(message.requestId);
      resolve?.(message.result);
      break;
    }
    default:
      break;
  }
};

scope.postMessage({ type: 'ready' });
