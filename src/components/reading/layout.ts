/**
 * The reading layout of blog posts and project pages (reading.css), as numbers: the text measure
 * and the figures' bleed, and the `sizes` attributes they imply, so the browser picks an image
 * candidate for the width the image is really drawn at.
 *
 * Pure module (no `astro:*` imports, erasable TypeScript) so `node --test` can load it.
 * tests/reading-layout.test.ts checks that reading.css uses the same numbers.
 */

/**
 * Text measure in rem: 768 px. The old layout set a post's text at 45rem without contents; with
 * contents, beside the sidebar, at 45rem at 1024 px, up to about 53rem just below 1280 px and at
 * 48rem from there. The owner asked for a wide reading column, so it keeps that widest steady
 * width, now centred with nothing beside it.
 * The body text is 18 px from Tailwind's sm (sm:prose-lg) with a 1.78 line height; IBM Plex Sans
 * sets about 0.44em per character, so a full line holds about 90 to 100 characters of English or
 * Turkish. The tall line spacing keeps lines of that length easy to follow; a measure of 70 to 80
 * characters would need a column of about 40rem. Change --reading-measure in reading.css
 * together with this number (tests/reading-layout.test.ts keeps the two in step).
 */
export const READING_MEASURE_REM = 48;

/** How far a figure may reach past the measure on each side, in rem: a modest 6rem. */
export const READING_BLEED_REM = 6;

/** BaseLayout's <main> gutters (px-safe): 1rem, then 1.5rem from Tailwind's sm breakpoint (40rem). */
const GUTTER_REM = 1;
const GUTTER_SM_REM = 1.5;
const SM_REM = 40;

/** Media conditions and `sizes` lengths use the initial font size, 16 px, whatever the page sets. */
const PX_PER_REM = 16;

/** 'column': text and notes; 'wide': figures that break out of the column. */
export type ReadingWidth = 'column' | 'wide';

/** The largest width, in rem, that a block of this kind is drawn at. */
export function readingMaxWidthRem(width: ReadingWidth): number {
  return width === 'wide' ? READING_MEASURE_REM + 2 * READING_BLEED_REM : READING_MEASURE_REM;
}

/**
 * `sizes` for an image as wide as the column or the wide measure: the content box between the
 * page gutters (100vw minus them) until the viewport leaves room for the full measure, then the
 * measure itself. (The 'wide' <main> is capped at 72rem, 69rem inside its gutters, which is more
 * than either measure, so that cap never applies.)
 */
export function readingImageSizes(width: ReadingWidth): string {
  const max = readingMaxWidthRem(width) * PX_PER_REM;
  const fullFrom = max + 2 * GUTTER_SM_REM * PX_PER_REM;
  return [
    `(min-width: ${fullFrom}px) ${max}px`,
    `(min-width: ${SM_REM * PX_PER_REM}px) calc(100vw - ${2 * GUTTER_SM_REM}rem)`,
    `calc(100vw - ${2 * GUTTER_REM}rem)`,
  ].join(', ');
}
