/**
 * The page's side of the factorization worker (browser only). One job runs at a time; a new
 * job or cancel() terminates the worker mid-search (a synchronous search cannot be interrupted
 * any other way) and the next job starts a fresh one.
 *
 * Where a module worker cannot start, the search runs on the page instead, with a much
 * shorter time limit so the page is never blocked for long.
 */

import { continueFactorization, type Factorization } from '../../../lib/math/factorize.ts';
import type { FromFactorWorker, ToFactorWorker } from './types.ts';

export interface FactorRun {
  result: Factorization;
  elapsedMs: number;
}

export interface FactorProgressUpdate {
  found: number;
  digits: number;
  elapsedMs: number;
}

/** How long the fallback may block the page, whatever time limit was asked for. */
const MAIN_THREAD_LIMIT_MS = 1500;

export function abortError(): DOMException {
  return new DOMException('Cancelled', 'AbortError');
}

export function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

interface Pending {
  id: number;
  values: readonly bigint[];
  timeLimitMs: number;
  resolve(run: FactorRun): void;
  reject(error: Error): void;
  onProgress?: (update: FactorProgressUpdate) => void;
}

export class FactorEngine {
  private worker: Worker | null = null;
  /** Whether the current worker has ever answered (a worker that fails before that never loaded). */
  private workerAnswered = false;
  /** False once a worker failed to load: later jobs go straight to the page. */
  private workersWork = true;
  private pending: Pending | null = null;
  private nextId = 1;

  /** Factors the product of `values`, stopping after about `timeLimitMs`. Rejects with an AbortError when cancelled. */
  run(values: readonly bigint[], timeLimitMs: number, onProgress?: (update: FactorProgressUpdate) => void): Promise<FactorRun> {
    this.cancel();
    const worker = this.ensureWorker();
    if (!worker) return this.runOnPage(values, timeLimitMs);

    const id = this.nextId++;
    return new Promise<FactorRun>((resolve, reject) => {
      this.pending = { id, values, timeLimitMs, resolve, reject, onProgress };
      const request: ToFactorWorker = { type: 'factor', id, values: values.map(String), timeLimitMs };
      worker.postMessage(request);
    });
  }

  /** Stops the running job, if any; its promise rejects with an AbortError. */
  cancel(): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    this.worker?.terminate();
    this.worker = null;
    pending.reject(abortError());
  }

  dispose(): void {
    this.cancel();
    this.worker?.terminate();
    this.worker = null;
  }

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (!this.workersWork || typeof Worker === 'undefined') return null;
    let worker: Worker;
    try {
      worker = new Worker(new URL('./factor-worker.ts', import.meta.url), { type: 'module' });
    } catch {
      this.workersWork = false;
      return null;
    }
    worker.onmessage = (event: MessageEvent<FromFactorWorker>) => this.onMessage(event.data);
    worker.onerror = (event) => {
      event.preventDefault();
      this.fail(new Error(event.message || 'Factor worker failed'));
    };
    worker.onmessageerror = () => this.fail(new Error('Factor worker sent an unreadable message'));
    this.worker = worker;
    this.workerAnswered = false;
    return worker;
  }

  private onMessage(message: FromFactorWorker): void {
    this.workerAnswered = true;
    const pending = this.pending;
    if (!pending || message.id !== pending.id) return;
    switch (message.type) {
      case 'progress':
        pending.onProgress?.({ found: message.found, digits: message.digits, elapsedMs: message.elapsedMs });
        break;
      case 'done':
        this.pending = null;
        pending.resolve({
          result: {
            factors: message.factors.map(([p, e]) => [BigInt(p), e] as const),
            unfactored: message.unfactored.map((value) => BigInt(value)),
            probable: message.probable.map((value) => BigInt(value)),
          },
          elapsedMs: message.elapsedMs,
        });
        break;
      case 'error':
        this.pending = null;
        pending.reject(new Error(message.message));
        break;
    }
  }

  /**
   * The worker died. One that never answered could not load at all (an old browser without
   * module workers, a blocked script): the job moves to the page, and so do later ones.
   * Otherwise the job fails and the next one starts a new worker.
   */
  private fail(error: Error): void {
    this.worker?.terminate();
    this.worker = null;
    const pending = this.pending;
    this.pending = null;
    if (!pending) return;
    if (!this.workerAnswered) {
      this.workersWork = false;
      this.runOnPage(pending.values, pending.timeLimitMs).then(pending.resolve, pending.reject);
      return;
    }
    pending.reject(error);
  }

  private runOnPage(values: readonly bigint[], timeLimitMs: number): Promise<FactorRun> {
    const limit = Math.min(timeLimitMs, MAIN_THREAD_LIMIT_MS);
    return new Promise((resolve, reject) => {
      // Let the page paint "Factoring…" first.
      window.setTimeout(() => {
        const start = performance.now();
        try {
          const result = continueFactorization(
            { factors: [], unfactored: [...values], probable: [] },
            { checkpoint: () => performance.now() - start >= limit },
          );
          resolve({ result, elapsedMs: performance.now() - start });
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      }, 30);
    });
  }
}
