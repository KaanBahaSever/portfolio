/**
 * Web Worker that computes text statistics for long texts (browser only), so segmenting
 * a megabyte of text never interrupts typing.
 */

import { computeStats } from '../../../lib/text/stats.ts';
import type { StatsRequest, StatsResponse } from './types.ts';

const scope = self as unknown as {
  postMessage(message: StatsResponse): void;
  onmessage: ((event: MessageEvent<StatsRequest>) => void) | null;
};

scope.onmessage = (event) => {
  const { id, text, lineEnding } = event.data;
  scope.postMessage({ id, stats: computeStats(text, { lineEnding }) });
};
