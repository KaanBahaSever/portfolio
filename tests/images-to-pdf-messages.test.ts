import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imagesToPdfMessages } from '../src/i18n/tools/images-to-pdf.ts';
import { toPdfFilename } from '../src/lib/files/filename.ts';
import { MARGINS_MM } from '../src/lib/pdf/page-layout.ts';

const { en, tr } = imagesToPdfMessages;

function strings(value: unknown, prefix = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[prefix, value]];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => strings(child, `${prefix}${prefix ? '.' : ''}${key}`));
  }
  return [];
}

test('Turkish text is translated, not copied', () => {
  // Strings that are the same in both languages on purpose: format names and the A4 size.
  const same = new Set(['dropzone.formats', 'options.pageSizes.a4']);
  const english = new Map(strings(en));
  for (const [key, value] of strings(tr)) {
    if (same.has(key)) continue;
    assert.notEqual(value, english.get(key), `tr.${key} is still English`);
  }
  assert.notEqual(tr.grid.moveEarlier(2, 'a.jpg'), en.grid.moveEarlier(2, 'a.jpg'));
  assert.notEqual(tr.announce.addedSkipped(2, 1, 'x'), en.announce.addedSkipped(2, 1, 'x'));
});

test('the default file names survive the file-name cleaning unchanged', () => {
  for (const messages of [en, tr]) {
    const name = messages.names.fallbackFilename;
    assert.match(name, /\.pdf$/);
    assert.equal(toPdfFilename(name, name), name);
    // An empty or unusable name falls back to the page's language.
    assert.equal(toPdfFilename(' ... ', name), name);
  }
  assert.equal(tr.names.fallbackFilename, 'görseller.pdf');
});

test('counts are formatted per locale, and Turkish keeps the noun singular', () => {
  assert.equal(en.toolbar.count(1), '1 image');
  assert.equal(en.toolbar.count(1234), '1,234 images');
  assert.equal(tr.toolbar.count(1234), '1.234 görsel');
  assert.equal(en.result.ready(1, '2.0 MB'), 'Your PDF is ready: 1 page · 2.0 MB');
  assert.equal(tr.result.ready(3, '2,0 MB'), 'PDF’niz hazır: 3 sayfa · 2,0 MB');
});

test('margin labels show the widths the layout uses', () => {
  assert.equal(en.options.margins.small(`${MARGINS_MM.small} mm`), 'Small (10 mm)');
  assert.equal(tr.options.margins.large(`${MARGINS_MM.large} mm`), 'Büyük (20 mm)');
  assert.equal(tr.options.margins.none(''), 'Yok');
});

test('English copy follows the voice rules', () => {
  const banned = /\b(passionate|rockstar|ninja|cutting-edge|revolutionary|seamless(ly)?|leverage|unlock|empower|delve|game-changer)\b/i;
  for (const [key, value] of strings(en)) {
    assert.doesNotMatch(value, banned, key);
    assert.doesNotMatch(value, /!/, key);
  }
});
