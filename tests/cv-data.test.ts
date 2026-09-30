/**
 * The CV-only content (src/data/cv.ts) and the words around it (src/i18n/messages/cv.ts) follow
 * the same rules as the site, in both languages: the owner is a software developer, never an
 * engineer; links are https (or tel:/mailto:); project tag lists stay short; none of the removed
 * Swift-era details come back. The English and Turkish CVs carry the same facts: same projects in
 * the same order, same links, stacks, years and status, and the same student communities under the
 * university, with the roles and years of the home page's list. Last, the PDFs the site links
 * exist, fit on two pages, are set in the site's fonts, declare their language and print what the
 * data says, in the owner's section order.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
import { getDocument, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs';

import { embeddedFontNames, fontFallbackProblem } from '../scripts/cv-fonts.ts';
import { SITE } from '../src/config/site.ts';
import { CV } from '../src/data/cv.ts';
import { EDUCATION, VOLUNTEERING, resumeText } from '../src/data/resume.ts';
import { LOCALES, LOCALE_META, type Locale } from '../src/i18n/config.ts';
import { cvMessages } from '../src/i18n/messages/cv.ts';
import { isDated } from '../src/utils/resume-dates.ts';

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
  // Nor his university work: the student-community lines never say "engineering" or "mühendislik".
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
  assert.equal(tr.communities.length, en.communities.length);
  en.communities.forEach((community, index) => {
    const other = tr.communities[index]!;
    const label = `${community.name} / ${other.name}`;
    assert.equal(other.role === undefined, community.role === undefined, label);
    assert.deepEqual(years(other.period), years(community.period), label);
    // The same figures, grouped each language's way: 5,000 ft is 5.000 ft.
    const figures = (text: string) => (text.match(/\d[\d.,]*\d|\d/g) ?? []).map((n) => n.replace(/[.,]/g, ''));
    assert.deepEqual(figures(other.text), figures(community.text), label);
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

test('the CV summaries name crowd.inc and leave what it was to the experience entry below them', () => {
  // The experience entry (src/data/resume.ts, pinned in resume-data.test.ts) opens with what
  // crowd.inc was, a few lines below the summary on page 1, so the summary does not say it twice.
  assert.match(CV.en.summary, /I owned the development lifecycle at crowd\.inc, from database schema to Linux servers/);
  assert.match(CV.tr.summary, /crowd\.inc’te geliştirme sürecini baştan sona yürüttüm/);
  for (const locale of LOCALES) {
    assert.doesNotMatch(CV[locale].summary, /hundreds|yüzlerce|sharing ideas|idea-sharing|fikir/i, locale);
  }
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

/**
 * The student communities under the university, in the owner's order: the home page's entry for
 * each (resume.ts VOLUNTEERING, by English title) and the name the CV gives it in each language.
 */
const COMMUNITIES = [
  { record: 'Istanbul University Rocket Club', en: 'Rocket Club', tr: 'Roket Kulübü' },
  { record: 'Mathematics Club', en: 'Mathematics Club', tr: 'Matematik Kulübü' },
  {
    record: 'Google Developer Student Clubs',
    en: 'Google Developer Student Clubs (GDSC)',
    tr: 'Google Developer Student Clubs (GDSC)',
  },
] as const;

test('under the university the CVs list his three student communities, with the roles and years on record', () => {
  // One school, Istanbul University: scripts/build-cv.ts prints the communities under it.
  assert.equal(EDUCATION.length, 1);
  assert.equal(EDUCATION[0]!.institution.en, 'Istanbul University');
  for (const locale of LOCALES) {
    const communities = CV[locale].communities;
    assert.deepEqual(
      communities.map((community) => community.name),
      COMMUNITIES.map((names) => names[locale]),
      locale,
    );
    communities.forEach((community, index) => {
      const label = `${locale}: ${community.name}`;
      const record = VOLUNTEERING.find((item) => resumeText(item.title, 'en') === COMMUNITIES[index]!.record);
      assert.ok(record, label);
      assert.equal(community.role, record.role?.[locale], label);
      // "2019–2022" and "2023"; the Mathematics Club has no dates on record, so its period in words.
      const period = isDated(record)
        ? [record.start, record.end].filter(Boolean).join('–')
        : record.periodLabel[locale].toLocaleLowerCase(LOCALE_META[locale].htmlLang);
      assert.equal(community.period, period, label);
      // One or two printed lines, lead included (a line holds about 115 characters).
      const line = `${cvMessages[locale].community(community.name, community.role, community.period)} ${community.text}`;
      assert.ok(line.length <= 220, `${label}: ${line.length} characters`);
      // After the lead's colon English goes on in lower case; Turkish starts a sentence (TDK).
      assert.match(community.text, locale === 'en' ? /^\p{Ll}/u : /^\p{Lu}/u, label);
      assert.match(community.text, /\.$/, label);
    });
  }
});

test('the community lines carry the owner’s facts, in both languages', () => {
  const facts: Record<Locale, RegExp[][]> = {
    en: [
      [
        /avionics, telemetry, ground-control and flight-simulation software/,
        /three rockets, one low-altitude \(5,000 ft\) and two high-altitude \(10,000 ft\)/,
      ],
      [/academic events, such as seminars and logic and mathematics competitions/, /community built around theoretical discussion/],
      [/technical workshops and live streams on Flask, HTML and Git\/GitHub/, /organised Cyber Security Week/],
    ],
    tr: [
      [
        /aviyonik, telemetri, yer kontrol ve uçuş simülasyonu yazılımları/,
        /bir alçak irtifa \(5\.000 ft\) ve iki yüksek irtifa \(10\.000 ft\) roketi/,
      ],
      [/seminerler, mantık ve matematik yarışmaları gibi akademik etkinlikler/, /Teorik tartışmaların yapıldığı bu toplulukta/],
      [/Flask, HTML ve Git\/GitHub üzerine teknik atölyeler ve canlı yayınlar/, /Siber Güvenlik Haftası etkinliğini/],
    ],
  };
  for (const locale of LOCALES) {
    CV[locale].communities.forEach((community, index) => {
      for (const fact of facts[locale][index]!) assert.match(community.text, fact, `${locale}: ${community.name}`);
    });
  }
});

test('the CVs have no volunteering section: its clubs are listed under the university', () => {
  for (const locale of LOCALES) {
    assert.deepEqual(
      Object.keys(cvMessages[locale].sections),
      ['experience', 'education', 'projects', 'skills', 'research', 'other', 'languages'],
      locale,
    );
  }
});

test('the words around the CV compose titles the way each language does', () => {
  assert.equal(cvMessages.en.degree('Bachelor of Science', 'Mathematics'), 'Bachelor of Science in Mathematics');
  assert.equal(cvMessages.tr.degree('Lisans', 'Matematik'), 'Matematik (Lisans)');
  assert.equal(cvMessages.en.role('Vice President', 'Rocket Club'), 'Vice President, Rocket Club');
  assert.equal(cvMessages.tr.role('Başkan Yardımcısı', 'Roket Kulübü'), 'Roket Kulübü Başkan Yardımcısı');
  // A community line starts with the community, then the role where there is one, then when.
  assert.equal(cvMessages.en.community('Rocket Club', 'Vice President', '2019–2022'), 'Rocket Club, Vice President (2019–2022):');
  assert.equal(
    cvMessages.tr.community('Roket Kulübü', 'Başkan Yardımcısı', '2019–2022'),
    'Roket Kulübü Başkan Yardımcısı (2019–2022):',
  );
  assert.equal(cvMessages.en.community('Mathematics Club', undefined, 'later university years'), 'Mathematics Club (later university years):');
  assert.equal(
    cvMessages.tr.community('Matematik Kulübü', undefined, 'üniversitenin son yılları'),
    'Matematik Kulübü (üniversitenin son yılları):',
  );
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

const squash = (text: string) => text.replace(/\s+/g, '');

/** The printed text of a PDF as PDF.js reads it, with all white space removed (lines wrap anywhere). */
async function printedText(bytes: Uint8Array): Promise<string> {
  const loading = getDocument({ data: bytes, verbosity: VerbosityLevel.ERRORS });
  try {
    const doc = await loading.promise;
    let text = '';
    for (let number = 1; number <= doc.numPages; number++) {
      const content = await (await doc.getPage(number)).getTextContent();
      for (const item of content.items) if ('str' in item) text += item.str;
    }
    return squash(text);
  } finally {
    await loading.destroy();
  }
}

for (const locale of LOCALES) {
  test(`the ${locale} CV prints its sections in the owner’s order, with the student communities under the university`, async () => {
    // A copy: PDF.js takes a plain Uint8Array and may detach it.
    const text = await printedText(new Uint8Array(readFileSync(new URL(`../public${SITE.cvPath[locale]}`, import.meta.url))));
    const m = cvMessages[locale];
    // Section titles are set in capitals by CSS, by the document language's rules ("EĞİTİM").
    const heading = (title: string) => squash(title.toLocaleUpperCase(LOCALE_META[locale].htmlLang));
    const at: number[] = [];
    for (const title of Object.values(m.sections)) {
      const index = text.indexOf(heading(title), at.at(-1) ?? 0);
      assert.ok(index >= 0, `${locale}: "${title}" missing or out of order`);
      at.push(index);
    }
    // The former Leadership & volunteering section is gone.
    assert.doesNotMatch(text, /LEADERSHIP|VOLUNTEERING|LİDERLİK|GÖNÜLLÜLÜK/);

    const education = text.slice(text.indexOf(heading(m.sections.education)), text.indexOf(heading(m.sections.projects)));
    for (const community of CV[locale].communities) {
      const line = squash(`${m.community(community.name, community.role, community.period)} ${community.text}`);
      assert.ok(education.includes(line), `${locale}: ${community.name} is not printed under the university`);
    }
    // The CV replaces the home page's highlights for the degree with the communities.
    for (const highlight of EDUCATION[0]!.highlights[locale]) assert.ok(!text.includes(squash(highlight)), highlight);
  });
}
