/**
 * Reading time of a post, estimated from its Markdown/MDX source (the collection entry's `body`).
 *
 * Pure module (no `astro:*` imports) so it can be unit-tested with `node --test`.
 *
 * 200 words per minute is a deliberately unhurried pace: these posts mix prose with formulas
 * and code, which take longer to read than a news article. Markup that is not read (URLs,
 * HTML/JSX tags, MDX import/export lines, LaTeX commands) is removed before counting.
 */

export const WORDS_PER_MINUTE = 200;

/** Words a reader actually reads in `source`. */
export function countWords(source: string): number {
  const text = source
    // MDX module lines and {expressions} on their own lines.
    .replace(/^(?:import|export)\s.*$/gm, ' ')
    .replace(/^\{[^\n]*\}\s*$/gm, ' ')
    // HTML comments, then tags (keeping their text content).
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    // Images are looked at, not read; links count their text, not their destination.
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, ' ')
    .replace(/\]\([^)]*\)/g, ']')
    // LaTeX commands (\frac, \mathbb…) are symbols, not words.
    .replace(/\\[A-Za-z]+/g, ' ');
  return text.match(/[\p{L}\p{N}][\p{L}\p{N}’'.-]*/gu)?.length ?? 0;
}

/** Whole minutes, at least 1. */
export function readingMinutes(source: string | undefined): number {
  if (!source) return 1;
  return Math.max(1, Math.round(countWords(source) / WORDS_PER_MINUTE));
}
