import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SearchWorkerRequest, SearchWorkerResponse } from '../src/scripts/tools/notepad/types.ts';

const posted: SearchWorkerResponse[] = [];
const scope = {
  postMessage(message: SearchWorkerResponse) {
    posted.push(message);
  },
  onmessage: null as ((event: { data: SearchWorkerRequest }) => void) | null,
};
(globalThis as unknown as { self: typeof scope }).self = scope;
await import('../src/scripts/tools/notepad/search-worker.ts');

function send(request: SearchWorkerRequest): SearchWorkerResponse {
  scope.onmessage!({ data: request });
  return posted.pop()!;
}

test('the search worker keeps the text between requests', () => {
  const found = send({
    id: 1,
    version: 3,
    length: 5,
    text: 'a b a',
    source: 'a',
    flags: 'gu',
    task: { op: 'window', request: { kind: 'around', offset: 0 } },
  });
  assert.equal(found.status, 'window');
  assert.deepEqual(
    (found as { window: { matches: { start: number }[] } }).window.matches.map((match) => match.start),
    [0, 4],
  );

  assert.deepEqual(
    send({ id: 2, version: 3, length: 5, source: 'b', flags: 'gu', task: { op: 'replaceAll', template: '[$&]', isRegex: true } }),
    { id: 2, status: 'replaced', text: 'a [b] a', count: 1 },
  );

  // Another version, or a length that doesn't fit, needs the text.
  const task = { op: 'window', request: { kind: 'after', offset: 0 } } as const;
  assert.deepEqual(send({ id: 3, version: 4, length: 5, source: 'a', flags: 'gu', task }), { id: 3, status: 'missing-text' });
  assert.deepEqual(send({ id: 4, version: 3, length: 6, source: 'a', flags: 'gu', task }), { id: 4, status: 'missing-text' });

  const failed = send({ id: 5, version: 3, length: 5, source: '(', flags: 'u', task });
  assert.equal(failed.status, 'failed');
});
