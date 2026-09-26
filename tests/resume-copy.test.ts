/**
 * The words around the résumé: the home page and 404 catalogues, plus the résumé data itself.
 * Checks that both languages have the same shape and that the copy keeps the site's voice.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HEADLINE_SEPARATOR, headlineParts } from '../src/components/home/headline.ts';
import { SITE } from '../src/config/site.ts';
import * as resume from '../src/data/resume.ts';
import { aboutMessages } from '../src/i18n/messages/about.ts';
import { common } from '../src/i18n/messages/common.ts';
import { JOURNEY_CHAPTERS, homeMessages } from '../src/i18n/messages/home.ts';
import { NOT_FOUND_LINKS, notFoundMessages } from '../src/i18n/messages/not-found.ts';
import { cvLink } from '../src/utils/cv.ts';

const CATALOGUES = { home: homeMessages, notFound: notFoundMessages };

/** A structural fingerprint: keys, value kinds and function arity, but not the text. */
function shape(value: unknown): unknown {
  if (typeof value === 'function') return `function/${value.length}`;
  if (Array.isArray(value)) return value.length === 0 ? 'array' : ['array', shape(value[0])];
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, shape(child)]),
    );
  }
  return typeof value;
}

/** Every string in a value, including the results of message functions called with sample arguments. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') {
    const args = Array.from({ length: value.length }, (_, i) => (i === 0 ? '41.01' : 'x'));
    return strings((value as (...a: unknown[]) => unknown)(...args));
  }
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

for (const [name, catalogue] of Object.entries(CATALOGUES)) {
  test(`${name}: the Turkish catalogue has exactly the English shape`, () => {
    assert.deepEqual(shape(catalogue.tr), shape(catalogue.en));
  });

  test(`${name}: no message is empty in either language`, () => {
    for (const locale of ['en', 'tr'] as const) {
      for (const text of strings(catalogue[locale])) assert.ok(text.trim().length > 0, `${name}.${locale}: empty text`);
    }
  });
}

test('every journey chapter and every 404 suggestion has text', () => {
  for (const locale of ['en', 'tr'] as const) {
    for (const key of JOURNEY_CHAPTERS) {
      assert.ok(homeMessages[locale].journey.chapters[key].title, `${locale}: chapter ${key} has no title`);
      assert.ok(homeMessages[locale].journey.chapters[key].text, `${locale}: chapter ${key} has no text`);
    }
    for (const key of NOT_FOUND_LINKS) assert.ok(notFoundMessages[locale].links[key], `${locale}: 404 link ${key}`);
  }
});

test('Turkish interpolations stand alone (no case suffix glued to a value)', () => {
  const tr = homeMessages.tr;
  assert.equal(tr.hero.coordinates('41,01', '28,98'), '41,01° K, 28,98° D');
  assert.equal(tr.journey.chapter(3), 'Bölüm 3');
  assert.equal(tr.background.degree('Lisans', 'Matematik'), 'Matematik (Lisans)');
  assert.equal(homeMessages.en.background.degree('Bachelor of Science', 'Mathematics'), 'Bachelor of Science in Mathematics');
});

test('the games are not described as search algorithms (only tic-tac-toe searches)', () => {
  // Battleship's opponent is a probability-density heuristic; "algorithmic opponents" covers both.
  const all = Object.values(CATALOGUES).flatMap((catalogue) => [...strings(catalogue.en), ...strings(catalogue.tr)]);
  for (const text of all) assert.doesNotMatch(text, /search algorithm|arama algoritma/i, text);
  assert.match(homeMessages.en.playground.lead, /algorithmic opponents/);
  assert.match(notFoundMessages.tr.links.games, /Algoritmik rakiplere/);
});

test('each language’s CV button downloads the CV in that language', () => {
  // There is a Turkish CV now: the Turkish button no longer warns that the CV is in English.
  assert.doesNotMatch(homeMessages.tr.hero.cvFormat, /İngilizce|English/);
  assert.doesNotMatch(aboutMessages.tr.resume.cvFormat, /İngilizce|English/);
  for (const locale of ['en', 'tr'] as const) {
    const link = cvLink(locale);
    assert.equal(link.href, SITE.cvPath[locale]);
    assert.equal(link.hreflang, locale);
    assert.equal(link.type, 'application/pdf');
  }
  assert.equal(cvLink('en').href, '/cv/kaan-cv.pdf');
  assert.equal(cvLink('tr').href, '/cv/kaan-cv-tr.pdf');
  // Saved under ASCII names, so every system keeps them as written.
  assert.equal(cvLink('en').download, 'Kaan-Baha-Sever-CV.pdf');
  assert.equal(cvLink('tr').download, 'Kaan-Baha-Sever-Ozgecmis.pdf');
});

test('the link to the CV in the other language is labelled in that language', () => {
  // Rendered with lang="en" on Turkish pages and lang="tr" on English ones (CvVersionLink).
  assert.equal(common.en.labels.cvVersion, 'English version');
  assert.equal(common.tr.labels.cvVersion, 'Türkçe sürümü');
});

test('English copy keeps the house voice: no hype words, no exclamation marks', () => {
  const banned =
    /\b(passionate|rockstar|ninja|cutting-edge|revolutionary|seamless(ly)?|leverag(e|es|ed|ing)|unlock|empower|delve|game-changer)\b/i;
  const english = [
    ...strings(homeMessages.en),
    ...strings(notFoundMessages.en),
    ...strings(JSON.parse(JSON.stringify(resume, (key, value) => (key === 'tr' ? undefined : value)))),
  ];
  assert.ok(english.length > 50);
  for (const text of english) {
    assert.doesNotMatch(text, banned, text);
    assert.ok(!text.includes('!'), `exclamation mark in "${text}"`);
  }
});

test('the hero shows the headline verbatim: its two halves around the bar', () => {
  for (const locale of ['en', 'tr'] as const) {
    const headline = SITE.role[locale];
    const { role, specialty } = headlineParts(headline);
    assert.ok(role.trim() && specialty.trim(), `${locale}: the headline should have two halves`);
    assert.equal(`${role}${HEADLINE_SEPARATOR}${specialty}`, headline);
  }
  assert.deepEqual(headlineParts('Software Developer | Math-Driven Solutions & Algorithms'), {
    role: 'Software Developer',
    specialty: 'Math-Driven Solutions & Algorithms',
  });
  assert.deepEqual(headlineParts('No bar here'), { role: 'No bar here', specialty: '' });
  assert.deepEqual(headlineParts('a | b | c'), { role: 'a', specialty: 'b | c' });
});

test('the figure’s pause and play buttons have distinct names in both languages', () => {
  for (const locale of ['en', 'tr'] as const) {
    const { pause, play } = homeMessages[locale].figure;
    assert.notEqual(pause, play, locale);
  }
});

/** Every Turkish string: the catalogues' Turkish side and the résumé without its English fields. */
function turkishStrings(): string[] {
  const resumeTr = JSON.parse(JSON.stringify(resume, (key, value) => (key === 'en' ? undefined : value)));
  return [...strings(homeMessages.tr), ...strings(notFoundMessages.tr), ...strings(resumeTr)];
}

test('Turkish suffixes after a name take the typographic apostrophe (API’lere, not API\'lere)', () => {
  for (const text of turkishStrings()) assert.doesNotMatch(text, /\p{L}'\p{L}/u, text);
});

test('Turkish copy names linear algebra "lineer cebir", as the About page and the console do', () => {
  const turkish = turkishStrings().join(' ');
  assert.match(turkish, /lineer cebir/i);
  assert.doesNotMatch(turkish, /doğrusal cebir/i);
});

test('Turkish copy reads as Turkish, not as a translation of the English', () => {
  // The calques the owner flagged ("crowd.inc bünyesinde", "yaşam döngüsünü uçtan uca üstlendim"),
  // and "Kodun yanında" for "Around the code", which the console already rules out.
  const turkish = [...turkishStrings(), SITE.description.tr].join(' ');
  for (const calque of [/bünyesinde/i, /uçtan uca/i, /yaşam döngüsü/i, /ortaya koy/i, /gizliliğe saygılı/i, /kodun yanında/i]) {
    assert.doesNotMatch(turkish, calque);
  }
  // crowd.inc takes its suffix like any other name (read "kraud ink": -te).
  assert.match(aboutMessages.tr.journey.chapters.work.title, /crowd\.inc’te/);
});

test('the home introduction is a general welcome: no job details, and it ends by inviting the visitor in', () => {
  // The owner: details such as crowd.inc do not belong in the first introduction (the Experience
  // section right below has them), and the text should lead somewhere rather than trail off.
  for (const locale of ['en', 'tr'] as const) {
    const intro = homeMessages[locale].hero.intro;
    assert.doesNotMatch(intro, /crowd\.inc|PostgreSQL|Linux/, locale);
    assert.match(intro, /C\+\+ (and|ve) Go/, locale);
  }
  assert.match(homeMessages.tr.hero.intro, /^Merhaba, hoş geldiniz!/);
  assert.match(homeMessages.tr.hero.intro, /iyi gezinmeler!$/);
  // English keeps the house voice (no exclamation marks); the Turkish greeting may use them.
  assert.match(homeMessages.en.hero.intro, /enjoy your visit\.$/);
});

test('Turkish copy uses Turkish letters where Turkish needs them', () => {
  // A cheap guard against ASCII-folded Turkish ("Ozgecmis", "Istanbul Universitesi").
  const turkish = [...strings(homeMessages.tr), ...strings(notFoundMessages.tr)].join(' ');
  for (const word of ['Özgeçmiş', 'İstanbul Üniversitesinde', 'Geliştirici', 'Şekil']) {
    assert.ok(turkish.includes(word), `expected "${word}" in the Turkish copy`);
  }
  assert.doesNotMatch(turkish, /\b(Ozgecmis|Istanbul Universitesi|Gelistirici|Sekil)\b/);
});

test('the owner is a developer: no copy calls him an engineer or his story engineering', () => {
  // Other people keep their titles (the GDSC guest is a network security engineer).
  const guest = /network security engineer|ağ güvenliği mühendis\p{L}*/giu;
  const all = [
    ...Object.values(CATALOGUES).flatMap((catalogue) => [...strings(catalogue.en), ...strings(catalogue.tr)]),
    ...strings(JSON.parse(JSON.stringify(resume))),
  ];
  for (const text of all) assert.doesNotMatch(text.replace(guest, ''), /engineer|mühendis/i, text);
  assert.equal(homeMessages.en.person.jobTitle, 'Software Developer');
  assert.equal(homeMessages.tr.person.jobTitle, 'Yazılım Geliştirici');
});

test('the journey teaser follows the About page and tells the current story', () => {
  assert.deepEqual([...JOURNEY_CHAPTERS], ['foundations', 'avionics', 'guidance', 'simulation']);
  const { chapters } = homeMessages.en.journey;
  // The early Battleship was a plain desktop game; Hunt & Target came later.
  assert.match(chapters.foundations.text, /2016/);
  assert.match(chapters.foundations.text, /Hunt & Target algorithm came later/);
  // Battleship was the game the owner played with his father as a child (in both languages).
  assert.match(chapters.foundations.text, /Battleship, the game I played with my father as a child/);
  assert.doesNotMatch(chapters.foundations.text, /probability/i);
  assert.match(chapters.avionics.text, /one low-altitude \(5,000 ft\) and two high-altitude \(10,000 ft\)/);
  assert.doesNotMatch(chapters.avionics.text, /launch/i);
  // One evolving project: the 2020 prototype is being rewritten as Rocket-Up.
  assert.match(chapters.simulation.text, /2020/);
  assert.match(chapters.simulation.text, /Rocket-Up/);
  // Turkish uses the site's name for the algorithm (as on the Playground card), English in parentheses.
  assert.match(homeMessages.tr.journey.chapters.foundations.text, /av ve hedef \(hunt & target\) algoritmasını/);
  assert.match(homeMessages.tr.journey.chapters.foundations.text, /çocukken babamla oynadığım Amiral Battı/);
  assert.doesNotMatch(homeMessages.tr.journey.chapters.foundations.text, /Hunt & Target/);
  assert.match(homeMessages.tr.journey.chapters.avionics.text, /5\.000 ft/);
  assert.match(homeMessages.tr.journey.chapters.simulation.text, /Rocket-Up/);
});
