/** A file the worker should create: the source pages (0-based) in output order. */
export interface OutputRequest {
  filename: string;
  indices: number[];
}

export interface OutputFileInfo {
  name: string;
  size: number;
  pages: number;
}

export type SplitStage = 'reading' | 'creating' | 'zipping';

/**
 * A failure in the worker. Error objects lose their class and extra fields in postMessage,
 * so the parts the page needs travel as plain data: `name` picks the kind of error, `code`
 * (with `count`/`limit` for ZIP limits) the exact reason. `message` is for developers.
 */
export interface WorkerError {
  name: string;
  message: string;
  code?: string;
  count?: number;
  limit?: number;
}

/** Messages from the page to the split worker. */
export type ToSplitWorker =
  | { type: 'load'; id: number; bytes: Uint8Array }
  | { type: 'split'; id: number; outputs: OutputRequest[]; zip: boolean };

/** Messages from the split worker to the page. */
export type FromSplitWorker =
  | { type: 'ready' }
  | { type: 'loaded'; id: number; pageCount: number; title?: string; firstPage?: { width: number; height: number } }
  | { type: 'progress'; id: number; stage: SplitStage; done: number; total: number }
  | { type: 'pdf'; id: number; blob: Blob; file: OutputFileInfo }
  | { type: 'zip'; id: number; blob: Blob; files: OutputFileInfo[] }
  | { type: 'error'; id: number; error: WorkerError };
