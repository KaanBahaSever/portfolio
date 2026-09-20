/**
 * Before/after snippets for a find & replace preview. Pure: no DOM.
 */

import { expandReplacement } from './search.ts';
import type { TextMatch } from './search.ts';

export interface ReplacementPreviewItem {
  /** 1-based line where the match starts. */
  line: number;
  /** Text on the same line before the match (shortened). */
  before: string;
  removed: string;
  inserted: string;
  /** Text on the same line after the match (shortened). */
  after: string;
  /** True when `before` does not start at the beginning of the line. */
  clippedBefore: boolean;
  /** True when `after` does not reach the end of the line. */
  clippedAfter: boolean;
}

export interface PreviewOptions {
  /** Maximum number of items (default 100). */
  limit?: number;
  /** Maximum UTF-16 units of context on each side (default 32). */
  context?: number;
  /** Maximum UTF-16 units shown for removed or inserted text (default 120). */
  maxPart?: number;
}

const CR = 13;
const LF = 10;

/** Line breaks are shown as a visible symbol so a multi-line change stays on one row. */
function flatten(value: string): string {
  return value.replace(/\r\n|\r|\n/g, '↵');
}

function isLineBreak(code: number): boolean {
  return code === CR || code === LF;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

/** Shortens to at most `max` units from the start, never ending between a surrogate pair. */
function clipEnd(value: string, max: number): { text: string; clipped: boolean } {
  if (value.length <= max) return { text: value, clipped: false };
  let end = max;
  if (end > 0 && isHighSurrogate(value.charCodeAt(end - 1))) end--;
  return { text: value.slice(0, end), clipped: true };
}

export function buildReplacementPreview(
  text: string,
  matches: readonly TextMatch[],
  template: string,
  isRegex: boolean,
  options: PreviewOptions = {},
): ReplacementPreviewItem[] {
  const limit = options.limit ?? 100;
  const context = options.context ?? 32;
  const maxPart = options.maxPart ?? 120;
  const items: ReplacementPreviewItem[] = [];

  let line = 1;
  let scanned = 0;

  for (const match of matches) {
    if (items.length >= limit) break;

    // Count line breaks between the previous match and this one (CRLF is one break).
    for (let i = scanned; i < match.start; i++) {
      const code = text.charCodeAt(i);
      if (code === CR || (code === LF && (i === 0 || text.charCodeAt(i - 1) !== CR))) line++;
    }
    scanned = Math.max(scanned, match.start);

    // Walk back to the line start, at most `context` units.
    let beforeStart = match.start;
    const minStart = Math.max(0, match.start - context);
    while (beforeStart > minStart && !isLineBreak(text.charCodeAt(beforeStart - 1))) beforeStart--;
    const clippedBefore = beforeStart > 0 && !isLineBreak(text.charCodeAt(beforeStart - 1));
    if (clippedBefore && beforeStart < match.start && isLowSurrogate(text.charCodeAt(beforeStart))) beforeStart++;
    const before = text.slice(beforeStart, match.start);

    // Walk forward to the line end, at most `context` units.
    let afterEnd = match.end;
    const maxEnd = Math.min(text.length, match.end + context);
    while (afterEnd < maxEnd && !isLineBreak(text.charCodeAt(afterEnd))) afterEnd++;
    const clippedAfter = afterEnd < text.length && !isLineBreak(text.charCodeAt(afterEnd));
    if (clippedAfter && afterEnd > match.end && isHighSurrogate(text.charCodeAt(afterEnd - 1))) afterEnd--;
    const after = text.slice(match.end, afterEnd);

    const removed = clipEnd(match.text, maxPart);
    const inserted = clipEnd(expandReplacement(template, match, text, isRegex), maxPart);

    items.push({
      line,
      before: flatten(before),
      removed: flatten(removed.text) + (removed.clipped ? '…' : ''),
      inserted: flatten(inserted.text) + (inserted.clipped ? '…' : ''),
      after: flatten(after),
      clippedBefore,
      clippedAfter,
    });
  }

  return items;
}
