/**
 * Copy checks for the About page that are easy to regress when the text is edited: the Turkish
 * spelling of suffixes on institution names, the owner's title (a developer, never an
 * engineer), facts that newer ones replaced, the pairing of English timeline entries with their
 * Turkish overlays, and the name the résumé card uses for the home page's skills section.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { LOCALE_META, LOCALES } from '../src/i18n/config.ts';
import { aboutMessages } from '../src/i18n/messages/about.ts';
import { homeMessages } from '../src/i18n/messages/home.ts';

const root = new URL('../', import.meta.url);

/** Every file under `dir` (relative to the repository root) whose name ends with `ext`. */
function filesIn(dir: string, ext: string): { path: string; text: string }[] {
  const base = new URL(dir, root);
  return readdirSync(base, { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith(ext))
    .map((name) => {
      const path = `${dir}${name.replaceAll('\\', '/')}`;
      return { path, text: readFileSync(new URL(name.replaceAll('\\', '/'), base), 'utf8') };
    });
}

const file = (path: string) => ({ path, text: readFileSync(new URL(path, root), 'utf8') });

/** The Turkish text of the About page: the Turkish timeline, the prose partials and the catalogue. */
const turkishSources = [
  ...filesIn('src/content/tr/timeline/', '.md'),
  ...filesIn('src/components/about/', '.astro'),
  file('src/i18n/messages/about.ts'),
];

/** Everything the About page is written from, in both languages. */
const aboutSources = [
  ...filesIn('src/content/timeline/', '.md'),
  ...filesIn('src/content/tr/timeline/', '.md'),
  ...filesIn('src/components/about/', '.astro'),
  file('src/i18n/messages/about.ts'),
  file('src/pages/[...lang]/about.astro'),
];

/**
 * The text a reader can see: source comments removed (block, HTML and whole-line comments, and
 * YAML comments inside the frontmatter), because comments may quote the rules they enforce.
 */
function visibleText(text: string): string {
  return text
    .replace(/^---\r?\n[\s\S]*?\r?\n---/, (frontmatter) => frontmatter.replace(/^\s*#.*$/gm, ''))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** Every string in a message catalogue, calling message functions with sample arguments. */
function catalogueStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') return [String(value('1', '2')), String(value(2))];
  if (value && typeof value === 'object') return Object.values(value).flatMap(catalogueStrings);
  return [];
}

test('the sources were found', () => {
  assert.ok(turkishSources.some((source) => source.path.endsWith('2021-crowd-inc.md')));
  assert.ok(turkishSources.some((source) => source.path.endsWith('prose/Intro.astro')));
  assert.ok(aboutSources.some((source) => source.path === 'src/content/timeline/2019-rocket-club.md'));
});

test('suffixes on institution names are not split off with an apostrophe (TDK)', () => {
  // TDK: "Kurum, kuruluş ve iş yeri adlarına gelen ekler kesme işaretiyle ayrılmaz", so
  // "İstanbul Üniversitesinde", "Roket Kulübünün", as on the home page and in the console.
  const split = /(Üniversitesi|Kulübü|Fakültesi|Vakfı|Kurumu|Derneği|Enstitüsü|Bakanlığı)[’']\p{Ll}/u;
  for (const { path, text } of turkishSources) {
    const match = split.exec(text);
    assert.equal(match, null, `${path}: "${match?.[0]}" should be written without the apostrophe`);
  }
});

test('the owner is a developer: no "engineer" or "mühendis" in the About page text', () => {
  // Other people keep their titles: the CCIE-certified guest of Cyber Security Week.
  // Markdown bodies wrap lines, so any whitespace may separate the words.
  const allowed = [/network\s+security\s+engineer/gi, /ağ\s+güvenliği\s+mühendis\p{L}*/giu];
  const banned = /engineer|mühendis/iu;
  const clean = (text: string) => allowed.reduce((rest, phrase) => rest.replace(phrase, ''), text);

  for (const { path, text } of aboutSources) {
    const match = banned.exec(clean(visibleText(text)));
    assert.equal(match, null, `${path}: "${match?.[0]}" describes the owner as an engineer`);
  }
  for (const locale of LOCALES) {
    for (const value of catalogueStrings(aboutMessages[locale])) {
      assert.doesNotMatch(clean(value), banned, `about.ts (${locale}): "${value}"`);
    }
  }
});

test('facts that newer ones replaced do not come back', () => {
  const superseded: [RegExp, string][] = [
    [/high-power launch|yüksek güçlü fırlatma/i, 'the club designed and built 1 low- and 2 high-altitude rockets'],
    [/Systems Contributor|full-stack/i, 'the crowd.inc title is Software Developer'],
    [/different codebase|separate codebase|kod tabanı farklı|ayrı bir kod tabanı/i, 'Rocket-Up is the simulation, rewritten'],
    [/\b(Swift|Antizan|Aydos)\b/, 'the Swift role was removed from the portfolio'],
  ];
  for (const { path, text } of aboutSources) {
    const visible = visibleText(text);
    for (const [pattern, fact] of superseded) {
      const match = pattern.exec(visible);
      assert.equal(match, null, `${path}: "${match?.[0]}" is outdated (${fact})`);
    }
  }
});

test('every English timeline entry has a Turkish overlay with the same file name, and vice versa', () => {
  const names = (dir: string) =>
    filesIn(dir, '.md')
      .map(({ path }) => path.slice(dir.length))
      .sort();
  assert.deepEqual(names('src/content/tr/timeline/'), names('src/content/timeline/'));
});

test('English terms inside the Turkish timeline are marked lang="en"', () => {
  const english = LOCALE_META.en.htmlLang;
  for (const term of ['Hunt &amp; Target', 'pipeline']) {
    for (const { path, text } of filesIn('src/content/tr/timeline/', '.md')) {
      const body = visibleText(text).replace(/^---[\s\S]*?\n---/, '');
      const bare = body.replaceAll(`<span lang="${english}">${term}</span>`, '');
      assert.ok(!bare.includes(term), `${path}: wrap "${term}" in <span lang="${english}">`);
    }
  }
});

test('the résumé card names the home page skills section the way its heading does', () => {
  for (const locale of LOCALES) {
    const intl = LOCALE_META[locale].intl;
    const heading = homeMessages[locale].background.skills.toLocaleLowerCase(intl);
    assert.ok(
      aboutMessages[locale].resume.text.toLocaleLowerCase(intl).includes(heading),
      `${locale}: "${aboutMessages[locale].resume.text}" should say "${heading}"`,
    );
  }
});
