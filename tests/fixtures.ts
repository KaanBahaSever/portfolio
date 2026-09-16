/**
 * Synthetic image builders for tests (not a test file itself).
 */

import { crc32, deflateSync } from 'node:zlib';

export function segment(marker: number, payload: readonly number[]): number[] {
  const length = payload.length + 2;
  return [0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload];
}

export function sofSegment(marker: number, width: number, height: number, components = 3, bits = 8): number[] {
  const payload = [bits, (height >> 8) & 0xff, height & 0xff, (width >> 8) & 0xff, width & 0xff, components];
  for (let i = 1; i <= components; i++) payload.push(i, 0x11, 0);
  return segment(marker, payload);
}

function u16(value: number, little: boolean): number[] {
  return little ? [value & 0xff, (value >> 8) & 0xff] : [(value >> 8) & 0xff, value & 0xff];
}

function u32(value: number, little: boolean): number[] {
  const be = [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
  return little ? be.reverse() : be;
}

/** APP1 Exif payload with a Make (ASCII) entry followed by Orientation (SHORT). */
export function exifPayload(orientation: number, little: boolean): number[] {
  const out: number[] = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  out.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42, little), ...u32(8, little));
  out.push(...u16(2, little));
  // 0x010F Make, ASCII, count 4, offset 38 (outside the IFD; value irrelevant here)
  out.push(...u16(0x010f, little), ...u16(2, little), ...u32(4, little), ...u32(38, little));
  // 0x0112 Orientation, SHORT, count 1, value left-justified in the 4-byte field
  out.push(...u16(0x0112, little), ...u16(3, little), ...u32(1, little), ...u16(orientation, little), 0, 0);
  out.push(...u32(0, little));
  out.push(0x41, 0x43, 0x4d, 0x00); // "ACM\0"
  return out;
}

export interface JpegOptions {
  width: number;
  height: number;
  orientation?: number;
  little?: boolean;
  sofMarker?: number;
  components?: number;
  bits?: number;
  /** Segments inserted between APP segments and SOF. */
  beforeSof?: number[];
}

/** Marker-level JPEG: enough for readJpegInfo and pdf-lib's JpegEmbedder (not a decodable image). */
export function makeJpeg(options: JpegOptions): Uint8Array {
  const bytes: number[] = [0xff, 0xd8];
  bytes.push(...segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]));
  if (options.orientation !== undefined) {
    bytes.push(...segment(0xe1, exifPayload(options.orientation, options.little ?? false)));
  }
  bytes.push(...segment(0xdb, [0x00, ...new Array<number>(64).fill(1)]));
  if (options.beforeSof) bytes.push(...options.beforeSof);
  bytes.push(
    ...sofSegment(options.sofMarker ?? 0xc0, options.width, options.height, options.components ?? 3, options.bits ?? 8),
  );
  bytes.push(...segment(0xc4, [0x00, 1, ...new Array<number>(15).fill(0), 0]));
  const components = options.components ?? 3;
  const sos = [components];
  for (let i = 1; i <= components; i++) sos.push(i, 0x00);
  sos.push(0, 63, 0);
  bytes.push(...segment(0xda, sos));
  bytes.push(0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd9);
  return Uint8Array.from(bytes);
}

function pngChunk(type: string, data: Uint8Array): Buffer {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])) >>> 0);
  return Buffer.concat([length, typeBytes, Buffer.from(data), crc]);
}

/** Real RGBA PNG (color type 6, 8-bit) filled with one color. */
export function makePng(width: number, height: number, rgba: [number, number, number, number] = [255, 0, 0, 255]): Uint8Array {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < width; x++) raw.set(rgba, row + 1 + x * 4);
  }
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const png = Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', new Uint8Array(0)),
  ]);
  // Copy into a standalone buffer (Node Buffers may share a pooled ArrayBuffer).
  return new Uint8Array(png);
}

export function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Minimal ICC profile: a valid 128-byte header plus an empty tag table. */
export function makeIccProfile(colorSpace: 'RGB ' | 'GRAY' | 'CMYK' | 'Lab ' = 'RGB ', deviceClass = 'mntr', padding = 0): Uint8Array {
  const size = 132 + padding;
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, size);
  bytes.set(bytesOf('test'), 4); // preferred CMM
  view.setUint32(8, 0x04300000); // version 4.3
  bytes.set(bytesOf(deviceClass), 12);
  bytes.set(bytesOf(colorSpace), 16);
  bytes.set(bytesOf('XYZ '), 20);
  bytes.set(bytesOf('acsp'), 36);
  for (let i = 0; i < padding; i++) bytes[132 + i] = (i * 31 + colorSpace.charCodeAt(0)) & 0xff;
  return bytes;
}

/** APP2 "ICC_PROFILE" segments carrying `profile` split into `parts` chunks. */
export function iccSegments(profile: Uint8Array, parts = 1): number[][] {
  const chunkSize = Math.ceil(profile.length / parts);
  const segments: number[][] = [];
  for (let i = 0; i < parts; i++) {
    const data = profile.subarray(i * chunkSize, (i + 1) * chunkSize);
    segments.push(segment(0xe2, [...bytesOf('ICC_PROFILE\0'), i + 1, parts, ...data]));
  }
  return segments;
}

/** Real PNG with arbitrary IHDR fields and extra chunks before IDAT (pixel data is not meaningful). */
export function makePngWithChunks(options: {
  width?: number;
  height?: number;
  bitDepth?: number;
  colorType?: number;
  interlace?: number;
  chunks?: Array<[string, Uint8Array]>;
}): Uint8Array {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(options.width ?? 4, 0);
  ihdr.writeUInt32BE(options.height ?? 4, 4);
  ihdr[8] = options.bitDepth ?? 8;
  ihdr[9] = options.colorType ?? 2;
  ihdr[12] = options.interlace ?? 0;
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const extra = (options.chunks ?? []).map(([type, data]) => pngChunk(type, data));
  return new Uint8Array(
    Buffer.concat([
      signature,
      pngChunk('IHDR', ihdr),
      ...extra,
      pngChunk('IDAT', deflateSync(Buffer.alloc(16))),
      pngChunk('IEND', new Uint8Array(0)),
    ]),
  );
}
