import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, parseIsoDate, type PlanInput } from '../src/lib/health/weight-plan.ts';
import { chartScene, frameFor, timeTicks, weightTicks } from '../src/scripts/tools/weight-loss/chart.ts';
import { COLUMNS, planCsv, presenter } from '../src/scripts/tools/weight-loss/present.ts';
import { STORAGE_KEY, parseSavedForm, serializeForm } from '../src/scripts/tools/weight-loss/saved.ts';
import { weightLossMessages } from '../src/i18n/tools/weight-loss.ts';

const NBSP = ' ';
const BOM = '﻿';
const en = presenter('en');
const tr = presenter('tr');

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
    mode: 'deficit',
    intakeKcal: 2390,
    deficitKcal: 770,
    start: parseIsoDate('2026-01-01')!,
    ...overrides,
  };
}

/** 770 kcal a day from 90 to 80 kg: 0.1 kg a day, reached on day 100 (11 April 2026). */
const linear = buildPlan(input());

test('the summary of a reached target, in both languages', () => {
  const english = en.summary(linear);
  assert.equal(english.headline, 'Target date');
  assert.equal(english.date, 'Saturday, April 11, 2026');
  assert.equal(english.duration, '100 days · 14.3 weeks · about 3.3 months');
  assert.equal(english.message, '');
  assert.deepEqual(
    english.cards.map((card) => card.value),
    [`1,868${NBSP}kcal`, `2,895${NBSP}kcal`, `770${NBSP}kcal`, `−0.70${NBSP}kg`, '28.4 → 25.2', `1,970${NBSP}kcal`],
  );
  assert.equal(english.cards[1]!.note, 'BMR × 1.55');
  assert.equal(english.cards[4]!.note, 'Overweight → Overweight');

  const turkish = tr.summary(linear);
  assert.equal(turkish.date, '11 Nisan 2026 Cumartesi');
  assert.equal(turkish.duration, '100 gün · 14,3 hafta · yaklaşık 3,3 ay');
  assert.equal(turkish.cards[0]!.value, `1.868${NBSP}kcal`);
  assert.equal(turkish.cards[3]!.value, `−0,70${NBSP}kg`);
  assert.equal(turkish.cards[3]!.note, 'kilonuzun %0,8 kadarı');
  assert.equal(turkish.announcement, 'Hedefe 100 gün sonra, 11 Nisan 2026 Cumartesi tarihinde ulaşılıyor.');
});

test('with a fixed intake the last card is the linear estimate', () => {
  const plan = buildPlan(input({ mode: 'intake', intakeKcal: 2124.625 }));
  const card = en.summary(plan).cards[5]!;
  assert.equal(card.label, 'Linear estimate');
  assert.equal(card.value, '100 days');
  assert.match(en.chartLabel(plan), /flattens/);
  assert.doesNotMatch(en.chartLabel(linear), /flattens/);
});

test('the outcomes other than reaching the target say what happens instead', () => {
  const flat = en.summary(buildPlan(input({ mode: 'intake', intakeKcal: 2800 })));
  assert.equal(flat.headline, 'Not reached at this intake');
  assert.equal(flat.date, '');
  assert.match(flat.message, /levels off near 83\.9 kg/);
  // Maintenance at the target: (10·80 + 967.5) × 1.55 = 2,739.6
  assert.match(flat.message, /less than 2,740 kcal/);

  const slow = tr.summary(buildPlan(input({ mode: 'intake', intakeKcal: (79.9 * 10 + 967.5) * 1.55 })));
  assert.equal(slow.headline, 'Beş yıldan uzun');
  assert.match(slow.message, /yaklaşık 6,3 yıl sonra/);

  const none = en.summary(buildPlan(input({ mode: 'intake', intakeKcal: 3000 })));
  assert.equal(none.headline, 'No weight lost');
  assert.equal(none.cards.length, 3);
  assert.match(none.message, /at or above your maintenance of 2,895/);
});

test('warnings are worded with the numbers that triggered them', () => {
  const plan = buildPlan(input({ mode: 'intake', intakeKcal: 1400 }));
  const warnings = tr.summary(plan).warnings;
  assert.equal(warnings.length, 3);
  assert.match(warnings[1]!, /1\.500 kcal/);
  assert.match(warnings[2]!, /%1,5/);
  const thin = en.summary(buildPlan(input({ targetKg: 55 }))).warnings;
  assert.match(thin.at(-1)!, /BMI would be 17\.4/);
});

test('table rows are localized and follow the column order', () => {
  assert.equal(COLUMNS.length, en.row(linear, linear.days[0]!).length);
  assert.deepEqual(en.row(linear, linear.days[100]!), [
    'Apr 11, 2026',
    '100',
    '80.0',
    '10.0',
    '1,768',
    '2,740',
    '1,970',
    '770',
    '25.2',
  ]);
  assert.deepEqual(tr.row(linear, linear.days[100]!).slice(0, 5), ['11 Nis 2026', '100', '80,0', '10,0', '1.768']);
});

test('CSV: English uses commas and decimal points, Turkish semicolons and decimal commas', () => {
  const english = planCsv(linear, 'en');
  assert.ok(english.startsWith(BOM), 'a UTF-8 byte order mark for Excel');
  const lines = english.slice(1).split('\r\n');
  assert.equal(lines.length, linear.days.length + 2, 'a header, one line per day and a final line break');
  assert.equal(lines.at(-1), '');
  assert.equal(lines[0], 'Date,Day,Weight (kg),Total lost (kg),BMR (kcal),Maintenance (kcal),Eaten (kcal),Deficit (kcal),BMI');
  assert.equal(lines[1], '2026-01-01,0,90.00,0.00,1868,2895,2125,770,28.4');
  assert.equal(lines[101], '2026-04-11,100,80.00,10.00,1768,2740,1970,770,25.2');

  const turkish = planCsv(linear, 'tr').slice(1).split('\r\n');
  assert.equal(turkish[0], 'Tarih;Gün;Kilo (kg);Toplam verilen (kg);BMR (kcal);Kalori ihtiyacı (kcal);Yenen (kcal);Açık (kcal);VKİ');
  assert.equal(turkish[1], '2026-01-01;0;90,00;0,00;1868;2895;2125;770;28,4');
  assert.equal(turkish[2], '2026-01-02;1;89,90;0,10;1867;2893;2123;770;28,4');
  // No thousands separators: 1.868 would read as a decimal in Turkish Excel.
  assert.ok(!/\d\.\d{3}[;\r]/.test(planCsv(linear, 'tr')));
  assert.equal(weightLossMessages.tr.table.fileName, 'kilo-plani.csv');
  assert.equal(weightLossMessages.en.table.fileName, 'weight-plan.csv');
});

test('the weight axis spans the data with round ticks', () => {
  assert.deepEqual(weightTicks(78.8, 90.6, 8), { min: 78.8, max: 90.6, values: [80, 82, 84, 86, 88, 90] });
  assert.deepEqual(weightTicks(78.8, 90.6, 4).values, [80, 85, 90]);
  assert.deepEqual(weightTicks(79.7, 80.4, 4).values, [80]);
});

test('the time axis uses weeks for short plans and months or years for long ones', () => {
  const start = parseIsoDate('2026-01-01')!;
  assert.deepEqual(
    timeTicks(start, 182, 4, 'en').map((tick) => tick.label),
    ['Jan 2026', 'Mar', 'May', 'Jul'],
  );
  assert.deepEqual(
    timeTicks(start, 182, 7, 'tr').map((tick) => tick.label),
    ['Oca 2026', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem'],
  );
  assert.deepEqual(
    timeTicks(start, 20, 4, 'en').map((tick) => tick.day),
    [0, 7, 14],
  );
  assert.deepEqual(
    timeTicks(start, 1826, 6, 'en').map((tick) => tick.label),
    ['2026', '2027', '2028', '2029', '2030', '2031'],
  );
  // A plan starting mid-month gets its first tick on the 1st of the next month, with the year.
  assert.deepEqual(timeTicks(parseIsoDate('2026-10-12')!, 120, 6, 'en')[0], { day: 20, label: 'Nov 2026' });
});

test('the chart scene puts the start top-left and the target day at the right edge', () => {
  const frame = frameFor(343);
  const scene = chartScene(linear, frame, 'en');
  assert.equal(scene.x(0), frame.margin.left);
  assert.equal(scene.x(100), frame.width - frame.margin.right);
  assert.ok(scene.y(90) < scene.y(80));
  assert.equal(scene.dayAt(frame.width), 100);
  assert.equal(scene.dayAt(0), 0);
  assert.equal(scene.linearPath, null, 'no separate linear line when the deficit is fixed');
  assert.ok(scene.weightPath.startsWith(`M${frame.margin.left.toFixed(1)} `));
  const adaptive = chartScene(buildPlan(input({ mode: 'intake', intakeKcal: 2390 })), frame, 'en');
  assert.ok(adaptive.linearPath);
});

test('saved form values are read back, and anything malformed is ignored', () => {
  assert.equal(STORAGE_KEY, 'weight-loss:v1:form');
  const raw = {
    sex: 'female',
    age: '41',
    height: '166',
    weight: '74,5',
    target: '66',
    bodyFat: '',
    activity: 'light',
    formula: 'harris',
    mode: 'deficit',
    intake: '1800',
    deficit: '400',
    start: '2026-10-12',
  };
  const saved = { raw, intakeEdited: true, granularity: 'monthly' as const };
  assert.deepEqual(parseSavedForm(serializeForm(saved)), saved);
  assert.equal(parseSavedForm(null), null);
  assert.equal(parseSavedForm('{'), null);
  assert.equal(parseSavedForm('{"raw":{"sex":"female"}}'), null);
  assert.equal(parseSavedForm(JSON.stringify({ ...saved, raw: { ...raw, age: 41 } })), null);
  assert.deepEqual(parseSavedForm(JSON.stringify({ raw, granularity: 'hourly' })), {
    raw,
    intakeEdited: false,
    granularity: 'weekly',
  });
});
