import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeOrientation,
  orientationCanvasTransform,
  orientationMatrix,
  orientedSize,
  storedDrawSize,
} from '../src/lib/image/orientation.ts';
import type { Matrix, Orientation } from '../src/lib/image/orientation.ts';

type Side = 'top' | 'bottom' | 'left' | 'right';

/** EXIF 2.3 ground truth: where stored row 0 and column 0 end up visually. */
const GROUND_TRUTH: Record<Orientation, { row0: Side; col0: Side }> = {
  1: { row0: 'top', col0: 'left' },
  2: { row0: 'top', col0: 'right' },
  3: { row0: 'bottom', col0: 'right' },
  4: { row0: 'bottom', col0: 'left' },
  5: { row0: 'left', col0: 'top' },
  6: { row0: 'right', col0: 'top' },
  7: { row0: 'right', col0: 'bottom' },
  8: { row0: 'left', col0: 'bottom' },
};

const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
const ALL: Orientation[] = [1, 2, 3, 4, 5, 6, 7, 8];

/** Visual corner of a stored corner (first/last row, first/last column). */
function visualCorner(o: Orientation, firstRow: boolean, firstCol: boolean): { h: Side; v: Side } {
  const rowSide = firstRow ? GROUND_TRUTH[o].row0 : OPPOSITE[GROUND_TRUTH[o].row0];
  const colSide = firstCol ? GROUND_TRUTH[o].col0 : OPPOSITE[GROUND_TRUTH[o].col0];
  const sides = [rowSide, colSide];
  const h = sides.find((s) => s === 'left' || s === 'right');
  const v = sides.find((s) => s === 'top' || s === 'bottom');
  assert.ok(h && v, 'row and column sides must be perpendicular');
  return { h, v };
}

function apply(m: Matrix, x: number, y: number): [number, number] {
  const [a, b, c, d, e, f] = m;
  return [a * x + c * y + e, b * x + d * y + f];
}

function assertPoint(actual: [number, number], expected: [number, number], message: string): void {
  assert.ok(
    Math.abs(actual[0] - expected[0]) < 1e-9 && Math.abs(actual[1] - expected[1]) < 1e-9,
    `${message}: got (${actual.join(', ')}), expected (${expected.join(', ')})`,
  );
}

const STORED_CORNERS = [
  { name: 'top-left', firstRow: true, firstCol: true },
  { name: 'top-right', firstRow: true, firstCol: false },
  { name: 'bottom-left', firstRow: false, firstCol: true },
  { name: 'bottom-right', firstRow: false, firstCol: false },
];

test('normalizeOrientation', () => {
  for (const o of ALL) assert.equal(normalizeOrientation(o), o);
  for (const bad of [0, 9, -1, 2.5, NaN, '6', null, undefined, {}]) assert.equal(normalizeOrientation(bad), 1);
});

test('orientedSize swaps for 5-8 only', () => {
  for (const o of ALL) {
    const expected = o >= 5 ? { width: 30, height: 40 } : { width: 40, height: 30 };
    assert.deepEqual(orientedSize(40, 30, o), expected);
    assert.deepEqual(storedDrawSize(o, 40, 30), o >= 5 ? { width: 30, height: 40 } : { width: 40, height: 30 });
  }
});

test('PDF matrices map stored corners to the ground-truth visual corners', () => {
  const rects = [
    { x: 0, y: 0, width: 1, height: 1 },
    { x: 28.35, y: 100.5, width: 400, height: 300 },
    { x: 12, y: 7, width: 90, height: 500 },
  ];
  for (const o of ALL) {
    for (const rect of rects) {
      const m = orientationMatrix(o, rect);
      const toPdf = (h: Side, v: Side): [number, number] => [
        h === 'left' ? rect.x : rect.x + rect.width,
        v === 'bottom' ? rect.y : rect.y + rect.height,
      ];
      for (const corner of STORED_CORNERS) {
        // PDF image space: first row at v = 1, first column at u = 0.
        const u = corner.firstCol ? 0 : 1;
        const v = corner.firstRow ? 1 : 0;
        const { h, v: vs } = visualCorner(o, corner.firstRow, corner.firstCol);
        assertPoint(apply(m, u, v), toPdf(h, vs), `o=${o} stored ${corner.name}`);
      }
    }
  }
});

test('documented examples: 6 puts stored top-left at visual top-right, 8 at bottom-left', () => {
  const rect = { x: 10, y: 20, width: 300, height: 400 };
  assertPoint(apply(orientationMatrix(6, rect), 0, 1), [310, 420], 'o=6');
  assertPoint(apply(orientationMatrix(8, rect), 0, 1), [10, 20], 'o=8');
});

test('canvas transforms map stored corners to the ground-truth visual corners', () => {
  const sizes = [
    [1, 1],
    [400, 300],
    [120, 640],
  ] as const;
  for (const o of ALL) {
    for (const [displayW, displayH] of sizes) {
      const m = orientationCanvasTransform(o, displayW, displayH);
      const draw = storedDrawSize(o, displayW, displayH);
      const toCanvas = (h: Side, v: Side): [number, number] => [
        h === 'left' ? 0 : displayW,
        v === 'top' ? 0 : displayH,
      ];
      for (const corner of STORED_CORNERS) {
        // drawImage(source, 0, 0, draw.width, draw.height): first row at y = 0, first column at x = 0.
        const px = corner.firstCol ? 0 : draw.width;
        const py = corner.firstRow ? 0 : draw.height;
        const { h, v } = visualCorner(o, corner.firstRow, corner.firstCol);
        assertPoint(apply(m, px, py), toCanvas(h, v), `o=${o} ${displayW}x${displayH} stored ${corner.name}`);
      }
    }
  }
});

test('matrices never contain negative zero', () => {
  for (const o of ALL) {
    for (const value of [...orientationMatrix(o, { x: 0, y: 0, width: 5, height: 5 }), ...orientationCanvasTransform(o, 5, 5)]) {
      assert.ok(!Object.is(value, -0));
    }
  }
});
