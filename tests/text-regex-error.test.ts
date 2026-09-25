import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRegexError, regexErrorDetail } from '../src/lib/text/regex-error.ts';
import type { RegexErrorCode } from '../src/lib/text/regex-error.ts';
import { compileSearch } from '../src/lib/text/search.ts';

const BACKSLASH = String.fromCharCode(92);

/** The error this engine (V8, as in Chrome) reports for `pattern`, compiled the way the notepad does. */
function engineMessage(pattern: string): string {
  const compiled = compileSearch({ query: pattern, matchCase: false, wholeWord: false, regex: true, multiline: true, dotAll: false });
  assert.equal(compiled.status, 'error', pattern);
  return compiled.status === 'error' ? compiled.message : '';
}

test('regexErrorDetail drops the engine prefix and the echoed pattern', () => {
  assert.equal(regexErrorDetail('Invalid regular expression: /a(b/gimu: Unterminated group'), 'Unterminated group');
  assert.equal(regexErrorDetail('SyntaxError: Invalid regular expression: missing )'), 'missing )');
  assert.equal(regexErrorDetail('unterminated parenthetical'), 'unterminated parenthetical');
});

test('the common mistakes are recognised in V8 (Chrome, Edge)', () => {
  const cases: Array<[string, RegexErrorCode]> = [
    ['a(b', 'unterminatedGroup'],
    ['((a)', 'unterminatedGroup'],
    ['a)b', 'unmatchedParen'],
    ['*a', 'nothingToRepeat'],
    ['a**', 'nothingToRepeat'],
    [']', 'loneBracket'],
    ['}', 'loneBracket'],
    ['a{', 'incompleteQuantifier'],
    ['a{2,1}', 'quantifierOrder'],
    ['[a', 'unterminatedClass'],
    ['[z-a]', 'classRange'],
    [`[${BACKSLASH}d-z]`, 'classRange'],
    [BACKSLASH, 'trailingBackslash'],
    [`a${BACKSLASH}q`, 'invalidEscape'],
    [`${BACKSLASH}1(a)${BACKSLASH}2`, 'invalidEscape'],
    [`${BACKSLASH}u{110000}`, 'invalidEscape'],
    ['(?<1a>x)', 'groupName'],
    ['(?<a', 'groupName'],
    [`${BACKSLASH}k<nope>(?<a>b)`, 'groupName'],
    ['(?<a>x)(?<a>y)', 'duplicateGroupName'],
    ['(?x)', 'invalidGroup'],
    ['(?', 'invalidGroup'],
    [`${BACKSLASH}p{Foo}`, 'propertyName'],
  ];
  for (const [pattern, code] of cases) assert.equal(classifyRegexError(engineMessage(pattern)), code, pattern);
});

test('SpiderMonkey (Firefox) messages are recognised', () => {
  const cases: Array<[string, RegexErrorCode]> = [
    ['unterminated parenthetical', 'unterminatedGroup'],
    ['unmatched ) in regular expression', 'unmatchedParen'],
    ['nothing to repeat', 'nothingToRepeat'],
    ['raw bracket is not allowed in regular expression with unicode flag', 'loneBracket'],
    ['raw brace is not allowed in regular expression with unicode flag', 'loneBracket'],
    ['incomplete quantifier in regular expression', 'incompleteQuantifier'],
    ['numbers out of order in {} quantifier.', 'quantifierOrder'],
    ['unterminated character class', 'unterminatedClass'],
    ['invalid range in character class', 'classRange'],
    ['character class escape cannot be used in class range in regular expression', 'classRange'],
    [`${BACKSLASH} at end of pattern`, 'trailingBackslash'],
    ['invalid identity escape in regular expression', 'invalidEscape'],
    ['invalid unicode escape in regular expression', 'invalidEscape'],
    ['back reference out of range in regular expression', 'invalidEscape'],
    ['invalid capture group name in regular expression', 'groupName'],
    ['invalid named capture reference in regular expression', 'groupName'],
    ['duplicate capture group name in regular expression', 'duplicateGroupName'],
    ['invalid regexp group', 'invalidGroup'],
    ['invalid property name in regular expression', 'propertyName'],
    ['invalid property name in character class', 'propertyName'],
  ];
  for (const [message, code] of cases) assert.equal(classifyRegexError(message), code, message);
});

test('JavaScriptCore (Safari) messages are recognised', () => {
  const cases: Array<[string, RegexErrorCode]> = [
    ['missing )', 'unterminatedGroup'],
    ['unmatched parentheses', 'unmatchedParen'],
    ['nothing to repeat', 'nothingToRepeat'],
    ['numbers out of order in {} quantifier', 'quantifierOrder'],
    ['incomplete {} quantifier for Unicode pattern', 'incompleteQuantifier'],
    ['missing terminating ] for character class', 'unterminatedClass'],
    ['range out of order in character class', 'classRange'],
    ['invalid escaped character for Unicode pattern', 'invalidEscape'],
    ['invalid backreference for Unicode pattern', 'invalidEscape'],
    ['invalid group specifier name', 'groupName'],
    ['duplicate group specifier name', 'duplicateGroupName'],
    ['unrecognized character after (?', 'invalidGroup'],
    ['invalid property expression', 'propertyName'],
  ];
  for (const [message, code] of cases) {
    assert.equal(classifyRegexError(`Invalid regular expression: ${message}`), code, message);
  }
});

test('anything else is unknown', () => {
  assert.equal(classifyRegexError('Invalid regular expression: /x/gu: Regular expression too large'), 'unknown');
  assert.equal(classifyRegexError(''), 'unknown');
  assert.equal(classifyRegexError('something new'), 'unknown');
});
