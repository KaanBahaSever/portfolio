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
import { parseResumeDate } from '../src/utils/resume-dates.ts';

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

test('experience lists only the crowd.inc role', () => {
  assert.equal(EXPERIENCE.length, 1);
  const [job] = EXPERIENCE;
  assert.equal(resumeText(job!.organization, 'en'), 'crowd.inc');
  assert.equal(job!.role.en, 'Full-Stack Software Engineer / Systems Contributor');
  assert.deepEqual([job!.start, job!.end], ['2021-07', '2024-03']);
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
