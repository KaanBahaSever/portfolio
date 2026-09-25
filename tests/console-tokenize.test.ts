import assert from 'node:assert/strict';
import { test } from 'node:test';

import { quoteWord, scan, tokenize } from '../src/lib/console/tokenize.ts';

const words = (line: string) => {
  const result = tokenize(line);
  assert.ok(result.ok, `expected "${line}" to tokenize`);
  return result.words;
};

test('splits on runs of whitespace and ignores leading and trailing space', () => {
  assert.deepEqual(words('ls projects'), ['ls', 'projects']);
  assert.deepEqual(words('   cat    about.txt\tcontact.txt  '), ['cat', 'about.txt', 'contact.txt']);
  assert.deepEqual(words(''), []);
  assert.deepEqual(words('    '), []);
});

test('double and single quotes keep spaces inside one word', () => {
  assert.deepEqual(words('echo "a  b" \'c d\''), ['echo', 'a  b', 'c d']);
  // Quoted parts join the unquoted text around them.
  assert.deepEqual(words('echo pre"fix"ed'), ['echo', 'prefixed']);
  assert.deepEqual(words(`echo 'it'"'"'s'`), ['echo', "it's"]);
});

test('an empty quoted word still counts as a word', () => {
  assert.deepEqual(words('echo ""'), ['echo', '']);
  assert.deepEqual(words("echo '' x"), ['echo', '', 'x']);
});

test('backslashes escape outside quotes, and only " and \\ inside double quotes', () => {
  assert.deepEqual(words('echo a\\ b'), ['echo', 'a b']);
  assert.deepEqual(words('echo "say \\"hi\\""'), ['echo', 'say "hi"']);
  assert.deepEqual(words('echo "C:\\\\dir"'), ['echo', 'C:\\dir']);
  assert.deepEqual(words('echo "keep \\n"'), ['echo', 'keep \\n']);
  // Single quotes are literal.
  assert.deepEqual(words("echo 'a\\b'"), ['echo', 'a\\b']);
  // A trailing lone backslash is kept.
  assert.deepEqual(words('echo a\\'), ['echo', 'a\\']);
});

test('an unterminated quote is reported with the quote character', () => {
  assert.deepEqual(tokenize('echo "abc'), { ok: false, code: 'unterminated-quote', quote: '"' });
  assert.deepEqual(tokenize("cat 'about"), { ok: false, code: 'unterminated-quote', quote: "'" });
});

test('scan reports token offsets and whether a new word has begun', () => {
  const result = scan('cat "pro');
  assert.equal(result.openQuote, '"');
  assert.equal(result.trailingSpace, false);
  assert.deepEqual(result.tokens, [
    { value: 'cat', start: 0, end: 3 },
    { value: 'pro', start: 4, end: 8 },
  ]);
  assert.equal(scan('ls ').trailingSpace, true);
  assert.equal(scan('ls').trailingSpace, false);
  assert.equal(scan('').trailingSpace, true);
  // Whitespace inside an open quote is part of the word.
  assert.equal(scan('echo "a ').trailingSpace, false);
});

test('quoteWord round-trips through tokenize', () => {
  for (const word of ['about.txt', 'projects/', '~/skills/', 'a b', "it's", '', 'x"y', '$HOME']) {
    assert.deepEqual(words(`echo ${quoteWord(word)}`), ['echo', word], word);
  }
  assert.equal(quoteWord('projects/asion.txt'), 'projects/asion.txt');
});
