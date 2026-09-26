/**
 * Module Web Worker that factors numbers (browser only), so a search of several seconds never
 * freezes the page. The search is synchronous; the page cancels it by terminating the worker,
 * and the worker stops by itself at the request's time limit, reporting what it could not
 * split. Progress is posted at most every PROGRESS_INTERVAL_MS.
 */

import { continueFactorization } from '../../../lib/math/factorize.ts';
import type { FromFactorWorker, ToFactorWorker } from './types.ts';

const scope = self as unknown as {
  postMessage(message: FromFactorWorker): void;
  onmessage: ((event: MessageEvent<ToFactorWorker>) => void) | null;
};

const PROGRESS_INTERVAL_MS = 150;

scope.onmessage = (event) => {
  const request = event.data;
  if (request.type !== 'factor') return;
  const { id } = request;
  const start = performance.now();
  const deadline = start + request.timeLimitMs;
  let lastPost = start;
  try {
    const result = continueFactorization(
      { factors: [], unfactored: request.values.map((value) => BigInt(value)), probable: [] },
      {
        checkpoint(progress) {
          const now = performance.now();
          if (now - lastPost >= PROGRESS_INTERVAL_MS) {
            lastPost = now;
            scope.postMessage({ type: 'progress', id, found: progress.found, digits: progress.digits, elapsedMs: now - start });
          }
          return now >= deadline;
        },
      },
    );
    scope.postMessage({
      type: 'done',
      id,
      factors: result.factors.map(([p, e]) => [p.toString(), e]),
      unfactored: result.unfactored.map(String),
      probable: result.probable.map(String),
      elapsedMs: performance.now() - start,
    });
  } catch (error) {
    scope.postMessage({ type: 'error', id, message: error instanceof Error ? error.message : String(error) });
  }
};
