/**
 * Tab completion, bash style: the first Tab completes a unique match or extends the word to
 * the longest prefix all matches share; when nothing more can be added, the candidates are
 * returned so the page can list them.
 *
 * Pure module: no DOM, erasable TypeScript only.
 */
import { ARGUMENT_KINDS, COMMANDS, resolveCommand } from './commands.ts';
import type { ArgumentKind, ProjectRef } from './commands.ts';
import { quoteWord, scan } from './tokenize.ts';
import { listEntries, lookup, resolvePath } from './vfs.ts';
import type { DirNode, FsPath } from './vfs.ts';

export interface CompletionContext {
  cwd: FsPath;
  root: DirNode;
  projects: readonly Pick<ProjectRef, 'id'>[];
}

export interface Completion {
  /** The text before the cursor after completion (unchanged when there is nothing to add). */
  text: string;
  /** Every match, as the visitor would type it (directories end in '/'). */
  candidates: string[];
}

/** Longest prefix shared by every value ('' for an empty list). */
export function commonPrefix(values: readonly string[]): string {
  if (values.length === 0) return '';
  let prefix = values[0]!;
  for (const value of values.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < value.length && prefix[i] === value[i]) i++;
    prefix = prefix.slice(0, i);
  }
  return prefix;
}

interface Word {
  /** Offset where the word starts in the line (the line's end for a word not yet begun). */
  start: number;
  value: string;
  /** Position among the line's words: 0 is the command. */
  index: number;
  command: string | undefined;
}

function currentWord(before: string): Word {
  const { tokens, trailingSpace } = scan(before);
  const command = tokens[0]?.value;
  if (trailingSpace || tokens.length === 0) {
    return { start: before.length, value: '', index: tokens.length, command };
  }
  const last = tokens[tokens.length - 1]!;
  return { start: last.start, value: last.value, index: tokens.length - 1, command };
}

/**
 * Completes the word that ends at the cursor. `before` is the text before the cursor; the
 * caller keeps whatever follows it.
 */
export function complete(before: string, ctx: CompletionContext): Completion {
  const word = currentWord(before);
  const head = before.slice(0, word.start);

  let kind: ArgumentKind | undefined;
  if (word.index === 0) {
    kind = 'commands';
  } else {
    const command = word.command === undefined ? undefined : resolveCommand(word.command);
    kind = command ? ARGUMENT_KINDS[command] : undefined;
  }
  if (!kind) return { text: before, candidates: [] };

  if (kind === 'commands' || kind === 'projects') {
    const names = kind === 'commands' ? [...COMMANDS] : ctx.projects.map((project) => project.id);
    // Commands are matched case-insensitively (resolveCommand accepts 'LS'); ids are lowercase.
    const typed = word.value.toLowerCase();
    const matches = names.filter((name) => name.startsWith(typed)).sort();
    return finish(before, head, word.value, '', matches, (match) => `${quoteWord(match)} `);
  }

  // Paths: complete the last segment inside the directory the earlier segments name.
  const slash = word.value.lastIndexOf('/');
  const dirPart = word.value.slice(0, slash + 1);
  const namePart = word.value.slice(slash + 1);
  const found = lookup(ctx.root, resolvePath(ctx.cwd, dirPart));
  if (!found.ok || found.node.kind !== 'dir') return { text: before, candidates: [] };

  const entries = listEntries(found.node).filter(
    (entry) => entry.name.startsWith(namePart) && (kind !== 'directories' || entry.dir),
  );
  const matches = entries.map((entry) => (entry.dir ? `${entry.name}/` : entry.name));
  // A directory keeps the cursor inside the word (to go on with its contents); a file ends it.
  return finish(before, head, word.value, dirPart, matches, (match) =>
    match.endsWith('/') ? quoteWord(dirPart + match) : `${quoteWord(dirPart + match)} `,
  );
}

/**
 * @param before  the original text, returned untouched when nothing can be added
 * @param head    the text before the word being completed
 * @param typed   the word as typed (after quote removal)
 * @param dirPart the directory part of a path word ('projects/'), kept in front of every match
 * @param whole   how a unique match is written back (with a trailing space when it ends the word)
 */
function finish(
  before: string,
  head: string,
  typed: string,
  dirPart: string,
  matches: string[],
  whole: (match: string) => string,
): Completion {
  if (matches.length === 0) return { text: before, candidates: [] };
  if (matches.length === 1) return { text: head + whole(matches[0]!), candidates: matches };

  const extended = dirPart + commonPrefix(matches);
  // Only ever lengthen the word; otherwise leave the line alone and let the caller list matches.
  if (extended.length > typed.length) return { text: head + quoteWord(extended), candidates: matches };
  return { text: before, candidates: matches };
}
