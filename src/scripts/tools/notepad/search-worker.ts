/**
 * Web Worker that runs regular-expression searches (browser only). A pattern can backtrack for
 * hours (such as (a+)+$ on "aaa…b"); here that never freezes the page, and the page terminates
 * the worker when a search takes too long.
 */

import { performSearchTask } from './search-task.ts';
import type { SearchWorkerRequest, SearchWorkerResponse } from './types.ts';

const scope = self as unknown as {
  postMessage(message: SearchWorkerResponse): void;
  onmessage: ((event: MessageEvent<SearchWorkerRequest>) => void) | null;
};

/** The last text sent, so typing a query doesn't copy the whole text over for every keystroke. */
let cachedText = '';
let cachedVersion = -1;

scope.onmessage = (event) => {
  const { id, version, length, text, source, flags, task } = event.data;
  if (text !== undefined) {
    cachedText = text;
    cachedVersion = version;
  }
  if (version !== cachedVersion || length !== cachedText.length) {
    scope.postMessage({ id, status: 'missing-text' });
    return;
  }
  scope.postMessage(performSearchTask(id, cachedText, source, flags, task));
};
