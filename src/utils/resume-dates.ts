/**
 * Formatting and sorting helpers for résumé dates ('YYYY' or 'YYYY-MM'). Pure: no DOM.
 */

import type { ResumeDate, ResumePeriod } from '../data/resume.ts';

export interface DateLabel {
  /** Human-readable label, e.g. "Jul 2021" or "2024". */
  label: string;
  /** Value for <time datetime>, e.g. "2021-07" or "2024". */
  datetime: string;
}

export interface PeriodLabels {
  start: DateLabel;
  /** null for single dates (e.g. "2024"), 'present' for ongoing periods. */
  end: DateLabel | 'present' | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Formats 'YYYY' or 'YYYY-MM'. Throws on anything else, so bad data fails the build. */
export function formatResumeDate(value: ResumeDate): DateLabel {
  const match = /^(\d{4})(?:-(\d{2}))?$/.exec(value);
  const month = match?.[2] === undefined ? undefined : Number(match[2]);
  if (!match || (month !== undefined && (month < 1 || month > 12))) {
    throw new Error(`Invalid résumé date "${value}": use 'YYYY' or 'YYYY-MM'`);
  }
  const year = match[1]!;
  return month === undefined
    ? { label: year, datetime: year }
    : { label: `${MONTHS[month - 1]!} ${year}`, datetime: `${year}-${match[2]!}` };
}

export function formatPeriod(period: ResumePeriod): PeriodLabels {
  const start = formatResumeDate(period.start);
  if (period.end === undefined) return { start, end: null };
  if (period.end === 'present') return { start, end: 'present' };
  return { start, end: formatResumeDate(period.end) };
}

/** Comparable 'YYYY-MM' string; a bare year counts as its last month when it ends a period. */
function comparable(date: ResumeDate | 'present', asEnd: boolean): string {
  if (date === 'present') return '9999-12';
  return date.length === 4 ? `${date}-${asEnd ? '12' : '01'}` : date;
}

/** Newest first: by end date (ongoing periods first; a single date is its own end), then by start date. */
export function sortNewestFirst<T extends ResumePeriod>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const byEnd = comparable(b.end ?? b.start, true).localeCompare(comparable(a.end ?? a.start, true));
    return byEnd !== 0 ? byEnd : comparable(b.start, false).localeCompare(comparable(a.start, false));
  });
}
