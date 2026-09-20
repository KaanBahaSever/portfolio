/**
 * Regular-expression searches off the main thread (browser only).
 *
 * JavaScript regular expressions have no step limit: nested quantifiers such as (\w+\s?)+$ can
 * backtrack for hours on one long line. Searches therefore run in a Web Worker that is created on
 * demand; one that takes too long is abandoned and the worker terminated, so the page (and the
 * unsaved text) stays usable. If no worker can start, the page searches itself.
 */

import type { MatchWindow, WindowRequest } from '../../../lib/text/search.ts';
import { performSearchTask } from './search-task.ts';
import type { SearchTask, SearchWorkerRequest, SearchWorkerResponse } from './types.ts';

export type SearchOutcome<T> =
  | { status: 'done'; result: T }
  /** Took longer than its timeout; the worker was stopped. */
  | { status: 'timeout' }
  /** Replaced by a newer search, or cancelled. */
  | { status: 'cancelled' }
  | { status: 'failed'; message: string; tooLarge: boolean };

export interface SearchInput {
  text: string;
  /** Changes whenever the text changes: the worker keeps the text it was last sent for its version. */
  version: number;
  regex: RegExp;
  /** Milliseconds before the search is abandoned. */
  timeout: number;
}

export interface SearchRunner {
  /** Finds matches. A newer findWindow call (or cancelFinds) cancels this one. */
  findWindow(input: SearchInput, request: WindowRequest): Promise<SearchOutcome<MatchWindow>>;
  replaceAll(
    input: SearchInput,
    template: string,
    isRegex: boolean,
  ): Promise<SearchOutcome<{ text: string; count: number }>>;
  /** Cancels pending finds (not Replace all). */
  cancelFinds(): void;
  /** Cancels everything and stops the worker, releasing its copy of the text. */
  dispose(): void;
}

type Settlement = SearchWorkerResponse | 'timeout' | 'cancelled';

interface Job {
  id: number;
  kind: 'find' | 'replace';
  input: SearchInput;
  task: SearchTask;
  settled: boolean;
  settle(result: Settlement): void;
}

interface Running {
  job: Job;
  timer: number;
  startedAt: number;
  /** Cancelled while the worker was busy with it: the worker is stopped unless it finishes soon. */
  stale: boolean;
}

/**
 * How long a cancelled search may keep the worker busy before the worker is stopped. Longer texts
 * get longer, because a new worker needs the whole text sent again.
 */
function staleGrace(length: number): number {
  return Math.min(1000, 150 + Math.round(length / 20_000));
}

function toOutcome<T>(settlement: Settlement, pick: (response: SearchWorkerResponse) => T | undefined): SearchOutcome<T> {
  if (settlement === 'timeout') return { status: 'timeout' };
  if (settlement === 'cancelled') return { status: 'cancelled' };
  if (settlement.status === 'failed') {
    return { status: 'failed', message: settlement.message, tooLarge: settlement.tooLarge };
  }
  const result = pick(settlement);
  return result === undefined
    ? { status: 'failed', message: 'Unexpected search result', tooLarge: false }
    : { status: 'done', result };
}

export function createSearchRunner(): SearchRunner {
  let nextId = 0;
  let worker: Worker | null = null;
  /** No worker can start here: search on the page. */
  let workerUnavailable = false;
  /** A worker has answered before, so workers do start here. */
  let workersStart = false;
  /** Text version the current worker holds (-1: none). */
  let workerVersion = -1;
  let running: Running | null = null;
  const queue: Job[] = [];

  function stopWorker(): void {
    worker?.terminate();
    worker = null;
    workerVersion = -1;
  }

  function getWorker(): Worker | null {
    if (worker || workerUnavailable) return worker;
    let instance: Worker;
    try {
      instance = new Worker(new URL('./search-worker.ts', import.meta.url), { type: 'module' });
    } catch {
      workerUnavailable = true;
      return null;
    }
    instance.onmessage = (event: MessageEvent<SearchWorkerResponse>) => {
      if (instance === worker) onResponse(event.data);
    };
    instance.onerror = (event) => {
      event.preventDefault();
      if (instance === worker) onWorkerError();
    };
    worker = instance;
    return instance;
  }

  function onResponse(response: SearchWorkerResponse): void {
    const current = running;
    if (!current || response.id !== current.job.id) return;
    workersStart = true;
    window.clearTimeout(current.timer);
    running = null;
    if (response.status === 'missing-text') {
      workerVersion = -1;
      if (!current.job.settled) queue.unshift(current.job); // sent again, with the text
    } else {
      current.job.settle(response);
    }
    pump();
  }

  function onWorkerError(): void {
    const current = running;
    if (current) window.clearTimeout(current.timer);
    running = null;
    stopWorker();
    if (!workersStart) {
      // Module workers are unsupported or the script didn't load.
      workerUnavailable = true;
      if (current && !current.job.settled) queue.unshift(current.job);
    } else if (current) {
      current.job.settle({ id: current.job.id, status: 'failed', message: 'The search stopped unexpectedly.', tooLarge: false });
    }
    pump();
  }

  function onTimeout(): void {
    const current = running;
    if (!current) return;
    running = null;
    stopWorker();
    current.job.settle('timeout'); // no effect on a cancelled search
    pump();
  }

  function start(job: Job): void {
    const { text, version, regex, timeout } = job.input;
    const target = getWorker();
    if (!target) {
      job.settle(performSearchTask(job.id, text, regex.source, regex.flags, job.task));
      return;
    }
    const message: SearchWorkerRequest = {
      id: job.id,
      version,
      length: text.length,
      source: regex.source,
      flags: regex.flags,
      task: job.task,
    };
    if (workerVersion !== version) message.text = text;
    try {
      target.postMessage(message);
    } catch (error) {
      stopWorker();
      const detail = error instanceof Error ? error.message : String(error);
      job.settle({ id: job.id, status: 'failed', message: detail, tooLarge: false });
      return;
    }
    workerVersion = version;
    running = { job, startedAt: performance.now(), stale: false, timer: window.setTimeout(onTimeout, timeout) };
  }

  function pump(): void {
    while (!running && queue.length > 0) {
      const job = queue.shift()!;
      if (!job.settled) start(job);
    }
  }

  function markStale(current: Running): void {
    if (current.stale) return;
    current.stale = true;
    current.job.settle('cancelled');
    window.clearTimeout(current.timer);
    const { text, timeout } = current.job.input;
    const deadline = current.startedAt + Math.min(timeout, staleGrace(text.length));
    current.timer = window.setTimeout(onTimeout, Math.max(0, deadline - performance.now()));
  }

  function cancelFinds(): void {
    for (let i = queue.length - 1; i >= 0; i--) {
      const job = queue[i]!;
      if (job.kind === 'find') {
        job.settle('cancelled');
        queue.splice(i, 1);
      }
    }
    if (running && running.job.kind === 'find') markStale(running);
  }

  function submit(kind: Job['kind'], input: SearchInput, task: SearchTask): Promise<Settlement> {
    return new Promise((resolve) => {
      const job: Job = {
        id: ++nextId,
        kind,
        input,
        task,
        settled: false,
        settle(result) {
          if (job.settled) return;
          job.settled = true;
          resolve(result);
        },
      };
      if (kind === 'find') cancelFinds();
      queue.push(job);
      pump();
    });
  }

  return {
    async findWindow(input, request) {
      const settlement = await submit('find', input, { op: 'window', request });
      return toOutcome(settlement, (response) => (response.status === 'window' ? response.window : undefined));
    },
    async replaceAll(input, template, isRegex) {
      const settlement = await submit('replace', input, { op: 'replaceAll', template, isRegex });
      return toOutcome(settlement, (response) =>
        response.status === 'replaced' ? { text: response.text, count: response.count } : undefined,
      );
    },
    cancelFinds,
    dispose() {
      for (const job of queue.splice(0)) job.settle('cancelled');
      if (running) {
        window.clearTimeout(running.timer);
        running.job.settle('cancelled');
        running = null;
      }
      stopWorker();
    },
  };
}
