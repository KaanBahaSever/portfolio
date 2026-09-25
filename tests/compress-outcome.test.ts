import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CompressStats } from '../src/lib/pdf/compress/compress-pdf.ts';
import {
  MIN_USEFUL_SAVING,
  compressOutcome,
  displayedSaving,
  imageOutlook,
} from '../src/lib/pdf/compress/outcome.ts';
import { COMPRESSION_LEVELS } from '../src/lib/pdf/compress/plan.ts';
import { pdfCompressMessages } from '../src/i18n/tools/pdf-compress.ts';
import { formatters } from '../src/i18n/format.ts';

function stats(overrides: Partial<CompressStats> = {}): CompressStats {
  return {
    level: 'balanced',
    imagesConsidered: 4,
    imagesReplaced: 3,
    imageBytesBefore: 400_000,
    imageBytesAfter: 150_000,
    objectsRemoved: 0,
    duplicatesMerged: 0,
    streamsDeflated: 0,
    thumbnailsRemoved: 0,
    metadataRemoved: false,
    ...overrides,
  };
}

// ------------------------------------------------------------------ imageOutlook

test('imageOutlook reports the images the chosen level can recompress', () => {
  const counts = { light: 2, balanced: 5, strong: 5 };
  assert.deepEqual(imageOutlook(counts, 'light'), { kind: 'recompressible', level: 'light', count: 2 });
  assert.deepEqual(imageOutlook(counts, 'strong'), { kind: 'recompressible', level: 'strong', count: 5 });
});

test('imageOutlook points Light users to Balanced when only lossless images qualify', () => {
  assert.deepEqual(imageOutlook({ light: 0, balanced: 3, strong: 3 }, 'light'), { kind: 'lossless-only', count: 3 });
  // Only Light gets that hint; the other levels already convert lossless images.
  assert.deepEqual(imageOutlook({ light: 0, balanced: 0, strong: 0 }, 'balanced'), { kind: 'none' });
  assert.deepEqual(imageOutlook({ light: 0, balanced: 0, strong: 0 }, 'light'), { kind: 'none' });
});

// ------------------------------------------------------------------ compressOutcome

test('a result at least 1% smaller is offered and downloaded', () => {
  const outcome = compressOutcome(1000, 400, stats(), 4);
  assert.equal(outcome.kind, 'smaller');
  assert.equal(outcome.change, 'smaller');
  assert.equal(outcome.saving, 0.6);
  assert.equal(outcome.hint, null);
  assert.equal(outcome.offerDownload, true);
  // Exactly MIN_USEFUL_SAVING (1%) is enough.
  assert.equal(MIN_USEFUL_SAVING, 0.01);
  assert.equal(compressOutcome(1000, 990, stats(), 4).kind, 'smaller');
});

test('a saving below 1% counts as nothing to gain', () => {
  const outcome = compressOutcome(1000, 995, stats({ level: 'balanced' }), 4);
  assert.equal(outcome.kind, 'optimized');
  assert.equal(outcome.change, 'smaller');
  assert.equal(outcome.hint, 'stronger-level');
  assert.equal(outcome.offerDownload, false);
});

test('a larger or equal result is never offered unless metadata was removed', () => {
  const larger = compressOutcome(1000, 1010, stats({ level: 'strong' }), 4);
  assert.equal(larger.kind, 'optimized');
  assert.equal(larger.change, 'larger');
  assert.ok(larger.saving < 0);
  // Strong already tried everything: no advice to go stronger.
  assert.equal(larger.hint, null);
  assert.equal(larger.offerDownload, false);

  const same = compressOutcome(1000, 1000, stats({ metadataRemoved: true }), 4);
  assert.equal(same.change, 'same');
  assert.equal(same.offerDownload, true, 'the user asked for the metadata to be removed');
});

test('Light with no JPEG photos suggests Balanced for the lossless images it skipped', () => {
  const outcome = compressOutcome(1000, 1000, stats({ level: 'light', imagesConsidered: 0, imagesReplaced: 0 }), 3);
  assert.equal(outcome.kind, 'light-skipped');
  assert.equal(outcome.skippedAtLight, 3);
  assert.equal(outcome.hint, 'convert-lossless');
  // A Light run that did shrink the file is simply a success.
  assert.equal(compressOutcome(1000, 800, stats({ level: 'light', imagesConsidered: 0 }), 3).kind, 'smaller');
});

test('without any images the hint explains that text is already compact', () => {
  for (const level of COMPRESSION_LEVELS) {
    const outcome = compressOutcome(1000, 1000, stats({ level, imagesConsidered: 0, imagesReplaced: 0 }), 0);
    assert.equal(outcome.kind, 'optimized', level);
    assert.equal(outcome.hint, 'text-only', level);
  }
});

test('an empty original never divides by zero', () => {
  const outcome = compressOutcome(0, 0, stats(), 0);
  assert.equal(outcome.saving, 0);
  assert.equal(outcome.kind, 'optimized');
});

test('displayedSaving never rounds a smaller file up to 100%', () => {
  assert.equal(displayedSaving(0.996), 0.99);
  assert.equal(displayedSaving(0.994), 0.994);
  assert.equal(displayedSaving(1), 1);
  assert.equal(formatters('en').percent(displayedSaving(0.998)), '99%');
  assert.equal(formatters('tr').percent(displayedSaving(0.998)), '%99');
});

// ------------------------------------------------------------------ messages

test('both locales define the same Compress PDF messages', () => {
  const keys = (value: unknown, prefix = ''): string[] =>
    value && typeof value === 'object'
      ? Object.entries(value).flatMap(([key, child]) => keys(child, `${prefix}${key}.`))
      : [prefix];
  assert.deepEqual(keys(pdfCompressMessages.tr).sort(), keys(pdfCompressMessages.en).sort());
});

test('Compress PDF messages pluralise per language and keep values free of Turkish suffixes', () => {
  const { en, tr } = pdfCompressMessages;
  assert.equal(en.pages(1), '1 page');
  assert.equal(en.pages(12), '12 pages');
  assert.equal(tr.pages(12), '12 sayfa');
  assert.equal(en.outlook.recompressible(1, 'balanced'), '1 image can be recompressed at Balanced');
  assert.equal(tr.outlook.recompressible(3, 'strong'), 'Güçlü düzeyde 3 görsel yeniden sıkıştırılabilir');
  assert.equal(en.details.recompressed(3, 12), '3 of 12 images recompressed');
  assert.equal(en.progress.image(2, 1500), 'Optimizing image 2 of 1,500…');
  assert.equal(tr.progress.image(2, 1500), 'Görseller optimize ediliyor: 2/1.500…');
  assert.equal(tr.levelHints.balanced(1800), 'Çok daha küçük, hâlâ net. Görseller en fazla 1.800 px olur.');
  // File names are quoted, so Turkish needs no case suffix after them.
  assert.equal(tr.errors.invalid('a.pdf'), '“a.pdf” okunamadı. Dosya bozuk olabilir.');
});

test('not-smaller titles and their announcements are separate messages', () => {
  for (const locale of ['en', 'tr'] as const) {
    for (const kind of ['light-skipped', 'optimized'] as const) {
      const text = pdfCompressMessages[locale].notSmaller[kind];
      assert.ok(text.title.length > 0 && text.announcement.length > 0);
      // The announcement is written to be heard: whole sentences, no dash.
      assert.ok(!text.announcement.includes('—'), `${locale} ${kind}`);
      assert.match(text.announcement, /\.$/);
    }
  }
});
