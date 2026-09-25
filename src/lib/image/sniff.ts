/**
 * Image format detection from magic bytes, plus the header facts the Image compressor needs
 * before it decodes anything (can the image be transparent? is it animated?). Pure: no DOM,
 * runs under Node.
 *
 * File.type comes from the file extension (or nothing at all on some mobile pickers and for
 * pasted images), so it is never trusted. Pass the first IMAGE_HEAD_BYTES of the file: 64
 * bytes identify every format, and the rest lets the PNG, WebP and GIF readers reach the
 * chunks that describe transparency and animation.
 */

import { readJpegInfo } from './jpeg-info.ts';

export type ImageFormat =
  | 'jpeg'
  | 'png'
  | 'gif'
  | 'webp'
  | 'bmp'
  | 'tiff'
  | 'ico'
  | 'avif'
  | 'heic'
  | 'jxl'
  | 'svg'
  | 'unknown';

/** How much of a file to read before calling the functions below. */
export const IMAGE_HEAD_BYTES = 64 * 1024;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JXL_CONTAINER = [0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a] as const;
/** BITMAPCOREHEADER, BITMAPINFOHEADER, the two Adobe variants, OS/2 v2, V4 and V5. */
const BMP_DIB_HEADER_SIZES = new Set([12, 40, 52, 56, 64, 108, 124]);
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

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function sniffIsoBmff(head: Uint8Array): ImageFormat | null {
  if (ascii(head, 4, 4) !== 'ftyp') return null;
  const boxSize = head.length >= 8 ? view(head).getUint32(0) : 0;
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

/** "BM" alone is too weak (any text file may start with it): also require a known DIB header size. */
function sniffBmp(head: Uint8Array): boolean {
  if (ascii(head, 0, 2) !== 'BM' || head.length < 18) return false;
  return BMP_DIB_HEADER_SIZES.has(view(head).getUint32(14, true));
}

/** ICONDIR: reserved 0, type 1 (icon), at least one entry whose reserved byte is 0. */
function sniffIco(head: Uint8Array): boolean {
  if (!startsWith(head, [0x00, 0x00, 0x01, 0x00]) || head.length < 22) return false;
  const count = view(head).getUint16(4, true);
  return count > 0 && head[9] === 0;
}

export function sniffImageFormat(head: Uint8Array): ImageFormat {
  if (startsWith(head, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(head, PNG_SIGNATURE)) return 'png';
  const gif = ascii(head, 0, 6);
  if (gif === 'GIF87a' || gif === 'GIF89a') return 'gif';
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WEBP') return 'webp';
  if (sniffBmp(head)) return 'bmp';
  // Little- and big-endian TIFF, classic (42) and BigTIFF (43).
  if (startsWith(head, [0x49, 0x49, 0x2a, 0x00]) || startsWith(head, [0x4d, 0x4d, 0x00, 0x2a])) return 'tiff';
  if (startsWith(head, [0x49, 0x49, 0x2b, 0x00]) || startsWith(head, [0x4d, 0x4d, 0x00, 0x2b])) return 'tiff';
  if (startsWith(head, [0xff, 0x0a]) || startsWith(head, JXL_CONTAINER)) return 'jxl';
  const isoFormat = sniffIsoBmff(head);
  if (isoFormat) return isoFormat;
  if (sniffIco(head)) return 'ico';
  if (sniffSvg(head)) return 'svg';
  return 'unknown';
}

/** The IANA media type of a detected format ('' for unknown). */
export function mimeOfFormat(format: ImageFormat): string {
  switch (format) {
    case 'jpeg':
      return 'image/jpeg';
    case 'svg':
      return 'image/svg+xml';
    case 'ico':
      return 'image/x-icon';
    case 'unknown':
      return '';
    default:
      return `image/${format}`;
  }
}

/**
 * Reads width/height from a PNG's IHDR chunk (needs the first 24 bytes).
 * Returns null when the bytes are not a PNG with a leading IHDR chunk.
 */
export function readPngDimensions(head: Uint8Array): { width: number; height: number } | null {
  if (!startsWith(head, PNG_SIGNATURE)) return null;
  if (head.length < 24 || ascii(head, 12, 4) !== 'IHDR') return null;
  const width = view(head).getUint32(16);
  const height = view(head).getUint32(20);
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
  /** An acTL chunk appears before the image data: an animated PNG (APNG). */
  hasAnimationChunk: boolean;
  /**
   * The chunk walk reached the image data, so the two flags above are final. False when the
   * bytes end first (a large ICC profile or text chunk can push IDAT past the head).
   */
  complete: boolean;
}

/**
 * Reads the IHDR fields and the ancillary chunks before the first IDAT.
 * Returns null when the bytes are not a PNG with a leading IHDR chunk.
 */
export function readPngInfo(bytes: Uint8Array): PngInfo | null {
  const size = readPngDimensions(bytes);
  if (!size || bytes.length < 29) return null;
  const data = view(bytes);
  const info: PngInfo = {
    ...size,
    bitDepth: bytes[24]!,
    colorType: bytes[25]!,
    interlace: bytes[28]!,
    hasTransparencyChunk: false,
    hasAnimationChunk: false,
    complete: false,
  };

  // Chunk layout: length (4) + type (4) + data (length) + CRC (4).
  for (let pos = 8; pos + 8 <= bytes.length; ) {
    const length = data.getUint32(pos);
    const type = ascii(bytes, pos + 4, 4);
    if (type === 'IDAT' || type === 'IEND') {
      info.complete = true;
      break;
    }
    const dataEnd = pos + 8 + length;
    if (dataEnd + 4 > bytes.length) break;
    if (type === 'tRNS') info.hasTransparencyChunk = true;
    else if (type === 'acTL') info.hasAnimationChunk = true;
    pos = dataEnd + 4;
  }
  return info;
}

export interface WebpFeatures {
  /** The bitstream may contain transparency (VP8L alpha bit or VP8X alpha flag). */
  alpha: boolean;
  animated: boolean;
}

/**
 * Reads the first chunk of a RIFF/WebP file: 'VP8 ' is lossy and always opaque, 'VP8L'
 * carries an alpha_is_used bit and 'VP8X' (extended) has alpha and animation flags.
 * Returns null for anything else.
 */
export function readWebpFeatures(head: Uint8Array): WebpFeatures | null {
  if (ascii(head, 0, 4) !== 'RIFF' || ascii(head, 8, 4) !== 'WEBP') return null;
  const chunk = ascii(head, 12, 4);
  if (chunk === 'VP8 ') return head.length >= 20 ? { alpha: false, animated: false } : null;
  if (chunk === 'VP8L') {
    // Signature 0x2f, then 14 bits width-1, 14 bits height-1, 1 bit alpha_is_used (LSB first).
    if (head.length < 25 || head[20] !== 0x2f) return null;
    const bits = view(head).getUint32(21, true);
    return { alpha: ((bits >>> 28) & 1) === 1, animated: false };
  }
  if (chunk === 'VP8X') {
    if (head.length < 21) return null;
    const flags = head[20]!;
    return { alpha: (flags & 0x10) !== 0, animated: (flags & 0x02) !== 0 };
  }
  return null;
}

/**
 * Whether the image can contain transparent pixels, judged from its header. False only when
 * the format rules it out (JPEG, opaque PNG colour types without tRNS, lossy WebP); a true
 * answer means "decode and look".
 */
export function mayHaveTransparency(format: ImageFormat, head: Uint8Array): boolean {
  switch (format) {
    case 'jpeg':
      return false;
    case 'png': {
      const info = readPngInfo(head);
      if (!info) return true;
      if (info.colorType === 4 || info.colorType === 6 || info.hasTransparencyChunk) return true;
      return !info.complete;
    }
    case 'webp':
      return readWebpFeatures(head)?.alpha ?? true;
    default:
      return true;
  }
}

/**
 * Pixel size stored in the header, before any EXIF rotation (the area is what matters for
 * memory). Null when the format or the bytes do not tell (HEIC, AVIF, TIFF, a JPEG whose
 * frame header lies beyond the head, …).
 */
export function readImageDimensions(format: ImageFormat, head: Uint8Array): { width: number; height: number } | null {
  const data = view(head);
  const result = (width: number, height: number) => (width > 0 && height > 0 ? { width, height } : null);
  switch (format) {
    case 'jpeg': {
      const info = readJpegInfo(head);
      return info ? result(info.width, info.height) : null;
    }
    case 'png':
      return readPngDimensions(head);
    case 'gif':
      return head.length >= 10 ? result(data.getUint16(6, true), data.getUint16(8, true)) : null;
    case 'bmp': {
      if (head.length < 26) return null;
      const dibSize = data.getUint32(14, true);
      if (dibSize === 12) return result(data.getUint16(18, true), data.getUint16(20, true));
      // Negative heights mean top-down row order.
      return result(Math.abs(data.getInt32(18, true)), Math.abs(data.getInt32(22, true)));
    }
    case 'webp': {
      const chunk = ascii(head, 12, 4);
      if (chunk === 'VP8 ' && head.length >= 30 && startsWith(head, [0x9d, 0x01, 0x2a], 23)) {
        return result(data.getUint16(26, true) & 0x3fff, data.getUint16(28, true) & 0x3fff);
      }
      if (chunk === 'VP8L' && head.length >= 25 && head[20] === 0x2f) {
        const bits = data.getUint32(21, true);
        return result((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
      }
      if (chunk === 'VP8X' && head.length >= 30) {
        const u24 = (offset: number) => head[offset]! | (head[offset + 1]! << 8) | (head[offset + 2]! << 16);
        return result(u24(24) + 1, u24(27) + 1);
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * The EXIF orientation of a JPEG (1 = upright, also for every other format). Browsers apply it
 * when they draw the image; the page only needs it to check that they really do.
 */
export function readOrientation(format: ImageFormat, head: Uint8Array): number {
  return format === 'jpeg' ? (readJpegInfo(head)?.orientation ?? 1) : 1;
}

export type Animation = 'yes' | 'no' | 'maybe';

/** Skips GIF data sub-blocks (size byte + data, ended by a 0 byte); -1 when the bytes run out. */
function skipGifSubBlocks(head: Uint8Array, pos: number): number {
  while (pos < head.length) {
    const size = head[pos]!;
    if (size === 0) return pos + 1;
    pos += size + 1;
  }
  return -1;
}

/**
 * Walks GIF blocks: a NETSCAPE2.0/ANIMEXTS1.0 looping extension or a second image means
 * animation; reaching the trailer after one image means a still image.
 */
function gifAnimation(head: Uint8Array): Animation {
  if (head.length < 13) return 'maybe';
  let pos = 13;
  const packed = head[10]!;
  if (packed & 0x80) pos += 3 * 2 ** ((packed & 0x07) + 1); // global colour table
  let images = 0;
  while (pos < head.length) {
    const introducer = head[pos]!;
    if (introducer === 0x3b) return 'no'; // trailer after at most one image
    if (introducer === 0x21) {
      // Extension: label, then sub-blocks. Application extensions start with an 11-byte identifier.
      const label = head[pos + 1];
      if (label === undefined) return 'maybe';
      if (label === 0xff && head[pos + 2] === 11) {
        const id = ascii(head, pos + 3, 11);
        if (id === 'NETSCAPE2.0' || id === 'ANIMEXTS1.0') return 'yes';
      }
      pos = skipGifSubBlocks(head, pos + 2);
    } else if (introducer === 0x2c) {
      images += 1;
      if (images > 1) return 'yes';
      if (pos + 10 > head.length) return 'maybe';
      const local = head[pos + 9]!;
      pos += 10;
      if (local & 0x80) pos += 3 * 2 ** ((local & 0x07) + 1); // local colour table
      pos = skipGifSubBlocks(head, pos + 1); // LZW minimum code size, then image data
    } else {
      return 'maybe'; // not a block we know: the file is damaged or the head was cut mid-block
    }
    if (pos < 0) return 'maybe';
  }
  return 'maybe';
}

/**
 * Whether the image is an animation, of which a canvas only ever sees the first frame.
 * 'maybe' when the head ends before the answer (large GIF frames) or the header is unusual.
 */
export function sniffAnimation(format: ImageFormat, head: Uint8Array): Animation {
  switch (format) {
    case 'gif':
      return gifAnimation(head);
    case 'png': {
      const info = readPngInfo(head);
      if (!info) return 'maybe';
      if (info.hasAnimationChunk) return 'yes';
      return info.complete ? 'no' : 'maybe';
    }
    case 'webp': {
      const features = readWebpFeatures(head);
      return features ? (features.animated ? 'yes' : 'no') : 'maybe';
    }
    case 'avif':
      // 'avis' is the AVIF image-sequence brand.
      return ascii(head, 8, 4) === 'avis' ? 'yes' : 'no';
    default:
      return 'no';
  }
}
