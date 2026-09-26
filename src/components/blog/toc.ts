/**
 * Table of contents for a post, built from the headings that render() returns.
 * Pure module (no `astro:*` imports), unit-testable with `node --test`.
 */

export interface PostHeading {
  depth: number;
  slug: string;
  text: string;
}

export interface TocEntry {
  slug: string;
  text: string;
  children: TocEntry[];
}

/** Section (h2) and subsection (h3) headings; deeper levels would crowd the list. */
const MIN_DEPTH = 2;
const MAX_DEPTH = 3;

/** A contents list pays off only for posts that are long and have several sections. */
export const TOC_MIN_HEADINGS = 3;
export const TOC_MIN_MINUTES = 4;

/**
 * GFM footnotes add a visually hidden "Footnotes" h2 with this id; it is not a section of the
 * post, so it stays out of the contents.
 */
const FOOTNOTES_SLUG = 'footnote-label';

/** h2 entries with their h3 entries nested; an h3 before the first h2 stays at the top level. */
export function buildToc(headings: readonly PostHeading[]): TocEntry[] {
  const toc: TocEntry[] = [];
  let section: TocEntry | undefined;
  for (const heading of headings) {
    if (heading.depth < MIN_DEPTH || heading.depth > MAX_DEPTH || !heading.slug) continue;
    if (heading.slug === FOOTNOTES_SLUG) continue;
    const entry: TocEntry = { slug: heading.slug, text: heading.text, children: [] };
    if (heading.depth === MIN_DEPTH) {
      section = entry;
      toc.push(entry);
    } else if (section) {
      section.children.push(entry);
    } else {
      toc.push(entry);
    }
  }
  return toc;
}

export function countEntries(toc: readonly TocEntry[]): number {
  return toc.reduce((total, entry) => total + 1 + countEntries(entry.children), 0);
}

export function shouldShowToc(toc: readonly TocEntry[], minutes: number): boolean {
  return countEntries(toc) >= TOC_MIN_HEADINGS && minutes >= TOC_MIN_MINUTES;
}
