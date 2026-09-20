/**
 * Find & replace for plain text. Pure: no DOM.
 *
 * Every compiled pattern uses the `u` flag, so indexes advance by whole code points and
 * `\p{…}` classes work. Replacement templates follow String.prototype.replace exactly.
 */

export interface SearchOptions {
  query: string;
  matchCase: boolean;
  wholeWord: boolean;
  regex: boolean;
  /** Regex mode only: `^` and `$` match at every line (flag `m`). */
  multiline: boolean;
  /** Regex mode only: `.` also matches line breaks (flag `s`). */
  dotAll: boolean;
}

export type CompiledSearch =
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'ok'; regex: RegExp };

export interface TextMatch {
  start: number;
  end: number;
  text: string;
  /** Numbered capture groups ($1, $2, …); undefined for groups that did not take part. */
  groups: (string | undefined)[];
  /** Named capture groups, only when the pattern declares any. */
  namedGroups?: Record<string, string | undefined>;
}

/** Default cap for matches that are drawn and navigated. */
export const MATCH_LIMIT = 10_000;

/**
 * Letters, numbers, combining marks and underscore. `\b` only knows ASCII word characters,
 * so it would treat "ğ" or "ı" as a boundary.
 */
const WORD_CHAR = '[\\p{L}\\p{N}\\p{M}_]';

/** Characters with a meaning in a pattern. `-` and `/` are left alone: escaping them is a syntax error with `u`. */
const REGEX_SYNTAX = /[\\^$.*+?()[\]{}|]/g;

export function escapeRegExp(value: string): string {
  return value.replace(REGEX_SYNTAX, '\\$&');
}

export function compileSearch(options: SearchOptions): CompiledSearch {
  if (options.query === '') return { status: 'empty' };

  let flags = 'gu';
  if (!options.matchCase) flags += 'i';
  if (options.regex && options.multiline) flags += 'm';
  if (options.regex && options.dotAll) flags += 's';

  let source = options.regex ? options.query : escapeRegExp(options.query);
  try {
    // Validate the user's pattern on its own first: wrapping it could turn an invalid
    // pattern such as "a)(b" into a valid one with a different meaning.
    if (options.regex) new RegExp(source, flags);
    if (options.wholeWord) source = `(?<!${WORD_CHAR})(?:${source})(?!${WORD_CHAR})`;
    return { status: 'ok', regex: new RegExp(source, flags) };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}

/** Index of the code point after `index` (skips both halves of a surrogate pair). */
export function advanceIndex(text: string, index: number): number {
  if (index + 1 >= text.length) return index + 1;
  const first = text.charCodeAt(index);
  if (first < 0xd800 || first > 0xdbff) return index + 1;
  const second = text.charCodeAt(index + 1);
  return second >= 0xdc00 && second <= 0xdfff ? index + 2 : index + 1;
}

/** A search start offset clamped to the text and moved off the second half of a surrogate pair. */
function startOffset(text: string, from: number): number {
  if (!(from > 0)) return 0;
  const index = Math.min(Math.floor(from), text.length + 1);
  if (index > 0 && index < text.length) {
    const code = text.charCodeAt(index);
    const previous = text.charCodeAt(index - 1);
    if (code >= 0xdc00 && code <= 0xdfff && previous >= 0xd800 && previous <= 0xdbff) return index + 1;
  }
  return index;
}

function toTextMatch(result: RegExpExecArray): TextMatch {
  const start = result.index;
  const value = result[0];
  const match: TextMatch = {
    start,
    end: start + value.length,
    text: value,
    groups: Array.prototype.slice.call(result, 1) as (string | undefined)[],
  };
  if (result.groups) match.namedGroups = { ...result.groups };
  return match;
}

/**
 * Calls `visit` for every match from left to right, until it returns false.
 * Zero-length matches are reported too; the search then moves on by one code point.
 * `from` skips matches that start earlier; the pattern still sees the whole text, so `^`,
 * `\b` and lookbehinds keep their context.
 */
export function forEachMatch(
  text: string,
  regex: RegExp,
  visit: (match: TextMatch) => boolean,
  from = 0,
): void {
  // A private copy: the caller's lastIndex is never touched, and `y` would stop at the first gap.
  let flags = regex.flags.replace('y', '');
  if (!flags.includes('g')) flags += 'g';
  const re = new RegExp(regex.source, flags);
  re.lastIndex = startOffset(text, from);

  while (re.lastIndex <= text.length) {
    const result = re.exec(text);
    if (!result) break;
    const match = toTextMatch(result);
    if (!visit(match)) break;
    if (match.start === match.end) re.lastIndex = advanceIndex(text, match.end);
  }
}

/** The first `limit` matches that start at or after `from`; `truncated` when more follow. */
export function findMatches(
  text: string,
  regex: RegExp,
  limit = MATCH_LIMIT,
  from = 0,
): { matches: TextMatch[]; truncated: boolean } {
  const matches: TextMatch[] = [];
  let truncated = false;
  forEachMatch(
    text,
    regex,
    (match) => {
      if (matches.length >= limit) {
        truncated = true;
        return false;
      }
      matches.push(match);
      return true;
    },
    from,
  );
  return { matches, truncated };
}

/** Every match, without a limit (for Replace all). */
export function findAllMatches(text: string, regex: RegExp): TextMatch[] {
  return findMatches(text, regex, Infinity).matches;
}

/** Up to MATCH_LIMIT consecutive matches: the part of a long result list that is drawn and navigated. */
export interface MatchWindow {
  matches: TextMatch[];
  /**
   * 0 when the list starts with the first match of the text. Otherwise the offset the list was
   * collected from: earlier matches exist (lists only start later when there are more than the limit).
   */
  start: number;
  /** More matches follow the last listed one. */
  truncated: boolean;
}

export type WindowRequest =
  /**
   * The first matches of the text when one of them starts at or after `offset` (or there are no
   * more); otherwise matches from `hint` (an earlier window's start, when that still reaches
   * `offset`) or from `offset` on. Wraps to the first matches when none starts at or after `offset`.
   */
  | { kind: 'around'; offset: number; hint?: number }
  /** Matches that start at or after `offset`; the first matches of the text when there are none. */
  | { kind: 'after'; offset: number }
  /** The last matches that start before `offset`; the last matches of the text when there are none. */
  | { kind: 'before'; offset: number };

/** Characters searched before `offset` at first when looking backwards; grows fourfold until enough matches turn up. */
const BACKWARD_SPAN = 1 << 16;

function matchesBefore(text: string, regex: RegExp, offset: number, limit: number): MatchWindow {
  const end = Math.min(offset, text.length + 1);
  for (let span = BACKWARD_SPAN; ; span *= 4) {
    const from = Math.max(0, end - span);
    // A ring buffer keeps the last `limit` matches before `end`.
    const ring: TextMatch[] = [];
    let head = 0;
    let overflow = false;
    let truncated = false;
    forEachMatch(
      text,
      regex,
      (match) => {
        if (match.start >= end) {
          truncated = true;
          return false;
        }
        if (ring.length < limit) {
          ring.push(match);
        } else {
          ring[head] = match;
          head = (head + 1) % limit;
          overflow = true;
        }
        return true;
      },
      from,
    );
    if (from === 0 || ring.length >= limit) {
      const matches = overflow ? ring.slice(head).concat(ring.slice(0, head)) : ring;
      const start = from === 0 && !overflow ? 0 : (matches[0]?.start ?? from);
      return { matches, start, truncated };
    }
  }
}

/** The matches to list for `request`, at most `limit` of them (see WindowRequest). */
export function findMatchWindow(
  text: string,
  regex: RegExp,
  request: WindowRequest,
  limit = MATCH_LIMIT,
): MatchWindow {
  const listFrom = (from: number): MatchWindow => ({ ...findMatches(text, regex, limit, from), start: Math.max(0, from) });
  const reaches = (window: MatchWindow, offset: number): boolean =>
    window.matches.length > 0 && window.matches[window.matches.length - 1]!.start >= offset;

  if (request.kind === 'before') {
    const before = matchesBefore(text, regex, request.offset, limit);
    if (before.matches.length > 0 || request.offset > text.length) return before;
    return matchesBefore(text, regex, Infinity, limit);
  }

  if (request.kind === 'after') {
    if (request.offset > 0) {
      const after = listFrom(request.offset);
      if (after.matches.length > 0) return after;
    }
    return listFrom(0);
  }

  const first = listFrom(0);
  const offset = request.offset;
  if (!first.truncated || offset <= 0 || reaches(first, offset)) return first;
  const hint = request.hint ?? 0;
  if (hint > 0 && hint <= offset) {
    const fromHint = listFrom(hint);
    if (reaches(fromHint, offset)) return fromHint;
    if (!fromHint.truncated) return first; // nothing starts at or after offset: wrap around
  }
  const fromOffset = listFrom(offset);
  return fromOffset.matches.length > 0 ? fromOffset : first;
}

/**
 * Where searching continues after `match` was replaced by `replacementLength` units: after the
 * inserted text, and one further for an empty match (such as `$` or `\b`), which would otherwise
 * be found again at the same place.
 */
export function offsetAfterReplacement(match: TextMatch, replacementLength: number): number {
  return match.start + replacementLength + (match.start === match.end ? 1 : 0);
}

const DOLLAR = 36;
const AMPERSAND = 38;
const APOSTROPHE = 39;
const LESS_THAN = 60;
const BACKTICK = 96;
const DIGIT_0 = 48;
const DIGIT_9 = 57;

function isDigit(code: number): boolean {
  return code >= DIGIT_0 && code <= DIGIT_9;
}

/**
 * The replacement text for one match. Regex mode implements the substitution patterns of
 * String.prototype.replace (GetSubstitution): $$, $&, $`, $', $n, $nn and $<name>.
 * Literal mode inserts the template as typed.
 */
export function expandReplacement(template: string, match: TextMatch, input: string, isRegex: boolean): string {
  if (!isRegex) return template;
  let dollar = template.indexOf('$');
  if (dollar === -1) return template;

  const captures = match.groups;
  const captureCount = captures.length;
  let result = '';
  let position = 0;

  while (dollar !== -1) {
    result += template.slice(position, dollar);
    const next = template.charCodeAt(dollar + 1); // NaN past the end

    if (next === DOLLAR) {
      result += '$';
      position = dollar + 2;
    } else if (next === AMPERSAND) {
      result += match.text;
      position = dollar + 2;
    } else if (next === BACKTICK) {
      result += input.slice(0, match.start);
      position = dollar + 2;
    } else if (next === APOSTROPHE) {
      result += input.slice(Math.min(match.start + match.text.length, input.length));
      position = dollar + 2;
    } else if (isDigit(next)) {
      const second = template.charCodeAt(dollar + 2);
      let digitCount = isDigit(second) ? 2 : 1;
      let index = digitCount === 2 ? (next - DIGIT_0) * 10 + (second - DIGIT_0) : next - DIGIT_0;
      // "$10" with fewer than 10 groups means group 1 followed by a literal "0".
      if (digitCount === 2 && index > captureCount) {
        digitCount = 1;
        index = next - DIGIT_0;
      }
      if (index >= 1 && index <= captureCount) {
        result += captures[index - 1] ?? '';
      } else {
        result += template.slice(dollar, dollar + 1 + digitCount);
      }
      position = dollar + 1 + digitCount;
    } else if (next === LESS_THAN) {
      const close = template.indexOf('>', dollar + 2);
      const named = match.namedGroups;
      if (close === -1 || named === undefined) {
        result += '$<';
        position = dollar + 2;
      } else {
        const name = template.slice(dollar + 2, close);
        result += (Object.hasOwn(named, name) ? named[name] : undefined) ?? '';
        position = close + 1;
      }
    } else {
      result += '$';
      position = dollar + 1;
    }

    dollar = template.indexOf('$', position);
  }

  return result + template.slice(position);
}

/**
 * Replaces the given matches (sorted, non-overlapping, all found in `text`) in one pass.
 * Pass the complete list, not a truncated one.
 */
export function replaceAllMatches(
  text: string,
  matches: readonly TextMatch[],
  template: string,
  isRegex: boolean,
): { text: string; count: number } {
  const parts: string[] = [];
  let last = 0;
  for (const match of matches) {
    parts.push(text.slice(last, match.start), expandReplacement(template, match, text, isRegex));
    last = match.end;
  }
  parts.push(text.slice(last));
  return { text: parts.join(''), count: matches.length };
}

/** Finds and replaces every match without keeping the whole match list in memory. */
export function replaceAllInText(
  text: string,
  regex: RegExp,
  template: string,
  isRegex: boolean,
): { text: string; count: number } {
  const parts: string[] = [];
  let last = 0;
  let count = 0;
  forEachMatch(text, regex, (match) => {
    parts.push(text.slice(last, match.start), expandReplacement(template, match, text, isRegex));
    last = match.end;
    count++;
    return true;
  });
  if (count === 0) return { text, count };
  parts.push(text.slice(last));
  return { text: parts.join(''), count };
}

export function replaceMatch(
  text: string,
  match: TextMatch,
  template: string,
  isRegex: boolean,
): { text: string; replacementEnd: number } {
  const replacement = expandReplacement(template, match, text, isRegex);
  return {
    text: text.slice(0, match.start) + replacement + text.slice(match.end),
    replacementEnd: match.start + replacement.length,
  };
}

/** Index of the first match that starts at or after `offset`, or -1. Matches must be sorted. */
export function firstMatchAtOrAfter(matches: readonly TextMatch[], offset: number): number {
  let low = 0;
  let high = matches.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (matches[mid]!.start < offset) low = mid + 1;
    else high = mid;
  }
  return low < matches.length ? low : -1;
}

/** Index of the last match that starts before `offset`, or -1. Matches must be sorted. */
export function lastMatchBefore(matches: readonly TextMatch[], offset: number): number {
  let low = 0;
  let high = matches.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (matches[mid]!.start < offset) low = mid + 1;
    else high = mid;
  }
  return low - 1;
}
