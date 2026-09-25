/**
 * Display preferences for the console (font size and phosphor colour) and the localStorage keys
 * they are saved under. Stored values come from the visitor's browser, so every reader validates
 * them and falls back to the default.
 *
 * Pure module: no DOM, erasable TypeScript only. The pre-paint inline script in
 * src/components/console/ConsolePrefs.astro receives these constants through define:vars.
 */

/** Font sizes in CSS pixels, stepped by the − / + buttons. */
export const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20, 22, 24, 28] as const;
export const DEFAULT_FONT_SIZE = 15;

export const PHOSPHORS = ['green', 'amber'] as const;
export type Phosphor = (typeof PHOSPHORS)[number];
export const DEFAULT_PHOSPHOR: Phosphor = 'green';

export const STORAGE_KEYS = {
  fontSize: 'kbs-console:font-size',
  phosphor: 'kbs-console:phosphor',
  history: 'kbs-console:history',
} as const;

/** A stored font size if it is one of FONT_SIZES, else the default. */
export function parseFontSize(raw: string | null): number {
  const size = Number(raw);
  return (FONT_SIZES as readonly number[]).includes(size) ? size : DEFAULT_FONT_SIZE;
}

/** The next size up or down, clamped to the ends of FONT_SIZES (an unknown size snaps to the nearest step). */
export function stepFontSize(size: number, step: 1 | -1): number {
  const sizes = FONT_SIZES as readonly number[];
  let index = sizes.indexOf(size);
  if (index === -1) {
    index = sizes.reduce((best, value, i) => (Math.abs(value - size) < Math.abs(sizes[best]! - size) ? i : best), 0);
    return sizes[index]!;
  }
  return sizes[Math.min(Math.max(index + step, 0), sizes.length - 1)]!;
}

export function parsePhosphor(raw: string | null): Phosphor {
  return (PHOSPHORS as readonly string[]).includes(raw ?? '') ? (raw as Phosphor) : DEFAULT_PHOSPHOR;
}
