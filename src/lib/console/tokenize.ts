/**
 * Splits a command line into words, the way a POSIX shell does for the cases a visitor meets:
 *
 *   ls projects            → ['ls', 'projects']
 *   echo "a  b" 'c d'      → ['echo', 'a  b', 'c d']
 *   echo a\ b              → ['echo', 'a b']
 *   echo pre"fix"ed        → ['echo', 'prefixed']   (quoted parts join the word around them)
 *   echo ""                → ['echo', '']           (an empty quoted word still counts)
 *
 * Single quotes are literal. Inside double quotes a backslash escapes only `"` and `\`.
 * There is no variable expansion, globbing or piping.
 *
 * Pure module: no DOM, erasable TypeScript only.
 */

export type Quote = '"' | "'";

export interface Token {
  /** The word after quote removal. */
  value: string;
  /** Offset of the word's first character (including an opening quote) in the line. */
  start: number;
  /** Offset just past the word's last character. */
  end: number;
}

export interface Scan {
  tokens: Token[];
  /** The quote left open at the end of the line, if any. */
  openQuote: Quote | null;
  /**
   * True when the line ends with unquoted whitespace (or is empty): the next word has not
   * started yet. Completion uses it to decide between finishing the last word and starting a new one.
   */
  trailingSpace: boolean;
}

export type TokenizeResult = { ok: true; words: string[] } | { ok: false; code: 'unterminated-quote'; quote: Quote };

const isSpace = (char: string) => char === ' ' || char === '\t' || char === '\n' || char === '\r';

/** Tolerant scanner: never fails, reports an unterminated quote instead (for completion). */
export function scan(line: string): Scan {
  const tokens: Token[] = [];
  let value = '';
  let start = -1;
  let quote: Quote | null = null;

  const flush = (end: number) => {
    if (start !== -1) tokens.push({ value, start, end });
    value = '';
    start = -1;
  };

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;

    if (quote === "'") {
      if (char === "'") quote = null;
      else value += char;
      continue;
    }

    if (quote === '"') {
      if (char === '"') {
        quote = null;
      } else if (char === '\\' && (line[i + 1] === '"' || line[i + 1] === '\\')) {
        value += line[i + 1];
        i++;
      } else {
        value += char;
      }
      continue;
    }

    if (isSpace(char)) {
      flush(i);
      continue;
    }

    if (start === -1) start = i;
    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '\\' && i + 1 < line.length) {
      value += line[i + 1];
      i++;
    } else {
      value += char;
    }
  }

  const trailingSpace = quote === null && (line.length === 0 || isSpace(line[line.length - 1]!));
  const openQuote = quote;
  flush(line.length);
  return { tokens, openQuote, trailingSpace };
}

export function tokenize(line: string): TokenizeResult {
  const result = scan(line);
  if (result.openQuote) return { ok: false, code: 'unterminated-quote', quote: result.openQuote };
  return { ok: true, words: result.tokens.map((token) => token.value) };
}

/** Writes a word back so that tokenize() reads it unchanged (used when completing names). */
export function quoteWord(word: string): string {
  if (word !== '' && /^[\w@%+=:,./~-]+$/u.test(word)) return word;
  return `'${word.replace(/'/g, `'\\''`)}'`;
}
