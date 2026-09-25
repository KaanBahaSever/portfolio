/**
 * The notepad draft kept in the browser's localStorage. Pure: no DOM, no storage access.
 *
 * A draft is two entries, so moving the caret or renaming the file never rewrites a text of
 * several megabytes:
 *   - DRAFT_KEYS.text: the text itself, stored raw (JSON would escape every quote and line break);
 *   - DRAFT_KEYS.meta: small JSON with the file name, line endings, when it was saved, the text
 *     length and where the caret was.
 * The text is written first and the metadata second. When the metadata's length doesn't match
 * the text, a save was interrupted between the two writes: the text is still the newest one,
 * so it is restored, but the caret and scroll position (which belong to an older text) are not.
 *
 * The format version is part of the keys: a future format gets new keys and ignores these.
 */

import type { LineEnding } from './stats.ts';

export const DRAFT_FORMAT = 1;

export const DRAFT_KEYS = {
  text: 'notepad:v1:text',
  meta: 'notepad:v1:meta',
  /** '0' when the visitor turned autosave off; absent (the default) means on. */
  autosave: 'notepad:v1:autosave',
} as const;

/** Longer names aren't file names anyone typed; treat them as damage. */
const MAX_FILENAME_LENGTH = 1000;

export interface DraftMeta {
  v: typeof DRAFT_FORMAT;
  filename: string;
  lineEnding: LineEnding;
  /** When the text, file name or line endings last changed (ms since the epoch). */
  savedAt: number;
  /** UTF-16 length of the stored text: tells a complete save from an interrupted one. */
  length: number;
  selectionStart: number;
  selectionEnd: number;
  scrollTop: number;
  wrap: boolean;
}

export interface RestoredDraft {
  text: string;
  /** null: unknown (no usable metadata); use the default name. */
  filename: string | null;
  lineEnding: LineEnding | null;
  /** null when the metadata is missing or belongs to an older text. */
  savedAt: number | null;
  /** Within the text; null when unknown. */
  selection: { start: number; end: number } | null;
  scrollTop: number;
  wrap: boolean | null;
  /** False when the save was interrupted or the metadata is missing or damaged. */
  complete: boolean;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function serializeDraftMeta(meta: DraftMeta): string {
  return JSON.stringify(meta);
}

/** Validates stored metadata field by field; anything unexpected gives null. */
export function parseDraftMeta(raw: string | null | undefined): DraftMeta | null {
  if (typeof raw !== 'string' || raw === '') return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (data.v !== DRAFT_FORMAT) return null;
  if (typeof data.filename !== 'string' || data.filename.length > MAX_FILENAME_LENGTH) return null;
  if (data.lineEnding !== 'lf' && data.lineEnding !== 'crlf') return null;
  if (typeof data.savedAt !== 'number' || !Number.isFinite(data.savedAt) || data.savedAt <= 0) return null;
  if (!isCount(data.length) || !isCount(data.selectionStart) || !isCount(data.selectionEnd)) return null;
  if (typeof data.scrollTop !== 'number' || !Number.isFinite(data.scrollTop) || data.scrollTop < 0) return null;
  if (typeof data.wrap !== 'boolean') return null;
  return {
    v: DRAFT_FORMAT,
    filename: data.filename,
    lineEnding: data.lineEnding,
    savedAt: data.savedAt,
    length: data.length,
    selectionStart: data.selectionStart,
    selectionEnd: data.selectionEnd,
    scrollTop: data.scrollTop,
    wrap: data.wrap,
  };
}

/**
 * Combines the two stored entries into something the editor can show, or null when there is
 * no text worth restoring. The text wins over the metadata: a missing or damaged metadata
 * entry never discards the text.
 */
export function restoreDraft(text: string | null | undefined, rawMeta: string | null | undefined): RestoredDraft | null {
  if (typeof text !== 'string' || text === '') return null;
  const meta = parseDraftMeta(rawMeta);
  if (!meta) {
    return {
      text,
      filename: null,
      lineEnding: null,
      savedAt: null,
      selection: null,
      scrollTop: 0,
      wrap: null,
      complete: false,
    };
  }
  const complete = meta.length === text.length;
  const start = Math.min(meta.selectionStart, meta.selectionEnd);
  const end = Math.max(meta.selectionStart, meta.selectionEnd);
  return {
    text,
    // The file name and line endings rarely change between two saves: keep them either way.
    filename: meta.filename.trim() === '' ? null : meta.filename,
    lineEnding: meta.lineEnding,
    savedAt: complete ? meta.savedAt : null,
    selection: complete && end <= text.length ? { start, end } : null,
    scrollTop: complete ? meta.scrollTop : 0,
    wrap: meta.wrap,
    complete,
  };
}

/** Autosave is on unless the visitor turned it off. */
export function parseAutosavePreference(raw: string | null | undefined): boolean {
  return raw !== '0';
}

/**
 * How long autosave waits after the last change (ms). Every localStorage write is synchronous
 * and copies the whole text, so longer texts wait longer and are written less often while
 * someone types.
 */
export function autosaveDelay(length: number): number {
  if (length < 50_000) return 400;
  if (length < 500_000) return 1200;
  return 2500;
}
