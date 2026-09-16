import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, decodePDFRawStream } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import { buildImagesPdf } from '../src/lib/pdf/build-images-pdf.ts';
import type { BuildOptions, PreparedImage } from '../src/lib/pdf/build-images-pdf.ts';
import { readJpegInfo } from '../src/lib/image/jpeg-info.ts';
import { MARGINS_PT, PAGE_SIZES } from '../src/lib/pdf/page-layout.ts';
import { makeIccProfile, makeJpeg, makePng } from './fixtures.ts';

const landscapeJpeg = makeJpeg({ width: 400, height: 300 });
const rotatedJpeg = makeJpeg({ width: 400, height: 300, orientation: 6 });
const png = makePng(20, 10, [0, 128, 255, 200]);

function jpegImage(bytes: Uint8Array): PreparedImage {
  const info = readJpegInfo(bytes);
  assert.ok(info);
  return { kind: 'jpeg', bytes, width: info.width, height: info.height, orientation: info.orientation };
}

const IMAGES: PreparedImage[] = [
  jpegImage(landscapeJpeg),
  jpegImage(rotatedJpeg),
  { kind: 'png', bytes: png, width: 20, height: 10, orientation: 1 },
];

async function build(options: BuildOptions, images = IMAGES) {
  const bytes = await buildImagesPdf({ count: images.length, getImage: async (i) => images[i]!, options });
  return { bytes, doc: await PDFDocument.load(bytes, { updateMetadata: false }) };
}

function contentText(doc: PDFDocument, page: PDFPage): string {
  const contents = page.node.Contents();
  const items = contents instanceof PDFArray ? contents.asArray() : [contents];
  let text = '';
  for (const item of items) {
    const stream = item instanceof PDFRef ? doc.context.lookup(item) : item;
    assert.ok(stream instanceof PDFRawStream, 'content stream is a raw stream after load');
    text += new TextDecoder().decode(decodePDFRawStream(stream).decode()) + '\n';
  }
  return text;
}

function pageImages(doc: PDFDocument, page: PDFPage): PDFRawStream[] {
  const xObjects = page.node.Resources()?.lookup(PDFName.of('XObject'), PDFDict);
  assert.ok(xObjects);
  return xObjects.values().map((ref) => {
    const stream = ref instanceof PDFRef ? doc.context.lookup(ref) : ref;
    assert.ok(stream instanceof PDFRawStream);
    return stream;
  });
}

function countImageObjects(doc: PDFDocument): number {
  return doc.context
    .enumerateIndirectObjects()
    .filter(([, object]) => object instanceof PDFRawStream && object.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'))
    .length;
}

function size(page: PDFPage): [number, number] {
  const { width, height } = page.getSize();
  return [Math.round(width * 100) / 100, Math.round(height * 100) / 100];
}

test('fit: one page per image, sized at 96 DPI with orientation applied', async () => {
  const { doc } = await build({ pageSize: 'fit', orientation: 'auto', margin: 'none', title: 'Holiday' });
  assert.equal(doc.getPageCount(), 3);
  const pages = doc.getPages();
  assert.deepEqual(size(pages[0]!), [300, 225]);
  assert.deepEqual(size(pages[1]!), [225, 300], 'orientation 6 swaps the page');
  assert.deepEqual(size(pages[2]!), [15, 7.5]);
  assert.equal(doc.getTitle(), 'Holiday');
  assert.equal(doc.getCreator(), 'Images to PDF (runs in your browser)');
  assert.equal(doc.getProducer(), 'pdf-lib');

  assert.match(contentText(doc, pages[0]!), /q\s+300 0 0 225 0 0 cm\s+\/\S+ Do\s+Q/);
  assert.match(contentText(doc, pages[1]!), /q\s+0 -300 225 0 0 300 cm\s+\/\S+ Do\s+Q/);
  assert.match(contentText(doc, pages[2]!), /15 0 0 7\.5 0 0 cm/);
});

test('JPEG bytes are embedded unchanged (DCTDecode passthrough) and PNG alpha becomes an SMask', async () => {
  const { doc } = await build({ pageSize: 'fit', orientation: 'auto', margin: 'none' });
  const pages = doc.getPages();
  const [jpegStream] = pageImages(doc, pages[1]!);
  assert.ok(jpegStream);
  assert.equal(jpegStream.dict.get(PDFName.of('Filter')), PDFName.of('DCTDecode'));
  assert.equal((jpegStream.dict.get(PDFName.of('Width')) as PDFNumber).asNumber(), 400, 'stored width');
  assert.equal((jpegStream.dict.get(PDFName.of('Height')) as PDFNumber).asNumber(), 300, 'stored height');
  assert.deepEqual(Buffer.from(jpegStream.contents), Buffer.from(rotatedJpeg));

  const [pngStream] = pageImages(doc, pages[2]!);
  assert.ok(pngStream?.dict.get(PDFName.of('SMask')) instanceof PDFRef);
  assert.equal(countImageObjects(doc), 3 + 1, 'three images plus one soft mask');
});

test('a4 with margins: auto orientation per image, image contained in the margin box', async () => {
  const { doc } = await build({ pageSize: 'a4', orientation: 'auto', margin: 'small' });
  const [w, h] = PAGE_SIZES.a4;
  const pages = doc.getPages();
  assert.deepEqual(size(pages[0]!), [h, w], 'landscape image -> landscape page');
  assert.deepEqual(size(pages[1]!), [w, h], 'rotated to portrait -> portrait page');
  assert.deepEqual(size(pages[2]!), [h, w]);

  // Page 2: displayed 300x400 in a (595.28 - 2m) x (841.89 - 2m) box.
  const m = MARGINS_PT.small;
  const scale = Math.min((w - 2 * m) / 300, (h - 2 * m) / 400);
  const width = 300 * scale;
  const height = 400 * scale;
  const x = m + (w - 2 * m - width) / 2;
  const y = m + (h - 2 * m - height) / 2;
  const r = (n: number) => String(Math.round(n * 10_000) / 10_000);
  const expected = `0 ${r(-height)} ${r(width)} 0 ${r(x)} ${r(y + height)} cm`;
  assert.ok(contentText(doc, pages[1]!).includes(expected), `expected "${expected}" in page 2 content`);
});

test('forced portrait keeps landscape images on portrait pages', async () => {
  const { doc } = await build({ pageSize: 'letter', orientation: 'portrait', margin: 'large' }, [IMAGES[0]!]);
  assert.deepEqual(size(doc.getPage(0)), [612, 792]);
});

test('reports progress and yields between images', async () => {
  const events: string[] = [];
  await buildImagesPdf({
    count: 3,
    getImage: async (i) => IMAGES[i]!,
    options: { pageSize: 'a4', orientation: 'auto', margin: 'none' },
    onProgress: (done, total, stage) => events.push(`${done}/${total}:${stage}`),
  });
  assert.deepEqual(events, ['1/3:embedding', '2/3:embedding', '3/3:embedding', '3/3:saving']);
});

test('an already-aborted signal rejects with AbortError', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    buildImagesPdf({
      count: 2,
      getImage: async (i) => {
        calls++;
        return IMAGES[i]!;
      },
      options: { pageSize: 'fit', orientation: 'auto', margin: 'none' },
      signal: controller.signal,
    }),
    { name: 'AbortError' },
  );
  assert.equal(calls, 0);
});

test('aborting mid-way rejects with AbortError', async () => {
  const controller = new AbortController();
  await assert.rejects(
    buildImagesPdf({
      count: 3,
      getImage: async (i) => {
        if (i === 1) controller.abort();
        return IMAGES[i]!;
      },
      options: { pageSize: 'fit', orientation: 'auto', margin: 'none' },
      signal: controller.signal,
    }),
    { name: 'AbortError' },
  );
});

test('getFallbackImage replaces an image that fails to embed', async () => {
  const corrupt: PreparedImage = { kind: 'png', bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]), width: 20, height: 10, orientation: 1 };
  const fallbackCalls: Array<{ index: number; error: unknown }> = [];
  const bytes = await buildImagesPdf({
    count: 2,
    getImage: async (i) => (i === 0 ? corrupt : IMAGES[0]!),
    getFallbackImage: async (index, error) => {
      fallbackCalls.push({ index, error });
      return { kind: 'png', bytes: makePng(8, 6), width: 8, height: 6, orientation: 1 };
    },
    options: { pageSize: 'fit', orientation: 'auto', margin: 'none' },
  });
  assert.equal(fallbackCalls.length, 1);
  assert.equal(fallbackCalls[0]!.index, 0);
  assert.ok(fallbackCalls[0]!.error instanceof Error);
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 2);
  assert.deepEqual(size(doc.getPage(0)), [6, 4.5]);
  assert.equal(countImageObjects(doc), 2, 'no orphaned image objects');
});

test('a JPEG whose parsed size disagrees with the prepared size uses the fallback', async () => {
  const lying: PreparedImage = { ...IMAGES[0]!, width: 401 };
  let fallbackUsed = false;
  const bytes = await buildImagesPdf({
    count: 1,
    getImage: async () => lying,
    getFallbackImage: async () => {
      fallbackUsed = true;
      return IMAGES[0]!;
    },
    options: { pageSize: 'fit', orientation: 'auto', margin: 'none' },
  });
  assert.ok(fallbackUsed);
  const doc = await PDFDocument.load(bytes);
  assert.equal(countImageObjects(doc), 1);
});

test('embedding errors propagate without a fallback', async () => {
  await assert.rejects(
    buildImagesPdf({
      count: 1,
      getImage: async () => ({ kind: 'jpeg', bytes: Uint8Array.from([1, 2, 3, 4]), width: 1, height: 1, orientation: 1 }),
      options: { pageSize: 'fit', orientation: 'auto', margin: 'none' },
    }),
  );
});

test('Node Buffer views with a non-zero byteOffset are handled', async () => {
  const pooled = Buffer.concat([Buffer.alloc(7), Buffer.from(landscapeJpeg)]).subarray(7);
  assert.notEqual(pooled.byteOffset, 0);
  const bytes = await buildImagesPdf({
    count: 1,
    getImage: async () => ({ ...IMAGES[0]!, bytes: pooled }),
    options: { pageSize: 'fit', orientation: 'auto', margin: 'none' },
  });
  const doc = await PDFDocument.load(bytes);
  assert.deepEqual(size(doc.getPage(0)), [300, 225]);
});

function colorSpaceOf(doc: PDFDocument, stream: PDFRawStream): { name?: string; profile?: PDFRawStream } {
  const value = stream.dict.get(PDFName.of('ColorSpace'));
  if (value instanceof PDFName) return { name: value.asString().slice(1) };
  assert.ok(value instanceof PDFArray, 'ColorSpace is a name or an array');
  assert.equal(value.get(0), PDFName.of('ICCBased'));
  const profile = doc.context.lookup(value.get(1));
  assert.ok(profile instanceof PDFRawStream);
  return { name: 'ICCBased', profile };
}

test('ICC profiles become an ICCBased colour space, stored once per distinct profile', async () => {
  const p3 = makeIccProfile('RGB ', 'mntr', 200);
  const adobe = makeIccProfile('RGB ', 'mntr', 300);
  const images: PreparedImage[] = [
    { ...jpegImage(landscapeJpeg), icc: p3 },
    { ...jpegImage(rotatedJpeg), icc: p3.slice() },
    { kind: 'png', bytes: png, width: 20, height: 10, orientation: 1, icc: adobe },
  ];
  const { doc } = await build({ pageSize: 'fit', orientation: 'auto', margin: 'none' }, images);
  const [first, second, third] = doc.getPages().map((page) => colorSpaceOf(doc, pageImages(doc, page)[0]!));

  assert.equal(first!.name, 'ICCBased');
  assert.equal(first!.profile, second!.profile, 'identical profiles share one stream');
  assert.notEqual(first!.profile, third!.profile);
  const dict = first!.profile!.dict;
  assert.equal((dict.get(PDFName.of('N')) as PDFNumber).asNumber(), 3);
  assert.equal(dict.get(PDFName.of('Alternate')), PDFName.of('DeviceRGB'));
  assert.deepEqual(Buffer.from(decodePDFRawStream(first!.profile!).decode()), Buffer.from(p3));
  assert.deepEqual(Buffer.from(decodePDFRawStream(third!.profile!).decode()), Buffer.from(adobe));
  assert.equal(countImageObjects(doc), 3 + 1, 'image data is unchanged: three images plus the PNG soft mask');
});

test('ICC profiles that do not match the image components are ignored', async () => {
  const images: PreparedImage[] = [
    { ...jpegImage(landscapeJpeg), icc: makeIccProfile('GRAY') },
    { ...jpegImage(makeJpeg({ width: 10, height: 10, components: 1 })), icc: makeIccProfile('GRAY', 'mntr', 16) },
    { kind: 'png', bytes: png, width: 20, height: 10, orientation: 1, icc: makeIccProfile('CMYK', 'prtr') },
    { ...jpegImage(landscapeJpeg), icc: Uint8Array.from([1, 2, 3]) },
  ];
  const { doc } = await build({ pageSize: 'fit', orientation: 'auto', margin: 'none' }, images);
  const spaces = doc.getPages().map((page) => colorSpaceOf(doc, pageImages(doc, page)[0]!));
  assert.equal(spaces[0]!.name, 'DeviceRGB', 'gray profile on an RGB JPEG');
  assert.equal(spaces[1]!.name, 'ICCBased', 'gray profile on a gray JPEG');
  assert.equal((spaces[1]!.profile!.dict.get(PDFName.of('N')) as PDFNumber).asNumber(), 1);
  assert.equal(spaces[1]!.profile!.dict.get(PDFName.of('Alternate')), PDFName.of('DeviceGray'));
  assert.equal(spaces[2]!.name, 'DeviceRGB', 'CMYK profile on a PNG');
  assert.equal(spaces[3]!.name, 'DeviceRGB', 'invalid profile');
});

test('objectsPerTick: Infinity saves without yielding', async () => {
  const bytes = await buildImagesPdf({
    count: 3,
    getImage: async (i) => IMAGES[i]!,
    options: { pageSize: 'a4', orientation: 'auto', margin: 'small' },
    objectsPerTick: Infinity,
  });
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 3);
});
