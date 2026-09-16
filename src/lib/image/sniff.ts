/**
 * Image format detection from magic bytes. Pure: no DOM, runs under Node.
 *
 * File.type comes from the file extension (or nothing at all on some mobile
 * pickers), so it is never trusted. Pass at least the first 64 bytes.
 */

export type ImageFormat =
  | 'jpeg'
  | 'png'
  | 'gif'
  | 'webp'
  | 'bmp'
  | 'avif'
  | 'heic'
  | 'svg'
  | 'unknown';

const AVIF_BRANDS = new Set(['avif', 'avis']);
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);

function ascii(bytes: Uint8Array, start: number, length: number): string {
  if (start < 0 || start + length > bytes.length) return '';
  let out = '';
  for (let i = start; i < start + length; i++) out += String.fromCharCode(bytes[i]!);
  return out;
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (offset + signature.length > bytes.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

function sniffIsoBmff(head: Uint8Array): ImageFormat | null {
  if (ascii(head, 4, 4) !== 'ftyp') return null;
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  const boxSize = head.length >= 8 ? view.getUint32(0) : 0;
  // Brands live in the ftyp box: major brand at 8, minor version at 12,
  // compatible brands from 16 until the end of the box (bounded by what we have).
  const end = Math.min(head.length, boxSize >= 16 ? boxSize : head.length);
  const brands: string[] = [];
  const major = ascii(head, 8, 4);
  if (major) brands.push(major);
  for (let offset = 16; offset + 4 <= end; offset += 4) brands.push(ascii(head, offset, 4));

  if (brands.some((brand) => AVIF_BRANDS.has(brand))) return 'avif';
  if (brands.some((brand) => HEIC_BRANDS.has(brand))) return 'heic';
  return null;
}

function sniffSvg(head: Uint8Array): boolean {
  let i = 0;
  if (startsWith(head, [0xef, 0xbb, 0xbf])) i = 3;
  // Skip ASCII whitespace (space, tab, CR, LF, FF).
  while (i < head.length && (head[i] === 0x20 || (head[i]! >= 0x09 && head[i]! <= 0x0d))) i++;
  const rest = ascii(head, i, Math.min(5, head.length - i));
  return rest === '<?xml' || rest.startsWith('<svg');
}

export function sniffImageFormat(head: Uint8Array): ImageFormat {
  if (startsWith(head, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  const gif = ascii(head, 0, 6);
  if (gif === 'GIF87a' || gif === 'GIF89a') return 'gif';
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WEBP') return 'webp';
  if (ascii(head, 0, 2) === 'BM') return 'bmp';
  const isoFormat = sniffIsoBmff(head);
  if (isoFormat) return isoFormat;
  if (sniffSvg(head)) return 'svg';
  return 'unknown';
}

/**
 * Reads width/height from a PNG's IHDR chunk (needs the first 24 bytes).
 * Returns null when the bytes are not a PNG with a leading IHDR chunk.
 */
export function readPngDimensions(head: Uint8Array): { width: number; height: number } | null {
  if (!startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return null;
  if (head.length < 24 || ascii(head, 12, 4) !== 'IHDR') return null;
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width === 0 || height === 0) return null;
  return { width, height };
}

export interface PngInfo {
  width: number;
  height: number;
  bitDepth: number;
  /** 0 gray, 2 RGB, 3 palette, 4 gray + alpha, 6 RGBA. */
  colorType: number;
  /** 0 none, 1 Adam7. */
  interlace: number;
  /** A tRNS chunk appears before the image data. */
  hasTransparencyChunk: boolean;
  /** An sRGB chunk appears before the image data (it overrides any iCCP profile). */
  hasSrgbChunk: boolean;
  /** zlib-compressed ICC profile from the iCCP chunk, as a view into the input. */
  compressedIccProfile: Uint8Array | null;
}

/**
 * Reads the IHDR fields and the ancillary chunks before the first IDAT.
 * Needs the whole PNG (or at least everything up to IDAT). Returns null when the
 * bytes are not a PNG with a leading IHDR chunk.
 */
export function readPngInfo(bytes: Uint8Array): PngInfo | null {
  const size = readPngDimensions(bytes);
  if (!size || bytes.length < 29) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const info: PngInfo = {
    ...size,
    bitDepth: bytes[24]!,
    colorType: bytes[25]!,
    interlace: bytes[28]!,
    hasTransparencyChunk: false,
    hasSrgbChunk: false,
    compressedIccProfile: null,
  };

  // Chunk layout: length (4) + type (4) + data (length) + CRC (4).
  for (let pos = 8; pos + 8 <= bytes.length; ) {
    const length = view.getUint32(pos);
    const type = ascii(bytes, pos + 4, 4);
    const dataStart = pos + 8;
    const dataEnd = dataStart + length;
    if (type === 'IDAT' || type === 'IEND' || dataEnd + 4 > bytes.length) break;
    if (type === 'tRNS') info.hasTransparencyChunk = true;
    else if (type === 'sRGB') info.hasSrgbChunk = true;
    else if (type === 'iCCP') {
      // Profile name (1–79 bytes), NUL, compression method 0, zlib data.
      const nul = bytes.subarray(dataStart, Math.min(dataEnd, dataStart + 80)).indexOf(0);
      if (nul >= 1 && dataStart + nul + 2 < dataEnd && bytes[dataStart + nul + 1] === 0) {
        info.compressedIccProfile = bytes.subarray(dataStart + nul + 2, dataEnd);
      }
    }
    pos = dataEnd + 4;
  }
  return info;
}

/**
 * Whether pdf-lib 1.17.1's PNG decoder (UPNG) reads this PNG correctly. It silently
 * mis-decodes Adam7-interlaced images below 8 bits per sample (the bottom rows are cut
 * off) and the transparent colour of grayscale images (tRNS with color type 0).
 */
export function isPdfLibSafePng(info: PngInfo): boolean {
  if (info.interlace === 1 && info.bitDepth < 8) return false;
  if (info.colorType === 0 && info.hasTransparencyChunk) return false;
  return true;
}
