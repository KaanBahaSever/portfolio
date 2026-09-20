import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performSearchTask } from '../src/scripts/tools/notepad/search-task.ts';
import type { SearchWorkerRequest, SearchWorkerResponse } from '../src/scripts/tools/notepad/types.ts';

/**
 * A stand-in for the search worker: answers like search-worker.ts after a few milliseconds, except
 * that the pattern HANG never finishes and SLOW takes a while.
 */
class FakeWorker {
  static instances: FakeWorker[] = [];
  static failToCreate = false;
  static failToLoad = false;

  onmessage: ((event: { data: SearchWorkerResponse }) => void) | null = null;
  onerror: ((event: { preventDefault(): void }) => void) | null = null;
  messages: SearchWorkerRequest[] = [];
  terminated = false;
  /** Answer the next request as if the text had been lost. */
  forgetText = false;
  private text = '';
  private version = -1;

  constructor() {
    if (FakeWorker.failToCreate) throw new Error('Workers are not supported');
    FakeWorker.instances.push(this);
  }

  postMessage(message: SearchWorkerRequest): void {
    this.messages.push(structuredClone(message));
    if (FakeWorker.failToLoad) {
      setTimeout(() => this.onerror?.({ preventDefault() {} }), 1);
      return;
    }
    if (message.source === 'HANG') return;
    setTimeout(() => this.answer(message), message.source === 'SLOW' ? 60 : 2);
  }

  private answer(message: SearchWorkerRequest): void {
    if (this.terminated) return;
    if (this.forgetText) {
      this.forgetText = false;
      this.version = -1;
    } else if (message.text !== undefined) {
      this.text = message.text;
      this.version = message.version;
    }
    const response: SearchWorkerResponse =
      message.version === this.version && message.length === this.text.length
        ? performSearchTask(message.id, this.text, message.source, message.flags, message.task)
        : { id: message.id, status: 'missing-text' };
    this.onmessage?.({ data: structuredClone(response) });
  }

  terminate(): void {
    this.terminated = true;
  }
}

const globals = globalThis as unknown as Record<string, unknown>;
globals.window = globalThis;
globals.Worker = FakeWorker;

const { createSearchRunner } = await import('../src/scripts/tools/notepad/search-runner.ts');

function reset(): void {
  FakeWorker.instances = [];
  FakeWorker.failToCreate = false;
  FakeWorker.failToLoad = false;
}

const around = { kind: 'around', offset: 0 } as const;

function starts(outcome: { status: string; result?: { matches: { start: number }[] } }): number[] {
  assert.equal(outcome.status, 'done');
  return outcome.result!.matches.map((match) => match.start);
}

test('searches run in the worker, which gets the text only when it changed', async () => {
  reset();
  const runner = createSearchRunner();
  const input = { text: 'a b a', version: 1, regex: /a/gu, timeout: 1000 };
  assert.deepEqual(starts(await runner.findWindow(input, around)), [0, 4]);
  assert.deepEqual(starts(await runner.findWindow({ ...input, regex: /b/gu }, around)), [2]);
  assert.deepEqual(starts(await runner.findWindow({ ...input, text: 'aa', version: 2 }, around)), [0, 1]);
  const [worker] = FakeWorker.instances;
  assert.equal(FakeWorker.instances.length, 1);
  assert.deepEqual(
    worker!.messages.map((message) => message.text),
    ['a b a', undefined, 'aa'],
  );

  const replaced = await runner.replaceAll({ ...input, text: 'aa', version: 2 }, '[$&]', true);
  assert.deepEqual(replaced, { status: 'done', result: { text: '[a][a]', count: 2 } });
  runner.dispose();
  assert.equal(worker!.terminated, true);
});

test('a search that takes too long times out and stops the worker', async () => {
  reset();
  const runner = createSearchRunner();
  const started = Date.now();
  const outcome = await runner.findWindow({ text: 'aaaa!', version: 1, regex: /HANG/gu, timeout: 40 }, around);
  assert.deepEqual(outcome, { status: 'timeout' });
  assert.ok(Date.now() - started < 1000);
  assert.equal(FakeWorker.instances[0]!.terminated, true);

  // The next search starts a new worker and sends the text again.
  assert.deepEqual(starts(await runner.findWindow({ text: 'aaaa!', version: 1, regex: /!/gu, timeout: 1000 }, around)), [4]);
  assert.equal(FakeWorker.instances.length, 2);
  assert.equal(FakeWorker.instances[1]!.messages[0]!.text, 'aaaa!');
  runner.dispose();
});

test('a newer search cancels the older one, and a worker stuck on it is replaced', async () => {
  reset();
  const runner = createSearchRunner();
  const stuck = runner.findWindow({ text: 'abc', version: 1, regex: /HANG/gu, timeout: 60_000 }, around);
  const newer = runner.findWindow({ text: 'abc', version: 1, regex: /c/gu, timeout: 60_000 }, around);
  assert.deepEqual(await stuck, { status: 'cancelled' });
  assert.deepEqual(starts(await newer), [2]);
  assert.equal(FakeWorker.instances.length, 2);
  assert.equal(FakeWorker.instances[0]!.terminated, true);
  assert.equal(FakeWorker.instances[1]!.terminated, false);

  // Only the latest of several queued searches runs.
  const first = runner.findWindow({ text: 'abc', version: 1, regex: /a/gu, timeout: 1000 }, around);
  const second = runner.findWindow({ text: 'abc', version: 1, regex: /b/gu, timeout: 1000 }, around);
  const third = runner.findWindow({ text: 'abc', version: 1, regex: /c/gu, timeout: 1000 }, around);
  assert.deepEqual(await first, { status: 'cancelled' });
  assert.deepEqual(await second, { status: 'cancelled' });
  assert.deepEqual(starts(await third), [2]);
  runner.cancelFinds();
  runner.dispose();
});

test('Replace all is not cancelled by a search, which waits for it', async () => {
  reset();
  const runner = createSearchRunner();
  const order: string[] = [];
  const replace = runner
    .replaceAll({ text: 'x SLOW', version: 1, regex: /SLOW/gu, timeout: 1000 }, 'fast', true)
    .then((outcome) => {
      order.push('replace');
      return outcome;
    });
  const find = runner.findWindow({ text: 'x SLOW', version: 1, regex: /x/gu, timeout: 1000 }, around).then((outcome) => {
    order.push('find');
    return outcome;
  });
  assert.deepEqual(await replace, { status: 'done', result: { text: 'x fast', count: 1 } });
  assert.deepEqual(starts(await find), [0]);
  assert.deepEqual(order, ['replace', 'find']);
  assert.equal(FakeWorker.instances.length, 1);

  // dispose cancels a running Replace all.
  const cancelled = runner.replaceAll({ text: 'x', version: 2, regex: /HANG/gu, timeout: 60_000 }, '', true);
  runner.dispose();
  assert.deepEqual(await cancelled, { status: 'cancelled' });
  assert.equal(FakeWorker.instances[0]!.terminated, true);
});

test('a worker that lost the text is sent it again', async () => {
  reset();
  const runner = createSearchRunner();
  const input = { text: 'hello', version: 7, regex: /l/gu, timeout: 1000 };
  await runner.findWindow(input, around);
  const worker = FakeWorker.instances[0]!;
  worker.forgetText = true;
  assert.deepEqual(starts(await runner.findWindow(input, around)), [2, 3]);
  assert.deepEqual(
    worker.messages.map((message) => message.text),
    ['hello', undefined, 'hello'],
  );
  runner.dispose();
});

test('without workers the page searches itself', async () => {
  reset();
  FakeWorker.failToCreate = true;
  const unsupported = createSearchRunner();
  assert.deepEqual(starts(await unsupported.findWindow({ text: 'aXa', version: 1, regex: /a/gu, timeout: 10 }, around)), [0, 2]);

  reset();
  FakeWorker.failToLoad = true;
  const broken = createSearchRunner();
  assert.deepEqual(starts(await broken.findWindow({ text: 'aXa', version: 1, regex: /X/gu, timeout: 1000 }, around)), [1]);
  assert.equal(FakeWorker.instances.length, 1);
  // Later searches don't try another worker.
  assert.deepEqual(starts(await broken.findWindow({ text: 'aXa', version: 1, regex: /a/gu, timeout: 1000 }, around)), [0, 2]);
  assert.equal(FakeWorker.instances.length, 1);
  reset();
});

test('a failing search reports why', async () => {
  reset();
  const runner = createSearchRunner();
  const outcome = await runner.findWindow({ text: 'abc', version: 1, regex: { source: '(', flags: 'u' } as RegExp, timeout: 1000 }, around);
  assert.equal(outcome.status, 'failed');
  assert.equal((outcome as { tooLarge: boolean }).tooLarge, false);
  runner.dispose();
});
