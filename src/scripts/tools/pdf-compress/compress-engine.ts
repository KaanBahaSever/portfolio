/**
 * Talks to the compression Web Worker (browser only). The worker script, which contains
 * pdf-lib, is only fetched when the user picks a PDF, so it stays out of the page JavaScript.
 *
 * One session = one worker holding one parsed PDF, for one run. The worker is terminated
 * when the run ends (done, failed, cancelled or crashed); the session is then closed and
 * the page opens a new one from the File it still has for the next run.
 */

import type {
  CompressProgress,
  CompressResult,
  PdfSummary,
  TranscodeRequest,
  TranscodeResult,
} from '../../../lib/pdf/compress/compress-pdf.ts';
import type { CompressRunOptions, FailureCode, FromCompressWorker, ToCompressWorker } from './types.ts';

/** The worker script could not be loaded (offline, or a newer deployment replaced it). */
export class CompressEngineLoadError extends Error {
  constructor(cause?: unknown) {
    super('Could not load the PDF engine', { cause });
    this.name = 'CompressEngineLoadError';
  }
}

/** The worker reported a failure or stopped unexpectedly. */
export class CompressFailure extends Error {
  /** 'crashed': the worker died (usually out of memory). */
  readonly code: FailureCode | 'crashed';
  readonly originalName: string;

  constructor(code: FailureCode | 'crashed', message: string, originalName = 'Error') {
    super(message);
    this.name = 'CompressFailure';
    this.code = code;
    this.originalName = originalName;
  }
}

export interface CompressRunArgs extends CompressRunOptions {
  signal: AbortSignal;
  onProgress: (progress: CompressProgress) => void;
  /** Encodes one image on the page; `signal` aborts when the run ends for any reason. */
  transcode: (request: TranscodeRequest, signal: AbortSignal, index: number, total: number) => Promise<TranscodeResult | null>;
}

export interface CompressSession {
  readonly summary: PdfSummary;
  /** False once the worker has been terminated (cancel, crash or dispose). */
  readonly alive: boolean;
  compress(args: CompressRunArgs): Promise<CompressResult>;
  dispose(): void;
}

function abortError(): DOMException {
  return new DOMException('Cancelled', 'AbortError');
}

function failureFrom(message: Extract<FromCompressWorker, { type: 'error' }>): CompressFailure {
  return new CompressFailure(message.code, message.message, message.name);
}

interface Pending {
  onMessage(message: FromCompressWorker): void;
  fail(error: Error): void;
}

/**
 * Starts a worker and opens `bytes` in it (the buffer is transferred: it is detached
 * here afterwards). Resolves once the PDF has been parsed and summarized.
 */
export function openCompressSession(bytes: ArrayBuffer, maxImagePixels: number, signal: AbortSignal): Promise<CompressSession> {
  return new Promise((resolveOpen, rejectOpen) => {
    if (signal.aborted) {
      rejectOpen(abortError());
      return;
    }
    let worker: Worker;
    try {
      worker = new Worker(new URL('./compress-worker.ts', import.meta.url), { type: 'module' });
    } catch (error) {
      rejectOpen(new CompressEngineLoadError(error));
      return;
    }

    let started = false;
    let alive = true;
    let pending: Pending | null = null;
    let summary: PdfSummary | null = null;
    let lastRunId = 0;

    function dispose(): void {
      if (!alive) return;
      alive = false;
      worker.terminate();
      const current = pending;
      pending = null;
      current?.fail(abortError());
    }

    worker.onmessage = (event: MessageEvent<FromCompressWorker>) => {
      started = true;
      if (event.data.type !== 'ready') pending?.onMessage(event.data);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      const error = started
        ? new CompressFailure('crashed', 'The PDF worker stopped unexpectedly (the device may be out of memory)')
        : new CompressEngineLoadError(event.message);
      const current = pending;
      pending = null;
      alive = false;
      worker.terminate();
      current?.fail(error);
    };
    worker.onmessageerror = () => {
      const current = pending;
      pending = null;
      alive = false;
      worker.terminate();
      current?.fail(new CompressFailure('unknown', 'Could not read data from the PDF worker'));
    };

    function compress(args: CompressRunArgs): Promise<CompressResult> {
      return new Promise((resolve, reject) => {
        if (args.signal.aborted) {
          reject(abortError());
          return;
        }
        if (!alive) {
          reject(new CompressFailure('crashed', 'The PDF worker is no longer running'));
          return;
        }
        if (pending) {
          reject(new Error('A compression is already running'));
          return;
        }
        const runId = ++lastRunId;
        const local = new AbortController();
        let transcoding: Promise<unknown> = Promise.resolve();
        let settled = false;

        function settle(report: () => void, terminate: boolean): void {
          if (settled) return;
          settled = true;
          if (pending === run) pending = null;
          args.signal.removeEventListener('abort', onAbort);
          local.abort();
          if (terminate) dispose();
          // Report once the image being encoded on the page has stopped too, so a new run
          // never works alongside it.
          void transcoding.then(report, report);
        }

        function onAbort(): void {
          // terminate() stops pdf-lib at once, wherever it is (also in the middle of saving).
          settle(() => reject(abortError()), true);
        }

        const run: Pending = {
          onMessage(message) {
            if ('runId' in message && message.runId !== runId) return;
            switch (message.type) {
              case 'progress':
                if (!settled) args.onProgress(message.progress);
                break;
              case 'need-transcode': {
                const { requestId, request, index, total } = message;
                const task = args.transcode(request, local.signal, index, total);
                transcoding = task.catch(() => undefined);
                task.then(
                  (result) => {
                    if (settled) return;
                    const reply: ToCompressWorker = { type: 'transcoded', runId, requestId, result };
                    worker.postMessage(reply, result ? [result.bytes.buffer as ArrayBuffer] : []);
                  },
                  (error: unknown) => settle(() => reject(error), true),
                );
                break;
              }
              case 'done':
                // A worker serves one run (it does not keep the file's bytes, see compress-worker.ts):
                // free its memory now; the page opens a new session for the next run.
                settle(() => resolve({ bytes: message.bytes, stats: message.stats }), true);
                break;
              case 'error':
                // Start the next run from a fresh worker: memory may be fragmented or exhausted.
                settle(() => reject(failureFrom(message)), true);
                break;
              default:
                break;
            }
          },
          fail(error) {
            settle(() => reject(error), false);
          },
        };

        pending = run;
        args.signal.addEventListener('abort', onAbort);
        const start: ToCompressWorker = {
          type: 'compress',
          runId,
          level: args.level,
          stripMetadata: args.stripMetadata,
        };
        worker.postMessage(start);
      });
    }

    const session: CompressSession = {
      get summary() {
        if (!summary) throw new Error('The PDF is not open yet');
        return summary;
      },
      get alive() {
        return alive;
      },
      compress,
      dispose,
    };

    function onOpenAbort(): void {
      dispose();
    }

    pending = {
      onMessage(message) {
        if (message.type === 'opened') {
          pending = null;
          signal.removeEventListener('abort', onOpenAbort);
          summary = message.summary;
          resolveOpen(session);
        } else if (message.type === 'error' && message.runId === null) {
          pending = null;
          signal.removeEventListener('abort', onOpenAbort);
          dispose();
          rejectOpen(failureFrom(message));
        }
      },
      fail(error) {
        signal.removeEventListener('abort', onOpenAbort);
        rejectOpen(error);
      },
    };
    signal.addEventListener('abort', onOpenAbort);

    const open: ToCompressWorker = { type: 'open', bytes, maxImagePixels };
    worker.postMessage(open, [bytes]);
  });
}
