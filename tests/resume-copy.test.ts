/**
 * The words around the résumé: the home page and 404 catalogues, plus the résumé data itself.
 * Checks that both languages have the same shape and that the copy keeps the site's voice.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as resume from '../src/data/resume.ts';
import { JOURNEY_CHAPTERS, homeMessages } from '../src/i18n/messages/home.ts';
import { NOT_FOUND_LINKS, notFoundMessages } from '../src/i18n/messages/not-found.ts';

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

test('the Turkish CV button says the CV is in English', () => {
  assert.match(homeMessages.tr.hero.cvFormat, /İngilizce/);
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

test('Turkish copy uses Turkish letters where Turkish needs them', () => {
  // A cheap guard against ASCII-folded Turkish ("Ozgecmis", "Istanbul Universitesi").
  const turkish = [...strings(homeMessages.tr), ...strings(notFoundMessages.tr)].join(' ');
  for (const word of ['Özgeçmiş', 'İstanbul Üniversitesinde', 'Mühendislik', 'Şekil']) {
    assert.ok(turkish.includes(word), `expected "${word}" in the Turkish copy`);
  }
  assert.doesNotMatch(turkish, /\b(Ozgecmis|Istanbul Universitesi|Muhendislik|Sekil)\b/);
});
