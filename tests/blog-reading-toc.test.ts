import assert from 'node:assert/strict';
import { test } from 'node:test';

import { countWords, readingMinutes, WORDS_PER_MINUTE } from '../src/components/blog/reading-time.ts';
import { buildToc, countEntries, shouldShowToc } from '../src/components/blog/toc.ts';

test('countWords ignores markup, URLs, MDX lines and LaTeX commands', () => {
  assert.equal(countWords('Hello, world. Ay’dan Anıtkabir’e yolculuk.'), 5);
  assert.equal(countWords('import X from "y";\n\nSee [the docs](https://example.com/a-b-c) now.'), 4);
  assert.equal(countWords('![A long alt text here](../img.png)\n\n<figure>\n<figcaption>Two words</figcaption>\n</figure>'), 2);
  assert.equal(countWords('$\\frac{a}{b}$ and \\sqrt{2}'), 4);
  assert.equal(countWords('{/* comment */}\nText'), 1);
});

test('readingMinutes rounds and never drops below one minute', () => {
  assert.equal(readingMinutes(undefined), 1);
  assert.equal(readingMinutes(''), 1);
  assert.equal(readingMinutes('word '.repeat(WORDS_PER_MINUTE * 6)), 6);
  assert.equal(readingMinutes('word '.repeat(WORDS_PER_MINUTE * 2.4)), 2);
});

test('buildToc nests h3 under h2 and drops the footnotes heading', () => {
  const toc = buildToc([
    { depth: 1, slug: 'title', text: 'Title' },
    { depth: 3, slug: 'early', text: 'Early' },
    { depth: 2, slug: 'a', text: 'A' },
    { depth: 3, slug: 'a1', text: 'A1' },
    { depth: 4, slug: 'a1x', text: 'deep' },
    { depth: 2, slug: 'b', text: 'B' },
    { depth: 2, slug: 'footnote-label', text: 'Footnotes' },
  ]);
  assert.deepEqual(toc, [
    { slug: 'early', text: 'Early', children: [] },
    { slug: 'a', text: 'A', children: [{ slug: 'a1', text: 'A1', children: [] }] },
    { slug: 'b', text: 'B', children: [] },
  ]);
  assert.equal(countEntries(toc), 4);
  assert.equal(shouldShowToc(toc, 4), true);
  assert.equal(shouldShowToc(toc, 3), false);
  assert.equal(shouldShowToc(toc.slice(0, 1), 10), false);
});
