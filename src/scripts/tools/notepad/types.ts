import type { MatchWindow, WindowRequest } from '../../../lib/text/search.ts';
import type { LineEnding, TextStats } from '../../../lib/text/stats.ts';

export interface StatsRequest {
  id: number;
  text: string;
  lineEnding: LineEnding;
}

export interface StatsResponse {
  id: number;
  stats: TextStats;
}

export type SearchTask =
  | { op: 'window'; request: WindowRequest }
  | { op: 'replaceAll'; template: string; isRegex: boolean };

export interface SearchWorkerRequest {
  id: number;
  /** Version of the text; the worker keeps the last text it was sent. */
  version: number;
  length: number;
  /** Only sent when the worker doesn't have this version yet. */
  text?: string;
  source: string;
  flags: string;
  task: SearchTask;
}

export type SearchWorkerResponse =
  | { id: number; status: 'window'; window: MatchWindow }
  | { id: number; status: 'replaced'; text: string; count: number }
  /** The worker doesn't hold that version of the text: send it again. */
  | { id: number; status: 'missing-text' }
  | { id: number; status: 'failed'; message: string; tooLarge: boolean };
