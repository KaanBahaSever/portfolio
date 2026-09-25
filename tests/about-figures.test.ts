import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  densestCell,
  flightProfile,
  integrateTrajectory,
  linePath,
  minimax,
  placementDensity,
  steer,
  steeringDirection,
} from '../src/components/about/geometry.ts';
import { aboutMessages } from '../src/i18n/messages/about.ts';

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
