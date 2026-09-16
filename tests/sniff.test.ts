import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { isPdfLibSafePng, readPngDimensions, readPngInfo, sniffImageFormat } from '../src/lib/image/sniff.ts';
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

test('detects raster formats by magic bytes', () => {
  assert.equal(sniffImageFormat(makeJpeg({ width: 4, height: 4 })), 'jpeg');
  assert.equal(sniffImageFormat(makePng(2, 2)), 'png');
  assert.equal(sniffImageFormat(bytesOf('GIF87a\x01\x00\x01\x00')), 'gif');
  assert.equal(sniffImageFormat(bytesOf('GIF89a\x01\x00\x01\x00')), 'gif');
  assert.equal(sniffImageFormat(bytesOf('RIFF\x24\x00\x00\x00WEBPVP8 ')), 'webp');
  assert.equal(sniffImageFormat(bytesOf('BM\x3a\x00\x00\x00')), 'bmp');
});

test('does not confuse near-misses', () => {
  assert.equal(sniffImageFormat(bytesOf('RIFF\x24\x00\x00\x00WAVEfmt ')), 'unknown');
  assert.equal(sniffImageFormat(Uint8Array.from([0xff, 0xd8])), 'unknown');
  assert.equal(sniffImageFormat(Uint8Array.from([0x89, 0x50, 0x4e, 0x47])), 'unknown');
  assert.equal(sniffImageFormat(bytesOf('GIF88a')), 'unknown');
  assert.equal(sniffImageFormat(bytesOf('%PDF-1.7')), 'unknown');
  assert.equal(sniffImageFormat(new Uint8Array(0)), 'unknown');
  assert.equal(sniffImageFormat(ftyp('isom', ['isom', 'mp41'])), 'unknown');
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

test('readPngDimensions reads IHDR', () => {
  assert.deepEqual(readPngDimensions(makePng(37, 5)), { width: 37, height: 5 });
  assert.equal(readPngDimensions(makeJpeg({ width: 1, height: 1 })), null);
  assert.equal(readPngDimensions(makePng(3, 3).subarray(0, 20)), null);
});

test('readPngInfo reads IHDR fields and chunks before IDAT', () => {
  const plain = readPngInfo(makePng(7, 3));
  assert.deepEqual(plain, {
    width: 7,
    height: 3,
    bitDepth: 8,
    colorType: 6,
    interlace: 0,
    hasTransparencyChunk: false,
    hasSrgbChunk: false,
    compressedIccProfile: null,
  });
  assert.ok(plain && isPdfLibSafePng(plain));

  const profile = Uint8Array.from([1, 2, 3, 4, 5, 6]);
  const compressed = deflateSync(profile);
  const withIcc = readPngInfo(
    makePngWithChunks({
      width: 9,
      height: 5,
      chunks: [['iCCP', Uint8Array.from([...bytesOf('Display P3'), 0, 0, ...compressed])]],
    }),
  );
  assert.equal(withIcc?.width, 9);
  assert.deepEqual(Buffer.from(withIcc!.compressedIccProfile!), compressed);
  assert.equal(withIcc?.hasSrgbChunk, false);

  const srgb = readPngInfo(makePngWithChunks({ chunks: [['sRGB', Uint8Array.from([0])]] }));
  assert.equal(srgb?.hasSrgbChunk, true);

  // Chunks after IDAT are not read (tRNS must precede IDAT).
  const png = makePngWithChunks({});
  const trailing = Uint8Array.from([...png.subarray(0, png.length - 12), 0, 0, 0, 1, ...bytesOf('tRNS'), 0, 0, 0, 0, 0]);
  assert.equal(readPngInfo(trailing)?.hasTransparencyChunk, false);

  // Malformed iCCP (no NUL, bad compression method) is ignored.
  assert.equal(readPngInfo(makePngWithChunks({ chunks: [['iCCP', bytesOf('name-without-nul')]] }))?.compressedIccProfile, null);
  assert.equal(
    readPngInfo(makePngWithChunks({ chunks: [['iCCP', Uint8Array.from([...bytesOf('p'), 0, 1, ...compressed])]] }))?.compressedIccProfile,
    null,
  );

  assert.equal(readPngInfo(makeJpeg({ width: 1, height: 1 })), null);
  assert.equal(readPngInfo(makePng(3, 3).subarray(0, 28)), null);
  // A truncated chunk stops the walk instead of throwing.
  assert.equal(readPngInfo(makePngWithChunks({ chunks: [['tEXt', bytesOf('a'.repeat(40))]] }).subarray(0, 60))?.width, 4);
});

test('isPdfLibSafePng flags PNGs pdf-lib decodes incorrectly', () => {  const safe = (options: Parameters<typeof makePngWithChunks>[0]) => isPdfLibSafePng(readPngInfo(makePngWithChunks(options))!);

  assert.equal(safe({ colorType: 3, bitDepth: 1, interlace: 1 }), false, 'interlaced 1-bit palette');
  assert.equal(safe({ colorType: 3, bitDepth: 4, interlace: 1 }), false, 'interlaced 4-bit palette');
  assert.equal(safe({ colorType: 0, bitDepth: 2, interlace: 1 }), false, 'interlaced 2-bit gray');
  assert.equal(safe({ colorType: 3, bitDepth: 8, interlace: 1 }), true, 'interlaced 8-bit');
  assert.equal(safe({ colorType: 3, bitDepth: 1, interlace: 0 }), true, 'non-interlaced 1-bit');
  assert.equal(safe({ colorType: 0, bitDepth: 8, chunks: [['tRNS', Uint8Array.from([0, 0])]] }), false, 'gray + tRNS');
  assert.equal(safe({ colorType: 0, bitDepth: 16, chunks: [['tRNS', Uint8Array.from([0, 9])]] }), false, '16-bit gray + tRNS');
  assert.equal(safe({ colorType: 0, bitDepth: 8 }), true, 'gray without tRNS');
  assert.equal(
    safe({ colorType: 3, bitDepth: 8, chunks: [['PLTE', Uint8Array.from([0, 0, 0])], ['tRNS', Uint8Array.from([0])]] }),
    true,
    'palette + tRNS',
  );
  assert.equal(safe({ colorType: 2, bitDepth: 8, chunks: [['tRNS', Uint8Array.from([0, 0, 0, 0, 0, 0])]] }), true, 'RGB + tRNS');
});
