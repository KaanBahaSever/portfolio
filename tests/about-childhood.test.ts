/**
 * Where the owner's story starts, in his own words: he was born in Ankara; as a child he took
 * apart and put back together the devices at home and tinkered with electrical and electronic
 * parts and sockets; until his own computer in 2005 he grew up on his cousins' computers,
 * exploring the system and the games; over time that curiosity grew into systems programming and
 * software development. These checks keep those facts in both languages (and no others: no
 * brands, models or ages), keep the childhood entry published and in its place at the start of
 * the timeline, and keep the About intro's list of where the story starts in step with it.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import type { Locale } from '../src/i18n/config.ts';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

/** Prose as a reader meets it: source line breaks and indentation collapse to single spaces. */
const flat = (text: string) => text.replace(/\s+/g, ' ').trim();

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const frontmatter = (path: string) => FRONTMATTER.exec(read(path))?.[1] ?? '';
/** The Markdown body of a content entry, without its frontmatter (which may quote the rules). */
const body = (path: string) => flat(read(path).replace(FRONTMATTER, ''));
/** A top-level frontmatter field, as written (unquoted). */
const field = (path: string, name: string) =>
  new RegExp(`^${name}:\\s*(.*?)\\s*$`, 'm').exec(frontmatter(path))?.[1]?.replace(/^'(.*)'$/, '$1');

const entry: Record<Locale, (id: string) => string> = {
  en: (id) => `src/content/timeline/${id}.md`,
  tr: (id) => `src/content/tr/timeline/${id}.md`,
};

/** Every source file under src/, with its text. */
const sources = readdirSync(new URL('src/', root), { recursive: true, encoding: 'utf8' })
  .map((name) => `src/${name.replaceAll('\\', '/')}`)
  .filter((path) => /\.(md|mdx|astro|ts)$/.test(path))
  .map((path) => ({ path, text: read(path) }));

test('the timeline begins in Ankara, in both languages', () => {
  assert.equal(field(entry.en('2000-born'), 'title'), 'Born in Ankara');
  assert.equal(field(entry.tr('2000-born'), 'title'), 'Ankara’da doğdum');
  // Where he lives today stays in the same entry.
  assert.match(body(entry.en('2000-born')), /Today I live and work in Istanbul\./);
  assert.match(body(entry.tr('2000-born')), /Bugün İstanbul’da yaşıyor ve çalışıyorum\./);
  // No page names another birthplace.
  for (const { path, text } of sources) {
    assert.doesNotMatch(text, /Born in Turkey|Türkiye[’']de doğdum/i, path);
  }
});

test('the childhood entry is published, with no placeholder left', () => {
  const labels: Record<Locale, string> = { en: 'Childhood', tr: 'Çocukluk' };
  const titles: Record<Locale, RegExp> = { en: /a computer of my own$/, tr: /kendi bilgisayarıma$/ };
  for (const locale of ['en', 'tr'] as const) {
    const path = entry[locale]('2005-childhood');
    assert.doesNotMatch(frontmatter(path), /^draft:\s*true/m, `${path}: published`);
    assert.doesNotMatch(read(path), /TODO|placeholder/i, `${path}: no placeholder text`);
    assert.doesNotMatch(frontmatter(path), /^photos:/m, `${path}: no placeholder photo`);
    assert.equal(field(path, 'dateLabel'), labels[locale], path);
    assert.match(field(path, 'title') ?? '', titles[locale], path);
  }
  // The placeholder image went with the draft.
  assert.ok(!existsSync(new URL('src/assets/timeline/first-computer.png', root)));
  for (const { path, text } of sources) assert.ok(!text.includes('first-computer.png'), path);
});

test('the childhood story keeps the owner’s facts in both languages, and adds none', () => {
  const facts: Record<Locale, RegExp[]> = {
    en: [
      /Ever since I was small, I have wanted to know how things work\./,
      /I took apart the devices around the house and put them back together/,
      /electrical and electronic parts/,
      /power sockets/,
      /I got a computer of my own in 2005\./,
      /I grew up tinkering with my cousins’ computers/,
      /exploring the system and the games/,
      /my curiosity about hardware and my urge to explore grew into a love of systems programming and software development/,
    ],
    tr: [
      /Küçüklüğümden beri bir şeylerin nasıl çalıştığını hep merak etmişimdir\./,
      /Evdeki aletleri söküp takar/,
      /elektrik ve elektronik parçaları kurcalardım/,
      /prizler/,
      /2005’te kendi bilgisayarım oldu\./,
      /kuzenlerimin bilgisayarlarını kurcalayarak büyüdüm/,
      /sistemi de oyunları da/,
      /Donanıma ve bir şeyleri keşfetmeye duyduğum bu merak, zamanla sistem programlama ve yazılım geliştirme tutkusuna dönüştü\./,
    ],
  };
  // Born in 2000, he was still a small child in 2005: his own computer is not told as late.
  const late: Record<Locale, RegExp> = { en: /not until|until 2005|only in 2005/i, tr: /ancak|nihayet|sonunda/iu };
  for (const locale of ['en', 'tr'] as const) {
    const text = body(entry[locale]('2005-childhood'));
    for (const fact of facts[locale]) assert.match(text, fact, locale);
    // The only number is the year of his own computer: no ages, models or other dates.
    assert.deepEqual(text.match(/\d+/g), ['2005'], locale);
    assert.doesNotMatch(text, late[locale], locale);
  }
});

test('the timeline starts with the birth, then the childhood, then space', () => {
  const dir = 'src/content/timeline/';
  const dated = readdirSync(new URL(dir, root))
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({ id: name.slice(0, -'.md'.length), date: field(`${dir}${name}`, 'date') ?? '' }))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  assert.deepEqual(
    dated.slice(0, 3).map(({ id }) => id),
    ['2000-born', '2005-childhood', '2015-space'],
  );
  // The childhood entry is ordered by the year its story names.
  assert.equal(new Date(field(entry.en('2005-childhood'), 'date') ?? '').getUTCFullYear(), 2005);
});

test('the About intro starts the story with the childhood tinkering, in one sentence', () => {
  const source = read('src/components/about/prose/Intro.astro');
  const open = source.indexOf("locale === 'tr' ? (");
  const split = source.indexOf(') : (', open);
  assert.ok(open >= 0 && split > open, 'the locale branches were found');
  const last = (branch: string) => flat([...branch.matchAll(/<p>([\s\S]*?)<\/p>/g)].at(-1)?.[1] ?? '');
  const paragraph: Record<Locale, string> = {
    tr: last(source.slice(open, split)),
    en: last(source.slice(split)),
  };
  const start: Record<Locale, RegExp> = {
    en: /^This page follows that thread: from taking things apart as a child, through an early fascination with spaceflight and my first C# programs, to rocket avionics/,
    tr: /^Aşağıda hikâyemi en baştan anlatıyorum: çocukken söküp taktığım aletler, uzay merakım ve ilk C# programlarım, sonra roketler/,
  };
  for (const locale of ['en', 'tr'] as const) {
    assert.match(paragraph[locale], start[locale], locale);
    assert.equal(paragraph[locale].match(/[.!?](?:\s|$)/g)?.length, 1, `${locale}: one sentence`);
  }
});
