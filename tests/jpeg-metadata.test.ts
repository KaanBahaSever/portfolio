import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JpegEmbedder } from 'pdf-lib';
import { extractJpegIccProfile, readJpegInfo, stripJpegForPdf } from '../src/lib/image/jpeg-info.ts';
import { bytesOf, exifPayload, iccSegments, makeIccProfile, makeJpeg, segment, sofSegment } from './fixtures.ts';

function contains(haystack: Uint8Array, needle: Uint8Array): boolean {
  return Buffer.from(haystack).includes(Buffer.from(needle));
}

const JFIF = segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const ADOBE = segment(0xee, [...bytesOf('Adobe'), 0, 100, 0, 0, 0, 0, 1]);
const DQT = segment(0xdb, [0x00, ...new Array<number>(64).fill(1)]);
const DHT = segment(0xc4, [0x00, 1, ...new Array<number>(15).fill(0), 0]);
const SOS = segment(0xda, [3, 1, 0x00, 2, 0x00, 3, 0x00, 0, 63, 0]);
const GPS = bytesOf('GPSLatitude=41.0082N');
const XMP = segment(0xe1, [...bytesOf('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>secret</x:xmpmeta>')]);
const IPTC = segment(0xed, [...bytesOf('Photoshop 3.0\0byline')]);
const COM = segment(0xfe, [...bytesOf('camera serial 1234')]);
const MOTION_PHOTO_TRAILER = [0x00, 0x00, 0x00, 0x18, ...bytesOf('ftypmp42'), 0xff, 0xd8, 0xff, 0xd9];

test('extractJpegIccProfile reassembles APP2 chunks in sequence order', () => {
  const profile = makeIccProfile('RGB ', 'mntr', 400);
  const [first, second, third] = iccSegments(profile, 3);
  const jpeg = Uint8Array.from([0xff, 0xd8, ...JFIF, ...third!, ...first!, ...second!, ...sofSegment(0xc0, 8, 8), ...SOS, 0x12, 0xff, 0xd9]);
  assert.deepEqual(extractJpegIccProfile(jpeg), profile);

  const single = Uint8Array.from([0xff, 0xd8, ...iccSegments(profile)[0]!, ...sofSegment(0xc0, 8, 8), ...SOS, 0xff, 0xd9]);
  assert.deepEqual(extractJpegIccProfile(single), profile);
});

test('extractJpegIccProfile rejects missing, incomplete or truncated profiles', () => {
  const profile = makeIccProfile('RGB ', 'mntr', 300);
  const [first, second] = iccSegments(profile, 2);
  const tail = [...sofSegment(0xc0, 8, 8), ...SOS, 0xff, 0xd9];
  assert.equal(extractJpegIccProfile(makeJpeg({ width: 8, height: 8, orientation: 6 })), null, 'no APP2');
  assert.equal(extractJpegIccProfile(Uint8Array.from([0xff, 0xd8, ...first!, ...tail])), null, 'chunk 2 of 2 missing');
  assert.equal(extractJpegIccProfile(Uint8Array.from([0xff, 0xd8, ...first!, ...first!, ...tail])), null, 'duplicate chunk');
  const mpf = segment(0xe2, [...bytesOf('MPF\0'), 1, 2, 3, 4]);
  assert.equal(extractJpegIccProfile(Uint8Array.from([0xff, 0xd8, ...mpf, ...tail])), null, 'other APP2 data');
  const joined = Uint8Array.from([0xff, 0xd8, ...first!, ...second!]);
  assert.equal(extractJpegIccProfile(joined.subarray(0, joined.length - 10)), null, 'truncated segment');
  assert.equal(extractJpegIccProfile(Uint8Array.from([0x89, 0x50, 0x4e, 0x47])), null, 'not a JPEG');
});

test('stripJpegForPdf removes metadata segments and data after EOI, keeping the image data', async () => {
  const exif = segment(0xe1, [...exifPayload(6, false), ...GPS]);
  const icc = iccSegments(makeIccProfile('RGB ', 'mntr', 64))[0]!;
  const scan = [0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd3, 0x78];
  const original = Uint8Array.from([
    0xff, 0xd8,
    ...JFIF, ...exif, ...icc, ...XMP, ...IPTC, ...COM, ...ADOBE,
    ...DQT, ...sofSegment(0xc0, 640, 480), ...DHT, ...SOS, ...scan, 0xff, 0xd9,
    ...MOTION_PHOTO_TRAILER,
  ]);
  const expected = Uint8Array.from([
    0xff, 0xd8, ...JFIF, ...ADOBE, ...DQT, ...sofSegment(0xc0, 640, 480), ...DHT, ...SOS, ...scan, 0xff, 0xd9,
  ]);

  const stripped = stripJpegForPdf(original);
  assert.deepEqual(stripped, expected);
  assert.ok(!contains(stripped, GPS), 'Exif GPS removed');
  assert.ok(!contains(stripped, bytesOf('secret')), 'XMP removed');
  assert.ok(!contains(stripped, bytesOf('byline')), 'IPTC removed');
  assert.ok(!contains(stripped, bytesOf('serial')), 'COM removed');
  assert.ok(!contains(stripped, bytesOf('ftypmp42')), 'trailer removed');

  const before = readJpegInfo(original);
  const after = readJpegInfo(stripped);
  assert.deepEqual({ ...after, orientation: before?.orientation }, before, 'same frame header');
  const embedder = await JpegEmbedder.for(stripped);
  assert.equal(embedder.width, 640);
  assert.equal(embedder.height, 480);
  assert.equal(original[0], 0xff, 'input is not modified');
  assert.ok(contains(original, GPS));
});

test('stripJpegForPdf follows progressive scans, stuffed bytes, restart markers and fill bytes', () => {
  const sos1 = segment(0xda, [1, 1, 0x00, 0, 0, 0]);
  const sos2 = segment(0xda, [1, 1, 0x00, 1, 63, 0]);
  const scan1 = [0x01, 0xff, 0x00, 0xff, 0x00, 0x02, 0xff, 0xd0, 0x03, 0xff, 0xd7, 0x04];
  const scan2 = [0x05, 0xff, 0x00, 0x06];
  const original = Uint8Array.from([
    0xff, 0xd8, ...JFIF, ...DQT, ...sofSegment(0xc2, 32, 16, 1), ...DHT,
    ...sos1, ...scan1,
    ...COM, // between scans: dropped
    ...DHT, ...segment(0xdd, [0, 4]), // DHT and DRI between scans: kept
    ...sos2, ...scan2,
    0xff, 0xff, 0xd9, // fill byte before EOI
    0x00, 0x11,
  ]);
  const expected = Uint8Array.from([
    0xff, 0xd8, ...JFIF, ...DQT, ...sofSegment(0xc2, 32, 16, 1), ...DHT,
    ...sos1, ...scan1,
    ...DHT, ...segment(0xdd, [0, 4]),
    ...sos2, ...scan2,
    0xff, 0xff, 0xd9,
  ]);
  assert.deepEqual(stripJpegForPdf(original), expected);
});

test('stripJpegForPdf returns the input when nothing can be removed or the stream is incomplete', () => {
  const clean = Uint8Array.from([0xff, 0xd8, ...JFIF, ...DQT, ...sofSegment(0xc0, 8, 8), ...DHT, ...SOS, 0x12, 0xff, 0xd9]);
  assert.equal(stripJpegForPdf(clean), clean, 'already minimal');

  const withExif = makeJpeg({ width: 8, height: 8, orientation: 3 });
  const noEoi = withExif.subarray(0, withExif.length - 2);
  assert.equal(stripJpegForPdf(noEoi), noEoi, 'no EOI: keep original bytes');
  const truncatedSegment = withExif.subarray(0, 30);
  assert.equal(stripJpegForPdf(truncatedSegment), truncatedSegment);
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(stripJpegForPdf(png), png);
  const garbage = Uint8Array.from([0xff, 0xd8, 0x00, 0x01, 0x02]);
  assert.equal(stripJpegForPdf(garbage), garbage);
});

test('stripJpegForPdf never hangs or throws on random input', () => {
  let seed = 987654;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let n = 0; n < 3000; n++) {
    const bytes = new Uint8Array(Math.floor(random() * 200) + 2);
    bytes[0] = 0xff;
    bytes[1] = 0xd8;
    for (let i = 2; i < bytes.length; i++) bytes[i] = random() < 0.3 ? 0xff : Math.floor(random() * 256);
    const out = stripJpegForPdf(bytes);
    assert.ok(out.length <= bytes.length);
    extractJpegIccProfile(bytes);
  }
});
