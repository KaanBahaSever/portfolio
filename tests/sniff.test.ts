import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mayHaveTransparency,
  mimeOfFormat,
  readImageDimensions,
  readOrientation,
  readPngDimensions,
  readPngInfo,
  readWebpFeatures,
  sniffAnimation,
  sniffImageFormat,
} from '../src/lib/image/sniff.ts';
import { bytesOf, makeJpeg, makePng, makePngWithChunks } from './fixtures.ts';

function ftyp(major: string, compatible: string[]): Uint8Array {
  const size = 16 + compatible.length * 4;
  const bytes = new Uint8Array(64);
  new DataView(bytes.buffer).setUint32(0, size);
  bytes.set(bytesOf('ftyp'), 4);
  bytes.set(bytesOf(major), 8);
  compatible.forEach((brand, i) => bytes.set(bytesOf(brand), 16 + i * 4));
  return bytes;
}

/** BITMAPFILEHEADER + the size field of a BITMAPINFOHEADER. */
function bmpHeader(dibSize = 40): Uint8Array {
  const bytes = new Uint8Array(54);
  bytes.set(bytesOf('BM'));
  new DataView(bytes.buffer).setUint32(14, dibSize, true);
  return bytes;
}

/** RIFF/WebP header with the first chunk's FourCC and payload bytes from offset 20. */
function webp(chunk: string, payload: number[]): Uint8Array {
  return Uint8Array.from([...bytesOf('RIFF'), 0x40, 0, 0, 0, ...bytesOf('WEBP'), ...bytesOf(chunk), 0x20, 0, 0, 0, ...payload]);
}

/** VP8L header: signature, 14-bit width-1 and height-1, alpha_is_used, version (little-endian bits). */
function vp8l(alpha: boolean): Uint8Array {
  const bits = (9 & 0x3fff) | ((9 & 0x3fff) << 14) | ((alpha ? 1 : 0) << 28);
  return webp('VP8L', [0x2f, bits & 0xff, (bits >>> 8) & 0xff, (bits >>> 16) & 0xff, (bits >>> 24) & 0xff]);
}

/** A small GIF: global colour table, optional looping extension, `frames` 1x1 images, trailer. */
function makeGif(options: { frames?: number; loop?: boolean; trailer?: boolean } = {}): Uint8Array {
  const bytes: number[] = [...bytesOf('GIF89a'), 1, 0, 1, 0, 0x80, 0, 0]; // 1x1, GCT of 2 colours
  bytes.push(0, 0, 0, 255, 255, 255);
  if (options.loop) bytes.push(0x21, 0xff, 11, ...bytesOf('NETSCAPE2.0'), 3, 1, 0, 0, 0);
  for (let i = 0; i < (options.frames ?? 1); i++) {
    bytes.push(0x21, 0xf9, 4, 0, 10, 0, 0, 0); // graphic control extension
    bytes.push(0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0); // image descriptor, no local colour table
    bytes.push(2, 2, 0x44, 0x01, 0); // LZW minimum code size, one data sub-block, terminator
  }
  if (options.trailer ?? true) bytes.push(0x3b);
  return Uint8Array.from(bytes);
}

test('detects raster formats by magic bytes', () => {
  assert.equal(sniffImageFormat(makeJpeg({ width: 4, height: 4 })), 'jpeg');
  assert.equal(sniffImageFormat(makePng(2, 2)), 'png');
  assert.equal(sniffImageFormat(bytesOf('GIF87a\x01\x00\x01\x00')), 'gif');
  assert.equal(sniffImageFormat(bytesOf('GIF89a\x01\x00\x01\x00')), 'gif');
  assert.equal(sniffImageFormat(bytesOf('RIFF\x24\x00\x00\x00WEBPVP8 ')), 'webp');
  assert.equal(sniffImageFormat(bmpHeader()), 'bmp');
  assert.equal(sniffImageFormat(bmpHeader(124)), 'bmp', 'BITMAPV5HEADER');
  assert.equal(sniffImageFormat(Uint8Array.from([0x49, 0x49, 0x2a, 0x00, 8, 0, 0, 0])), 'tiff');
  assert.equal(sniffImageFormat(Uint8Array.from([0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8])), 'tiff');
  assert.equal(sniffImageFormat(Uint8Array.from([0x49, 0x49, 0x2b, 0x00, 8, 0, 0, 0])), 'tiff', 'BigTIFF');
  assert.equal(sniffImageFormat(Uint8Array.from([0xff, 0x0a, 0xfa, 0x7f])), 'jxl');
  assert.equal(
    sniffImageFormat(Uint8Array.from([0, 0, 0, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a])),
    'jxl',
    'JPEG XL container',
  );
  const ico = new Uint8Array(22);
  ico.set([0, 0, 1, 0, 1, 0, 16, 16, 0, 0, 1, 0, 32, 0]);
  assert.equal(sniffImageFormat(ico), 'ico');
});

test('does not confuse near-misses', () => {
  assert.equal(sniffImageFormat(bytesOf('RIFF\x24\x00\x00\x00WAVEfmt ')), 'unknown');
  assert.equal(sniffImageFormat(Uint8Array.from([0xff, 0xd8])), 'unknown');
  assert.equal(sniffImageFormat(Uint8Array.from([0x89, 0x50, 0x4e, 0x47])), 'unknown');
  assert.equal(sniffImageFormat(bytesOf('GIF88a')), 'unknown');
  assert.equal(sniffImageFormat(bytesOf('%PDF-1.7')), 'unknown');
  assert.equal(sniffImageFormat(new Uint8Array(0)), 'unknown');
  assert.equal(sniffImageFormat(ftyp('isom', ['isom', 'mp41'])), 'unknown');
  // Text that happens to start with "BM" is not a bitmap.
  assert.equal(sniffImageFormat(bytesOf('BMW service log, 2024-05-01')), 'unknown');
  assert.equal(sniffImageFormat(bytesOf('BM\x3a\x00\x00\x00')), 'unknown', 'too short to be a BMP');
  // Leading zeros alone are not an icon.
  assert.equal(sniffImageFormat(new Uint8Array(32)), 'unknown');
  const noEntries = new Uint8Array(22);
  noEntries.set([0, 0, 1, 0, 0, 0]);
  assert.equal(sniffImageFormat(noEntries), 'unknown');
});

test('detects AVIF and HEIC from ftyp brands', () => {
  assert.equal(sniffImageFormat(ftyp('avif', ['mif1', 'miaf'])), 'avif');
  assert.equal(sniffImageFormat(ftyp('avis', ['msf1'])), 'avif');
  assert.equal(sniffImageFormat(ftyp('mif1', ['avif', 'miaf'])), 'avif', 'compatible avif brand, avif wins over mif1');
  assert.equal(sniffImageFormat(ftyp('heic', ['mif1', 'heic'])), 'heic');
  for (const brand of ['heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']) {
    assert.equal(sniffImageFormat(ftyp(brand, [])), 'heic', brand);
  }
  assert.equal(sniffImageFormat(ftyp('isom', ['heic'])), 'heic');
});

test('detects SVG with optional BOM and whitespace', () => {
  assert.equal(sniffImageFormat(bytesOf('<svg xmlns="http://www.w3.org/2000/svg">')), 'svg');
  assert.equal(sniffImageFormat(bytesOf('<?xml version="1.0"?><svg>')), 'svg');
  assert.equal(sniffImageFormat(bytesOf('\n\t  <svg>')), 'svg');
  assert.equal(sniffImageFormat(Uint8Array.from([0xef, 0xbb, 0xbf, ...bytesOf(' <svg>')])), 'svg');
  assert.equal(sniffImageFormat(bytesOf('<html><svg>')), 'unknown');
});

test('mimeOfFormat names the media type', () => {
  assert.equal(mimeOfFormat('jpeg'), 'image/jpeg');
  assert.equal(mimeOfFormat('png'), 'image/png');
  assert.equal(mimeOfFormat('webp'), 'image/webp');
  assert.equal(mimeOfFormat('svg'), 'image/svg+xml');
  assert.equal(mimeOfFormat('ico'), 'image/x-icon');
  assert.equal(mimeOfFormat('heic'), 'image/heic');
  assert.equal(mimeOfFormat('unknown'), '');
});

test('readPngDimensions reads IHDR', () => {
  assert.deepEqual(readPngDimensions(makePng(37, 5)), { width: 37, height: 5 });
  assert.equal(readPngDimensions(makeJpeg({ width: 1, height: 1 })), null);
  assert.equal(readPngDimensions(makePng(3, 3).subarray(0, 20)), null);
});

test('readPngInfo reads IHDR fields and the chunks before IDAT', () => {
  assert.deepEqual(readPngInfo(makePng(7, 3)), {
    width: 7,
    height: 3,
    bitDepth: 8,
    colorType: 6,
    interlace: 0,
    hasTransparencyChunk: false,
    hasAnimationChunk: false,
    complete: true,
  });

  const trns = readPngInfo(makePngWithChunks({ colorType: 2, chunks: [['tRNS', Uint8Array.from([0, 0, 0, 0, 0, 0])]] }));
  assert.equal(trns?.hasTransparencyChunk, true);
  const apng = readPngInfo(makePngWithChunks({ chunks: [['acTL', Uint8Array.from([0, 0, 0, 2, 0, 0, 0, 0])]] }));
  assert.equal(apng?.hasAnimationChunk, true);

  // Chunks after IDAT are not read (tRNS must precede IDAT).
  const png = makePngWithChunks({});
  const trailing = Uint8Array.from([...png.subarray(0, png.length - 12), 0, 0, 0, 1, ...bytesOf('tRNS'), 0, 0, 0, 0, 0]);
  assert.equal(readPngInfo(trailing)?.hasTransparencyChunk, false);

  assert.equal(readPngInfo(makeJpeg({ width: 1, height: 1 })), null);
  assert.equal(readPngInfo(makePng(3, 3).subarray(0, 28)), null);
  // A truncated chunk stops the walk instead of throwing, and the walk is incomplete.
  const cut = readPngInfo(makePngWithChunks({ chunks: [['tEXt', bytesOf('a'.repeat(40))]] }).subarray(0, 60));
  assert.equal(cut?.width, 4);
  assert.equal(cut?.complete, false);
});

test('readWebpFeatures reads the first chunk', () => {
  assert.deepEqual(readWebpFeatures(webp('VP8 ', [0x30, 0x01, 0x00, 0x9d])), { alpha: false, animated: false });
  assert.deepEqual(readWebpFeatures(vp8l(true)), { alpha: true, animated: false });
  assert.deepEqual(readWebpFeatures(vp8l(false)), { alpha: false, animated: false });
  assert.deepEqual(readWebpFeatures(webp('VP8X', [0x10, 0, 0, 0])), { alpha: true, animated: false });
  assert.deepEqual(readWebpFeatures(webp('VP8X', [0x02, 0, 0, 0])), { alpha: false, animated: true });
  assert.deepEqual(readWebpFeatures(webp('VP8X', [0x12, 0, 0, 0])), { alpha: true, animated: true });
  assert.equal(readWebpFeatures(webp('VP8L', [0x00, 0, 0, 0, 0])), null, 'bad VP8L signature');
  assert.equal(readWebpFeatures(webp('ABCD', [0, 0, 0, 0])), null);
  assert.equal(readWebpFeatures(makePng(1, 1)), null);
});

test('mayHaveTransparency rules out only formats that cannot be transparent', () => {
  assert.equal(mayHaveTransparency('jpeg', makeJpeg({ width: 2, height: 2 })), false);
  assert.equal(mayHaveTransparency('png', makePng(2, 2)), true, 'RGBA');
  assert.equal(mayHaveTransparency('png', makePngWithChunks({ colorType: 2 })), false, 'RGB');
  assert.equal(mayHaveTransparency('png', makePngWithChunks({ colorType: 0 })), false, 'gray');
  assert.equal(mayHaveTransparency('png', makePngWithChunks({ colorType: 4 })), true, 'gray + alpha');
  assert.equal(
    mayHaveTransparency('png', makePngWithChunks({ colorType: 3, chunks: [['PLTE', Uint8Array.from([0, 0, 0])], ['tRNS', Uint8Array.from([0])]] })),
    true,
    'palette + tRNS',
  );
  assert.equal(
    mayHaveTransparency('png', makePngWithChunks({ colorType: 2, chunks: [['iCCP', bytesOf('x'.repeat(200))]] }).subarray(0, 100)),
    true,
    'IDAT not reached: undecided, so decode and look',
  );
  assert.equal(mayHaveTransparency('webp', webp('VP8 ', [0, 0, 0, 0])), false);
  assert.equal(mayHaveTransparency('webp', vp8l(true)), true);
  assert.equal(mayHaveTransparency('webp', vp8l(false)), false);
  assert.equal(mayHaveTransparency('gif', makeGif()), true);
  assert.equal(mayHaveTransparency('avif', ftyp('avif', [])), true);
});

test('sniffAnimation tells stills from animations', () => {
  assert.equal(sniffAnimation('gif', makeGif()), 'no');
  assert.equal(sniffAnimation('gif', makeGif({ frames: 3 })), 'yes');
  assert.equal(sniffAnimation('gif', makeGif({ loop: true })), 'yes', 'NETSCAPE2.0 looping extension');
  assert.equal(sniffAnimation('gif', makeGif({ trailer: false })), 'maybe', 'head ends after the first frame');
  assert.equal(sniffAnimation('gif', makeGif().subarray(0, 20)), 'maybe', 'head ends inside the first frame');
  assert.equal(sniffAnimation('png', makePng(2, 2)), 'no');
  assert.equal(sniffAnimation('png', makePngWithChunks({ chunks: [['acTL', new Uint8Array(8)]] })), 'yes');
  assert.equal(sniffAnimation('webp', webp('VP8X', [0x02, 0, 0, 0])), 'yes');
  assert.equal(sniffAnimation('webp', webp('VP8 ', [0, 0, 0, 0])), 'no');
  assert.equal(sniffAnimation('avif', ftyp('avis', ['msf1'])), 'yes');
  assert.equal(sniffAnimation('avif', ftyp('avif', ['mif1'])), 'no');
  assert.equal(sniffAnimation('jpeg', makeJpeg({ width: 1, height: 1 })), 'no');
});

test('readImageDimensions reads the stored size from headers', () => {
  assert.deepEqual(readImageDimensions('jpeg', makeJpeg({ width: 640, height: 480 })), { width: 640, height: 480 });
  assert.deepEqual(readImageDimensions('png', makePng(37, 5)), { width: 37, height: 5 });
  assert.deepEqual(readImageDimensions('gif', makeGif()), { width: 1, height: 1 });

  const bmp = bmpHeader();
  new DataView(bmp.buffer).setInt32(18, 300, true);
  new DataView(bmp.buffer).setInt32(22, -200, true); // top-down rows
  assert.deepEqual(readImageDimensions('bmp', bmp), { width: 300, height: 200 });

  // VP8: frame tag, start code 9d 01 2a, 14-bit width and height.
  const lossy = webp('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, 0x80, 0x07, 0x38, 0x04]);
  assert.deepEqual(readImageDimensions('webp', lossy), { width: 1920, height: 1080 });
  assert.deepEqual(readImageDimensions('webp', vp8l(false)), { width: 10, height: 10 });
  // VP8X: flags, 3 reserved bytes, canvas width-1 and height-1 as 24-bit little-endian.
  const extended = webp('VP8X', [0x10, 0, 0, 0, 0x3f, 0x1f, 0x00, 0xff, 0x0f, 0x00]);
  assert.deepEqual(readImageDimensions('webp', extended), { width: 8000, height: 4096 });

  assert.equal(readImageDimensions('heic', ftyp('heic', [])), null);
  assert.equal(readImageDimensions('jpeg', makeJpeg({ width: 1, height: 1 }).subarray(0, 30)), null, 'SOF beyond the head');
  assert.equal(readImageDimensions('png', makePng(1, 1).subarray(0, 10)), null);
});

test('readOrientation reads EXIF orientation from JPEG only', () => {
  assert.equal(readOrientation('jpeg', makeJpeg({ width: 4, height: 2, orientation: 6 })), 6);
  assert.equal(readOrientation('jpeg', makeJpeg({ width: 4, height: 2, orientation: 3, little: true })), 3);
  assert.equal(readOrientation('jpeg', makeJpeg({ width: 4, height: 2 })), 1, 'no EXIF');
  assert.equal(readOrientation('jpeg', Uint8Array.from([0xff, 0xd8, 0xff])), 1, 'truncated');
  assert.equal(readOrientation('png', makePng(2, 2)), 1);
});
