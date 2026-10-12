/**
 * Weight-loss plan: basal metabolic rate, maintenance calories and a day-by-day projection of
 * body weight toward a target. Pure module (no DOM), shared by the browser controller and the
 * tests. Units are metric throughout: kilograms, centimetres, years, kcal per day.
 *
 * The model, in the order the page explains it:
 * - BMR from one of three published equations. Each is a straight line in body weight for a
 *   given person, bmr(w) = intercept + slope × w (BmrLine), which keeps the projection and the
 *   equilibrium weight in closed form.
 * - Maintenance (total daily energy expenditure) = BMR × the physical activity level (PAL).
 * - Every day the deficit (maintenance − calories eaten) is turned into weight at
 *   7,700 kcal per kilogram, and BMR is recomputed from the new weight. With a fixed intake
 *   the deficit therefore shrinks as weight falls and the curve flattens toward the weight at
 *   which maintenance equals intake. With a fixed deficit the loss is linear by definition.
 * - Age, height and activity stay as entered for the whole plan.
 *
 * Katch–McArdle uses lean body mass. Over a diet, lean mass is assumed to make up a quarter of
 * the weight lost (the "quarter-FFM rule" of Webster, Hoffman and Garrow 1984 and Forbes), so
 * its BMR line has a slope of 21.6 × 0.25 = 5.4 kcal per kg.
 */

/** Energy in one kilogram of body weight lost, the usual rule of thumb (about 3,500 kcal per pound). */
export const KCAL_PER_KG = 7700;

/** The projection stops after five years (1,826 days, one of them a leap day at most). */
export const MAX_PLAN_DAYS = 5 * 365 + 1;

/** Share of each kilogram lost that is lean mass, for Katch–McArdle (see the module comment). */
export const LEAN_SHARE_OF_LOSS = 0.25;

/**
 * When the target is out of reach, the curve is drawn until it has covered this share of the
 * way to the equilibrium weight (or until MAX_PLAN_DAYS), which is enough to show it flatten.
 */
export const EQUILIBRIUM_SHOWN = 0.95;

export const SEXES = ['female', 'male'] as const;
export type Sex = (typeof SEXES)[number];

export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'very', 'extra'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

/** Physical activity level factors: maintenance = BMR × factor. */
export const ACTIVITY_FACTORS: Readonly<Record<ActivityLevel, number>> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

export const BMR_FORMULAS = ['mifflin', 'harris', 'katch'] as const;
export type BmrFormula = (typeof BMR_FORMULAS)[number];

/** `intake`: the calories eaten each day are fixed. `deficit`: the daily deficit is fixed. */
export const PLAN_MODES = ['intake', 'deficit'] as const;
export type PlanMode = (typeof PLAN_MODES)[number];

/** Daily intake below which the page suggests care: about 1,200 kcal for women, 1,500 for men. */
export const LOW_INTAKE_KCAL: Readonly<Record<Sex, number>> = { female: 1200, male: 1500 };

/** Losing more than this share of body weight per week is flagged as fast. */
export const FAST_LOSS_PER_WEEK = 0.01;

/** Below this BMI the WHO calls a weight underweight. */
export const UNDERWEIGHT_BMI = 18.5;

const isOneOf =
  <T extends string>(values: readonly T[]) =>
  (value: unknown): value is T =>
    (values as readonly unknown[]).includes(value);

export const isSex = isOneOf(SEXES);
export const isActivityLevel = isOneOf(ACTIVITY_LEVELS);
export const isBmrFormula = isOneOf(BMR_FORMULAS);
export const isPlanMode = isOneOf(PLAN_MODES);

// ------------------------------------------------------------------ BMR equations

/** Mifflin–St Jeor (Mifflin et al. 1990): 10w + 6.25h − 5a + 5 for men, − 161 for women. */
export function mifflinStJeor(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

/** The Harris–Benedict equation as revised by Roza and Shizgal (1984). */
export function harrisBenedict(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return sex === 'male'
    ? 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age
    : 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age;
}

/** Katch–McArdle: 370 + 21.6 × lean body mass (kg). */
export function katchMcArdle(leanMassKg: number): number {
  return 370 + 21.6 * leanMassKg;
}

/** The person as entered, at the start of the plan. */
export interface Person {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  /** Body fat in percent, or null when not given (Katch–McArdle needs it). */
  bodyFatPercent: number | null;
}

/** BMR as a straight line in body weight for one person: bmr(w) = intercept + slope × w. */
export interface BmrLine {
  intercept: number;
  slope: number;
}

export function bmrLine(formula: BmrFormula, person: Person): BmrLine {
  const { sex, age, heightCm, weightKg } = person;
  switch (formula) {
    case 'mifflin':
      return { intercept: mifflinStJeor(sex, 0, heightCm, age), slope: 10 };
    case 'harris':
      return {
        intercept: harrisBenedict(sex, 0, heightCm, age),
        slope: sex === 'male' ? 13.397 : 9.247,
      };
    case 'katch': {
      if (person.bodyFatPercent === null) throw new Error('Katch–McArdle needs the body-fat percentage');
      const lean = weightKg * (1 - person.bodyFatPercent / 100);
      // lean(w) = lean − share × (weight − w), so bmr(w) = 370 + 21.6 × lean(w).
      return {
        intercept: katchMcArdle(lean - LEAN_SHARE_OF_LOSS * weightKg),
        slope: 21.6 * LEAN_SHARE_OF_LOSS,
      };
    }
  }
}

export function bmrAt(line: BmrLine, weightKg: number): number {
  return line.intercept + line.slope * weightKg;
}

/**
 * The weight at which maintenance equals a fixed intake: bmr(w)·PAL = intake, so
 * w = (intake / PAL − intercept) / slope. A plan eating `intake` levels off here.
 */
export function equilibriumWeight(line: BmrLine, pal: number, intakeKcal: number): number {
  return (intakeKcal / pal - line.intercept) / line.slope;
}

// ------------------------------------------------------------------ BMI

export const BMI_CATEGORIES = ['underweight', 'normal', 'overweight', 'obese1', 'obese2', 'obese3'] as const;
export type BmiCategory = (typeof BMI_CATEGORIES)[number];

export function bmi(weightKg: number, heightCm: number): number {
  const metres = heightCm / 100;
  return weightKg / (metres * metres);
}

/** The WHO adult categories: below 18.5, 18.5–24.9, 25–29.9, 30–34.9, 35–39.9 and 40 or more. */
export function bmiCategory(value: number): BmiCategory {
  if (value < 18.5) return 'underweight';
  if (value < 25) return 'normal';
  if (value < 30) return 'overweight';
  if (value < 35) return 'obese1';
  if (value < 40) return 'obese2';
  return 'obese3';
}

// ------------------------------------------------------------------ dates

/** Days are counted on a calendar, not a clock: an ISO date "YYYY-MM-DD" at UTC midnight. */
const DAY_MS = 86_400_000;

/** The UTC-midnight Date of an ISO calendar date, or null when it is not a real date. */
export function parseIsoDate(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The calendar date `days` after `start` (UTC midnight). */
export function addDays(start: Date, days: number): Date {
  return new Date(start.getTime() + days * DAY_MS);
}

/** Whole days from `start` to `end` (both UTC midnights). */
export function daysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

/**
 * The same day of the month, `months` later; a day the month does not have becomes its last
 * day (31 January + 1 month = 28 or 29 February).
 */
export function addMonths(start: Date, months: number): Date {
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(start.getUTCDate(), lastDay)));
}

/** Today's date where the visitor is (the local calendar day), as an ISO date. */
export function localIsoDate(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// ------------------------------------------------------------------ input

export interface PlanInput extends Person {
  targetKg: number;
  activity: ActivityLevel;
  formula: BmrFormula;
  mode: PlanMode;
  /** Calories eaten per day (used when mode is 'intake'). */
  intakeKcal: number;
  /** Daily deficit (used when mode is 'deficit'). */
  deficitKcal: number;
  /** First day of the plan (UTC midnight). */
  start: Date;
}

/** The form's values as typed. Numbers are text: "72,5" and "72.5" are both accepted. */
export interface RawInput {
  sex: string;
  age: string;
  height: string;
  weight: string;
  target: string;
  bodyFat: string;
  activity: string;
  formula: string;
  mode: string;
  intake: string;
  deficit: string;
  start: string;
}

export type FieldName = 'age' | 'height' | 'weight' | 'target' | 'bodyFat' | 'intake' | 'deficit' | 'start';

/**
 * Why a field is not accepted: `empty`, `number` (not a number), `range` (outside LIMITS),
 * `notBelow` (the target is not below the current weight), `aboveMaintenance` (the fixed deficit
 * is larger than maintenance at the target weight, so the intake would fall to zero).
 */
export type FieldError = 'empty' | 'number' | 'range' | 'notBelow' | 'aboveMaintenance';

/** Accepted ranges, inclusive. */
export const LIMITS: Readonly<Record<FieldName, readonly [number, number]>> = {
  age: [15, 100],
  height: [120, 230],
  weight: [30, 300],
  target: [30, 300],
  bodyFat: [3, 70],
  intake: [500, 6000],
  deficit: [50, 2500],
  // Years, for the start date.
  start: [2000, 2100],
};

/** Default values: a full result on first load. The intake default follows maintenance (defaultIntake). */
export const DEFAULTS = {
  sex: 'male',
  age: 30,
  heightCm: 178,
  weightKg: 90,
  targetKg: 80,
  activity: 'moderate',
  formula: 'mifflin',
  mode: 'intake',
  deficitKcal: 500,
} as const satisfies Partial<Record<keyof PlanInput, unknown>>;

/** The suggested intake: maintenance minus 500 kcal, rounded to the nearest 10. */
export function defaultIntake(maintenanceKcal: number): number {
  return Math.max(LIMITS.intake[0], Math.round((maintenanceKcal - 500) / 10) * 10);
}

/**
 * Reads a decimal number written either way: "72.5" or "72,5". With `grouping`, a thousands
 * separator is accepted too ("1,850" or "1.850" read as 1850), which is how calorie figures are
 * often written; a single separator followed by exactly three digits is then read as grouping.
 * Returns null for empty text and NaN for text that is not a number.
 */
export function parseNumber(text: string, options: { grouping?: boolean } = {}): number | null {
  const compact = text.replace(/[\s  ']/g, '');
  if (compact === '') return null;
  if (options.grouping && /^\d{1,3}([.,]\d{3})+$/.test(compact)) return Number(compact.replace(/[.,]/g, ''));
  if (!/^\d+([.,]\d+)?$|^[.,]\d+$/.test(compact)) return Number.NaN;
  return Number(compact.replace(',', '.'));
}

export type ValidationResult =
  | { ok: true; input: PlanInput }
  | { ok: false; errors: Partial<Record<FieldName, FieldError>> };

/**
 * Checks the form. Only the field the plan mode uses (intake or deficit) is checked, and the
 * body fat only when it is given or Katch–McArdle is chosen.
 */
export function validateInput(raw: RawInput): ValidationResult {
  const errors: Partial<Record<FieldName, FieldError>> = {};
  const values: Partial<Record<FieldName, number>> = {};

  function read(field: Exclude<FieldName, 'start'>, text: string, optional = false, grouping = false): void {
    const value = parseNumber(text, { grouping });
    if (value === null) {
      if (!optional) errors[field] = 'empty';
      return;
    }
    if (Number.isNaN(value)) errors[field] = 'number';
    else if (value < LIMITS[field][0] || value > LIMITS[field][1]) errors[field] = 'range';
    else values[field] = value;
  }

  const sex = isSex(raw.sex) ? raw.sex : DEFAULTS.sex;
  const activity = isActivityLevel(raw.activity) ? raw.activity : DEFAULTS.activity;
  const formula = isBmrFormula(raw.formula) ? raw.formula : DEFAULTS.formula;
  const mode = isPlanMode(raw.mode) ? raw.mode : DEFAULTS.mode;

  read('age', raw.age);
  read('height', raw.height);
  read('weight', raw.weight);
  read('target', raw.target);
  read('bodyFat', raw.bodyFat, formula !== 'katch');
  if (mode === 'intake') read('intake', raw.intake, false, true);
  else read('deficit', raw.deficit, false, true);

  if (values.weight !== undefined && values.target !== undefined && values.target >= values.weight) {
    errors.target = 'notBelow';
  }

  const start = parseIsoDate(raw.start);
  if (raw.start.trim() === '') errors.start = 'empty';
  else if (!start) errors.start = 'number';
  else if (start.getUTCFullYear() < LIMITS.start[0] || start.getUTCFullYear() > LIMITS.start[1]) errors.start = 'range';

  if (Object.keys(errors).length > 0 || !start) return { ok: false, errors };

  const input: PlanInput = {
    sex,
    age: values.age!,
    heightCm: values.height!,
    weightKg: values.weight!,
    targetKg: values.target!,
    bodyFatPercent: values.bodyFat ?? null,
    activity,
    formula,
    mode,
    intakeKcal: values.intake ?? 0,
    deficitKcal: values.deficit ?? 0,
    start,
  };

  if (mode === 'deficit') {
    const line = bmrLine(formula, input);
    const maintenanceAtTarget = bmrAt(line, input.targetKg) * ACTIVITY_FACTORS[activity];
    if (input.deficitKcal >= maintenanceAtTarget) return { ok: false, errors: { deficit: 'aboveMaintenance' } };
  }
  return { ok: true, input };
}

// ------------------------------------------------------------------ projection

export interface PlanDay {
  /** 0 is the start date. */
  day: number;
  /** Weight on the morning of this day. */
  weightKg: number;
  bmr: number;
  /** Maintenance: BMR × activity factor. */
  maintenance: number;
  intake: number;
  /** maintenance − intake; what this day takes off, at 7,700 kcal per kg. */
  deficit: number;
  bmi: number;
}

/**
 * - `reached`: the target is reached on day `targetDay`.
 * - `equilibrium`: eating this much, weight levels off at `equilibriumKg`, at or above the target.
 * - `tooSlow`: the target would be reached, but only after MAX_PLAN_DAYS (`projectedDay`).
 * - `noDeficit`: the intake is at or above maintenance from the start, so no weight is lost.
 */
export type PlanOutcome = 'reached' | 'equilibrium' | 'tooSlow' | 'noDeficit';

export type PlanWarning = 'belowBmr' | 'lowIntake' | 'fastLoss' | 'lowTargetBmi';

export interface Plan {
  input: PlanInput;
  line: BmrLine;
  pal: number;
  outcome: PlanOutcome;
  /** Day 0 up to the target day (or the last day shown). */
  days: PlanDay[];
  /** The day the target is reached, when it is (outcome `reached`). */
  targetDay: number | null;
  /** When the target would be reached for `tooSlow`; equals targetDay for `reached`. */
  projectedDay: number | null;
  /** Where weight levels off with a fixed intake; null with a fixed deficit. */
  equilibriumKg: number | null;
  /** The naive estimate: (weight − target) × 7,700 / the first day's deficit, as if it never changed. */
  linearDays: number | null;
  /** Weight lost over the first seven days (fewer if the plan is shorter). */
  firstWeekLossKg: number;
  warnings: PlanWarning[];
}

/** Weights within this of the target count as on it (floating-point steps of 0.1 kg). */
const EPSILON = 1e-9;

export function buildPlan(input: PlanInput): Plan {
  const line = bmrLine(input.formula, input);
  const pal = ACTIVITY_FACTORS[input.activity];
  const w0 = input.weightKg;
  const target = input.targetKg;
  const fixedIntake = input.mode === 'intake';

  const dayAt = (day: number, weightKg: number): PlanDay => {
    const bmr = bmrAt(line, weightKg);
    const maintenance = bmr * pal;
    const intake = fixedIntake ? input.intakeKcal : maintenance - input.deficitKcal;
    return { day, weightKg, bmr, maintenance, intake, deficit: maintenance - intake, bmi: bmi(weightKg, input.heightCm) };
  };

  const first = dayAt(0, w0);
  const equilibriumKg = fixedIntake ? equilibriumWeight(line, pal, input.intakeKcal) : null;
  const linearDays = first.deficit > 0 ? Math.ceil(((w0 - target) * KCAL_PER_KG) / first.deficit - EPSILON) : null;

  let outcome: PlanOutcome;
  let projectedDay: number | null = null;
  if (first.deficit <= 0) outcome = 'noDeficit';
  else if (equilibriumKg !== null && equilibriumKg >= target - EPSILON) outcome = 'equilibrium';
  else {
    projectedDay = fixedIntake ? projectedDayFixedIntake(w0, target, equilibriumKg!, line, pal) : linearDays;
    outcome = projectedDay !== null && projectedDay <= MAX_PLAN_DAYS ? 'reached' : 'tooSlow';
  }

  const days: PlanDay[] = [first];
  if (outcome !== 'noDeficit') {
    const shownUntil =
      outcome === 'equilibrium' ? w0 - EQUILIBRIUM_SHOWN * (w0 - (equilibriumKg ?? w0)) : Number.NEGATIVE_INFINITY;
    let current = first;
    while (current.day < MAX_PLAN_DAYS) {
      if (outcome === 'reached' && current.weightKg <= target + EPSILON) break;
      if (outcome === 'equilibrium' && current.weightKg <= shownUntil) break;
      current = dayAt(current.day + 1, current.weightKg - current.deficit / KCAL_PER_KG);
      days.push(current);
    }
  }
  const last = days[days.length - 1]!;
  // Rounding can put the simulated day one off the closed form; the simulation is what is shown.
  if (outcome === 'reached' && last.weightKg > target + EPSILON) outcome = 'tooSlow';
  const targetDay = outcome === 'reached' ? last.day : null;
  if (outcome === 'reached') projectedDay = targetDay;

  const week = days[Math.min(7, days.length - 1)]!;
  const firstWeekLossKg = w0 - week.weightKg;

  return {
    input,
    line,
    pal,
    outcome,
    days,
    targetDay,
    projectedDay,
    equilibriumKg,
    linearDays,
    firstWeekLossKg,
    warnings: planWarnings(input, days, first),
  };
}

/**
 * With a fixed intake, the distance to the equilibrium weight shrinks by the same factor every
 * day, r = 1 − PAL × slope / 7,700, so the day the target is reached follows from a logarithm.
 */
function projectedDayFixedIntake(w0: number, target: number, equilibrium: number, line: BmrLine, pal: number): number {
  const ratio = 1 - (pal * line.slope) / KCAL_PER_KG;
  return Math.ceil(Math.log((target - equilibrium) / (w0 - equilibrium)) / Math.log(ratio) - EPSILON);
}

function planWarnings(input: PlanInput, days: readonly PlanDay[], first: PlanDay): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  if (first.deficit <= 0) {
    if (bmi(input.targetKg, input.heightCm) < UNDERWEIGHT_BMI) warnings.push('lowTargetBmi');
    return warnings;
  }
  if (days.some((day) => day.intake < day.bmr)) warnings.push('belowBmr');
  if (days.some((day) => day.intake < LOW_INTAKE_KCAL[input.sex])) warnings.push('lowIntake');
  if ((first.deficit * 7) / KCAL_PER_KG > FAST_LOSS_PER_WEEK * input.weightKg) warnings.push('fastLoss');
  if (bmi(input.targetKg, input.heightCm) < UNDERWEIGHT_BMI) warnings.push('lowTargetBmi');
  return warnings;
}

// ------------------------------------------------------------------ table rows

export const GRANULARITIES = ['weekly', 'monthly', 'daily'] as const;
export type Granularity = (typeof GRANULARITIES)[number];
export const isGranularity = isOneOf(GRANULARITIES);

/**
 * The days a table shows: every day, every seventh day, or the same date each month. The first
 * and the last day of the plan are always included.
 */
export function tableDays(plan: Plan, granularity: Granularity): PlanDay[] {
  const { days } = plan;
  const last = days[days.length - 1]!;
  let picked: PlanDay[];
  if (granularity === 'daily') picked = [...days];
  else if (granularity === 'weekly') picked = days.filter((day) => day.day % 7 === 0);
  else {
    picked = [];
    for (let month = 0; ; month += 1) {
      const index = daysBetween(plan.input.start, addMonths(plan.input.start, month));
      if (index > last.day) break;
      picked.push(days[index]!);
    }
  }
  if (picked[picked.length - 1] !== last) picked.push(last);
  return picked;
}
