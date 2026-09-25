import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canvasLimits, WEBP_MAX_SIDE } from '../src/lib/image/compress/fit.ts';
import { FLATTEN_BACKGROUND, planEncode, samePlanOutput, type SourceImage } from '../src/lib/image/compress/plan.ts';
import {
  DEFAULT_SETTINGS,
  clampQuality,
  encoderQuality,
  isFormatChoice,
  parseMaxDimension,
  type CompressSettings,
} from '../src/lib/image/compress/settings.ts';

const DESKTOP = canvasLimits(false);
const MOBILE = canvasLimits(true);
const photo: SourceImage = { format: 'jpeg', width: 4032, height: 3024, hasAlpha: false };
const logo: SourceImage = { format: 'png', width: 1200, height: 600, hasAlpha: true };

function settings(overrides: Partial<CompressSettings> = {}): CompressSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

test('settings parsing clamps and falls back', () => {
  assert.equal(clampQuality(75), 75);
  assert.equal(clampQuality('42'), 42);
  assert.equal(clampQuality(0), 1);
  assert.equal(clampQuality(-5), 1);
  assert.equal(clampQuality(250), 100);
  assert.equal(clampQuality(74.6), 75);
  assert.equal(clampQuality('abc'), 75);
  assert.equal(clampQuality(Number.NaN), 75);
  assert.equal(encoderQuality(75), 0.75);
  assert.equal(encoderQuality(1), 0.01);
  assert.equal(encoderQuality(100), 1);
  assert.equal(parseMaxDimension('1920'), 1920);
  assert.equal(parseMaxDimension(''), null);
  assert.equal(parseMaxDimension('1921'), null, 'only offered sizes');
  assert.equal(parseMaxDimension('original'), null);
  assert.equal(isFormatChoice('webp'), true);
  assert.equal(isFormatChoice('png'), false, 'PNG is reached through "original", not chosen directly');
  assert.deepEqual(DEFAULT_SETTINGS, { quality: 75, format: 'original', maxDimension: null });
});

test('default settings keep a JPEG photo as a same-size JPEG at quality 0.75', () => {
  const plan = planEncode(photo, settings(), { webp: true }, DESKTOP);
  assert.deepEqual(plan, {
    format: 'jpeg',
    mime: 'image/jpeg',
    quality: 0.75,
    width: 4032,
    height: 3024,
    background: null,
    resizedBy: 'none',
    notes: [],
  });
});

test('WebP with a maximum size', () => {
  const plan = planEncode(photo, settings({ format: 'webp', quality: 60, maxDimension: 1920 }), { webp: true }, DESKTOP);
  assert.equal(plan.mime, 'image/webp');
  assert.equal(plan.quality, 0.6);
  assert.deepEqual([plan.width, plan.height], [1920, 1440]);
  assert.equal(plan.resizedBy, 'max-dimension');
  assert.deepEqual(plan.notes, [], 'the user asked for this size: nothing to explain');
});

test('PNG output has no quality, and transparent JPEG output gets a white background', () => {
  const png = planEncode(logo, settings({ quality: 30 }), { webp: true }, DESKTOP);
  assert.equal(png.mime, 'image/png');
  assert.equal(png.quality, null);
  assert.deepEqual(png.notes, ['png-lossless']);

  const jpeg = planEncode(logo, settings({ format: 'jpeg' }), { webp: true }, DESKTOP);
  assert.equal(jpeg.background, FLATTEN_BACKGROUND);
  assert.deepEqual(jpeg.notes, ['alpha-flattened']);

  const opaque = planEncode({ ...logo, hasAlpha: false }, settings({ format: 'jpeg' }), { webp: true }, DESKTOP);
  assert.equal(opaque.background, null);
});

test('size notes explain limits the user did not choose', () => {
  const big: SourceImage = { format: 'jpeg', width: 8000, height: 6000, hasAlpha: false };
  const mobile = planEncode(big, settings(), { webp: true }, MOBILE);
  assert.equal(mobile.resizedBy, 'canvas');
  assert.deepEqual(mobile.notes, ['canvas-limit']);
  assert.ok(mobile.width * mobile.height <= MOBILE.maxArea);

  const wide: SourceImage = { format: 'png', width: 16384, height: 800, hasAlpha: false };
  const webp = planEncode(wide, settings({ format: 'webp' }), { webp: true }, DESKTOP);
  assert.equal(webp.width, WEBP_MAX_SIDE);
  assert.deepEqual(webp.notes, ['encoder-limit']);
  // The WebP limit does not apply to JPEG.
  assert.equal(planEncode(wide, settings({ format: 'jpeg' }), { webp: true }, DESKTOP).width, 16384);
});

test('samePlanOutput ignores the quality slider for PNG but not for lossy formats', () => {
  const a = planEncode(logo, settings({ quality: 40 }), { webp: true }, DESKTOP);
  const b = planEncode(logo, settings({ quality: 90 }), { webp: true }, DESKTOP);
  assert.equal(samePlanOutput(a, b), true);

  const c = planEncode(photo, settings({ quality: 40 }), { webp: true }, DESKTOP);
  const d = planEncode(photo, settings({ quality: 41 }), { webp: true }, DESKTOP);
  assert.equal(samePlanOutput(c, d), false);
  assert.equal(samePlanOutput(c, c), true);
  assert.equal(samePlanOutput(null, c), false);

  const resized = planEncode(photo, settings({ quality: 40, maxDimension: 1280 }), { webp: true }, DESKTOP);
  assert.equal(samePlanOutput(c, resized), false);
});
