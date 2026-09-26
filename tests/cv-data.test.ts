/**
 * The CV-only content (src/data/cv.ts) and the words around it (src/i18n/messages/cv.ts) follow
 * the same rules as the site, in both languages: the owner is a software developer, never an
 * engineer; links are https (or tel:/mailto:); project tag lists stay short; none of the removed
 * Swift-era details come back. The English and Turkish CVs carry the same facts: same projects in
 * the same order, same links, stacks, years and status. Last, the PDFs the site links exist,
 * fit on two pages, are set in the site's fonts and declare their language.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib';

import { embeddedFontNames, fontFallbackProblem } from '../scripts/cv-fonts.ts';
import { SITE } from '../src/config/site.ts';
import { CV } from '../src/data/cv.ts';
import { LOCALES } from '../src/i18n/config.ts';
import { cvMessages } from '../src/i18n/messages/cv.ts';

/** Every string in a value, including the results of message functions called with sample arguments. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') {
    return strings((value as (...a: string[]) => unknown)(...Array.from({ length: value.length }, () => 'Xx')));
  }
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

const all = (locale: (typeof LOCALES)[number]) => [...strings(CV[locale]), ...strings(cvMessages[locale])];
const years = (text: string) => [...new Set(text.match(/\b(19|20)\d{2}\b/g) ?? [])].sort();

test('neither CV calls the owner an engineer', () => {
  for (const locale of LOCALES) {
    for (const text of all(locale)) assert.doesNotMatch(text, /engineer|mühendis/i, `${locale}: ${text}`);
  }
});

test('the removed role stays removed', () => {
  for (const locale of LOCALES) assert.doesNotMatch(JSON.stringify(CV[locale]), /Swift|Antizan|Aydos/i);
});

test('each headline is the site’s headline in that language', () => {
  for (const locale of LOCALES) assert.equal(CV[locale].headline, SITE.role[locale]);
  assert.equal(CV.en.headline, 'Software Developer | Math-Driven Solutions & Algorithms');
  assert.equal(CV.tr.headline, 'Yazılım Geliştirici | Matematik Odaklı Çözümler ve Algoritmalar');
});

test('project and research links are https and every project has a short stack', () => {
  for (const locale of LOCALES) {
    const cv = CV[locale];
    for (const item of [...cv.projects, ...cv.research]) {
      if (item.url) assert.match(item.url, /^https:\/\//, item.url);
    }
    for (const project of cv.projects) {
      assert.ok(project.stack.length >= 1 && project.stack.length <= 5, `${locale}: ${project.name}`);
      assert.ok(project.text.length > 40, `${locale}: ${project.name}`);
    }
    assert.match(cv.phone.href, /^tel:\+\d+$/);
  }
});

test('both CVs carry the same facts: projects, links, stacks, years and status', () => {
  const { en, tr } = CV;
  assert.deepEqual(tr.phone, en.phone);
  assert.deepEqual(years(tr.summary), years(en.summary));
  assert.equal(tr.projects.length, en.projects.length);
  assert.equal(tr.research.length, en.research.length);

  // English status words and their Turkish counterparts, as on the site's project badges.
  const status: [RegExp, RegExp][] = [
    [/in production/i, /canlıda/i],
    [/in development/i, /geliştiriliyor/i],
    [/early access/i, /erken erişim/i],
    [/open source/i, /açık kaynak/i],
    [/\bMIT\b/, /\bMIT\b/],
    [/GPL-3\.0/, /GPL-3\.0/],
  ];
  en.projects.forEach((project, index) => {
    const other = tr.projects[index]!;
    const label = `${project.name} / ${other.name}`;
    assert.equal(other.url, project.url, label);
    assert.equal(other.linkLabel, project.linkLabel, label);
    assert.deepEqual(other.stack, project.stack, label);
    assert.deepEqual(years(`${other.period} ${other.text}`), years(`${project.period} ${project.text}`), label);
    for (const [english, turkish] of status) {
      assert.equal(turkish.test(other.period), english.test(project.period), `${label}: ${english}`);
    }
  });
  en.research.forEach((item, index) => {
    const other = tr.research[index]!;
    assert.equal(other.url, item.url);
    assert.equal(other.linkLabel, item.linkLabel);
    assert.equal(other.period, item.period);
  });
});

test('the Turkish CV is written with Turkish typography', () => {
  const turkish = all('tr');
  for (const text of turkish) {
    // Suffixes on names and numbers take the typographic apostrophe: 2024’ten, runner’lı.
    assert.doesNotMatch(text, /[\p{L}\d]'\p{L}/u, text);
  }
  const joined = turkish.join(' ');
  for (const word of ['İstanbul Üniversitesi', 'geliştiriyorum', 'Özgeçmiş', 'Eğitim', 'Seçilmiş projeler', 'Yetkinlikler']) {
    assert.ok(joined.includes(word), `expected "${word}" in the Turkish CV`);
  }
  // The site's Turkish terms: "lineer cebir", never "doğrusal cebir".
  assert.match(joined, /lineer cebir/i);
  assert.doesNotMatch(joined, /doğrusal cebir/i);
  // Plain Turkish, as on the home page: no "bünyesinde" or "uçtan uca", and "crowd.inc’te".
  assert.doesNotMatch(joined, /bünyesinde|uçtan uca/i);
  assert.match(CV.tr.summary, /crowd\.inc’te/);
});

test('both CV summaries say what crowd.inc was: an idea-sharing platform with hundreds of users', () => {
  assert.match(CV.en.summary, /crowd\.inc, an idea-sharing platform with hundreds of users/);
  assert.match(CV.tr.summary, /crowd\.inc’te, yüzlerce kullanıcısı olan bir fikir paylaşma platformunun/);
});

test('the CVs list only the four selected projects, in the owner’s order', () => {
  for (const locale of LOCALES) {
    assert.deepEqual(
      CV[locale].projects.map((project) => project.name),
      ['Asion', 'Novacast', 'Karecik', 'Açık Matematik'],
      locale,
    );
  }
});

test('the words around the CV compose titles the way each language does', () => {
  assert.equal(cvMessages.en.degree('Bachelor of Science', 'Mathematics'), 'Bachelor of Science in Mathematics');
  assert.equal(cvMessages.tr.degree('Lisans', 'Matematik'), 'Matematik (Lisans)');
  assert.equal(cvMessages.en.role('Vice President', 'Rocket Club'), 'Vice President, Rocket Club');
  assert.equal(cvMessages.tr.role('Başkan Yardımcısı', 'Roket Kulübü'), 'Roket Kulübü Başkan Yardımcısı');
  // Lower case by each language's rules: Turkish "I" is "ı", not "i".
  assert.equal(cvMessages.en.language('Turkish', 'Native'), 'Turkish (native)');
  assert.equal(cvMessages.tr.language('Türkçe', 'Ana dili'), 'Türkçe (ana dili)');
  assert.equal(cvMessages.tr.language('X', 'IRMAK'), 'X (ırmak)');
  assert.equal(cvMessages.en.documentTitle(SITE.name), 'Kaan Baha Sever — CV');
  assert.equal(cvMessages.tr.documentTitle(SITE.name), 'Kaan Baha Sever — Özgeçmiş');
});

test('the font check catches a PDF printed in other fonts', async () => {
  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage().drawText('Kaan Baha Sever', { font: helvetica });
  const pdf = await PDFDocument.load(await doc.save());
  assert.deepEqual(embeddedFontNames(pdf), ['Helvetica']);
  const problem = fontFallbackProblem(pdf) ?? '';
  assert.match(problem, /outside the site: Helvetica/);
  assert.match(problem, /missing: IBMPlexSans, JetBrainsMono, Newsreader/);
});

for (const locale of LOCALES) {
  test(`the ${locale} CV the site links exists, fits on two pages, uses the site's fonts and declares its language`, async () => {
    const bytes = readFileSync(new URL(`../public${SITE.cvPath[locale]}`, import.meta.url));
    assert.equal(bytes.subarray(0, 5).toString('latin1'), '%PDF-');
    assert.ok(!bytes.includes('/Subtype /Type3'), 'Type 3 fonts');
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    assert.ok(pdf.getPageCount() >= 1 && pdf.getPageCount() <= 2, `${pdf.getPageCount()} pages`);
    // Set in the site's typefaces, not a silent system-font fallback.
    assert.equal(fontFallbackProblem(pdf), undefined, embeddedFontNames(pdf).join(', '));
    assert.equal(pdf.getTitle(), cvMessages[locale].documentTitle(SITE.name));
    assert.equal(pdf.getSubject(), CV[locale].headline);
    const lang = pdf.catalog.lookup(PDFName.of('Lang'));
    assert.ok(lang && 'decodeText' in lang, 'no /Lang in the catalog');
    assert.equal((lang as { decodeText(): string }).decodeText(), locale);
    assert.ok(bytes.includes(`<dc:language><rdf:Bag><rdf:li>${locale}</rdf:li></rdf:Bag></dc:language>`), 'XMP language');
  });
}
