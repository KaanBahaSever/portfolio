import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertExifOrientation, isPdfPassthroughJpeg, readJpegInfo } from '../src/lib/image/jpeg-info.ts';
import type { JpegInfo } from '../src/lib/image/jpeg-info.ts';
import type { Orientation } from '../src/lib/image/orientation.ts';
import { bytesOf, exifPayload, makeJpeg, segment, sofSegment } from './fixtures.ts';

const ALL: Orientation[] = [1, 2, 3, 4, 5, 6, 7, 8];

function countExif(bytes: Uint8Array): number {
  const needle = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  let count = 0;
  for (let i = 0; i + needle.length <= bytes.length; i++) {
    if (needle.every((b, j) => bytes[i + j] === b)) count++;
  }
  return count;
}

test('reads SOF0 dimensions without EXIF', () => {
  const info = readJpegInfo(makeJpeg({ width: 640, height: 480 }));
  assert.deepEqual(info, {
    width: 640,
    height: 480,
    components: 3,
    bitsPerSample: 8,
    sofMarker: 0xc0,
    progressive: false,
    orientation: 1,
  });
  assert.ok(info && isPdfPassthroughJpeg(info));
});

test('reads EXIF orientation from little-endian (II) and big-endian (MM) TIFF', () => {
  for (const o of ALL) {
    assert.equal(readJpegInfo(makeJpeg({ width: 10, height: 20, orientation: o, little: true }))?.orientation, o, `II ${o}`);
    assert.equal(readJpegInfo(makeJpeg({ width: 10, height: 20, orientation: o, little: false }))?.orientation, o, `MM ${o}`);
  }
});

test('out-of-range orientation values normalize to 1', () => {
  assert.equal(readJpegInfo(makeJpeg({ width: 1, height: 1, orientation: 9 }))?.orientation, 1);
  assert.equal(readJpegInfo(makeJpeg({ width: 1, height: 1, orientation: 0, little: true }))?.orientation, 1);
});

test('insertExifOrientation round-trips all 8 orientations and replaces existing Exif', () => {
  const plain = makeJpeg({ width: 300, height: 200 });
  const withExif = makeJpeg({ width: 300, height: 200, orientation: 3, little: true });
  for (const o of ALL) {
    const a = insertExifOrientation(plain, o);
    assert.equal(readJpegInfo(a)?.orientation, o);
    assert.equal(readJpegInfo(a)?.width, 300);
    assert.equal(countExif(a), 1);

    const b = insertExifOrientation(withExif, o);
    assert.equal(readJpegInfo(b)?.orientation, o);
    assert.equal(countExif(b), 1, 'existing Exif APP1 is replaced, not duplicated');
    assert.equal(b.length, withExif.length - (4 + exifPayload(3, true).length) + 36);

    const twice = insertExifOrientation(insertExifOrientation(plain, 6), o);
    assert.equal(readJpegInfo(twice)?.orientation, o);
    assert.equal(countExif(twice), 1);
  }
  // Input is not mutated and the tail is preserved.
  assert.deepEqual(plain, makeJpeg({ width: 300, height: 200 }));
  const out = insertExifOrientation(plain, 8);
  assert.deepEqual(out.subarray(out.length - 20), plain.subarray(plain.length - 20));
  assert.throws(() => insertExifOrientation(Uint8Array.from([0x89, 0x50]), 1));
});

test('skips fill bytes and standalone markers', () => {
  const base = makeJpeg({ width: 33, height: 44, orientation: 6 });
  // Insert extra 0xFF fill bytes before the SOF marker, plus TEM and RST markers.
  const sofIndex = base.findIndex((b, i) => b === 0xff && base[i + 1] === 0xc0);
  const patched = Uint8Array.from([
    ...base.subarray(0, sofIndex),
    0xff, 0x01, // TEM
    0xff, 0xd3, // RST3
    0xff, 0xff, 0xff, // fill bytes (the SOF's own 0xFF follows)
    ...base.subarray(sofIndex),
  ]);
  const info = readJpegInfo(patched);
  assert.equal(info?.width, 33);
  assert.equal(info?.height, 44);
  assert.equal(info?.orientation, 6);
});

test('non-Exif APP1 (XMP) is skipped and a later Exif APP1 is used', () => {
  const xmp = segment(0xe1, [...bytesOf('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>')]);
  const bytes = Uint8Array.from([
    0xff, 0xd8,
    ...xmp,
    ...segment(0xe1, exifPayload(5, false)),
    ...sofSegment(0xc0, 8, 9),
    ...segment(0xda, [1, 1, 0, 0, 63, 0]),
    0xff, 0xd9,
  ]);
  assert.equal(readJpegInfo(bytes)?.orientation, 5);
});

test('DHT (C4), JPG (C8) and DAC (CC) are not frame headers', () => {
  const fakeFrame = [8, 0, 10, 0, 10, 3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0];
  const bytes = makeJpeg({
    width: 123,
    height: 45,
    beforeSof: [...segment(0xc4, fakeFrame), ...segment(0xc8, fakeFrame), ...segment(0xcc, fakeFrame)],
  });
  assert.equal(readJpegInfo(bytes)?.width, 123);
});

test('progressive (SOF2) is detected and is passthrough', () => {
  const info = readJpegInfo(makeJpeg({ width: 50, height: 60, sofMarker: 0xc2 }));
  assert.equal(info?.progressive, true);
  assert.equal(info?.sofMarker, 0xc2);
  assert.ok(info && isPdfPassthroughJpeg(info));
});

test('passthrough rules', () => {
  const base: JpegInfo = { width: 10, height: 10, components: 3, bitsPerSample: 8, sofMarker: 0xc0, progressive: false, orientation: 1 };
  assert.equal(isPdfPassthroughJpeg(base), true);
  assert.equal(isPdfPassthroughJpeg({ ...base, sofMarker: 0xc1 }), true);
  assert.equal(isPdfPassthroughJpeg({ ...base, components: 1 }), true);
  assert.equal(isPdfPassthroughJpeg({ ...base, components: 4 }), true);
  assert.equal(isPdfPassthroughJpeg({ ...base, components: 2 }), false);
  assert.equal(isPdfPassthroughJpeg({ ...base, bitsPerSample: 12 }), false);
  assert.equal(isPdfPassthroughJpeg({ ...base, sofMarker: 0xc3 }), false, 'lossless');
  assert.equal(isPdfPassthroughJpeg({ ...base, sofMarker: 0xc9 }), false, 'arithmetic');
  assert.equal(isPdfPassthroughJpeg({ ...base, width: 0 }), false);

  const twelveBit = readJpegInfo(makeJpeg({ width: 10, height: 10, sofMarker: 0xc1, bits: 12 }));
  assert.equal(twelveBit?.bitsPerSample, 12);
  assert.ok(twelveBit && !isPdfPassthroughJpeg(twelveBit));
});

test('returns null for truncated or invalid data', () => {
  const full = makeJpeg({ width: 100, height: 100, orientation: 6 });
  const sofIndex = full.findIndex((b, i) => b === 0xff && full[i + 1] === 0xc0);
  assert.equal(readJpegInfo(full.subarray(0, sofIndex)), null, 'truncated before SOF');
  assert.equal(readJpegInfo(full.subarray(0, sofIndex + 6)), null, 'truncated inside SOF');
  assert.ok(readJpegInfo(full.subarray(0, sofIndex + 10)), 'SOF header complete');
  assert.equal(readJpegInfo(full.subarray(0, 3)), null);
  assert.equal(readJpegInfo(new Uint8Array(0)), null);
  assert.equal(readJpegInfo(Uint8Array.from([0x00, 0xd8, 0xff, 0xc0])), null, 'no SOI');
  assert.equal(readJpegInfo(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])), null, 'EOI without SOF');
  assert.equal(
    readJpegInfo(Uint8Array.from([0xff, 0xd8, ...segment(0xda, [1, 1, 0, 0, 63, 0]), ...sofSegment(0xc0, 5, 5)])),
    null,
    'SOS before SOF',
  );
  assert.equal(readJpegInfo(makeJpeg({ width: 100, height: 0 })), null, 'height 0 (DNL)');
  assert.equal(readJpegInfo(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0xff, 0xc0])), null, 'length < 2');
  assert.equal(readJpegInfo(Uint8Array.from([0xff, 0xd8, 0x00, 0x00, 0xff, 0xc0])), null, 'garbage between segments');
});

test('never hangs or throws on random input', () => {
  let seed = 12345;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let n = 0; n < 3000; n++) {
    const length = Math.floor(random() * 200);
    const bytes = new Uint8Array(length + 2);
    bytes[0] = 0xff;
    bytes[1] = 0xd8;
    for (let i = 2; i < bytes.length; i++) bytes[i] = random() < 0.3 ? 0xff : Math.floor(random() * 256);
    const info = readJpegInfo(bytes);
    if (info) assert.ok(info.width > 0 && info.height > 0);
  }
});
