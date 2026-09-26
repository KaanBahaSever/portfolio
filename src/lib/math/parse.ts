/**
 * Reads an integer typed or pasted by a person (pure; returns codes, never prose).
 *
 * Accepted: an optional sign (+, - or −) followed by digits, which may be grouped with spaces
 * (including no-break and thin spaces), underscores, or the thousands separator of the page's
 * language (',' in English, '.' in Turkish). The other mark (the decimal separator) is also
 * read as a thousands separator when it cannot be a decimal point, i.e. when it appears more
 * than once in valid groups of three: "1.000.000" is a million on the English page as well.
 *
 * Rejected, with a code the page turns into words: anything with a fractional part, letters
 * and other symbols, misplaced separators, and more than `maxDigits` significant digits.
 */

export type ParseErrorCode =
  | 'empty'
  | 'invalid-char'
  | 'decimal'
  | 'grouping'
  | 'sign'
  | 'no-digits'
  | 'too-long';

export type ParseError =
  | { code: 'empty' | 'decimal' | 'grouping' | 'sign' | 'no-digits' }
  | { code: 'invalid-char'; char: string }
  | { code: 'too-long'; digits: number; max: number };

export type ParseResult =
  | { ok: true; value: bigint; /** Significant digits of |value| (1 for 0). */ digits: number }
  | { ok: false; error: ParseError };

export interface ParseOptions {
  /** The page language's thousands separator. */
  groupSeparator: ',' | '.';
  /** Most significant digits accepted (leading zeros do not count). */
  maxDigits: number;
}

const SIGNS = new Set(['+', '-', '−']);
const NEGATIVE = new Set(['-', '−']);
/** Space-like characters people and number formatters put between digit groups. */
const SPACES = /[\s    ]/u;
const DIGIT = /[0-9]/;

function fail(error: ParseError): ParseResult {
  return { ok: false, error };
}

/** "1,234,567" style: a first group of 1–3 digits, then groups of exactly 3. */
function isThousandsGrouping(groups: readonly string[]): boolean {
  const [first, ...rest] = groups;
  return first !== undefined && first.length >= 1 && first.length <= 3 && rest.every((g) => g.length === 3);
}

export function parseInteger(input: string, options: ParseOptions): ParseResult {
  const text = input.replace(/^[\s    ]+|[\s    ]+$/gu, '');
  if (text === '') return fail({ code: 'empty' });

  // Sign, optionally followed by spaces ("- 42").
  const chars = [...text];
  let index = 0;
  let negative = false;
  if (SIGNS.has(chars[0] as string)) {
    negative = NEGATIVE.has(chars[0] as string);
    index = 1;
    while (index < chars.length && SPACES.test(chars[index] as string)) index++;
  }
  const body = chars.slice(index);
  if (body.length === 0) return fail({ code: 'no-digits' });

  // Unknown characters first: they explain the problem best ("^" in "2^64").
  for (const char of body) {
    if (DIGIT.test(char) || SPACES.test(char) || char === '_' || char === ',' || char === '.') continue;
    return fail(SIGNS.has(char) ? { code: 'sign' } : { code: 'invalid-char', char });
  }

  // A separator before the first digit or after the last one: the language's decimal mark
  // reads as a decimal part (".5", "12." in English), anything else as a stray separator.
  const decimalMark = options.groupSeparator === ',' ? '.' : ',';
  const strayCode = (run: string): 'decimal' | 'grouping' => (run.includes(decimalMark) ? 'decimal' : 'grouping');

  // Split into digit groups and the separator runs between them.
  const groups: string[] = [];
  const separators: string[] = [];
  let current = '';
  let separator = '';
  for (const char of body) {
    if (DIGIT.test(char)) {
      if (current === '' && groups.length === 0 && separator !== '') return fail({ code: strayCode(separator) });
      if (separator !== '') {
        separators.push(separator);
        separator = '';
      }
      current += char;
    } else {
      if (current !== '') {
        groups.push(current);
        current = '';
      }
      separator += char;
    }
  }
  if (current !== '') groups.push(current);
  if (groups.length === 0) return fail({ code: 'no-digits' });
  if (separator !== '') return fail({ code: strayCode(separator) });

  // Each separator run is spaces only, or exactly one '_', ',' or '.'.
  const kinds = separators.map((run) => {
    if ([...run].every((c) => SPACES.test(c))) return 'space';
    return run.length === 1 ? run : 'invalid';
  });
  if (kinds.includes('invalid')) return fail({ code: 'grouping' });

  const hasComma = kinds.includes(',');
  const hasPoint = kinds.includes('.');
  if (hasComma && hasPoint) return fail({ code: 'decimal' }); // "1,234.5" / "1.234,5"
  if (hasComma || hasPoint) {
    const mark = hasComma ? ',' : '.';
    const count = kinds.filter((k) => k === mark).length;
    // Mixed with other separators ("1 000,000"): not a pattern anyone writes on purpose.
    if (kinds.some((k) => k !== mark)) return fail({ code: 'grouping' });
    // A single decimal mark of this language is a decimal point: "3.5" (en), "3,5" (tr).
    if (mark !== options.groupSeparator && count === 1) return fail({ code: 'decimal' });
    if (!isThousandsGrouping(groups)) {
      return fail({ code: mark !== options.groupSeparator ? 'decimal' : 'grouping' });
    }
  }

  const digits = groups.join('').replace(/^0+(?=\d)/, '');
  if (digits.length > options.maxDigits) {
    return fail({ code: 'too-long', digits: digits.length, max: options.maxDigits });
  }
  const magnitude = BigInt(digits);
  return { ok: true, value: negative ? -magnitude : magnitude, digits: digits.length };
}

/**
 * Whether a parse error may just mean "not finished typing": some ending (more digits, then
 * perhaps one more group of three with the language's thousands separator) turns the text into
 * a valid number, as with "-", "1," or "1,00" on the way to "1,000". Pages hold such errors
 * back until the person submits or leaves the field, so typing a grouped number never flashes
 * an error at every separator. A decimal mark ("3.5" in English) is reported at once.
 */
export function mayBeIncomplete(input: string, options: ParseOptions): boolean {
  const result = parseInteger(input, options);
  if (result.ok) return false;
  const { code } = result.error;
  if (code !== 'decimal' && code !== 'grouping' && code !== 'no-digits') return false;
  const trimmed = input.replace(/[\s    ]+$/u, '');
  const completions = ['', '0', '00', '000'].flatMap((digits) => [digits, `${digits}${options.groupSeparator}000`]);
  return completions.some((suffix) => suffix !== '' && parseInteger(trimmed + suffix, options).ok);
}
