/**
 * Geometry of the weight chart: scales, axis ticks and paths, for a plot of a given pixel size.
 * Pure (no DOM): chart-view.ts draws what this returns, and the tests check the ticks.
 *
 * The chart is laid out in real pixels (the SVG's viewBox matches its width on screen), so the
 * labels keep their size on a phone instead of shrinking with the figure. Ticks are spaced so
 * their labels never touch: fewer, coarser ticks on a narrow screen.
 */
import { LOCALE_META, type Locale } from '../../../i18n/config.ts';
import { addDays, addMonths, daysBetween, type Plan } from '../../../lib/health/weight-plan.ts';

export interface Frame {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
}

/** The frame for a figure `width` pixels wide: a little taller on wide screens. */
export function frameFor(width: number): Frame {
  return {
    width,
    height: width >= 640 ? 320 : 248,
    margin: { top: 20, right: 14, bottom: 30, left: 40 },
  };
}

/** Minimum horizontal room per x-axis label and vertical room per y-axis label, in pixels. */
const X_LABEL_SPACING = 72;
const Y_LABEL_SPACING = 30;

const NICE_STEPS = [0.5, 1, 2, 5, 10, 20, 50, 100];

/**
 * The y-axis: the scale spans exactly [low, high] (so the curve fills the plot), with ticks on
 * the multiples of the smallest round step that leaves at most `maxTicks` of them.
 */
export function weightTicks(low: number, high: number, maxTicks: number): { min: number; max: number; values: number[] } {
  const span = Math.max(high - low, 0.5);
  const step = NICE_STEPS.find((candidate) => Math.floor(span / candidate) + 1 <= Math.max(2, maxTicks)) ?? 100;
  const values: number[] = [];
  for (let value = Math.ceil(low / step) * step; value <= high + 1e-9; value += step) {
    values.push(Math.round(value * 1000) / 1000);
  }
  return { min: low, max: Math.max(high, low + 0.5), values };
}

export interface TimeTick {
  day: number;
  label: string;
}

type TimeStep = { unit: 'day'; step: number } | { unit: 'month'; step: number };

const TIME_STEPS: readonly TimeStep[] = [
  { unit: 'day', step: 1 },
  { unit: 'day', step: 2 },
  { unit: 'day', step: 7 },
  { unit: 'day', step: 14 },
  { unit: 'month', step: 1 },
  { unit: 'month', step: 2 },
  { unit: 'month', step: 3 },
  { unit: 'month', step: 6 },
  { unit: 'month', step: 12 },
];

/**
 * Ticks along the time axis for days 0…totalDays after `start`: every day or week for plans of
 * up to three months ("Oct 19"), otherwise the first of every month, two, three, six or twelve months
 * (Jan, Apr, Jul, Oct for three). Month labels carry the year in January and on the first tick.
 */
export function timeTicks(start: Date, totalDays: number, maxTicks: number, locale: Locale): TimeTick[] {
  const intl = LOCALE_META[locale].intl;
  const dayLabel = new Intl.DateTimeFormat(intl, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const monthLabel = new Intl.DateTimeFormat(intl, { month: 'short', timeZone: 'UTC' });
  const monthYearLabel = new Intl.DateTimeFormat(intl, { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const yearLabel = new Intl.DateTimeFormat(intl, { year: 'numeric', timeZone: 'UTC' });
  const limit = Math.max(2, maxTicks);

  let ticks: TimeTick[] = [];
  // Weeks only for plans of up to three months; longer ones read better by month.
  const steps = totalDays > 92 ? TIME_STEPS.filter((candidate) => candidate.unit === 'month') : TIME_STEPS;
  for (const candidate of steps) {
    ticks = [];
    if (candidate.unit === 'day') {
      for (let day = 0; day <= totalDays; day += candidate.step) {
        ticks.push({ day, label: dayLabel.format(addDays(start, day)) });
      }
    } else {
      // First of each month after the start, on months divisible by the step.
      const firstOfMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
      for (let offset = start.getUTCDate() === 1 ? 0 : 1; ; offset += 1) {
        const date = addMonths(firstOfMonth, offset);
        const day = daysBetween(start, date);
        if (day > totalDays) break;
        if (date.getUTCMonth() % candidate.step !== 0) continue;
        let label: string;
        if (candidate.step === 12) label = yearLabel.format(date);
        else if (ticks.length === 0 || date.getUTCMonth() === 0) label = monthYearLabel.format(date);
        else label = monthLabel.format(date);
        ticks.push({ day, label });
      }
    }
    if (ticks.length <= limit) return ticks;
  }
  return ticks;
}

/** An SVG path through points, rounded to 0.1 px. */
export function linePath(points: ReadonlyArray<readonly [number, number]>): string {
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
}

export interface Scene {
  frame: Frame;
  /** Pixel position of a day and of a weight. */
  x(day: number): number;
  y(kg: number): number;
  /** The day nearest to a horizontal pixel position, within the plan. */
  dayAt(px: number): number;
  yTicks: number[];
  xTicks: TimeTick[];
  weightPath: string;
  /** The naive straight line from the start to the target, or null when it is not drawn. */
  linearPath: string | null;
  /** Weight where the curve levels off (only when the target is out of reach). */
  levelKg: number | null;
}

/**
 * Lays out a plan in `frame`. At most ~600 points are drawn: a five-year daily curve would add
 * nothing visible at screen resolution.
 */
export function chartScene(plan: Plan, frame: Frame, locale: Locale): Scene {
  const { margin } = frame;
  const plotWidth = frame.width - margin.left - margin.right;
  const plotHeight = frame.height - margin.top - margin.bottom;
  const last = plan.days[plan.days.length - 1]!;
  const totalDays = Math.max(1, last.day);

  const levelKg = plan.outcome === 'equilibrium' ? plan.equilibriumKg : null;
  const low = Math.min(plan.input.targetKg, last.weightKg, levelKg ?? Number.POSITIVE_INFINITY);
  const high = plan.input.weightKg;
  // More room below the target line than above the start: the target's date sits under the line.
  const span = high - low;
  const ticks = weightTicks(
    low - Math.max(span * 0.14, 0.3),
    high + Math.max(span * 0.04, 0.15),
    Math.floor(plotHeight / Y_LABEL_SPACING) + 1,
  );

  const x = (day: number) => margin.left + (day / totalDays) * plotWidth;
  const y = (kg: number) => margin.top + ((ticks.max - kg) / (ticks.max - ticks.min)) * plotHeight;
  const dayAt = (px: number) => Math.min(last.day, Math.max(0, Math.round(((px - margin.left) / plotWidth) * totalDays)));

  const stride = Math.max(1, Math.ceil(plan.days.length / 600));
  const sampled = plan.days.filter((day, index) => index % stride === 0 || day === last);
  const weightPath = linePath(sampled.map((day) => [x(day.day), y(day.weightKg)] as const));

  let linearPath: string | null = null;
  if (plan.input.mode === 'intake' && plan.linearDays !== null && plan.outcome !== 'noDeficit') {
    const end = Math.min(plan.linearDays, totalDays);
    const endKg = plan.input.weightKg - ((plan.input.weightKg - plan.input.targetKg) * end) / plan.linearDays;
    linearPath = linePath([
      [x(0), y(plan.input.weightKg)],
      [x(end), y(endKg)],
    ]);
  }

  return {
    frame,
    x,
    y,
    dayAt,
    yTicks: ticks.values,
    xTicks: timeTicks(plan.input.start, last.day, Math.floor(plotWidth / X_LABEL_SPACING) + 1, locale),
    weightPath,
    linearPath,
    levelKg,
  };
}
