import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stageBadges } from '../src/components/projects/stage.ts';
import { LOCALES } from '../src/i18n/config.ts';
import { common } from '../src/i18n/messages/common.ts';
import { homeMessages } from '../src/i18n/messages/home.ts';
import { projectsMessages } from '../src/i18n/messages/projects.ts';

test('stageBadges: early access also says the project is still in development', () => {
  assert.deepEqual(stageBadges('early-access'), ['in-development', 'early-access']);
  assert.deepEqual(stageBadges('in-development'), ['in-development']);
  assert.deepEqual(stageBadges('production'), ['production']);
  assert.deepEqual(stageBadges(undefined), []);
});

test('stage badge labels exist and differ in both languages', () => {
  for (const locale of LOCALES) {
    const labels = [
      projectsMessages[locale].stage.production,
      common[locale].badges.inDevelopment,
      common[locale].badges.earlyAccess,
    ];
    for (const label of labels) assert.ok(label.trim().length > 0, `${locale}: empty stage label`);
    assert.equal(new Set(labels).size, labels.length, `${locale}: stage labels must differ`);
  }
});

test('early-access link: its accessible name starts with the visible text (WCAG 2.5.3)', () => {
  for (const locale of LOCALES) {
    const card = projectsMessages[locale].card;
    assert.ok(card.earlyAccessName('Asion').startsWith(card.earlyAccess), locale);
    assert.ok(card.earlyAccessName('Asion').includes('Asion'), locale);
    assert.notEqual(card.earlyAccess, card.live, locale);
  }
  assert.equal(projectsMessages.en.card.earlyAccessName('Asion'), 'Early-access site of Asion (opens in a new tab)');
  assert.equal(projectsMessages.tr.card.earlyAccessName('Asion'), 'Erken erişim sitesi: Asion (yeni sekmede açılır)');
});

test('projects eyebrow uses the wording of the home page link that leads to it', () => {
  for (const locale of LOCALES) {
    assert.equal(projectsMessages[locale].index.eyebrow, homeMessages[locale].hero.selectedWork, locale);
    assert.equal(projectsMessages[locale].index.eyebrow, homeMessages[locale].work.title, locale);
  }
});
