/**
 * Page ranges, page selections and split planning for the Split PDF tool. Pure: no DOM, and
 * no pdf-lib, so the page script can validate input, drive the page grid and preview the
 * result without loading the PDF engine. (src/lib/pdf/split-pdf.ts re-exports the planning
 * helpers.)
 *
 * Nothing here returns prose: errors are codes with parameters and summaries are structured
 * data, which src/i18n/tools/pdf-split.ts turns into English or Turkish text.
 */

import { toPdfFilename } from '../files/filename.ts';
import { uniqueName } from '../zip/zip-store.ts';

/** 1-based, inclusive. `from > to` means the pages are taken in descending order. */
export type PageRange = { from: number; to: number };

/**
 * Why a page selection could not be read. Positions are 1-based and count code points, so
 * they match what people see in the field.
 */
export type PageRangeError =
  | { code: 'no-pages' }
  | { code: 'empty' }
  | { code: 'page-zero' }
  /** `page` is the number as typed (without leading zeros): it may not fit a JS number. */
  | { code: 'page-out-of-range'; page: string; pageCount: number }
  | { code: 'unexpected'; text: string; position: number }
  | { code: 'missing-page'; dash: string; position: number };

/** Why no split plan could be made: a page-selection error or a problem with the mode. */
export type PlanError =
  | PageRangeError
  | { code: 'invalid-every' }
  | { code: 'invalid-mode' }
  | { code: 'too-many-pages'; total: number; limit: number };

export type ParseRangesResult = { ok: true; ranges: PageRange[] } | { ok: false; error: PageRangeError };

export type SplitMode = 'extract' | 'ranges' | 'every' | 'single';

export interface PlannedOutput {
  filename: string;
  /** 0-based source page indices, in output order. */
  indices: number[];
  /** The source ranges this output is made of (for descriptions). */
  ranges: PageRange[];
}

export type PlanResult = { ok: true; outputs: PlannedOutput[] } | { ok: false; error: PlanError };

/**
 * The words used in generated file names. The page passes its language's words; the
 * defaults are English (and what the tests pin).
 */
export interface OutputNames {
  /** Base name when the typed one is unusable: "document". */
  fallbackBase: string;
  /** One page: "report-page-5.pdf". */
  page: string;
  /** Several pages: "report-pages-1-3.pdf". */
  pages: string;
  /** Too many ranges to list in the name: "report-selected-pages.pdf". */
  selected: string;
  /** Every N pages: "report-part-01.pdf". */
  part: string;
  /** The ZIP around several files: "report-split.zip". */
  zip: string;
}

export const DEFAULT_OUTPUT_NAMES: Readonly<OutputNames> = {
  fallbackBase: 'document',
  page: 'page',
  pages: 'pages',
  selected: 'selected-pages',
  part: 'part',
  zip: 'split',
};

/** Upper bound for the pages of all outputs together, so a typo can't exhaust memory. */
export const MAX_TOTAL_PAGES = 20_000;

const BASE_NAME_MAX = 60;
const EXTRACT_SUFFIX_MAX = 24;

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

type LexResult = { ok: true; tokens: Token[] } | { ok: false; error: PageRangeError };

/** Hyphen-minus, hyphen, non-breaking hyphen, figure dash, en dash, em dash, minus sign. */
const DASHES = new Set(['-', '‐', '‑', '‒', '–', '—', '−']);
/**
 * Words for the last page: English "end" and "last", Turkish "son". Compared after
 * toLowerCase() (not the Turkish locale rules), which is enough for these ASCII words.
 */
const END_KEYWORDS = new Set(['end', 'last', 'son']);

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
      if (!END_KEYWORDS.has(text.toLowerCase())) return { ok: false, error: { code: 'unexpected', text, position } };
      tokens.push({ kind: 'number', value: pageCount, text: String(pageCount), position });
    } else {
      return { ok: false, error: { code: 'unexpected', text: char, position } };
    }
  }
  return { ok: true, tokens };
}

function checkPage(token: Token & { kind: 'number' }, pageCount: number): PageRangeError | null {
  if (token.value === 0) return { code: 'page-zero' };
  if (token.value > pageCount) return { code: 'page-out-of-range', page: token.text, pageCount };
  return null;
}

/**
 * Parses page selections such as "1-3, 5, 8-", "-4", "end-1" or "2; 4 6".
 *
 * - Items are separated by commas, semicolons or just spaces.
 * - "A-B" is a range (en and em dashes work too); "A-" runs to the last page, "-B" starts at 1.
 * - "end", "last" and "son" mean the last page.
 * - A range written backwards ("5-1") keeps that order. Repeated pages are kept.
 */
export function parsePageRanges(input: string, pageCount: number): ParseRangesResult {
  if (!Number.isInteger(pageCount) || pageCount < 1) return { ok: false, error: { code: 'no-pages' } };

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
          return { ok: false, error: { code: 'unexpected', text: next.text, position: next.position } };
        }
      }
    } else {
      // "-4": from the first page
      const next = tokens[i + 1];
      if (next?.kind !== 'number') {
        return { ok: false, error: { code: 'missing-page', dash: token.text, position: token.position } };
      }
      const error = checkPage(next, pageCount);
      if (error) return { ok: false, error };
      from = 1;
      to = next.value;
      i += 2;
    }

    // Another dash right after a complete item ("1-3-5") is ambiguous.
    const after = tokens[i];
    if (after?.kind === 'dash') return { ok: false, error: { code: 'unexpected', text: after.text, position: after.position } };
    ranges.push({ from, to });
  }

  if (ranges.length === 0) return { ok: false, error: { code: 'empty' } };
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

/** For display: "1–3" (en dash) or "5". Digits and a dash read the same in every language. */
export function describeRange(range: PageRange): string {
  return range.from === range.to ? String(range.from) : `${range.from}–${range.to}`;
}

/** For display: "1–3, 5, 8–10". */
export function describeRanges(ranges: readonly PageRange[]): string {
  return ranges.map(describeRange).join(', ');
}

// ------------------------------------------------------------------ selections

/** Ascending runs of consecutive pages, duplicates ignored: {1, 2, 3, 5} → [1–3, 5]. */
export function pagesToRanges(pages: Iterable<number>): PageRange[] {
  const sorted = Array.from(new Set(pages)).sort((a, b) => a - b);
  const ranges: PageRange[] = [];
  for (const page of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && page === last.to + 1) last.to = page;
    else ranges.push({ from: page, to: page });
  }
  return ranges;
}

/**
 * Runs of consecutive pages (steps of +1 or −1) in the given order, repeats kept:
 * [3, 1, 2] → [3, 1–2]; [10, 9, 8, 1, 1] → [10–8, 1, 1]. expandRanges() gives the list back.
 */
export function sequenceToRanges(pages: readonly number[]): PageRange[] {
  const ranges: PageRange[] = [];
  let current: PageRange | null = null;
  let step = 0; // direction of the current run; 0 while it has a single page
  for (const page of pages) {
    if (current) {
      const diff = page - current.to;
      if ((diff === 1 || diff === -1) && (step === 0 || step === diff)) {
        current.to = page;
        step = diff;
        continue;
      }
    }
    current = { from: page, to: page };
    step = 0;
    ranges.push(current);
  }
  return ranges;
}

/**
 * Text for the page field: ASCII hyphens and ", " separators, which parsePageRanges reads
 * back exactly: [1–3, 5] → "1-3, 5".
 */
export function formatPageRanges(ranges: readonly PageRange[]): string {
  return ranges.map(({ from, to }) => (from === to ? String(from) : `${from}-${to}`)).join(', ');
}

/** Canonical compact text for a set of pages: [1, 2, 3, 5, 7, 8] → "1-3, 5, 7-8". */
export function formatPageSelection(pages: Iterable<number>): string {
  return formatPageRanges(pagesToRanges(pages));
}

/** Compact text for an ordered page list that keeps its order and repeats: [3, 1, 2] → "3, 1-2". */
export function formatPageSequence(pages: readonly number[]): string {
  return formatPageRanges(sequenceToRanges(pages));
}

function isStrictlyAscending(pages: readonly number[]): boolean {
  for (let i = 1; i < pages.length; i++) if (pages[i]! <= pages[i - 1]!) return false;
  return true;
}

/**
 * Applies a new set of selected pages to the ordered page list of "Extract pages" (one output
 * file). Pages no longer selected are dropped; newly selected pages are added in page order
 * when the list is ascending, or at the end otherwise, so an order typed by hand ("3, 1, 2")
 * survives clicks in the page grid.
 */
export function reconcileSequence(sequence: readonly number[], selected: ReadonlySet<number>): number[] {
  const kept = sequence.filter((page) => selected.has(page));
  const present = new Set(kept);
  const added = Array.from(selected)
    .filter((page) => !present.has(page))
    .sort((a, b) => a - b);
  if (added.length === 0) return kept;
  if (!isStrictlyAscending(kept)) return kept.concat(added);

  const merged: number[] = [];
  let a = 0;
  let b = 0;
  while (a < kept.length || b < added.length) {
    if (b >= added.length || (a < kept.length && kept[a]! < added[b]!)) merged.push(kept[a++]!);
    else merged.push(added[b++]!);
  }
  return merged;
}

/**
 * Applies a new set of selected pages to the ranges of "Split by ranges", where every range
 * is one output file. Typed ranges are kept where possible: they lose deselected pages
 * (splitting where a gap opens), and newly selected pages extend the ascending range that
 * ends right before or starts right after them, or become new ranges (in page order when the
 * ranges are sorted, otherwise at the end).
 */
export function reconcileRanges(ranges: readonly PageRange[], selected: ReadonlySet<number>): PageRange[] {
  const result: PageRange[] = [];
  const covered = new Set<number>();
  for (const { from, to } of ranges) {
    const step = from <= to ? 1 : -1;
    let run: PageRange | null = null;
    for (let page = from; page !== to + step; page += step) {
      if (selected.has(page)) {
        covered.add(page);
        if (run) run.to = page;
        else run = { from: page, to: page };
      } else if (run) {
        result.push(run);
        run = null;
      }
    }
    if (run) result.push(run);
  }

  let sorted = true;
  for (let i = 0; i < result.length; i++) {
    const range = result[i]!;
    const previous = result[i - 1];
    if (range.from > range.to || (previous && range.from <= previous.to)) {
      sorted = false;
      break;
    }
  }

  const ascending = (range: PageRange) => range.from <= range.to;
  for (const run of pagesToRanges(Array.from(selected).filter((page) => !covered.has(page)))) {
    const before = result.find((range) => ascending(range) && range.to === run.from - 1);
    if (before) {
      before.to = run.to;
      continue;
    }
    const after = result.find((range) => ascending(range) && range.from === run.to + 1);
    if (after) {
      after.from = run.from;
      continue;
    }
    const at = sorted ? result.findIndex((range) => range.from > run.to) : -1;
    if (at === -1) result.push({ ...run });
    else result.splice(at, 0, { ...run });
  }
  return result;
}

/**
 * For each page (index 0 is page 1): how many times the outputs use it, and the 1-based number
 * of the first output that contains it (0 when none). `groups` are the outputs' 0-based page
 * indices. Drives the page grid's check marks and file labels.
 */
export function pageUsage(
  groups: readonly (readonly number[])[],
  pageCount: number,
): { uses: Uint32Array; firstOutput: Uint32Array } {
  const size = Math.max(0, Math.floor(pageCount));
  const uses = new Uint32Array(size);
  const firstOutput = new Uint32Array(size);
  groups.forEach((indices, output) => {
    for (const index of indices) {
      if (index < 0 || index >= size) continue;
      uses[index]!++;
      if (firstOutput[index] === 0) firstOutput[index] = output + 1;
    }
  });
  return { uses, firstOutput };
}

// ------------------------------------------------------------------ file names

function truncateCodePoints(text: string, max: number): string {
  const codePoints = Array.from(text);
  return codePoints.length <= max ? text : codePoints.slice(0, max).join('').replace(/[\s.]+$/, '');
}

/** A safe base for output names: "Report 2026.pdf" → "Report 2026"; nothing usable → `fallback`. */
export function outputBaseName(input: string, fallback = DEFAULT_OUTPUT_NAMES.fallbackBase): string {
  const cleaned = toPdfFilename(input, `${fallback}.pdf`).replace(/\.pdf$/i, '');
  return truncateCodePoints(cleaned, BASE_NAME_MAX) || fallback;
}

/** "<base>-split.zip" for several outputs. */
export function zipFilename(baseName: string, names: OutputNames = DEFAULT_OUTPUT_NAMES): string {
  return `${outputBaseName(baseName, names.fallbackBase)}-${names.zip}.zip`;
}

function rangeSlug(range: PageRange): string {
  return range.from === range.to ? String(range.from) : `${range.from}-${range.to}`;
}

function rangesSuffix(ranges: readonly PageRange[], names: OutputNames): string {
  if (ranges.length === 1) {
    const range = ranges[0]!;
    return range.from === range.to ? `${names.page}-${range.from}` : `${names.pages}-${rangeSlug(range)}`;
  }
  const joined = ranges.map(rangeSlug).join('_');
  return joined.length <= EXTRACT_SUFFIX_MAX ? `${names.pages}-${joined}` : names.selected;
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
export function planOutputs(
  mode: SplitMode,
  input: string | number,
  pageCount: number,
  baseName: string,
  names: OutputNames = DEFAULT_OUTPUT_NAMES,
): PlanResult {
  if (!Number.isInteger(pageCount) || pageCount < 1) return { ok: false, error: { code: 'no-pages' } };
  const base = outputBaseName(baseName, names.fallbackBase);
  const used = new Set<string>();
  const name = (suffix: string) =>
    uniqueName(toPdfFilename(`${base}-${suffix}`, `${names.fallbackBase}-${suffix}.pdf`), used);

  let groups: PageRange[][];
  let suffixes: string[];

  switch (mode) {
    case 'extract':
    case 'ranges': {
      const parsed = parsePageRanges(String(input ?? ''), pageCount);
      if (!parsed.ok) return parsed;
      groups = mode === 'extract' ? [parsed.ranges] : parsed.ranges.map((range) => [range]);
      suffixes = groups.map((ranges) => rangesSuffix(ranges, names));
      break;
    }
    case 'every': {
      const every = parseEvery(input);
      if (every === null) return { ok: false, error: { code: 'invalid-every' } };
      groups = chunkPages(pageCount, Math.min(every, pageCount)).map((range) => [range]);
      const width = Math.max(2, String(groups.length).length);
      suffixes = groups.map((_, index) => `${names.part}-${padded(index + 1, width)}`);
      break;
    }
    case 'single': {
      const width = Math.max(2, String(pageCount).length);
      groups = Array.from({ length: pageCount }, (_, index) => [{ from: index + 1, to: index + 1 }]);
      suffixes = groups.map((_, index) => `${names.page}-${padded(index + 1, width)}`);
      break;
    }
    default:
      return { ok: false, error: { code: 'invalid-mode' } };
  }

  let totalPages = 0;
  for (const ranges of groups) {
    for (const { from, to } of ranges) totalPages += Math.abs(to - from) + 1;
  }
  if (totalPages > MAX_TOTAL_PAGES) {
    return { ok: false, error: { code: 'too-many-pages', total: totalPages, limit: MAX_TOTAL_PAGES } };
  }

  const outputs = groups.map((ranges, index) => ({
    filename: name(suffixes[index]!),
    indices: expandRanges(ranges),
    ranges,
  }));
  return { ok: true, outputs };
}

/** What a plan will create, for the plan preview (worded by the page). */
export interface PlanSummary {
  /** Number of output files. */
  files: number;
  /** Pages across all outputs (repeats counted). */
  pages: number;
  /**
   * One file: its ranges ("1–3", "5"). Several files: each file's ranges ("1–4").
   * At most `maxItems` entries; `more` counts the rest.
   */
  items: string[];
  more: number;
}

/** Structured summary of a plan: { files: 3, pages: 10, items: ['1–4', '5–8', '9–10'], more: 0 }. */
export function summarizePlan(outputs: readonly PlannedOutput[], maxItems = 6): PlanSummary | null {
  if (outputs.length === 0) return null;
  const limit = Math.max(1, Math.floor(maxItems));
  let pages = 0;
  for (const output of outputs) pages += output.indices.length;
  const all =
    outputs.length === 1
      ? outputs[0]!.ranges.map(describeRange)
      : outputs.slice(0, limit).map((output) => describeRanges(output.ranges));
  const total = outputs.length === 1 ? outputs[0]!.ranges.length : outputs.length;
  const items = all.slice(0, limit);
  return { files: outputs.length, pages, items, more: total - items.length };
}
