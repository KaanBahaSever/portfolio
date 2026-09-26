/**
 * Turkish typography of the collision post and its figures: suffixes after a name, a letter or an
 * abbreviation take the typographic apostrophe (A’nın, SVG’de, MTV’yi), never a straight one.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { collisionMessages } from '../src/components/blog/posts/collision/messages.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The prose of an MDX post: no frontmatter, imports, fenced code or inline code. */
async function prose(file: string): Promise<string> {
  const source = await readFile(path.join(ROOT, file), 'utf8');
  return source
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
    .replace(/^import .*$/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '');
}

/** Every string in a message catalogue, functions called with a placeholder. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') return [String((value as (...args: string[]) => string)('X', 'Y'))];
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

/** A straight apostrophe glued to a Turkish suffix: A'nın, SVG'de, $B$'yi. */
const STRAIGHT_SUFFIX = /[\p{L}\p{N}$)}]'\p{Ll}/u;

test('the Turkish collision post uses the typographic apostrophe', async () => {
  const text = await prose('src/content/blog/etkilesimli-2b-carpisma-tespiti.mdx');
  assert.doesNotMatch(text, STRAIGHT_SUFFIX);
  assert.match(text, /A’nın/);
});

test('the Turkish figure text uses the typographic apostrophe', () => {
  for (const text of strings(collisionMessages.tr)) {
    assert.doesNotMatch(text, STRAIGHT_SUFFIX, text);
    assert.ok(!text.includes("'"), text);
  }
});
