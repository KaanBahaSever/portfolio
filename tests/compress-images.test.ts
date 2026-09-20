import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { PDFDocument, PDFName, PDFRef } from 'pdf-lib';
import type { PDFContext, PDFPage } from 'pdf-lib';
import {
  MIN_IMAGE_DIMENSION,
  MIN_IMAGE_STREAM_BYTES,
  candidatesForLevel,
  findImageCandidates,
  grayMustStayGray,
} from '../src/lib/pdf/compress/images.ts';
import type { ImageCandidate } from '../src/lib/pdf/compress/images.ts';
import { collectReachableRefs } from '../src/lib/pdf/compress/cleanup.ts';
import { makeIccProfile, makeJpeg, segment } from './fixtures.ts';

type StreamDict = NonNullable<Parameters<PDFContext['stream']>[1]>;

/** Marker-level JPEG padded with a comment so the stream is above the size threshold. */
function paddedJpeg(width: number, height: number, components = 3, padding = 30_000): Uint8Array {
  return makeJpeg({ width, height, components, beforeSof: segment(0xfe, new Array<number>(padding).fill(0x41)) });
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

/** Rows prefixed with PNG filter type 2 (Up), deflated. */
function pngPredicted(samples: Uint8Array, colors: number, columns: number): Uint8Array {
  const rowBytes = colors * columns;
  const rows = samples.length / rowBytes;
  const out = new Uint8Array(rows * (rowBytes + 1));
  for (let row = 0; row < rows; row++) {
    out[row * (rowBytes + 1)] = 2;
    for (let i = 0; i < rowBytes; i++) {
      const up = row > 0 ? samples[(row - 1) * rowBytes + i]! : 0;
      out[row * (rowBytes + 1) + 1 + i] = (samples[row * rowBytes + i]! - up) & 0xff;
    }
  }
  return new Uint8Array(deflateSync(out));
}

function addImage(doc: PDFDocument, page: PDFPage | null, dict: StreamDict, contents: Uint8Array): PDFRef {
  const stream = doc.context.stream(contents, { Type: 'XObject', Subtype: 'Image', ...dict });
  const ref = doc.context.register(stream);
  if (page) page.node.newXObject('Im', ref);
  return ref;
}

async function buildFixture() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  const context = doc.context;
  const refs: Record<string, PDFRef> = {};
  const rgb = { BitsPerComponent: 8, ColorSpace: 'DeviceRGB' };

  refs.dctRgb = addImage(doc, page, { ...rgb, Width: 800, Height: 600, Filter: 'DCTDecode' }, paddedJpeg(800, 600));
  refs.dctGray = addImage(
    doc,
    page,
    { BitsPerComponent: 8, ColorSpace: 'DeviceGray', Width: 640, Height: 480, Filter: ['DCTDecode'] },
    paddedJpeg(640, 480, 1),
  );
  const icc = context.register(context.flateStream(makeIccProfile('RGB '), { N: 3 }));
  refs.dctIcc = addImage(
    doc,
    page,
    { BitsPerComponent: 8, ColorSpace: ['ICCBased', icc], Width: 500, Height: 500, Filter: 'DCTDecode' },
    paddedJpeg(500, 500),
  );
  const cmykIcc = context.register(context.flateStream(makeIccProfile('CMYK'), { N: 4 }));
  refs.dctCmyk = addImage(
    doc,
    page,
    { BitsPerComponent: 8, ColorSpace: 'DeviceCMYK', Width: 400, Height: 400, Filter: 'DCTDecode' },
    paddedJpeg(400, 400, 4),
  );
  refs.dctIccCmyk = addImage(
    doc,
    page,
    { BitsPerComponent: 8, ColorSpace: ['ICCBased', cmykIcc], Width: 400, Height: 400, Filter: 'DCTDecode' },
    paddedJpeg(400, 400, 4),
  );
  refs.dctDecode = addImage(
    doc,
    page,
    { ...rgb, Width: 300, Height: 300, Filter: 'DCTDecode', Decode: [1, 0, 1, 0, 1, 0] },
    paddedJpeg(300, 300),
  );
  refs.dctDefaultDecode = addImage(
    doc,
    page,
    { ...rgb, Width: 300, Height: 300, Filter: 'DCTDecode', Decode: [0, 1, 0, 1, 0, 1] },
    paddedJpeg(300, 300),
  );
  refs.dctColorTransform = addImage(
    doc,
    page,
    { ...rgb, Width: 300, Height: 300, Filter: 'DCTDecode', DecodeParms: { ColorTransform: 0 } },
    paddedJpeg(300, 300),
  );
  refs.dctMismatch = addImage(doc, page, { ...rgb, Width: 999, Height: 300, Filter: 'DCTDecode' }, paddedJpeg(300, 300));
  refs.dctTiny = addImage(doc, page, { ...rgb, Width: 32, Height: 900, Filter: 'DCTDecode' }, paddedJpeg(32, 900));
  refs.dctSmallBytes = addImage(doc, page, { ...rgb, Width: 800, Height: 800, Filter: 'DCTDecode' }, makeJpeg({ width: 800, height: 800 }));

  const width = 128;
  const height = 128;
  const pixels = noise(width * height * 3, 5);
  refs.flatePng = addImage(
    doc,
    page,
    {
      ...rgb,
      Width: width,
      Height: height,
      Filter: 'FlateDecode',
      DecodeParms: { Predictor: 15, Colors: 3, BitsPerComponent: 8, Columns: width },
    },
    pngPredicted(pixels, 3, width),
  );
  refs.flateColumnsMismatch = addImage(
    doc,
    page,
    {
      ...rgb,
      Width: width,
      Height: height,
      Filter: 'FlateDecode',
      DecodeParms: { Predictor: 12, Colors: 3, Columns: width - 1 },
    },
    pngPredicted(pixels, 3, width),
  );
  refs.flateTiff = addImage(
    doc,
    page,
    { ...rgb, Width: width, Height: height, Filter: ['FlateDecode'], DecodeParms: [{ Predictor: 2, Colors: 3, Columns: width }] },
    new Uint8Array(deflateSync(pixels)),
  );
  refs.rawUnfiltered = addImage(doc, page, { ...rgb, Width: width, Height: height }, pixels);
  refs.flate16 = addImage(
    doc,
    page,
    { BitsPerComponent: 16, ColorSpace: 'DeviceRGB', Width: width, Height: 64, Filter: 'FlateDecode' },
    new Uint8Array(deflateSync(pixels)),
  );
  refs.indexed = addImage(
    doc,
    page,
    { BitsPerComponent: 8, ColorSpace: ['Indexed', 'DeviceRGB', 1, context.register(context.flateStream(new Uint8Array(6)))], Width: width, Height: height * 2, Filter: 'FlateDecode' },
    new Uint8Array(deflateSync(noise(width * height * 2))),
  );
  refs.colorKey = addImage(
    doc,
    page,
    { ...rgb, Width: width, Height: height, Filter: 'FlateDecode', Mask: [0, 10, 0, 10, 0, 10] },
    new Uint8Array(deflateSync(pixels)),
  );
  refs.jbig2 = addImage(
    doc,
    page,
    { BitsPerComponent: 1, ColorSpace: 'DeviceGray', Width: 2000, Height: 2000, Filter: 'JBIG2Decode' },
    noise(40_000, 9),
  );
  refs.imageMask = addImage(
    doc,
    page,
    { ImageMask: true, BitsPerComponent: 1, Width: 2000, Height: 2000, Filter: 'FlateDecode' },
    new Uint8Array(deflateSync(noise(500_000, 3))),
  );

  // A soft mask with /Matte and its base image; the mask itself is never recompressed.
  const smask = addImage(
    doc,
    null,
    { BitsPerComponent: 8, ColorSpace: 'DeviceGray', Width: width, Height: height, Filter: 'FlateDecode', Matte: [0, 0, 0] },
    new Uint8Array(deflateSync(noise(width * height, 11))),
  );
  refs.smask = smask;
  refs.withSMask = addImage(
    doc,
    page,
    { ...rgb, Width: width, Height: height, Filter: 'FlateDecode', SMask: smask },
    new Uint8Array(deflateSync(noise(width * height * 3, 12))),
  );
  refs.unreachable = addImage(doc, null, { ...rgb, Width: 800, Height: 600, Filter: 'DCTDecode' }, paddedJpeg(800, 600));

  const bytes = await doc.save({ useObjectStreams: false });
  const loaded = await PDFDocument.load(bytes, { updateMetadata: false });
  return { doc: loaded, refs, pixels };
}

function byRef(candidates: ImageCandidate[], ref: PDFRef): ImageCandidate {
  const found = candidates.find((candidate) => candidate.ref === ref);
  assert.ok(found, `no candidate for ${ref.toString()}`);
  return found;
}

test('thresholds are what the tool promises', () => {
  assert.equal(MIN_IMAGE_STREAM_BYTES, 20 * 1024);
  assert.equal(MIN_IMAGE_DIMENSION, 64);
});

test('findImageCandidates classifies JPEG, lossless and unsupported images', async () => {
  const { doc, refs } = await buildFixture();
  const candidates = findImageCandidates(doc);
  const expect = (name: string, kind: ImageCandidate['kind'], reason?: string) => {
    const candidate = byRef(candidates, refs[name]!);
    assert.equal(candidate.kind, kind, `${name}: kind (${candidate.skipReason ?? ''})`);
    if (reason) assert.equal(candidate.skipReason, reason, `${name}: reason`);
    return candidate;
  };

  const dct = expect('dctRgb', 'jpeg');
  assert.equal(dct.width, 800);
  assert.equal(dct.height, 600);
  assert.equal(dct.bitsPerComponent, 8);
  assert.deepEqual(dct.filters, ['DCTDecode']);
  assert.deepEqual(dct.colorSpace, { family: 'DeviceRGB', components: 3, supported: true });
  assert.ok(dct.byteLength > MIN_IMAGE_STREAM_BYTES);
  assert.equal(dct.hasSMask, false);

  expect('dctGray', 'jpeg');
  assert.deepEqual(expect('dctIcc', 'jpeg').colorSpace, { family: 'ICCBased', components: 3, supported: true });
  expect('dctCmyk', 'skip', 'unsupported-color-space');
  expect('dctIccCmyk', 'skip', 'unsupported-color-space');
  assert.equal(expect('dctDecode', 'skip', 'decode-array').hasDecode, true);
  assert.equal(expect('dctDefaultDecode', 'jpeg').hasDecode, false);
  expect('dctColorTransform', 'skip', 'unsupported-decode-parms');
  expect('dctMismatch', 'skip', 'jpeg-mismatch');
  expect('dctTiny', 'skip', 'too-small');
  expect('dctSmallBytes', 'skip', 'too-small');

  const png = expect('flatePng', 'flate-raw');
  assert.deepEqual(png.predictor, { kind: 'png', colors: 3, columns: 128 });
  expect('flateColumnsMismatch', 'skip', 'unsupported-decode-parms');
  assert.deepEqual(expect('flateTiff', 'flate-raw').predictor, { kind: 'tiff', colors: 3, columns: 128 });
  const raw = expect('rawUnfiltered', 'flate-raw');
  assert.deepEqual(raw.filters, []);
  assert.deepEqual(raw.predictor, { kind: 'none', colors: 3, columns: 128 });
  expect('flate16', 'skip', 'unsupported-bits');
  assert.equal(expect('indexed', 'skip', 'unsupported-color-space').colorSpace.family, 'Indexed');
  assert.equal(expect('colorKey', 'skip', 'color-key-mask').hasColorKeyMask, true);
  expect('jbig2', 'skip');
  assert.equal(expect('imageMask', 'skip', 'image-mask').imageMask, true);

  const smask = expect('smask', 'skip', 'used-as-mask');
  assert.equal(smask.usedAsMask, true);
  const withSMask = expect('withSMask', 'flate-raw');
  assert.equal(withSMask.hasSMask, true);
  assert.equal(withSMask.keepSize, true, 'the soft mask has /Matte');
});

test('gray images are only candidates where becoming an RGB JPEG changes nothing', async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  const context = doc.context;
  const gray = { BitsPerComponent: 8, Width: 320, Height: 240, Filter: 'DCTDecode' };
  const grayProfile = context.register(context.flateStream(makeIccProfile('GRAY'), { N: 1 }));
  const refs = {
    plain: addImage(doc, page, { ...gray, ColorSpace: 'DeviceGray' }, paddedJpeg(320, 240, 1)),
    arrayForm: addImage(doc, page, { ...gray, ColorSpace: ['DeviceGray'] }, paddedJpeg(320, 240, 1)),
    iccGray: addImage(doc, page, { ...gray, ColorSpace: ['ICCBased', grayProfile] }, paddedJpeg(320, 240, 1)),
    matte: addImage(
      doc,
      page,
      {
        ...gray,
        ColorSpace: 'DeviceGray',
        SMask: addImage(doc, null, { BitsPerComponent: 8, ColorSpace: 'DeviceGray', Width: 320, Height: 240, Matte: [0.5] }, new Uint8Array(320 * 240)),
      },
      paddedJpeg(320, 240, 1),
    ),
    rgb: addImage(doc, page, { ...gray, ColorSpace: 'DeviceRGB' }, paddedJpeg(320, 240)),
  };
  const outcome = () => {
    const candidates = findImageCandidates(doc);
    return Object.values(refs).map((ref) => byRef(candidates, ref).skipReason ?? byRef(candidates, ref).kind);
  };

  assert.equal(grayMustStayGray(doc), false);
  assert.deepEqual(outcome(), ['jpeg', 'jpeg', 'gray-color-space', 'gray-color-space', 'jpeg']);

  const setIntent = (intent: Record<string, string | PDFRef>) =>
    doc.catalog.set(PDFName.of('OutputIntents'), context.obj([{ Type: 'OutputIntent', ...intent }]));
  const rgbProfile = context.register(context.flateStream(makeIccProfile('RGB '), { N: 3 }));
  setIntent({ S: 'GTS_PDFA1', DestOutputProfile: rgbProfile });
  assert.equal(grayMustStayGray(doc), false, 'PDF/A with an RGB output intent allows DeviceRGB');

  const cmykProfile = context.register(context.flateStream(makeIccProfile('CMYK', 'prtr'), { N: 4 }));
  setIntent({ S: 'GTS_PDFA1', DestOutputProfile: cmykProfile });
  assert.equal(grayMustStayGray(doc), true, 'CMYK output intent');
  assert.deepEqual(outcome(), ['gray-color-space', 'gray-color-space', 'gray-color-space', 'gray-color-space', 'jpeg']);

  setIntent({ S: 'GTS_PDFX', OutputConditionIdentifier: 'FOGRA39' });
  assert.equal(grayMustStayGray(doc), true, 'PDF/X output intent');

  doc.catalog.delete(PDFName.of('OutputIntents'));
  page.node.Resources()!.set(PDFName.of('ColorSpace'), context.obj({ DefaultGray: ['ICCBased', grayProfile] }));
  assert.equal(grayMustStayGray(doc), true, '/DefaultGray remaps DeviceGray');
  assert.equal(grayMustStayGray(doc, new Set()), false, 'only included objects are searched');
  assert.equal(grayMustStayGray(doc, collectReachableRefs(doc)), true);
});

test('findImageCandidates can be limited to reachable objects and a pixel budget', async () => {
  const { doc, refs } = await buildFixture();
  const all = findImageCandidates(doc);
  assert.ok(all.some((candidate) => candidate.ref === refs.unreachable));
  const reachable = findImageCandidates(doc, { include: collectReachableRefs(doc) });
  assert.ok(!reachable.some((candidate) => candidate.ref === refs.unreachable));
  assert.equal(reachable.length, all.length - 1);

  const limited = findImageCandidates(doc, { maxPixels: 400_000 });
  assert.equal(byRef(limited, refs.dctRgb!).skipReason, 'too-large');
  assert.equal(byRef(limited, refs.dctGray!).kind, 'jpeg');
});

test('candidatesForLevel: light only takes JPEGs', async () => {
  const { doc } = await buildFixture();
  const candidates = findImageCandidates(doc, { include: collectReachableRefs(doc) });
  const light = candidatesForLevel(candidates, false);
  const strong = candidatesForLevel(candidates, true);
  assert.ok(light.length > 0);
  assert.ok(light.every((candidate) => candidate.kind === 'jpeg'));
  assert.equal(strong.length, light.length + candidates.filter((c) => c.kind === 'flate-raw').length);
  assert.ok(strong.every((candidate) => candidate.kind !== 'skip'));
});

test('a PDFRef identity survives save and load (fixture sanity)', async () => {
  const { doc, refs } = await buildFixture();
  assert.equal(PDFRef.of(refs.dctRgb!.objectNumber), refs.dctRgb);
  assert.ok(doc.context.lookup(refs.dctRgb));
});
