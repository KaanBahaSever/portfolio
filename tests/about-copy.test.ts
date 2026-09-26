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
  for (const term of ['Hunt &amp; Target', 'pipeline', 'multi-tenant', 'header-only', 'zero-copy', 'Solver']) {
    for (const { path, text } of filesIn('src/content/tr/timeline/', '.md')) {
      const body = visibleText(text).replace(/^---[\s\S]*?\n---/, '');
      const bare = body.replaceAll(`<span lang="${english}">${term}</span>`, '');
      assert.ok(!bare.includes(term), `${path}: wrap "${term}" in <span lang="${english}">`);
    }
  }
});

/**
 * The Turkish the owner writes himself: the Turkish timeline and the Turkish branch of every
 * prose partial (the text between `locale === 'tr' ? (` and `) : (`).
 */
const ownTurkish = [
  ...filesIn('src/content/tr/timeline/', '.md').map(({ path, text }) => ({ path, text: visibleText(text) })),
  ...filesIn('src/components/about/prose/', '.astro').map(({ path, text }) => {
    const open = text.indexOf("locale === 'tr' ? (");
    const split = text.indexOf(') : (', open);
    assert.ok(open >= 0 && split > open, `${path}: the Turkish branch was found`);
    return { path, text: visibleText(text.slice(open, split)) };
  }),
];

test('the Turkish About text is plain Turkish, not translated officialese', () => {
  // The owner asked for simple, everyday sentences. These words are the calques and filler of a
  // literal translation ("crowd.inc bünyesinde", "yaşam döngüsünü uçtan uca üstlendim").
  const stiff =
    /bünyesinde|uçtan uca|ortaya koy|gerçekleştir|söz konusu|itibar[ıi]yla|kapsamında|yönelik|yaşam döngüsü|sahip oldu/iu;
  for (const { path, text } of ownTurkish) {
    const match = stiff.exec(text);
    assert.equal(match, null, `${path}: "${match?.[0]}" reads as a translation; say it plainly`);
  }
});

test('suffixes in the Turkish About text take the typographic apostrophe', () => {
  // 2019’da, GitHub’da, crowd.inc’te: never a typewriter apostrophe before a suffix.
  for (const { path, text } of ownTurkish) {
    const match = /[\p{L}\d)]'\p{Ll}/u.exec(text);
    assert.equal(match, null, `${path}: "${match?.[0]}" should use ’`);
  }
  const entry = ownTurkish.find(({ path }) => path.endsWith('2021-crowd-inc.md'));
  assert.match(entry?.text ?? '', /^title: crowd\.inc’te yazılım geliştirici\r?$/m);
});

test('the crowd.inc chapter and timeline entry open with what the site was, in both languages', () => {
  // The owner's words: a site for sharing ideas and finding help for them, with hundreds of
  // users, many projects, ideas and goals, and a later turn towards private ideas.
  const work = file('src/components/about/prose/Work.astro').text;
  const split = work.indexOf(') : (');
  const turkish = [
    visibleText(work.slice(work.indexOf("locale === 'tr' ? ("), split)),
    visibleText(file('src/content/tr/timeline/2021-crowd-inc.md').text),
  ];
  const english = [visibleText(work.slice(split)), visibleText(file('src/content/timeline/2021-crowd-inc.md').text)];
  const flat = (text: string) => text.replace(/\s+/g, ' ');
  for (const text of english.map(flat)) {
    assert.match(text, /crowd\.inc was a website (for sharing ideas and finding help for them|where people shared their ideas and found help for them)/);
    for (const fact of [/hundreds of users/, /many projects/, /ideas and goals/, /we turned towards private ideas/]) {
      assert.match(text, fact);
    }
    // The opening comes before what he did there.
    assert.ok(text.indexOf('private ideas') < text.indexOf('I owned'), 'what crowd.inc was, then the role');
  }
  for (const text of turkish.map(flat)) {
    assert.match(text, /crowd\.inc, insanların fikirlerini paylaşıp bu fikirler için yardım bulduğu bir web sitesiydi/);
    for (const fact of [/Yüzlerce kullanıcısı vardı/, /birçok projeye/, /(fikir|fikre) ve hedef/, /özel fikirlere yöneldik/]) {
      assert.match(text, fact);
    }
    assert.ok(text.indexOf('özel fikirlere') < text.indexOf('Geliştirme sürecinin'), 'what crowd.inc was, then the role');
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
