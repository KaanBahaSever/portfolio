/**
 * Formatting and sorting helpers for résumé dates ('YYYY' or 'YYYY-MM'). Pure: no DOM and no
 * `astro:*` imports, so `node --test` can load it.
 *
 * Month labels come from Intl through formatters(locale).date(…, 'monthYear'): "Jul 2021" in
 * English, "Tem 2021" in Turkish. Build-time ICU decides the output, not the visitor's browser.
 *
 * Screen readers get full month names instead ('monthYearLong'): Turkish abbreviations are
 * ordinary words ("Kas" is "muscle", "Ara" is "search"), and speech engines read them as such.
 *
 * A period may also be known only in words ("Later university years"); it is shown as written.
 */

import type { DatedPeriod, ResumeDate, ResumePeriod } from '../data/resume.ts';
import { DEFAULT_LOCALE, type Locale } from '../i18n/config.ts';
import { formatters } from '../i18n/format.ts';
import { common } from '../i18n/messages/common.ts';

/** True when the period has real dates, false when it is described in words. */
export function isDated(period: ResumePeriod): period is DatedPeriod {
  return period.periodLabel === undefined;
}

export interface DateLabel {
  /** Human-readable label, e.g. "Jul 2021" / "Tem 2021" or "2024". */
  label: string;
  /** The label for screen readers, with the month in full: "July 2021" / "Temmuz 2021" or "2024". */
  spoken: string;
  /** Value for <time datetime>, e.g. "2021-07" or "2024". */
  datetime: string;
}

export interface PeriodLabels {
  /** null when the period is described in words ("Later university years"): then only `text` applies. */
  start: DateLabel | null;
  /** null for single dates (e.g. "2024") and undated periods, 'present' for ongoing periods. */
  end: DateLabel | 'present' | null;
  /** What to show for the end: the formatted date, "Present" / "Günümüz", or null for a single date. */
  endLabel: string | null;
  /** The visible period, e.g. "Jul 2021 – Mar 2024", "2020" or "Later university years". */
  text: string;
  /** The period as a screen reader should hear it, e.g. "July 2021 to March 2024". */
  spoken: string;
}

/** Splits 'YYYY' or 'YYYY-MM'. Throws on anything else, so bad data fails the build. */
export function parseResumeDate(value: string): { year: number; month?: number } {
  const match = /^(\d{4})(?:-(\d{2}))?$/.exec(value);
  const month = match?.[2] === undefined ? undefined : Number(match[2]);
  if (!match || (month !== undefined && (month < 1 || month > 12))) {
    throw new Error(`Invalid résumé date "${value}": use 'YYYY' or 'YYYY-MM'`);
  }
  const year = Number(match[1]);
  return month === undefined ? { year } : { year, month };
}

/** Formats 'YYYY' or 'YYYY-MM' for `locale` (English by default). */
export function formatResumeDate(value: ResumeDate, locale: Locale = DEFAULT_LOCALE): DateLabel {
  const { year, month } = parseResumeDate(value);
  if (month === undefined) return { label: String(year), spoken: String(year), datetime: value };
  // The first of the month at UTC midnight; formatters() formats in UTC, so the build
  // machine's time zone cannot shift it into the previous month.
  const date = new Date(Date.UTC(year, month - 1, 1));
  const f = formatters(locale);
  return { label: f.date(date, 'monthYear'), spoken: f.date(date, 'monthYearLong'), datetime: value };
}

export function formatPeriod(period: ResumePeriod, locale: Locale = DEFAULT_LOCALE): PeriodLabels {
  if (!isDated(period)) {
    const label = period.periodLabel[locale];
    return { start: null, end: null, endLabel: null, text: label, spoken: label };
  }
  const start = formatResumeDate(period.start, locale);
  const end =
    period.end === undefined ? null : period.end === 'present' ? 'present' : formatResumeDate(period.end, locale);
  const present = common[locale].labels.present;
  const endLabel = end === null ? null : end === 'present' ? present : end.label;
  const endSpoken = end === null ? null : end === 'present' ? present : end.spoken;
  return {
    start,
    end,
    endLabel,
    text: endLabel === null ? start.label : `${start.label} – ${endLabel}`,
    spoken: endSpoken === null ? start.spoken : common[locale].periodSr(start.spoken, endSpoken),
  };
}

/** Comparable 'YYYY-MM' string; a bare year counts as its last month when it ends a period. */
function comparable(date: ResumeDate | 'present', asEnd: boolean): string {
  if (date === 'present') return '9999-12';
  return date.length === 4 ? `${date}-${asEnd ? '12' : '01'}` : date;
}

/**
 * Newest first: by end date (ongoing periods first; a single date is its own end), then by start
 * date. Undated periods have nothing to compare, so they lead, in their source order: the data
 * uses them only for the recent past (see UndatedPeriod).
 */
export function sortNewestFirst<T extends ResumePeriod>(items: readonly T[]): T[] {
  const undated = items.filter((item) => !isDated(item));
  const dated = items.filter((item): item is T & DatedPeriod => isDated(item));
  dated.sort((a, b) => {
    const byEnd = comparable(b.end ?? b.start, true).localeCompare(comparable(a.end ?? a.start, true));
    return byEnd !== 0 ? byEnd : comparable(b.start, false).localeCompare(comparable(a.start, false));
  });
  return [...undated, ...dated];
}
