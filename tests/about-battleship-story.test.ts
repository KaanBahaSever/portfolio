/**
 * Why the owner made Battleship, in his own words: it was the game he played with his father as a
 * child, which is why he wanted to design his own. These checks keep that story in both languages
 * wherever the site tells how his Battleship came about (the About chapter, the game page and both
 * blog posts), and keep the order of events there: the desktop game came first, the Hunt & Target
 * algorithm later. The game page tells the whole chronology: the first games around 2005, the C#
 * desktop game around 2018 and the 2026 rewrite in TypeScript that is played on the page. The 2019
 * timeline entry sits on the About page under the chapter, so it keeps the order of events but
 * does not repeat the story. The console and the home page's teaser are checked with the rest of
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

/**
 * The algorithm still comes after the desktop game, in the same passage. Turkish writes the
 * site's name for it in lower case ("av ve hedef"), capitalised only at the start of a sentence.
 */
const LATER: Record<Locale, RegExp> = {
  en: /Hunt &(?:amp;)? Target algorithm[^.]* came later/,
  tr: /[Aa]v ve hedef[^.]* sonradan (?:geldi|geliştirdim)/,
};

test('the About chapter tells why Battleship, in both languages', () => {
  const chapter = branches(read('src/components/about/prose/Algorithms.astro'));
  for (const locale of ['en', 'tr'] as const) {
    assert.match(chapter[locale], STORY[locale], locale);
    assert.match(chapter[locale], LATER[locale], locale);
  }
});

test('the 2019 timeline entry keeps the order of events and leaves the story to the chapter above it', () => {
  // The About page shows the journey chapter and then this timeline: the story is told once.
  const entry: Record<Locale, string> = {
    en: body('src/content/timeline/2019-graduation-projects.md'),
    tr: body('src/content/tr/timeline/2019-graduation-projects.md'),
  };
  for (const locale of ['en', 'tr'] as const) {
    assert.match(entry[locale], LATER[locale], locale);
    assert.doesNotMatch(entry[locale], STORY[locale], locale);
    assert.doesNotMatch(entry[locale], /father|babam/, locale);
  }
});

test('both Battleship posts open with why, before the algorithm', () => {
  const post: Record<Locale, string> = {
    en: body('src/content/blog/battleship-hunt-and-target.mdx'),
    tr: body('src/content/blog/amiral-batti-av-ve-hedef.mdx'),
  };
  const after: Record<Locale, RegExp> = {
    en: /hunt & target algorithm[^.]* came later/,
    tr: /av ve hedef algoritması[^.]* sonradan geldi/,
  };
  for (const locale of ['en', 'tr'] as const) {
    assert.match(post[locale], STORY[locale], locale);
    assert.match(post[locale], /github\.com\/KaanBahaSever\/BattleShips/, locale);
    assert.match(post[locale], after[locale], locale);
    // The story comes before the algorithm, as the events did.
    assert.ok(post[locale].search(STORY[locale]) < post[locale].search(after[locale]), locale);
  }
});

/**
 * The game page tells the story as a chronology, so its opening sentence names the year first
 * and the owner's reason follows it ("It was the game…"). The reason keeps his words.
 */
const PAGE_STORY: Record<Locale, RegExp> = {
  en: /It was the game I played with my father as a child, which is why I wanted to design my own/,
  tr: /Çocukken babamla oynadığım oyundu; kendi sürümümü tasarlamak istememin nedeni de bu/,
};

/** Each step of the game page's story, in the order it happened. */
const CHRONOLOGY: Record<Locale, [step: string, pattern: RegExp][]> = {
  en: [
    ['around 2005, the first games on paper and on screen', /around 2005[^.]* on paper and on screen/],
    ['with his father, as a child', PAGE_STORY.en],
    ['around 2018, in high school', /around 2018, my high-school years/],
    ['the desktop game in C#, a graduation project', /desktop game in C#[^.]* graduation projects/],
    ['its source', /href=\{desktopSource\}/],
    ['the algorithm, later', LATER.en],
    ['2026, rewritten from scratch', /In 2026 I rewrote it from scratch/],
    ['in TypeScript, for the browser', /TypeScript, runs in the browser/],
    ['the blog post on how it aims', /href=\{post\}/],
  ],
  tr: [
    ['2005 civarı, kâğıtta ve ekranda ilk oyunlar', /2005 civarında, Amiral Battı’yla hem kâğıtta hem de ekranda/],
    ['babasıyla, çocukken', PAGE_STORY.tr],
    ['2018 civarı, lise yılları', /2018 civarına, lise yıllarıma/],
    ['C#’la masaüstü oyunu, bir bitirme projesi', /C#’la[^.]* masaüstü oyunu[^.]* bitirme projelerimden/],
    ['kaynak kodu', /href=\{desktopSource\}/],
    ['algoritma sonradan', LATER.tr],
    ['2026, sıfırdan', /2026’da oyunu sıfırdan yeniden yazdım/],
    ['TypeScript, tarayıcı', /TypeScript’le[^.]* tarayıcıda çalışıyor/],
    ['nişan almayı anlatan blog yazısı', /href=\{post\}/],
  ],
};

test('the Battleship page tells the story in the order it happened and links the blog post in its own language', () => {
  const guide = read('src/components/games/BattleshipGuide.astro');
  const story = branches(guide, '<Section id="story"');
  for (const locale of ['en', 'tr'] as const) {
    let previous = -1;
    for (const [step, pattern] of CHRONOLOGY[locale]) {
      const at = story[locale].search(pattern);
      assert.ok(at >= 0, `${locale}: ${step} is told`);
      assert.ok(at > previous, `${locale}: ${step} comes after the step before it`);
      previous = at;
    }
    // Programming started in 2016: the 2018 game came while he was still new to it.
    assert.match(story[locale], /still new to programming|Programlamada henüz acemiyken/, locale);
    assert.doesNotMatch(story[locale], /(?:started|began) programming|programlamaya başla/i, locale);
    // The game on this site is TypeScript in the browser, and its opponent is an algorithm.
    assert.match(story[locale], /opponent decides where to fire with an algorithm|Bilgisayar rakip, nereye ateş edeceğine bir algoritmayla karar/, locale);
    assert.doesNotMatch(
      story[locale],
      /C\+\+|machine learning|neural|trained|\bAI\b|makine öğrenme|yapay zek|sinir ağı|eğitilmiş/i,
      `${locale}: no C++ and no machine learning`,
    );
    assert.doesNotMatch(story[locale], /engineer|mühendis/i, `${locale}: the owner is not called an engineer`);
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
