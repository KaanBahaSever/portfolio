/**
 * PNG facts the Images to PDF tool needs before handing a PNG to pdf-lib unchanged: whether
 * pdf-lib decodes it correctly, and which colour profile it carries. Pure: no DOM, runs under Node.
 *
 * The header fields come from readPngInfo() in sniff.ts (shared with the Image compressor);
 * this module adds the colour chunks, which only a PDF embedder cares about.
 */

import type { PngInfo } from './sniff.ts';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

export interface PngColorChunks {
  /** An sRGB chunk appears before the image data (it overrides any iCCP profile). */
  hasSrgbChunk: boolean;
  /** zlib-compressed ICC profile from the iCCP chunk, as a view into the input. */
  compressedIccProfile: Uint8Array | null;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = '';
  for (let i = start; i < start + length; i++) out += String.fromCharCode(bytes[i]!);
  return out;
}

/**
 * Reads the sRGB and iCCP chunks before the first IDAT. Needs the whole PNG (or at least
 * everything up to IDAT). Returns null when the bytes are not a PNG with a leading IHDR chunk.
 * A malformed iCCP chunk (no name terminator, unknown compression method) is ignored.
 */
export function readPngColorChunks(bytes: Uint8Array): PngColorChunks | null {
  if (bytes.length < 29 || PNG_SIGNATURE.some((byte, i) => bytes[i] !== byte) || ascii(bytes, 12, 4) !== 'IHDR') {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const result: PngColorChunks = { hasSrgbChunk: false, compressedIccProfile: null };

  // Chunk layout: length (4) + type (4) + data (length) + CRC (4).
  for (let pos = 8; pos + 8 <= bytes.length; ) {
    const length = view.getUint32(pos);
    const type = ascii(bytes, pos + 4, 4);
    const dataStart = pos + 8;
    const dataEnd = dataStart + length;
    if (type === 'IDAT' || type === 'IEND' || dataEnd + 4 > bytes.length) break;
    if (type === 'sRGB') result.hasSrgbChunk = true;
    else if (type === 'iCCP') {
      // Profile name (1–79 bytes), NUL, compression method 0, zlib data.
      const nul = bytes.subarray(dataStart, Math.min(dataEnd, dataStart + 80)).indexOf(0);
      if (nul >= 1 && dataStart + nul + 2 < dataEnd && bytes[dataStart + nul + 1] === 0) {
        result.compressedIccProfile = bytes.subarray(dataStart + nul + 2, dataEnd);
      }
    }
    pos = dataEnd + 4;
  }
  return result;
}

/**
 * Whether pdf-lib 1.17.1's PNG decoder (UPNG) reads this PNG correctly. It silently
 * mis-decodes Adam7-interlaced images below 8 bits per sample (the bottom rows are cut
 * off) and the transparent colour of grayscale images (tRNS with color type 0).
 */
export function isPdfLibSafePng(info: Pick<PngInfo, 'bitDepth' | 'colorType' | 'interlace' | 'hasTransparencyChunk'>): boolean {
  if (info.interlace === 1 && info.bitDepth < 8) return false;
  if (info.colorType === 0 && info.hasTransparencyChunk) return false;
  return true;
}
