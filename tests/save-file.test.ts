import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mimeTypeForFilename, sanitizeFilename } from '../src/lib/files/save-file.ts';

test('sanitizeFilename keeps names with any extension', () => {
  assert.equal(sanitizeFilename('notes.txt'), 'notes.txt');
  assert.equal(sanitizeFilename('script.md'), 'script.md');
  assert.equal(sanitizeFilename('data.json'), 'data.json');
  assert.equal(sanitizeFilename('archive.tar.gz'), 'archive.tar.gz');
  assert.equal(sanitizeFilename('Makefile.am'), 'Makefile.am');
  assert.equal(sanitizeFilename('README.MD'), 'README.MD');
  assert.equal(sanitizeFilename('config.yaml'), 'config.yaml');
  assert.equal(sanitizeFilename('main.c++'), 'main.c++');
  assert.equal(sanitizeFilename('Notlarım – Eylül.txt'), 'Notlarım – Eylül.txt');
  assert.equal(sanitizeFilename('rapor.metin'), 'rapor.metin');
});

test('sanitizeFilename appends .txt when there is no extension', () => {
  assert.equal(sanitizeFilename('notes'), 'notes.txt');
  assert.equal(sanitizeFilename('My notes'), 'My notes.txt');
  assert.equal(sanitizeFilename('Version 2.5'), 'Version 2.5.txt');
  assert.equal(sanitizeFilename('Mr. Smith'), 'Mr. Smith.txt');
  assert.equal(sanitizeFilename('Meeting 16.09.2026'), 'Meeting 16.09.2026.txt');
  assert.equal(sanitizeFilename('name.'), 'name.txt');
  assert.equal(sanitizeFilename('.env'), 'env.txt');
});

test('sanitizeFilename trims, strips unsafe characters and collapses whitespace', () => {
  assert.equal(sanitizeFilename('  notes.txt  '), 'notes.txt');
  assert.equal(sanitizeFilename(' a/b\\c:d*e?f"g<h>i|j.txt '), 'abcdefghij.txt');
  assert.equal(sanitizeFilename('a\u0000b\u001fc\u007fd\u0085e.md'), 'abcde.md');
  assert.equal(sanitizeFilename('line1\nline2\tend.txt'), 'line1 line2 end.txt');
  assert.equal(sanitizeFilename('many     spaces.txt'), 'many spaces.txt');
  assert.equal(sanitizeFilename('...hidden.txt'), 'hidden.txt');
  assert.equal(sanitizeFilename('trailing dots...'), 'trailing dots.txt');
  assert.equal(sanitizeFilename('notes.txt. . '), 'notes.txt');
  assert.equal(sanitizeFilename('dir/sub/file.json'), 'dirsubfile.json');
});

test('sanitizeFilename falls back when nothing usable remains', () => {
  assert.equal(sanitizeFilename(''), 'untitled.txt');
  assert.equal(sanitizeFilename('   '), 'untitled.txt');
  assert.equal(sanitizeFilename('...'), 'untitled.txt');
  assert.equal(sanitizeFilename('///'), 'untitled.txt');
  assert.equal(sanitizeFilename('<>:"|?*'), 'untitled.txt');
  assert.equal(sanitizeFilename('', 'draft.md'), 'draft.md');
  assert.equal(sanitizeFilename(undefined as unknown as string), 'untitled.txt');
});

test('sanitizeFilename prefixes Windows reserved device names', () => {
  assert.equal(sanitizeFilename('CON'), '_CON.txt');
  assert.equal(sanitizeFilename('con.txt'), '_con.txt');
  assert.equal(sanitizeFilename('Prn.md'), '_Prn.md');
  assert.equal(sanitizeFilename('aux'), '_aux.txt');
  assert.equal(sanitizeFilename('NUL.tar.gz'), '_NUL.tar.gz');
  assert.equal(sanitizeFilename('com1.json'), '_com1.json');
  assert.equal(sanitizeFilename('LPT9'), '_LPT9.txt');
  assert.equal(sanitizeFilename('con .txt'), '_con .txt');
  // Similar names are fine.
  assert.equal(sanitizeFilename('console.txt'), 'console.txt');
  assert.equal(sanitizeFilename('icon.txt'), 'icon.txt');
  assert.equal(sanitizeFilename('COM10.txt'), 'COM10.txt');
  assert.equal(sanitizeFilename('nul-notes'), 'nul-notes.txt');
});

test('sanitizeFilename caps the length at 150 characters and keeps the extension', () => {
  const long = 'x'.repeat(200);
  assert.equal(sanitizeFilename(`${long}.json`), `${'x'.repeat(145)}.json`);
  assert.equal(sanitizeFilename(long), `${'x'.repeat(146)}.txt`);
  assert.equal(sanitizeFilename(`${'x'.repeat(146)}.txt`), `${'x'.repeat(146)}.txt`);

  const emoji = sanitizeFilename(`${'📄'.repeat(200)}.md`);
  assert.equal(Array.from(emoji).length, 150);
  assert.ok(emoji.endsWith('.md'));
  assert.ok(!/[\ud800-\udbff]\.md$/.test(emoji), 'no lone surrogate before the extension');

  // Trailing spaces or dots left by the cut are removed.
  const spaced = sanitizeFilename(`${'a'.repeat(145)} ${'b'.repeat(20)}.txt`);
  assert.equal(spaced, `${'a'.repeat(145)}.txt`);
});

test('mimeTypeForFilename', () => {
  const cases: Array<[string, string]> = [
    ['notes.txt', 'text/plain'],
    ['untitled', 'text/plain'],
    ['script.py', 'text/plain'],
    ['README.md', 'text/markdown'],
    ['post.markdown', 'text/markdown'],
    ['data.JSON', 'application/json'],
    ['table.csv', 'text/csv'],
    ['page.html', 'text/html'],
    ['page.htm', 'text/html'],
    ['style.css', 'text/css'],
    ['app.js', 'text/javascript'],
    ['app.mjs', 'text/javascript'],
    ['app.cjs', 'text/javascript'],
    ['app.ts', 'text/plain'],
    ['view.tsx', 'text/plain'],
    ['feed.xml', 'application/xml'],
    ['logo.svg', 'image/svg+xml'],
    ['config.yml', 'text/yaml'],
    ['config.yaml', 'text/yaml'],
    ['archive.tar.gz', 'text/plain'],
    ['constructor', 'text/plain'],
    ['x.toString', 'text/plain'],
  ];
  for (const [name, type] of cases) {
    assert.equal(mimeTypeForFilename(name), `${type}; charset=utf-8`, name);
  }
});
