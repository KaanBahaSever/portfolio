/**
 * Runs the PDF build in a Web Worker (browser only). The worker script, which contains
 * pdf-lib, is only fetched when a build starts, so it stays out of the page JavaScript.
 */

import type { BuildOptions, BuildStage, PreparedImage } from '../../../lib/pdf/build-images-pdf.ts';
import type { FromPdfWorker, ToPdfWorker } from './types.ts';

/** The worker script could not be loaded (offline, or a newer deployment replaced it). */
export class PdfEngineLoadError extends Error {
  constructor(cause?: unknown) {
    super('Could not load the PDF engine', { cause });
    this.name = 'PdfEngineLoadError';
  }
}

export interface PdfEngineArgs {
  count: number;
  options: BuildOptions;
  signal: AbortSignal;
  /** Prepares one image on the page; `signal` aborts when the build ends for any reason. */
  getImage: (index: number, fallback: boolean, signal: AbortSignal) => Promise<PreparedImage>;
  onProgress: (done: number, total: number, stage: BuildStage) => void;
}

function abortError(): DOMException {
  return new DOMException('Cancelled', 'AbortError');
}

function reviveError(name: string, message: string): Error {
  const error = name === 'RangeError' ? new RangeError(message) : new Error(message);
  error.name = name;
  return error;
}

export function buildPdfInWorker(args: PdfEngineArgs): Promise<Uint8Array> {
  const { count, options, signal, getImage, onProgress } = args;
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    let worker: Worker;
    try {
      worker = new Worker(new URL('./pdf-worker.ts', import.meta.url), { type: 'module' });
    } catch (error) {
      reject(new PdfEngineLoadError(error));
      return;
    }

    const local = new AbortController();
    let preparing: Promise<unknown> = Promise.resolve();
    let loaded = false;
    let settled = false;

    function settle(report: () => void): void {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      // terminate() stops pdf-lib at once, wherever it is (also in the middle of saving).
      worker.terminate();
      local.abort();
      // Report once the image being prepared on the page has stopped too, so a new
      // build never runs alongside it.
      void preparing.then(report, report);
    }

    function onAbort(): void {
      settle(() => reject(abortError()));
    }
    signal.addEventListener('abort', onAbort);

    worker.onmessage = (event: MessageEvent<FromPdfWorker>) => {
      loaded = true;
      const message = event.data;
      switch (message.type) {
        case 'need': {
          const task = getImage(message.index, message.fallback, local.signal);
          preparing = task.catch(() => undefined);
          task.then(
            (image) => {
              if (settled) return;
              const transfer: Transferable[] = [image.bytes.buffer as ArrayBuffer];
              if (image.icc && image.icc.buffer !== image.bytes.buffer) transfer.push(image.icc.buffer as ArrayBuffer);
              const reply: ToPdfWorker = { type: 'image', image };
              worker.postMessage(reply, transfer);
            },
            (error: unknown) => settle(() => reject(error)),
          );
          break;
        }
        case 'progress':
          if (!settled) onProgress(message.done, message.total, message.stage);
          break;
        case 'done':
          settle(() => resolve(message.bytes));
          break;
        case 'error':
          settle(() => reject(reviveError(message.name, message.message)));
          break;
        default:
          break;
      }
    };

    worker.onerror = (event) => {
      event.preventDefault();
      settle(() =>
        reject(
          loaded
            ? new Error('The PDF worker stopped unexpectedly (the device may be out of memory)')
            : new PdfEngineLoadError(event.message),
        ),
      );
    };
    worker.onmessageerror = () => {
      settle(() => reject(new Error('Could not read data from the PDF worker')));
    };

    const start: ToPdfWorker = { type: 'start', count, options };
    worker.postMessage(start);
  });
}
