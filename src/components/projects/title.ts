/**
 * Line breaking for project titles such as "Rocket-Up — High-Power Rocket Simulation".
 *
 * Browsers may end a line after any hyphen, which leaves "High-" dangling at the end of a line
 * in a large serif heading, or starts a line with "—". titleRuns() splits a title into runs:
 * compound words are marked `keep` (render them with white-space: nowrap), and the space
 * before a dash becomes a no-break space, so the dash stays with the word before it. Words
 * longer than MAX_KEEP characters are left breakable, so a long name can never overflow a
 * narrow screen.
 *
 * Pure module (no `astro:*` imports, erasable TypeScript) so `node --test` can load it.
 */

export interface TitleRun {
  text: string;
  /** True for a compound word that should not break at its hyphen. */
  keep: boolean;
}

const MAX_KEEP = 24;
const NO_BREAK_SPACE = ' ';

export function titleRuns(title: string): TitleRun[] {
  const text = title.replace(/ ([—–]) /g, `${NO_BREAK_SPACE}$1 `);
  const runs: TitleRun[] = [];
  // Split on ordinary whitespace only: \s would also match the no-break space added above.
  for (const part of text.split(/([ \t\r\n]+)/)) {
    if (part === '') continue;
    const keep = !/^[ \t\r\n]+$/.test(part) && part.includes('-') && part.length <= MAX_KEEP;
    const previous = runs.at(-1);
    if (!keep && previous && !previous.keep) previous.text += part;
    else runs.push({ text: part, keep });
  }
  return runs;
}
