/**
 * Reading and writing the frontmatter of imported posts, and deciding what a sync does.
 *
 * Only the frontmatter the sync itself writes needs parsing, plus whatever a person may have
 * added by hand, so this is a line-based reader for top-level keys, not a YAML library:
 * - every value is written with JSON.stringify (a JSON string, array or boolean is valid YAML,
 *   and it quotes ’ ı : # safely);
 * - a hand-edited key is kept byte for byte (its raw lines), so any YAML form survives a sync.
 *
 * Pure module (no I/O).
 */

export interface FrontmatterChunk {
  /** Top-level key, or '' for comments after the last key. */
  key: string;
  /** The key's lines as written: leading comments, `key: value` and indented continuations. */
  raw: string;
}

export interface Frontmatter {
  chunks: FrontmatterChunk[];
  /** Scalar values of the top-level keys (strings, booleans, arrays of strings). */
  values: Record<string, unknown>;
  /** Everything after the closing `---`. */
  body: string;
}

/** Splits a Markdown file into its frontmatter chunks and body; undefined without frontmatter. */
export function readFrontmatter(source: string): Frontmatter | undefined {
  const text = source.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  // The closing fence must be a line of its own ("title: a---" does not end the block).
  const match = /^---\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n|$)/.exec(text);
  if (!match) return undefined;
  const lines = (match[1] ?? '').split('\n');
  const chunks: FrontmatterChunk[] = [];
  let pending: string[] = [];
  for (const line of lines) {
    const key = /^([A-Za-z_][\w-]*)\s*:(?:\s|$)/.exec(line)?.[1];
    if (key) {
      chunks.push({ key, raw: [...pending, line].join('\n') });
      pending = [];
    } else if (/^\s*#/.test(line) && !/^\s/.test(line)) {
      // A comment at the margin introduces the next key.
      pending.push(line);
    } else if (chunks.length > 0 && pending.length === 0) {
      const last = chunks[chunks.length - 1] as FrontmatterChunk;
      last.raw += `\n${line}`;
    } else {
      pending.push(line);
    }
  }
  if (pending.some((line) => line.trim() !== '')) chunks.push({ key: '', raw: pending.join('\n') });

  const values: Record<string, unknown> = {};
  for (const chunk of chunks) {
    if (chunk.key) values[chunk.key] = parseValue(chunk);
  }
  return { chunks, values, body: text.slice(match[0].length) };
}

function unquote(value: string): string {
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
  return value;
}

/** The value of one chunk: quoted and plain scalars, booleans, flow and block lists, block scalars. */
function parseValue(chunk: FrontmatterChunk): unknown {
  const lines = chunk.raw.split('\n');
  const keyPattern = new RegExp(`^${chunk.key}\\s*:`);
  const keyIndex = lines.findIndex((line) => keyPattern.test(line));
  const first = (lines[keyIndex] ?? '').replace(/^[^:]*:/, '').trim();
  const rest = lines.slice(keyIndex + 1);
  const value = /^["'[]/.test(first) ? first : first.replace(/\s+#.*$/, '');

  if (value === '') {
    const items = rest.map((line) => /^\s*-\s+(.*)$/.exec(line)?.[1]).filter((item): item is string => item !== undefined);
    if (items.length > 0) return items.map((item) => unquote(item.trim()));
    return undefined;
  }
  if (/^[|>][+-]?$/.test(value)) {
    const content = rest.map((line) => line.trim());
    return value.startsWith('|') ? content.join('\n').trim() : content.join(' ').replace(/\s+/g, ' ').trim();
  }
  if (value.startsWith('[')) {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value
        .slice(1, -1)
        .split(',')
        .map((item) => unquote(item.trim()))
        .filter(Boolean);
    }
  }
  if (value === 'true' || value === 'false') return value === 'true';
  if (value === 'null' || value === '~') return null;
  if (value.startsWith('"') || value.startsWith("'")) return unquote(value);
  // A plain scalar may continue on indented lines.
  return [value, ...rest.map((line) => line.trim())].join(' ').trim();
}

/** Keys the sync writes from the feed. Everything else in an existing file is kept as it is. */
export const MANAGED_KEYS = [
  'title',
  'description',
  'pubDate',
  'updatedDate',
  'lang',
  'tags',
  'heroImage',
  'heroImageAlt',
  'heroImageCaption',
  'source',
  'mediumId',
  'mediumUrl',
  'canonicalUrl',
  'mediumUpdated',
] as const;

export type ManagedKey = (typeof MANAGED_KEYS)[number];

/**
 * Managed keys whose existing value wins: the feed has no description, its language is a guess,
 * Medium leaves alt text empty and its tags are lowercase slugs ("atatürk", "apollo-11"), so
 * these are usually written by hand after the first import and must survive a re-sync.
 */
export const CURATED_KEYS: ReadonlySet<ManagedKey> = new Set<ManagedKey>(['description', 'lang', 'tags', 'heroImageAlt']);

export type FrontmatterValue = string | boolean | Date | readonly string[] | undefined;

const HEADER =
  '# Imported from Medium by `npm run sync:medium` (description, lang, tags, alt texts and unmanaged keys survive a re-sync; set mediumSync: false to freeze the body too).';

function serialize(value: Exclude<FrontmatterValue, undefined>): string {
  return JSON.stringify(value instanceof Date ? value.toISOString() : value);
}

/**
 * Renders the frontmatter block. `fields` lists the managed keys in output order; `existing`
 * (the current file, when updating) contributes its curated keys and every unmanaged key.
 */
export function renderFrontmatter(
  fields: ReadonlyArray<readonly [ManagedKey, FrontmatterValue]>,
  existing?: Frontmatter,
): string {
  const lines = [HEADER];
  const managed = new Set<string>(MANAGED_KEYS);
  for (const [key, value] of fields) {
    const kept = CURATED_KEYS.has(key) ? existing?.chunks.find((chunk) => chunk.key === key) : undefined;
    if (kept) lines.push(stripComments(kept.raw));
    else if (value !== undefined) lines.push(`${key}: ${serialize(value)}`);
  }
  for (const chunk of existing?.chunks ?? []) {
    if (chunk.key && !managed.has(chunk.key)) lines.push(chunk.raw);
  }
  return `---\n${lines.join('\n')}\n---\n`;
}

/** Drops the margin comments in front of a kept key (the header comment is written anew). */
function stripComments(raw: string): string {
  const lines = raw.split('\n');
  const start = lines.findIndex((line) => !/^#/.test(line));
  return lines.slice(Math.max(0, start)).join('\n');
}

export type SyncAction = 'create' | 'update' | 'skip-up-to-date' | 'skip-locked';

/**
 * What to do with a feed item, given the frontmatter of the file that already holds it:
 * - no file yet → create;
 * - `mediumSync: false` → never touch it (hand-curated), even with --force;
 * - `mediumUpdated` at or after the feed's `atom:updated` → nothing new, unless forced.
 */
export function planSync(existing: Record<string, unknown> | undefined, updated: Date, force = false): SyncAction {
  if (!existing) return 'create';
  if (existing.mediumSync === false) return 'skip-locked';
  if (force) return 'update';
  const known = typeof existing.mediumUpdated === 'string' ? new Date(existing.mediumUpdated) : undefined;
  if (known && !Number.isNaN(known.valueOf()) && known.valueOf() >= updated.valueOf()) return 'skip-up-to-date';
  return 'update';
}
