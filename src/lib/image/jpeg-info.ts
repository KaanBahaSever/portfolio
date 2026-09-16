/**
 * Minimal JPEG marker walker: frame header (SOF) + EXIF orientation.
 * Pure: no DOM, runs under Node. Every read is bounds-checked and the cursor
 * strictly advances, so malformed input can never loop forever.
 */

import { normalizeOrientation } from './orientation.ts';
import type { Orientation } from './orientation.ts';

export interface JpegInfo {
  width: number;
  height: number;
  components: number;
  bitsPerSample: number;
  /** Marker code without the 0xFF prefix, e.g. 0xc0 (baseline), 0xc2 (progressive). */
  sofMarker: number;
  progressive: boolean;
  orientation: Orientation;
}

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const APP1 = 0xe1;
const TEM = 0x01;

// SOF0-3, SOF5-7, SOF9-11, SOF13-15. Excludes DHT (C4), JPG (C8) and DAC (CC).
const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
const PROGRESSIVE_SOF = new Set([0xc2, 0xc6, 0xca, 0xce]);

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
const ORIENTATION_TAG = 0x0112;

function isStandalone(marker: number): boolean {
  return marker === TEM || (marker >= 0xd0 && marker <= 0xd7);
}

function hasExifHeader(bytes: Uint8Array, start: number, end: number): boolean {
  if (end - start < EXIF_HEADER.length) return false;
  for (let i = 0; i < EXIF_HEADER.length; i++) {
    if (bytes[start + i] !== EXIF_HEADER[i]) return false;
  }
  return true;
}

/** Parses the orientation tag from an APP1 payload [start, end). Returns null if absent/invalid. */
function readExifOrientation(bytes: Uint8Array, start: number, end: number): Orientation | null {
  if (!hasExifHeader(bytes, start, end)) return null;
  const tiff = start + EXIF_HEADER.length;
  if (tiff + 8 > end) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let little: boolean;
  if (bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49) little = true;
  else if (bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d) little = false;
  else return null;
  if (view.getUint16(tiff + 2, little) !== 42) return null;

  const ifd0 = tiff + view.getUint32(tiff + 4, little);
  if (ifd0 < tiff + 8 || ifd0 + 2 > end) return null;
  const count = view.getUint16(ifd0, little);
  for (let i = 0; i < count; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > end) break;
    if (view.getUint16(entry, little) !== ORIENTATION_TAG) continue;
    const type = view.getUint16(entry + 2, little);
    if (type === 3) return normalizeOrientation(view.getUint16(entry + 8, little)); // SHORT
    if (type === 4) return normalizeOrientation(view.getUint32(entry + 8, little)); // LONG (lenient)
    return 1;
  }
  return null;
}

interface Segment {
  marker: number;
  /** Offset of the first 0xFF of the marker (fill bytes included). */
  markerStart: number;
  /** Offset of the payload (after the 2-byte length). */
  payloadStart: number;
  /** End of the segment as declared by its length (may exceed bytes.length when truncated). */
  end: number;
}

/**
 * Walks marker segments from just after SOI until SOS/EOI or malformed data.
 * The visitor returns true to stop.
 */
function walkSegments(bytes: Uint8Array, visit: (segment: Segment) => boolean): void {
  const len = bytes.length;
  let pos = 2;
  while (pos < len) {
    if (bytes[pos] !== 0xff) return; // not a marker: corrupt stream
    const markerStart = pos;
    while (pos < len && bytes[pos] === 0xff) pos++; // fill bytes
    if (pos >= len) return;
    const marker = bytes[pos]!;
    pos++;
    if (marker === 0x00 || marker === SOI) return; // invalid here
    if (isStandalone(marker)) continue;
    if (marker === EOI) {
      visit({ marker, markerStart, payloadStart: pos, end: pos });
      return;
    }
    if (pos + 2 > len) return; // truncated length
    const length = (bytes[pos]! << 8) | bytes[pos + 1]!;
    if (length < 2) return;
    const segment: Segment = { marker, markerStart, payloadStart: pos + 2, end: pos + length };
    if (visit(segment) || marker === SOS) return;
    pos += length; // length >= 2, so pos strictly increases
  }
}

export function readJpegInfo(bytes: Uint8Array): JpegInfo | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== SOI) return null;
  let orientation: Orientation = 1;
  let exifSeen = false;
  let info: JpegInfo | null = null;

  walkSegments(bytes, (segment) => {
    const { marker, payloadStart, end } = segment;
    if (marker === EOI || marker === SOS) return true;
    if (marker === APP1 && !exifSeen) {
      const found = readExifOrientation(bytes, payloadStart, Math.min(end, bytes.length));
      if (found !== null) {
        orientation = found;
        exifSeen = true;
      }
      return false;
    }
    if (SOF_MARKERS.has(marker)) {
      if (payloadStart + 6 > bytes.length || end < payloadStart + 6) return true; // truncated
      const bitsPerSample = bytes[payloadStart]!;
      const height = (bytes[payloadStart + 1]! << 8) | bytes[payloadStart + 2]!;
      const width = (bytes[payloadStart + 3]! << 8) | bytes[payloadStart + 4]!;
      const components = bytes[payloadStart + 5]!;
      if (height === 0 || width === 0) return true;
      info = {
        width,
        height,
        components,
        bitsPerSample,
        sofMarker: marker,
        progressive: PROGRESSIVE_SOF.has(marker),
        orientation,
      };
      return true;
    }
    return false;
  });

  return info;
}

/** JPEGs a PDF viewer can decode from the raw bytes (DCTDecode): baseline/extended/progressive Huffman, 8-bit. */
export function isPdfPassthroughJpeg(info: JpegInfo): boolean {
  return (
    (info.sofMarker === 0xc0 || info.sofMarker === 0xc1 || info.sofMarker === 0xc2) &&
    info.bitsPerSample === 8 &&
    (info.components === 1 || info.components === 3 || info.components === 4) &&
    info.width > 0 &&
    info.height > 0
  );
}

const APP2 = 0xe2;
const ICC_SIGNATURE = [0x49, 0x43, 0x43, 0x5f, 0x50, 0x52, 0x4f, 0x46, 0x49, 0x4c, 0x45, 0x00]; // "ICC_PROFILE\0"

/**
 * Reassembles the ICC profile stored in APP2 "ICC_PROFILE" chunks (in sequence order).
 * Returns null when there is none or the chunks are incomplete, duplicated or truncated.
 */
export function extractJpegIccProfile(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== SOI) return null;
  const chunks: Array<{ sequence: number; total: number; data: Uint8Array }> = [];
  let valid = true;
  walkSegments(bytes, ({ marker, payloadStart, end }) => {
    if (marker === EOI || marker === SOS) return true;
    if (marker !== APP2 || end - payloadStart < ICC_SIGNATURE.length + 2) return false;
    if (!ICC_SIGNATURE.every((byte, i) => bytes[payloadStart + i] === byte)) return false;
    if (end > bytes.length) {
      valid = false;
      return true;
    }
    const header = payloadStart + ICC_SIGNATURE.length;
    chunks.push({ sequence: bytes[header]!, total: bytes[header + 1]!, data: bytes.subarray(header + 2, end) });
    return false;
  });
  if (!valid || chunks.length === 0) return null;

  const total = chunks[0]!.total;
  if (total !== chunks.length || chunks.some((chunk) => chunk.total !== total)) return null;
  chunks.sort((a, b) => a.sequence - b.sequence);
  if (chunks.some((chunk, index) => chunk.sequence !== index + 1)) return null;

  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.data.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk.data, offset);
    offset += chunk.data.length;
  }
  return out.length > 0 ? out : null;
}

/**
 * Metadata segments a PDF DCTDecode stream does not need: APP1 (Exif/XMP, incl. GPS),
 * APP2 (ICC/MPF; the ICC profile goes into the PDF colour space instead), APP3–APP13
 * (e.g. IPTC in APP13), APP15 and COM. APP0 (JFIF) and APP14 (Adobe colour transform)
 * affect decoding and are kept, as is every marker not listed here.
 */
function isStrippableMarker(marker: number): boolean {
  return (marker >= 0xe1 && marker <= 0xed) || marker === 0xef || marker === 0xfe;
}

/**
 * Returns the JPEG without metadata segments and without anything after the EOI that
 * follows the image data (Motion Photo videos, MPF/gain-map images, padding). The
 * compressed image data itself is copied unchanged.
 *
 * Returns `bytes` itself when nothing can be removed, or when the stream cannot be
 * followed to its EOI (truncated or corrupt input is never "repaired").
 */
export function stripJpegForPdf(bytes: Uint8Array): Uint8Array {
  const len = bytes.length;
  if (len < 4 || bytes[0] !== 0xff || bytes[1] !== SOI) return bytes;

  const keep: Array<[number, number]> = [[0, 2]];
  let pos = 2;
  let inScan = false;
  let finished = false;

  while (pos < len) {
    if (inScan) {
      // Entropy-coded data: runs until a marker other than stuffed 0xFF00 or RSTn.
      const dataStart = pos;
      for (;;) {
        const ff = bytes.indexOf(0xff, pos);
        if (ff < 0 || ff + 1 >= len) return bytes; // no EOI
        const next = bytes[ff + 1]!;
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
          pos = ff + 2;
        } else if (next === 0xff) {
          pos = ff + 1; // fill byte before a marker
        } else {
          pos = ff;
          break;
        }
      }
      keep.push([dataStart, pos]);
      inScan = false;
    }

    if (bytes[pos] !== 0xff) return bytes; // not a marker: corrupt stream
    const markerStart = pos;
    while (pos < len && bytes[pos] === 0xff) pos++; // fill bytes
    if (pos >= len) return bytes;
    const marker = bytes[pos]!;
    pos++;
    if (marker === 0x00 || marker === SOI) return bytes;
    if (marker === EOI) {
      keep.push([markerStart, pos]);
      finished = true;
      break;
    }
    if (isStandalone(marker)) {
      keep.push([markerStart, pos]);
      continue;
    }
    if (pos + 2 > len) return bytes;
    const length = (bytes[pos]! << 8) | bytes[pos + 1]!;
    if (length < 2 || pos + length > len) return bytes;
    const end = pos + length;
    if (!isStrippableMarker(marker)) keep.push([markerStart, end]);
    pos = end;
    if (marker === SOS) inScan = true;
  }
  if (!finished) return bytes;

  const size = keep.reduce((sum, [start, end]) => sum + (end - start), 0);
  if (size === len) return bytes;
  const out = new Uint8Array(size);
  let offset = 0;
  for (const [start, end] of keep) {
    out.set(bytes.subarray(start, end), offset);
    offset += end - start;
  }
  return out;
}

function buildExifApp1(orientation: Orientation): Uint8Array {
  // "Exif\0\0" + big-endian TIFF header + IFD0 with one entry + next-IFD offset 0.
  const payload = [
    ...EXIF_HEADER,
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // MM, 42, IFD0 at 8
    0x00, 0x01, // 1 entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00, // 0x0112 SHORT x1
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ];
  const length = payload.length + 2;
  return Uint8Array.from([0xff, APP1, (length >> 8) & 0xff, length & 0xff, ...payload]);
}

/**
 * Returns a copy of `jpeg` with an APP1 Exif segment carrying `orientation`
 * inserted right after SOI. Existing Exif APP1 segments are removed.
 */
export function insertExifOrientation(jpeg: Uint8Array, orientation: Orientation): Uint8Array {
  if (jpeg.length < 2 || jpeg[0] !== 0xff || jpeg[1] !== SOI) {
    throw new Error('Not a JPEG: missing SOI marker');
  }
  const remove: Array<[number, number]> = [];
  walkSegments(jpeg, (segment) => {
    if (segment.marker === EOI || segment.marker === SOS) return true;
    if (segment.marker === APP1 && hasExifHeader(jpeg, segment.payloadStart, Math.min(segment.end, jpeg.length))) {
      remove.push([segment.markerStart, Math.min(segment.end, jpeg.length)]);
    }
    return false;
  });

  const app1 = buildExifApp1(normalizeOrientation(orientation));
  const removed = remove.reduce((sum, [start, end]) => sum + (end - start), 0);
  const out = new Uint8Array(jpeg.length - removed + app1.length);
  out.set(jpeg.subarray(0, 2), 0);
  out.set(app1, 2);
  let writeAt = 2 + app1.length;
  let readAt = 2;
  for (const [start, end] of remove) {
    out.set(jpeg.subarray(readAt, start), writeAt);
    writeAt += start - readAt;
    readAt = end;
  }
  out.set(jpeg.subarray(readAt), writeAt);
  return out;
}
