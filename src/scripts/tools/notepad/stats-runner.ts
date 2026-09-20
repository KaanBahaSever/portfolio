/**
 * Debounced text statistics (browser only). Long texts are measured in a Web Worker that
 * is only created once a text is that long; if it cannot start, the page measures itself.
 */

import { computeStats } from '../../../lib/text/stats.ts';
import type { LineEnding, TextStats } from '../../../lib/text/stats.ts';
import type { StatsRequest, StatsResponse } from './types.ts';

/** Texts at least this long (UTF-16 units) are measured in the worker. */
const WORKER_THRESHOLD = 100_000;

export interface StatsRunnerOptions {
  getText: () => string;
  getLineEnding: () => LineEnding;
  onStats: (stats: TextStats, length: number) => void;
}

export interface StatsRunner {
  /** Recomputes after a pause that grows with the text length, or right away. */
  schedule(immediate?: boolean): void;
}

function delayFor(length: number): number {
  if (length < 50_000) return 150;
  if (length < 500_000) return 400;
  return 800;
}

export function createStatsRunner({ getText, getLineEnding, onStats }: StatsRunnerOptions): StatsRunner {
  let timer = 0;
  let latestId = 0;
  let lastLength = 0;
  let worker: Worker | null = null;
  let workerFailed = false;
  let pending: StatsRequest | null = null;

  function computeHere(request: StatsRequest): void {
    onStats(computeStats(request.text, { lineEnding: request.lineEnding }), request.text.length);
  }

  function failWorker(): void {
    workerFailed = true;
    worker?.terminate();
    worker = null;
    const request = pending;
    pending = null;
    if (request && request.id === latestId) computeHere(request);
  }

  function getWorker(): Worker | null {
    if (worker || workerFailed) return worker;
    try {
      worker = new Worker(new URL('./stats-worker.ts', import.meta.url), { type: 'module' });
    } catch {
      workerFailed = true;
      return null;
    }
    worker.onmessage = (event: MessageEvent<StatsResponse>) => {
      const { id, stats } = event.data;
      if (id !== latestId || !pending) return; // a newer request is on its way
      const length = pending.text.length;
      pending = null;
      onStats(stats, length);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      failWorker();
    };
    return worker;
  }

  function run(): void {
    timer = 0;
    const request: StatsRequest = { id: ++latestId, text: getText(), lineEnding: getLineEnding() };
    lastLength = request.text.length;
    const target = request.text.length >= WORKER_THRESHOLD ? getWorker() : null;
    if (!target) {
      pending = null;
      computeHere(request);
      return;
    }
    pending = request;
    try {
      target.postMessage(request);
    } catch {
      failWorker();
    }
  }

  return {
    schedule(immediate = false) {
      window.clearTimeout(timer);
      if (immediate) run();
      else timer = window.setTimeout(run, delayFor(lastLength));
    },
  };
}
