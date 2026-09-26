/**
 * Reads latitude and longitude as people write them, and says precisely what is wrong when it
 * cannot. Returns numbers or error codes, never prose (the page words the codes per language).
 *
 * Accepted, for one value (parseCoordinate) or a pair (parsePair):
 * - decimal degrees, signed or with a hemisphere letter before or after: 41.0082, -33.8688,
 *   41.0082 N, N41.0082, 41.0082°N;
 * - degrees and minutes, or degrees, minutes and seconds, with typographic or ASCII marks, or
 *   bare numbers separated by spaces: 41°00′29.5″N, 41°0.4917'N, 41 00 29.5 N, 41°00'29.5"N;
 *   only the last part may have decimals, and minutes and seconds stay below 60;
 * - hemisphere letters in English (N, S, E, W) or Turkish (K kuzey, G güney, D doğu, B batı),
 *   in either case. The two sets share no letter, so both are always accepted;
 * - a decimal comma, as Turkish writes numbers (41,0082), whenever the text has no decimal
 *   point: "41,0082 28,9784" and "41,0082; 28,9784" are pairs of decimal numbers;
 * - for pairs, the values separated by a comma, semicolon, slash, the hemisphere letters, or
 *   (for plain numbers) a space. Latitude comes first unless the letters say otherwise
 *   ("28.9784 E, 41.0082 N" is read the right way round).
 */
import type { LatLon } from './sphere.ts';

export type Axis = 'lat' | 'lon';
export type Hemisphere = 'N' | 'S' | 'E' | 'W';

export type ParseErrorCode =
  /** Nothing but whitespace. */
  | 'empty'
  /** Characters or an order that do not form a coordinate. */
  | 'syntax'
  | 'lat-range'
  | 'lon-range'
  | 'minutes-range'
  | 'seconds-range'
  /** A part other than the last has decimals (41.5°30′). */
  | 'fraction'
  /** A minus sign and a hemisphere letter together (−41 S). */
  | 'sign-and-hemisphere'
  /** One value: its letter names the other axis (28° E in a latitude field). */
  | 'wrong-axis'
  /** One value expected, several found (a whole pair in one field). */
  | 'multiple'
  /** A pair expected, one value found. */
  | 'one-value'
  /** A pair expected, more than two values found. */
  | 'too-many'
  /** A pair whose letters make both values latitudes, or both longitudes. */
  | 'same-axis';

export type ParseResult<T> = { ok: true; value: T } | { ok: false; code: ParseErrorCode };

export interface ParsedPair extends LatLon {
  /** The part of the input that held each value, as typed (for filling two fields from one paste). */
  latText: string;
  lonText: string;
}

/** Largest absolute value per axis. */
export const AXIS_LIMIT: Readonly<Record<Axis, number>> = { lat: 90, lon: 180 };

// ------------------------------------------------------------------ tokens

const DEGREE_MARKS = new Set(['°', 'º', '˚']);
const MINUTE_MARKS = new Set(["'", '′', '’', '‘', '´', '`', 'ʹ']);
const SECOND_MARKS = new Set(['"', '″', '”', '“', '˝', 'ʺ']);
const HEMISPHERE_LETTERS: Readonly<Record<string, Hemisphere>> = {
  N: 'N',
  S: 'S',
  E: 'E',
  W: 'W',
  K: 'N',
  G: 'S',
  D: 'E',
  B: 'W',
};
/** Dashes people use as minus signs. Each is one UTF-16 unit, so replacing them keeps offsets. */
const MINUS_SIGNS = /[‐‒–—−﹣－]/g;
const LETTER = /\p{L}/u;
const WHITESPACE = /\s/;

type Unit = 0 | 1 | 2; // degrees, minutes, seconds

type Token = { start: number; end: number } & (
  | { kind: 'number'; value: number; fractional: boolean }
  | { kind: 'sign'; negative: boolean }
  | { kind: 'mark'; unit: Unit }
  | { kind: 'hemisphere'; hemisphere: Hemisphere }
  | { kind: 'separator' }
);

/**
 * Splits the text into tokens, or returns null at the first character that has no place in a
 * coordinate. With `decimalComma`, a comma between digits is a decimal separator (the caller
 * only asks for this when the text has no decimal point).
 */
function tokenize(text: string, decimalComma: boolean): Token[] | null {
  // Digits must follow a decimal separator: "41." or "41..5" is a typo, not 41 and 0.5.
  const numberPattern = decimalComma ? /\d+(?:,\d+)?/y : /\d+(?:\.\d+)?|\.\d+/y;
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const char = text.charAt(i);
    if (WHITESPACE.test(char)) {
      i++;
      continue;
    }
    numberPattern.lastIndex = i;
    const number = numberPattern.exec(text);
    if (number) {
      const raw = number[0].replace(',', '.');
      tokens.push({ kind: 'number', value: Number.parseFloat(raw), fractional: /\.\d/.test(raw), start: i, end: numberPattern.lastIndex });
      i = numberPattern.lastIndex;
      continue;
    }
    if (char === '-' || char === '+') {
      tokens.push({ kind: 'sign', negative: char === '-', start: i, end: i + 1 });
      i++;
      continue;
    }
    if (DEGREE_MARKS.has(char)) {
      tokens.push({ kind: 'mark', unit: 0, start: i, end: i + 1 });
      i++;
      continue;
    }
    // Two minute marks ('' or ′′) make a second mark.
    if (MINUTE_MARKS.has(char) && MINUTE_MARKS.has(text.charAt(i + 1))) {
      tokens.push({ kind: 'mark', unit: 2, start: i, end: i + 2 });
      i += 2;
      continue;
    }
    if (MINUTE_MARKS.has(char) || SECOND_MARKS.has(char)) {
      tokens.push({ kind: 'mark', unit: MINUTE_MARKS.has(char) ? 1 : 2, start: i, end: i + 1 });
      i++;
      continue;
    }
    if (char === ',' || char === ';' || char === '/') {
      tokens.push({ kind: 'separator', start: i, end: i + 1 });
      i++;
      continue;
    }
    const hemisphere = HEMISPHERE_LETTERS[char.toUpperCase()];
    // A lone letter only: "North" or "Kuzey" is not a hemisphere letter followed by noise.
    if (hemisphere && !LETTER.test(text.charAt(i + 1))) {
      tokens.push({ kind: 'hemisphere', hemisphere, start: i, end: i + 1 });
      i++;
      continue;
    }
    return null;
  }
  return tokens;
}

// ------------------------------------------------------------------ groups (one value each)

interface Component {
  value: number;
  fractional: boolean;
  unit: Unit;
  /** Whether a mark fixed the unit; unmarked parts take the next unit in order. */
  marked: boolean;
  start: number;
  end: number;
}

interface Group {
  negative: boolean | null;
  hemisphere: Hemisphere | null;
  components: Component[];
  start: number;
  end: number;
}

function emptyGroup(): Group {
  return { negative: null, hemisphere: null, components: [], start: -1, end: -1 };
}

function isEmpty(group: Group): boolean {
  return group.components.length === 0 && group.negative === null && group.hemisphere === null;
}

/**
 * Collects tokens into values. Boundaries between values: a separator; a hemisphere letter
 * (after the value, or before it when the text starts with a letter); a sign after a number; a
 * mark that does not continue the sequence ° ′ ″ ("41° 28°"); and, for a pair written as plain
 * numbers only, the space between them ("41.0082 28.9784"). Within one value, bare numbers
 * continue as minutes and seconds ("41 00 29.5").
 */
function collect(tokens: readonly Token[], context: 'single' | 'pair'): Group[] | null {
  const prefixLetters = tokens[0]?.kind === 'hemisphere';
  const bareNumbers =
    context === 'pair' && tokens.every((token) => token.kind === 'number' || token.kind === 'sign');
  const groups: Group[] = [];
  let current = emptyGroup();
  let previous: Token['kind'] | null = null;

  const add = (token: Token) => {
    if (current.start < 0) current.start = token.start;
    current.end = token.end;
  };
  const close = () => {
    if (!isEmpty(current)) groups.push(current);
    current = emptyGroup();
  };

  for (const token of tokens) {
    switch (token.kind) {
      case 'separator':
        if (current.components.length > 0) close();
        // A sign or letter with no number, a leading or a doubled separator.
        else if (!isEmpty(current) || previous !== 'hemisphere') return null;
        break;
      case 'hemisphere':
        if (prefixLetters) {
          if (!isEmpty(current)) {
            if (current.components.length === 0) return null;
            close();
          }
          add(token);
          current.hemisphere = token.hemisphere;
        } else {
          if (current.components.length === 0) return null;
          add(token);
          current.hemisphere = token.hemisphere;
          close();
        }
        break;
      case 'sign':
        if (current.components.length > 0) close();
        // A sign after a leading letter is kept, so "N -41" reports the conflict, not a syntax error.
        if (current.negative !== null) return null;
        add(token);
        current.negative = token.negative;
        break;
      case 'number': {
        if (bareNumbers && current.components.length > 0) close();
        const last = current.components.at(-1);
        const unit = last ? last.unit + 1 : 0;
        if (unit > 2) return null;
        add(token);
        current.components.push({
          value: token.value,
          fractional: token.fractional,
          unit: unit as Unit,
          marked: false,
          start: token.start,
          end: token.end,
        });
        break;
      }
      case 'mark': {
        const last = current.components.at(-1);
        if (!last || last.marked || previous !== 'number') return null;
        const before = current.components.at(-2);
        if (before && token.unit <= before.unit) {
          // The number starts the next value ("41°00′ 28°58′"): move it to a new group.
          current.components.pop();
          current.end = before.end;
          close();
          current.start = last.start;
          current.components.push(last);
        }
        last.unit = token.unit;
        last.marked = true;
        last.end = token.end;
        add(token);
        break;
      }
    }
    previous = token.kind;
  }
  if (!isEmpty(current)) {
    if (current.components.length === 0) return null;
    groups.push(current);
  }
  return groups;
}

type Evaluated = { ok: true; value: number; axis: Axis | null } | { ok: false; code: ParseErrorCode };

function evaluate(group: Group): Evaluated {
  const { components } = group;
  if (components.slice(0, -1).some((component) => component.fractional)) return { ok: false, code: 'fraction' };
  for (const component of components) {
    if (component.unit > 0 && component.value >= 60) {
      return { ok: false, code: component.unit === 1 ? 'minutes-range' : 'seconds-range' };
    }
  }
  if (group.negative === true && group.hemisphere !== null) return { ok: false, code: 'sign-and-hemisphere' };
  const magnitude = components.reduce((sum, component) => sum + component.value / 60 ** component.unit, 0);
  const negative = group.negative === true || group.hemisphere === 'S' || group.hemisphere === 'W';
  const axis = group.hemisphere === null ? null : group.hemisphere === 'N' || group.hemisphere === 'S' ? 'lat' : 'lon';
  // + 0 turns −0 into 0.
  return { ok: true, value: (negative ? -magnitude : magnitude) + 0, axis };
}

function rangeError(value: number, axis: Axis): ParseErrorCode | null {
  if (Math.abs(value) <= AXIS_LIMIT[axis]) return null;
  return axis === 'lat' ? 'lat-range' : 'lon-range';
}

function prepare(text: string): string {
  return text.replace(MINUS_SIGNS, '-');
}

// ------------------------------------------------------------------ public API

/** Parses one latitude or longitude (degrees, south and west negative). */
export function parseCoordinate(text: string, axis: Axis): ParseResult<number> {
  const source = prepare(text);
  if (source.trim() === '') return { ok: false, code: 'empty' };
  // Without a decimal point, "41,0082" is a Turkish decimal number, not two values.
  const tokens = tokenize(source, !source.includes('.'));
  const groups = tokens && collect(tokens, 'single');
  if (!groups) return { ok: false, code: 'syntax' };
  const [group] = groups;
  if (!group) return { ok: false, code: 'empty' };
  if (groups.length > 1) return { ok: false, code: 'multiple' };
  const result = evaluate(group);
  if (!result.ok) return result;
  if (result.axis !== null && result.axis !== axis) return { ok: false, code: 'wrong-axis' };
  const range = rangeError(result.value, axis);
  return range ? { ok: false, code: range } : { ok: true, value: result.value };
}

function parsePairWith(source: string, original: string, decimalComma: boolean): ParseResult<ParsedPair> {
  const tokens = tokenize(source, decimalComma);
  const groups = tokens && collect(tokens, 'pair');
  if (!groups) return { ok: false, code: 'syntax' };
  if (groups.length === 0) return { ok: false, code: 'empty' };
  if (groups.length === 1) return { ok: false, code: 'one-value' };
  if (groups.length > 2) return { ok: false, code: 'too-many' };
  const [first, second] = groups as [Group, Group];
  const one = evaluate(first);
  if (!one.ok) return one;
  const two = evaluate(second);
  if (!two.ok) return two;
  if (one.axis !== null && one.axis === two.axis) return { ok: false, code: 'same-axis' };
  const swapped = one.axis === 'lon' || two.axis === 'lat';
  const [lat, latGroup, lon, lonGroup] = swapped ? [two, second, one, first] : [one, first, two, second];
  const range = rangeError(lat.value, 'lat') ?? rangeError(lon.value, 'lon');
  if (range) return { ok: false, code: range };
  return {
    ok: true,
    value: {
      lat: lat.value,
      lon: lon.value,
      latText: original.slice(latGroup.start, latGroup.end).trim(),
      lonText: original.slice(lonGroup.start, lonGroup.end).trim(),
    },
  };
}

/** Parses "latitude, longitude" (or the other way round when hemisphere letters say so). */
export function parsePair(text: string): ParseResult<ParsedPair> {
  const source = prepare(text);
  if (source.trim() === '') return { ok: false, code: 'empty' };
  // "41,0082 28,9784" has decimal commas, "41,29" is a pair: try decimal commas first when the
  // text has no decimal point, then commas as separators, and keep the first reading that works.
  const readings = !source.includes('.') && /\d,\d/.test(source) ? [true, false] : [false];
  let firstError: ParseResult<ParsedPair> | null = null;
  for (const decimalComma of readings) {
    const result = parsePairWith(source, text, decimalComma);
    if (result.ok) return result;
    firstError ??= result;
  }
  return firstError ?? { ok: false, code: 'syntax' };
}
