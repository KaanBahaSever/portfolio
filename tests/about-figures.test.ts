import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  EARTH_MU,
  EARTH_RADIUS,
  MOON_ORBIT_RADIUS,
  PARKING_ALTITUDE,
  RBAC_PERMISSIONS,
  RBAC_ROLES,
  accessMatrix,
  burnForApogee,
  caesarShift,
  conicArc,
  curvePath,
  curvePoint,
  densestCell,
  flightProfile,
  gnomons,
  hohmannTransfer,
  integrateTrajectory,
  leadingRuns,
  linePath,
  minimax,
  placementDensity,
  sCurve,
  steer,
  steeringDirection,
  type RbacPermission,
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

test('accessMatrix: every role holds the permissions of the roles below it, and more', () => {
  const grants = accessMatrix<RbacPermission>(
    RBAC_ROLES.map((r) => r.adds),
    RBAC_PERMISSIONS,
  );
  assert.equal(grants.length, 4);
  for (const row of grants) assert.equal(row.length, RBAC_PERMISSIONS.length);
  for (let role = 1; role < grants.length; role++) {
    const below = grants[role - 1]!;
    const here = grants[role]!;
    // Nested: nothing the role below holds is lost…
    below.forEach((held, p) => assert.ok(!held || here[p], `role ${role} keeps ${RBAC_PERMISSIONS[p]}`));
    // …and each role adds at least one permission.
    assert.ok(here.some((held, p) => held && !below[p]), `role ${role} adds a permission`);
  }
  // The most privileged role holds everything.
  assert.ok(grants.at(-1)!.every(Boolean));
});

test('accessMatrix: the lowest role reaches no private data', () => {
  const grants = accessMatrix<RbacPermission>(
    RBAC_ROLES.map((r) => r.adds),
    RBAC_PERMISSIONS,
  );
  const lowest = grants[0]!;
  RBAC_PERMISSIONS.forEach((permission, p) => {
    if (permission.startsWith('private.')) assert.equal(lowest[p], false, permission);
  });
  // The dashed line splits the columns once: all public ones first, then all private ones.
  const firstPrivate = RBAC_PERMISSIONS.findIndex((p) => p.startsWith('private.'));
  assert.ok(firstPrivate > 0);
  assert.ok(RBAC_PERMISSIONS.slice(0, firstPrivate).every((p) => p.startsWith('public.')));
  assert.ok(RBAC_PERMISSIONS.slice(firstPrivate).every((p) => p.startsWith('private.')));
});

test('accessMatrix: the granted cells form a staircase', () => {
  const grants = accessMatrix<RbacPermission>(
    RBAC_ROLES.map((r) => r.adds),
    RBAC_PERMISSIONS,
  );
  const runs = leadingRuns(grants);
  // Every row is one unbroken run from the first column…
  grants.forEach((row, role) => {
    assert.deepEqual(
      row,
      row.map((_, p) => p < runs[role]!),
      `role ${role} is granted a prefix of the columns`,
    );
  });
  // …and every step is longer than the one below it.
  for (let role = 1; role < runs.length; role++) assert.ok(runs[role]! > runs[role - 1]!, `step ${role}`);
  assert.deepEqual(runs, [1, 2, 4, 6]);
  assert.deepEqual(leadingRuns([[true, false, true], [false], []]), [1, 0, 0]);
});

test('accessMatrix rejects unknown permissions and roles that add nothing', () => {
  assert.deepEqual(accessMatrix([['a'], ['b']], ['a', 'b']), [
    [true, false],
    [true, true],
  ]);
  assert.throws(() => accessMatrix([['a'], ['c']], ['a', 'b']), RangeError);
  assert.throws(() => accessMatrix([['a'], ['a']], ['a', 'b']), RangeError);
  assert.throws(() => accessMatrix([[]], ['a']), RangeError);
});

test('gnomons: piece k has 2k − 1 cells, and the pieces tile the n × n square without overlap', () => {
  for (const n of [1, 2, 5, 8]) {
    const pieces = gnomons(n);
    assert.equal(pieces.length, n);
    const seen = new Set<string>();
    pieces.forEach((piece, i) => {
      const k = i + 1;
      assert.equal(piece.cells.length, 2 * k - 1, `n = ${n}, piece ${k}`);
      for (const [row, col] of piece.cells) {
        assert.ok(row >= 0 && col >= 0 && row < n && col < n, `n = ${n}: [${row}, ${col}] is on the board`);
        const key = `${row},${col}`;
        assert.ok(!seen.has(key), `n = ${n}: [${row}, ${col}] is in two pieces`);
        seen.add(key);
      }
      // The first k pieces make the k × k square.
      assert.equal(seen.size, k * k);
      for (const [row, col] of piece.cells) assert.equal(Math.max(row, col), k - 1);
      assert.deepEqual(piece.corner, [k - 1, k - 1]);
      assert.ok(piece.cells.some(([row, col]) => row === k - 1 && col === k - 1), 'the corner is one of its cells');
    });
    assert.equal(seen.size, n * n);
  }
  assert.throws(() => gnomons(0), RangeError);
  assert.throws(() => gnomons(2.5), RangeError);
});

test('gnomons: each outline encloses exactly its piece', () => {
  // Shoelace formula: the area inside the outline equals the number of unit cells…
  const area = (points: readonly { x: number; y: number }[]) =>
    Math.abs(
      points.reduce((sum, p, i) => {
        const q = points[(i + 1) % points.length]!;
        return sum + p.x * q.y - q.x * p.y;
      }, 0),
    ) / 2;
  for (const piece of gnomons(5)) {
    assert.equal(area(piece.outline), piece.cells.length);
    // …and every cell's centre lies within the outline's bounds.
    const xs = piece.outline.map((p) => p.x);
    const ys = piece.outline.map((p) => p.y);
    for (const [row, col] of piece.cells) {
      assert.ok(col + 0.5 > Math.min(...xs) && col + 0.5 < Math.max(...xs));
      assert.ok(row + 0.5 > Math.min(...ys) && row + 0.5 < Math.max(...ys));
    }
  }
  // 1 + 3 + 5 + 7 + 9 = 5²: the numbers the figure writes on the pieces.
  const sizes = gnomons(5).map((piece) => piece.cells.length);
  assert.deepEqual(sizes, [1, 3, 5, 7, 9]);
  assert.equal(sizes.reduce((a, b) => a + b, 0), 25);
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
  assert.notDeepEqual(tr.journey.chapters.work.figureLabels, en.journey.chapters.work.figureLabels);
});

test('the access-control figure is presented as an example, and the odd-number square states its sum', () => {
  const { en, tr } = aboutMessages;
  // The roles and permissions are illustrative, not crowd.inc's: the caption says so first.
  assert.match(en.journey.chapters.work.caption, /^A schematic example /);
  assert.match(tr.journey.chapters.work.caption, /^Şematik bir örnek/);
  // Every role in the model has a label in both languages, and nothing more.
  for (const locale of LOCALES) {
    const labels = aboutMessages[locale].journey.chapters.work.figureLabels;
    assert.deepEqual(Object.keys(labels.roles).sort(), RBAC_ROLES.map((r) => r.role).sort(), locale);
  }
  // The sum is spelled out in both captions, held together by no-break spaces.
  for (const caption of [en.journey.chapters.community.caption, tr.journey.chapters.community.caption]) {
    assert.ok(caption.includes('1 + 3 + 5 + 7 + 9 = 5²'), caption);
  }
});
