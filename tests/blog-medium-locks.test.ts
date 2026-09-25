import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { planSync, readFrontmatter } from '../scripts/medium/frontmatter.ts';

const BLOG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content', 'blog');

/** An HTML element with a lang attribute, e.g. <span lang="en">. */
const LANG_ATTRIBUTE = /<[a-z][^>]*\slang\s*=\s*["']?[a-z]/i;

/**
 * Medium's HTML never carries lang attributes, so a `lang` in an imported post is a hand edit
 * (an English quote inside Turkish prose, WCAG 3.1.2). `npm run sync:medium` rewrites the body
 * of every post that is not locked, which would silently drop it.
 */
test('Medium imports with hand-marked language parts are locked against a re-sync', async () => {
  const names = (await readdir(BLOG_DIR)).filter((name) => name.endsWith('.md'));
  let imports = 0;
  for (const name of names) {
    const frontmatter = readFrontmatter(await readFile(path.join(BLOG_DIR, name), 'utf8'));
    if (frontmatter?.values.source !== 'medium') continue;
    imports += 1;
    if (!LANG_ATTRIBUTE.test(frontmatter.body)) continue;
    assert.equal(frontmatter.values.mediumSync, false, `${name} marks a language part by hand but lacks mediumSync: false`);
    assert.equal(planSync(frontmatter.values, new Date('2100-01-01T00:00:00Z'), true), 'skip-locked', name);
  }
  assert.ok(imports > 0, 'expected at least one Medium import in src/content/blog');
});

test('the English quote in “Ay’dan Anıtkabir’e Yolculuk” is marked as English', async () => {
  const source = await readFile(path.join(BLOG_DIR, 'aydan-anitkabir-e-yolculuk.md'), 'utf8');
  const frontmatter = readFrontmatter(source);
  assert.ok(frontmatter);
  assert.match(frontmatter.body, /“<span lang="en">One small step for a man, one giant leap for mankind\.<\/span>”/);
});
