import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DESKTOP_MAX_CANVAS_AREA,
  MAX_CANVAS_SIDE,
  MOBILE_MAX_CANVAS_AREA,
  WEBP_MAX_SIDE,
  canDecode,
  canvasLimits,
  fitSize,
  type FitLimits,
} from '../src/lib/image/compress/fit.ts';

const DESKTOP: FitLimits = { maxLongSide: null, ...canvasLimits(false) };
const MOBILE: FitLimits = { maxLongSide: null, ...canvasLimits(true) };

test('keeps images that fit, and never enlarges', () => {
  assert.deepEqual(fitSize(4032, 3024, DESKTOP), { width: 4032, height: 3024, reason: 'none' });
  assert.deepEqual(fitSize(800, 600, { ...DESKTOP, maxLongSide: 1920 }), { width: 800, height: 600, reason: 'none' });
  assert.deepEqual(fitSize(1920, 1080, { ...DESKTOP, maxLongSide: 1920 }), { width: 1920, height: 1080, reason: 'none' });
});

test('the long side lands exactly on the maximum dimension', () => {
  assert.deepEqual(fitSize(4032, 3024, { ...DESKTOP, maxLongSide: 1920 }), { width: 1920, height: 1440, reason: 'max-dimension' });
  assert.deepEqual(fitSize(3024, 4032, { ...DESKTOP, maxLongSide: 1280 }), { width: 960, height: 1280, reason: 'max-dimension' });
  // 2000 * 1280 / 3000 = 853.33… → 853
  assert.deepEqual(fitSize(3000, 2000, { ...DESKTOP, maxLongSide: 1280 }), { width: 1280, height: 853, reason: 'max-dimension' });
  // A sliver never collapses to zero.
  assert.deepEqual(fitSize(10000, 2, { ...DESKTOP, maxLongSide: 1280 }), { width: 1280, height: 1, reason: 'max-dimension' });
  // Awkward ratios where width * scale is 1919.999…
  for (const [w, h] of [[40310, 30230], [60000, 40000], [5472, 3648], [7000, 3000], [2999, 1999]] as const) {
    const fit = fitSize(w, h, { ...DESKTOP, maxLongSide: 1920 });
    assert.equal(Math.max(fit.width, fit.height), 1920, `${w}x${h}`);
  }
});

test('respects the iOS 16.7 MP canvas area on mobile', () => {
  const fit = fitSize(8000, 6000, MOBILE);
  assert.equal(fit.reason, 'canvas');
  assert.ok(fit.width * fit.height <= MOBILE_MAX_CANVAS_AREA);
  assert.deepEqual([fit.width, fit.height], [4729, 3547]);
  // The same photo is fine on a desktop.
  assert.equal(fitSize(8000, 6000, DESKTOP).reason, 'none');
  // Exactly 4096 × 4096 fits.
  assert.deepEqual(fitSize(4096, 4096, MOBILE), { width: 4096, height: 4096, reason: 'none' });
});

test('respects the canvas side limit and the WebP encoder limit', () => {
  const panorama = fitSize(30000, 2000, DESKTOP);
  assert.deepEqual(panorama, { width: MAX_CANVAS_SIDE, height: 1092, reason: 'canvas' });

  const webp = fitSize(16384, 1000, { ...DESKTOP, encoderMaxSide: WEBP_MAX_SIDE });
  assert.deepEqual(webp, { width: WEBP_MAX_SIDE, height: 1000, reason: 'encoder' });
  // An encoder limit above the canvas limit changes nothing.
  assert.equal(fitSize(20000, 1000, { ...DESKTOP, encoderMaxSide: 65535 }).reason, 'canvas');
});

test('the tightest limit sets the size; the user wins ties', () => {
  // 1280 is tighter than the canvas area.
  assert.equal(fitSize(8000, 6000, { ...MOBILE, maxLongSide: 1280 }).reason, 'max-dimension');
  // A user limit above the image is not a reason.
  assert.equal(fitSize(8000, 6000, { ...MOBILE, maxLongSide: 10000 }).reason, 'canvas');
  // Tie between the user's 16384 and the canvas side limit.
  assert.equal(fitSize(20000, 100, { ...DESKTOP, maxLongSide: 16384 }).reason, 'max-dimension');
});

test('every limit holds for many sizes (property check)', () => {
  let seed = 7;
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let i = 0; i < 2000; i++) {
    const w = 1 + Math.floor(random() * 40000);
    const h = 1 + Math.floor(random() * 40000);
    const mobile = random() < 0.5;
    const maxLongSide = [null, 3840, 2560, 1920, 1280][Math.floor(random() * 5)] ?? null;
    const webp = random() < 0.5;
    const limits: FitLimits = { maxLongSide, ...canvasLimits(mobile), ...(webp ? { encoderMaxSide: WEBP_MAX_SIDE } : {}) };
    const fit = fitSize(w, h, limits);
    const label = `${w}x${h} mobile=${mobile} max=${maxLongSide} webp=${webp}`;
    assert.ok(fit.width >= 1 && fit.height >= 1, label);
    assert.ok(Number.isInteger(fit.width) && Number.isInteger(fit.height), label);
    assert.ok(fit.width <= w && fit.height <= h, `never enlarges: ${label}`);
    assert.ok(fit.width * fit.height <= (mobile ? MOBILE_MAX_CANVAS_AREA : DESKTOP_MAX_CANVAS_AREA), `area: ${label}`);
    assert.ok(Math.max(fit.width, fit.height) <= (webp ? WEBP_MAX_SIDE : MAX_CANVAS_SIDE), `side: ${label}`);
    if (maxLongSide) assert.ok(Math.max(fit.width, fit.height) <= maxLongSide, `user limit: ${label}`);
    // The aspect ratio is kept to within one pixel of rounding on the short side.
    if (fit.reason !== 'none' && Math.min(fit.width, fit.height) > 1) {
      const expectedShort = (Math.min(w, h) / Math.max(w, h)) * Math.max(fit.width, fit.height);
      assert.ok(Math.abs(Math.min(fit.width, fit.height) - expectedShort) <= 1.01, `aspect: ${label}`);
    }
  }
});

test('decode limits refuse images that would exhaust memory', () => {
  assert.equal(canDecode(8064, 6048, true), true, '48 MP phone photo');
  assert.equal(canDecode(16320, 12240, true), false, '200 MP photo on a phone');
  assert.equal(canDecode(16320, 12240, false), true, '200 MP photo on a desktop');
  assert.equal(canDecode(20000, 20000, false), false);
});
