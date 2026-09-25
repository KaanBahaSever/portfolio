/**
 * Web Worker that builds the PDF with pdf-lib (browser only).
 *
 * pdf-lib decodes PNGs and compresses data synchronously; here that never freezes the
 * page, its progress bar or the Cancel button. Images that need a canvas are prepared by
 * the page and sent over one at a time when the builder asks for them.
 */

import { buildImagesPdf } from '../../../lib/pdf/build-images-pdf.ts';
import type { BuildOptions, PreparedImage } from '../../../lib/pdf/build-images-pdf.ts';
import type { FromPdfWorker, ToPdfWorker } from './types.ts';

const scope = self as unknown as {
  postMessage(message: FromPdfWorker, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<ToPdfWorker>) => void) | null;
};

let deliver: ((image: PreparedImage) => void) | null = null;

function requestImage(index: number, fallback: boolean): Promise<PreparedImage> {
  return new Promise((resolve) => {
    deliver = resolve;
    scope.postMessage({ type: 'need', index, fallback });
  });
}

async function build(count: number, options: BuildOptions): Promise<void> {
  try {
    const bytes = await buildImagesPdf({
      count,
      options,
      getImage: (index) => requestImage(index, false),
      getFallbackImage: (index) => requestImage(index, true),
      onProgress: (done, total, stage) => scope.postMessage({ type: 'progress', done, total, stage }),
      // Nothing else runs in this worker, so saving never needs to pause.
      objectsPerTick: Infinity,
    });
    const exact = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes : bytes.slice();
    scope.postMessage({ type: 'done', bytes: exact }, [exact.buffer as ArrayBuffer]);
  } catch (error) {
    scope.postMessage({
      type: 'error',
      name: error instanceof Error ? error.name : 'Error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

scope.onmessage = (event) => {
  const message = event.data;
  if (message.type === 'image') {
    const resolve = deliver;
    deliver = null;
    resolve?.(message.image);
  } else if (message.type === 'start') {
    void build(message.count, message.options);
  }
};

scope.postMessage({ type: 'ready' });
