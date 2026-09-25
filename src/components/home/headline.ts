/**
 * The owner's headline ("Software Developer | Math-Driven Solutions & Algorithms") as the hero
 * sets it: two halves that each wrap as a unit, around the bar the owner wrote. Kept verbatim:
 * `role + HEADLINE_SEPARATOR + specialty` is the headline, character for character.
 *
 * Pure module: `node --test` imports it (tests/resume-copy.test.ts).
 */

export const HEADLINE_SEPARATOR = ' | ';

export interface HeadlineParts {
  role: string;
  /** Empty when the headline has no separator. */
  specialty: string;
}

/** Splits at the first " | "; any later bars stay in the specialty. */
export function headlineParts(headline: string): HeadlineParts {
  const at = headline.indexOf(HEADLINE_SEPARATOR);
  if (at < 0) return { role: headline, specialty: '' };
  return { role: headline.slice(0, at), specialty: headline.slice(at + HEADLINE_SEPARATOR.length) };
}
