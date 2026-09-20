import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32 as nodeCrc32 } from 'node:zlib';
import {
  MAX_ZIP_ENTRIES,
  ZipLimitError,
  createZip,
  createZipIndex,
  crc32,
  normalizeEntryName,
  toDosDateTime,
  uniqueName,
} from '../src/lib/zip/zip-store.ts';
import type { ZipEntryInput } from '../src/lib/zip/zip-store.ts';

const encoder = new TextEncoder();

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

interface ParsedEntry {
  name: string;
  flags: number;
  method: number;
  time: number;
  date: number;
  crc: number;
  compressedSize: number;
  size: number;
  offset: number;
  data: Uint8Array;
}

/** Reads an archive the way unzip tools do: from the end of central directory record. */
function parseZip(bytes: Uint8Array): ParsedEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  assert.equal(view.getUint32(eocd, true), 0x06054b50, 'end of central directory signature');
  assert.equal(view.getUint16(eocd + 4, true), 0, 'disk number');
  assert.equal(view.getUint16(eocd + 6, true), 0, 'central directory disk');
  const count = view.getUint16(eocd + 8, true);
  assert.equal(view.getUint16(eocd + 10, true), count, 'total entries');
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  assert.equal(view.getUint16(eocd + 20, true), 0, 'comment length');
  assert.equal(centralOffset + centralSize, eocd, 'central directory ends where the EOCD starts');

  const decoder = new TextDecoder('utf-8', { fatal: true });
  const entries: ParsedEntry[] = [];
  let p = centralOffset;
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(p, true), 0x02014b50, 'central header signature');
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const time = view.getUint16(p + 12, true);
    const date = view.getUint16(p + 14, true);
    const crc = view.getUint32(p + 16, true);
    const compressedSize = view.getUint32(p + 20, true);
    const size = view.getUint32(p + 24, true);
    const nameLength = view.getUint16(p + 28, true);
    const extraLength = view.getUint16(p + 30, true);
    const commentLength = view.getUint16(p + 32, true);
    const offset = view.getUint32(p + 42, true);
    const nameBytes = bytes.subarray(p + 46, p + 46 + nameLength);
    const name = decoder.decode(nameBytes);

    // The local header must agree with the central directory.
    assert.equal(view.getUint32(offset, true), 0x04034b50, 'local header signature');
    assert.equal(view.getUint16(offset + 6, true), flags);
    assert.equal(view.getUint16(offset + 8, true), method);
    assert.equal(view.getUint16(offset + 10, true), time);
    assert.equal(view.getUint16(offset + 12, true), date);
    assert.equal(view.getUint32(offset + 14, true), crc);
    assert.equal(view.getUint32(offset + 18, true), compressedSize);
    assert.equal(view.getUint32(offset + 22, true), size);
    const localNameLength = view.getUint16(offset + 26, true);
    const localExtraLength = view.getUint16(offset + 28, true);
    assert.deepEqual(bytes.subarray(offset + 30, offset + 30 + localNameLength), nameBytes);
    const dataStart = offset + 30 + localNameLength + localExtraLength;
    const data = bytes.subarray(dataStart, dataStart + compressedSize);

    entries.push({ name, flags, method, time, date, crc, compressedSize, size, offset, data });
    p += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(p, centralOffset + centralSize);
  return entries;
}

test('crc32 matches known vectors', () => {
  assert.equal(crc32(encoder.encode('123456789')), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
  assert.equal(crc32(encoder.encode('The quick brown fox jumps over the lazy dog')), 0x414fa339);
  assert.equal(crc32(new Uint8Array([0])), 0xd202ef8d);
});

test('crc32 agrees with node:zlib and can be continued with a seed', () => {
  const bytes = new Uint8Array(100_000);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 7919) & 0xff;
  assert.equal(crc32(bytes), nodeCrc32(bytes));
  const head = bytes.subarray(0, 12_345);
  const tail = bytes.subarray(12_345);
  assert.equal(crc32(tail, crc32(head)), crc32(bytes));
});

test('createZip writes a valid STORE archive that reads back', () => {
  const files: ZipEntryInput[] = [
    { name: 'report-pages-1-3.pdf', data: encoder.encode('%PDF-1.7 first file') },
    { name: 'report-page-5.pdf', data: new Uint8Array(70_000).map((_, i) => i % 251) },
    { name: 'empty.txt', data: new Uint8Array(0) },
    { name: 'Fotoğraflar – Ağustos.pdf', data: encoder.encode('unicode name') },
  ];
  const zip = createZip(files);
  const bytes = concat(zip.parts);
  assert.equal(bytes.length, zip.size);

  const parsed = parseZip(bytes);
  assert.equal(parsed.length, files.length);
  parsed.forEach((entry, index) => {
    const file = files[index]!;
    assert.equal(entry.name, file.name);
    assert.equal(entry.method, 0, 'stored');
    assert.equal(entry.flags & 0x0800, 0x0800, 'UTF-8 names flag');
    assert.equal(entry.size, file.data.length);
    assert.equal(entry.compressedSize, file.data.length);
    assert.equal(entry.crc, nodeCrc32(file.data));
    assert.deepEqual(entry.data, file.data);
    assert.equal(entry.offset, zip.entries[index]!.offset);
    assert.equal(zip.entries[index]!.crc32, entry.crc);
  });
});

test('createZip references file data instead of copying it', () => {
  const data = encoder.encode('shared bytes');
  const zip = createZip([{ name: 'a.pdf', data }]);
  assert.ok(zip.parts.includes(data));
});

test('createZip de-duplicates names case-insensitively', () => {
  const data = new Uint8Array([1, 2, 3]);
  const zip = createZip([
    { name: 'a.pdf', data },
    { name: 'a.pdf', data },
    { name: 'A.pdf', data },
    { name: 'a (2).pdf', data },
    { name: 'notes', data },
    { name: 'notes', data },
  ]);
  const names = parseZip(concat(zip.parts)).map((entry) => entry.name);
  assert.deepEqual(names, ['a.pdf', 'a (2).pdf', 'A (3).pdf', 'a (2) (2).pdf', 'notes', 'notes (2)']);
  assert.deepEqual(
    zip.entries.map((entry) => entry.name),
    names,
  );
});

test('uniqueName and normalizeEntryName', () => {
  const used = new Set<string>();
  assert.equal(uniqueName('x.tar.gz', used), 'x.tar.gz');
  assert.equal(uniqueName('X.tar.gz', used), 'X.tar (2).gz');
  assert.equal(uniqueName('.hidden', used), '.hidden');
  assert.equal(uniqueName('.hidden', used), '.hidden (2)');
  assert.equal(uniqueName('dir.v2/file', used), 'dir.v2/file');
  assert.equal(uniqueName('dir.v2/file', used), 'dir.v2/file (2)');

  assert.equal(normalizeEntryName('folder\\file.pdf'), 'folder/file.pdf');
  assert.equal(normalizeEntryName('/abs/../x/./y.pdf'), 'abs/x/y.pdf');
  assert.equal(normalizeEntryName(''), 'file');
  assert.equal(normalizeEntryName('../..'), 'file');
});

test('DOS dates use local time, 2-second precision and clamp to 1980–2107', () => {
  const dos = toDosDateTime(new Date(2026, 8, 16, 14, 35, 59));
  assert.equal(dos.date, ((2026 - 1980) << 9) | (9 << 5) | 16);
  assert.equal(dos.time, (14 << 11) | (35 << 5) | 29);
  assert.deepEqual(toDosDateTime(new Date(1970, 0, 1)), { date: 33, time: 0 });
  assert.deepEqual(toDosDateTime(new Date(Number.NaN)), { date: 33, time: 0 });
  assert.equal(toDosDateTime(new Date(2200, 0, 1)).date >> 9, 127);

  const zip = createZip([{ name: 'a.pdf', data: new Uint8Array(1), date: new Date(2026, 8, 16, 14, 35, 59) }]);
  const [entry] = parseZip(concat(zip.parts));
  assert.equal(entry!.date, dos.date);
  assert.equal(entry!.time, dos.time);
});

test('createZip handles an empty archive', () => {
  const zip = createZip([]);
  assert.equal(zip.size, 22);
  assert.deepEqual(parseZip(concat(zip.parts)), []);
});

test('createZip refuses archives that would need ZIP64', () => {
  const tiny = new Uint8Array(0);
  const tooMany = Array.from({ length: MAX_ZIP_ENTRIES + 1 }, (_, i) => ({ name: `${i}.pdf`, data: tiny }));
  assert.throws(() => createZip(tooMany), ZipLimitError);
  assert.throws(() => createZip(tooMany), /Too many files/);

  // Sizes are checked before any data is read, so a fake length is enough here.
  const huge = { byteLength: 0xffff_ffff, length: 0xffff_ffff } as unknown as Uint8Array;
  assert.throws(() => createZip([{ name: 'big.pdf', data: huge }]), ZipLimitError);
  const half = { byteLength: 0x8000_0000, length: 0x8000_0000 } as unknown as Uint8Array;
  assert.throws(
    () =>
      createZip([
        { name: 'a.pdf', data: half },
        { name: 'b.pdf', data: half },
      ]),
    /4 GB/,
  );

  assert.throws(() => createZip([{ name: 'x'.repeat(70_000), data: tiny }]), ZipLimitError);
});

test('createZipIndex with Blobs builds the same archive as createZip', async () => {
  const date = new Date(2026, 8, 16, 14, 35, 58);
  const files: ZipEntryInput[] = [
    { name: 'report-page-1.pdf', data: encoder.encode('%PDF-1.7 first'), date },
    { name: 'report-page-1.pdf', data: new Uint8Array(70_000).map((_, i) => (i * 31) % 251), date },
    { name: 'empty.pdf', data: new Uint8Array(0), date },
  ];
  const expected = concat(createZip(files).parts);

  const index = createZipIndex(files.map(({ name, data }) => ({ name, size: data.length, crc32: crc32(data), date })));
  const parts: BlobPart[] = [];
  index.headers.forEach((header, i) => parts.push(header, new Blob([files[i]!.data as Uint8Array<ArrayBuffer>])));
  parts.push(index.tail);
  const blob = new Blob(parts, { type: 'application/zip' });

  assert.equal(index.size, expected.length);
  assert.equal(blob.size, expected.length);
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), expected);
  assert.deepEqual(
    index.entries.map((entry) => entry.name),
    ['report-page-1.pdf', 'report-page-1 (2).pdf', 'empty.pdf'],
  );
});

test('createZipIndex checks limits and sizes', () => {
  const tooMany = Array.from({ length: MAX_ZIP_ENTRIES + 1 }, (_, i) => ({ name: `${i}.pdf`, size: 0, crc32: 0 }));
  assert.throws(() => createZipIndex(tooMany), ZipLimitError);
  assert.throws(() => createZipIndex([{ name: 'big.pdf', size: 0xffff_ffff, crc32: 0 }]), /4 GB/);
  assert.throws(() => createZipIndex([{ name: 'bad.pdf', size: -1, crc32: 0 }]), RangeError);
  assert.throws(() => createZipIndex([{ name: 'bad.pdf', size: 1.5, crc32: 0 }]), RangeError);
});
