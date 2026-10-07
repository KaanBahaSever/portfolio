/**
 * The owner's own account of Novacast and Karecik (2026-10), wherever they are described.
 *
 * Novacast manages many screens of different makes from one web panel; it is not a "real-time
 * message broadcasting" platform, and the Python-prototype story was wrong. Karecik began as a
 * QR menu for a middle-school friend's café; the full POS was never finished, so no copy may
 * claim that Karecik manages orders.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { CV } from '../src/data/cv.ts';
import { consoleContent } from '../src/i18n/console/content.ts';
import { LOCALES } from '../src/i18n/config.ts';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
/** Markdown wraps lines, so phrases may break anywhere. */
const flat = (text: string) => text.replace(/\s+/g, ' ');

const pages = {
  novacast: { en: read('src/content/projects/novacast.md'), tr: read('src/content/tr/projects/novacast.md') },
  karecik: { en: read('src/content/projects/karecik.md'), tr: read('src/content/tr/projects/karecik.md') },
};

/** Everywhere else the two projects are described. */
const elsewhere = [
  'src/content/timeline/2025-novacast.md',
  'src/content/tr/timeline/2025-novacast.md',
  'src/content/timeline/2026-karecik.md',
  'src/content/tr/timeline/2026-karecik.md',
  'src/components/about/prose/CurrentCore.astro',
  'src/i18n/messages/projects.ts',
  'src/i18n/console/content.ts',
].map((path) => ({ path, text: read(path) }));

const cvText = (name: string) =>
  LOCALES.map((locale) => CV[locale].projects.find((project) => project.name === name)?.text ?? '').join('\n');

test('Novacast is built with Rust, Go and MQTT, on the CV as on the page', () => {
  assert.match(pages.novacast.en, /^techStack: \[Rust, Go, MQTT\]$/m);
  for (const locale of LOCALES) {
    assert.deepEqual(CV[locale].projects.find((project) => project.name === 'Novacast')?.stack, ['Rust', 'Go', 'MQTT']);
  }
});

test('the Novacast page names the six platforms and the web panel in both languages', () => {
  for (const locale of LOCALES) {
    const page = flat(pages.novacast[locale]);
    for (const platform of ['Windows', 'macOS', 'Linux', 'Samsung TV', 'LG TV', 'Android TV']) {
      assert.ok(page.includes(platform), `${locale}: ${platform}`);
    }
    assert.match(page, locale === 'en' ? /web panel/ : /web paneli/, locale);
    assert.match(page, /Electron/, `${locale}: why the old software was replaced`);
  }
});

test('the old, wrong Novacast story does not come back', () => {
  const wrong = /Python|re-architect|microservice|mikroservis|broadcasting|orchestrat|low-latency|düşük gecikmeli|mesaj yayını/i;
  const novacast = [
    ...LOCALES.map((locale) => ({ path: `novacast.md (${locale})`, text: pages.novacast[locale] })),
    ...elsewhere.filter(({ path }) => /novacast|CurrentCore/.test(path)),
    { path: 'cv.ts', text: cvText('Novacast') },
  ];
  for (const { path, text } of novacast) {
    const hit = wrong.exec(text);
    assert.equal(hit, null, `${path}: "${hit?.[0]}"`);
  }
  for (const locale of LOCALES) {
    const mqtt = consoleContent[locale].skills.systems.map((line) => JSON.stringify(line)).join('\n');
    assert.doesNotMatch(mqtt, /low-latency|düşük gecikmeli/, locale);
  }
});

test('the Karecik page tells how it began: a QR menu for a friend’s café', () => {
  const en = flat(pages.karecik.en);
  const tr = flat(pages.karecik.tr);
  assert.match(en, /## Where it came from Karecik started when a friend of mine from middle school opened a café\./);
  assert.match(en, /point-of-sale \(POS\)/);
  assert.match(en, /all three of them/);
  assert.match(tr, /## Nasıl başladı\? Karecik, ortaokuldan bir arkadaşım kafe açınca başladı\./);
  assert.match(tr, /adisyon sistemi \(POS\)/);
  assert.match(tr, /üç şubesinde de Karecik var/);
});

test('no copy claims that Karecik manages orders', () => {
  const karecik = [
    ...LOCALES.map((locale) => ({ path: `karecik.md (${locale})`, text: pages.karecik[locale] })),
    ...elsewhere.filter(({ path }) => /karecik|projects\.ts|console/.test(path)),
    { path: 'cv.ts', text: cvText('Karecik') },
  ];
  for (const { path, text } of karecik) {
    // Comments ("Only orders entries"), the `order:` field and "drag-and-drop ordering" are
    // about sorting, not about a café's orders.
    const visible = text.replace(/^\s*#.*$/gm, '');
    const hit = /\borders\b|order management|sipariş/i.exec(visible);
    assert.equal(hit, null, `${path}: "${hit?.[0]}"`);
  }
});
