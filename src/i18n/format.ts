/**
 * Locale-aware formatting for numbers, file sizes, percentages, dates and lists.
 * Pure (no DOM, no `astro:*`), so server components, client scripts and tests share it.
 *
 * Dates are formatted in UTC: frontmatter dates are parsed as UTC midnight, and build
 * machines may run in any time zone.
 */
import { LOCALE_META, type Locale } from './config.ts';

export type DateStyle = 'long' | 'short' | 'year' | 'monthYear' | 'monthYearLong';

export interface Formatters {
  locale: Locale;
  /** 12,345 / 12.345 */
  number(value: number, options?: Intl.NumberFormatOptions): string;
  /** "512 B", "3.4 KB" / "3,4 KB", "12.0 MB" — 1024-based, one decimal from KB up. */
  bytes(value: number): string;
  /** 0.64 → "64%" / "%64". Values between 0 and 1% show as "<1%" / "<%1". */
  percent(fraction: number, options?: { maximumFractionDigits?: number }): string;
  date(value: Date, style?: DateStyle): string;
  /** ['a', 'b', 'c'] → "a, b, and c" / "a, b ve c". */
  list(items: readonly string[], type?: 'conjunction' | 'disjunction' | 'unit'): string;
}

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  long: { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' },
  short: { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' },
  year: { year: 'numeric', timeZone: 'UTC' },
  monthYear: { year: 'numeric', month: 'short', timeZone: 'UTC' },
  monthYearLong: { year: 'numeric', month: 'long', timeZone: 'UTC' },
};

const cache = new Map<Locale, Formatters>();

export function formatters(locale: Locale): Formatters {
  const cached = cache.get(locale);
  if (cached) return cached;

  const intl = LOCALE_META[locale].intl;
  const integer = new Intl.NumberFormat(intl, { maximumFractionDigits: 0, useGrouping: false });
  const oneDecimal = new Intl.NumberFormat(intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const dateFormats = new Map<DateStyle, Intl.DateTimeFormat>();
  const numberFormats = new Map<string, Intl.NumberFormat>();

  const result: Formatters = {
    locale,
    number(value, options) {
      const key = options ? JSON.stringify(options) : '';
      let format = numberFormats.get(key);
      if (!format) {
        format = new Intl.NumberFormat(intl, options);
        numberFormats.set(key, format);
      }
      return format.format(value);
    },
    bytes(value) {
      if (!Number.isFinite(value) || value < 0) return '0 B';
      if (value < 1024) return `${integer.format(Math.round(value))} B`;
      const kb = value / 1024;
      // 1023.95 KB would round to "1024.0 KB": show it as MB instead.
      if (kb < 1024 && kb.toFixed(1) !== '1024.0') return `${oneDecimal.format(kb)} KB`;
      return `${oneDecimal.format(value / (1024 * 1024))} MB`;
    },
    percent(fraction, options) {
      if (fraction > 0 && fraction < 0.01) {
        return locale === 'tr' ? '<%1' : '<1%';
      }
      return result.number(fraction, {
        style: 'percent',
        maximumFractionDigits: options?.maximumFractionDigits ?? 0,
      });
    },
    date(value, style = 'long') {
      let format = dateFormats.get(style);
      if (!format) {
        format = new Intl.DateTimeFormat(intl, DATE_OPTIONS[style]);
        dateFormats.set(style, format);
      }
      return format.format(value);
    },
    list(items, type = 'conjunction') {
      return new Intl.ListFormat(intl, { style: 'long', type }).format(items);
    },
  };

  cache.set(locale, result);
  return result;
}
