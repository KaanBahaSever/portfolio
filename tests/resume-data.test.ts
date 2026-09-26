import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ACTIVITIES,
  CERTIFICATIONS,
  EDUCATION,
  EXPERIENCE,
  FOCUS,
  LANGUAGES,
  SKILLS,
  VOLUNTEERING,
  resumeText,
  type ResumePeriod,
} from '../src/data/resume.ts';
import { LOCALES } from '../src/i18n/config.ts';
import { isDated, parseResumeDate } from '../src/utils/resume-dates.ts';

const ALL = { EXPERIENCE, EDUCATION, VOLUNTEERING, CERTIFICATIONS, ACTIVITIES, SKILLS, LANGUAGES, FOCUS };

/** Every { en, tr } record anywhere in the data, with a readable path for failure messages. */
function localizedRecords(value: unknown, path = 'resume'): { path: string; record: Record<string, unknown> }[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => localizedRecords(item, `${path}[${index}]`));
  if (value === null || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.join() === [...LOCALES].sort().join()) return [{ path, record }];
  return Object.entries(record).flatMap(([key, child]) => localizedRecords(child, `${path}.${key}`));
}

test('every translated field has non-empty text in both languages', () => {
  const records = localizedRecords(ALL);
  assert.ok(records.length > 20, 'expected the résumé to be mostly localized');
  for (const { path, record } of records) {
    const [en, tr] = [record.en, record.tr];
    if (Array.isArray(en) || Array.isArray(tr)) {
      assert.ok(Array.isArray(en) && Array.isArray(tr), `${path}: both languages must be lists`);
      assert.equal(tr.length, en.length, `${path}: the Turkish list must match the English one item for item`);
      for (const item of [...en, ...tr]) assert.ok(typeof item === 'string' && item.trim(), `${path}: empty item`);
    } else {
      assert.ok(typeof en === 'string' && en.trim(), `${path}.en is empty`);
      assert.ok(typeof tr === 'string' && tr.trim(), `${path}.tr is empty`);
    }
  }
});

test('experience lists only the crowd.inc role, as Software Developer', () => {
  assert.equal(EXPERIENCE.length, 1);
  const [job] = EXPERIENCE;
  assert.equal(resumeText(job!.organization, 'en'), 'crowd.inc');
  assert.equal(resumeText(job!.role, 'en'), 'Software Developer');
  assert.equal(resumeText(job!.role, 'tr'), 'Yazılım Geliştirici');
  // Translated, so neither page needs to mark the title as another language.
  assert.equal(job!.roleLang, undefined);
  assert.deepEqual([job!.start, job!.end], ['2021-07', '2024-03']);
  // The ownership highlights stay.
  const highlights = job!.highlights.en.join(' ');
  for (const topic of [/RBAC/, /public and private/, /pagination/, /Linux servers/, /unit and integration test/]) {
    assert.match(highlights, topic);
  }
});

test('the résumé never calls the owner an engineer, in either language', () => {
  // Other people keep their titles: the GDSC guest is a network security engineer.
  const guest = /network security engineer|ağ güvenliği mühendis/gi;
  const text = JSON.stringify(ALL).replace(guest, '');
  assert.doesNotMatch(text, /engineer|mühendis/i);
});

test('volunteering carries the current facts', () => {
  const byTitle = (title: string) => VOLUNTEERING.find((item) => resumeText(item.title, 'en') === title);

  const rockets = byTitle('Istanbul University Rocket Club');
  assert.ok(rockets && isDated(rockets));
  assert.deepEqual([rockets.start, rockets.end], ['2019', '2022']);
  assert.match(rockets.highlights.en.join(' '), /one low-altitude rocket \(5,000 ft\) and two high-altitude rockets \(10,000 ft\)/);
  // Turkish groups thousands with a dot.
  assert.match(rockets.highlights.tr.join(' '), /bir alçak irtifa \(5\.000 ft\) ve iki yüksek irtifa \(10\.000 ft\)/);
  assert.doesNotMatch(JSON.stringify(rockets), /three high-power|launches/i);

  const gdsc = byTitle('Google Developer Student Clubs');
  assert.ok(gdsc && isDated(gdsc));
  assert.deepEqual([gdsc.start, gdsc.end], ['2023', undefined]);
  const gdscText = gdsc.highlights.en.join(' ');
  for (const fact of [/Flask, HTML and Git\/GitHub/, /Cyber Security Week/, /CCIE-certified/]) assert.match(gdscText, fact);

  const maths = byTitle('Mathematics Club');
  assert.ok(maths);
  // No dates on record: a period in words, never a made-up year.
  assert.ok(!isDated(maths));
  assert.equal(maths.start, undefined);
  assert.deepEqual(maths.periodLabel, { en: 'Later university years', tr: 'Üniversitenin son yılları' });
  assert.match(maths.highlights.en.join(' '), /seminars and logic and mathematics competitions/);
});

test('skills are the owner’s list: six groups, tools rather than tasks, no duplicates', () => {
  assert.deepEqual(
    SKILLS.map((group) => group.label.tr),
    ['Programlama Dilleri', 'Sistem & Ağ Programlama', 'DevOps & Araçlar', 'Veri Tabanları', 'Web Teknolojileri', 'Bilimsel Hesaplama'],
  );
  const devops = SKILLS.find((group) => group.label.en === 'DevOps & tools');
  assert.ok(devops, 'a DevOps & tools group');
  assert.deepEqual(
    devops.items.map((item) => resumeText(item, 'tr')),
    ['Git', 'GitHub', 'GitHub Actions', 'CI/CD Süreçleri', 'Cross-compilation', 'Bash', 'Batch'],
  );
  for (const locale of LOCALES) {
    const items = SKILLS.flatMap((group) => group.items.map((item) => resumeText(item, locale)));
    assert.equal(new Set(items).size, items.length, `${locale}: duplicate skill`);
    // Task descriptions and the old "Version control" row are gone.
    assert.doesNotMatch(items.join(' | '), /one-click|tek tıkla|multi-platform|çok platformlu|python scripting|python betik/i);
    assert.ok(!SKILLS.some((group) => /version control|sürüm kontrol/i.test(group.label[locale])));
  }
  for (const locale of LOCALES) assert.match(FOCUS[locale], /Asion/);
});

test('links point at the page in the reader’s language where one exists', () => {
  const [school] = EDUCATION;
  assert.ok(school?.url);
  assert.equal(resumeText(school.url, 'en'), 'https://www.istanbul.edu.tr/en/');
  assert.equal(resumeText(school.url, 'tr'), 'https://www.istanbul.edu.tr/tr/');
  for (const item of [...EXPERIENCE, ...EDUCATION]) {
    if (!item.url) continue;
    for (const locale of LOCALES) assert.match(resumeText(item.url, locale), /^https:\/\//);
  }
});

test('retired roles and technologies do not appear anywhere in the résumé', () => {
  const text = JSON.stringify(ALL).toLowerCase();
  for (const word of ['swift', 'aydos', 'antizan', 'react native']) {
    assert.ok(!text.includes(word), `résumé mentions "${word}"`);
  }
});

test('skills lead with C++ and Go', () => {
  const [first] = SKILLS;
  assert.ok(first);
  const items = first.items.map((item) => resumeText(item, 'en'));
  assert.match(items[0] ?? '', /^C\+\+/);
  assert.equal(items[1], 'Go');
});

test('every period is well formed and never ends before it starts', () => {
  const periods: ResumePeriod[] = [...EXPERIENCE, ...EDUCATION, ...VOLUNTEERING, ...CERTIFICATIONS, ...ACTIVITIES];
  for (const period of periods) {
    if (!isDated(period)) {
      // A period in words has text in both languages and no stray dates.
      for (const locale of LOCALES) assert.ok(period.periodLabel[locale].trim(), `empty period label (${locale})`);
      continue;
    }
    const start = parseResumeDate(period.start);
    if (period.end === undefined || period.end === 'present') continue;
    const end = parseResumeDate(period.end);
    const startKey = start.year * 12 + (start.month ?? 1);
    const endKey = end.year * 12 + (end.month ?? 12);
    assert.ok(endKey >= startKey, `${period.start} – ${period.end} ends before it starts`);
  }
});

test('resumeText returns shared strings as they are and picks translations', () => {
  assert.equal(resumeText('gRPC', 'tr'), 'gRPC');
  assert.equal(resumeText({ en: 'Linux servers', tr: 'Linux sunucuları' }, 'tr'), 'Linux sunucuları');
});
