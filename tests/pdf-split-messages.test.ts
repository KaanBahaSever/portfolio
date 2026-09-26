import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pdfSplitMessages } from '../src/i18n/tools/pdf-split.ts';
import { planOutputs, summarizePlan } from '../src/lib/pdf/page-ranges.ts';
import type { PlanError, PlannedOutput } from '../src/lib/pdf/page-ranges.ts';

const { en, tr } = pdfSplitMessages;

function keys(value: unknown, prefix = ''): string[] {
  return value && typeof value === 'object'
    ? Object.entries(value).flatMap(([key, child]) => keys(child, `${prefix}${key}.`))
    : [prefix];
}

function strings(value: unknown, prefix = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[prefix, value]];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => strings(child, `${prefix}${prefix ? '.' : ''}${key}`));
  }
  return [];
}

function outputs(...args: Parameters<typeof planOutputs>): PlannedOutput[] {
  const result = planOutputs(...args);
  assert.ok(result.ok);
  return result.outputs;
}

const ALL_ERRORS: PlanError[] = [
  { code: 'no-pages' },
  { code: 'empty' },
  { code: 'page-zero' },
  { code: 'page-out-of-range', page: '12', pageCount: 10 },
  { code: 'unexpected', text: 'x', position: 5 },
  { code: 'missing-page', dash: '-', position: 1 },
  { code: 'invalid-every' },
  { code: 'invalid-mode' },
  { code: 'too-many-pages', total: 25_000, limit: 20_000 },
];

test('both locales define the same message keys', () => {
  assert.deepEqual(keys(tr).sort(), keys(en).sort());
});

test('Turkish text is translated, not copied', () => {
  // Strings that are the same in both languages on purpose.
  const same = new Set(['outputNames.pages']);
  const english = new Map(strings(en));
  for (const [key, value] of strings(tr)) {
    if (same.has(key)) continue;
    assert.notEqual(value, english.get(key), `tr.${key} is still English`);
  }
});

test('English copy follows the voice rules', () => {
  const banned = /\b(passionate|rockstar|ninja|cutting-edge|revolutionary|seamless(ly)?|leverage|unlock|empower|delve|game-changer)\b/i;
  const samples = [
    ...strings(en).map(([, value]) => value),
    ...ALL_ERRORS.map((error) => en.rangeError(error)),
    en.errors.zip('too-many-entries', 70_000, 65_534),
    en.status.largeFile('120.0 MB'),
  ];
  for (const text of samples) {
    assert.doesNotMatch(text, banned, text);
    assert.doesNotMatch(text, /!/, text);
  }
});

test('page-selection errors in English', () => {
  const t = en.rangeError;
  assert.equal(t({ code: 'empty' }), 'Select at least one page, or type pages such as 1-3, 5');
  assert.equal(t({ code: 'page-out-of-range', page: '12', pageCount: 10 }), 'Page 12 doesn’t exist — this PDF has 10 pages');
  assert.equal(t({ code: 'page-out-of-range', page: '2', pageCount: 1 }), 'Page 2 doesn’t exist — this PDF has 1 page');
  assert.equal(t({ code: 'page-zero' }), 'Page numbers start at 1');
  assert.equal(t({ code: 'unexpected', text: 'x', position: 5 }), 'Unexpected “x” near position 5');
  assert.equal(t({ code: 'missing-page', dash: '-', position: 1 }), 'Add a page number before or after “-” near position 1');
  assert.equal(t({ code: 'invalid-every' }), 'Enter a whole number of pages (1 or more)');
  assert.equal(
    t({ code: 'too-many-pages', total: 25_000, limit: 20_000 }),
    'That adds up to 25,000 pages — the limit is 20,000 at a time',
  );
});

test('page-selection errors in Turkish keep values free of suffixes', () => {
  const t = tr.rangeError;
  assert.equal(t({ code: 'page-out-of-range', page: '12', pageCount: 10 }), 'Sayfa 12 yok: bu PDF’de 10 sayfa var');
  assert.equal(t({ code: 'unexpected', text: 'x', position: 5 }), 'Anlaşılamayan ifade: “x” (5. karakter)');
  assert.equal(
    t({ code: 'too-many-pages', total: 25_000, limit: 20_000 }),
    'Toplam sayfa sayısı 25.000; tek seferde en fazla 20.000 sayfa oluşturulabilir',
  );
  for (const error of ALL_ERRORS) assert.ok(t(error).length > 0, error.code);
});

test('plan summaries in both languages', () => {
  const every = summarizePlan(outputs('every', '4', 10, 'r'))!;
  assert.equal(en.plan.summary(every), 'Will create 3 files: pages 1–4, 5–8, 9–10');
  assert.equal(tr.plan.summary(every), '3 dosya oluşturulacak. Sayfalar: 1–4, 5–8, 9–10');

  const extract = summarizePlan(outputs('extract', '1-3, 5, 8-', 10, 'r'))!;
  assert.equal(en.plan.summary(extract), 'Will create 1 file with 7 pages: 1–3, 5, 8–10');
  assert.equal(tr.plan.summary(extract), '7 sayfalık 1 dosya oluşturulacak: 1–3, 5, 8–10');

  const one = summarizePlan(outputs('extract', '5', 10, 'r'))!;
  assert.equal(en.plan.summary(one), 'Will create 1 file: page 5');
  assert.equal(tr.plan.summary(one), '1 dosya oluşturulacak: 5. sayfa');

  const single = summarizePlan(outputs('single', '', 10, 'r'))!;
  assert.equal(en.plan.summary(single), 'Will create 10 files: pages 1, 2, 3, 4, 5, 6 and 4 more');
  assert.equal(tr.plan.summary(single), '10 dosya oluşturulacak. Sayfalar: 1, 2, 3, 4, 5, 6 ve 4 dosya daha');

  const long = summarizePlan(outputs('extract', '1,3,5,7,9,2,4,6', 10, 'r'))!;
  assert.equal(en.plan.summary(long), 'Will create 1 file with 8 pages: 1, 3, 5, 7, 9, 2 and 2 more');
  assert.equal(tr.plan.summary(long), '8 sayfalık 1 dosya oluşturulacak: 1, 3, 5, 7, 9, 2 ve 2 aralık daha');
});

test('grid counts and tile names use each language’s number format', () => {
  assert.equal(en.grid.countSome(4, 12), '4 of 12 pages selected');
  assert.equal(tr.grid.countSome(4, 12), '4 sayfa seçildi (toplam 12)');
  assert.equal(en.grid.countSome(1234, 2000), '1,234 of 2,000 pages selected');
  assert.equal(tr.grid.countSome(1234, 2000), '1.234 sayfa seçildi (toplam 2.000)');
  // Announced through a live region: no slash, which Turkish speech output reads as "bölü".
  assert.doesNotMatch(tr.grid.countSome(4, 12), /\//);
  assert.equal(en.grid.countAll(12), 'All 12 pages selected');
  assert.equal(en.grid.countFiles(7, 3), '7 pages in 3 files');
  assert.equal(en.grid.countFiles(1, 1), '1 page in 1 file');
  assert.equal(tr.grid.countFiles(7, 3), '3 dosyada 7 sayfa');

  assert.equal(en.grid.tile(3, 0, 1), 'Page 3');
  assert.equal(en.grid.tile(3, 2, 1), 'Page 3, file 2');
  assert.equal(en.grid.tile(3, 0, 2), 'Page 3, used 2 times');
  assert.equal(tr.grid.tile(3, 2, 1), 'Sayfa 3, dosya 2');
  assert.equal(tr.grid.tile(3, 0, 2), 'Sayfa 3, 2 kez kullanılıyor');
  assert.equal(tr.grid.tile(3, 1, 2), 'Sayfa 3, dosya 1, 2 kez kullanılıyor');
});

test('results, progress and errors', () => {
  assert.equal(en.result.pdf(4, '120.0 KB'), 'Your PDF is ready: 4 pages · 120.0 KB');
  assert.equal(tr.result.pdf(4, '120,0 KB'), 'PDF’niz hazır: 4 sayfa · 120,0 KB');
  assert.equal(en.progress.creatingMany(2, 5), 'Creating file 2 of 5…');
  assert.equal(tr.progress.creatingMany(2, 5), 'Dosya oluşturuluyor: 2 / 5…');
  assert.equal(en.errors.notPdf('a.docx'), '“a.docx” isn’t a PDF. Choose a PDF file.');
  assert.equal(tr.errors.notPdf('a.docx'), '“a.docx” bir PDF değil. Bir PDF dosyası seçin.');
  assert.equal(
    en.errors.zip('too-many-entries', 70_000, 65_534),
    'Too many files for one ZIP (70,000; the limit is 65,534). Create fewer files at once.',
  );
  assert.match(tr.errors.zip('too-large', 5e9, 4e9), /4 GB/);
  assert.equal(en.name.savesZip('r-split.zip', 1), 'Saves as r-split.zip, with 1 PDF inside');
  assert.equal(tr.name.savesZip('r-bölünmüş.zip', 3), 'Kaydedilecek dosya: r-bölünmüş.zip (içinde 3 PDF)');
});
