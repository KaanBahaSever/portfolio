import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ASK_PREVIEW_BYTES_TOUCH,
  ASK_PREVIEW_PAGES,
  MAX_GRID_PAGES,
  gridTarget,
  pagesBetween,
  previewGate,
  sheetAspect,
  thumbnailScale,
} from '../src/scripts/tools/pdf-split/grid-math.ts';

test('gridTarget moves by tiles and rows and stops at the edges', () => {
  // 10 tiles in 3 columns: rows 0-2, 3-5, 6-8, 9.
  assert.equal(gridTarget('ArrowRight', 0, 10, 3), 1);
  assert.equal(gridTarget('ArrowRight', 9, 10, 3), 9);
  assert.equal(gridTarget('ArrowLeft', 0, 10, 3), 0);
  assert.equal(gridTarget('ArrowLeft', 4, 10, 3), 3);
  assert.equal(gridTarget('ArrowDown', 1, 10, 3), 4);
  assert.equal(gridTarget('ArrowDown', 6, 10, 3), 9);
  // The last row is short: no tile below 7, so focus stays.
  assert.equal(gridTarget('ArrowDown', 7, 10, 3), 7);
  assert.equal(gridTarget('ArrowUp', 1, 10, 3), 1);
  assert.equal(gridTarget('ArrowUp', 9, 10, 3), 6);
  assert.equal(gridTarget('Home', 5, 10, 3), 0);
  assert.equal(gridTarget('End', 5, 10, 3), 9);
  assert.equal(gridTarget('ArrowDown', 0, 10, 0), 1, 'a broken column count behaves like one column');
  assert.equal(gridTarget('Tab', 5, 10, 3), null);
  assert.equal(gridTarget(' ', 5, 10, 3), null);
  assert.equal(gridTarget('ArrowRight', 0, 0, 3), null);
});

test('pagesBetween lists a range in either direction', () => {
  assert.deepEqual(pagesBetween(2, 5), [2, 3, 4, 5]);
  assert.deepEqual(pagesBetween(5, 2), [2, 3, 4, 5]);
  assert.deepEqual(pagesBetween(4, 4), [4]);
});

test('sheetAspect follows page 1 within sensible limits', () => {
  assert.equal(sheetAspect({ width: 100, height: 200 }), 0.5);
  assert.equal(sheetAspect({ width: 612, height: 792 }), 612 / 792);
  assert.equal(sheetAspect({ width: 842, height: 595 }), 842 / 595);
  assert.equal(sheetAspect({ width: 2000, height: 100 }), 1.6);
  assert.equal(sheetAspect({ width: 10, height: 1000 }), 0.5);
  assert.equal(sheetAspect(undefined), 1 / Math.SQRT2);
  assert.equal(sheetAspect({ width: 0, height: 10 }), 1 / Math.SQRT2);
});

test('thumbnailScale fits the page in the box at up to 2× density', () => {
  const letter = thumbnailScale(612, 792, 150, 194, 2);
  assert.ok(612 * letter <= 300.001 && 792 * letter <= 388.001);
  assert.ok(Math.abs(Math.max(612 * letter - 300, 792 * letter - 388)) < 0.01, 'one side touches the box');
  assert.equal(thumbnailScale(612, 792, 150, 194, 3), letter, 'density is capped at 2');
  assert.equal(thumbnailScale(612, 792, 150, 194, 0.5), thumbnailScale(612, 792, 150, 194, 1));
  // Landscape pages in a portrait box are limited by the width.
  assert.equal(thumbnailScale(800, 400, 100, 140, 1), 100 / 800);
  // Huge canvases are scaled down to the pixel budget.
  const capped = thumbnailScale(100, 100, 1000, 1000, 2, 10_000);
  assert.ok(Math.abs(100 * capped * (100 * capped) - 10_000) < 1e-6);
  assert.equal(thumbnailScale(0, 100, 100, 100, 1), 1);
});

test('previewGate asks before heavy previews', () => {
  assert.equal(previewGate(10, 1_000_000, false), 'show');
  assert.equal(previewGate(ASK_PREVIEW_PAGES, 1_000_000, false), 'show');
  assert.equal(previewGate(ASK_PREVIEW_PAGES + 1, 1_000_000, false), 'ask-pages');
  assert.equal(previewGate(10, ASK_PREVIEW_BYTES_TOUCH + 1, true), 'ask-size');
  assert.equal(previewGate(10, ASK_PREVIEW_BYTES_TOUCH + 1, false), 'show');
  assert.equal(previewGate(MAX_GRID_PAGES, 1, false), 'ask-pages');
  assert.equal(previewGate(MAX_GRID_PAGES + 1, 1, false), 'too-many');
});
