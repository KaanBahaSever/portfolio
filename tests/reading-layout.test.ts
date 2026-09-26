/**
 * The reading layout of blog posts and project pages: the numbers in layout.ts (used for image
 * `sizes`) must be the ones reading.css lays the page out with, and the `sizes` they produce must
 * describe the drawn width at every viewport.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  READING_BLEED_REM,
  READING_MEASURE_REM,
  readingImageSizes,
  readingMaxWidthRem,
} from '../src/components/reading/layout.ts';

const CSS = readFileSync(join(import.meta.dirname, '..', 'src', 'components', 'reading', 'reading.css'), 'utf8');

function cssRem(property: string): number {
  const match = new RegExp(`${property}:\\s*([\\d.]+)rem;`).exec(CSS);
  assert.ok(match, `reading.css declares ${property} in rem`);
  return Number(match[1]);
}

test('layout.ts and reading.css agree on the measure and the bleed', () => {
  assert.equal(cssRem('--reading-measure'), READING_MEASURE_REM);
  assert.equal(cssRem('--reading-bleed-max'), READING_BLEED_REM);
});

test('the measure suits 18 px body text (roughly 44 to 50rem) and the bleed stays modest', () => {
  assert.ok(READING_MEASURE_REM >= 44 && READING_MEASURE_REM <= 50);
  assert.ok(READING_BLEED_REM > 0 && READING_BLEED_REM <= READING_MEASURE_REM / 6);
  assert.equal(readingMaxWidthRem('column'), READING_MEASURE_REM);
  assert.equal(readingMaxWidthRem('wide'), READING_MEASURE_REM + 2 * READING_BLEED_REM);
});

/**
 * Evaluates a `sizes` value the way a browser does, for this module's simple form: the first
 * "(min-width: Npx) length" that matches, else the last length. Lengths are px or
 * calc(100vw - Nrem).
 */
function drawnWidth(sizes: string, viewport: number): number {
  const length = (value: string) => {
    const px = /^(\d+)px$/.exec(value);
    if (px) return Number(px[1]);
    const calc = /^calc\(100vw - ([\d.]+)rem\)$/.exec(value);
    assert.ok(calc, `unexpected length ${value}`);
    return viewport - Number(calc[1]) * 16;
  };
  for (const entry of sizes.split(', ')) {
    const conditional = /^\(min-width: (\d+)px\) (.+)$/.exec(entry);
    if (!conditional) return length(entry);
    if (viewport >= Number(conditional[1])) return length(conditional[2]!);
  }
  throw new Error('sizes has no default length');
}

/** What reading.css draws: the content box between the gutters, capped at the measure. */
function layoutWidth(width: 'column' | 'wide', viewport: number): number {
  const gutter = viewport >= 640 ? 24 : 16;
  const content = Math.min(viewport - 2 * gutter, 72 * 16 - 2 * gutter);
  return Math.min(content, readingMaxWidthRem(width) * 16);
}

test('image sizes match the laid-out width at every viewport', () => {
  for (const width of ['column', 'wide'] as const) {
    const sizes = readingImageSizes(width);
    for (let viewport = 320; viewport <= 2560; viewport += 1) {
      assert.equal(drawnWidth(sizes, viewport), layoutWidth(width, viewport), `${width} at ${viewport}px`);
    }
  }
});

test('the wide sizes attribute reads as expected', () => {
  assert.equal(
    readingImageSizes('wide'),
    '(min-width: 976px) 928px, (min-width: 640px) calc(100vw - 3rem), calc(100vw - 2rem)',
  );
});
