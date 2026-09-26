/**
 * Why the owner made Battleship, in his own words: it was the game he played with his father as a
 * child, which is why he wanted to design his own. These checks keep that story in both languages
 * wherever the site tells how his Battleship came about (the About chapter, the timeline entry and
 * the game page), and keep the order of events there: the desktop game came first, the Hunt &
 * Target algorithm later. The console and the home page's teaser are checked with the rest of
 * their copy (tests/console-data.test.ts, tests/resume-copy.test.ts).
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import type { Locale } from '../src/i18n/config.ts';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

/** Prose as a reader meets it: source line breaks and indentation collapse to single spaces. */
const flat = (text: string) => text.replace(/\s+/g, ' ');

/**
 * The two branches of the first `locale === 'tr' ? ( … ) : ( … )` in `source` (after `from`,
 * when given): Turkish first, English second. The English branch runs to the end of the block.
 */
function branches(source: string, from = ''): Record<Locale, string> {
  const start = source.indexOf(from);
  assert.ok(start >= 0, `"${from}" was found`);
  const rest = source.slice(start);
  const open = rest.indexOf("locale === 'tr' ? (");
  const split = rest.indexOf(') : (', open);
  const close = rest.indexOf('</Section>', split);
  assert.ok(open >= 0 && split > open, 'the locale branches were found');
  return {
    tr: flat(rest.slice(open, split)),
    en: flat(rest.slice(split, close === -1 ? undefined : close)),
  };
}

/** The Markdown body of a content entry, without its frontmatter (which may quote the rules). */
const body = (path: string) => flat(read(path).replace(/^---\r?\n[\s\S]*?\r?\n---/, ''));

const STORY: Record<Locale, RegExp> = {
  en: /Battleship was the game I played with my father as a child, which is why I wanted to design my own/,
  tr: /Amiral Battı, çocukken babamla oynadığım oyundu; kendi sürümümü tasarlamak istememin nedeni de bu/,
};

/** The algorithm still comes after the desktop game, in the same passage. */
const LATER: Record<Locale, RegExp> = {
  en: /Hunt &(?:amp;)? Target algorithm[^.]* came later/,
  tr: /(?:Av ve Hedef|av ve hedef)[^.]* sonradan (?:geldi|geliştirdim)/,
};

test('the About chapter tells why Battleship, in both languages', () => {
  const chapter = branches(read('src/components/about/prose/Algorithms.astro'));
  for (const locale of ['en', 'tr'] as const) {
    assert.match(chapter[locale], STORY[locale], locale);
    assert.match(chapter[locale], LATER[locale], locale);
  }
});

test('the 2019 timeline entry tells why Battleship, in both languages', () => {
  const entry: Record<Locale, string> = {
    en: body('src/content/timeline/2019-graduation-projects.md'),
    tr: body('src/content/tr/timeline/2019-graduation-projects.md'),
  };
  for (const locale of ['en', 'tr'] as const) {
    assert.match(entry[locale], STORY[locale], locale);
    assert.match(entry[locale], LATER[locale], locale);
    // The story comes before the algorithm, as the events did.
    assert.ok(entry[locale].search(STORY[locale]) < entry[locale].search(LATER[locale]), locale);
  }
});

test('the Battleship page tells the story and links the blog post in its own language', () => {
  const guide = read('src/components/games/BattleshipGuide.astro');
  const story = branches(guide, '<Section id="story"');
  for (const locale of ['en', 'tr'] as const) {
    assert.match(story[locale], STORY[locale], locale);
    assert.match(story[locale], LATER[locale], locale);
    assert.match(story[locale], /href=\{post\}/, `${locale}: the blog post is linked`);
  }

  // The post paths the guide picks per language: each is a published post written in that language.
  const paths = /locale === 'tr' \? '(\/blog\/[^']+\/)' : '(\/blog\/[^']+\/)'/.exec(guide);
  assert.ok(paths, 'the blog post paths were found');
  const [, trPath = '', enPath = ''] = paths;
  for (const [locale, path] of [
    ['tr', trPath],
    ['en', enPath],
  ] as const) {
    const id = path.slice('/blog/'.length, -1);
    const file = ['.mdx', '.md'].map((ext) => `src/content/blog/${id}${ext}`).find((f) => existsSync(new URL(f, root)));
    assert.ok(file, `${locale}: ${path} is a post`);
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(read(file))?.[1] ?? '';
    assert.match(frontmatter, new RegExp(`^lang: ${locale}$`, 'm'), `${file} is written in ${locale}`);
    assert.doesNotMatch(frontmatter, /^draft: true$/m, `${file} is published`);
  }
});
