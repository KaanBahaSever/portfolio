import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFStream, decodePDFRawStream } from 'pdf-lib';
import {
  collectReachableRefs,
  deflateUnfilteredStreams,
  inlineStreamLengths,
  removePageThumbnails,
  removeUnreachableObjects,
  stripJpegImageMetadata,
  stripMetadata,
} from '../src/lib/pdf/compress/cleanup.ts';
import { mergeDuplicateStreams } from '../src/lib/pdf/compress/dedupe.ts';
import { readJpegInfo } from '../src/lib/image/jpeg-info.ts';
import { makeIccProfile, makeJpeg, segment } from './fixtures.ts';

const name = (value: string) => PDFName.of(value);

async function reload(doc: PDFDocument): Promise<PDFDocument> {
  return PDFDocument.load(await doc.save({ useObjectStreams: true, addDefaultPage: false }), { updateMetadata: false });
}

function countObjects(doc: PDFDocument): number {
  return doc.context.enumerateIndirectObjects().length;
}

test('removeUnreachableObjects deletes orphans, chains and cycles but keeps the document', async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([100, 100]);
  const context = doc.context;
  const kept = context.register(context.stream('0 0 m 10 10 l S'));
  page.node.set(name('Contents'), kept);

  const orphanLeaf = context.register(context.stream('orphan data'));
  context.register(context.obj({ Child: orphanLeaf })); // orphan -> orphan
  context.register(context.obj({ Page: page.ref })); // orphan pointing at a reachable object
  const cycleA = context.nextRef();
  const cycleB = context.register(context.obj({ Next: cycleA }));
  context.assign(cycleA, context.obj({ Next: cycleB }));
  context.register(context.obj({ Missing: PDFRef.of(9999) })); // dangling reference inside an orphan

  const before = countObjects(doc);
  const removed = removeUnreachableObjects(doc);
  assert.equal(removed, 6);
  assert.equal(countObjects(doc), before - 6);
  assert.ok(context.lookup(kept), 'content stream kept');
  assert.ok(context.lookup(page.ref), 'page kept');
  assert.equal(context.lookup(orphanLeaf), undefined);
  assert.equal(removeUnreachableObjects(doc), 0, 'idempotent');

  const loaded = await reload(doc);
  assert.equal(loaded.getPageCount(), 1);
  assert.equal(removeUnreachableObjects(loaded), 0, 'nothing unreachable after saving');
});

test('removeUnreachableObjects removes indirect /Length objects that saving would orphan', async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([100, 100]);
  const context = doc.context;
  const lengthRef = context.register(PDFNumber.of(5));
  const stream = PDFRawStream.of(context.obj({ Length: lengthRef }), new TextEncoder().encode('q Q\n '));
  page.node.set(name('Contents'), context.register(stream));
  assert.ok(collectReachableRefs(doc).has(lengthRef));
  assert.equal(removeUnreachableObjects(doc), 1);
  assert.equal((stream.dict.get(name('Length')) as PDFNumber).asNumber(), 5);
  inlineStreamLengths(doc); // no-op now
  assert.equal(context.lookup(lengthRef), undefined);
});

test('removeUnreachableObjects never empties a file without a catalog', async () => {
  const doc = await PDFDocument.create();
  delete doc.context.trailerInfo.Root;
  assert.equal(removeUnreachableObjects(doc), 0);
});

test('stripMetadata removes Info, XMP and PieceInfo; the file still loads', async () => {
  const doc = await PDFDocument.create();
  doc.setTitle('Quarterly report');
  doc.setAuthor('Jane Doe');
  doc.setSubject('Secret');
  doc.setKeywords(['a', 'b']);
  const page = doc.addPage([100, 100]);
  const context = doc.context;
  const xmp = context.register(context.stream('<x:xmpmeta>author</x:xmpmeta>', { Type: 'Metadata', Subtype: 'XML' }));
  doc.catalog.set(name('Metadata'), xmp);
  page.node.set(name('PieceInfo'), context.obj({ Illustrator: { Private: 'data' } }));
  const imageXmp = context.register(context.stream('<x:xmpmeta>camera</x:xmpmeta>', { Type: 'Metadata', Subtype: 'XML' }));
  const image = context.register(
    context.stream(new Uint8Array(3), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 1,
      Height: 1,
      BitsPerComponent: 8,
      ColorSpace: 'DeviceRGB',
      Metadata: imageXmp,
    }),
  );
  page.node.newXObject('Im', image);
  // A custom /Metadata key that is not an XMP stream is left alone.
  page.node.set(name('Metadata'), PDFNumber.of(3));

  stripMetadata(doc);
  const removed = removeUnreachableObjects(doc);
  assert.ok(removed >= 3, `Info dict and two XMP streams removed (got ${removed})`);
  assert.equal(context.trailerInfo.Info, undefined);
  assert.equal(doc.catalog.has(name('Metadata')), false);
  assert.equal(page.node.has(name('PieceInfo')), false);
  assert.equal((context.lookup(image) as PDFStream).dict.has(name('Metadata')), false);
  assert.ok(page.node.get(name('Metadata')) instanceof PDFNumber);

  const loaded = await reload(doc);
  assert.equal(loaded.context.trailerInfo.Info, undefined);
  assert.equal(loaded.getPageCount(), 1);
  const text = new TextDecoder('latin1').decode(await loaded.save({ useObjectStreams: false }));
  assert.ok(!text.includes('Quarterly report') && !text.includes('Jane Doe') && !text.includes('xmpmeta'));
});

test('removePageThumbnails drops /Thumb images', async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([100, 100]);
  doc.addPage([100, 100]);
  const context = doc.context;
  const thumb = context.register(
    context.stream(new Uint8Array(12), { Width: 2, Height: 2, BitsPerComponent: 8, ColorSpace: 'DeviceRGB' }),
  );
  page.node.set(name('Thumb'), thumb);
  assert.equal(removePageThumbnails(doc), 1);
  assert.equal(page.node.has(name('Thumb')), false);
  assert.equal(removeUnreachableObjects(doc), 1);
});

test('deflateUnfilteredStreams compresses plain streams losslessly but not XMP', async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([100, 100]);
  const context = doc.context;
  const content = 'q 1 0 0 1 10 10 cm 0 0 m 50 50 l S Q\n'.repeat(200);
  const contentRef = context.register(context.stream(content, { Custom: 'kept' }));
  page.node.set(name('Contents'), contentRef);
  const xmpText = `<x:xmpmeta>${' '.repeat(2000)}</x:xmpmeta>`;
  const xmp = context.register(context.stream(xmpText, { Type: 'Metadata', Subtype: 'XML' }));
  doc.catalog.set(name('Metadata'), xmp);
  const tiny = context.register(context.stream('q Q'));
  page.node.set(name('Tiny'), tiny);

  const result = deflateUnfilteredStreams(doc);
  assert.equal(result.streams, 1);
  assert.ok(result.bytesSaved > content.length / 2);

  const compressed = context.lookup(contentRef);
  assert.ok(compressed instanceof PDFRawStream);
  assert.equal(compressed.dict.get(name('Filter')), name('FlateDecode'));
  assert.equal(compressed.dict.get(name('Custom')), name('kept'));
  assert.equal(new TextDecoder().decode(decodePDFRawStream(compressed).decode()), content);
  assert.equal((context.lookup(xmp) as PDFRawStream).dict.has(name('Filter')), false);
  assert.equal((context.lookup(tiny) as PDFRawStream).dict.has(name('Filter')), false);
  assert.equal(deflateUnfilteredStreams(doc).streams, 0, 'already filtered streams are skipped');

  const loaded = await reload(doc);
  const reloaded = loaded.context.lookup(PDFRef.of(contentRef.objectNumber));
  assert.ok(reloaded instanceof PDFRawStream);
  assert.equal(new TextDecoder().decode(decodePDFRawStream(reloaded).decode()), content);
});

test('stripJpegImageMetadata drops Exif and comments from JPEG images, losslessly', async () => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  const photo = makeJpeg({ width: 40, height: 30, orientation: 6, beforeSof: segment(0xfe, [0x47, 0x50, 0x53]) });
  const image = (contents: Uint8Array, dict: Record<string, string | number | boolean | string[]> = {}) =>
    context.register(
      context.stream(contents, {
        Type: 'XObject',
        Subtype: 'Image',
        Width: 40,
        Height: 30,
        BitsPerComponent: 8,
        ColorSpace: 'DeviceRGB',
        Filter: 'DCTDecode',
        ...dict,
      }),
    );
  const withExif = image(photo, { Interpolate: true });
  const plain = image(makeJpeg({ width: 40, height: 30 }));
  const truncated = image(photo.subarray(0, photo.length - 2)); // no EOI: never rewritten
  const chained = image(photo, { Filter: ['ASCIIHexDecode', 'DCTDecode'] });
  const notImage = context.register(context.stream(photo, { Filter: 'DCTDecode' }));
  const untouched = [plain, truncated, chained, notImage].map((ref) => context.lookup(ref));

  assert.equal(stripJpegImageMetadata(doc), 1);
  const stripped = context.lookup(withExif);
  assert.ok(stripped instanceof PDFRawStream);
  const text = new TextDecoder('latin1').decode(stripped.contents);
  assert.ok(!text.includes('Exif') && !text.includes('GPS'), 'Exif and comment removed');
  assert.ok(text.includes('JFIF'), 'APP0 kept');
  const before = readJpegInfo(photo)!;
  const after = readJpegInfo(stripped.contents)!;
  assert.deepEqual({ ...after, orientation: before.orientation }, before, 'same frame header');
  assert.deepEqual(stripped.contents.subarray(-7), photo.subarray(-7), 'image data unchanged');
  assert.equal(stripped.dict.get(name('Interpolate'))?.toString(), 'true', 'other entries kept');
  assert.ok(
    [plain, truncated, chained, notImage].every((ref, index) => context.lookup(ref) === untouched[index]),
    'plain JPEGs, unreadable ones, filter chains and non-images are left as they are',
  );
  assert.equal(stripJpegImageMetadata(doc), 0, 'nothing left to remove');
});

test('mergeDuplicateStreams merges identical profiles, then the images using them', async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([100, 100]);
  const context = doc.context;
  const profile = makeIccProfile('RGB ', 'mntr', 500);
  const iccA = context.register(context.flateStream(profile, { N: 3 }));
  const iccB = context.register(context.flateStream(profile, { N: 3 }));
  const imageDict = (icc: PDFRef) => ({
    Type: 'XObject',
    Subtype: 'Image',
    Width: 4,
    Height: 4,
    BitsPerComponent: 8,
    ColorSpace: ['ICCBased', icc],
  });
  const pixels = new Uint8Array(48).fill(9);
  const imageA = context.register(context.stream(pixels, imageDict(iccA)));
  const imageB = context.register(context.stream(pixels.slice(), imageDict(iccB)));
  const keyA = page.node.newXObject('Im', imageA);
  const keyB = page.node.newXObject('Im', imageB);
  // Same bytes and dictionary but tied to the structure tree: kept separate.
  const tagged = context.register(context.stream(pixels.slice(), { ...imageDict(iccA), StructParent: 1 }));
  const taggedTwin = context.register(context.stream(pixels.slice(), { ...imageDict(iccA), StructParent: 1 }));
  page.node.newXObject('Im', tagged);
  page.node.newXObject('Im', taggedTwin);
  // Different bytes: kept.
  const other = context.register(context.stream(new Uint8Array(48).fill(10), imageDict(iccA)));
  page.node.newXObject('Im', other);

  assert.equal(mergeDuplicateStreams(doc), 2);
  const xObjects = page.node.Resources()!.lookup(name('XObject'), PDFDict);
  assert.equal(xObjects.get(keyA), xObjects.get(keyB));
  assert.equal(context.lookup(imageB) === undefined || context.lookup(imageA) === undefined, true);
  assert.equal(context.lookup(iccB) === undefined || context.lookup(iccA) === undefined, true);
  assert.ok(context.lookup(tagged) && context.lookup(taggedTwin) && context.lookup(other));
  assert.equal(mergeDuplicateStreams(doc), 0);
  assert.equal(removeUnreachableObjects(doc), 0, 'references were rewritten, nothing dangles');

  const loaded = await reload(doc);
  assert.equal(loaded.getPageCount(), 1);
});
