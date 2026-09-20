/**
 * Talks to the split worker (browser only). The worker script, which contains pdf-lib, is
 * only fetched when the person picks a PDF, so it stays out of the page JavaScript.
 *
 * One worker holds the parsed source PDF. Cancelling terminates it; the next run then
 * reads the file again (the File object is kept, its bytes were moved to the worker).
 * A new file gets a new worker, so the previous document is freed before it is read.
 */

import type { FromSplitWorker, OutputFileInfo, OutputRequest, SplitStage, ToSplitWorker } from './types.ts';

/** The worker script could not be loaded (offline, or a newer deployment replaced it). */
export class PdfEngineLoadError extends Error {
  constructor(cause?: unknown) {
    super('Could not load the PDF engine', { cause });
    this.name = 'PdfEngineLoadError';
  }
}

/** The browser could not read the chosen file (moved, deleted or changed since it was picked). */
export class FileReadError extends Error {
  constructor(cause?: unknown) {
    super('Could not read the file', { cause });
    this.name = 'FileReadError';
  }
}

/** The worker died while working, usually because the device ran out of memory. */
export class WorkerCrashError extends Error {
  constructor(cause?: unknown) {
    super('The PDF worker stopped unexpectedly', { cause });
    this.name = 'WorkerCrashError';
  }
}

export interface PdfSummary {
  pageCount: number;
  title?: string;
}

export interface SplitProgress {
  stage: SplitStage;
  done: number;
  total: number;
}

export type SplitResult =
  | { kind: 'pdf'; blob: Blob; file: OutputFileInfo }
  | { kind: 'zip'; blob: Blob; files: OutputFileInfo[] };

export interface SplitEngine {
  /** Parses a new file in the worker (replacing the previous one). */
  load(file: File, signal: AbortSignal): Promise<PdfSummary>;
  /** Creates the outputs from the loaded file. Several outputs come back as one ZIP. */
  split(outputs: OutputRequest[], options: { signal: AbortSignal; onProgress: (progress: SplitProgress) => void }): Promise<SplitResult>;
  /** Stops the worker and forgets the file. */
  dispose(): void;
}

/** No message at all from a new worker within this time means its script never loaded. */
const WORKER_START_TIMEOUT_MS = 45_000;

function abortError(): DOMException {
  return new DOMException('Cancelled', 'AbortError');
}

function reviveError(name: string, message: string): Error {
  const error = name === 'RangeError' ? new RangeError(message) : new Error(message);
  error.name = name;
  return error;
}

interface PendingRequest {
  id: number;
  resolve: (message: FromSplitWorker) => void;
  reject: (error: unknown) => void;
  onProgress?: (progress: SplitProgress) => void;
}

export function createSplitEngine(): SplitEngine {
  let worker: Worker | null = null;
  let workerStarted = false;
  let startTimer = 0;
  let pending: PendingRequest | null = null;
  let sourceFile: File | null = null;
  /** The worker holds the parsed `sourceFile`. */
  let sourceReady = false;
  let nextId = 1;

  function stopWorker(): void {
    window.clearTimeout(startTimer);
    worker?.terminate();
    worker = null;
    workerStarted = false;
    sourceReady = false;
  }

  function fail(error: unknown): void {
    const request = pending;
    pending = null;
    stopWorker();
    request?.reject(error);
  }

  function getWorker(): Worker {
    if (worker) return worker;
    let created: Worker;
    try {
      created = new Worker(new URL('./split-worker.ts', import.meta.url), { type: 'module' });
    } catch (error) {
      throw new PdfEngineLoadError(error);
    }
    worker = created;
    workerStarted = false;

    // Some browsers never fire `error` when a module worker fails to load.
    startTimer = window.setTimeout(() => {
      if (worker === created && !workerStarted) fail(new PdfEngineLoadError('timeout'));
    }, WORKER_START_TIMEOUT_MS);

    created.onmessage = (event: MessageEvent<FromSplitWorker>) => {
      if (worker !== created) return;
      if (!workerStarted) {
        workerStarted = true;
        window.clearTimeout(startTimer);
      }
      const message = event.data;
      if (message.type === 'ready' || !pending || message.id !== pending.id) return;
      if (message.type === 'progress') {
        pending.onProgress?.({ stage: message.stage, done: message.done, total: message.total });
        return;
      }
      const request = pending;
      pending = null;
      if (message.type === 'error') request.reject(reviveError(message.name, message.message));
      else request.resolve(message);
    };

    created.onerror = (event) => {
      event.preventDefault();
      if (worker !== created) return;
      fail(workerStarted ? new WorkerCrashError(event.message) : new PdfEngineLoadError(event.message));
    };

    created.onmessageerror = () => {
      if (worker !== created) return;
      fail(new Error('Could not read data from the PDF worker'));
    };

    return created;
  }

  function request(
    message: ToSplitWorker,
    transfer: Transferable[],
    signal: AbortSignal,
    onProgress?: (progress: SplitProgress) => void,
  ): Promise<FromSplitWorker> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(abortError());
        return;
      }
      if (pending) {
        reject(new Error('The PDF engine is busy'));
        return;
      }

      const onAbort = () => {
        if (pending?.id !== message.id) return;
        pending = null;
        // terminate() stops pdf-lib at once, also in the middle of saving.
        stopWorker();
        reject(abortError());
      };

      try {
        const target = getWorker();
        signal.addEventListener('abort', onAbort, { once: true });
        pending = {
          id: message.id,
          onProgress,
          resolve: (reply) => {
            signal.removeEventListener('abort', onAbort);
            resolve(reply);
          },
          reject: (error) => {
            signal.removeEventListener('abort', onAbort);
            reject(error);
          },
        };
        target.postMessage(message, transfer);
      } catch (error) {
        signal.removeEventListener('abort', onAbort);
        pending = null;
        reject(error);
      }
    });
  }

  async function loadSource(file: File, signal: AbortSignal): Promise<PdfSummary> {
    getWorker(); // start fetching the engine while the file is being read
    let buffer: ArrayBuffer;
    try {
      buffer = await file.arrayBuffer();
    } catch (error) {
      throw new FileReadError(error);
    }
    if (signal.aborted) throw abortError();
    const id = nextId++;
    // The buffer is moved to the worker, not copied.
    const reply = await request({ type: 'load', id, bytes: new Uint8Array(buffer) }, [buffer], signal);
    if (reply.type !== 'loaded') throw new Error('Unexpected reply from the PDF worker');
    if (sourceFile === file) sourceReady = true;
    return reply.title ? { pageCount: reply.pageCount, title: reply.title } : { pageCount: reply.pageCount };
  }

  return {
    load(file, signal) {
      // A new file replaces the current one, including any work still running on it. A new
      // worker also frees the previous parsed PDF at once, before the next file is read.
      if (pending) fail(abortError());
      else stopWorker();
      sourceFile = file;
      sourceReady = false;
      return loadSource(file, signal);
    },

    async split(outputs, { signal, onProgress }) {
      const file = sourceFile;
      if (!file) throw new Error('No PDF is loaded');
      if (!sourceReady || !worker) {
        // Cancelled or crashed before: the worker (and the parsed PDF) are gone.
        onProgress({ stage: 'reading', done: 0, total: outputs.length });
        await loadSource(file, signal);
      }
      const id = nextId++;
      const reply = await request({ type: 'split', id, outputs, zip: outputs.length > 1 }, [], signal, onProgress);
      // The worker already stored the result in a Blob: no copy is made here.
      if (reply.type === 'pdf') return { kind: 'pdf', blob: reply.blob, file: reply.file };
      if (reply.type === 'zip') return { kind: 'zip', blob: reply.blob, files: reply.files };
      throw new Error('Unexpected reply from the PDF worker');
    },

    dispose() {
      if (pending) fail(abortError());
      stopWorker();
      sourceFile = null;
    },
  };
}
