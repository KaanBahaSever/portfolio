/**
 * Minimal ZIP writer. Pure: no DOM, runs in the browser (also in a Web Worker) and under Node.
 *
 * Entries are STORED (method 0, no compression): the files it packs are PDFs, whose
 * content is already compressed, so deflating them again costs time and saves little.
 *
 * createZip returns the archive as a list of byte chunks. File data is referenced, not copied,
 * so the caller can build a Blob (or transfer the chunks out of a worker) without one
 * giant intermediate buffer. createZipIndex writes only the headers, for data kept elsewhere
 * (such as Blobs). No ZIP64: archives are limited to 4 GB and 65,534 entries.
 */

export interface ZipEntryInput {
  /** File name inside the archive. "/" separates folders; duplicates get " (2)", " (3)"… */
  name: string;
  data: Uint8Array;
  /** Modification time (local time, 2-second precision). Defaults to now. */
  date?: Date;
}

export interface ZipEntryInfo {
  /** The name actually written (after clean-up and de-duplication). */
  name: string;
  size: number;
  crc32: number;
  /** Offset of the entry's local file header in the archive. */
  offset: number;
}

export interface ZipOutput {
  /** Chunks in archive order: `new Blob(parts)` is the finished .zip file. */
  parts: Uint8Array[];
  /** Total archive size in bytes (sum of the part lengths). */
  size: number;
  entries: ZipEntryInfo[];
}

export interface ZipIndexEntry {
  /** File name inside the archive, cleaned up and de-duplicated as in ZipEntryInput. */
  name: string;
  /** Data size in bytes. */
  size: number;
  /** CRC-32 of the data (see crc32). */
  crc32: number;
  /** Modification time (local time, 2-second precision). Defaults to now. */
  date?: Date;
}

export interface ZipIndex {
  /** Local file header of each entry. The archive is header 0, data 0, header 1, data 1, …, tail. */
  headers: Uint8Array<ArrayBuffer>[];
  /** Central directory and end record. */
  tail: Uint8Array<ArrayBuffer>;
  /** Total archive size in bytes, data included. */
  size: number;
  entries: ZipEntryInfo[];
}

/** Raised when the archive would need ZIP64 (too large or too many entries) or a name is too long. */
export class ZipLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZipLimitError';
  }
}

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_OF_CENTRAL_DIRECTORY_SIZE = 22;
/** 2.0: the lowest version that readers associate with the UTF-8 flag. */
const VERSION = 20;
/** General purpose bit 11: file names are UTF-8. */
const FLAG_UTF8 = 0x0800;
const METHOD_STORE = 0;

/** 0xFFFF and 0xFFFFFFFF are ZIP64 markers, so the largest usable values are one less. */
export const MAX_ZIP_ENTRIES = 0xfffe;
export const MAX_ZIP_SIZE = 0xfffffffe;
const MAX_NAME_BYTES = 0xffff;

// ------------------------------------------------------------------ CRC-32

let crcTable: Int32Array | null = null;

function getCrcTable(): Int32Array {
  if (crcTable) return crcTable;
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  crcTable = table;
  return table;
}

/**
 * CRC-32 (IEEE 802.3, as used by ZIP and PNG). Pass the previous result as `seed` to
 * continue over more data: crc32(b, crc32(a)) === crc32(a + b).
 */
export function crc32(bytes: Uint8Array, seed = 0): number {
  const table = getCrcTable();
  let crc = ~seed;
  for (let i = 0, length = bytes.length; i < length; i++) {
    crc = table[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return ~crc >>> 0;
}

// ------------------------------------------------------------------ names

/** Folder separators become "/", and empty, "." and ".." segments are dropped (no path traversal). */
export function normalizeEntryName(name: string): string {
  const segments = String(name ?? '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..');
  return segments.length ? segments.join('/') : 'file';
}

/**
 * Returns `name`, or "name (2).ext", "name (3).ext"… if it is already in `used`, and adds
 * the result to `used`. Comparison ignores case, because Windows and macOS extract
 * "A.pdf" and "a.pdf" to the same file.
 */
export function uniqueName(name: string, used: Set<string>): string {
  let candidate = name;
  if (used.has(candidate.toLowerCase())) {
    const slash = name.lastIndexOf('/');
    const dot = name.lastIndexOf('.');
    // A leading dot (".hidden") is part of the name, not an extension.
    const hasExtension = dot > slash + 1;
    const stem = hasExtension ? name.slice(0, dot) : name;
    const extension = hasExtension ? name.slice(dot) : '';
    for (let n = 2; ; n++) {
      candidate = `${stem} (${n})${extension}`;
      if (!used.has(candidate.toLowerCase())) break;
    }
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

// ------------------------------------------------------------------ dates

/** MS-DOS date and time fields (local time). Dates outside 1980–2107 are clamped. */
export function toDosDateTime(date: Date): { date: number; time: number } {
  const year = date.getFullYear(); // NaN for an invalid Date
  if (!(year >= 1980)) return { date: (1 << 5) | 1, time: 0 }; // 1980-01-01 00:00:00
  if (year > 2107) return { date: (127 << 9) | (12 << 5) | 31, time: (23 << 11) | (59 << 5) | 29 };
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  };
}

// ------------------------------------------------------------------ writer

interface PreparedEntry {
  name: string;
  nameBytes: Uint8Array;
  size: number;
  dos: { date: number; time: number };
}

/** Cleans up and de-duplicates names and checks the limits, before any header is written or any CRC is computed. */
function prepareEntries(entries: ReadonlyArray<{ name: string; size: number; date?: Date | undefined }>): PreparedEntry[] {
  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new ZipLimitError(
      `Too many files for one ZIP (${entries.length.toLocaleString('en-US')}). The limit is ${MAX_ZIP_ENTRIES.toLocaleString('en-US')}.`,
    );
  }

  const encoder = new TextEncoder();
  const used = new Set<string>();
  const now = new Date();
  const prepared: PreparedEntry[] = [];
  let total = END_OF_CENTRAL_DIRECTORY_SIZE;

  for (const entry of entries) {
    const name = uniqueName(normalizeEntryName(entry.name), used);
    const nameBytes = encoder.encode(name);
    if (nameBytes.length > MAX_NAME_BYTES) throw new ZipLimitError(`A file name is too long for a ZIP: ${name.slice(0, 40)}…`);
    total += LOCAL_HEADER_SIZE + CENTRAL_HEADER_SIZE + 2 * nameBytes.length + entry.size;
    if (total > MAX_ZIP_SIZE) {
      throw new ZipLimitError('The files are too large for one ZIP (the limit is 4 GB). Create fewer files at once.');
    }
    prepared.push({ name, nameBytes, size: entry.size, dos: toDosDateTime(entry.date ?? now) });
  }
  return prepared;
}

/** Headers and central directory for prepared entries; `checksum(index)` gives each entry's CRC-32. */
function writeIndex(prepared: readonly PreparedEntry[], checksum: (index: number) => number): ZipIndex {
  const headers: Uint8Array<ArrayBuffer>[] = [];
  const infos: ZipEntryInfo[] = [];
  let offset = 0;

  prepared.forEach((entry, index) => {
    const crc = checksum(index) >>> 0;
    const header = new Uint8Array(LOCAL_HEADER_SIZE + entry.nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, LOCAL_HEADER_SIGNATURE, true);
    view.setUint16(4, VERSION, true);
    view.setUint16(6, FLAG_UTF8, true);
    view.setUint16(8, METHOD_STORE, true);
    view.setUint16(10, entry.dos.time, true);
    view.setUint16(12, entry.dos.date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, entry.size, true); // compressed size
    view.setUint32(22, entry.size, true); // uncompressed size
    view.setUint16(26, entry.nameBytes.length, true);
    view.setUint16(28, 0, true); // extra field length
    header.set(entry.nameBytes, LOCAL_HEADER_SIZE);

    headers.push(header);
    infos.push({ name: entry.name, size: entry.size, crc32: crc, offset });
    offset += header.length + entry.size;
  });

  const centralOffset = offset;
  let centralSize = 0;
  for (const entry of prepared) centralSize += CENTRAL_HEADER_SIZE + entry.nameBytes.length;

  const tail = new Uint8Array(centralSize + END_OF_CENTRAL_DIRECTORY_SIZE);
  const view = new DataView(tail.buffer);
  let position = 0;
  prepared.forEach((entry, index) => {
    const info = infos[index]!;
    view.setUint32(position, CENTRAL_HEADER_SIGNATURE, true);
    view.setUint16(position + 4, VERSION, true); // version made by (MS-DOS / FAT attributes)
    view.setUint16(position + 6, VERSION, true); // version needed to extract
    view.setUint16(position + 8, FLAG_UTF8, true);
    view.setUint16(position + 10, METHOD_STORE, true);
    view.setUint16(position + 12, entry.dos.time, true);
    view.setUint16(position + 14, entry.dos.date, true);
    view.setUint32(position + 16, info.crc32, true);
    view.setUint32(position + 20, info.size, true);
    view.setUint32(position + 24, info.size, true);
    view.setUint16(position + 28, entry.nameBytes.length, true);
    view.setUint16(position + 30, 0, true); // extra field length
    view.setUint16(position + 32, 0, true); // comment length
    view.setUint16(position + 34, 0, true); // disk number start
    view.setUint16(position + 36, 0, true); // internal attributes
    view.setUint32(position + 38, 0, true); // external attributes
    view.setUint32(position + 42, info.offset, true);
    tail.set(entry.nameBytes, position + CENTRAL_HEADER_SIZE);
    position += CENTRAL_HEADER_SIZE + entry.nameBytes.length;
  });

  view.setUint32(position, END_OF_CENTRAL_DIRECTORY_SIGNATURE, true);
  view.setUint16(position + 4, 0, true); // this disk
  view.setUint16(position + 6, 0, true); // disk with the central directory
  view.setUint16(position + 8, prepared.length, true);
  view.setUint16(position + 10, prepared.length, true);
  view.setUint32(position + 12, centralSize, true);
  view.setUint32(position + 16, centralOffset, true);
  view.setUint16(position + 20, 0, true); // comment length

  return { headers, tail, size: centralOffset + tail.length, entries: infos };
}

export function createZip(entries: readonly ZipEntryInput[]): ZipOutput {
  const prepared = prepareEntries(entries.map(({ name, data, date }) => ({ name, size: data.byteLength, date })));
  const index = writeIndex(prepared, (i) => crc32(entries[i]!.data));
  const parts: Uint8Array[] = [];
  index.headers.forEach((header, i) => {
    parts.push(header);
    if (prepared[i]!.size > 0) parts.push(entries[i]!.data);
  });
  parts.push(index.tail);
  return { parts, size: index.size, entries: index.entries };
}

/**
 * The same archive as createZip, for data that is stored elsewhere (for example in Blobs):
 * only sizes and checksums are needed. The archive is header 0, data 0, header 1, data 1, …, tail.
 */
export function createZipIndex(entries: readonly ZipIndexEntry[]): ZipIndex {
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.size) || entry.size < 0) throw new RangeError(`Invalid ZIP entry size: ${entry.size}`);
  }
  return writeIndex(prepareEntries(entries), (i) => entries[i]!.crc32);
}
