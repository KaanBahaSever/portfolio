/**
 * Why a regular expression didn't compile, as a code the interface can explain in its own
 * language. Pure: no DOM.
 *
 * JavaScript engines explain a bad pattern in English only, each in its own words: V8 (Chrome,
 * Edge, Node) says "Unterminated group", SpiderMonkey (Firefox) "unterminated parenthetical",
 * JavaScriptCore (Safari) "missing )". The common mistakes are recognised in all three; anything
 * else is 'unknown', and the caller falls back to a general message.
 */

export type RegexErrorCode =
  | 'unterminatedGroup'
  | 'unmatchedParen'
  | 'nothingToRepeat'
  | 'loneBracket'
  | 'incompleteQuantifier'
  | 'quantifierOrder'
  | 'unterminatedClass'
  | 'classRange'
  | 'trailingBackslash'
  | 'invalidEscape'
  | 'duplicateGroupName'
  | 'groupName'
  | 'invalidGroup'
  | 'propertyName'
  | 'unknown';

/**
 * The engine's explanation without its prefix: "Invalid regular expression: /a(b/gu: " (V8) or
 * "Invalid regular expression: " (Safari).
 */
export function regexErrorDetail(message: string): string {
  const detail = message
    .replace(/^(?:SyntaxError:\s*)?Invalid regular expression:\s*/i, '')
    .replace(/^\/.*\/[a-z]*:\s*/s, '');
  return detail || message;
}

/**
 * First match wins, so the order matters: "Invalid capture group name" is a naming problem, not
 * the plain "Invalid group", and "\ at end of pattern" is not an invalid escape.
 */
const RULES: ReadonlyArray<[RegexErrorCode, RegExp]> = [
  ['trailingBackslash', /\\ at end of pattern/],
  ['unterminatedGroup', /unterminated group|unterminated parenthetical|missing \)/],
  ['unmatchedParen', /unmatched '?\)|unmatched parenthes/],
  ['nothingToRepeat', /nothing to repeat/],
  ['loneBracket', /lone quantifier bracket|raw (?:bracket|brace)|unmatched bracket/],
  ['incompleteQuantifier', /incomplete (?:\{\} )?quantifier/],
  ['quantifierOrder', /numbers? out of order in \{\} quantifier/],
  ['unterminatedClass', /unterminated character class|missing terminating \] for character class/],
  [
    'classRange',
    /range out of order in character class|invalid range in character class|class escape cannot be used in class range|^invalid character class$/,
  ],
  ['duplicateGroupName', /duplicate (?:capture group|group specifier) name/],
  ['groupName', /capture group name|group specifier name|named (?:capture )?referen/],
  ['propertyName', /property name|property expression/],
  ['invalidGroup', /^invalid (?:regexp )?group$|unrecognized character after \(\?/],
  ['invalidEscape', /escape|back ?reference/],
];

/** Classifies an engine's SyntaxError message for an invalid pattern. */
export function classifyRegexError(message: string): RegexErrorCode {
  const detail = regexErrorDetail(message).trim().toLowerCase();
  for (const [code, pattern] of RULES) {
    if (pattern.test(detail)) return code;
  }
  return 'unknown';
}
