/**
 * Turns a weight-loss plan into the strings the calculator shows, in one locale: the summary,
 * the table cells and the CSV file. Pure (no DOM), so the tests can check it.
 *
 * Precision follows what the numbers mean: weights to 0.1 kg on screen (a scale shows no more,
 * and daily fluctuations are larger), energy to whole kcal, BMI to one decimal. The CSV keeps
 * two decimals of a kilogram so a spreadsheet can chart the curve smoothly.
 *
 * Dates are calendar days at UTC midnight (see weight-plan.ts), so they are formatted in UTC.
 */
import { LOCALE_META, type Locale } from '../../../i18n/config.ts';
import { formatters } from '../../../i18n/format.ts';
import { weightLossMessages } from '../../../i18n/tools/weight-loss.ts';
import {
  LOW_INTAKE_KCAL,
  addDays,
  bmi,
  bmiCategory,
  bmrAt,
  isoDate,
  type Plan,
  type PlanDay,
  type PlanWarning,
} from '../../../lib/health/weight-plan.ts';

/** No-break space: keeps a number with its unit. */
const NBSP = ' ';
const MINUS = '−';
const DAYS_PER_MONTH = 365.25 / 12;
const DAYS_PER_YEAR = 365.25;

export interface Card {
  label: string;
  value: string;
  note: string;
}

export interface SummaryView {
  /** "Target date", or what happens instead. */
  headline: string;
  /** The date written out, or '' when the target is not reached. */
  date: string;
  /** "182 days · 26 weeks · about 6 months", or ''. */
  duration: string;
  /** A paragraph for the outcomes other than `reached`, or ''. */
  message: string;
  cards: Card[];
  warnings: string[];
  /** One sentence for the live region. */
  announcement: string;
}

export type Presenter = ReturnType<typeof presenter>;

export function presenter(locale: Locale) {
  const m = weightLossMessages[locale];
  const f = formatters(locale);
  const intl = LOCALE_META[locale].intl;

  /** A number with exactly `digits` decimals ("+ 0" keeps −0 from printing as "-0"). */
  const fixed = (value: number, digits: number) =>
    f.number(value + 0, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  /** Up to `digits` decimals: 26 weeks, 21.9 weeks. */
  const upTo = (value: number, digits: number) => f.number(value + 0, { maximumFractionDigits: digits });

  const kg = (value: number, digits = 1) => `${fixed(value, digits)}${NBSP}kg`;
  /** "2,390 kcal"; a negative value (eating above maintenance) takes a real minus sign. */
  const kcal = (value: number) => {
    const rounded = Math.round(value) + 0;
    return `${rounded < 0 ? MINUS : ''}${f.number(Math.abs(rounded))}${NBSP}kcal`;
  };
  const percent = (fraction: number, digits = 1) =>
    f.number(fraction, { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits });

  const fullDateFormat = new Intl.DateTimeFormat(intl, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const shortDateFormat = new Intl.DateTimeFormat(intl, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

  /** "Sunday, April 11, 2027" / "11 Nisan 2027 Pazar". */
  const fullDate = (date: Date) => fullDateFormat.format(date);
  /** "Apr 11, 2027" / "11 Nis 2027". */
  const shortDate = (date: Date) => shortDateFormat.format(date);

  const daysText = (days: number) => m.result.days(days, f.number(days));

  /** "182 days · 26 weeks · about 6 months"; short plans leave out the larger units, long ones the weeks. */
  function duration(days: number): string {
    const parts = [daysText(days)];
    if (days < 2 * DAYS_PER_YEAR && days >= 14) parts.push(m.result.weeks(upTo(days / 7, 1)));
    if (days >= 60) parts.push(m.result.months(upTo(days / DAYS_PER_MONTH, 1)));
    if (days >= 2 * DAYS_PER_YEAR) parts.push(m.result.years(upTo(days / DAYS_PER_YEAR, 1)));
    return parts.join(' · ');
  }

  /** "about 7.4 years" for long spans, otherwise "about 9.5 months". */
  function roughDuration(days: number): string {
    return days >= DAYS_PER_YEAR
      ? m.result.years(upTo(days / DAYS_PER_YEAR, 1))
      : m.result.months(upTo(days / DAYS_PER_MONTH, 1));
  }

  const dateOf = (plan: Plan, day: number) => addDays(plan.input.start, day);

  function warning(plan: Plan, code: PlanWarning): string {
    const w = m.result.warnings;
    switch (code) {
      case 'belowBmr':
        return w.belowBmr;
      case 'lowIntake':
        return w.lowIntake(kcal(LOW_INTAKE_KCAL[plan.input.sex]));
      case 'fastLoss': {
        const weekly = (plan.days[0]!.deficit * 7) / 7700 / plan.input.weightKg;
        return w.fastLoss(percent(weekly));
      }
      case 'lowTargetBmi':
        return w.lowTargetBmi(fixed(bmi(plan.input.targetKg, plan.input.heightCm), 1));
    }
  }

  function bmiCard(plan: Plan): Card {
    const start = plan.days[0]!.bmi;
    const end = bmi(plan.input.targetKg, plan.input.heightCm);
    const names = m.result.bmiCategories;
    return {
      label: m.result.bmi,
      value: `${fixed(start, 1)} → ${fixed(end, 1)}`,
      note: `${names[bmiCategory(start)]} → ${names[bmiCategory(end)]}`,
    };
  }

  function summary(plan: Plan): SummaryView {
    const first = plan.days[0]!;
    const last = plan.days[plan.days.length - 1]!;
    const { input } = plan;
    const cards: Card[] = [
      {
        label: m.result.bmr,
        value: kcal(first.bmr),
        note: m.result.bmrNote(m.form.formulas[input.formula].label),
      },
      {
        label: m.result.maintenance,
        value: kcal(first.maintenance),
        note: m.result.maintenanceNote(upTo(plan.pal, 3)),
      },
      {
        label: m.result.deficit,
        value: kcal(first.deficit),
        note: m.result.deficitNote(kcal(first.intake)),
      },
      {
        label: m.result.firstWeek,
        value: plan.firstWeekLossKg > 0 ? `${MINUS}${kg(plan.firstWeekLossKg, 2)}` : kg(0, 2),
        note: m.result.firstWeekNote(percent(Math.max(0, plan.firstWeekLossKg) / input.weightKg)),
      },
      bmiCard(plan),
      input.mode === 'intake'
        ? {
            label: m.result.linear,
            value: plan.linearDays === null ? m.result.none : daysText(plan.linearDays),
            note: m.result.linearNote,
          }
        : { label: m.result.endIntake, value: kcal(last.intake), note: m.result.endIntakeNote },
    ];

    const warnings = plan.warnings.map((code) => warning(plan, code));
    const base = { cards, warnings };
    switch (plan.outcome) {
      case 'reached': {
        const date = fullDate(dateOf(plan, last.day));
        return {
          ...base,
          headline: m.result.targetDate,
          date,
          duration: duration(last.day),
          message: '',
          announcement: m.announce.reached(date, daysText(last.day)),
        };
      }
      case 'equilibrium': {
        const needed = bmrAt(plan.line, input.targetKg) * plan.pal;
        const message = m.result.equilibrium(
          kcal(input.intakeKcal),
          kg(plan.equilibriumKg ?? last.weightKg),
          kg(input.targetKg),
          kcal(needed),
        );
        return { ...base, headline: m.result.outcomes.equilibrium, date: '', duration: '', message, announcement: message };
      }
      case 'tooSlow': {
        const day = plan.projectedDay ?? last.day;
        const message = m.result.tooSlow(kg(input.targetKg), roughDuration(day), fullDate(dateOf(plan, day)));
        return { ...base, headline: m.result.outcomes.tooSlow, date: '', duration: '', message, announcement: message };
      }
      case 'noDeficit': {
        const message = m.result.noDeficit(kcal(first.intake), kcal(first.maintenance));
        return {
          cards: cards.slice(0, 3),
          warnings,
          headline: m.result.outcomes.noDeficit,
          date: '',
          duration: '',
          message,
          announcement: message,
        };
      }
    }
  }

  /** The cells of one table row, in column order (see COLUMNS). */
  function row(plan: Plan, day: PlanDay): string[] {
    return [
      shortDate(dateOf(plan, day.day)),
      f.number(day.day),
      fixed(day.weightKg, 1),
      fixed(plan.input.weightKg - day.weightKg, 1),
      f.number(Math.round(day.bmr) + 0),
      f.number(Math.round(day.maintenance) + 0),
      f.number(Math.round(day.intake) + 0),
      f.number(Math.round(day.deficit) + 0),
      fixed(day.bmi, 1),
    ];
  }

  /** The chart readout for one day. */
  function readout(plan: Plan, day: PlanDay): string {
    return m.chart.readout(shortDate(dateOf(plan, day.day)), f.number(day.day), kg(day.weightKg));
  }

  /** The chart's accessible name: what the curve shows. */
  function chartLabel(plan: Plan): string {
    const last = plan.days[plan.days.length - 1]!;
    const start = kg(plan.input.weightKg);
    const target = kg(plan.input.targetKg);
    if (plan.outcome === 'reached') {
      const label = m.chart.aria.reached(start, target, fullDate(dateOf(plan, last.day)), daysText(last.day));
      return plan.input.mode === 'intake' ? `${label} ${m.chart.aria.flattens}` : label;
    }
    if (plan.outcome === 'equilibrium') return m.chart.aria.flat(start, kg(plan.equilibriumKg ?? last.weightKg), target);
    return m.chart.aria.long(start, kg(last.weightKg), target);
  }

  /** Labels on the chart's horizontal lines. */
  const targetLine = (value: number) => m.chart.targetLine(kg(value));
  const levelLine = (value: number) => m.chart.levelLine(kg(value));

  return {
    kg,
    kcal,
    percent,
    fixed,
    upTo,
    fullDate,
    shortDate,
    duration,
    summary,
    row,
    readout,
    chartLabel,
    targetLine,
    levelLine,
  };
}

/** Table and CSV columns, in order. */
export const COLUMNS = ['date', 'day', 'weight', 'lost', 'bmr', 'maintenance', 'intake', 'deficit', 'bmi'] as const;
export type Column = (typeof COLUMNS)[number];

/** CSV settings per locale: Turkish Excel expects semicolons between fields and decimal commas. */
export const CSV_FORMAT: Readonly<Record<Locale, { separator: string; decimal: string }>> = {
  en: { separator: ',', decimal: '.' },
  tr: { separator: ';', decimal: ',' },
};

/** Byte order mark: tells Excel the file is UTF-8, so "VKİ" and "Açık" open intact. */
const BOM = '﻿';

function csvField(value: string, separator: string): string {
  return value.includes(separator) || /["\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * Every day of the plan as CSV, for a spreadsheet: a UTF-8 byte order mark, localized headers,
 * ISO dates (which Excel reads as dates in every language), plain numbers without thousands
 * separators, and CRLF line endings.
 */
export function planCsv(plan: Plan, locale: Locale): string {
  const { separator, decimal } = CSV_FORMAT[locale];
  const headers = weightLossMessages[locale].table.csv;
  const number = (value: number, digits: number) => {
    const text = (Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value).toFixed(digits);
    return decimal === '.' ? text : text.replace('.', decimal);
  };
  const lines = [COLUMNS.map((column) => csvField(headers[column], separator)).join(separator)];
  for (const day of plan.days) {
    lines.push(
      [
        isoDate(addDays(plan.input.start, day.day)),
        String(day.day),
        number(day.weightKg, 2),
        number(plan.input.weightKg - day.weightKg, 2),
        number(day.bmr, 0),
        number(day.maintenance, 0),
        number(day.intake, 0),
        number(day.deficit, 0),
        number(day.bmi, 1),
      ].join(separator),
    );
  }
  return `${BOM}${lines.join('\r\n')}\r\n`;
}
