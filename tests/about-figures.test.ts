import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  EARTH_MU,
  EARTH_RADIUS,
  MOON_ORBIT_RADIUS,
  PARKING_ALTITUDE,
  burnForApogee,
  caesarShift,
  conicArc,
  curvePath,
  curvePoint,
  densestCell,
  flightProfile,
  hohmannTransfer,
  integrateTrajectory,
  linePath,
  minimax,
  placementDensity,
  sCurve,
  steer,
  steeringDirection,
} from '../src/components/about/geometry.ts';
import { LOCALES } from '../src/i18n/config.ts';
import { JOURNEY_CHAPTERS, aboutMessages } from '../src/i18n/messages/about.ts';

const close = (actual: number, expected: number, tolerance: number, what: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} is not within ${tolerance} of ${expected}`);

test('hohmannTransfer matches the textbook LEO-to-GEO transfer', () => {
  // The standard worked example: a 300 km parking orbit to geostationary radius takes
  // Δv₁ ≈ 2.43 km/s, Δv₂ ≈ 1.47 km/s (3.89 km/s in total) and about 5.3 hours.
  const t = hohmannTransfer(EARTH_MU, EARTH_RADIUS + 300, 42_164);
  close(t.dv1, 2.426, 0.005, 'dv1');
  close(t.dv2, 1.467, 0.005, 'dv2');
  close(t.time / 3600, 5.27, 0.01, 'hours');
  close(t.e, (42_164 - 6_678.137) / (42_164 + 6_678.137), 1e-12, 'eccentricity');
});

test('the lunar transfer in Fig. 1 needs about 3.1 km/s and takes about five days', () => {
  const t = hohmannTransfer(EARTH_MU, EARTH_RADIUS + PARKING_ALTITUDE, MOON_ORBIT_RADIUS);
  close(t.dv1, 3.1, 0.05, 'dv1');
  close(t.time / 86_400, 5, 0.1, 'days');
});

test('hohmannTransfer rejects orbits it cannot join', () => {
  assert.throws(() => hohmannTransfer(EARTH_MU, 2, 1), RangeError);
  assert.throws(() => hohmannTransfer(EARTH_MU, 1, 1), RangeError);
  assert.throws(() => hohmannTransfer(0, 1, 2), RangeError);
  assert.throws(() => hohmannTransfer(EARTH_MU, Number.NaN, 2), RangeError);
});

test('conicArc runs from periapsis to apoapsis around the focus', () => {
  const r1 = 26;
  const r2 = 134;
  const arc = conicArc((r1 + r2) / 2, (r2 - r1) / (r2 + r1), 0, Math.PI, 32);
  assert.equal(arc.length, 33);
  close(arc[0]!.x, r1, 1e-9, 'periapsis x');
  close(arc[0]!.y, 0, 1e-9, 'periapsis y');
  close(arc.at(-1)!.x, -r2, 1e-9, 'apoapsis x');
  close(arc.at(-1)!.y, 0, 1e-9, 'apoapsis y');
  // Upper half: y never negative; the widest point is the semi-minor axis √(r1·r2) away.
  assert.ok(arc.every((p) => p.y >= -1e-9));
  close(Math.max(...arc.map((p) => p.y)), Math.sqrt(r1 * r2), 0.5, 'semi-minor axis');
});

test('burnForApogee puts each flight exactly on its target altitude', () => {
  for (const target of [5, 10]) {
    const burn = burnForApogee(target, 4, 1);
    const p = flightProfile({ thrust: 4, burn, gravity: 1, descentRate: 1.1, tau: 0.8, step: 0.125 });
    close(p.apogee.y, target, 1e-9, `apogee for ${target}`);
  }
  // With the same motor, doubling the altitude takes √2 times the burn.
  close(burnForApogee(10, 4, 1) / burnForApogee(5, 4, 1), Math.SQRT2, 1e-12, 'burn ratio');
  assert.equal(burnForApogee(10, 4, 1), 1);
  assert.throws(() => burnForApogee(0, 4, 1), RangeError);
  assert.throws(() => burnForApogee(10, 4, -1), RangeError);
});

test('caesarShift shifts letters around the alphabet and nothing else', () => {
  assert.equal(caesarShift('APOLLO', 3), 'DSROOR');
  assert.equal(caesarShift('xyz ABC!', 3), 'abc DEF!');
  assert.equal(caesarShift(caesarShift('Apollo 11', 7), -7), 'Apollo 11');
  assert.equal(caesarShift('ROCKET', 26), 'ROCKET');
  assert.equal(caesarShift('ROCKET', 29), caesarShift('ROCKET', 3));
  assert.equal(caesarShift('ROCKET', -23), caesarShift('ROCKET', 3));
  // Letters outside A–Z are not part of the cipher's alphabet.
  assert.equal(caesarShift('İĞÜ', 3), 'İĞÜ');
});

test('sCurve and curvePoint: the curve starts and ends at its points, horizontally', () => {
  const curve = sCurve({ x: 0, y: 0 }, { x: 100, y: 40 });
  assert.deepEqual(curvePoint(curve, 0), { x: 0, y: 0 });
  assert.deepEqual(curvePoint(curve, 1), { x: 100, y: 40 });
  // Point-symmetric about its middle.
  assert.deepEqual(curvePoint(curve, 0.5), { x: 50, y: 20 });
  assert.equal(curve.c1.y, 0);
  assert.equal(curve.c2.y, 40);
  assert.equal(curvePath(curve), 'M0 0 C50 0 50 40 100 40');
});

test('placementDensity counts every horizontal and vertical placement', () => {
  // A 3×3 board with one ship of length 3: 3 rows + 3 columns = 6 placements, 3 cells each.
  const grid = placementDensity(3, [3], []);
  assert.deepEqual(grid, [
    [2, 2, 2],
    [2, 2, 2],
    [2, 2, 2],
  ]);
  // A length-2 ship on 3×3: the centre is covered by 4 placements, corners by 2.
  const two = placementDensity(3, [2], []);
  assert.equal(two[1]![1], 4);
  assert.equal(two[0]![0], 2);
});

test('placementDensity never places a ship over a miss', () => {
  const grid = placementDensity(3, [3], [[1, 1]]);
  assert.equal(grid[1]![1], 0);
  // Only the outer row/column placements survive: top/bottom rows and left/right columns.
  assert.deepEqual(grid, [
    [2, 1, 2],
    [1, 0, 1],
    [2, 1, 2],
  ]);
});

test('densestCell returns the first maximum', () => {
  assert.deepEqual(densestCell([[1, 3], [3, 0]]), { row: 0, col: 1, value: 3 });
});

test('minimax backs up values and returns the principal variation', () => {
  assert.deepEqual(minimax([[3, 12], [2, 8], [14, 5]], true), { value: 5, line: [2, 1] });
  assert.deepEqual(minimax([[3, 12, 8], [2, 4, 6], [14, 5, 2]], true), { value: 3, line: [0, 0] });
  assert.deepEqual(minimax(7, true), { value: 7, line: [] });
  assert.throws(() => minimax([], true));
});

test('flightProfile reaches apogee where the vertical velocity is zero and lands', () => {
  const p = flightProfile({ thrust: 4, burn: 1, gravity: 1, descentRate: 1.1, tau: 0.8, step: 0.125 });
  assert.deepEqual(p.burnout, { x: 1, y: 2 });
  assert.deepEqual(p.apogee, { x: 5, y: 10 });
  const peak = Math.max(...p.samples.map((s) => s.y));
  assert.ok(Math.abs(peak - 10) < 1e-9);
  assert.equal(p.samples.at(-1)!.y, 0);
  assert.equal(p.samples[0]!.y, 0);
});

test('flightProfile rejects parameters that would never land instead of looping forever', () => {
  const base = { thrust: 4, burn: 1, gravity: 1, descentRate: 1.1, tau: 0.8, step: 0.125 };
  for (const key of ['gravity', 'descentRate', 'tau', 'step'] as const) {
    assert.throws(() => flightProfile({ ...base, [key]: 0 }), RangeError, key);
    assert.throws(() => flightProfile({ ...base, [key]: -1 }), RangeError, key);
    assert.throws(() => flightProfile({ ...base, [key]: Number.NaN }), RangeError, key);
  }
  // Valid parameters, but touchdown needs ~127 samples.
  assert.throws(() => flightProfile({ ...base, maxSteps: 50 }), /no touchdown/);
});

test('steeringDirection is a unit vector turned by the given angle', () => {
  const d = steeringDirection({ x: 0, y: 0 }, { x: 10, y: 0 }, Math.PI / 2);
  assert.ok(Math.abs(Math.hypot(d.x, d.y) - 1) < 1e-12);
  assert.ok(Math.abs(d.x) < 1e-12 && Math.abs(d.y - 1) < 1e-12);
});

test('steer converges on the target for turns below 90 degrees', () => {
  const path = steer({ x: 0, y: 0 }, { x: 100, y: 50 }, Math.PI / 4, 1, 1);
  assert.deepEqual(path.at(-1), { x: 100, y: 50 });
  assert.ok(path.length < 2000);
});

test('integrateTrajectory lands on the ground and drifts with the crosswind', () => {
  const { positions, velocities } = integrateTrajectory({ x: 1, y: 0, z: 2.6 }, { gravity: 1, crosswind: 0.1, dt: 0.2 });
  assert.equal(positions.length, velocities.length);
  assert.equal(positions.at(-1)!.z, 0);
  assert.ok(positions.at(-1)!.y > 0);
  assert.ok(Math.max(...positions.map((p) => p.z)) > 3);
});

test('linePath formats rounded move/line commands', () => {
  assert.equal(linePath([{ x: 0, y: 0 }, { x: 1.26, y: 2.04 }]), 'M0 0 L1.3 2');
  assert.equal(linePath([]), '');
});

test('about messages define the same keys in both locales', () => {
  const keys = (value: unknown, prefix = ''): string[] =>
    value && typeof value === 'object'
      ? Object.entries(value).flatMap(([k, v]) => keys(v, `${prefix}${k}.`))
      : [prefix];
  assert.deepEqual(keys(aboutMessages.tr), keys(aboutMessages.en));
  assert.equal(aboutMessages.tr.journey.figure(2), 'Şekil 2');
  // The broker figure's visible labels are localized, not hard-coded English.
  assert.notDeepEqual(aboutMessages.tr.journey.chapters.core.figureLabels, aboutMessages.en.journey.chapters.core.figureLabels);
});

test('every journey chapter has text in both locales, in the order JOURNEY_CHAPTERS gives', () => {
  for (const locale of LOCALES) {
    const chapters = aboutMessages[locale].journey.chapters;
    assert.deepEqual(Object.keys(chapters), [...JOURNEY_CHAPTERS], locale);
    for (const key of JOURNEY_CHAPTERS) {
      const { short, label, title } = chapters[key];
      assert.ok(short && label && title, `${locale}.${key}`);
    }
  }
  // Keys the home page and the timeline link to (#journey-<key>) must stay.
  for (const key of ['algorithms', 'avionics', 'guidance', 'simulation', 'core'] as const) {
    assert.ok(JOURNEY_CHAPTERS.includes(key), key);
  }
});

test('figure captions and labels interpolate formatted values without case suffixes', () => {
  const { en, tr } = aboutMessages;
  assert.match(en.journey.chapters.space.caption('3.1', '5'), /Δv ≈ 3\.1 km\/s.*about 5 days/);
  assert.match(tr.journey.chapters.space.caption('3,1', '5'), /\(Δv ≈ 3,1 km\/s\).*yaklaşık 5 gün/);
  assert.equal(en.journey.chapters.avionics.figureLabels.feet('10,000'), '10,000 ft');
  assert.equal(tr.journey.chapters.avionics.figureLabels.feet('10.000'), '10.000 ft');
  assert.equal(en.journey.chapters.avionics.figureLabels.rockets(1), '1 rocket');
  assert.equal(en.journey.chapters.avionics.figureLabels.rockets(2), '2 rockets');
  assert.equal(tr.journey.chapters.avionics.figureLabels.rockets(2), '2 roket');
  // Visible figure labels are translated, not English left in the Turkish page.
  assert.notDeepEqual(tr.journey.chapters.research.figureLabels, en.journey.chapters.research.figureLabels);
  assert.notEqual(tr.journey.chapters.automation.figureLabels.build, en.journey.chapters.automation.figureLabels.build);
});
