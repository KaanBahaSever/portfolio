/**
 * Copy checks for the About page that are easy to regress when the text is edited: the Turkish
 * spelling of suffixes on institution names, the language of English terms inside Turkish
 * prose, and the name the résumé card uses for the home page's skills section.
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

/** The Turkish text of the About page: the Turkish timeline, the prose partials and the catalogue. */
const turkishSources = [
  ...filesIn('src/content/tr/timeline/', '.md'),
  ...filesIn('src/components/about/', '.astro'),
  { path: 'src/i18n/messages/about.ts', text: readFileSync(new URL('src/i18n/messages/about.ts', root), 'utf8') },
];

test('the Turkish sources were found', () => {
  assert.ok(turkishSources.some((file) => file.path.endsWith('05-crowd-inc.md')));
  assert.ok(turkishSources.some((file) => file.path.endsWith('prose/Intro.astro')));
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

test('the English crowd.inc job title in the Turkish timeline is marked lang="en"', () => {
  const title = 'Full-Stack Software Engineer / Systems Contributor';
  const english = LOCALE_META.en.htmlLang;
  for (const { path, text } of filesIn('src/content/tr/timeline/', '.md')) {
    const body = text.replace(/^---[\s\S]*?\n---/, '');
    const bare = body.replaceAll(`<span lang="${english}">${title}</span>`, '');
    assert.ok(!bare.includes(title), `${path}: wrap "${title}" in <span lang="${english}">`);
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
