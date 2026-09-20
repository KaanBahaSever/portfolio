/**
 * Page ranges and split planning for the Split PDF tool. Pure: no DOM, and no pdf-lib,
 * so the page script can validate input and preview the result without loading the
 * PDF engine. (src/lib/pdf/split-pdf.ts re-exports the planning helpers.)
 */

import { toPdfFilename } from '../files/filename.ts';
import { uniqueName } from '../zip/zip-store.ts';

/** 1-based, inclusive. `from > to` means the pages are taken in descending order. */
export type PageRange = { from: number; to: number };

export type ParseRangesResult = { ok: true; ranges: PageRange[] } | { ok: false; error: string };

export type SplitMode = 'extract' | 'ranges' | 'every' | 'single';

export interface PlannedOutput {
  filename: string;
  /** 0-based source page indices, in output order. */
  indices: number[];
  /** The source ranges this output is made of (for descriptions). */
  ranges: PageRange[];
}

export type PlanResult = { ok: true; outputs: PlannedOutput[] } | { ok: false; error: string };

/** Upper bound for the pages of all outputs together, so a typo can't exhaust memory. */
export const MAX_TOTAL_PAGES = 20_000;

const BASE_NAME_MAX = 60;
const EXTRACT_SUFFIX_MAX = 24;

function plural(count: number, word: string): string {
  return `${count.toLocaleString('en-US')} ${word}${count === 1 ? '' : 's'}`;
}

// ------------------------------------------------------------------ file check

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
/** Readers accept the header anywhere in the first 1024 bytes (some files start with junk). */
export const PDF_SIGNATURE_WINDOW = 1024;

/** True when "%PDF-" occurs in the first 1024 bytes. File.type is not trusted (it only reflects the extension). */
export function hasPdfSignature(head: Uint8Array): boolean {
  const end = Math.min(head.length, PDF_SIGNATURE_WINDOW) - PDF_SIGNATURE.length;
  for (let i = 0; i <= end; i++) {
    if (head[i] !== 0x25) continue;
    let match = true;
    for (let k = 1; k < PDF_SIGNATURE.length; k++) {
      if (head[i + k] !== PDF_SIGNATURE[k]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

// ------------------------------------------------------------------ parsing

type Token =
  | { kind: 'number'; value: number; text: string; position: number }
  | { kind: 'dash'; text: string; position: number }
  | { kind: 'separator'; position: number };

type LexResult = { ok: true; tokens: Token[] } | { ok: false; error: string };

/** Hyphen-minus, hyphen, non-breaking hyphen, figure dash, en dash, em dash, minus sign. */
const DASHES = new Set(['-', '‐', '‑', '‒', '–', '—', '−']);
const END_KEYWORDS = new Set(['end', 'last']);

function unexpected(text: string, position: number): string {
  return `Unexpected "${text}" near position ${position}`;
}

function tokenize(input: string, pageCount: number): LexResult {
  const chars = Array.from(input); // code points, so positions match what people see
  const tokens: Token[] = [];
  let i = 0;
  while (i < chars.length) {
    const char = chars[i]!;
    const position = i + 1;
    if (/\s/u.test(char)) {
      i++;
    } else if (char === ',' || char === ';') {
      tokens.push({ kind: 'separator', position });
      i++;
    } else if (DASHES.has(char)) {
      tokens.push({ kind: 'dash', text: char, position });
      i++;
    } else if (char >= '0' && char <= '9') {
      let text = '';
      while (i < chars.length && chars[i]! >= '0' && chars[i]! <= '9') text += chars[i++]!;
      tokens.push({ kind: 'number', value: Number(text), text: text.replace(/^0+(?=\d)/, ''), position });
    } else if (/\p{L}/u.test(char)) {
      let text = '';
      while (i < chars.length && /\p{L}/u.test(chars[i]!)) text += chars[i++]!;
      if (!END_KEYWORDS.has(text.toLowerCase())) return { ok: false, error: unexpected(text, position) };
      tokens.push({ kind: 'number', value: pageCount, text: String(pageCount), position });
    } else {
      return { ok: false, error: unexpected(char, position) };
    }
  }
  return { ok: true, tokens };
}

function checkPage(token: Token & { kind: 'number' }, pageCount: number): string | null {
  if (token.value === 0) return 'Page numbers start at 1';
  if (token.value > pageCount) {
    return `Page ${token.text} doesn't exist — this PDF has ${plural(pageCount, 'page')}`;
  }
  return null;
}

/**
 * Parses page selections such as "1-3, 5, 8-", "-4", "end-1" or "2; 4 6".
 *
 * - Items are separated by commas, semicolons or just spaces.
 * - "A-B" is a range (en and em dashes work too); "A-" runs to the last page, "-B" starts at 1.
 * - "end" and "last" mean the last page.
 * - A range written backwards ("5-1") keeps that order. Repeated pages are kept.
 */
export function parsePageRanges(input: string, pageCount: number): ParseRangesResult {
  if (!Number.isInteger(pageCount) || pageCount < 1) return { ok: false, error: 'This PDF has no pages' };

  const lexed = tokenize(String(input ?? ''), pageCount);
  if (!lexed.ok) return lexed;
  const { tokens } = lexed;
  const ranges: PageRange[] = [];

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i]!;
    if (token.kind === 'separator') {
      i++; // empty items ("1,,2", a trailing comma) are harmless
      continue;
    }

    let from: number;
    let to: number;
    if (token.kind === 'number') {
      const error = checkPage(token, pageCount);
      if (error) return { ok: false, error };
      from = token.value;
      to = token.value;
      i++;
      const dash = tokens[i];
      if (dash?.kind === 'dash') {
        i++;
        const next = tokens[i];
        if (next?.kind === 'number') {
          const nextError = checkPage(next, pageCount);
          if (nextError) return { ok: false, error: nextError };
          to = next.value;
          i++;
        } else if (!next || next.kind === 'separator') {
          to = pageCount; // "8-": to the last page
        } else {
          return { ok: false, error: unexpected(next.text, next.position) };
        }
      }
    } else {
      // "-4": from the first page
      const next = tokens[i + 1];
      if (next?.kind !== 'number') {
        return { ok: false, error: `Add a page number before or after "${token.text}" near position ${token.position}` };
      }
      const error = checkPage(next, pageCount);
      if (error) return { ok: false, error };
      from = 1;
      to = next.value;
      i += 2;
    }

    // Another dash right after a complete item ("1-3-5") is ambiguous.
    const after = tokens[i];
    if (after?.kind === 'dash') return { ok: false, error: unexpected(after.text, after.position) };
    ranges.push({ from, to });
  }

  if (ranges.length === 0) return { ok: false, error: 'Enter at least one page' };
  return { ok: true, ranges };
}

// ------------------------------------------------------------------ ranges

/** 0-based page indices in the order given (descending ranges run backwards). Duplicates are kept. */
export function expandRanges(ranges: readonly PageRange[]): number[] {
  const indices: number[] = [];
  for (const { from, to } of ranges) {
    const step = from <= to ? 1 : -1;
    for (let page = from; page !== to + step; page += step) indices.push(page - 1);
  }
  return indices;
}

/** Consecutive chunks of `every` pages: chunkPages(10, 4) → 1–4, 5–8, 9–10. */
export function chunkPages(pageCount: number, every: number): PageRange[] {
  if (!Number.isFinite(every) || every < 1) throw new RangeError('every must be a number of at least 1');
  const size = Math.floor(every);
  const ranges: PageRange[] = [];
  for (let from = 1; from <= pageCount; from += size) {
    ranges.push({ from, to: Math.min(pageCount, from + size - 1) });
  }
  return ranges;
}

/** "1–3" (en dash) or "5". */
export function describeRange(range: PageRange): string {
  return range.from === range.to ? String(range.from) : `${range.from}–${range.to}`;
}

/** "1–3, 5, 8–10", or "1, 2, 3 and 7 more" when there are more than `maxItems`. */
export function describeRanges(ranges: readonly PageRange[], maxItems = Infinity): string {
  const limit = Math.max(1, maxItems);
  const shown = ranges.slice(0, limit).map(describeRange).join(', ');
  const hidden = ranges.length - Math.min(limit, ranges.length);
  return hidden > 0 ? `${shown} and ${hidden.toLocaleString('en-US')} more` : shown;
}

// ------------------------------------------------------------------ file names

function truncateCodePoints(text: string, max: number): string {
  const codePoints = Array.from(text);
  return codePoints.length <= max ? text : codePoints.slice(0, max).join('').replace(/[\s.]+$/, '');
}

/** A safe base for output names: "Report 2026.pdf" → "Report 2026"; nothing usable → "document". */
export function outputBaseName(input: string): string {
  const cleaned = toPdfFilename(input, 'document.pdf').replace(/\.pdf$/i, '');
  return truncateCodePoints(cleaned, BASE_NAME_MAX) || 'document';
}

/** "<base>-split.zip" for several outputs. */
export function zipFilename(baseName: string): string {
  return `${outputBaseName(baseName)}-split.zip`;
}

function rangeSlug(range: PageRange): string {
  return range.from === range.to ? String(range.from) : `${range.from}-${range.to}`;
}

function rangesSuffix(ranges: readonly PageRange[]): string {
  if (ranges.length === 1) {
    const range = ranges[0]!;
    return range.from === range.to ? `page-${range.from}` : `pages-${rangeSlug(range)}`;
  }
  const joined = ranges.map(rangeSlug).join('_');
  return joined.length <= EXTRACT_SUFFIX_MAX ? `pages-${joined}` : 'selected-pages';
}

function padded(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

// ------------------------------------------------------------------ planning

function parseEvery(input: string | number): number | null {
  const text = String(input ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value >= 1 ? value : null;
}

/**
 * Which files to create:
 * - extract: one file with the listed pages, in the order given;
 * - ranges: one file per comma-separated range;
 * - every: one file per `input` pages;
 * - single: one file per page (`input` is ignored).
 * File names are unique (case-insensitively), like the entries of the ZIP they go into.
 */
export function planOutputs(mode: SplitMode, input: string | number, pageCount: number, baseName: string): PlanResult {
  if (!Number.isInteger(pageCount) || pageCount < 1) return { ok: false, error: 'This PDF has no pages' };
  const base = outputBaseName(baseName);
  const used = new Set<string>();
  const name = (suffix: string) => uniqueName(toPdfFilename(`${base}-${suffix}`, `document-${suffix}.pdf`), used);

  let groups: PageRange[][];
  let names: string[];

  switch (mode) {
    case 'extract':
    case 'ranges': {
      const parsed = parsePageRanges(String(input ?? ''), pageCount);
      if (!parsed.ok) return parsed;
      groups = mode === 'extract' ? [parsed.ranges] : parsed.ranges.map((range) => [range]);
      names = groups.map((ranges) => rangesSuffix(ranges));
      break;
    }
    case 'every': {
      const every = parseEvery(input);
      if (every === null) return { ok: false, error: 'Enter a whole number of pages (1 or more)' };
      groups = chunkPages(pageCount, Math.min(every, pageCount)).map((range) => [range]);
      const width = Math.max(2, String(groups.length).length);
      names = groups.map((_, index) => `part-${padded(index + 1, width)}`);
      break;
    }
    case 'single': {
      const width = Math.max(2, String(pageCount).length);
      groups = Array.from({ length: pageCount }, (_, index) => [{ from: index + 1, to: index + 1 }]);
      names = groups.map((_, index) => `page-${padded(index + 1, width)}`);
      break;
    }
    default:
      return { ok: false, error: 'Choose how to split the PDF' };
  }

  let totalPages = 0;
  for (const ranges of groups) {
    for (const { from, to } of ranges) totalPages += Math.abs(to - from) + 1;
  }
  if (totalPages > MAX_TOTAL_PAGES) {
    return {
      ok: false,
      error: `That adds up to ${plural(totalPages, 'page')} — the limit is ${MAX_TOTAL_PAGES.toLocaleString('en-US')} at a time`,
    };
  }

  const outputs = groups.map((ranges, index) => ({
    filename: name(names[index]!),
    indices: expandRanges(ranges),
    ranges,
  }));
  return { ok: true, outputs };
}

/**
 * One line for the plan preview:
 * "Will create 3 files: pages 1–4, 5–8, 9–10" or "Will create 1 file with 7 pages: 1–3, 5, 8–10".
 */
export function summarizePlan(outputs: readonly PlannedOutput[], maxItems = 6): string {
  if (outputs.length === 0) return '';
  if (outputs.length === 1) {
    const output = outputs[0]!;
    const pages = output.indices.length;
    if (pages === 1) return `Will create 1 file: page ${output.indices[0]! + 1}`;
    return `Will create 1 file with ${plural(pages, 'page')}: ${describeRanges(output.ranges, maxItems)}`;
  }
  const limit = Math.max(1, maxItems);
  const shown = outputs
    .slice(0, limit)
    .map((output) => describeRanges(output.ranges))
    .join(', ');
  const hidden = outputs.length - Math.min(limit, outputs.length);
  const list = hidden > 0 ? `${shown} and ${hidden.toLocaleString('en-US')} more` : shown;
  return `Will create ${plural(outputs.length, 'file')}: pages ${list}`;
}
