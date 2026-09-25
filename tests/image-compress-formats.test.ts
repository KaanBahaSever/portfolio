import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideOutputFormat, isWritableSource, type FormatDecision } from '../src/lib/image/compress/formats.ts';
import type { ImageFormat } from '../src/lib/image/sniff.ts';
import type { FormatChoice } from '../src/lib/image/compress/settings.ts';

const WEBP = { webp: true };
const NO_WEBP = { webp: false };

function decide(choice: FormatChoice, source: ImageFormat, hasAlpha: boolean, webp: boolean): FormatDecision {
  return decideOutputFormat({ choice, source, hasAlpha, support: webp ? WEBP : NO_WEBP });
}

/** [choice, source, hasAlpha, webp supported] → [format, lossy, flattenAlpha, notes]. */
const TABLE: Array<[FormatChoice, ImageFormat, boolean, boolean, FormatDecision['format'], boolean, boolean, string[]]> = [
  // Original keeps the input format when the browser can write it.
  ['original', 'jpeg', false, true, 'jpeg', true, false, []],
  ['original', 'png', false, true, 'png', false, false, ['png-lossless']],
  ['original', 'png', true, true, 'png', false, false, ['png-lossless']],
  ['original', 'webp', true, true, 'webp', true, false, []],
  // WebP source in a browser that cannot write WebP: opaque → JPEG, transparent → PNG.
  ['original', 'webp', false, false, 'jpeg', true, false, ['webp-unsupported']],
  ['original', 'webp', true, false, 'png', false, false, ['webp-unsupported', 'png-lossless']],
  // Formats browsers can read but not write.
  ['original', 'gif', true, true, 'webp', true, false, ['original-not-writable']],
  ['original', 'heic', false, true, 'webp', true, false, ['original-not-writable']],
  ['original', 'avif', false, false, 'jpeg', true, false, ['original-not-writable']],
  ['original', 'bmp', true, false, 'png', false, false, ['original-not-writable', 'png-lossless']],
  // WebP on request.
  ['webp', 'jpeg', false, true, 'webp', true, false, []],
  ['webp', 'png', true, true, 'webp', true, false, []],
  ['webp', 'jpeg', false, false, 'jpeg', true, false, ['webp-unsupported']],
  ['webp', 'png', true, false, 'png', false, false, ['webp-unsupported', 'png-lossless']],
  // JPEG on request: transparency is flattened onto white.
  ['jpeg', 'png', false, true, 'jpeg', true, false, []],
  ['jpeg', 'png', true, true, 'jpeg', true, true, ['alpha-flattened']],
  ['jpeg', 'webp', true, false, 'jpeg', true, true, ['alpha-flattened']],
  ['jpeg', 'jpeg', false, true, 'jpeg', true, false, []],
];

test('format decision table', () => {
  for (const [choice, source, alpha, webp, format, lossy, flatten, notes] of TABLE) {
    const label = `${choice} / ${source} / alpha ${alpha} / webp ${webp}`;
    const result = decide(choice, source, alpha, webp);
    assert.equal(result.format, format, label);
    assert.equal(result.mime, `image/${format}`, label);
    assert.equal(result.lossy, lossy, label);
    assert.equal(result.flattenAlpha, flatten, label);
    assert.deepEqual(result.notes, notes, label);
  }
});

test('only JPEG output ever flattens, and PNG output is always lossless', () => {
  const sources: ImageFormat[] = ['jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'ico', 'avif', 'heic', 'jxl', 'unknown'];
  for (const choice of ['original', 'webp', 'jpeg'] as const) {
    for (const source of sources) {
      for (const alpha of [false, true]) {
        for (const webp of [false, true]) {
          const result = decide(choice, source, alpha, webp);
          assert.equal(result.flattenAlpha, result.format === 'jpeg' && alpha);
          assert.equal(result.lossy, result.format !== 'png');
          if (!webp) assert.notEqual(result.format, 'webp', 'never WebP without an encoder');
          // Transparency survives unless the user explicitly asked for JPEG (a JPEG source has none).
          if (alpha && choice !== 'jpeg' && source !== 'jpeg') assert.equal(result.flattenAlpha, false);
        }
      }
    }
  }
});

test('isWritableSource names the formats "Original" keeps as they are', () => {
  assert.equal(isWritableSource('jpeg', NO_WEBP), true);
  assert.equal(isWritableSource('png', NO_WEBP), true);
  assert.equal(isWritableSource('webp', WEBP), true);
  assert.equal(isWritableSource('webp', NO_WEBP), false);
  assert.equal(isWritableSource('gif', WEBP), false);
  assert.equal(isWritableSource('heic', WEBP), false);
});
