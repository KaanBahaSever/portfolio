/**
 * Text statistics. Pure: no DOM.
 *
 * Counts follow what people see: an emoji family or a letter with combining accents is one
 * character, and words and sentences come from Intl.Segmenter where the engine has it.
 */

export type LineEnding = 'lf' | 'crlf';

export interface TextStats {
  /** User-perceived characters (grapheme clusters). */
  characters: number;
  /** Characters that are not Unicode whitespace. */
  charactersNoSpaces: number;
  words: number;
  sentences: number;
  lines: number;
  /** Groups of non-blank lines separated by blank lines. */
  paragraphs: number;
  /** UTF-8 size of the file as it will be saved (after line-ending conversion). */
  bytes: number;
  readingMinutes: number;
}

export interface StatsOptions {
  lineEnding?: LineEnding;
  /** Testing: false forces the fallbacks used where Intl.Segmenter is missing. */
  segmenter?: boolean;
}

const WORDS_PER_MINUTE = 200;
const CR = 13;
const LF = 10;

type Granularity = 'grapheme' | 'word' | 'sentence';
const segmenters = new Map<Granularity, Intl.Segmenter | null>();

function getSegmenter(granularity: Granularity): Intl.Segmenter | null {
  if (!segmenters.has(granularity)) {
    let segmenter: Intl.Segmenter | null = null;
    try {
      if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
        segmenter = new Intl.Segmenter(undefined, { granularity });
      }
    } catch {
      segmenter = null;
    }
    segmenters.set(granularity, segmenter);
  }
  return segmenters.get(granularity) ?? null;
}

/** Unicode White_Space for a single UTF-16 code unit (all of them are in the BMP). */
function isWhitespaceCode(code: number): boolean {
  if (code <= 0x20) return code === 0x20 || (code >= 0x09 && code <= 0x0d);
  if (code < 0x85) return false;
  return (
    code === 0x85 ||
    code === 0xa0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000
  );
}

function isWhitespaceSegment(segment: string): boolean {
  return segment.length === 1 ? isWhitespaceCode(segment.charCodeAt(0)) : segment === '\r\n';
}

/**
 * Below U+0300 (Basic Latin to IPA and spacing modifiers, which covers Turkish and most
 * Latin-script text) every code point is its own grapheme, except that CR LF is one.
 * The first combining marks start at U+0300.
 */
const SIMPLE_GRAPHEME_LIMIT = 0x300;

let wordPattern: RegExp | null = null;
let sentenceHasContent: RegExp | null = null;

/** Built lazily with the constructor so an engine without `\p{…}` support fails here only. */
function fallbackWordPattern(): RegExp {
  wordPattern ??= new RegExp("[\\p{L}\\p{N}\\p{M}]+(?:['’][\\p{L}\\p{N}\\p{M}]+)*", 'gu');
  return wordPattern;
}

function hasLetterOrDigit(value: string): boolean {
  sentenceHasContent ??= new RegExp('[\\p{L}\\p{N}]', 'u');
  return sentenceHasContent.test(value);
}

function countWords(text: string, useSegmenter: boolean): number {
  const segmenter = useSegmenter ? getSegmenter('word') : null;
  let count = 0;
  if (segmenter) {
    for (const part of segmenter.segment(text)) if (part.isWordLike) count++;
    return count;
  }
  const pattern = fallbackWordPattern();
  pattern.lastIndex = 0;
  while (pattern.exec(text)) count++;
  return count;
}

function countSentences(text: string, useSegmenter: boolean): number {
  const segmenter = useSegmenter ? getSegmenter('sentence') : null;
  let count = 0;
  if (segmenter) {
    for (const part of segmenter.segment(text)) if (hasLetterOrDigit(part.segment)) count++;
    return count;
  }
  // Ends of sentences followed by whitespace (or the end), and line breaks.
  for (const part of text.split(/[.!?…。！？]+(?=\s|$)|[\r\n]+/u)) if (hasLetterOrDigit(part)) count++;
  return count;
}

/** Grapheme count, and how many of those graphemes are whitespace. */
function countGraphemes(text: string, useSegmenter: boolean): { total: number; whitespace: number } {
  const segmenter = useSegmenter ? getSegmenter('grapheme') : null;
  let total = 0;
  let whitespace = 0;
  if (segmenter) {
    for (const part of segmenter.segment(text)) {
      total++;
      if (isWhitespaceSegment(part.segment)) whitespace++;
    }
    return { total, whitespace };
  }
  // Fallback: code points, with CR LF as one.
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i++;
    } else if (code === CR && text.charCodeAt(i + 1) === LF) {
      i++;
      whitespace++;
    } else if (isWhitespaceCode(code)) {
      whitespace++;
    }
    total++;
  }
  return { total, whitespace };
}

/** The character count when no code unit needs segmentation (all below U+0300), else null. */
function simpleCharacterCount(text: string): number | null {
  let crlf = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= SIMPLE_GRAPHEME_LIMIT) return null;
    if (code === CR && text.charCodeAt(i + 1) === LF) crlf++;
  }
  return text.length - crlf;
}

/** User-perceived characters in `text` (grapheme clusters). */
export function countCharacters(text: string, options: { segmenter?: boolean } = {}): number {
  return simpleCharacterCount(text) ?? countGraphemes(text, options.segmenter !== false).total;
}

/**
 * countCharacters that stays fast for huge texts: text longer than `segmentLimit` UTF-16 units
 * that would need grapheme segmentation is counted in code points instead (CR LF as one).
 * `exact` is false then: emoji sequences and combining accents count more than once.
 */
export function countCharactersBounded(text: string, segmentLimit: number): { count: number; exact: boolean } {
  const simple = simpleCharacterCount(text);
  if (simple !== null) return { count: simple, exact: true };
  if (text.length <= segmentLimit) return { count: countGraphemes(text, true).total, exact: true };
  return { count: countGraphemes(text, false).total, exact: false };
}

export function computeStats(text: string, options: StatsOptions = {}): TextStats {
  const crlfMode = options.lineEnding === 'crlf';
  const useSegmenter = options.segmenter !== false;
  const length = text.length;

  let bytes = 0;
  let breaks = 0;
  let crlfPairs = 0;
  let whitespaceUnits = 0;
  let simple = true;
  let paragraphs = 0;
  let inParagraph = false;
  let lineHasContent = false;

  // One pass for everything that doesn't need segmentation.
  for (let i = 0; i < length; i++) {
    const code = text.charCodeAt(i);

    if (code === CR || code === LF) {
      const pair = code === CR && i + 1 < length && text.charCodeAt(i + 1) === LF;
      breaks++;
      whitespaceUnits += pair ? 2 : 1;
      if (pair) {
        crlfPairs++;
        i++;
        // "\r\n" is 2 bytes with CRLF, 1 byte ("\n") with LF.
        bytes += crlfMode ? 2 : 1;
      } else {
        // A lone "\n" or "\r" becomes "\r\n" or "\n".
        bytes += crlfMode ? 2 : 1;
      }
      if (!lineHasContent) inParagraph = false;
      lineHasContent = false;
      continue;
    }

    if (code >= SIMPLE_GRAPHEME_LIMIT) simple = false;

    if (isWhitespaceCode(code)) {
      whitespaceUnits++;
    } else if (!lineHasContent) {
      lineHasContent = true;
      if (!inParagraph) {
        paragraphs++;
        inParagraph = true;
      }
    }

    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else {
        bytes += 3;
      }
    } else bytes += 3; // other BMP characters, and lone surrogates (saved as U+FFFD)
  }

  let characters: number;
  let charactersNoSpaces: number;
  if (simple) {
    characters = length - crlfPairs;
    charactersNoSpaces = length - whitespaceUnits;
  } else {
    const graphemes = countGraphemes(text, useSegmenter);
    characters = graphemes.total;
    charactersNoSpaces = graphemes.total - graphemes.whitespace;
  }

  const words = length === 0 ? 0 : countWords(text, useSegmenter);

  return {
    characters,
    charactersNoSpaces,
    words,
    sentences: length === 0 ? 0 : countSentences(text, useSegmenter),
    lines: length === 0 ? 0 : breaks + 1,
    paragraphs,
    bytes,
    readingMinutes: Math.ceil(words / WORDS_PER_MINUTE),
  };
}

/** Size in bytes of `value` encoded as UTF-8 (lone surrogates count as U+FFFD, 3 bytes). */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  const length = value.length;
  for (let i = 0; i < length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else {
        bytes += 3;
      }
    } else bytes += 3;
  }
  return bytes;
}

/** Normalises every line break (CRLF, CR, LF) to the chosen style. */
export function convertLineEndings(value: string, mode: LineEnding): string {
  if (mode === 'lf') return value.includes('\r') ? value.replace(/\r\n?/g, '\n') : value;
  if (!value.includes('\n') && !value.includes('\r')) return value;
  return value.replace(/\r\n|\r|\n/g, '\r\n');
}

/**
 * 1-based line and column of a UTF-16 offset. CRLF counts as one line break;
 * the column counts code points, so an emoji is one column.
 */
export function lineColumnAt(text: string, offset: number): { line: number; column: number } {
  const end = Math.max(0, Math.min(Math.trunc(offset) || 0, text.length));
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < end; i++) {
    const code = text.charCodeAt(i);
    if (code === LF) {
      if (i === 0 || text.charCodeAt(i - 1) !== CR) line++;
      lineStart = i + 1;
    } else if (code === CR) {
      line++;
      lineStart = i + 1;
    }
  }
  let column = 1;
  for (let i = lineStart; i < end; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < end) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i++;
    }
    column++;
  }
  return { line, column };
}
