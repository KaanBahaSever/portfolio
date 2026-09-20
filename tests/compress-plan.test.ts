import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPRESSION_LEVELS,
  DEFAULT_LEVEL,
  LEVELS,
  MAX_CANVAS_AREA,
  MAX_CANVAS_SIDE,
  isCompressionLevel,
  maxReplacementBytes,
  targetImageSize,
} from '../src/lib/pdf/compress/plan.ts';
import { downscalePixels } from '../src/lib/pdf/compress/pixels.ts';

test('levels get progressively stronger', () => {
  assert.deepEqual(COMPRESSION_LEVELS, ['light', 'balanced', 'strong']);
  assert.equal(DEFAULT_LEVEL, 'balanced');
  const [light, balanced, strong] = COMPRESSION_LEVELS.map((level) => LEVELS[level]);
  assert.ok(light!.maxDimension > balanced!.maxDimension && balanced!.maxDimension > strong!.maxDimension);
  assert.ok(light!.jpegQuality > balanced!.jpegQuality && balanced!.jpegQuality > strong!.jpegQuality);
  assert.equal(light!.convertFlate, false);
  assert.equal(balanced!.convertFlate, true);
  assert.equal(strong!.convertFlate, true);
  assert.ok(isCompressionLevel('strong'));
  assert.ok(!isCompressionLevel('maximum'));
  assert.ok(!isCompressionLevel(undefined));
});

test('replacement threshold: at least 10% smaller', () => {
  assert.equal(maxReplacementBytes(1000), 900);
  assert.equal(maxReplacementBytes(50_001), 45_000);
});

test('targetImageSize never upscales and keeps the aspect ratio', () => {
  assert.deepEqual(targetImageSize(800, 600, 1800), { width: 800, height: 600, resized: false });
  assert.deepEqual(targetImageSize(1800, 900, 1800), { width: 1800, height: 900, resized: false });
  assert.deepEqual(targetImageSize(3600, 2400, 1800), { width: 1800, height: 1200, resized: true });
  assert.deepEqual(targetImageSize(2480, 3508, 1200), { width: 848, height: 1200, resized: true });
  const thin = targetImageSize(10_000, 3, 1200);
  assert.equal(thin.width, 1200);
  assert.equal(thin.height, 1, 'never below 1 px');
});

test('targetImageSize respects canvas limits without a max dimension', () => {
  const huge = targetImageSize(20_000, 20_000, Infinity);
  assert.ok(huge.width <= MAX_CANVAS_SIDE && huge.height <= MAX_CANVAS_SIDE);
  assert.ok(huge.width * huge.height <= MAX_CANVAS_AREA);
  assert.ok(huge.resized);
  const wide = targetImageSize(30_000, 100, 0);
  assert.ok(wide.width <= MAX_CANVAS_SIDE);
  assert.throws(() => targetImageSize(0, 10, 100), RangeError);
});

test('downscalePixels averages whole blocks exactly', () => {
  // 4x2 gray -> 2x1: each output pixel is the mean of a 2x2 block.
  const src = Uint8Array.from([0, 100, 200, 255, 50, 150, 100, 45]);
  assert.deepEqual(Array.from(downscalePixels(src, 4, 2, 1, 2, 1)), [75, 150]);
});

test('downscalePixels handles fractional coverage and RGB', () => {
  // 3 px -> 2 px: out0 = (p0 * 1 + p1 * 0.5) / 1.5, out1 = (p1 * 0.5 + p2 * 1) / 1.5
  const src = Uint8Array.from([30, 0, 0, 90, 0, 255, 150, 0, 255]);
  const out = downscalePixels(src, 3, 1, 3, 2, 1);
  assert.deepEqual(Array.from(out), [50, 0, 85, 130, 0, 255]);
});

test('downscalePixels keeps flat colours flat and returns the input when the size is unchanged', () => {
  const width = 97;
  const height = 61;
  const src = new Uint8Array(width * height * 3);
  for (let i = 0; i < src.length; i += 3) src.set([12, 200, 77], i);
  const out = downscalePixels(src, width, height, 3, 23, 14);
  assert.equal(out.length, 23 * 14 * 3);
  for (let i = 0; i < out.length; i += 3) assert.deepEqual(Array.from(out.subarray(i, i + 3)), [12, 200, 77]);
  assert.equal(downscalePixels(src, width, height, 3, width, height), src);
  assert.throws(() => downscalePixels(src, width, height, 3, width + 1, height), RangeError);
  assert.throws(() => downscalePixels(src.subarray(0, 10), width, height, 3, 10, 10), RangeError);
});
