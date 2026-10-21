import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BODY_KINDS,
  BODY_TYPES,
  DAY,
  EARTH_MASS,
  EARTH_MOON_DISTANCE,
  FIGURE_EIGHT_PERIOD,
  G,
  GEOSTATIONARY_RADIUS,
  MAX_BODIES,
  MOON_MASS,
  MOON_SPEED,
  PRESETS,
  PRESET_BODY_NAMES,
  PRESET_IDS,
  SOFTENING,
  TIME_SCALES,
  addBody,
  advance,
  bodyRadius,
  centerOfMass,
  circularOrbitState,
  circularSpeed,
  clearestAngle,
  computeAccelerations,
  createSimulation,
  gravitationalForce,
  loadPreset,
  momentum,
  nearestTimeScaleIndex,
  orbitAround,
  parseAmount,
  physicalRadius,
  predictPath,
  presetBodies,
  removeBody,
  step,
  strongestAttractor,
  totalEnergy,
  totalMass,
  type Body,
  type PresetBodyName,
  type Simulation,
} from '../src/lib/physics/gravity.ts';

const close = (actual: number, expected: number, tolerance: number, message = '') =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}${message ? ': ' : ''}${actual} is not within ${tolerance} of ${expected}`,
  );
const relClose = (actual: number, expected: number, relative: number, message = '') =>
  close(actual, expected, Math.abs(expected) * relative, message);

const NAMES = Object.fromEntries(PRESET_BODY_NAMES.map((name) => [name, name])) as Record<PresetBodyName, string>;

const byName = (sim: Simulation, name: string) => {
  const body = sim.bodies.find((candidate) => candidate.name === name);
  assert.ok(body, `no body named ${name}`);
  return body;
};

/** Angle of `body` around `primary`, radians. */
const angleAround = (body: Body, primary: Body) => Math.atan2(body.y - primary.y, body.x - primary.x);

// ---------------------------------------------------------------- force

test('Newton’s law: the Earth–Moon force at the mean distance', () => {
  // By hand: 6.6743e-11 × 5.972e24 × 7.342e22 / (3.844e8)² = 1.98049…e20 N.
  const expected = (6.6743e-11 * 5.972e24 * 7.342e22) / 3.844e8 ** 2;
  relClose(expected, 1.98049e20, 1e-5, 'hand value');
  const force = gravitationalForce(EARTH_MASS, 0, 0, MOON_MASS, EARTH_MOON_DISTANCE, 0);
  relClose(force.magnitude, expected, 1e-12);
  close(force.angle, 0, 0);
  relClose(force.fx, expected, 1e-12);
  close(force.fy, 0, 1e-6);
});

test('two 1 kg masses 1 m apart attract with G newtons', () => {
  relClose(gravitationalForce(1, 0, 0, 1, 1, 0).magnitude, G, 1e-15);
  // Inverse square: twice the distance, a quarter of the force.
  relClose(gravitationalForce(1, 0, 0, 1, 2, 0).magnitude, G / 4, 1e-15);
});

test('the atan2 decomposition points at the other body in all four quadrants', () => {
  // The other body at (±3, ±4) m, so r = 5, F = G·m₁m₂/25 and (cos θ, sin θ) = (±3/5, ±4/5).
  const m1 = 2e10;
  const m2 = 3e10;
  const F = (G * m1 * m2) / 25;
  const cases = [
    { dx: 3, dy: 4, quadrant: 'I', angle: Math.atan(4 / 3) },
    { dx: -3, dy: 4, quadrant: 'II', angle: Math.PI - Math.atan(4 / 3) },
    { dx: -3, dy: -4, quadrant: 'III', angle: -Math.PI + Math.atan(4 / 3) },
    { dx: 3, dy: -4, quadrant: 'IV', angle: -Math.atan(4 / 3) },
  ];
  for (const { dx, dy, quadrant, angle } of cases) {
    const force = gravitationalForce(m1, 10, 20, m2, 10 + dx, 20 + dy);
    relClose(force.magnitude, F, 1e-12, `quadrant ${quadrant} magnitude`);
    close(force.angle, angle, 1e-12, `quadrant ${quadrant} angle`);
    relClose(force.fx, (F * dx) / 5, 1e-12, `quadrant ${quadrant} Fx`);
    relClose(force.fy, (F * dy) / 5, 1e-12, `quadrant ${quadrant} Fy`);
    // Same as the vector form F · (Δx, Δy) / r.
    relClose(Math.hypot(force.fx, force.fy), F, 1e-12);
  }
});

test('atan2 handles the axes, where Δx or Δy is zero', () => {
  const left = gravitationalForce(1e12, 0, 0, 1e12, -7, 0);
  close(left.angle, Math.PI, 1e-15);
  assert.ok(left.fx < 0);
  close(left.fy, 0, Math.abs(left.fx) * 1e-15);
  const down = gravitationalForce(1e12, 0, 0, 1e12, 0, -7);
  close(down.angle, -Math.PI / 2, 1e-15);
  assert.ok(down.fy < 0);
});

test('softening only matters within a few ε', () => {
  const plain = gravitationalForce(EARTH_MASS, 0, 0, MOON_MASS, EARTH_MOON_DISTANCE, 0);
  const soft = gravitationalForce(EARTH_MASS, 0, 0, MOON_MASS, EARTH_MOON_DISTANCE, 0, SOFTENING);
  relClose(soft.magnitude, plain.magnitude, 2e-9);
  // Two bodies on top of each other feel no force instead of an infinite one.
  assert.equal(gravitationalForce(1, 0, 0, 1, 0, 0, SOFTENING).magnitude, 0);
  assert.equal(gravitationalForce(1, 0, 0, 1, 0, 0).magnitude, 0);
});

test('accelerations follow F = ma, equal and opposite forces', () => {
  const sim = createSimulation(0);
  addBody(sim, { name: 'a', kind: 'earth', mass: EARTH_MASS, x: 0, y: 0, vx: 0, vy: 0 });
  addBody(sim, { name: 'b', kind: 'moon', mass: MOON_MASS, x: 0, y: EARTH_MOON_DISTANCE, vx: 0, vy: 0 });
  computeAccelerations(sim);
  const [earth, moon] = sim.bodies as [Body, Body];
  relClose(earth.ay, (G * MOON_MASS) / EARTH_MOON_DISTANCE ** 2, 1e-12);
  relClose(moon.ay, (-G * EARTH_MASS) / EARTH_MOON_DISTANCE ** 2, 1e-12);
  relClose(earth.mass * earth.ay, -moon.mass * moon.ay, 1e-12);
});

// ---------------------------------------------------------------- orbits

test('the Moon in the Earth–Moon preset goes round in about 27.3 days', () => {
  const sim = loadPreset('earth-moon', NAMES);
  const earth = byName(sim, 'earth');
  const moon = byName(sim, 'moon');
  // Two-body estimate from the energy: 27.08 days (a mean speed and distance, not the real ellipse).
  close(orbitAround(moon, earth).period / DAY, 27.3, 0.5, 'vis-viva period');

  // Measured: run at the default time scale (2 days a second, 60 frames a second) until the
  // Moon has gone once round the Earth, interpolating the crossing of the +x axis.
  const frame = PRESETS['earth-moon'].timeScale / 60;
  let previous = angleAround(moon, earth);
  let crossing = 0;
  while (sim.time < 40 * DAY) {
    const before = sim.time;
    advance(sim, frame);
    const angle = angleAround(moon, earth);
    if (previous < 0 && angle >= 0) {
      crossing = before + (sim.time - before) * (-previous / (angle - previous));
      break;
    }
    previous = angle;
  }
  // It starts on the +x axis, so the first crossing from below is one full turn.
  close(crossing / DAY, 27.3, 0.5, 'simulated period');
});

test('energy drift stays small over many orbits (velocity Verlet is symplectic)', () => {
  for (const id of ['earth-moon', 'double-planet', 'figure-eight', 'geostationary'] as const) {
    const sim = loadPreset(id, NAMES);
    const e0 = totalEnergy(sim);
    const frame = PRESETS[id].timeScale / 60;
    const span = id === 'geostationary' ? 20 * DAY : 270 * DAY; // ~20 GEO orbits; ~10 lunar months
    let worst = 0;
    let worstFirstHalf = 0;
    while (sim.time < span) {
      advance(sim, frame);
      const drift = Math.abs((totalEnergy(sim) - e0) / e0);
      worst = Math.max(worst, drift);
      if (sim.time < span / 2) worstFirstHalf = worst;
    }
    assert.ok(worst < 1e-4, `${id}: relative energy drift ${worst}`);
    // Bounded, not growing: the second half is no worse than a few times the first.
    assert.ok(worst <= Math.max(worstFirstHalf * 4, 1e-9), `${id}: drift grows (${worstFirstHalf} → ${worst})`);
  }
});

test('the figure-eight comes back to its start after one period', () => {
  const sim = loadPreset('figure-eight', NAMES);
  const start = sim.bodies.map((body) => [body.x, body.y]);
  const frame = PRESETS['figure-eight'].timeScale / 60;
  while (sim.time + frame < FIGURE_EIGHT_PERIOD) advance(sim, frame);
  advance(sim, FIGURE_EIGHT_PERIOD - sim.time);
  sim.bodies.forEach((body, i) => {
    const [x, y] = start[i]!;
    // Within 1% of the 150,000 km length unit.
    assert.ok(Math.hypot(body.x - x!, body.y - y!) < 1.5e6, `${body.name} is ${Math.hypot(body.x - x!, body.y - y!)} m off`);
  });
});

test('momentum is conserved', () => {
  const sim = createSimulation();
  addBody(sim, { name: 'a', kind: 'earth', mass: EARTH_MASS, x: 0, y: 0, vx: 10, vy: -5 });
  addBody(sim, { name: 'b', kind: 'mars', mass: BODY_TYPES.mars.mass, x: 1e8, y: 3e7, vx: -300, vy: 1500 });
  addBody(sim, { name: 'c', kind: 'moon', mass: MOON_MASS, x: -2e8, y: -1e8, vx: 800, vy: 200 });
  const p0 = momentum(sim);
  const scale = Math.hypot(p0.px, p0.py);
  for (let i = 0; i < 2000; i++) step(sim, 600);
  const p1 = momentum(sim);
  close(p1.px, p0.px, scale * 1e-10);
  close(p1.py, p0.py, scale * 1e-10);
});

test('presets start in the centre-of-mass frame', () => {
  for (const id of PRESET_IDS) {
    const sim = loadPreset(id, NAMES);
    const com = centerOfMass(sim);
    const size = Math.max(...sim.bodies.map((body) => Math.hypot(body.x, body.y)));
    const speed = Math.max(...sim.bodies.map((body) => Math.hypot(body.vx, body.vy)));
    close(com.x, 0, size * 1e-12, `${id} x`);
    close(com.y, 0, size * 1e-12, `${id} y`);
    close(com.vx, 0, speed * 1e-12, `${id} vx`);
    close(com.vy, 0, speed * 1e-12, `${id} vy`);
  }
});

// ---------------------------------------------------------------- collisions

test('a collision merges the bodies, conserving mass and momentum', () => {
  const sim = createSimulation();
  addBody(sim, { name: 'earth', kind: 'earth', mass: EARTH_MASS, x: 0, y: 0, vx: 0, vy: 0 });
  // A Moon falling straight in from 20,000 km at 3 km/s.
  addBody(sim, { name: 'moon', kind: 'moon', mass: MOON_MASS, x: 2e7, y: 0, vx: -3000, vy: 500 });
  const mass0 = totalMass(sim);
  const p0 = momentum(sim);
  const merges = [];
  for (let i = 0; i < 1000 && sim.bodies.length > 1; i++) merges.push(...step(sim, 10));
  assert.equal(sim.bodies.length, 1);
  assert.deepEqual(merges, [{ survivor: 1, absorbed: 2 }]);
  const [merged] = sim.bodies as [Body];
  assert.equal(merged.name, 'earth');
  relClose(merged.mass, mass0, 1e-15);
  const p1 = momentum(sim);
  close(p1.px, p0.px, Math.abs(p0.px) * 1e-9);
  close(p1.py, p0.py, Math.abs(p0.py) * 1e-9);
  // Volumes add: the merged body is bigger than the Earth.
  const volume = EARTH_MASS / BODY_TYPES.earth.density + MOON_MASS / BODY_TYPES.moon.density;
  relClose(bodyRadius(merged), Math.cbrt((3 * volume) / (4 * Math.PI)), 1e-12);
});

test('a fast body cannot skip through another between two sub-steps', () => {
  const sim = createSimulation();
  addBody(sim, { name: 'earth', kind: 'earth', mass: EARTH_MASS, x: 0, y: 0, vx: 0, vy: 0 });
  // 100 km/s, and one 1,000 s step carries it 100,000 km: from one side of the Earth to the other.
  addBody(sim, { name: 'rock', kind: 'asteroid', mass: 1e16, x: -5e7, y: 1e6, vx: 1e5, vy: 0 });
  const merges = step(sim, 1000);
  assert.equal(merges.length, 1);
  assert.equal(sim.bodies.length, 1);
});

test('bodies that pass each other at a distance do not merge', () => {
  const sim = createSimulation();
  addBody(sim, { name: 'earth', kind: 'earth', mass: EARTH_MASS, x: 0, y: 0, vx: 0, vy: 0 });
  addBody(sim, { name: 'rock', kind: 'asteroid', mass: 1e16, x: -5e7, y: 2e7, vx: 1e5, vy: 0 });
  assert.equal(step(sim, 1000).length, 0);
  assert.equal(sim.bodies.length, 2);
});

test('physical radii come out right for the Earth and the Moon', () => {
  close(physicalRadius(EARTH_MASS, BODY_TYPES.earth.density) / 1e3, 6371, 5);
  close(physicalRadius(MOON_MASS, BODY_TYPES.moon.density) / 1e3, 1737, 5);
  close(physicalRadius(BODY_TYPES.jupiter.mass, BODY_TYPES.jupiter.density) / 1e3, 69_911, 300);
});

// ---------------------------------------------------------------- orbit classification

test('bound or escaping: the escape speed is √2 times the circular speed', () => {
  const earth: Body = { id: 1, name: 'e', kind: 'earth', mass: EARTH_MASS, density: 5514, x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0 };
  const r = EARTH_MOON_DISTANCE;
  const circular = circularSpeed(EARTH_MASS, MOON_MASS, r);
  const at = (speed: number): Body => ({ ...earth, id: 2, kind: 'moon', mass: MOON_MASS, x: r, vy: speed });

  const round = orbitAround(at(circular), earth);
  assert.ok(round.bound);
  close(round.eccentricity, 0, 1e-9);
  relClose(round.semiMajorAxis, r, 1e-9);
  relClose(round.period, 2 * Math.PI * Math.sqrt(r ** 3 / (G * (EARTH_MASS + MOON_MASS))), 1e-9);
  relClose(round.escapeSpeed, circular * Math.SQRT2, 1e-12);

  const slow = orbitAround(at(600), earth);
  assert.ok(slow.bound);
  assert.ok(slow.eccentricity > 0.6 && slow.eccentricity < 0.7, `e = ${slow.eccentricity}`);
  assert.ok(slow.period < round.period);

  assert.ok(orbitAround(at(circular * Math.SQRT2 * 0.999), earth).bound);
  const fast = orbitAround(at(circular * Math.SQRT2 * 1.001), earth);
  assert.equal(fast.bound, false);
  assert.equal(fast.period, Infinity);
  assert.ok(fast.eccentricity > 1);
});

test('the three-speeds preset: one ellipse, one circle, one escape', () => {
  const sim = loadPreset('three-speeds', NAMES);
  const earth = byName(sim, 'earth');
  const slow = orbitAround(byName(sim, 'slow'), earth);
  const circular = orbitAround(byName(sim, 'circular'), earth);
  const fast = orbitAround(byName(sim, 'fast'), earth);
  assert.ok(slow.bound && slow.eccentricity > 0.5);
  assert.ok(circular.bound && circular.eccentricity < 0.01);
  assert.equal(fast.bound, false);
});

test('a circular orbit around a moving body is circular relative to it', () => {
  const sim = loadPreset('earth-moon', NAMES);
  const moon = byName(sim, 'moon');
  const state = circularOrbitState(moon, 1000, 20_000e3, 1);
  const body = addBody(sim, { name: 'probe', kind: 'satellite', mass: 1000, ...state })!;
  const orbit = orbitAround(body, moon);
  close(orbit.eccentricity, 0, 1e-6);
  relClose(orbit.distance, 20_000e3, 1e-12);
  assert.equal(strongestAttractor(sim, body), moon);
});

test('the geostationary satellite goes round once a sidereal day', () => {
  const sim = loadPreset('geostationary', NAMES);
  const orbit = orbitAround(byName(sim, 'satellite'), byName(sim, 'earth'));
  close(orbit.period / 3600, 23.934, 0.01);
  relClose(orbit.distance, GEOSTATIONARY_RADIUS, 1e-3);
});

test('strongest attractor: the Earth for the Moon, the Moon for the Earth', () => {
  const sim = loadPreset('earth-moon', NAMES);
  assert.equal(strongestAttractor(sim, byName(sim, 'moon'))?.name, 'earth');
  assert.equal(strongestAttractor(sim, byName(sim, 'earth'))?.name, 'moon');
  removeBody(sim, byName(sim, 'moon').id);
  assert.equal(strongestAttractor(sim, byName(sim, 'earth')), null);
});

test('clearestAngle points away from the other bodies', () => {
  const sim = loadPreset('earth-moon', NAMES);
  const earth = byName(sim, 'earth');
  const moon = byName(sim, 'moon');
  const angle = clearestAngle(sim, earth, 100_000e3);
  const moonAngle = angleAround(moon, earth);
  const gap = Math.abs(Math.atan2(Math.sin(angle - moonAngle), Math.cos(angle - moonAngle)));
  close(gap, Math.PI, 0.3);
});

// ---------------------------------------------------------------- prediction

test('the predicted path of a body in a circular orbit is that circle, one turn long', () => {
  const sim = createSimulation();
  const earth = addBody(sim, { name: 'earth', kind: 'earth', mass: EARTH_MASS, x: 0, y: 0, vx: 0, vy: 0 })!;
  // A satellite at the Moon's distance around the Earth alone: T = 2π √(r³/GM) ≈ 27.45 days.
  const prediction = predictPath(sim, {
    name: 'ghost',
    kind: 'satellite',
    mass: 1000,
    ...circularOrbitState(earth, 1000, EARTH_MOON_DISTANCE, Math.PI),
  });
  assert.equal(prediction.merged, false);
  // One turn and 2% more, so the dashed line closes on itself.
  close(prediction.duration / DAY, 27.45 * 1.02, 0.05);
  for (let i = 0; i < prediction.points.length; i += 2) {
    const r = Math.hypot(prediction.points[i]! - earth.x, prediction.points[i + 1]! - earth.y);
    relClose(r, EARTH_MOON_DISTANCE, 1e-3, `point ${i / 2}`);
  }
  // The live simulation is untouched.
  assert.equal(sim.bodies.length, 1);
  assert.equal(sim.time, 0);
});

test('a prediction ends where the body hits another', () => {
  const sim = loadPreset('earth-moon', NAMES);
  const prediction = predictPath(sim, { name: 'rock', kind: 'asteroid', mass: 1e16, x: 0, y: 1e8, vx: 0, vy: -100 });
  assert.equal(prediction.merged, true);
  const last = prediction.points.length - 2;
  // The last point is the Earth's centre (it absorbed the rock).
  assert.ok(Math.hypot(prediction.points[last]!, prediction.points[last + 1]!) < 1e7);
});

// ---------------------------------------------------------------- presets and inputs

test('presets are valid', () => {
  assert.ok(PRESET_IDS.length >= 4 && PRESET_IDS.length <= 6);
  for (const id of PRESET_IDS) {
    const bodies = presetBodies(id);
    assert.ok(bodies.length >= 2 && bodies.length <= MAX_BODIES, id);
    assert.ok(TIME_SCALES.includes(PRESETS[id].timeScale as (typeof TIME_SCALES)[number]), `${id}: time scale is a slider stop`);
    for (const body of bodies) {
      assert.ok(PRESET_BODY_NAMES.includes(body.name), `${id}: ${body.name}`);
      for (const value of [body.mass, body.x, body.y, body.vx, body.vy]) assert.ok(Number.isFinite(value), id);
      assert.ok(body.mass > 0);
    }
    // No two bodies overlap at the start, and none sits closer than five radii to another.
    const sim = loadPreset(id, NAMES);
    for (let i = 0; i < sim.bodies.length; i++) {
      for (let j = i + 1; j < sim.bodies.length; j++) {
        const a = sim.bodies[i]!;
        const b = sim.bodies[j]!;
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 5 * (bodyRadius(a) + bodyRadius(b)), `${id}: ${a.name}–${b.name}`);
      }
    }
    // Nothing collides in the first ten simulated days.
    const count = sim.bodies.length;
    while (sim.time < 10 * DAY) advance(sim, PRESETS[id].timeScale / 60);
    assert.equal(sim.bodies.length, count, `${id}: a collision in the first ten days`);
  }
});

test('the Earth–Moon preset uses the real values', () => {
  const sim = loadPreset('earth-moon', NAMES);
  const earth = byName(sim, 'earth');
  const moon = byName(sim, 'moon');
  assert.equal(earth.mass, 5.972e24);
  assert.equal(moon.mass, 7.342e22);
  relClose(Math.hypot(moon.x - earth.x, moon.y - earth.y), 384_400e3, 1e-12);
  relClose(Math.hypot(moon.vx - earth.vx, moon.vy - earth.vy), MOON_SPEED, 1e-12);
});

test('no more than MAX_BODIES bodies', () => {
  const sim = createSimulation();
  for (let i = 0; i < MAX_BODIES; i++) {
    assert.ok(addBody(sim, { name: `b${i}`, kind: 'asteroid', mass: 1e16, x: i * 1e8, y: 0, vx: 0, vy: 0 }));
  }
  assert.equal(addBody(sim, { name: 'one too many', kind: 'asteroid', mass: 1e16, x: -1e8, y: 0, vx: 0, vy: 0 }), null);
});

test('body types have their real masses', () => {
  assert.deepEqual([...BODY_KINDS], ['moon', 'mars', 'earth', 'jupiter', 'asteroid', 'satellite']);
  assert.equal(BODY_TYPES.earth.mass, EARTH_MASS);
  assert.equal(BODY_TYPES.moon.mass, MOON_MASS);
  relClose(BODY_TYPES.jupiter.mass / EARTH_MASS, 317.8, 0.001);
  relClose(BODY_TYPES.mars.mass / EARTH_MASS, 0.107, 0.01);
});

test('time scales run from a minute to ten days a second, in order', () => {
  assert.equal(TIME_SCALES[0], 60);
  assert.equal(TIME_SCALES.at(-1), 10 * DAY);
  for (let i = 1; i < TIME_SCALES.length; i++) assert.ok(TIME_SCALES[i]! > TIME_SCALES[i - 1]!);
  assert.equal(TIME_SCALES[nearestTimeScaleIndex(2 * DAY)], 2 * DAY);
  assert.equal(TIME_SCALES[nearestTimeScaleIndex(1e9)], 10 * DAY);
  assert.equal(TIME_SCALES[nearestTimeScaleIndex(1)], 60);
});

test('parseAmount reads numbers as people type them', () => {
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('  '), null);
  assert.equal(parseAmount('7.342e22'), 7.342e22);
  assert.equal(parseAmount('7,342e22'), 7.342e22);
  assert.equal(parseAmount('7.342 × 10^22'), 7.342e22);
  assert.equal(parseAmount('7,342×10²²'), 7.342e22);
  assert.equal(parseAmount('1e-3'), 0.001);
  assert.equal(parseAmount('2 × 10⁻³'), 0.002);
  assert.equal(parseAmount('−384400'), -384400);
  assert.equal(parseAmount('0,5'), 0.5);
  assert.equal(parseAmount('.5'), 0.5);
  assert.ok(Number.isNaN(parseAmount('abc')));
  assert.ok(Number.isNaN(parseAmount('1.2.3')));
  assert.ok(Number.isNaN(parseAmount('5 kg')));
});
