import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MARGINS_MM, MARGINS_PT, PAGE_SIZES, computePlacement } from '../src/lib/pdf/page-layout.ts';
import type { Placement } from '../src/lib/pdf/page-layout.ts';

const EPS = 1e-6;

function assertClose(actual: number, expected: number, message: string): void {
  assert.ok(Math.abs(actual - expected) < EPS, `${message}: got ${actual}, expected ${expected}`);
}

function assertPlacement(actual: Placement, expected: Placement): void {
  for (const key of Object.keys(expected) as Array<keyof Placement>) {
    assertClose(actual[key], expected[key], key);
  }
}

const [A4W, A4H] = PAGE_SIZES.a4;
const SMALL = MARGINS_PT.small;

test('margins are 0 / 10 mm / 20 mm in points', () => {
  assert.equal(MARGINS_PT.none, 0);
  assertClose(MARGINS_PT.small, 28.346456692913385, 'small');
  assertClose(MARGINS_PT.large, 56.69291338582677, 'large');
  // The option labels in the interface show the millimetre figures.
  assert.deepEqual(MARGINS_MM, { none: 0, small: 10, large: 20 });
});

test('A4 auto: portrait image on a portrait page, contained and centered', () => {
  const p = computePlacement(3000, 4000, { pageSize: 'a4', orientation: 'auto', margin: 'none' });
  const scale = Math.min(A4W / 3000, A4H / 4000);
  assertPlacement(p, {
    pageWidth: A4W,
    pageHeight: A4H,
    width: 3000 * scale,
    height: 4000 * scale,
    x: 0,
    y: (A4H - 4000 * scale) / 2,
  });
});

test('A4 auto: landscape image on a landscape page', () => {
  const p = computePlacement(4000, 3000, { pageSize: 'a4', orientation: 'auto', margin: 'none' });
  assert.equal(p.pageWidth, A4H);
  assert.equal(p.pageHeight, A4W);
  const scale = Math.min(A4H / 4000, A4W / 3000);
  assertClose(p.width, 4000 * scale, 'width');
  assertClose(p.height, 3000 * scale, 'height');
  assertClose(p.y, 0, 'y');
  assertClose(p.x, (A4H - p.width) / 2, 'x');
});

test('auto treats square images as portrait; forced orientation wins', () => {
  const square = computePlacement(500, 500, { pageSize: 'a4', orientation: 'auto', margin: 'none' });
  assert.equal(square.pageWidth, A4W);
  const forcedLandscape = computePlacement(1000, 2000, { pageSize: 'a4', orientation: 'landscape', margin: 'none' });
  assert.deepEqual([forcedLandscape.pageWidth, forcedLandscape.pageHeight], [A4H, A4W]);
  const forcedPortrait = computePlacement(2000, 1000, { pageSize: 'letter', orientation: 'portrait', margin: 'none' });
  assert.deepEqual([forcedPortrait.pageWidth, forcedPortrait.pageHeight], [612, 792]);
});

test('margins shrink the content box', () => {
  const p = computePlacement(1000, 1000, { pageSize: 'letter', orientation: 'auto', margin: 'small' });
  const box = 612 - 2 * SMALL;
  assertPlacement(p, {
    pageWidth: 612,
    pageHeight: 792,
    width: box,
    height: box,
    x: SMALL,
    y: SMALL + (792 - 2 * SMALL - box) / 2,
  });
  const large = computePlacement(100, 1000, { pageSize: 'a4', orientation: 'auto', margin: 'large' });
  assertClose(large.height, A4H - 2 * MARGINS_PT.large, 'large margin height');
  assert.ok(large.y >= MARGINS_PT.large - EPS);
});

test('small images are scaled up to fill the content box', () => {
  const p = computePlacement(10, 5, { pageSize: 'a4', orientation: 'portrait', margin: 'none' });
  assertClose(p.width, A4W, 'width');
  assertClose(p.height, A4W / 2, 'height');
});

test('fit: 96 DPI page size plus margins, orientation ignored', () => {
  const p = computePlacement(800, 600, { pageSize: 'fit', orientation: 'portrait', margin: 'none' });
  assertPlacement(p, { pageWidth: 600, pageHeight: 450, x: 0, y: 0, width: 600, height: 450 });
  const withMargin = computePlacement(800, 600, { pageSize: 'fit', orientation: 'landscape', margin: 'small' });
  assertPlacement(withMargin, {
    pageWidth: 600 + 2 * SMALL,
    pageHeight: 450 + 2 * SMALL,
    x: SMALL,
    y: SMALL,
    width: 600,
    height: 450,
  });
});

test('fit: pages longer than 14400 pt are scaled down uniformly', () => {
  const p = computePlacement(40000, 1000, { pageSize: 'fit', orientation: 'auto', margin: 'none' });
  assertPlacement(p, { pageWidth: 14400, pageHeight: 360, x: 0, y: 0, width: 14400, height: 360 });
  const m = computePlacement(30000, 30000, { pageSize: 'fit', orientation: 'auto', margin: 'large' });
  assertClose(m.pageWidth, 14400, 'page');
  const scale = 14400 / (22500 + 2 * MARGINS_PT.large);
  assertClose(m.width, 22500 * scale, 'image');
  assertClose(m.x, MARGINS_PT.large * scale, 'margin scaled');
});

test('fit: page sides are at least 3 pt', () => {
  const p = computePlacement(1, 1, { pageSize: 'fit', orientation: 'auto', margin: 'none' });
  assertPlacement(p, { pageWidth: 3, pageHeight: 3, x: 1.125, y: 1.125, width: 0.75, height: 0.75 });
  const thin = computePlacement(100000, 2, { pageSize: 'fit', orientation: 'auto', margin: 'none' });
  assertClose(thin.pageWidth, 14400, 'long side');
  assertClose(thin.pageHeight, 3, 'short side');
  assertClose(thin.y + thin.height / 2, 1.5, 'centered');
});

test('invalid dimensions throw descriptive errors', () => {
  const opts = { pageSize: 'a4', orientation: 'auto', margin: 'none' } as const;
  for (const [w, h] of [
    [0, 10],
    [10, -1],
    [NaN, 10],
    [10, Infinity],
  ]) {
    assert.throws(() => computePlacement(w!, h!, opts), /Invalid image (width|height)/);
  }
});
