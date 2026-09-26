import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ResumeDate } from '../src/data/resume.ts';
import { formatPeriod, formatResumeDate, isDated, parseResumeDate, sortNewestFirst } from '../src/utils/resume-dates.ts';

// The labels the hand-written month table used to produce; switching to Intl must not change them.
const ENGLISH_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

test('English month labels are unchanged by the move to Intl', () => {
  ENGLISH_MONTHS.forEach((name, index) => {
    const month = String(index + 1).padStart(2, '0');
    const value = `2021-${month}` as ResumeDate;
    assert.equal(formatResumeDate(value).label, `${name} 2021`);
    assert.equal(formatResumeDate(value, 'en').label, `${name} 2021`);
    assert.equal(formatResumeDate(value).datetime, value);
  });
});

test('Turkish month labels use Turkish abbreviations and keep the machine-readable value', () => {
  assert.deepEqual(formatResumeDate('2021-07', 'tr'), { label: 'Tem 2021', spoken: 'Temmuz 2021', datetime: '2021-07' });
  assert.equal(formatResumeDate('2019-11', 'tr').label, 'Kas 2019');
  assert.equal(formatResumeDate('2020-08', 'tr').label, 'Ağu 2020');
  assert.equal(formatResumeDate('2018-02', 'tr').label, 'Şub 2018');
});

test('spoken labels spell the month out, so speech engines never read an abbreviation as a word', () => {
  // "Kas", "Ara", "Mar" and "Haz" are also Turkish words ("muscle", "search"…).
  assert.deepEqual(formatResumeDate('2021-07'), { label: 'Jul 2021', spoken: 'July 2021', datetime: '2021-07' });
  assert.equal(formatResumeDate('2019-11', 'tr').spoken, 'Kasım 2019');
  assert.equal(formatResumeDate('2018-12', 'tr').spoken, 'Aralık 2018');
  assert.equal(formatResumeDate('2024-03', 'tr').spoken, 'Mart 2024');
  assert.equal(formatResumeDate('2017-06', 'tr').spoken, 'Haziran 2017');
  assert.equal(formatResumeDate('2020', 'tr').spoken, '2020');
});

test('January and December stay in their own year whatever the build time zone', () => {
  // Dates are built at UTC midnight and formatted in UTC, so neither end can slip a month.
  assert.equal(formatResumeDate('2024-01').label, 'Jan 2024');
  assert.equal(formatResumeDate('2023-12').label, 'Dec 2023');
  assert.equal(formatResumeDate('2023-12', 'tr').label, 'Ara 2023');
});

test('bare years are shown as they are', () => {
  assert.deepEqual(formatResumeDate('2020'), { label: '2020', spoken: '2020', datetime: '2020' });
  assert.deepEqual(formatResumeDate('2020', 'tr'), { label: '2020', spoken: '2020', datetime: '2020' });
});

test('malformed dates fail loudly so bad data breaks the build', () => {
  for (const bad of ['2021-13', '2021-00', '2021-7', '21-07', '2021/07', '', 'present']) {
    assert.throws(() => parseResumeDate(bad), /Invalid résumé date/, bad);
  }
  assert.deepEqual(parseResumeDate('2021-07'), { year: 2021, month: 7 });
  assert.deepEqual(parseResumeDate('2019'), { year: 2019 });
});

test('formatPeriod renders a closed period in each language', () => {
  const en = formatPeriod({ start: '2021-07', end: '2024-03' });
  assert.equal(en.text, 'Jul 2021 – Mar 2024');
  assert.equal(en.spoken, 'July 2021 to March 2024');
  assert.equal(en.endLabel, 'Mar 2024');
  assert.deepEqual(en.end, { label: 'Mar 2024', spoken: 'March 2024', datetime: '2024-03' });

  const tr = formatPeriod({ start: '2021-07', end: '2024-03' }, 'tr');
  assert.equal(tr.text, 'Tem 2021 – Mar 2024');
  assert.equal(tr.spoken, 'Temmuz 2021 – Mart 2024');

  const erasmus = formatPeriod({ start: '2017-06', end: '2018-12' }, 'tr');
  assert.equal(erasmus.text, 'Haz 2017 – Ara 2018');
  assert.equal(erasmus.spoken, 'Haziran 2017 – Aralık 2018');
});

test('formatPeriod localizes an ongoing end and leaves single dates alone', () => {
  const ongoing = formatPeriod({ start: '2019-11', end: 'present' });
  assert.equal(ongoing.end, 'present');
  assert.equal(ongoing.endLabel, 'Present');
  assert.equal(ongoing.text, 'Nov 2019 – Present');
  assert.equal(ongoing.spoken, 'November 2019 to Present');
  const ongoingTr = formatPeriod({ start: '2019-11', end: 'present' }, 'tr');
  assert.equal(ongoingTr.text, 'Kas 2019 – Günümüz');
  assert.equal(ongoingTr.spoken, 'Kasım 2019 – Günümüz');

  const single = formatPeriod({ start: '2020' }, 'tr');
  assert.equal(single.end, null);
  assert.equal(single.endLabel, null);
  assert.equal(single.text, '2020');
  assert.equal(single.spoken, '2020');
});

test('sortNewestFirst puts ongoing periods first, then by end date, then by start date', () => {
  const items = [
    { id: 'erasmus', start: '2017-06', end: '2018-12' },
    { id: 'rocket', start: '2019', end: '2022' },
    { id: 'yetgen', start: '2020' },
    { id: 'degree', start: '2019-11', end: 'present' },
    { id: 'gdsc', start: '2022', end: '2023' },
    { id: 'late-start', start: '2021', end: '2022' },
  ] as const;
  assert.deepEqual(
    sortNewestFirst(items).map((item) => item.id),
    ['degree', 'gdsc', 'late-start', 'rocket', 'yetgen', 'erasmus'],
  );
  // The input is not mutated.
  assert.equal(items[0].id, 'erasmus');
});

test('a period in words is shown as written, in the page language, with nothing to spell out', () => {
  const upper = { periodLabel: { en: 'Upper years', tr: 'Son sınıflar' } };
  assert.equal(isDated(upper), false);
  assert.equal(isDated({ start: '2020' }), true);
  assert.deepEqual(formatPeriod(upper), { start: null, end: null, endLabel: null, text: 'Upper years', spoken: 'Upper years' });
  const tr = formatPeriod(upper, 'tr');
  assert.equal(tr.text, 'Son sınıflar');
  assert.equal(tr.spoken, 'Son sınıflar');
  assert.equal(tr.start, null);
});

test('sortNewestFirst puts undated periods first, in their source order, and never drops one', () => {
  const items = [
    { id: 'rocket', start: '2019', end: '2022' },
    { id: 'club', periodLabel: { en: 'Upper years', tr: 'Son sınıflar' } },
    { id: 'gdsc', start: '2023' },
    { id: 'other', periodLabel: { en: 'Later', tr: 'Sonra' } },
    { id: 'erasmus', start: '2017-06', end: '2018-12' },
  ] as const;
  assert.deepEqual(
    sortNewestFirst(items).map((item) => item.id),
    ['club', 'other', 'gdsc', 'rocket', 'erasmus'],
  );
  assert.deepEqual(sortNewestFirst([]), []);
});
