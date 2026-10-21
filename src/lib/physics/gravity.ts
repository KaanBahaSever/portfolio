/**
 * Newtonian gravity for a handful of bodies moving in one plane (the ecliptic of the
 * simulator). Pure module (no DOM, no three.js), shared by the browser controller and the tests.
 * SI units throughout: metres, kilograms, seconds.
 *
 * The model, in the order the page explains it:
 * - Every pair of bodies attracts with Newton's law of universal gravitation, F = G m₁ m₂ / r².
 *   The direction is the angle θ = atan2(Δy, Δx) from one body to the other, and the force is
 *   split into Fx = F cos θ and Fy = F sin θ (gravitationalForce). That is exactly the same as
 *   multiplying F by the unit vector (Δx/r, Δy/r); atan2 is kept because it is how the first
 *   canvas version of this simulator did it, and the page shows it that way.
 * - F = m a gives each body its acceleration; the forces of a pair are equal and opposite.
 * - Positions and velocities advance with velocity Verlet in its kick–drift–kick form (the
 *   leapfrog): half a kick, a full drift, new accelerations, another half kick. It is symplectic,
 *   so the energy error stays bounded and orbits neither spiral in nor out over many turns.
 * - The step is a small fraction (STEP_FRACTION) of the shortest dynamical time of any pair,
 *   √(r³ / G(m₁ + m₂)), which is 1/(2π) of a circular orbit's period at that distance. A frame
 *   of simulated time is cut into equal sub-steps no longer than that.
 * - Softening: the distance in the force law is √(r² + ε²) (Plummer softening, ε = SOFTENING =
 *   10 km). It only matters within a few ε, which real bodies never reach because they merge
 *   first; it keeps a near-miss of two tiny bodies from producing an enormous kick. At the
 *   Moon's distance it changes the force by about one part in a billion.
 * - Collisions use each body's real radius, from its mass and density: when two bodies touch,
 *   they merge into one, keeping the total mass and momentum (a perfectly inelastic collision;
 *   the lost kinetic energy would go into heat). The volumes add, so the density of the merged
 *   body is the total mass over the total volume. Touching is tested along the straight path
 *   of each sub-step, so a fast body cannot skip through another between two sub-steps.
 *
 * Everything moves in the x–y plane; the browser draws it in 3D at z = 0.
 */

/** Newtonian constant of gravitation (CODATA 2018), m³ kg⁻¹ s⁻². */
export const G = 6.6743e-11;
export const EARTH_MASS = 5.972e24;
export const MOON_MASS = 7.342e22;
/** Mean Earth–Moon distance (semi-major axis of the Moon's orbit, rounded), m. */
export const EARTH_MOON_DISTANCE = 384_400e3;
/** Mean orbital speed of the Moon, m/s. */
export const MOON_SPEED = 1022;
/** Radius of the geostationary orbit, measured from the Earth's centre, m. */
export const GEOSTATIONARY_RADIUS = 42_164e3;

export const MINUTE = 60;
export const HOUR = 3600;
export const DAY = 86_400;

/** Plummer softening length ε, m (see the module comment). */
export const SOFTENING = 10e3;
/** Sub-step as a fraction of the shortest dynamical time √(r³ / G(m₁ + m₂)). */
export const STEP_FRACTION = 0.02;
/** At most this many pair evaluations per call to advance(), so a frame stays short. */
export const PAIR_STEP_BUDGET = 250_000;
/** Never more than this many sub-steps per call to advance(), however few the bodies. */
export const MAX_SUBSTEPS = 4000;
export const MAX_BODIES = 24;

/** Lightest and heaviest body the form accepts, kg (a small satellite to ten Jupiters). */
export const MIN_MASS = 1;
export const MAX_MASS = 2e28;

export const BODY_KINDS = ['moon', 'mars', 'earth', 'jupiter', 'asteroid', 'satellite'] as const;
export type BodyKind = (typeof BODY_KINDS)[number] | 'custom';

export interface BodyType {
  /** kg */
  mass: number;
  /** kg/m³ */
  density: number;
}

/** The bodies the visitor can add by name: real masses and mean densities. */
export const BODY_TYPES: Readonly<Record<(typeof BODY_KINDS)[number], BodyType>> = {
  moon: { mass: MOON_MASS, density: 3344 },
  mars: { mass: 6.417e23, density: 3933 },
  earth: { mass: EARTH_MASS, density: 5514 },
  jupiter: { mass: 1.898e27, density: 1326 },
  /** A rocky asteroid about 20 km across. */
  asteroid: { mass: 1e16, density: 2500 },
  /** A one-tonne satellite; its "density" makes it about 2.5 m across. */
  satellite: { mass: 1000, density: 120 },
};

/** Density of a body of custom mass: between a rocky moon and a rocky planet. */
export const CUSTOM_DENSITY = 4000;

export function isBodyKind(value: string): value is (typeof BODY_KINDS)[number] {
  return (BODY_KINDS as readonly string[]).includes(value);
}

export interface Body {
  id: number;
  name: string;
  kind: BodyKind;
  /** kg */
  mass: number;
  /** kg/m³; with the mass it gives the real radius used for collisions. */
  density: number;
  /** Position, m. */
  x: number;
  y: number;
  /** Velocity, m/s. */
  vx: number;
  vy: number;
  /** Acceleration from the last force evaluation, m/s². */
  ax: number;
  ay: number;
}

export interface Simulation {
  bodies: Body[];
  /** Simulated time since the start, s. */
  time: number;
  softening: number;
  nextId: number;
  /** False when bodies changed since the accelerations were last computed. */
  ready: boolean;
}

export interface BodyInit {
  name: string;
  kind: BodyKind;
  mass: number;
  density?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function createSimulation(softening = SOFTENING): Simulation {
  return { bodies: [], time: 0, softening, nextId: 1, ready: false };
}

/** Adds a body and returns it, or null when the simulation is full. */
export function addBody(sim: Simulation, init: BodyInit): Body | null {
  if (sim.bodies.length >= MAX_BODIES) return null;
  const density = init.density ?? (init.kind === 'custom' ? CUSTOM_DENSITY : BODY_TYPES[init.kind].density);
  const body: Body = { ...init, density, id: sim.nextId++, ax: 0, ay: 0 };
  sim.bodies.push(body);
  sim.ready = false;
  return body;
}

export function removeBody(sim: Simulation, id: number): boolean {
  const index = sim.bodies.findIndex((body) => body.id === id);
  if (index < 0) return false;
  sim.bodies.splice(index, 1);
  sim.ready = false;
  return true;
}

/** Call after changing a mass, a position or a velocity from outside. */
export function invalidate(sim: Simulation): void {
  sim.ready = false;
}

export function cloneSimulation(sim: Simulation): Simulation {
  return { ...sim, bodies: sim.bodies.map((body) => ({ ...body })) };
}

/** Radius of a sphere of this mass and density, m. */
export function physicalRadius(mass: number, density: number): number {
  return Math.cbrt((3 * mass) / (4 * Math.PI * density));
}

export const bodyRadius = (body: Pick<Body, 'mass' | 'density'>) => physicalRadius(body.mass, body.density);

// ---------------------------------------------------------------- forces

export interface Force {
  /** |F|, N. */
  magnitude: number;
  /** Direction of the force, θ = atan2(Δy, Δx), radians in (−π, π]. */
  angle: number;
  fx: number;
  fy: number;
}

/**
 * The force on body 1 (mass m1 at x1, y1) from body 2: Newton's law of universal gravitation,
 * F = G m₁ m₂ / r², pointing from body 1 toward body 2.
 *
 * θ = atan2(Δy, Δx) gives the direction in all four quadrants (plain atan(Δy/Δx) would lose
 * the sign of Δx), and Fx = F cos θ, Fy = F sin θ split the force into components. Since
 * cos θ = Δx/r and sin θ = Δy/r, this equals F (Δx, Δy) / r, the usual vector form.
 *
 * With softening ε the distance becomes √(r² + ε²) and the magnitude G m₁ m₂ r / (r² + ε²)^(3/2),
 * which is Newton's law again when ε = 0.
 */
export function gravitationalForce(
  m1: number,
  x1: number,
  y1: number,
  m2: number,
  x2: number,
  y2: number,
  softening = 0,
): Force {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const r2 = dx * dx + dy * dy;
  const soft2 = r2 + softening * softening;
  if (soft2 === 0) return { magnitude: 0, angle: 0, fx: 0, fy: 0 };
  const magnitude = (G * m1 * m2 * Math.sqrt(r2)) / (soft2 * Math.sqrt(soft2));
  const angle = Math.atan2(dy, dx);
  return { magnitude, angle, fx: magnitude * Math.cos(angle), fy: magnitude * Math.sin(angle) };
}

/** Sets every body's acceleration from the pairwise forces (O(n²); a = F / m). */
export function computeAccelerations(sim: Simulation): void {
  const bodies = sim.bodies;
  for (const body of bodies) {
    body.ax = 0;
    body.ay = 0;
  }
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i]!;
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j]!;
      const { fx, fy } = gravitationalForce(a.mass, a.x, a.y, b.mass, b.x, b.y, sim.softening);
      // Newton's third law: b feels the same force, the other way.
      a.ax += fx / a.mass;
      a.ay += fy / a.mass;
      b.ax -= fx / b.mass;
      b.ay -= fy / b.mass;
    }
  }
  sim.ready = true;
}

// ---------------------------------------------------------------- integration

export interface Merge {
  /** The body that remains (the heavier one; it keeps its id, name and kind). */
  survivor: number;
  /** The body that was absorbed and no longer exists. */
  absorbed: number;
}

/**
 * Merges two bodies into the first, conserving mass and momentum; the volumes add. Returns the
 * survivor's previous position too, mass-weighted like the new one.
 */
function mergeInto(a: Body, b: Body): void {
  const mass = a.mass + b.mass;
  const volume = a.mass / a.density + b.mass / b.density;
  a.x = (a.mass * a.x + b.mass * b.x) / mass;
  a.y = (a.mass * a.y + b.mass * b.y) / mass;
  a.vx = (a.mass * a.vx + b.mass * b.vx) / mass;
  a.vy = (a.mass * a.vy + b.mass * b.vy) / mass;
  a.mass = mass;
  a.density = mass / volume;
}

/**
 * Merges every pair that touched during the last drift. `previous` holds the positions before
 * the drift (x, y per body, in order); the closest approach is taken along the straight line
 * between the two relative positions.
 */
function collide(sim: Simulation, previous: Float64Array): Merge[] {
  const merges: Merge[] = [];
  let found = true;
  while (found) {
    found = false;
    const bodies = sim.bodies;
    outer: for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i]!;
        const b = bodies[j]!;
        const reach = bodyRadius(a) + bodyRadius(b);
        const px = previous[2 * j]! - previous[2 * i]!;
        const py = previous[2 * j + 1]! - previous[2 * i + 1]!;
        const qx = b.x - a.x;
        const qy = b.y - a.y;
        const dx = qx - px;
        const dy = qy - py;
        const length2 = dx * dx + dy * dy;
        const t = length2 > 0 ? Math.min(1, Math.max(0, -(px * dx + py * dy) / length2)) : 1;
        const cx = px + t * dx;
        const cy = py + t * dy;
        if (cx * cx + cy * cy >= reach * reach) continue;

        const [keep, gone, keepIndex, goneIndex] = a.mass >= b.mass ? [a, b, i, j] : [b, a, j, i];
        const ka = keep.mass;
        const ga = gone.mass;
        mergeInto(keep, gone);
        previous[2 * keepIndex] = (ka * previous[2 * keepIndex]! + ga * previous[2 * goneIndex]!) / (ka + ga);
        previous[2 * keepIndex + 1] = (ka * previous[2 * keepIndex + 1]! + ga * previous[2 * goneIndex + 1]!) / (ka + ga);
        // Keep `previous` aligned with the bodies.
        const rest = new Float64Array(previous.length - 2);
        rest.set(previous.subarray(0, 2 * goneIndex));
        rest.set(previous.subarray(2 * goneIndex + 2), 2 * goneIndex);
        previous = rest;
        bodies.splice(goneIndex, 1);
        merges.push({ survivor: keep.id, absorbed: gone.id });
        found = true;
        break outer;
      }
    }
  }
  return merges;
}

/**
 * One velocity Verlet step of length dt (kick–drift–kick):
 *   v ← v + a dt/2,  x ← x + v dt,  a ← a(x),  v ← v + a dt/2.
 * Bodies that touched during the drift merge before the new accelerations are computed.
 */
export function step(sim: Simulation, dt: number): Merge[] {
  if (!sim.ready) computeAccelerations(sim);
  const bodies = sim.bodies;
  const half = dt / 2;
  const previous = new Float64Array(bodies.length * 2);
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i]!;
    body.vx += body.ax * half;
    body.vy += body.ay * half;
    previous[2 * i] = body.x;
    previous[2 * i + 1] = body.y;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
  }
  const merges = bodies.length > 1 ? collide(sim, previous) : [];
  computeAccelerations(sim);
  for (const body of bodies) {
    body.vx += body.ax * half;
    body.vy += body.ay * half;
  }
  sim.time += dt;
  return merges;
}

/**
 * The shortest dynamical time √(d³ / G(m₁ + m₂)) over all pairs, with d = √(r² + ε²), s. For a
 * circular orbit it is the period divided by 2π. Infinity with fewer than two bodies.
 */
export function shortestDynamicalTime(sim: Simulation): number {
  const bodies = sim.bodies;
  const soft2 = sim.softening * sim.softening;
  let shortest = Infinity;
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i]!;
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy + soft2;
      const t = Math.sqrt((d2 * Math.sqrt(d2)) / (G * (a.mass + b.mass)));
      if (t < shortest) shortest = t;
    }
  }
  return shortest;
}

/** Longest sub-step for the current state, s. */
export function stepLimit(sim: Simulation): number {
  return STEP_FRACTION * shortestDynamicalTime(sim);
}

/** How many sub-steps one call to advance() may take with n bodies. */
export function substepBudget(bodyCount: number): number {
  const pairs = Math.max(1, (bodyCount * (bodyCount - 1)) / 2);
  return Math.max(1, Math.min(MAX_SUBSTEPS, Math.floor(PAIR_STEP_BUDGET / pairs)));
}

export interface Advance {
  merges: Merge[];
  /** Simulated time actually covered, s. */
  advanced: number;
  /** True when the sub-step budget ran out before `duration` (the simulation fell behind). */
  limited: boolean;
  substeps: number;
}

/**
 * Advances the simulation by `duration` seconds in equal sub-steps no longer than stepLimit().
 * When that would take more than the budget, it covers only budget × stepLimit() and says so.
 */
export function advance(sim: Simulation, duration: number, budget = substepBudget(sim.bodies.length)): Advance {
  if (!(duration > 0)) return { merges: [], advanced: 0, limited: false, substeps: 0 };
  const limit = stepLimit(sim);
  let substeps = Number.isFinite(limit) ? Math.ceil(duration / limit) : 1;
  let dt = duration / substeps;
  let limited = false;
  if (substeps > budget) {
    substeps = budget;
    dt = limit;
    limited = true;
  }
  const merges: Merge[] = [];
  for (let i = 0; i < substeps; i++) merges.push(...step(sim, dt));
  return { merges, advanced: substeps * dt, limited, substeps };
}

// ---------------------------------------------------------------- diagnostics

export function kineticEnergy(sim: Simulation): number {
  let total = 0;
  for (const body of sim.bodies) total += 0.5 * body.mass * (body.vx * body.vx + body.vy * body.vy);
  return total;
}

/** Σ −G mᵢ mⱼ / √(r² + ε²), the potential that matches the softened force. */
export function potentialEnergy(sim: Simulation): number {
  const bodies = sim.bodies;
  const soft2 = sim.softening * sim.softening;
  let total = 0;
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i]!;
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      total -= (G * a.mass * b.mass) / Math.sqrt(dx * dx + dy * dy + soft2);
    }
  }
  return total;
}

/** Kinetic plus potential energy, J. Conserved by the physics; the integrator keeps it close. */
export function totalEnergy(sim: Simulation): number {
  return kineticEnergy(sim) + potentialEnergy(sim);
}

export function momentum(sim: Simulation): { px: number; py: number } {
  let px = 0;
  let py = 0;
  for (const body of sim.bodies) {
    px += body.mass * body.vx;
    py += body.mass * body.vy;
  }
  return { px, py };
}

export function totalMass(sim: Simulation): number {
  return sim.bodies.reduce((sum, body) => sum + body.mass, 0);
}

export function centerOfMass(sim: Simulation): { x: number; y: number; vx: number; vy: number } {
  const mass = totalMass(sim);
  if (mass === 0) return { x: 0, y: 0, vx: 0, vy: 0 };
  let x = 0;
  let y = 0;
  let vx = 0;
  let vy = 0;
  for (const body of sim.bodies) {
    x += body.mass * body.x;
    y += body.mass * body.y;
    vx += body.mass * body.vx;
    vy += body.mass * body.vy;
  }
  return { x: x / mass, y: y / mass, vx: vx / mass, vy: vy / mass };
}

/** Moves to the frame where the centre of mass sits at the origin and stays there. */
export function toCenterOfMassFrame(sim: Simulation): void {
  const com = centerOfMass(sim);
  for (const body of sim.bodies) {
    body.x -= com.x;
    body.y -= com.y;
    body.vx -= com.vx;
    body.vy -= com.vy;
  }
  sim.ready = false;
}

/**
 * The body that pulls hardest on `body` (largest G m / r²), or null when it is alone. This is
 * what the page measures distance, relative speed and the orbit against.
 */
export function strongestAttractor(sim: Simulation, body: Body): Body | null {
  return strongestAttractorAt(sim, body.x, body.y, body);
}

/** The body that pulls hardest at a point of the plane (leaving out `except`), or null. */
export function strongestAttractorAt(sim: Simulation, x: number, y: number, except?: Body): Body | null {
  let best: Body | null = null;
  let bestPull = -1;
  for (const other of sim.bodies) {
    if (other === except) continue;
    const dx = other.x - x;
    const dy = other.y - y;
    const pull = other.mass / (dx * dx + dy * dy + sim.softening * sim.softening);
    if (pull > bestPull) {
      bestPull = pull;
      best = other;
    }
  }
  return best;
}

export interface Orbit {
  /** Distance between the centres, m. */
  distance: number;
  /** Speed relative to the primary, m/s. */
  speed: number;
  /** Specific orbital energy v²/2 − μ/r, J/kg; negative when bound. */
  energy: number;
  bound: boolean;
  /** Semi-major axis, m (Infinity when not bound). */
  semiMajorAxis: number;
  /** Period of the two-body orbit, s (Infinity when not bound). */
  period: number;
  eccentricity: number;
  /** Escape speed at this distance, √(2μ/r), m/s. */
  escapeSpeed: number;
}

/**
 * The two-body orbit of `body` around `primary`, as if no other body existed: μ = G(m₁ + m₂),
 * the vis-viva energy ε = v²/2 − μ/r, a = −μ / 2ε and T = 2π √(a³/μ) when ε < 0.
 */
export function orbitAround(body: Body, primary: Body): Orbit {
  const rx = body.x - primary.x;
  const ry = body.y - primary.y;
  const vx = body.vx - primary.vx;
  const vy = body.vy - primary.vy;
  const distance = Math.hypot(rx, ry);
  const speed = Math.hypot(vx, vy);
  const mu = G * (body.mass + primary.mass);
  const energy = (speed * speed) / 2 - mu / distance;
  const bound = energy < 0;
  const semiMajorAxis = bound ? -mu / (2 * energy) : Infinity;
  const period = bound ? 2 * Math.PI * Math.sqrt(semiMajorAxis ** 3 / mu) : Infinity;
  const h = rx * vy - ry * vx;
  const eccentricity = Math.sqrt(Math.max(0, 1 + (2 * energy * h * h) / (mu * mu)));
  return { distance, speed, energy, bound, semiMajorAxis, period, eccentricity, escapeSpeed: Math.sqrt((2 * mu) / distance) };
}

/** Speed of a circular orbit at distance r around mass M (with the orbiting mass m): √(G(M + m)/r). */
export function circularSpeed(primaryMass: number, mass: number, distance: number): number {
  return Math.sqrt((G * (primaryMass + mass)) / distance);
}

/**
 * Position and velocity for a circular orbit of a body of `mass` around `primary` at `distance`,
 * at `angle` (radians from the +x axis), moving counterclockwise like the Moon. The velocity is
 * perpendicular to the radius and relative to the primary's own motion.
 */
export function circularOrbitState(
  primary: Pick<Body, 'mass' | 'x' | 'y' | 'vx' | 'vy'>,
  mass: number,
  distance: number,
  angle: number,
): { x: number; y: number; vx: number; vy: number } {
  const v = circularSpeed(primary.mass, mass, distance);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: primary.x + distance * cos,
    y: primary.y + distance * sin,
    vx: primary.vx - v * sin,
    vy: primary.vy + v * cos,
  };
}

/**
 * Of `count` evenly spaced angles around `primary`, the one whose point at `distance` is
 * farthest from every other body, so a new orbit starts clear of them.
 */
export function clearestAngle(sim: Simulation, primary: Body, distance: number, count = 24): number {
  let best = 0;
  let bestGap = -1;
  for (let k = 0; k < count; k++) {
    const angle = (2 * Math.PI * k) / count;
    const x = primary.x + distance * Math.cos(angle);
    const y = primary.y + distance * Math.sin(angle);
    let gap = Infinity;
    for (const body of sim.bodies) {
      if (body === primary) continue;
      gap = Math.min(gap, Math.hypot(body.x - x, body.y - y));
    }
    if (gap > bestGap) {
      bestGap = gap;
      best = angle;
    }
  }
  return best;
}

// ---------------------------------------------------------------- prediction

export interface Prediction {
  /** x, y pairs of the candidate's path, starting where it is placed, m. */
  points: Float64Array;
  /** True when the candidate hit another body; the path ends there. */
  merged: boolean;
  /** Simulated time the path covers, s. */
  duration: number;
}

/** Longest and shortest look-ahead of a prediction, s. */
export const PREDICTION_MAX = 120 * DAY;
export const PREDICTION_MIN = 2 * HOUR;

/**
 * How far ahead to predict a candidate's path: one orbit if it is bound to its strongest
 * attractor, otherwise long enough to see it leave (four times distance over relative speed).
 */
export function predictionHorizon(sim: Simulation, candidate: Body): number {
  const primary = strongestAttractor(sim, candidate);
  if (!primary) return 30 * DAY;
  const orbit = orbitAround(candidate, primary);
  const horizon = orbit.bound ? orbit.period * 1.02 : (4 * orbit.distance) / Math.max(orbit.speed, 1);
  return Math.min(PREDICTION_MAX, Math.max(PREDICTION_MIN, horizon));
}

/**
 * Simulates a copy of the system with `candidate` added and returns the candidate's path: the
 * dashed line the page draws while a body is being thrown. Every body moves, so the path is
 * what will really happen (until something else changes).
 */
export function predictPath(
  sim: Simulation,
  candidate: BodyInit,
  options: { samples?: number; horizon?: number; budget?: number } = {},
): Prediction {
  const samples = options.samples ?? 360;
  const copy = cloneSimulation(sim);
  copy.bodies.splice(MAX_BODIES - 1);
  const body = addBody(copy, candidate)!;
  const horizon = options.horizon ?? predictionHorizon(copy, body);
  // A total budget of sub-steps, shared out over the samples.
  const perSample = Math.max(1, Math.floor((options.budget ?? 60_000) / samples));
  const points = new Float64Array((samples + 1) * 2);
  points[0] = body.x;
  points[1] = body.y;
  const chunk = horizon / samples;
  let count = 1;
  let covered = 0;
  for (let i = 0; i < samples; i++) {
    const result = advance(copy, chunk, perSample);
    covered += result.advanced;
    // The candidate can absorb a lighter body and carry on; the path ends only if it is absorbed.
    const end = result.merges.find((merge) => merge.absorbed === body.id);
    if (end) {
      // The path ends on the body it fell into (if that one was not absorbed in turn).
      const into = copy.bodies.find((other) => other.id === end.survivor);
      if (into) {
        points[2 * count] = into.x;
        points[2 * count + 1] = into.y;
        count++;
      }
      return { points: points.slice(0, 2 * count), merged: true, duration: covered };
    }
    points[2 * count] = body.x;
    points[2 * count + 1] = body.y;
    count++;
  }
  return { points: points.slice(0, 2 * count), merged: false, duration: covered };
}

// ---------------------------------------------------------------- presets

export const PRESET_IDS = ['earth-moon', 'geostationary', 'three-speeds', 'double-planet', 'figure-eight'] as const;
export type PresetId = (typeof PRESET_IDS)[number];

/** Names of preset bodies; the page's catalogue gives them words in each language. */
export const PRESET_BODY_NAMES = ['earth', 'moon', 'satellite', 'slow', 'circular', 'fast', 'twin', 'a', 'b', 'c'] as const;
export type PresetBodyName = (typeof PRESET_BODY_NAMES)[number];

export interface PresetBody extends Omit<BodyInit, 'name'> {
  name: PresetBodyName;
}

export interface Preset {
  id: PresetId;
  bodies: PresetBody[];
  /** Simulated seconds per real second the preset starts at. */
  timeScale: number;
}

export function isPresetId(value: string): value is PresetId {
  return (PRESET_IDS as readonly string[]).includes(value);
}

const earthAt = (x = 0, y = 0, vx = 0, vy = 0): PresetBody => ({
  name: 'earth',
  kind: 'earth',
  mass: EARTH_MASS,
  x,
  y,
  vx,
  vy,
});

/** A body moving counterclockwise at `speed` around the origin, `distance` away at `angle`. */
function around(
  body: Omit<PresetBody, 'x' | 'y' | 'vx' | 'vy'>,
  distance: number,
  angle: number,
  speed: number,
): PresetBody {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { ...body, x: distance * cos, y: distance * sin, vx: -speed * sin, vy: speed * cos };
}

/**
 * The figure-eight of Chenciner and Montgomery (2000): three equal masses chasing each other
 * along one figure-eight curve. The initial conditions are Carles Simó's, in units where
 * G = m = 1; they are scaled to three Earth masses with a length unit of 150,000 km, which
 * makes the speed unit √(Gm/L) about 1.63 km/s and the period about 6.7 days.
 */
const EIGHT = {
  x: 0.97000436,
  y: -0.24308753,
  vx: -0.93240737,
  vy: -0.86473146,
  length: 150_000e3,
};

export function figureEightBodies(): PresetBody[] {
  const L = EIGHT.length;
  const V = Math.sqrt((G * EARTH_MASS) / L);
  const base = { kind: 'custom', mass: EARTH_MASS, density: BODY_TYPES.earth.density } as const;
  return [
    { ...base, name: 'a', x: EIGHT.x * L, y: EIGHT.y * L, vx: (-EIGHT.vx / 2) * V, vy: (-EIGHT.vy / 2) * V },
    { ...base, name: 'b', x: -EIGHT.x * L, y: -EIGHT.y * L, vx: (-EIGHT.vx / 2) * V, vy: (-EIGHT.vy / 2) * V },
    { ...base, name: 'c', x: 0, y: 0, vx: EIGHT.vx * V, vy: EIGHT.vy * V },
  ];
}

/** Period of the figure-eight in its own units, from Simó's computation. */
export const FIGURE_EIGHT_PERIOD =
  6.3259 * Math.sqrt(EIGHT.length ** 3 / (G * EARTH_MASS));

/** A moon of 1% of the Moon's mass: heavy enough to be a moon, too light to disturb the others much. */
const SMALL_MOON = { kind: 'moon', mass: MOON_MASS / 100 } as const;

export function presetBodies(id: PresetId): PresetBody[] {
  switch (id) {
    case 'earth-moon':
      return [earthAt(), around({ name: 'moon', kind: 'moon', mass: MOON_MASS }, EARTH_MOON_DISTANCE, 0, MOON_SPEED)];
    case 'geostationary':
      return [
        earthAt(),
        around({ name: 'moon', kind: 'moon', mass: MOON_MASS }, EARTH_MOON_DISTANCE, 0, MOON_SPEED),
        around(
          { name: 'satellite', kind: 'satellite', mass: BODY_TYPES.satellite.mass },
          GEOSTATIONARY_RADIUS,
          Math.PI,
          circularSpeed(EARTH_MASS, BODY_TYPES.satellite.mass, GEOSTATIONARY_RADIUS),
        ),
      ];
    case 'three-speeds': {
      // Three small moons start at the Moon's distance, a third of a turn apart: one slower than
      // a circular orbit (an ellipse), one circular, one faster than escape speed (≈ 1.44 km/s).
      const circular = circularSpeed(EARTH_MASS, SMALL_MOON.mass, EARTH_MOON_DISTANCE);
      return [
        earthAt(),
        around({ ...SMALL_MOON, name: 'slow' }, EARTH_MOON_DISTANCE, Math.PI / 2, 600),
        around({ ...SMALL_MOON, name: 'circular' }, EARTH_MOON_DISTANCE, (7 * Math.PI) / 6, circular),
        around({ ...SMALL_MOON, name: 'fast' }, EARTH_MOON_DISTANCE, (11 * Math.PI) / 6, 1600),
      ];
    }
    case 'double-planet': {
      // Two Earths 200,000 km apart on a shared circular orbit: each moves at √(Gm / 2d).
      const separation = 200_000e3;
      const speed = Math.sqrt((G * EARTH_MASS) / (2 * separation));
      return [
        earthAt(separation / 2, 0, 0, speed),
        { ...earthAt(-separation / 2, 0, 0, -speed), name: 'twin' },
      ];
    }
    case 'figure-eight':
      return figureEightBodies();
  }
}

export const PRESETS: Readonly<Record<PresetId, Omit<Preset, 'bodies' | 'id'>>> = {
  'earth-moon': { timeScale: 2 * DAY },
  geostationary: { timeScale: 3 * HOUR },
  'three-speeds': { timeScale: DAY },
  'double-planet': { timeScale: 12 * HOUR },
  'figure-eight': { timeScale: 12 * HOUR },
};

/**
 * A fresh simulation of a preset in its centre-of-mass frame, so the system stays in view.
 * `names` turns the preset's body names into words.
 */
export function loadPreset(id: PresetId, names: Readonly<Record<PresetBodyName, string>>): Simulation {
  const sim = createSimulation();
  for (const body of presetBodies(id)) addBody(sim, { ...body, name: names[body.name] });
  toCenterOfMassFrame(sim);
  computeAccelerations(sim);
  return sim;
}

// ---------------------------------------------------------------- time scale

/**
 * The time-scale slider's stops, in simulated seconds per real second: from one minute to ten
 * days, roughly evenly spaced on a log scale.
 */
export const TIME_SCALES = [
  MINUTE,
  5 * MINUTE,
  15 * MINUTE,
  30 * MINUTE,
  HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  5 * DAY,
  10 * DAY,
] as const;

/** The stop closest (on a log scale) to `seconds`. */
export function nearestTimeScaleIndex(seconds: number): number {
  let best = 0;
  for (let i = 1; i < TIME_SCALES.length; i++) {
    if (Math.abs(Math.log(TIME_SCALES[i]! / seconds)) < Math.abs(Math.log(TIME_SCALES[best]! / seconds))) best = i;
  }
  return best;
}

// ---------------------------------------------------------------- masses

export const MASS_UNITS = ['kg', 'earth', 'moon'] as const;
export type MassUnit = (typeof MASS_UNITS)[number];

export const MASS_UNIT_KG: Readonly<Record<MassUnit, number>> = { kg: 1, earth: EARTH_MASS, moon: MOON_MASS };

export function isMassUnit(value: string): value is MassUnit {
  return (MASS_UNITS as readonly string[]).includes(value);
}

/**
 * Reads a number as people type it: "7.342e22", "7,342e22" (Turkish decimal comma),
 * "7.342 × 10^22", "7,342×10²²", "1 000", "0.5". Returns null for an empty field, NaN when it
 * is not a number.
 */
export function parseAmount(text: string): number | null {
  const superscripts: Record<string, string> = {
    '⁰': '0',
    '¹': '1',
    '²': '2',
    '³': '3',
    '⁴': '4',
    '⁵': '5',
    '⁶': '6',
    '⁷': '7',
    '⁸': '8',
    '⁹': '9',
    '⁻': '-',
  };
  let compact = text
    .replace(/[\s  ']/g, '')
    .replace(/[−–]/g, '-')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/g, (c) => superscripts[c] ?? c);
  if (compact === '') return null;
  compact = compact.replace(/[×x*]10\^?/i, 'e');
  if (!/^[-+]?(\d+([.,]\d*)?|[.,]\d+)(e[-+]?\d+)?$/i.test(compact)) return Number.NaN;
  return Number(compact.replace(',', '.'));
}

/** The mass-slider's range, as log₁₀(kg). */
export const MASS_SLIDER = { min: 0, max: Math.log10(MAX_MASS), step: 0.01 } as const;
