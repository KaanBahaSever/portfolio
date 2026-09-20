import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFString } from 'pdf-lib';
import type { PDFContext, PDFPage } from 'pdf-lib';
import {
  PdfCompressError,
  analyzePdf,
  compressPdf,
  loadPdfForCompression,
  prepareJpegForBrowser,
} from '../src/lib/pdf/compress/compress-pdf.ts';
import type { TranscodeRequest, TranscodeResult, Transcoder } from '../src/lib/pdf/compress/compress-pdf.ts';
import { readJpegInfo } from '../src/lib/image/jpeg-info.ts';
import { makeIccProfile, makeJpeg, segment } from './fixtures.ts';

type StreamDict = NonNullable<Parameters<PDFContext['stream']>[1]>;
const name = (value: string) => PDFName.of(value);

function paddedJpeg(width: number, height: number, components = 3, orientation?: number): Uint8Array {
  return makeJpeg({
    width,
    height,
    components,
    orientation,
    beforeSof: segment(0xfe, new Array<number>(40_000).fill(0x42)),
  });
}

function noise(length: number, seed = 1): Uint8Array {
  const out = new Uint8Array(length);
  let state = seed;
  for (let i = 0; i < length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    out[i] = state >>> 24;
  }
  return out;
}

/** PNG "Sub" rows, deflated. */
function subPredicted(samples: Uint8Array, colors: number, columns: number): Uint8Array {
  const rowBytes = colors * columns;
  const rows = samples.length / rowBytes;
  const out = new Uint8Array(rows * (rowBytes + 1));
  for (let row = 0; row < rows; row++) {
    const o = row * (rowBytes + 1);
    out[o] = 1;
    for (let i = 0; i < rowBytes; i++) {
      const left = i >= colors ? samples[row * rowBytes + i - colors]! : 0;
      out[o + 1 + i] = (samples[row * rowBytes + i]! - left) & 0xff;
    }
  }
  return new Uint8Array(deflateSync(out));
}

function addImage(doc: PDFDocument, page: PDFPage | null, dict: StreamDict, contents: Uint8Array): PDFRef {
  const ref = doc.context.register(doc.context.stream(contents, { Type: 'XObject', Subtype: 'Image', ...dict }));
  if (page) page.node.newXObject('Im', ref);
  return ref;
}

const FLATE_W = 150;
const FLATE_H = 120;

async function buildPdf() {
  const doc = await PDFDocument.create();
  doc.setTitle('Holiday photos');
  doc.setAuthor('Someone');
  const page = doc.addPage([400, 400]);
  doc.addPage([400, 400]);
  const context = doc.context;
  const rgb = { BitsPerComponent: 8, ColorSpace: 'DeviceRGB' };

  const bigJpeg = addImage(doc, page, { ...rgb, Width: 2400, Height: 1600, Filter: 'DCTDecode' }, paddedJpeg(2400, 1600, 3, 6));
  const icc = context.register(context.flateStream(makeIccProfile('RGB '), { N: 3 }));
  const iccJpeg = addImage(
    doc,
    page,
    { BitsPerComponent: 8, ColorSpace: ['ICCBased', icc], Width: 900, Height: 700, Filter: 'DCTDecode' },
    paddedJpeg(900, 700),
  );
  const grayJpeg = addImage(
    doc,
    page,
    { BitsPerComponent: 8, ColorSpace: 'DeviceGray', Width: 700, Height: 900, Filter: 'DCTDecode' },
    paddedJpeg(700, 900, 1),
  );
  const pixels = noise(FLATE_W * FLATE_H * 3, 21);
  const smask = addImage(
    doc,
    null,
    { BitsPerComponent: 8, ColorSpace: 'DeviceGray', Width: 30, Height: 20, Filter: 'FlateDecode' },
    new Uint8Array(deflateSync(noise(600, 4))),
  );
  const flate = addImage(
    doc,
    page,
    {
      ...rgb,
      Width: FLATE_W,
      Height: FLATE_H,
      Filter: 'FlateDecode',
      DecodeParms: { Predictor: 11, Colors: 3, Columns: FLATE_W },
      SMask: smask,
    },
    subPredicted(pixels, 3, FLATE_W),
  );
  // 1300 x 70 gray, no filter at all: Strong downsizes it in the worker before encoding.
  const wideGray = Uint8Array.from({ length: 1300 * 70 }, (_, i) => ((i % 1300) >> 3) & 0xff); // compressible
  const wide = addImage(doc, page, { BitsPerComponent: 8, ColorSpace: 'DeviceGray', Width: 1300, Height: 70 }, wideGray);
  const cmyk = addImage(
    doc,
    page,
    { BitsPerComponent: 8, ColorSpace: 'DeviceCMYK', Width: 600, Height: 600, Filter: 'DCTDecode' },
    paddedJpeg(600, 600, 4),
  );

  // Clutter a real file accumulates.
  const orphanImage = addImage(doc, null, { ...rgb, Width: 800, Height: 800, Filter: 'DCTDecode' }, paddedJpeg(800, 800));
  context.register(context.obj({ Leftover: true }));
  const xmp = context.register(context.stream(`<x:xmpmeta>${'x'.repeat(500)}</x:xmpmeta>`, { Type: 'Metadata', Subtype: 'XML' }));
  doc.catalog.set(name('Metadata'), xmp);
  const content = context.register(context.stream('q 10 0 0 10 0 0 cm /Im1 Do Q\n'.repeat(100)));
  page.node.set(name('Contents'), content);

  const bytes = await doc.save({ useObjectStreams: false });
  return { bytes, refs: { bigJpeg, iccJpeg, grayJpeg, flate, smask, wide, cmyk, orphanImage, icc, content }, pixels, wideGray };
}

/** Fake browser encoder: a marker-level JPEG at the requested size. */
function fakeTranscoder(calls: TranscodeRequest[], override?: (request: TranscodeRequest) => TranscodeResult | null): Transcoder {
  return async (request) => {
    calls.push(request);
    if (override) return override(request);
    return {
      bytes: makeJpeg({ width: request.targetWidth, height: request.targetHeight }),
      width: request.targetWidth,
      height: request.targetHeight,
    };
  };
}

function lookupStream(doc: PDFDocument, ref: PDFRef): PDFRawStream {
  const stream = doc.context.lookup(PDFRef.of(ref.objectNumber));
  assert.ok(stream instanceof PDFRawStream, `object ${ref.objectNumber} is a stream`);
  return stream;
}

function numberEntry(stream: PDFRawStream, key: string): number {
  const value = stream.dict.get(name(key));
  assert.ok(value instanceof PDFNumber, `${key} is a number`);
  return value.asNumber();
}

test('loadPdfForCompression rejects non-PDFs and encrypted PDFs', async () => {
  await assert.rejects(loadPdfForCompression(new TextEncoder().encode('hello, not a pdf')), (error: unknown) => {
    assert.ok(error instanceof PdfCompressError);
    assert.equal(error.code, 'invalid');
    return true;
  });
  await assert.rejects(loadPdfForCompression(new TextEncoder().encode('%PDF-1.7\n%%EOF\n')), { code: 'invalid' });

  const doc = await PDFDocument.create();
  doc.addPage();
  doc.context.trailerInfo.Encrypt = doc.context.register(doc.context.obj({ Filter: 'Standard', V: 2, R: 3 }));
  const encrypted = await doc.save();
  await assert.rejects(loadPdfForCompression(encrypted), { name: 'PdfCompressError', code: 'encrypted' });
});

test('analyzePdf counts pages and the images each level would try', async () => {
  const { bytes } = await buildPdf();
  const doc = await loadPdfForCompression(bytes);
  const summary = analyzePdf(doc);
  assert.equal(summary.pageCount, 2);
  // JPEGs: big, ICC, gray (CMYK and the unreachable one are not counted). Lossless: flate, wide.
  assert.deepEqual(summary.imageCounts, { light: 3, balanced: 5, strong: 5 });
});

test('prepareJpegForBrowser drops metadata and EXIF rotation, always copying', () => {
  const rotated = paddedJpeg(64, 64, 3, 6);
  const prepared = prepareJpegForBrowser(rotated);
  assert.notEqual(prepared.buffer, rotated.buffer);
  assert.ok(prepared.length < rotated.length, 'comment segment removed');
  assert.equal(readJpegInfo(prepared)?.orientation, 1);
  const plain = makeJpeg({ width: 8, height: 8 });
  const copy = prepareJpegForBrowser(plain);
  assert.notEqual(copy.buffer, plain.buffer);
  assert.equal(copy.byteOffset, 0);
  assert.equal(copy.byteLength, copy.buffer.byteLength);
});

test('compressPdf (strong) recompresses images, cleans up and saves a loadable PDF', async () => {
  const { bytes, refs, pixels, wideGray } = await buildPdf();
  const doc = await loadPdfForCompression(bytes);
  const calls: TranscodeRequest[] = [];
  const progress: string[] = [];
  const result = await compressPdf({
    doc,
    level: 'strong',
    stripMetadata: true,
    transcode: fakeTranscoder(calls),
    onProgress: ({ stage, done, total }) => progress.push(`${stage}:${done}/${total}`),
  });

  assert.equal(calls.length, 5);
  assert.deepEqual(progress, ['cleanup:0/0', 'images:0/5', 'images:1/5', 'images:2/5', 'images:3/5', 'images:4/5', 'saving:5/5']);

  const big = calls.find((call) => call.kind === 'jpeg' && call.width === 2400)!;
  assert.equal(big.targetWidth, 1200);
  assert.equal(big.targetHeight, 800);
  assert.equal(big.quality, 0.55);
  assert.equal(readJpegInfo(big.data)?.orientation, 1, 'EXIF rotation neutralised');
  assert.equal(big.data.byteLength, big.data.buffer.byteLength, 'transferable');

  const flate = calls.find((call) => call.kind === 'pixels' && call.channels === 3)!;
  assert.equal(flate.width, FLATE_W);
  assert.equal(flate.targetWidth, FLATE_W, 'small images keep their size');
  assert.deepEqual(flate.data, pixels, 'PNG predictors undone');

  const wide = calls.find((call) => call.kind === 'pixels' && call.channels === 1)!;
  assert.equal(wide.width, 1200);
  assert.equal(wide.height, 65);
  assert.equal(wide.data.length, 1200 * 65);
  assert.notEqual(wide.data, wideGray);

  const { stats } = result;
  assert.equal(stats.level, 'strong');
  assert.equal(stats.imagesConsidered, 5);
  assert.equal(stats.imagesReplaced, 5);
  assert.ok(stats.imageBytesAfter < stats.imageBytesBefore);
  assert.ok(stats.objectsRemoved >= 3, `orphans removed (${stats.objectsRemoved})`);
  assert.equal(stats.metadataRemoved, true);
  assert.equal(stats.streamsDeflated, 1, 'uncompressed content stream deflated');
  assert.ok(result.bytes.length < bytes.length / 2);

  const out = await loadPdfForCompression(result.bytes);
  assert.equal(out.getPageCount(), 2);
  assert.equal(out.context.trailerInfo.Info, undefined);
  assert.equal(out.catalog.has(name('Metadata')), false);
  assert.equal(out.context.lookup(PDFRef.of(refs.orphanImage.objectNumber)), undefined);

  const bigOut = lookupStream(out, refs.bigJpeg);
  assert.equal(bigOut.dict.get(name('Filter')), name('DCTDecode'));
  assert.equal(numberEntry(bigOut, 'Width'), 1200);
  assert.equal(numberEntry(bigOut, 'Height'), 800);
  assert.equal(bigOut.dict.get(name('ColorSpace')), name('DeviceRGB'));

  const iccOut = lookupStream(out, refs.iccJpeg);
  const space = iccOut.dict.get(name('ColorSpace'));
  assert.ok(space instanceof PDFArray, 'ICC colour space kept for RGB output');

  const grayOut = lookupStream(out, refs.grayJpeg);
  assert.equal(grayOut.dict.get(name('ColorSpace')), name('DeviceRGB'), 'gray source became an RGB JPEG');

  const flateOut = lookupStream(out, refs.flate);
  assert.equal(flateOut.dict.get(name('Filter')), name('DCTDecode'));
  assert.equal(flateOut.dict.has(name('DecodeParms')), false);
  assert.ok(flateOut.dict.get(name('SMask')) instanceof PDFRef, 'soft mask kept');
  assert.equal(lookupStream(out, refs.smask).dict.get(name('Filter')), name('FlateDecode'), 'mask untouched');

  const cmykOut = lookupStream(out, refs.cmyk);
  assert.equal(numberEntry(cmykOut, 'Width'), 600, 'CMYK image untouched');
});

test('compressPdf (light) leaves lossless images and keeps metadata when asked', async () => {
  const { bytes, refs } = await buildPdf();
  const doc = await loadPdfForCompression(bytes);
  const calls: TranscodeRequest[] = [];
  const { bytes: output, stats } = await compressPdf({ doc, level: 'light', stripMetadata: false, transcode: fakeTranscoder(calls) });
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.kind === 'jpeg'));
  assert.equal(calls.find((call) => call.width === 2400)?.targetWidth, 2400, 'Light keeps 2400 px');
  assert.equal(stats.metadataRemoved, false);
  const out = await loadPdfForCompression(output);
  assert.equal(out.getTitle(), 'Holiday photos');
  assert.equal(lookupStream(out, refs.flate).dict.get(name('Filter')), name('FlateDecode'));
  // The unfiltered gray image is not converted, but it is deflated losslessly.
  assert.equal(lookupStream(out, refs.wide).dict.get(name('Filter')), name('FlateDecode'));
});

test('compressPdf keeps originals when the encoder result is unusable', async () => {
  const { bytes, refs } = await buildPdf();
  const cases: Array<[string, (request: TranscodeRequest) => TranscodeResult | null]> = [
    ['declined', () => null],
    ['not smaller', (request) => ({ bytes: new Uint8Array(request.maxBytes + 1), width: request.targetWidth, height: request.targetHeight })],
    ['wrong size', () => ({ bytes: makeJpeg({ width: 10, height: 10 }), width: 10, height: 10 })],
    ['not a JPEG', (request) => ({ bytes: new Uint8Array(100), width: request.targetWidth, height: request.targetHeight })],
  ];
  for (const [label, override] of cases) {
    const doc = await loadPdfForCompression(bytes);
    const calls: TranscodeRequest[] = [];
    const { bytes: output, stats } = await compressPdf({ doc, level: 'balanced', stripMetadata: false, transcode: fakeTranscoder(calls, override) });
    assert.equal(calls.length, 5, label);
    assert.equal(stats.imagesReplaced, 0, label);
    const out = await loadPdfForCompression(output);
    assert.equal(numberEntry(lookupStream(out, refs.bigJpeg), 'Width'), 2400, label);
  }
});

test('compressPdf skips an image whose data is damaged and continues', async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([100, 100]);
  const broken = addImage(
    doc,
    page,
    { BitsPerComponent: 8, ColorSpace: 'DeviceRGB', Width: 200, Height: 200, Filter: 'FlateDecode' },
    noise(50_000, 2), // not zlib data
  );
  const good = addImage(doc, page, { BitsPerComponent: 8, ColorSpace: 'DeviceRGB', Width: 500, Height: 400, Filter: 'DCTDecode' }, paddedJpeg(500, 400));
  const loaded = await loadPdfForCompression(await doc.save());
  const calls: TranscodeRequest[] = [];
  const { bytes, stats } = await compressPdf({ doc: loaded, level: 'balanced', stripMetadata: false, transcode: fakeTranscoder(calls) });
  assert.equal(stats.imagesConsidered, 2);
  assert.equal(stats.imagesReplaced, 1);
  const out = await loadPdfForCompression(bytes);
  assert.equal(lookupStream(out, broken).dict.get(name('Filter')), name('FlateDecode'));
  assert.equal(lookupStream(out, good).dict.get(name('Filter')), name('DCTDecode'));
});

test('compressPdf stops with an AbortError', async () => {
  const { bytes } = await buildPdf();
  const doc = await loadPdfForCompression(bytes);
  const controller = new AbortController();
  const calls: TranscodeRequest[] = [];
  await assert.rejects(
    compressPdf({
      doc,
      level: 'balanced',
      stripMetadata: false,
      signal: controller.signal,
      transcode: fakeTranscoder(calls, (request) => {
        controller.abort();
        return { bytes: makeJpeg({ width: request.targetWidth, height: request.targetHeight }), width: request.targetWidth, height: request.targetHeight };
      }),
    }),
    { name: 'AbortError' },
  );
  assert.equal(calls.length, 1);
});

test('the original bytes are never modified, so every run starts from the same file', async () => {
  const { bytes } = await buildPdf();
  const original = bytes.slice();
  for (const level of ['strong', 'light'] as const) {
    const doc = await loadPdfForCompression(bytes);
    await compressPdf({ doc, level, stripMetadata: true, transcode: fakeTranscoder([]) });
  }
  assert.deepEqual(bytes, original);
});

test('incremental updates: the newest object definition wins and survives compression', async () => {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.addPage([100, 100]);
  const info = doc.context.register(doc.context.obj({ Title: PDFString.of('Old title') }));
  doc.context.trailerInfo.Info = info;
  const root = doc.context.trailerInfo.Root as PDFRef;
  const base = new TextDecoder('latin1').decode(await doc.save({ useObjectStreams: false }));

  const prev = Number(/startxref\s+(\d+)\s+%%EOF\s*$/.exec(base)?.[1]);
  assert.ok(Number.isFinite(prev));
  const objectOffset = base.length + 1;
  const object = `\n${info.objectNumber} 0 obj\n<< /Title (New title) >>\nendobj\n`;
  const xrefOffset = base.length + object.length;
  const update =
    object +
    `xref\n0 1\n0000000000 65535 f \n${info.objectNumber} 1\n${String(objectOffset).padStart(10, '0')} 00000 n \n` +
    `trailer\n<< /Size ${doc.context.largestObjectNumber + 1} /Root ${root.objectNumber} 0 R /Info ${info.objectNumber} 0 R /Prev ${prev} >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;
  const updated = Uint8Array.from(base + update, (char) => char.charCodeAt(0));

  const loaded = await loadPdfForCompression(updated);
  assert.equal(loaded.getTitle(), 'New title');
  const { bytes } = await compressPdf({ doc: loaded, level: 'balanced', stripMetadata: false, transcode: fakeTranscoder([]) });
  const out = await loadPdfForCompression(bytes);
  assert.equal(out.getTitle(), 'New title');
  assert.equal(out.getPageCount(), 1);
  assert.ok(!new TextDecoder('latin1').decode(bytes).includes('Old title'));
});

test('a compressed file (object and xref streams) can be compressed again', async () => {
  const { bytes } = await buildPdf();
  const first = await compressPdf({ doc: await loadPdfForCompression(bytes), level: 'balanced', stripMetadata: false, transcode: fakeTranscoder([]) });
  const calls: TranscodeRequest[] = [];
  const second = await compressPdf({ doc: await loadPdfForCompression(first.bytes), level: 'balanced', stripMetadata: false, transcode: fakeTranscoder(calls) });
  assert.equal(second.stats.imagesReplaced, 0, 'nothing left worth recompressing');
  assert.ok(calls.every((call) => call.kind === 'jpeg' || call.kind === 'pixels'));
  const out = await loadPdfForCompression(second.bytes);
  assert.equal(out.getPageCount(), 2);
  assert.ok(second.bytes.length <= first.bytes.length + 64);
});

/**
 * Linearized layout with cross-reference streams: the first-page section at the start of the
 * file carries /Root, /Info and /ID (and /Encrypt), the main section at the end only /Size.
 * pdf-lib reads the objects in file order and does not use the entries themselves.
 */
function linearizedXrefStreamPdf(encrypted: boolean): Uint8Array {
  const entries = '\x01\x00\x00\x00\x10\x00'.repeat(9);
  const xref = (extra: string) =>
    `<< /Type /XRef /Size 9 /W [1 4 1] ${extra}/Length ${entries.length} >>\nstream\n${entries}\nendstream`;
  const objects: Array<[number, string]> = [
    [7, '<< /Linearized 1 /L 1000 /N 1 >>'],
    [8, xref(`/Root 1 0 R /Info 4 0 R /ID [<0102AB> <0102AB>] ${encrypted ? '/Encrypt 5 0 R ' : ''}/Prev 900 `)],
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>'],
    [4, '<< /Title (Scanned letter) /Author (Someone) >>'],
    ...(encrypted ? [[5, '<< /Filter /Standard /V 2 /R 3 /Length 128 /O <00> /U <00> /P -4 >>'] as [number, string]] : []),
    [6, xref('')],
  ];
  let text = '%PDF-1.5\n';
  let lastOffset = 0;
  for (const [number, body] of objects) {
    lastOffset = text.length;
    text += `${number} 0 obj\n${body}\nendobj\n`;
  }
  text += `startxref\n${lastOffset}\n%%EOF\n`;
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

test('trailer entries survive a last cross-reference stream that omits them (linearized files)', async () => {
  const doc = await loadPdfForCompression(linearizedXrefStreamPdf(false));
  assert.ok(doc.context.trailerInfo.Info instanceof PDFRef);
  assert.ok(doc.context.trailerInfo.ID instanceof PDFArray);
  const { bytes } = await compressPdf({ doc, level: 'balanced', stripMetadata: false, transcode: fakeTranscoder([]) });
  const out = await loadPdfForCompression(bytes);
  assert.equal(out.getTitle(), 'Scanned letter');
  assert.equal(out.getAuthor(), 'Someone');
  assert.ok(out.context.trailerInfo.ID instanceof PDFArray, 'file ID kept');

  await assert.rejects(loadPdfForCompression(linearizedXrefStreamPdf(true)), { name: 'PdfCompressError', code: 'encrypted' });
});

test('gray images whose rendering depends on staying gray are left as they are', async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const context = doc.context;
  const gray = { BitsPerComponent: 8, Width: 700, Height: 500, Filter: 'DCTDecode' };
  const profile = context.register(context.flateStream(makeIccProfile('GRAY'), { N: 1 }));
  const iccGray = addImage(doc, page, { ...gray, ColorSpace: ['ICCBased', profile] }, paddedJpeg(700, 500, 1));
  const matte = addImage(
    doc,
    null,
    { BitsPerComponent: 8, ColorSpace: 'DeviceGray', Width: 700, Height: 500, Filter: 'FlateDecode', Matte: [0.5] },
    new Uint8Array(deflateSync(new Uint8Array(700 * 500).fill(128))),
  );
  const withMatte = addImage(doc, page, { ...gray, ColorSpace: 'DeviceGray', SMask: matte }, paddedJpeg(700, 500, 1));
  const plain = addImage(doc, page, { ...gray, ColorSpace: 'DeviceGray' }, paddedJpeg(700, 500, 1));
  const bytes = await doc.save();

  const loaded = await loadPdfForCompression(bytes);
  assert.deepEqual(analyzePdf(loaded).imageCounts, { light: 1, balanced: 1, strong: 1 });
  const calls: TranscodeRequest[] = [];
  const result = await compressPdf({ doc: loaded, level: 'balanced', stripMetadata: false, transcode: fakeTranscoder(calls) });
  assert.equal(calls.length, 1);
  assert.equal(result.stats.imagesReplaced, 1);
  const out = await loadPdfForCompression(result.bytes);
  const iccOut = lookupStream(out, iccGray);
  assert.ok(iccOut.dict.get(name('ColorSpace')) instanceof PDFArray, 'gray ICC profile kept');
  assert.equal(iccOut.contents.length, paddedJpeg(700, 500, 1).length);
  const matteOut = lookupStream(out, withMatte);
  assert.equal(matteOut.dict.get(name('ColorSpace')), name('DeviceGray'), 'Matte still matches one component');
  assert.equal(lookupStream(out, plain).dict.get(name('ColorSpace')), name('DeviceRGB'), 'plain DeviceGray converted');

  // A print file (CMYK output intent) gains no RGB image at all, with or without metadata.
  const print = await loadPdfForCompression(bytes);
  const cmyk = print.context.register(print.context.flateStream(makeIccProfile('CMYK', 'prtr'), { N: 4 }));
  print.catalog.set(name('OutputIntents'), print.context.obj([{ Type: 'OutputIntent', S: 'GTS_PDFX', DestOutputProfile: cmyk }]));
  const printed = await compressPdf({ doc: print, level: 'balanced', stripMetadata: true, transcode: fakeTranscoder([]) });
  assert.equal(printed.stats.imagesConsidered, 0);
});

test('metadata removal also strips Exif from JPEG images that are not recompressed', async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([100, 100]);
  // Under the size threshold, so it is never recompressed.
  const photo = makeJpeg({ width: 640, height: 480, orientation: 1, beforeSof: segment(0xfe, [0x47, 0x50, 0x53]) });
  const ref = addImage(doc, page, { BitsPerComponent: 8, ColorSpace: 'DeviceRGB', Width: 640, Height: 480, Filter: 'DCTDecode' }, photo);
  const bytes = await doc.save();
  const hasExif = (data: Uint8Array) => new TextDecoder('latin1').decode(data).includes('Exif');

  const kept = await compressPdf({ doc: await loadPdfForCompression(bytes), level: 'strong', stripMetadata: false, transcode: fakeTranscoder([]) });
  assert.equal(kept.stats.imagesConsidered, 0);
  assert.ok(hasExif(lookupStream(await loadPdfForCompression(kept.bytes), ref).contents), 'kept without metadata removal');

  const stripped = await compressPdf({ doc: await loadPdfForCompression(bytes), level: 'strong', stripMetadata: true, transcode: fakeTranscoder([]) });
  const image = lookupStream(await loadPdfForCompression(stripped.bytes), ref).contents;
  assert.ok(!hasExif(image));
  assert.equal(readJpegInfo(image)?.width, 640);
  assert.ok(image.length < photo.length);
});

test('PDF/X files keep their PDF version and classic structure unless their metadata is removed', async () => {
  const text = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);
  const build = async (minor: number, declare: (doc: PDFDocument) => void) => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    doc.addPage([100, 100]);
    doc.setTitle('Print file');
    declare(doc);
    const saved = await doc.save({ useObjectStreams: false });
    assert.equal(text(saved.subarray(0, 8)), '%PDF-1.7');
    saved[7] = 0x30 + minor; // as an older application would have written it
    return saved;
  };
  const compress = async (bytes: Uint8Array, stripMetadata: boolean) =>
    (await compressPdf({ doc: await loadPdfForCompression(bytes), level: 'balanced', stripMetadata, transcode: fakeTranscoder([]) })).bytes;

  const x1a = await build(3, (doc) => doc.context.lookup(doc.context.trailerInfo.Info, PDFDict).set(name('GTS_PDFXVersion'), PDFString.of('PDF/X-1a:2001')));
  const kept = await compress(x1a, false);
  assert.equal(text(kept.subarray(0, 9)), '%PDF-1.3\n');
  assert.ok(!text(kept).includes('/ObjStm') && !text(kept).includes('/XRef'));
  assert.equal((await loadPdfForCompression(kept)).getTitle(), 'Print file');
  const stripped = await compress(x1a, true);
  assert.equal(text(stripped.subarray(0, 8)), '%PDF-1.7');
  assert.ok(text(stripped).includes('/ObjStm'));

  const x4 = await build(6, (doc) => {
    const xmp = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description xmlns:pdfxid="http://www.npes.org/pdfx/ns/id/"><pdfxid:GTS_PDFXVersion>PDF/X-4</pdfxid:GTS_PDFXVersion></rdf:Description></rdf:RDF></x:xmpmeta>`;
    doc.catalog.set(name('Metadata'), doc.context.register(doc.context.stream(xmp, { Type: 'Metadata', Subtype: 'XML' })));
  });
  const x4Kept = await compress(x4, false);
  assert.equal(text(x4Kept.subarray(0, 8)), '%PDF-1.6');
  assert.ok(!text(x4Kept).includes('/ObjStm'));

  const plain = await build(4, () => {});
  const modern = await compress(plain, false);
  assert.equal(text(modern.subarray(0, 8)), '%PDF-1.7', 'other files use object streams, which need PDF 1.5');
  assert.ok(text(modern).includes('/ObjStm'));
});

test('PDF/A-1 files are saved without object streams unless their metadata is removed', async () => {
  const build = async (part: string) => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    const xmp = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>${part}</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description></rdf:RDF></x:xmpmeta>`;
    doc.catalog.set(name('Metadata'), doc.context.register(doc.context.stream(xmp, { Type: 'Metadata', Subtype: 'XML' })));
    return doc.save({ useObjectStreams: false });
  };
  const text = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);
  const pdfA1 = await build('1');
  const kept = await compressPdf({ doc: await loadPdfForCompression(pdfA1), level: 'balanced', stripMetadata: false, transcode: fakeTranscoder([]) });
  assert.ok(!text(kept.bytes).includes('/ObjStm'));
  assert.ok(text(kept.bytes).includes('pdfaid:part'), 'XMP stays readable (not deflated)');
  const stripped = await compressPdf({ doc: await loadPdfForCompression(pdfA1), level: 'balanced', stripMetadata: true, transcode: fakeTranscoder([]) });
  assert.ok(text(stripped.bytes).includes('/ObjStm'));
  const pdfA2 = await build('2');
  const modern = await compressPdf({ doc: await loadPdfForCompression(pdfA2), level: 'balanced', stripMetadata: false, transcode: fakeTranscoder([]) });
  assert.ok(text(modern.bytes).includes('/ObjStm'));
});
