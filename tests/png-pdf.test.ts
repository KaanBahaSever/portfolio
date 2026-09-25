import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { isPdfLibSafePng, readPngColorChunks } from '../src/lib/image/png-pdf.ts';
import { readPngInfo } from '../src/lib/image/sniff.ts';
import { bytesOf, makeJpeg, makePng, makePngWithChunks } from './fixtures.ts';

test('readPngColorChunks reads the iCCP and sRGB chunks before IDAT', () => {
  assert.deepEqual(readPngColorChunks(makePng(7, 3)), { hasSrgbChunk: false, compressedIccProfile: null });

  const profile = Uint8Array.from([1, 2, 3, 4, 5, 6]);
  const compressed = deflateSync(profile);
  const withIcc = readPngColorChunks(
    makePngWithChunks({ width: 9, height: 5, chunks: [['iCCP', Uint8Array.from([...bytesOf('Display P3'), 0, 0, ...compressed])]] }),
  );
  assert.deepEqual(Buffer.from(withIcc!.compressedIccProfile!), compressed);
  assert.equal(withIcc?.hasSrgbChunk, false);

  assert.equal(readPngColorChunks(makePngWithChunks({ chunks: [['sRGB', Uint8Array.from([0])]] }))?.hasSrgbChunk, true);

  // Chunks after IDAT are not read.
  const png = makePngWithChunks({});
  const trailing = Uint8Array.from([...png.subarray(0, png.length - 12), 0, 0, 0, 1, ...bytesOf('sRGB'), 0, 0, 0, 0, 0]);
  assert.equal(readPngColorChunks(trailing)?.hasSrgbChunk, false);
});

test('readPngColorChunks ignores malformed iCCP chunks and rejects non-PNG input', () => {
  const compressed = deflateSync(Uint8Array.from([1, 2, 3]));
  assert.equal(readPngColorChunks(makePngWithChunks({ chunks: [['iCCP', bytesOf('name-without-nul')]] }))?.compressedIccProfile, null);
  assert.equal(
    readPngColorChunks(makePngWithChunks({ chunks: [['iCCP', Uint8Array.from([...bytesOf('p'), 0, 1, ...compressed])]] }))
      ?.compressedIccProfile,
    null,
    'unknown compression method',
  );
  assert.equal(readPngColorChunks(makeJpeg({ width: 1, height: 1 })), null);
  assert.equal(readPngColorChunks(makePng(3, 3).subarray(0, 28)), null);
  // A truncated chunk stops the walk instead of throwing.
  const cut = makePngWithChunks({ chunks: [['tEXt', bytesOf('a'.repeat(40))], ['sRGB', Uint8Array.from([0])]] }).subarray(0, 60);
  assert.deepEqual(readPngColorChunks(cut), { hasSrgbChunk: false, compressedIccProfile: null });
});

test('isPdfLibSafePng flags PNGs pdf-lib decodes incorrectly', () => {
  const safe = (options: Parameters<typeof makePngWithChunks>[0]) => isPdfLibSafePng(readPngInfo(makePngWithChunks(options))!);

  assert.equal(isPdfLibSafePng(readPngInfo(makePng(7, 3))!), true, 'plain RGBA');
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
