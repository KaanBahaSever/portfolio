/**
 * One find or Replace all request, run by the search worker (or by the page when no worker can start).
 * No DOM.
 */

import { findMatchWindow, replaceAllInText } from '../../../lib/text/search.ts';
import type { SearchTask, SearchWorkerResponse } from './types.ts';

export function performSearchTask(
  id: number,
  text: string,
  source: string,
  flags: string,
  task: SearchTask,
): SearchWorkerResponse {
  try {
    const regex = new RegExp(source, flags);
    if (task.op === 'window') {
      return { id, status: 'window', window: findMatchWindow(text, regex, task.request) };
    }
    const result = replaceAllInText(text, regex, task.template, task.isRegex);
    return { id, status: 'replaced', text: result.text, count: result.count };
  } catch (error) {
    return {
      id,
      status: 'failed',
      message: error instanceof Error ? error.message : String(error),
      // "Invalid string length": the result would be longer than the engine allows.
      tooLarge: error instanceof RangeError,
    };
  }
}
