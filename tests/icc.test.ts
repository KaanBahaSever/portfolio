import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readIccProfile } from '../src/lib/image/icc.ts';
import { makeIccProfile } from './fixtures.ts';

test('reads the component count of gray, RGB and CMYK device profiles', () => {
  assert.equal(readIccProfile(makeIccProfile('GRAY'))?.components, 1);
  assert.equal(readIccProfile(makeIccProfile('RGB '))?.components, 3);
  assert.equal(readIccProfile(makeIccProfile('CMYK', 'prtr'))?.components, 4);
  assert.equal(readIccProfile(makeIccProfile('RGB ', 'scnr'))?.components, 3);
  assert.equal(readIccProfile(makeIccProfile('RGB ', 'spac'))?.components, 3);
});

test('trims trailing bytes beyond the declared size', () => {
  const profile = makeIccProfile('RGB ');
  const padded = new Uint8Array(profile.length + 10);
  padded.set(profile);
  const read = readIccProfile(padded);
  assert.equal(read?.data.length, profile.length);
  assert.equal(readIccProfile(profile)?.data, profile, 'exact-size input is returned as is');
});

test('rejects invalid or unsupported profiles', () => {
  assert.equal(readIccProfile(new Uint8Array(0)), null);
  assert.equal(readIccProfile(makeIccProfile('RGB ').subarray(0, 131)), null, 'shorter than header + tag count');
  assert.equal(readIccProfile(makeIccProfile('Lab ')), null, 'Lab colour space');
  assert.equal(readIccProfile(makeIccProfile('RGB ', 'link')), null, 'device link class');
  assert.equal(readIccProfile(makeIccProfile('RGB ', 'abst')), null, 'abstract class');

  const noSignature = makeIccProfile('RGB ');
  noSignature[36] = 0;
  assert.equal(readIccProfile(noSignature), null, 'missing acsp');

  const oversized = makeIccProfile('RGB ');
  new DataView(oversized.buffer).setUint32(0, oversized.length + 1);
  assert.equal(readIccProfile(oversized), null, 'declared size larger than the data');
});
