import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVITY_FACTORS,
  KCAL_PER_KG,
  MAX_PLAN_DAYS,
  addDays,
  addMonths,
  bmi,
  bmiCategory,
  bmrAt,
  bmrLine,
  buildPlan,
  daysBetween,
  defaultIntake,
  equilibriumWeight,
  harrisBenedict,
  isoDate,
  katchMcArdle,
  localIsoDate,
  mifflinStJeor,
  parseIsoDate,
  parseNumber,
  tableDays,
  validateInput,
  type PlanInput,
  type RawInput,
} from '../src/lib/health/weight-plan.ts';

const close = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

/** The page's defaults: a 30-year-old man, 178 cm, 90 kg → 80 kg, moderately active. */
function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    sex: 'male',
    age: 30,
    heightCm: 178,
    weightKg: 90,
    targetKg: 80,
    bodyFatPercent: null,
    activity: 'moderate',
    formula: 'mifflin',
    mode: 'intake',
    intakeKcal: 2390,
    deficitKcal: 500,
    start: parseIsoDate('2026-01-01')!,
    ...overrides,
  };
}

const raw = (overrides: Partial<RawInput> = {}): RawInput => ({
  sex: 'male',
  age: '30',
  height: '178',
  weight: '90',
  target: '80',
  bodyFat: '',
  activity: 'moderate',
  formula: 'mifflin',
  mode: 'intake',
  intake: '2390',
  deficit: '500',
  start: '2026-01-01',
  ...overrides,
});

// ------------------------------------------------------------------ BMR

test('Mifflin–St Jeor matches hand-computed values', () => {
  // 10·90 + 6.25·178 − 5·30 + 5 = 900 + 1112.5 − 150 + 5
  close(mifflinStJeor('male', 90, 178, 30), 1867.5);
  // 10·60 + 6.25·165 − 5·40 − 161 = 600 + 1031.25 − 200 − 161
  close(mifflinStJeor('female', 60, 165, 40), 1270.25);
});

test('revised Harris–Benedict (Roza & Shizgal 1984) matches hand-computed values', () => {
  // 88.362 + 13.397·90 + 4.799·178 − 5.677·30 = 88.362 + 1205.73 + 854.222 − 170.31
  close(harrisBenedict('male', 90, 178, 30), 1978.004, 1e-9);
  // 447.593 + 9.247·60 + 3.098·165 − 4.330·40 = 447.593 + 554.82 + 511.17 − 173.2
  close(harrisBenedict('female', 60, 165, 40), 1340.383, 1e-9);
});

test('Katch–McArdle uses lean mass, and lean mass falls by a quarter of each kilogram lost', () => {
  close(katchMcArdle(70), 370 + 21.6 * 70); // 1882
  const line = bmrLine('katch', input({ bodyFatPercent: 20 }));
  // 90 kg at 20 % fat: 72 kg lean → 370 + 21.6·72
  close(bmrAt(line, 90), 1925.2);
  // 4 kg later, 1 kg of it lean: 71 kg lean
  close(bmrAt(line, 86), 370 + 21.6 * 71);
  close(line.slope, 5.4);
  assert.throws(() => bmrLine('katch', input()), /body-fat/);
});

test('each BMR line agrees with its equation at any weight', () => {
  for (const sex of ['female', 'male'] as const) {
    const person = input({ sex, age: 47, heightCm: 163 });
    for (const weight of [50, 72.5, 130]) {
      close(bmrAt(bmrLine('mifflin', person), weight), mifflinStJeor(sex, weight, 163, 47));
      close(bmrAt(bmrLine('harris', person), weight), harrisBenedict(sex, weight, 163, 47));
    }
  }
});

test('the suggested intake is maintenance minus 500, rounded to 10 kcal', () => {
  const maintenance = 1867.5 * 1.55; // 2894.625
  assert.equal(defaultIntake(maintenance), 2390);
  assert.equal(defaultIntake(1004), 500, 'never below the smallest intake the form accepts');
});

// ------------------------------------------------------------------ projection

test('a fixed deficit loses weight in a straight line: 770 kcal a day is 0.1 kg a day', () => {
  const plan = buildPlan(input({ mode: 'deficit', deficitKcal: 770 }));
  assert.equal(plan.outcome, 'reached');
  assert.equal(plan.targetDay, 100);
  assert.equal(plan.linearDays, 100);
  assert.equal(plan.days.length, 101);
  close(plan.days[50]!.weightKg, 85, 1e-9);
  close(plan.firstWeekLossKg, 0.7, 1e-9);
  assert.equal(isoDate(addDays(plan.input.start, plan.targetDay!)), '2026-04-11');
  // The deficit stays fixed, so what is eaten falls with maintenance.
  for (const day of plan.days) close(day.deficit, 770, 1e-9);
  assert.ok(plan.days[100]!.intake < plan.days[0]!.intake);
  close(plan.days[0]!.intake - plan.days[100]!.intake, 10 * 10 * 1.55, 1e-6);
});

test('a fixed intake is slower than the linear rule, because maintenance falls with weight', () => {
  const firstDeficit = 1867.5 * 1.55 - 2124.625; // 770 kcal on day 0, as above
  const plan = buildPlan(input({ intakeKcal: 2124.625 }));
  close(plan.days[0]!.deficit, firstDeficit);
  assert.equal(plan.outcome, 'reached');
  assert.equal(plan.linearDays, 100);
  assert.ok(plan.targetDay! > 100, `reached on day ${plan.targetDay}`);
  // The deficit shrinks by 10 kcal × PAL for every kilogram lost.
  const day = plan.days[60]!;
  close(day.deficit, 770 - (90 - day.weightKg) * 10 * 1.55, 1e-6);
  // Each day's step follows from that day's deficit.
  close(plan.days[1]!.weightKg, 90 - 770 / KCAL_PER_KG);
  // The day agrees with the closed form: the gap to equilibrium shrinks by r each day.
  const level = plan.equilibriumKg!;
  const ratio = 1 - (1.55 * 10) / KCAL_PER_KG;
  assert.equal(plan.targetDay, Math.ceil(Math.log((80 - level) / (90 - level)) / Math.log(ratio)));
  assert.ok(plan.days.at(-1)!.weightKg <= 80 && plan.days.at(-2)!.weightKg > 80);
});

test('the default plan reaches 80 kg after about six months', () => {
  const plan = buildPlan(input());
  assert.equal(plan.outcome, 'reached');
  assert.ok(plan.targetDay! > 170 && plan.targetDay! < 200, `day ${plan.targetDay}`);
  assert.ok(plan.linearDays! < plan.targetDay!);
  assert.deepEqual(plan.warnings, []);
});

test('the equilibrium weight is where maintenance equals the intake', () => {
  const line = bmrLine('mifflin', input());
  const level = equilibriumWeight(line, 1.55, 2800);
  // (2800 / 1.55 − (6.25·178 − 5·30 + 5)) / 10
  close(level, (2800 / 1.55 - 967.5) / 10);
  close(bmrAt(line, level) * 1.55, 2800, 1e-9);
  const katch = bmrLine('katch', input({ bodyFatPercent: 25 }));
  close(bmrAt(katch, equilibriumWeight(katch, 1.2, 2000)) * 1.2, 2000, 1e-9);
});

test('a target at or below the equilibrium weight is reported as out of reach', () => {
  const plan = buildPlan(input({ intakeKcal: 2800 }));
  assert.equal(plan.outcome, 'equilibrium');
  assert.equal(plan.targetDay, null);
  const level = plan.equilibriumKg!;
  assert.ok(level > 80 && level < 84, `levels off at ${level}`);
  const last = plan.days.at(-1)!;
  // The curve is drawn until it has covered 95 % of the way, flattening toward the level.
  assert.ok(last.weightKg > level && last.weightKg - level <= 0.05 * (90 - level) + 1e-9);
  assert.ok(plan.days.length <= MAX_PLAN_DAYS + 1);
  const early = plan.days[0]!.weightKg - plan.days[30]!.weightKg;
  const late = plan.days.at(-31)!.weightKg - last.weightKg;
  assert.ok(late < early / 5, 'the loss slows down');
  // Exactly at the equilibrium is not reached either.
  const exact = buildPlan(input({ intakeKcal: (80 * 10 + 967.5) * 1.55 }));
  assert.equal(exact.outcome, 'equilibrium');
});

test('an intake at or above maintenance loses nothing', () => {
  const plan = buildPlan(input({ intakeKcal: 3000 }));
  assert.equal(plan.outcome, 'noDeficit');
  assert.equal(plan.days.length, 1);
  assert.equal(plan.linearDays, null);
  assert.equal(plan.firstWeekLossKg, 0);
});

test('a target reached only after five years is reported with its projected day', () => {
  // Equilibrium at 79.9 kg: the last 0.1 kg above it takes years.
  const plan = buildPlan(input({ intakeKcal: (79.9 * 10 + 967.5) * 1.55 }));
  assert.equal(plan.outcome, 'tooSlow');
  assert.equal(plan.targetDay, null);
  assert.equal(plan.days.length, MAX_PLAN_DAYS + 1);
  assert.ok(plan.projectedDay! > MAX_PLAN_DAYS);
  assert.ok(plan.days.at(-1)!.weightKg > 80);
  // A tiny fixed deficit is too slow as well: 10 kg at 50 kcal a day is 1,540 days, 20 kg is 3,080.
  assert.equal(buildPlan(input({ mode: 'deficit', deficitKcal: 50 })).outcome, 'reached');
  const slow = buildPlan(input({ mode: 'deficit', deficitKcal: 50, targetKg: 70 }));
  assert.equal(slow.outcome, 'tooSlow');
  assert.equal(slow.projectedDay, 3080);
});

test('warnings: below BMR, low intake, fast loss and an underweight target', () => {
  const hard = buildPlan(input({ intakeKcal: 1400 }));
  assert.deepEqual(hard.warnings, ['belowBmr', 'lowIntake', 'fastLoss']);
  const woman = buildPlan(
    input({ sex: 'female', age: 35, heightCm: 165, weightKg: 70, targetKg: 48, intakeKcal: 1300, activity: 'light' }),
  );
  assert.ok(!woman.warnings.includes('lowIntake'), '1,300 kcal is above the 1,200 kcal mark for women');
  assert.ok(woman.warnings.includes('lowTargetBmi'), '48 kg at 165 cm is a BMI of 17.6');
  // A fixed deficit: what is eaten falls over the plan, and the warning looks at every day.
  const deficit = buildPlan(input({ mode: 'deficit', deficitKcal: 1300, weightKg: 90, targetKg: 70, activity: 'sedentary' }));
  assert.ok(deficit.warnings.includes('belowBmr'));
});

// ------------------------------------------------------------------ BMI

test('BMI and the WHO categories', () => {
  close(bmi(90, 178), 90 / 1.78 ** 2);
  assert.equal(bmiCategory(18.49), 'underweight');
  assert.equal(bmiCategory(18.5), 'normal');
  assert.equal(bmiCategory(24.99), 'normal');
  assert.equal(bmiCategory(25), 'overweight');
  assert.equal(bmiCategory(29.9), 'overweight');
  assert.equal(bmiCategory(30), 'obese1');
  assert.equal(bmiCategory(35), 'obese2');
  assert.equal(bmiCategory(40), 'obese3');
  assert.equal(bmiCategory(bmi(90, 178)), 'overweight');
});

// ------------------------------------------------------------------ dates and tables

test('calendar dates', () => {
  assert.equal(parseIsoDate('2026-02-30'), null);
  assert.equal(parseIsoDate('2026-2-3'), null);
  assert.equal(isoDate(parseIsoDate('2028-02-29')!), '2028-02-29');
  assert.equal(isoDate(addMonths(parseIsoDate('2026-01-31')!, 1)), '2026-02-28');
  assert.equal(isoDate(addMonths(parseIsoDate('2027-12-15')!, 2)), '2028-02-15');
  assert.equal(daysBetween(parseIsoDate('2026-01-01')!, parseIsoDate('2027-01-01')!), 365);
  assert.equal(localIsoDate(new Date(2026, 9, 5, 23, 30)), '2026-10-05');
});

test('table rows: weekly, monthly on the same date, daily, always ending on the last day', () => {
  const plan = buildPlan(input({ mode: 'deficit', deficitKcal: 770, start: parseIsoDate('2026-01-31')! }));
  const weekly = tableDays(plan, 'weekly').map((day) => day.day);
  assert.deepEqual(weekly.slice(0, 3), [0, 7, 14]);
  assert.equal(weekly.at(-2), 98);
  assert.equal(weekly.at(-1), 100);
  // 31 Jan, 28 Feb, 31 Mar, 30 Apr: day 0, 28, 59, 89, then the target day.
  assert.deepEqual(
    tableDays(plan, 'monthly').map((day) => day.day),
    [0, 28, 59, 89, 100],
  );
  assert.equal(tableDays(plan, 'daily').length, 101);
});

// ------------------------------------------------------------------ input

test('numbers are read with a decimal point or a decimal comma', () => {
  assert.equal(parseNumber('72,5'), 72.5);
  assert.equal(parseNumber(' 72.5 '), 72.5);
  assert.equal(parseNumber(''), null);
  assert.ok(Number.isNaN(parseNumber('72,5,1')));
  assert.ok(Number.isNaN(parseNumber('-5')));
  assert.ok(Number.isNaN(parseNumber('abc')));
  assert.equal(parseNumber('1.850', { grouping: true }), 1850);
  assert.equal(parseNumber('1,850', { grouping: true }), 1850);
  assert.equal(parseNumber('1 850', { grouping: true }), 1850);
  assert.equal(parseNumber('1850,5', { grouping: true }), 1850.5);
});

test('validation accepts the defaults and reports each problem by field', () => {
  const ok = validateInput(raw({ weight: '90,5', intake: '2.390' }));
  assert.ok(ok.ok);
  assert.equal(ok.input.weightKg, 90.5);
  assert.equal(ok.input.intakeKcal, 2390);
  assert.equal(ok.input.start.toISOString(), '2026-01-01T00:00:00.000Z');

  const bad = validateInput(
    raw({ age: '', height: '2m', weight: '301', target: '20', intake: '100', start: '2026-02-30' }),
  );
  assert.ok(!bad.ok);
  assert.deepEqual(bad.errors, {
    age: 'empty',
    height: 'number',
    weight: 'range',
    target: 'range',
    intake: 'range',
    start: 'number',
  });

  assert.deepEqual(validateInput(raw({ age: '14' })), { ok: false, errors: { age: 'range' } });
  assert.deepEqual(validateInput(raw({ age: '101' })), { ok: false, errors: { age: 'range' } });
  assert.deepEqual(validateInput(raw({ height: '119' })), { ok: false, errors: { height: 'range' } });
  assert.deepEqual(validateInput(raw({ target: '90' })), { ok: false, errors: { target: 'notBelow' } });
  assert.deepEqual(validateInput(raw({ target: '95' })), { ok: false, errors: { target: 'notBelow' } });
  assert.deepEqual(validateInput(raw({ start: '' })), { ok: false, errors: { start: 'empty' } });
  assert.deepEqual(validateInput(raw({ start: '1999-12-31' })), { ok: false, errors: { start: 'range' } });
});

test('validation checks only the field the plan mode uses, and body fat only when needed', () => {
  assert.ok(validateInput(raw({ mode: 'deficit', intake: '' })).ok);
  assert.ok(validateInput(raw({ mode: 'intake', deficit: 'x' })).ok);
  assert.deepEqual(validateInput(raw({ mode: 'deficit', deficit: '' })), { ok: false, errors: { deficit: 'empty' } });
  assert.deepEqual(validateInput(raw({ formula: 'katch' })), { ok: false, errors: { bodyFat: 'empty' } });
  assert.deepEqual(validateInput(raw({ bodyFat: '80' })), { ok: false, errors: { bodyFat: 'range' } });
  const katch = validateInput(raw({ formula: 'katch', bodyFat: '22,5' }));
  assert.ok(katch.ok);
  assert.equal(katch.input.bodyFatPercent, 22.5);
  // A deficit larger than maintenance at the target would mean eating nothing.
  const tiny = raw({ sex: 'female', age: '80', height: '150', weight: '50', target: '40', activity: 'sedentary' });
  assert.deepEqual(validateInput({ ...tiny, mode: 'deficit', deficit: '1500' }), {
    ok: false,
    errors: { deficit: 'aboveMaintenance' },
  });
  // Unknown choices fall back to the defaults.
  const fallback = validateInput(raw({ sex: 'x', activity: 'y', formula: 'z', mode: 'w' }));
  assert.ok(fallback.ok);
  assert.equal(fallback.input.sex, 'male');
  assert.equal(fallback.input.activity, 'moderate');
  assert.equal(ACTIVITY_FACTORS[fallback.input.activity], 1.55);
});
