import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { PDFArray, PDFBool, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef } from 'pdf-lib';
import { replaceImageStream } from '../src/lib/pdf/compress/replace.ts';
import { makeIccProfile, makeJpeg } from './fixtures.ts';

const name = (value: string) => PDFName.of(value);

async function fixture() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 200]);
  const context = doc.context;
  const smask = context.register(
    context.stream(new Uint8Array(deflateSync(new Uint8Array(40 * 30))), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 40,
      Height: 30,
      BitsPerComponent: 8,
      ColorSpace: 'DeviceGray',
      Filter: 'FlateDecode',
    }),
  );
  const oc = context.register(context.obj({ Type: 'OCG', Name: 'Layer' }));
  const metadata = context.register(context.stream('<x:xmpmeta/>', { Type: 'Metadata', Subtype: 'XML' }));
  const icc = context.register(context.flateStream(makeIccProfile('RGB '), { N: 3 }));
  const image = context.register(
    context.stream(new Uint8Array(deflateSync(new Uint8Array(400 * 300 * 3))), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 400,
      Height: 300,
      BitsPerComponent: 8,
      ColorSpace: ['ICCBased', icc],
      Filter: 'FlateDecode',
      DecodeParms: { Predictor: 15, Colors: 3, Columns: 400 },
      Decode: [0, 1, 0, 1, 0, 1],
      DL: 360_000,
      SMask: smask,
      Intent: 'Perceptual',
      Interpolate: true,
      OC: oc,
      Metadata: metadata,
      StructParent: 7,
    }),
  );
  page.node.newXObject('Im', image);
  return { doc, image, smask, oc, metadata, icc };
}

test('replaceImageStream writes a DCT image and keeps unrelated entries', async () => {
  const { doc, image, smask, oc, metadata } = await fixture();
  const jpeg = makeJpeg({ width: 200, height: 150 });
  replaceImageStream(doc, image, jpeg, 200, 150, 3);

  const stream = doc.context.lookup(image);
  assert.ok(stream instanceof PDFRawStream);
  const dict = stream.dict;
  assert.equal(dict.get(name('Type')), name('XObject'));
  assert.equal(dict.get(name('Subtype')), name('Image'));
  assert.equal((dict.get(name('Width')) as PDFNumber).asNumber(), 200);
  assert.equal((dict.get(name('Height')) as PDFNumber).asNumber(), 150);
  assert.equal((dict.get(name('BitsPerComponent')) as PDFNumber).asNumber(), 8);
  assert.equal(dict.get(name('ColorSpace')), name('DeviceRGB'));
  assert.equal(dict.get(name('Filter')), name('DCTDecode'));
  for (const removed of ['DecodeParms', 'Decode', 'DL', 'Length']) {
    assert.equal(dict.has(name(removed)), false, `${removed} removed`);
  }
  assert.equal(dict.get(name('SMask')), smask);
  assert.equal(dict.get(name('OC')), oc);
  assert.equal(dict.get(name('Metadata')), metadata);
  assert.equal(dict.get(name('Intent')), name('Perceptual'));
  assert.equal(dict.get(name('Interpolate')), PDFBool.True);
  assert.equal((dict.get(name('StructParent')) as PDFNumber).asNumber(), 7);
  assert.equal(stream.contents, jpeg);

  // The SMask keeps its own (different) dimensions.
  const mask = doc.context.lookup(smask);
  assert.ok(mask instanceof PDFRawStream);
  assert.equal((mask.dict.get(name('Width')) as PDFNumber).asNumber(), 40);
});

test('replaceImageStream: gray output and an explicit colour space', async () => {
  const { doc, image, icc } = await fixture();
  replaceImageStream(doc, image, makeJpeg({ width: 10, height: 10, components: 1 }), 10, 10, 1);
  const gray = doc.context.lookup(image) as PDFRawStream;
  assert.equal(gray.dict.get(name('ColorSpace')), name('DeviceGray'));

  const iccSpace = doc.context.obj([name('ICCBased'), icc]);
  replaceImageStream(doc, image, makeJpeg({ width: 10, height: 10 }), 10, 10, 3, { colorSpace: iccSpace });
  const kept = doc.context.lookup(image) as PDFRawStream;
  const space = kept.dict.get(name('ColorSpace'));
  assert.ok(space instanceof PDFArray);
  assert.equal(space.get(1), icc);
});

test('replaceImageStream output survives save and reload', async () => {
  const { doc, image } = await fixture();
  const jpeg = makeJpeg({ width: 321, height: 123 });
  replaceImageStream(doc, image, jpeg, 321, 123, 3);
  const bytes = await doc.save({ useObjectStreams: true });
  const loaded = await PDFDocument.load(bytes, { updateMetadata: false });
  const stream = loaded.context.lookup(PDFRef.of(image.objectNumber));
  assert.ok(stream instanceof PDFRawStream);
  assert.deepEqual(Array.from(stream.contents), Array.from(jpeg));
  assert.equal((stream.dict.get(name('Length')) as PDFNumber).asNumber(), jpeg.length);
  assert.equal(stream.dict.get(name('Filter')), name('DCTDecode'));
  assert.equal(loaded.getPageCount(), 1);
});

test('replaceImageStream rejects non-streams and bad sizes', async () => {
  const { doc, image, oc } = await fixture();
  const jpeg = makeJpeg({ width: 1, height: 1 });
  assert.throws(() => replaceImageStream(doc, oc, jpeg, 1, 1, 3), /not a stream/);
  assert.throws(() => replaceImageStream(doc, image, jpeg, 0, 1, 3), RangeError);
  assert.throws(() => replaceImageStream(doc, image, jpeg, 1.5, 1, 3), RangeError);
});
