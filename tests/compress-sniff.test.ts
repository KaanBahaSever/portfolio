import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_NAME_PARTS, compressedBaseName, looksLikePdf } from '../src/lib/pdf/compress/sniff.ts';
import { toPdfFilename } from '../src/lib/files/filename.ts';
import { pdfCompressMessages } from '../src/i18n/tools/pdf-compress.ts';

const bytes = (text: string) => new TextEncoder().encode(text);

test('looksLikePdf finds the header at the start or after a short preamble', () => {
  assert.equal(looksLikePdf(bytes('%PDF-1.7\n%âãÏÓ')), true);
  assert.equal(looksLikePdf(bytes('%PDF-')), true);
  assert.equal(looksLikePdf(bytes('garbage before\r\n%PDF-1.4')), true);
  const late = new Uint8Array(1100);
  late.set(bytes('%PDF-1.4'), 1020);
  assert.equal(looksLikePdf(late), false, 'beyond the first 1024 bytes');
  const edge = new Uint8Array(1024);
  edge.set(bytes('%PDF-'), 1019);
  assert.equal(looksLikePdf(edge), true);
});

test('looksLikePdf rejects other files', () => {
  assert.equal(looksLikePdf(new Uint8Array(0)), false);
  assert.equal(looksLikePdf(bytes('%PDF')), false);
  assert.equal(looksLikePdf(bytes('%!PS-Adobe-3.0')), false);
  assert.equal(looksLikePdf(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), false);
  assert.equal(looksLikePdf(bytes('%pdf-1.4')), false);
});

test('compressedBaseName appends -compressed and keeps names reasonable', () => {
  assert.equal(compressedBaseName('Report.pdf'), 'Report-compressed.pdf');
  assert.equal(compressedBaseName('scan.PDF'), 'scan-compressed.pdf');
  assert.equal(compressedBaseName('notes'), 'notes-compressed.pdf');
  assert.equal(compressedBaseName('.pdf'), 'document-compressed.pdf');
  assert.equal(compressedBaseName(''), 'document-compressed.pdf');
  const long = compressedBaseName(`${'ä'.repeat(150)}.pdf`);
  assert.ok(long.endsWith('-compressed.pdf'));
  assert.equal(toPdfFilename(long), long, 'still within the shared filename limit');
  assert.equal(toPdfFilename(compressedBaseName('a/b:c.pdf')), 'abc-compressed.pdf');
});

test('compressedBaseName uses the words it is given', () => {
  const parts = { suffix: '-small', fallbackBase: 'file' };
  assert.equal(compressedBaseName('Report.pdf', parts), 'Report-small.pdf');
  assert.equal(compressedBaseName('', parts), 'file-small.pdf');
  assert.equal(compressedBaseName('Report.pdf', DEFAULT_NAME_PARTS), compressedBaseName('Report.pdf'));
});

test('saved file names follow the page language', () => {
  const { en, tr } = pdfCompressMessages;
  assert.deepEqual(en.outputNames, DEFAULT_NAME_PARTS, 'English keeps the previous names');
  assert.equal(compressedBaseName('Report.pdf', en.outputNames), 'Report-compressed.pdf');
  assert.equal(compressedBaseName('.pdf', en.outputNames), 'document-compressed.pdf');
  // Same vocabulary as Split PDF's Turkish names ("belge", "bölünmüş").
  assert.equal(compressedBaseName('Rapor.pdf', tr.outputNames), 'Rapor-sıkıştırılmış.pdf');
  assert.equal(compressedBaseName('', tr.outputNames), 'belge-sıkıştırılmış.pdf');
  for (const names of [en.outputNames, tr.outputNames]) {
    // The controller's fallback when cleaning leaves nothing must itself survive cleaning.
    const fallback = `${names.fallbackBase}${names.suffix}.pdf`;
    assert.equal(toPdfFilename(fallback), fallback);
    // Suffix plus the longest kept base stays within the shared 100-code-point limit.
    const long = compressedBaseName(`${'ş'.repeat(150)}.pdf`, names);
    assert.equal(toPdfFilename(long), long);
  }
});
