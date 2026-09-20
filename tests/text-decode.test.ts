import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeTextFile, detectEncoding } from '../src/lib/text/decode.ts';

function utf16(text: string, littleEndian: boolean, bom = true): Uint8Array {
  const bytes = new Uint8Array((text.length + (bom ? 1 : 0)) * 2);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  if (bom) {
    view.setUint16(0, 0xfeff, littleEndian);
    offset = 2;
  }
  for (let i = 0; i < text.length; i++) view.setUint16(offset + i * 2, text.charCodeAt(i), littleEndian);
  return bytes;
}

const SAMPLE = 'Name   Id\r\n----   --\r\nçay 😀 İstanbul\r\n';

test('UTF-16 files with a byte order mark decode to their text', () => {
  assert.deepEqual(decodeTextFile(utf16(SAMPLE, true)), { text: SAMPLE, encoding: 'utf-16le' });
  assert.deepEqual(decodeTextFile(utf16(SAMPLE, false)), { text: SAMPLE, encoding: 'utf-16be' });
  assert.deepEqual(decodeTextFile(utf16('', true)), { text: '', encoding: 'utf-16le' });
});

test('everything else decodes as UTF-8, like Blob.text()', async () => {
  const encoder = new TextEncoder();
  const plain = encoder.encode(SAMPLE);
  assert.deepEqual(decodeTextFile(plain), { text: SAMPLE, encoding: 'utf-8' });
  const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...plain]);
  assert.deepEqual(decodeTextFile(withBom), { text: SAMPLE, encoding: 'utf-8' });
  const invalid = new Uint8Array([0x61, 0xff, 0x62, 0xc3]);
  for (const bytes of [plain, withBom, invalid, new Uint8Array([0xff]), new Uint8Array(0)]) {
    assert.equal(decodeTextFile(bytes).text, await new Blob([bytes]).text());
  }
  // Without a BOM, UTF-16 isn't guessed.
  assert.equal(detectEncoding(utf16('ab', true, false)), 'utf-8');
});
