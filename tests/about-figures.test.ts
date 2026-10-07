import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CUBESAT_ALTITUDE,
  EARTH_MEAN_RADIUS,
  EARTH_MU,
  EARTH_RADIUS,
  MIN_ELEVATION,
  MOON_ORBIT_RADIUS,
  PARKING_ALTITUDE,
  GOLDEN_ANGLE,
  IDEA_NETWORK,
  burnForApogee,
  caesarShift,
  conicArc,
  curvePath,
  curvePoint,
  densestCell,
  flightProfile,
  gnomons,
  hohmannTransfer,
  ideaNetwork,
  insideRect,
  integrateTrajectory,
  linePath,
  minimax,
  orbitalPeriod,
  overheadPass,
  placementDensity,
  sCurve,
  steer,
  steeringDirection,
  visibleHalfAngle,
  type IdeaSeed,
  type Point,
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

test('the CubeSat figure: a 400 km orbit is in view for about six minutes of an overhead pass', () => {
  assert.equal(EARTH_MEAN_RADIUS, 6_371);
  assert.equal(CUBESAT_ALTITUDE, 400);
  assert.equal(MIN_ELEVATION, 10);
  const pass = overheadPass(EARTH_MU, EARTH_MEAN_RADIUS, CUBESAT_ALTITUDE, MIN_ELEVATION);
  // λ = arccos(6371 / 6771 · cos 10°) − 10° ≈ 12.1°.
  close(pass.halfAngle, 12.08, 0.01, 'half-angle');
  // T = 2π√(6771³ / μ) ≈ 92.4 minutes, and 2λ / 360° of it is about 6.2 minutes.
  assert.ok(pass.period / 60 > 92.3 && pass.period / 60 < 92.6, `period ${pass.period / 60} min`);
  close(pass.duration / 60, 6.2, 0.05, 'pass in minutes');
  close(pass.duration, (pass.period * 2 * pass.halfAngle) / 360, 1e-9, 'duration');
  // The caption rounds it to whole minutes.
  assert.equal(Math.round(pass.duration / 60), 6);
});

test('visibleHalfAngle: the end of the visible arc is exactly ε above the station’s horizon', () => {
  // Station at (0, R), satellite at Earth-central angle λ on the orbit of radius R + h. The
  // elevation is the angle between the line of sight and the local horizontal (the x axis).
  for (const [radius, altitude, elevation] of [
    [EARTH_MEAN_RADIUS, CUBESAT_ALTITUDE, MIN_ELEVATION],
    [72, 32, MIN_ELEVATION], // the drawn radii of the figure
    [6_371, 800, 5],
    [1, 1, 45],
  ] as const) {
    const lambda = (visibleHalfAngle(radius, altitude, elevation) * Math.PI) / 180;
    const r = radius + altitude;
    const dx = r * Math.sin(lambda);
    const dy = r * Math.cos(lambda) - radius;
    close((Math.atan2(dy, dx) * 180) / Math.PI, elevation, 1e-9, `elevation for ${radius}, ${altitude}`);
  }
  // With no mask, the satellite is visible down to the geometric horizon: λ = arccos(R / (R + h)).
  close(visibleHalfAngle(6_371, 400, 0), (Math.acos(6_371 / 6_771) * 180) / Math.PI, 1e-12, 'no mask');
  // A higher mask shortens the arc.
  assert.ok(visibleHalfAngle(6_371, 400, 20) < visibleHalfAngle(6_371, 400, 10));
  assert.throws(() => visibleHalfAngle(0, 400, 10), RangeError);
  assert.throws(() => visibleHalfAngle(6_371, -1, 10), RangeError);
  assert.throws(() => visibleHalfAngle(6_371, 400, 90), RangeError);
  assert.throws(() => visibleHalfAngle(6_371, 400, -1), RangeError);
});

test('orbitalPeriod follows Kepler’s third law', () => {
  // The geostationary radius goes round once a sidereal day (86 164 s).
  close(orbitalPeriod(EARTH_MU, 42_164), 86_164, 5, 'geostationary period');
  assert.throws(() => orbitalPeriod(EARTH_MU, 0), RangeError);
  assert.throws(() => orbitalPeriod(-1, 7_000), RangeError);
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

/* The crowd.inc figure: a network of ideas and the people who help with them. */

const network = ideaNetwork(IDEA_NETWORK);
const { radius, region } = IDEA_NETWORK;
const ideaAt = (i: number) => network.ideas[i]!.at;
const userAt = (u: number) => network.users[u]!.at;
/** Distance from p to the segment from a to b. */
const segmentDistance = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

test('ideaNetwork: every link joins a user to an idea, and every user helps with one or two ideas', () => {
  assert.ok(network.links.length > 0);
  for (const { user, idea } of network.links) {
    assert.ok(Number.isInteger(user) && user >= 0 && user < network.users.length, `user ${user}`);
    assert.ok(Number.isInteger(idea) && idea >= 0 && idea < network.ideas.length, `idea ${idea}`);
  }
  const keys = network.links.map(({ user, idea }) => `${user}→${idea}`);
  assert.equal(new Set(keys).size, keys.length, 'no link is drawn twice');
  const ideasOf = network.users.map((_, u) => network.links.filter((link) => link.user === u).length);
  ideasOf.forEach((n, u) => assert.ok(n === 1 || n === 2, `user ${u} helps with ${n} ideas`));
  // Some people help with two ideas: that is what makes it a network rather than separate stars.
  assert.ok(ideasOf.filter((n) => n === 2).length >= 5);
});

test('ideaNetwork: every idea has a helper, and the highlighted idea has the most', () => {
  network.ideas.forEach((idea, i) => {
    assert.equal(idea.helpers, network.links.filter((link) => link.idea === i).length, `idea ${i}`);
    assert.ok(idea.helpers >= 1, `idea ${i} has at least one helper`);
  });
  const busiest = network.ideas[network.busiest]!;
  assert.equal(busiest.private, false, 'the highlighted idea is a public one');
  network.ideas.forEach((idea, i) => {
    if (i !== network.busiest) assert.ok(idea.helpers < busiest.helpers, `idea ${i} has fewer helpers`);
  });
});

test('ideaNetwork: private ideas keep their links inside the private region, public ones stay outside', () => {
  assert.ok(network.ideas.some((idea) => idea.private) && network.ideas.some((idea) => !idea.private));
  network.ideas.forEach((idea, i) => assert.equal(insideRect(idea.at, region), idea.private, `idea ${i}`));
  network.users.forEach((user, u) => assert.equal(insideRect(user.at, region), user.private, `user ${u}`));
  for (const { user, idea } of network.links) {
    const isPrivate = network.ideas[idea]!.private;
    // Both ends on the same side, so no path of links leads out of the private region…
    assert.equal(network.users[user]!.private, isPrivate, `link ${user}→${idea} stays on one side`);
    // …and the whole line too: a public link must not pass over the region between its ends.
    const [from, to] = [userAt(user), ideaAt(idea)];
    for (let k = 0; k <= 32; k++) {
      const p = { x: from.x + (k / 32) * (to.x - from.x), y: from.y + (k / 32) * (to.y - from.y) };
      assert.equal(insideRect(p, region), isPrivate, `link ${user}→${idea}, point ${k} of 32`);
    }
  }
});

test('ideaNetwork: nodes do not overlap; links read as lines, pass clear of other nodes and never cross', () => {
  const nodes = [
    ...network.ideas.map((idea, i) => ({ at: idea.at, r: radius.idea, name: `idea ${i}` })),
    ...network.users.map((user, u) => ({ at: user.at, r: radius.user, name: `user ${u}` })),
  ];
  for (const [a, n] of nodes.entries()) {
    // Inside the drawing: the labels sit above the region's top edge, nothing below its bottom.
    assert.ok(n.at.x - n.r >= 0 && n.at.x + n.r <= 320, `${n.name} is inside the 320-unit width`);
    assert.ok(n.at.y - n.r >= region.y, `${n.name} is below the labels`);
    assert.ok(n.at.y + n.r <= region.y + region.height, `${n.name} is above the bottom`);
    for (const m of nodes.slice(a + 1)) {
      const gap = Math.hypot(n.at.x - m.at.x, n.at.y - m.at.y) - n.r - m.r;
      assert.ok(gap >= 4, `${n.name} and ${m.name} are ${gap.toFixed(1)} apart`);
    }
  }
  // Clear air around the dashed boundary: private nodes keep well inside it, public ones outside.
  for (const n of nodes) {
    const right = region.x + region.width;
    const bottom = region.y + region.height;
    const inside = Math.min(n.at.x - region.x, right - n.at.x, n.at.y - region.y, bottom - n.at.y);
    const outside = Math.hypot(
      Math.max(region.x - n.at.x, 0, n.at.x - right),
      Math.max(region.y - n.at.y, 0, n.at.y - bottom),
    );
    assert.ok((insideRect(n.at, region) ? inside : outside) >= n.r + 8, `${n.name} is clear of the boundary`);
  }
  for (const { user, idea } of network.links) {
    // The figure draws a link from the dot's edge to the idea's circle: long enough to read as a
    // line even at 320 px, not a stub that leaves the dot looking unconnected.
    const drawn = Math.hypot(userAt(user).x - ideaAt(idea).x, userAt(user).y - ideaAt(idea).y) - radius.user - radius.idea;
    assert.ok(drawn >= 10, `link ${user}→${idea} is only ${drawn.toFixed(1)} long`);
    for (const n of nodes) {
      if (n.at === userAt(user) || n.at === ideaAt(idea)) continue;
      const clearance = segmentDistance(n.at, userAt(user), ideaAt(idea)) - n.r;
      assert.ok(clearance >= 2, `link ${user}→${idea} passes ${n.name} at ${clearance.toFixed(1)}`);
    }
  }
  // Proper crossings only: links that share a user or an idea meet at it, which is fine.
  const side = (a: Point, b: Point, c: Point) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  network.links.forEach((p, i) => {
    for (const q of network.links.slice(i + 1)) {
      if (p.user === q.user || p.idea === q.idea) continue;
      const [a, b, c, d] = [userAt(p.user), ideaAt(p.idea), userAt(q.user), ideaAt(q.idea)];
      const crosses = side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
      assert.ok(!crosses, `links ${p.user}→${p.idea} and ${q.user}→${q.idea} cross`);
    }
  });
});

test('ideaNetwork: helpers fill a ring by the golden angle, with equal areas', () => {
  close(GOLDEN_ANGLE, 137.50776405003785, 1e-9, 'golden angle');
  const origin = { x: 0, y: 0 };
  const three = ideaNetwork({
    ideas: [{ at: origin, helpers: 3, ring: [10, 20], phase: 0 }],
    shared: [],
    region: { x: 100, y: 100, width: 10, height: 10 },
  });
  const radii = three.users.map((u) => Math.hypot(u.at.x, u.at.y));
  // r² steps evenly from 10² to 20²: 100, 250, 400.
  radii.forEach((r, k) => close(r * r, 100 + 150 * k, 1e-9, `helper ${k}`));
  close(three.users[0]!.at.x, 10, 1e-9, 'first helper along the phase');
  const turn = (Math.atan2(three.users[1]!.at.y, three.users[1]!.at.x) * 180) / Math.PI;
  close(turn, GOLDEN_ANGLE, 1e-9, 'second helper one golden angle further round (clockwise on screen)');
  assert.equal(three.busiest, 0);
});

test('ideaNetwork: a shared helper stands between its two ideas, to the right of the line', () => {
  const pair = ideaNetwork({
    ideas: [
      { at: { x: 0, y: 0 }, helpers: 1, ring: [5, 5], phase: 180 },
      { at: { x: 20, y: 0 }, helpers: 2, ring: [5, 5], phase: 0 },
    ],
    shared: [[0, 1, 3]],
    region: { x: 100, y: 100, width: 10, height: 10 },
  });
  // Facing +x on screen (y down), the right-hand side is +y.
  assert.deepEqual(pair.users.at(-1)!.at, { x: 10, y: 3 });
  assert.deepEqual(pair.links.slice(-2), [
    { user: 3, idea: 0 },
    { user: 3, idea: 1 },
  ]);
  assert.deepEqual(
    pair.ideas.map((idea) => idea.helpers),
    [2, 3],
  );
  assert.equal(pair.busiest, 1);
});

test('ideaNetwork refuses to cross the private boundary, and malformed specs', () => {
  const region = { x: 50, y: 0, width: 50, height: 50 };
  const idea = (x: number, extra: Partial<IdeaSeed> = {}): IdeaSeed => ({
    at: { x, y: 25 },
    helpers: 2,
    ring: [8, 10],
    phase: 0,
    ...extra,
  });
  const ok = { ideas: [idea(20), idea(75, { private: true })], shared: [], region };
  assert.equal(ideaNetwork(ok).users.length, 4);
  // A helper of a private idea outside the region, and a public idea's helper inside it.
  assert.throws(
    () => ideaNetwork({ ...ok, ideas: [idea(20), idea(55, { private: true, phase: 180 })] }),
    /private but outside/,
  );
  assert.throws(() => ideaNetwork({ ...ok, ideas: [idea(44), idea(75, { private: true })] }), /public but inside/);
  // An idea on the wrong side, and one person helping with a public and a private idea.
  assert.throws(() => ideaNetwork({ ...ok, ideas: [idea(20), idea(20, { private: true })] }), /wrong side/);
  assert.throws(() => ideaNetwork({ ...ok, shared: [[0, 1, 0]] }), /public and a private/);
  // Malformed: no ideas, a shared helper without two ideas, fractional helpers, an inverted ring.
  assert.throws(() => ideaNetwork({ ideas: [], shared: [], region }), RangeError);
  assert.throws(() => ideaNetwork({ ...ok, shared: [[0, 0, 0]] }), RangeError);
  assert.throws(() => ideaNetwork({ ...ok, shared: [[0, 5, 0]] }), RangeError);
  assert.throws(() => ideaNetwork({ ...ok, ideas: [idea(20, { helpers: 1.5 })] }), RangeError);
  assert.throws(() => ideaNetwork({ ...ok, ideas: [idea(20, { ring: [10, 8] })] }), RangeError);
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
  for (const key of ['space', 'algorithms', 'avionics', 'guidance', 'simulation', 'cubesat', 'work', 'core'] as const) {
    assert.ok(JOURNEY_CHAPTERS.includes(key), key);
  }
  // The CubeSat comes right after the flight simulation.
  assert.equal(JOURNEY_CHAPTERS.indexOf('cubesat'), JOURNEY_CHAPTERS.indexOf('simulation') + 1);
});

test('figure captions and labels interpolate formatted values without case suffixes', () => {
  const { en, tr } = aboutMessages;
  assert.match(en.journey.chapters.space.caption('3.1', '5'), /Δv ≈ 3\.1 km\/s.*about 5 days/);
  assert.match(tr.journey.chapters.space.caption('3,1', '5'), /\(Δv ≈ 3,1 km\/s\).*yaklaşık 5 gün/);
  // The CubeSat caption: the example altitude, the mask and the computed pass, not to scale.
  assert.match(en.journey.chapters.cubesat.caption('6'), /example orbit 400 km up.*about 6 minutes.*10°.*Not to scale\.$/);
  assert.match(tr.journey.chapters.cubesat.caption('6'), /Örnek olarak 400 km.*yaklaşık 6 dakika.*10°.*Çizim ölçekli değildir\.$/);
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

test('the crowd.inc figure is a schematic picture, and the odd-number square states its sum', () => {
  const { en, tr } = aboutMessages;
  // The network is not crowd.inc's data: both captions say so first…
  assert.match(en.journey.chapters.work.caption, /^A schematic picture of crowd\.inc: /);
  assert.match(tr.journey.chapters.work.caption, /^Şematik bir çizim: crowd\.inc’te /);
  for (const locale of LOCALES) {
    const { caption, figureLabels } = aboutMessages[locale].journey.chapters.work;
    // …and give no counts that could be read as real figures.
    assert.doesNotMatch(caption, /\d|hundreds|yüzlerce/i, locale);
    // The two areas of the drawing are labelled, and nothing more.
    assert.deepEqual(Object.keys(figureLabels).sort(), ['private', 'public'], locale);
  }
  assert.deepEqual(tr.journey.chapters.work.figureLabels, { public: 'HERKESE AÇIK', private: 'ÖZEL' });
  // The sum is spelled out in both captions, held together by no-break spaces.
  for (const caption of [en.journey.chapters.community.caption, tr.journey.chapters.community.caption]) {
    assert.ok(caption.includes('1 + 3 + 5 + 7 + 9 = 5²'), caption);
  }
});
