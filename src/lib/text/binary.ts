/**
 * Binary ↔ text conversion over UTF-8. Pure: no DOM, no prose.
 *
 * Text → binary: the text is encoded as UTF-8 (TextEncoder) and every byte is written as eight
 * bits. Binary → text: groups of bits are read back into bytes and decoded with a strict
 * TextDecoder ('utf-8', fatal), so malformed input is refused instead of being patched with
 * U+FFFD. Failures come back as codes with positions (UTF-16 offsets into the input plus a
 * 1-based line and column) for the interface to put into words and to point at.
 *
 * Accepted binary: groups of 0 and 1 separated by whitespace (spaces, tabs, line breaks) or
 * commas, each optionally prefixed with 0b. A group may hold several bytes as long as its length
 * is a multiple of 8, so one continuous run of bits works too.
 */
import { lineColumnAt } from './stats.ts';

/** Largest input, in UTF-8 bytes, converted at once (keeps live updates instant on phones). */
export const MAX_BYTES = 16_384;
/**
 * Largest binary input in characters, checked before parsing. Generous enough for every byte
 * written as "0b01001000, " (12 characters), so only pasted junk hits it before MAX_BYTES does.
 */
export const MAX_BINARY_CHARS = MAX_BYTES * 16;
/** The last code point in 7-bit ASCII. */
export const ASCII_MAX = 0x7f;

export type Separator = 'space' | 'none' | 'newline';
/** 'byte': every byte is its own group; 'character': the 1–4 bytes of a code point stay together. */
export type Grouping = 'byte' | 'character';

export const SEPARATORS: readonly Separator[] = ['space', 'none', 'newline'];
export const GROUPINGS: readonly Grouping[] = ['byte', 'character'];

export interface FormatOptions {
  separator: Separator;
  grouping: Grouping;
}

export const DEFAULT_FORMAT: Readonly<FormatOptions> = { separator: 'space', grouping: 'byte' };

export function isSeparator(value: unknown): value is Separator {
  return (SEPARATORS as readonly unknown[]).includes(value);
}

export function isGrouping(value: unknown): value is Grouping {
  return (GROUPINGS as readonly unknown[]).includes(value);
}

/** A place in the input: UTF-16 offsets [start, end) and the 1-based line and column of start. */
export interface Span {
  start: number;
  end: number;
  line: number;
  /** Counted in code points, so an emoji is one column. */
  column: number;
}

export type Utf8Problem =
  /** A 10xxxxxx byte where a character should start. */
  | 'unexpected-continuation'
  /** F8–FF: never part of UTF-8. */
  | 'invalid-byte'
  /** C0, C1, E0 80–9F, F0 80–8F: a character written with more bytes than it needs. */
  | 'overlong'
  /** ED A0–BF: U+D800–U+DFFF, reserved for UTF-16 surrogates. */
  | 'surrogate'
  /** F4 90–BF, F5–F7: beyond U+10FFFF. */
  | 'too-large'
  /** A lead byte followed by something other than a continuation byte. */
  | 'missing-continuation'
  /** A lead byte whose continuation bytes run past the end of the input. */
  | 'truncated';

/** The first UTF-8 problem in a byte sequence (indices are 0-based byte positions). */
export interface Utf8Issue {
  problem: Utf8Problem;
  /** First byte of the offending sequence. */
  start: number;
  /** The byte where the problem shows (equal to start, or a later byte of the sequence; the length for 'truncated'). */
  at: number;
  /** One past the last byte involved. */
  end: number;
  /** Length the lead byte announces (2–4), or 0 when there is no valid lead byte. */
  expected: number;
}

export type EncodeError =
  | { code: 'too-long'; limit: number }
  /** An unpaired UTF-16 surrogate: TextEncoder would silently write U+FFFD. */
  | { code: 'lone-surrogate'; span: Span; unit: number }
  /** ASCII mode: the first code point above 127, and how many there are in all. */
  | { code: 'non-ascii'; span: Span; codePoint: number; count: number };

export type DecodeError =
  | { code: 'too-long'; limit: number }
  | { code: 'invalid-character'; span: Span; char: string; codePoint: number }
  /** A group whose length is not a multiple of 8; `group` counts from 1. */
  | { code: 'group-length'; span: Span; group: number; bits: number }
  /** ASCII mode: the first byte above 127 (0-based index), its value, and how many there are in all. */
  | { code: 'non-ascii'; span: Span; byte: number; value: number; count: number }
  /** `byte` is the 0-based index of the offending sequence's first byte. */
  | { code: 'invalid-utf8'; span: Span; byte: number; issue: Utf8Issue; value: number };

export type EncodeResult = { ok: true; bytes: Uint8Array } | { ok: false; error: EncodeError };

/** An unfinished tail, tolerated while someone is still typing (DecodeOptions.partial). */
export interface Pending {
  /** Bits typed of the next byte: 0–7 (0 when only a 0b prefix has been typed). */
  bits: number;
  /** Complete bytes of a character whose remaining bytes are still missing. */
  bytes: number;
  /** Length that character's lead byte announces (0 when bytes is 0). */
  expected: number;
  span: Span;
}

export type DecodeResult =
  | {
      ok: true;
      text: string;
      /** Every complete byte, including those of a pending character. */
      bytes: Uint8Array;
      pending: Pending | null;
    }
  | { ok: false; error: DecodeError };

export interface DecodeOptions {
  /** Refuse bytes above 127. */
  ascii?: boolean;
  /**
   * Treat an unfinished end (a last group short of a byte, or a character missing its last
   * bytes) as pending instead of an error, and decode what comes before it.
   */
  partial?: boolean;
}

/** One group of bits as written: `bitsStart`..`end` holds only 0 and 1. */
export interface BitGroup {
  /** Offset of the group, including a 0b prefix. */
  start: number;
  /** Offset of the first bit (after a 0b prefix). */
  bitsStart: number;
  end: number;
}

export type ParseResult =
  | { ok: true; groups: BitGroup[] }
  | { ok: false; error: Extract<DecodeError, { code: 'invalid-character' | 'too-long' }> };

const BITS: readonly string[] = Array.from({ length: 256 }, (_, value) => value.toString(2).padStart(8, '0'));
const HEX: readonly string[] = Array.from({ length: 256 }, (_, value) =>
  value.toString(16).toUpperCase().padStart(2, '0'),
);

const COMMA = 0x2c;
const ZERO = 0x30;
const ONE = 0x31;
const LOWER_B = 0x62;
const UPPER_B = 0x42;
const WHITESPACE = /\s/u;

/** The eight bits of a byte: 65 → '01000001'. */
export function byteToBits(value: number): string {
  return BITS[value & 0xff] ?? '';
}

/** Two uppercase hex digits: 195 → 'C3'. */
export function byteToHex(value: number): string {
  return HEX[value & 0xff] ?? '';
}

/** U+XXXX notation with at least four digits: 252 → 'U+00FC', 128640 → 'U+1F680'. */
export function formatCodePoint(codePoint: number): string {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
}

export function spanAt(input: string, start: number, end: number): Span {
  const { line, column } = lineColumnAt(input, start);
  return { start, end, line, column };
}

function isHighSurrogate(unit: number): boolean {
  return unit >= 0xd800 && unit <= 0xdbff;
}

function isLowSurrogate(unit: number): boolean {
  return unit >= 0xdc00 && unit <= 0xdfff;
}

/** Number of bytes UTF-8 uses for a code point (lone surrogates: 3, as U+FFFD). */
export function utf8Length(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/** The UTF-8 bytes of one scalar value (U+0000–U+10FFFF without surrogates). */
export function utf8Bytes(codePoint: number): number[] {
  if (codePoint < 0x80) return [codePoint];
  if (codePoint < 0x800) return [0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f)];
  if (codePoint < 0x10000) {
    return [0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f)];
  }
  return [
    0xf0 | (codePoint >> 18),
    0x80 | ((codePoint >> 12) & 0x3f),
    0x80 | ((codePoint >> 6) & 0x3f),
    0x80 | (codePoint & 0x3f),
  ];
}

/**
 * How many leading bits of a byte are UTF-8 structure rather than payload: 1 for 0xxxxxxx,
 * 2 for a continuation byte 10xxxxxx, 3/4/5 for the lead bytes 110xxxxx/1110xxxx/11110xxx,
 * and 8 for bytes that never occur in UTF-8.
 */
export function utf8MarkerBits(value: number): number {
  if (value < 0x80) return 1;
  if ((value & 0xc0) === 0x80) return 2;
  if ((value & 0xe0) === 0xc0) return 3;
  if ((value & 0xf0) === 0xe0) return 4;
  if ((value & 0xf8) === 0xf0) return 5;
  return 8;
}

/** Sequence length a lead byte announces: 1–4, or 0 for a continuation or invalid byte. */
function announcedLength(value: number): number {
  if (value < 0x80) return 1;
  if (value >= 0xc2 && value <= 0xdf) return 2;
  if (value >= 0xe0 && value <= 0xef) return 3;
  if (value >= 0xf0 && value <= 0xf4) return 4;
  return 0;
}

/**
 * The first reason `bytes` is not UTF-8, or null. Follows the WHATWG decoder that TextDecoder
 * implements, so null here means TextDecoder('utf-8', { fatal: true }) accepts the bytes.
 */
export function findUtf8Issue(bytes: ArrayLike<number>): Utf8Issue | null {
  const length = bytes.length;
  let index = 0;
  while (index < length) {
    const lead = bytes[index] ?? 0;
    if (lead < 0x80) {
      index++;
      continue;
    }
    const expected = announcedLength(lead);
    if (expected === 0) {
      if (lead <= 0xbf) return { problem: 'unexpected-continuation', start: index, at: index, end: index + 1, expected: 0 };
      if (lead === 0xc0 || lead === 0xc1) return { problem: 'overlong', start: index, at: index, end: index + 1, expected: 2 };
      if (lead >= 0xf5 && lead <= 0xf7) return { problem: 'too-large', start: index, at: index, end: index + 1, expected: 4 };
      return { problem: 'invalid-byte', start: index, at: index, end: index + 1, expected: 0 };
    }
    // The second byte's range is narrowed for a few lead bytes; that rules out overlong forms,
    // surrogates and values above U+10FFFF without decoding.
    let lower = 0x80;
    let upper = 0xbf;
    if (lead === 0xe0) lower = 0xa0;
    else if (lead === 0xed) upper = 0x9f;
    else if (lead === 0xf0) lower = 0x90;
    else if (lead === 0xf4) upper = 0x8f;

    for (let offset = 1; offset < expected; offset++) {
      const at = index + offset;
      if (at >= length) return { problem: 'truncated', start: index, at: length, end: length, expected };
      const value = bytes[at] ?? 0;
      const low = offset === 1 ? lower : 0x80;
      const high = offset === 1 ? upper : 0xbf;
      if (value >= low && value <= high) continue;
      if (value >= 0x80 && value <= 0xbf) {
        // A continuation byte outside the narrowed range: the sequence is well formed but encodes
        // something UTF-8 forbids.
        const problem: Utf8Problem = lead === 0xed ? 'surrogate' : lead === 0xf4 ? 'too-large' : 'overlong';
        return { problem, start: index, at, end: at + 1, expected };
      }
      return { problem: 'missing-continuation', start: index, at, end: at + 1, expected };
    }
    index += expected;
  }
  return null;
}

/** Whitespace (as JavaScript's \s) or a comma. */
function isSeparatorUnit(unit: number): boolean {
  if (unit === 0x20 || unit === COMMA || (unit >= 0x09 && unit <= 0x0d)) return true;
  if (unit < 0x80) return false;
  return WHITESPACE.test(String.fromCharCode(unit));
}

/** Splits binary input into groups of bits, or reports the first character that is not allowed. */
export function parseBinary(input: string): ParseResult {
  if (input.length > MAX_BINARY_CHARS) return { ok: false, error: { code: 'too-long', limit: MAX_BYTES } };
  const groups: BitGroup[] = [];
  const length = input.length;
  let index = 0;
  while (index < length) {
    const unit = input.charCodeAt(index);
    if (isSeparatorUnit(unit)) {
      index++;
      continue;
    }
    const start = index;
    let bitsStart = index;
    const next = index + 1 < length ? input.charCodeAt(index + 1) : -1;
    // A 0b prefix only at the start of a group: "b" can never be a bit, so it is unambiguous.
    if (unit === ZERO && (next === LOWER_B || next === UPPER_B)) {
      index += 2;
      bitsStart = index;
    }
    while (index < length) {
      const current = input.charCodeAt(index);
      if (current === ZERO || current === ONE) {
        index++;
        continue;
      }
      if (isSeparatorUnit(current)) break;
      const codePoint = input.codePointAt(index) ?? current;
      const char = String.fromCodePoint(codePoint);
      return {
        ok: false,
        error: { code: 'invalid-character', span: spanAt(input, index, index + char.length), char, codePoint },
      };
    }
    groups.push({ start, bitsStart, end: index });
  }
  return { ok: true, groups };
}

/** Reads binary input back into text. */
export function decodeBinary(input: string, options: DecodeOptions = {}): DecodeResult {
  const parsed = parseBinary(input);
  if (!parsed.ok) return parsed;
  const { groups } = parsed;
  const last = groups.length - 1;

  // Pass 1: check group lengths and count the bytes.
  let byteCount = 0;
  let pendingBits = 0;
  let pendingBitsStart = -1;
  for (let index = 0; index <= last; index++) {
    const group = groups[index];
    if (!group) continue;
    const bits = group.end - group.bitsStart;
    const rest = bits % 8;
    if (rest !== 0 || bits === 0) {
      if (options.partial && index === last) {
        pendingBits = rest;
        pendingBitsStart = bits === 0 ? group.start : group.end - rest;
      } else {
        return {
          ok: false,
          error: { code: 'group-length', span: spanAt(input, group.start, group.end), group: index + 1, bits },
        };
      }
    }
    byteCount += (bits - rest) / 8;
  }
  if (byteCount > MAX_BYTES) return { ok: false, error: { code: 'too-long', limit: MAX_BYTES } };

  // Pass 2: the bytes, and where each one is written (its eight bits are contiguous).
  const bytes = new Uint8Array(byteCount);
  const offsets = new Uint32Array(byteCount);
  let byteIndex = 0;
  for (const group of groups) {
    const whole = group.end - group.bitsStart - ((group.end - group.bitsStart) % 8);
    for (let offset = group.bitsStart; offset < group.bitsStart + whole; offset += 8) {
      let value = 0;
      for (let bit = 0; bit < 8; bit++) value = (value << 1) | (input.charCodeAt(offset + bit) - ZERO);
      bytes[byteIndex] = value;
      offsets[byteIndex] = offset;
      byteIndex++;
    }
  }
  const byteSpan = (first: number, end: number): Span =>
    spanAt(input, offsets[first] ?? 0, (offsets[Math.max(first, end - 1)] ?? 0) + 8);

  if (options.ascii) {
    let first = -1;
    let count = 0;
    for (let index = 0; index < byteCount; index++) {
      if ((bytes[index] ?? 0) > ASCII_MAX) {
        if (first < 0) first = index;
        count++;
      }
    }
    if (first >= 0) {
      return {
        ok: false,
        error: { code: 'non-ascii', span: byteSpan(first, first + 1), byte: first, value: bytes[first] ?? 0, count },
      };
    }
  }

  let pendingBytes = 0;
  let pendingExpected = 0;
  const issue = findUtf8Issue(bytes);
  if (issue) {
    if (options.partial && issue.problem === 'truncated') {
      pendingBytes = byteCount - issue.start;
      pendingExpected = issue.expected;
    } else {
      return {
        ok: false,
        error: {
          code: 'invalid-utf8',
          span: byteSpan(issue.start, issue.end),
          byte: issue.start,
          issue,
          value: bytes[issue.at] ?? bytes[issue.start] ?? 0,
        },
      };
    }
  }

  // ignoreBOM keeps a leading U+FEFF: the default would drop it and break the round trip.
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
    bytes.subarray(0, byteCount - pendingBytes),
  );

  let pending: Pending | null = null;
  if (pendingBytes > 0 || pendingBitsStart >= 0) {
    const start = pendingBytes > 0 ? (offsets[byteCount - pendingBytes] ?? 0) : pendingBitsStart;
    const lastGroup = groups[last];
    pending = {
      bits: pendingBits,
      bytes: pendingBytes,
      expected: pendingExpected,
      span: spanAt(input, start, lastGroup ? lastGroup.end : start),
    };
  }
  return { ok: true, text, bytes, pending };
}

/** Encodes text as UTF-8, refusing lone surrogates and, in ASCII mode, code points above 127. */
export function encodeText(text: string, options: { ascii?: boolean } = {}): EncodeResult {
  // Every UTF-16 unit becomes at least one byte, so this bound needs no encoding.
  if (text.length > MAX_BYTES) return { ok: false, error: { code: 'too-long', limit: MAX_BYTES } };
  let firstNonAscii = -1;
  let nonAsciiCount = 0;
  for (let index = 0; index < text.length; index++) {
    const unit = text.charCodeAt(index);
    if (unit <= ASCII_MAX) continue;
    const pair = isHighSurrogate(unit) && isLowSurrogate(text.charCodeAt(index + 1));
    if (!pair && (isHighSurrogate(unit) || isLowSurrogate(unit))) {
      return { ok: false, error: { code: 'lone-surrogate', span: spanAt(text, index, index + 1), unit } };
    }
    if (firstNonAscii < 0) firstNonAscii = index;
    nonAsciiCount++;
    if (pair) index++;
  }
  if (options.ascii && firstNonAscii >= 0) {
    const codePoint = text.codePointAt(firstNonAscii) ?? 0;
    return {
      ok: false,
      error: {
        code: 'non-ascii',
        span: spanAt(text, firstNonAscii, firstNonAscii + (codePoint > 0xffff ? 2 : 1)),
        codePoint,
        count: nonAsciiCount,
      },
    };
  }
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > MAX_BYTES) return { ok: false, error: { code: 'too-long', limit: MAX_BYTES } };
  return { ok: true, bytes };
}

const JOINERS: Record<Separator, string> = { space: ' ', none: '', newline: '\n' };

/**
 * Writes bytes as groups of bits. With grouping 'character', a byte that continues a UTF-8
 * sequence (10xxxxxx) joins the previous group, so each group is one code point.
 */
export function formatBinary(bytes: ArrayLike<number>, options: FormatOptions = DEFAULT_FORMAT): string {
  const joiner = JOINERS[options.separator];
  const perCharacter = options.grouping === 'character';
  const parts: string[] = [];
  for (let index = 0; index < bytes.length; index++) {
    const value = bytes[index] ?? 0;
    const bits = byteToBits(value);
    const continues = perCharacter && index > 0 && (value & 0xc0) === 0x80;
    if (continues) parts[parts.length - 1] += bits;
    else parts.push(bits);
  }
  return parts.join(joiner);
}

/**
 * Rewrites binary input in another layout, keeping an unfinished tail as typed. Null when the
 * input does not decode (it is then left for the person to fix).
 */
export function reformatBinary(input: string, options: FormatOptions, decode: DecodeOptions = {}): string | null {
  const result = decodeBinary(input, { ...decode, partial: true });
  if (!result.ok) return null;
  const body = formatBinary(result.bytes, options);
  const pending = result.pending;
  if (!pending || pending.bits === 0) return body;
  const tail = input.slice(pending.span.end - pending.bits, pending.span.end);
  if (!body) return tail;
  return body + JOINERS[options.separator] + tail;
}

// ---------------------------------------------------------------------------------------------
// Per-character breakdown

export type CharKind = 'printable' | 'space' | 'control' | 'format' | 'combining' | 'surrogate';

export interface CharInfo {
  /** 0-based position among the code points. */
  index: number;
  /** UTF-16 offset in the text. */
  offset: number;
  char: string;
  codePoint: number;
  /** UTF-8 bytes (empty for a lone surrogate, which UTF-8 cannot hold). */
  bytes: number[];
  kind: CharKind;
  /** Standard abbreviation for characters that show nothing by themselves (LF, NBSP, ZWJ, VS16…). */
  name: string | null;
}

export interface Breakdown {
  rows: CharInfo[];
  /** Code points in the whole text. */
  total: number;
  /** UTF-8 bytes of the whole text. */
  bytes: number;
}

/** Rows shown at most; longer texts are summarised. */
export const MAX_BREAKDOWN_ROWS = 256;

const C0_NAMES = [
  'NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL', 'BS', 'HT', 'LF', 'VT', 'FF', 'CR', 'SO', 'SI',
  'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB', 'CAN', 'EM', 'SUB', 'ESC', 'FS', 'GS', 'RS', 'US',
];
const C1_NAMES = [
  'PAD', 'HOP', 'BPH', 'NBH', 'IND', 'NEL', 'SSA', 'ESA', 'HTS', 'HTJ', 'VTS', 'PLD', 'PLU', 'RI', 'SS2', 'SS3',
  'DCS', 'PU1', 'PU2', 'STS', 'CCH', 'MW', 'SPA', 'EPA', 'SOS', 'SGC', 'SCI', 'CSI', 'ST', 'OSC', 'PM', 'APC',
];
/** Unicode's abbreviation aliases for invisible characters people meet in practice. */
const NAMED: ReadonlyMap<number, string> = new Map([
  [0x20, 'SP'],
  [0x7f, 'DEL'],
  [0xa0, 'NBSP'],
  [0xad, 'SHY'],
  [0x34f, 'CGJ'],
  [0x61c, 'ALM'],
  [0x1680, 'OSM'],
  [0x180e, 'MVS'],
  [0x2000, 'NQSP'],
  [0x2001, 'MQSP'],
  [0x2002, 'ENSP'],
  [0x2003, 'EMSP'],
  [0x2004, '3/MSP'],
  [0x2005, '4/MSP'],
  [0x2006, '6/MSP'],
  [0x2007, 'FSP'],
  [0x2008, 'PSP'],
  [0x2009, 'THSP'],
  [0x200a, 'HSP'],
  [0x200b, 'ZWSP'],
  [0x200c, 'ZWNJ'],
  [0x200d, 'ZWJ'],
  [0x200e, 'LRM'],
  [0x200f, 'RLM'],
  [0x2028, 'LSEP'],
  [0x2029, 'PSEP'],
  [0x202a, 'LRE'],
  [0x202b, 'RLE'],
  [0x202c, 'PDF'],
  [0x202d, 'LRO'],
  [0x202e, 'RLO'],
  [0x202f, 'NNBSP'],
  [0x205f, 'MMSP'],
  [0x2060, 'WJ'],
  [0x2066, 'LRI'],
  [0x2067, 'RLI'],
  [0x2068, 'FSI'],
  [0x2069, 'PDI'],
  [0x3000, 'IDSP'],
  [0xfeff, 'ZWNBSP'],
]);

/** Abbreviation for a code point that has no visible glyph of its own, or null. */
export function invisibleName(codePoint: number): string | null {
  if (codePoint < 0x20) return C0_NAMES[codePoint] ?? null;
  if (codePoint >= 0x80 && codePoint <= 0x9f) return C1_NAMES[codePoint - 0x80] ?? null;
  const named = NAMED.get(codePoint);
  if (named) return named;
  if (codePoint >= 0xfe00 && codePoint <= 0xfe0f) return `VS${codePoint - 0xfe00 + 1}`;
  if (codePoint >= 0xe0100 && codePoint <= 0xe01ef) return `VS${codePoint - 0xe0100 + 17}`;
  if (codePoint >= 0xe0000 && codePoint <= 0xe007f) return 'TAG';
  return null;
}

const CONTROL = /^\p{Cc}$/u;
const SPACE = /^[\p{Zs}\p{Zl}\p{Zp}]$/u;
const FORMAT = /^\p{Cf}$/u;
const MARK = /^\p{M}$/u;

export function charKind(codePoint: number): CharKind {
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) return 'surrogate';
  const char = String.fromCodePoint(codePoint);
  if (CONTROL.test(char)) return 'control';
  if (SPACE.test(char)) return 'space';
  if (FORMAT.test(char)) return 'format';
  if (MARK.test(char)) return 'combining';
  return 'printable';
}

/** Code points and UTF-8 bytes of the first `limit` characters, with totals for the whole text. */
export function breakdown(text: string, limit = MAX_BREAKDOWN_ROWS): Breakdown {
  const rows: CharInfo[] = [];
  let total = 0;
  let bytes = 0;
  for (let offset = 0; offset < text.length; ) {
    const unit = text.charCodeAt(offset);
    const pair = isHighSurrogate(unit) && isLowSurrogate(text.charCodeAt(offset + 1));
    const codePoint = pair ? (text.codePointAt(offset) ?? unit) : unit;
    const size = pair ? 2 : 1;
    const lone = !pair && (isHighSurrogate(unit) || isLowSurrogate(unit));
    bytes += utf8Length(codePoint);
    if (rows.length < limit) {
      rows.push({
        index: total,
        offset,
        char: text.slice(offset, offset + size),
        codePoint,
        bytes: lone ? [] : utf8Bytes(codePoint),
        kind: lone ? 'surrogate' : charKind(codePoint),
        name: lone ? null : invisibleName(codePoint),
      });
    }
    total++;
    offset += size;
  }
  return { rows, total, bytes };
}

// ---------------------------------------------------------------------------------------------
// Pointing at a position

export interface Excerpt {
  before: string;
  focus: string;
  after: string;
  /** Text was cut before `before` / after `after`. */
  clippedStart: boolean;
  clippedEnd: boolean;
}

/** Line breaks and tabs made visible, so an excerpt stays on one line. */
function visible(value: string): string {
  return value.replace(/\r\n|\r|\n/g, '↵').replace(/\t/g, '⇥');
}

/** Moves an offset off the second half of a surrogate pair. */
function snap(text: string, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, text.length));
  if (clamped > 0 && clamped < text.length && isLowSurrogate(text.charCodeAt(clamped)) && isHighSurrogate(text.charCodeAt(clamped - 1))) {
    return clamped - 1;
  }
  return clamped;
}

/**
 * A one-line window around [start, end) for showing where a problem is: up to `radius` UTF-16
 * units on each side, the focus shortened to `maxFocus` units, never splitting a surrogate pair.
 */
export function excerpt(text: string, start: number, end: number, radius = 14, maxFocus = 24): Excerpt {
  const from = snap(text, start);
  const to = Math.max(from, snap(text, end));
  const focusEnd = to - from > maxFocus ? snap(text, from + maxFocus) : to;
  const beforeStart = snap(text, from - radius);
  const afterEnd = snap(text, to + radius);
  return {
    before: visible(text.slice(beforeStart, from)),
    focus: visible(text.slice(from, focusEnd)) + (focusEnd < to ? '…' : ''),
    after: visible(text.slice(to, afterEnd)),
    clippedStart: beforeStart > 0,
    clippedEnd: afterEnd < text.length,
  };
}
