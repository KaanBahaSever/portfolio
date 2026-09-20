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

/** Messages from the page to the split worker. */
export type ToSplitWorker =
  | { type: 'load'; id: number; bytes: Uint8Array }
  | { type: 'split'; id: number; outputs: OutputRequest[]; zip: boolean };

/** Messages from the split worker to the page. */
export type FromSplitWorker =
  | { type: 'ready' }
  | { type: 'loaded'; id: number; pageCount: number; title?: string }
  | { type: 'progress'; id: number; stage: SplitStage; done: number; total: number }
  | { type: 'pdf'; id: number; blob: Blob; file: OutputFileInfo }
  | { type: 'zip'; id: number; blob: Blob; files: OutputFileInfo[] }
  | { type: 'error'; id: number; name: string; message: string };
