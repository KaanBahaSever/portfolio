import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseName, extensionFor, outputFileName } from '../src/lib/image/compress/filename.ts';

test('replaces the extension and adds the suffix', () => {
  assert.equal(outputFileName('photo.jpg', 'webp'), 'photo-compressed.webp');
  assert.equal(outputFileName('photo.jpg', 'jpeg'), 'photo-compressed.jpg');
  assert.equal(outputFileName('Screenshot.PNG', 'png'), 'Screenshot-compressed.png');
  assert.equal(outputFileName('IMG_2041.HEIC', 'jpeg'), 'IMG_2041-compressed.jpg');
  assert.equal(outputFileName('anim.gif', 'webp'), 'anim-compressed.webp');
  assert.equal(outputFileName('no-extension', 'png'), 'no-extension-compressed.png');
  assert.equal(outputFileName('holiday.final.jpeg', 'webp'), 'holiday.final-compressed.webp');
});

test('JPEG keeps a ".jpeg" spelling the user already had', () => {
  assert.equal(extensionFor('jpeg', 'scan.jpeg'), '.jpeg');
  assert.equal(extensionFor('jpeg', 'scan.JPEG'), '.jpeg');
  assert.equal(extensionFor('jpeg', 'scan.png'), '.jpg');
  assert.equal(extensionFor('webp', 'scan.jpeg'), '.webp');
  assert.equal(outputFileName('scan.jpeg', 'jpeg'), 'scan-compressed.jpeg');
});

test('keeps non-Latin names and cleans unsafe characters', () => {
  assert.equal(outputFileName('Doğum günü — İstanbul.jpg', 'webp'), 'Doğum günü — İstanbul-compressed.webp');
  assert.equal(outputFileName('a/b\\c:d*e?f"g<h>i|j.png', 'png'), 'abcdefghij-compressed.png');
  assert.equal(outputFileName('tab\there\nnewline.jpg', 'jpeg'), 'tab here newline-compressed.jpg');
  assert.equal(outputFileName('bell\u0007.jpg', 'jpeg'), 'bell-compressed.jpg');
});

test('falls back to "image" when nothing usable is left', () => {
  assert.equal(outputFileName('', 'webp'), 'image-compressed.webp');
  assert.equal(outputFileName('.jpg', 'webp'), 'image-compressed.webp');
  assert.equal(outputFileName('...', 'png'), 'image-compressed.png');
  assert.equal(outputFileName('  ', 'jpeg'), 'image-compressed.jpg');
  assert.equal(outputFileName('???.png', 'png'), 'image-compressed.png');
  assert.equal(baseName('.hidden.png'), 'hidden');
});

test('shortens very long names by code points', () => {
  const long = `${'ş'.repeat(200)}.jpg`;
  const base = baseName(long);
  assert.equal(Array.from(base).length, 80);
  assert.equal(outputFileName(long, 'webp'), `${'ş'.repeat(80)}-compressed.webp`);
  // Emoji are not split in half.
  assert.equal(Array.from(baseName('😀'.repeat(100))).length, 80);
});
