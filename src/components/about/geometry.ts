/**
 * Geometry behind the About page figures. Each figure is drawn from the model it illustrates
 * (a real Hohmann transfer, a real placement count, a real minimax search, a real cipher, an
 * integrated flight profile, an integrated steering field, a network of ideas and the people
 * helping with them, a square tiled by odd numbers), so the pictures stay honest when someone
 * reads them closely.
 *
 * Pure module: no DOM, no `astro:*` imports and erasable TypeScript only, so `node --test` can
 * load it. Coordinates are unitless model values; the figure components scale them to SVG.
 */

export interface Point {
  x: number;
  y: number;
}

/** Rounds to one decimal: plenty for SVG coordinates, and it keeps the markup small. */
export function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** An SVG path through the points: 'M x y L x y …' (empty for no points). */
export function linePath(points: readonly Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`).join(' ');
}

/** A cubic Bézier segment. */
export interface Curve {
  from: Point;
  c1: Point;
  c2: Point;
  to: Point;
}

/**
 * A horizontal S-curve from `from` to `to`: both control points sit halfway across, so the
 * curve leaves and arrives horizontally. Used for the edges of the graph-like figures.
 */
export function sCurve(from: Point, to: Point): Curve {
  const mid = (from.x + to.x) / 2;
  return { from, c1: { x: mid, y: from.y }, c2: { x: mid, y: to.y }, to };
}

/** The point at parameter t ∈ [0, 1] on a cubic Bézier curve (Bernstein form). */
export function curvePoint(curve: Curve, t: number): Point {
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
  return {
    x: w[0] * curve.from.x + w[1] * curve.c1.x + w[2] * curve.c2.x + w[3] * curve.to.x,
    y: w[0] * curve.from.y + w[1] * curve.c1.y + w[2] * curve.c2.y + w[3] * curve.to.y,
  };
}

/** The SVG path of a cubic Bézier curve: 'M x y C x y x y x y'. */
export function curvePath(curve: Curve): string {
  const { from, c1, c2, to } = curve;
  return `M${round(from.x)} ${round(from.y)} C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(to.x)} ${round(to.y)}`;
}

/**
 * An arrowhead for a segment ending at `tip` and pointing along `direction`: the path of two
 * short strokes (an open chevron), `size` long and `spread` radians either side of the shaft.
 */
export function arrowHead(tip: Point, direction: Point, size = 4, spread = 0.45): string {
  const angle = Math.atan2(direction.y, direction.x) + Math.PI;
  const wing = (offset: number): Point => ({
    x: tip.x + size * Math.cos(angle + offset),
    y: tip.y + size * Math.sin(angle + offset),
  });
  const a = wing(spread);
  const b = wing(-spread);
  return `M${round(a.x)} ${round(a.y)} L${round(tip.x)} ${round(tip.y)} L${round(b.x)} ${round(b.y)}`;
}

/* ------------------------------------------------------------------------------------------ */
/* Orbital mechanics: the Hohmann transfer                                                     */
/* ------------------------------------------------------------------------------------------ */

/**
 * Constants for the lunar transfer in Fig. 1 (km and km³/s²): Earth's gravitational parameter
 * GM and equatorial radius (WGS 84), and the Moon's mean orbital radius. The parking orbit is
 * the conventional 300 km example.
 */
export const EARTH_MU = 398_600.4418;
export const EARTH_RADIUS = 6_378.137;
export const MOON_ORBIT_RADIUS = 384_400;
export const PARKING_ALTITUDE = 300;

export interface HohmannTransfer {
  /** Semi-major axis and eccentricity of the transfer ellipse. */
  a: number;
  e: number;
  /** Speed added at departure (periapsis of the ellipse) and at arrival (its apoapsis). */
  dv1: number;
  dv2: number;
  /** Time of flight: half the period of the transfer ellipse. */
  time: number;
}

/**
 * The two-burn Hohmann transfer between coplanar circular orbits of radii r1 < r2 around a
 * body with gravitational parameter `mu` (units follow the inputs: km and km³/s² give km/s
 * and seconds). Speeds come from the vis-viva equation v² = μ(2/r − 1/a); the time is half the
 * ellipse's period, π√(a³/μ). It is the textbook first sketch of a lunar trajectory.
 */
export function hohmannTransfer(mu: number, r1: number, r2: number): HohmannTransfer {
  for (const [name, value] of [
    ['mu', mu],
    ['r1', r1],
    ['r2', r2],
  ] as const) {
    if (!(Number.isFinite(value) && value > 0)) {
      throw new RangeError(`hohmannTransfer: ${name} must be a positive finite number, got ${value}`);
    }
  }
  if (!(r2 > r1)) throw new RangeError('hohmannTransfer: r2 must be larger than r1');
  const a = (r1 + r2) / 2;
  const visViva = (r: number) => Math.sqrt(mu * (2 / r - 1 / a));
  return {
    a,
    e: (r2 - r1) / (r2 + r1),
    dv1: visViva(r1) - Math.sqrt(mu / r1),
    dv2: Math.sqrt(mu / r2) - visViva(r2),
    time: Math.PI * Math.sqrt(a ** 3 / mu),
  };
}

/**
 * Points along a conic with its focus at the origin and periapsis on the +x axis, in the
 * polar form r(θ) = a(1 − e²) / (1 + e cos θ), for θ from `from` to `to` radians in `steps`
 * equal steps. Mathematical orientation (y up): flip y to draw it in SVG.
 */
export function conicArc(a: number, e: number, from: number, to: number, steps: number): Point[] {
  const p = a * (1 - e * e);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const theta = from + ((to - from) * i) / steps;
    const r = p / (1 + e * Math.cos(theta));
    return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
  });
}

/* ------------------------------------------------------------------------------------------ */
/* Battleship: hunt-mode probability density                                                   */
/* ------------------------------------------------------------------------------------------ */

/** A cell as [row, column], zero-based. */
export type Cell = readonly [number, number];

/**
 * For every cell of a `size`×`size` board, the number of ways a remaining ship can lie across
 * it: every ship, in both orientations, at every position that avoids the known misses. The
 * densest cell is the best blind shot, which is how the Battleship opponent hunts.
 * Returns grid[row][column].
 */
export function placementDensity(size: number, shipLengths: readonly number[], misses: readonly Cell[]): number[][] {
  // Row-major counts; index = row * size + col.
  const counts = new Array<number>(size * size).fill(0);
  const blocked = new Set(misses.map(([row, col]) => row * size + col));
  // A ship of `length` starting at index `start` and advancing `stride` cells per segment
  // (1 = horizontal, size = vertical).
  const cells = (start: number, stride: number, length: number) =>
    Array.from({ length }, (_, k) => start + k * stride);

  for (const length of shipLengths) {
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const start = row * size + col;
        const placements = [
          col + length <= size ? cells(start, 1, length) : null,
          row + length <= size ? cells(start, size, length) : null,
        ];
        for (const placement of placements) {
          if (!placement || placement.some((index) => blocked.has(index))) continue;
          for (const index of placement) counts[index] += 1;
        }
      }
    }
  }
  return Array.from({ length: size }, (_, row) => counts.slice(row * size, (row + 1) * size));
}

/** The first cell (row-major) holding the largest value. */
export function densestCell(grid: readonly (readonly number[])[]): { row: number; col: number; value: number } {
  let best = { row: 0, col: 0, value: -Infinity };
  grid.forEach((cells, row) =>
    cells.forEach((value, col) => {
      if (value > best.value) best = { row, col, value };
    }),
  );
  return best;
}

/* ------------------------------------------------------------------------------------------ */
/* Tic-tac-toe: minimax                                                                        */
/* ------------------------------------------------------------------------------------------ */

/** A game tree: a leaf is a score, an inner node lists the positions one move away. */
export type GameTree = number | readonly GameTree[];

/**
 * Plain recursive minimax: the value of `tree` for the player to move, and the index of the
 * move that achieves it at every level (the principal variation). Ties keep the first move.
 */
export function minimax(tree: GameTree, maximizing: boolean): { value: number; line: number[] } {
  if (typeof tree === 'number') return { value: tree, line: [] };
  let best: { value: number; line: number[] } | undefined;
  tree.forEach((child, index) => {
    const result = minimax(child, !maximizing);
    if (!best || (maximizing ? result.value > best.value : result.value < best.value)) {
      best = { value: result.value, line: [index, ...result.line] };
    }
  });
  if (!best) throw new Error('minimax: empty game tree');
  return best;
}

/* ------------------------------------------------------------------------------------------ */
/* Cryptography: the Caesar shift                                                               */
/* ------------------------------------------------------------------------------------------ */

/**
 * Shifts every Latin letter of `text` by `key` places around the alphabet (A–Z and a–z, mod
 * 26); anything else is kept. A negative key undoes a positive one. The oldest cipher there
 * is, and small enough to draw as a flowchart.
 */
export function caesarShift(text: string, key: number): string {
  const k = ((Math.trunc(key) % 26) + 26) % 26;
  return text.replace(/[A-Za-z]/g, (letter) => {
    const base = letter <= 'Z' ? 65 : 97;
    return String.fromCharCode(base + ((letter.charCodeAt(0) - base + k) % 26));
  });
}

/* ------------------------------------------------------------------------------------------ */
/* Rocket flight profile: altitude over time                                                    */
/* ------------------------------------------------------------------------------------------ */

export interface FlightProfileOptions {
  /** Net upward acceleration while the motor burns. */
  thrust: number;
  /** Burn time. */
  burn: number;
  /** Gravity during the coast. */
  gravity: number;
  /** Descent rate under the parachute, reached with time constant `tau` after apogee. */
  descentRate: number;
  tau: number;
  /** Sampling step. */
  step: number;
  /** Safety cap on the number of samples (default 10 000). */
  maxSteps?: number;
}

export interface FlightProfile {
  /** (t, h) samples from lift-off to touchdown. */
  samples: Point[];
  /** Burn-out and apogee (where the vertical velocity crosses zero). */
  burnout: Point;
  apogee: Point;
}

/**
 * An idealised single-stage flight: constant acceleration while the motor burns, a ballistic
 * coast (no drag) up to apogee, then a descent that relaxes exponentially to the parachute's
 * steady descent rate. Crude, but it has the right shape: a short powered phase, a long
 * symmetric-looking coast, and a slow, nearly straight descent.
 *
 * Throws on parameters that would never bring the rocket back down (a non-positive gravity,
 * descent rate, time constant or step), and if touchdown takes more than `maxSteps` samples:
 * the figures run at build time, where a loud failure beats a build that never finishes.
 */
export function flightProfile(options: FlightProfileOptions): FlightProfile {
  const { thrust, burn, gravity, descentRate, tau, step, maxSteps = 10_000 } = options;
  for (const [name, value] of [
    ['gravity', gravity],
    ['descentRate', descentRate],
    ['tau', tau],
    ['step', step],
  ] as const) {
    if (!(Number.isFinite(value) && value > 0)) {
      throw new RangeError(`flightProfile: ${name} must be a positive finite number, got ${value}`);
    }
  }
  const burnoutVelocity = thrust * burn;
  const burnoutHeight = 0.5 * thrust * burn * burn;
  const apogeeTime = burn + burnoutVelocity / gravity;
  const apogeeHeight = burnoutHeight + (burnoutVelocity * burnoutVelocity) / (2 * gravity);

  const height = (t: number): number => {
    if (t <= burn) return 0.5 * thrust * t * t;
    if (t <= apogeeTime) {
      const s = t - burn;
      return burnoutHeight + burnoutVelocity * s - 0.5 * gravity * s * s;
    }
    const s = t - apogeeTime;
    return apogeeHeight - descentRate * (s - tau * (1 - Math.exp(-s / tau)));
  };

  const samples: Point[] = [];
  let landed = false;
  // t = i * step rather than t += step, so rounding errors do not accumulate over the flight.
  for (let i = 0; i <= maxSteps; i++) {
    const t = i * step;
    const h = height(t);
    if (h <= 0 && t > 0) {
      samples.push({ x: t, y: 0 });
      landed = true;
      break;
    }
    samples.push({ x: t, y: h });
  }
  if (!landed) throw new RangeError(`flightProfile: no touchdown within ${maxSteps} steps`);
  return {
    samples,
    burnout: { x: burn, y: burnoutHeight },
    apogee: { x: apogeeTime, y: apogeeHeight },
  };
}

/**
 * The burn time that takes flightProfile() to `apogee` with the given thrust and gravity.
 * Apogee = ½·T·b² (powered) + (T·b)²/(2g) (coast) = b²·T·(1 + T/g)/2, solved for b. With the
 * same motor acceleration, doubling the target altitude takes √2 times the burn.
 */
export function burnForApogee(apogee: number, thrust: number, gravity: number): number {
  for (const [name, value] of [
    ['apogee', apogee],
    ['thrust', thrust],
    ['gravity', gravity],
  ] as const) {
    if (!(Number.isFinite(value) && value > 0)) {
      throw new RangeError(`burnForApogee: ${name} must be a positive finite number, got ${value}`);
    }
  }
  return Math.sqrt((2 * apogee) / (thrust * (1 + thrust / gravity)));
}

/* ------------------------------------------------------------------------------------------ */
/* Parachute guidance: a steering field that converges on the landing target                    */
/* ------------------------------------------------------------------------------------------ */

/**
 * The commanded heading at `p`: the unit vector towards `target`, turned by `turn` radians.
 * With a turn below 90° every integral curve still reaches the target (a logarithmic spiral),
 * which is how a canopy that cannot stop in place circles in on a landing point.
 */
export function steeringDirection(p: Point, target: Point, turn: number): Point {
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return { x: ux * cos - uy * sin, y: ux * sin + uy * cos };
}

/** Follows the steering field from `start` with fixed steps until it is within `radius` of the target. */
export function steer(start: Point, target: Point, turn: number, step: number, radius: number, maxSteps = 2000): Point[] {
  const path: Point[] = [start];
  let p = start;
  for (let i = 0; i < maxSteps && Math.hypot(target.x - p.x, target.y - p.y) > radius; i++) {
    const d = steeringDirection(p, target, turn);
    p = { x: p.x + d.x * step, y: p.y + d.y * step };
    path.push(p);
  }
  path.push(target);
  return path;
}

/* ------------------------------------------------------------------------------------------ */
/* 3D trajectory                                                                               */
/* ------------------------------------------------------------------------------------------ */

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Explicit Euler integration of a point mass under gravity with a constant crosswind
 * acceleration: position and velocity advance together, one fixed step `dt` at a time,
 * until the point returns to the ground. It is the simplest member of the family a flight
 * simulator uses (production code would use a higher-order scheme and real forces).
 */
export function integrateTrajectory(
  velocity: Point3,
  options: { gravity: number; crosswind: number; dt: number; maxSteps?: number },
): { positions: Point3[]; velocities: Point3[] } {
  const { gravity, crosswind, dt, maxSteps = 10_000 } = options;
  let p: Point3 = { x: 0, y: 0, z: 0 };
  let v: Point3 = { ...velocity };
  const positions: Point3[] = [p];
  const velocities: Point3[] = [v];
  for (let i = 0; i < maxSteps; i++) {
    p = { x: p.x + v.x * dt, y: p.y + v.y * dt, z: p.z + v.z * dt };
    v = { x: v.x, y: v.y + crosswind * dt, z: v.z - gravity * dt };
    if (p.z < 0) {
      positions.push({ ...p, z: 0 });
      velocities.push(v);
      break;
    }
    positions.push(p);
    velocities.push(v);
  }
  return { positions, velocities };
}

/**
 * A cabinet-style oblique projection for small 3D sketches: x runs to the right, z straight up,
 * and y recedes up and to the right at 30°, shortened by `depth`. Screen y grows downwards.
 */
export function oblique(p: Point3, origin: Point, scale: number, depth = 0.5): Point {
  const angle = Math.PI / 6;
  return {
    x: origin.x + scale * (p.x + depth * p.y * Math.cos(angle)),
    y: origin.y - scale * (p.z + depth * p.y * Math.sin(angle)),
  };
}

/* ------------------------------------------------------------------------------------------ */
/* An idea network: people share ideas and others help with them                               */
/* ------------------------------------------------------------------------------------------ */

/** An axis-aligned rectangle: its top left corner and its size. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** True when `p` lies in `rect` (its edge included). */
export function insideRect(p: Point, rect: Rect): boolean {
  return p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height;
}

/** The golden angle, 180° × (3 − √5) ≈ 137.5°: turning by it each time, no two helpers line up. */
export const GOLDEN_ANGLE = 180 * (3 - Math.sqrt(5));

/** An idea of the network, and the people who help with this idea and no other. */
export interface IdeaSeed {
  at: Point;
  /** How many people help with this idea only. */
  helpers: number;
  /**
   * The ring they gather in, as [inner, outer] radii. Helper k stands GOLDEN_ANGLE further round
   * than helper k − 1, and a little further out, so that each takes an equal share of the ring's
   * area: the way seeds pack a sunflower head (Vogel's model), read here as a crowd forming.
   */
  ring: readonly [number, number];
  /** Direction from the idea to its first helper, in degrees clockwise from +x (y down, as in SVG). */
  phase: number;
  /** A private idea: it and everyone who helps with it stay inside the private region. */
  private?: boolean;
}

export interface IdeaNetworkSpec {
  ideas: readonly IdeaSeed[];
  /**
   * People who help with two ideas, as [i, j, offset]: each stands halfway between ideas i and j,
   * `offset` units off the line that joins them (positive: to the right, looking from i to j on
   * screen), so its two links meet at an angle instead of lying on one straight line.
   */
  shared: readonly (readonly [number, number, number])[];
  /** The private region. */
  region: Rect;
}

export interface IdeaNetwork {
  /** The ideas in the order of the spec, each with its number of helpers (its links). */
  ideas: { at: Point; private: boolean; helpers: number }[];
  /** Every idea's own helpers in turn, then the shared helpers. */
  users: { at: Point; private: boolean }[];
  /** Who helps with which idea, as indices into `users` and `ideas`. */
  links: { user: number; idea: number }[];
  /** The idea with the most helpers (the first of them on a tie). */
  busiest: number;
}

/**
 * Lays out a small network of ideas and the people who help with them: each idea's own helpers
 * in a ring around it, and the people who help with two ideas between those two. Every helper
 * is linked to the ideas it helps with, and `busiest` is the idea with the most helpers.
 *
 * Throws on a malformed spec, and when the private boundary would be crossed: a private idea or
 * anyone who helps with it outside `region`, anything public inside it, or one person helping
 * with a public and a private idea (the link between those two would cross the boundary).
 */
export function ideaNetwork(spec: IdeaNetworkSpec): IdeaNetwork {
  const { ideas, shared, region } = spec;
  if (ideas.length === 0) throw new RangeError('ideaNetwork: a network needs at least one idea');
  const users: IdeaNetwork['users'] = [];
  const links: IdeaNetwork['links'] = [];
  const add = (at: Point, isPrivate: boolean, what: string): number => {
    if (insideRect(at, region) !== isPrivate) {
      throw new RangeError(
        `ideaNetwork: ${what} is ${isPrivate ? 'private but outside' : 'public but inside'} the private region`,
      );
    }
    return users.push({ at, private: isPrivate }) - 1;
  };

  ideas.forEach((idea, i) => {
    const isPrivate = idea.private ?? false;
    const [inner, outer] = idea.ring;
    if (!(Number.isInteger(idea.helpers) && idea.helpers >= 0)) {
      throw new RangeError(`ideaNetwork: idea ${i} needs a whole number of helpers, got ${idea.helpers}`);
    }
    if (!(inner > 0 && outer >= inner)) {
      throw new RangeError(`ideaNetwork: idea ${i} needs a ring with 0 < inner ≤ outer, got [${inner}, ${outer}]`);
    }
    if (insideRect(idea.at, region) !== isPrivate) {
      throw new RangeError(`ideaNetwork: idea ${i} is on the wrong side of the private region's boundary`);
    }
    for (let k = 0; k < idea.helpers; k++) {
      // Equal areas: r² grows by the same amount with every helper, from inner² to outer².
      const r = Math.sqrt(inner ** 2 + ((outer ** 2 - inner ** 2) * k) / Math.max(1, idea.helpers - 1));
      const angle = ((idea.phase + k * GOLDEN_ANGLE) * Math.PI) / 180;
      const at = { x: idea.at.x + r * Math.cos(angle), y: idea.at.y + r * Math.sin(angle) };
      links.push({ user: add(at, isPrivate, `helper ${k} of idea ${i}`), idea: i });
    }
  });

  shared.forEach(([i, j, offset], s) => {
    const a = ideas[i];
    const b = ideas[j];
    if (!a || !b || i === j) throw new RangeError(`ideaNetwork: shared helper ${s} needs two different ideas`);
    const isPrivate = a.private ?? false;
    if ((b.private ?? false) !== isPrivate) {
      throw new RangeError(`ideaNetwork: shared helper ${s} would join a public and a private idea`);
    }
    const dx = b.at.x - a.at.x;
    const dy = b.at.y - a.at.y;
    const length = Math.hypot(dx, dy);
    if (!(length > 0)) throw new RangeError(`ideaNetwork: shared helper ${s} joins two ideas at the same point`);
    // The midpoint, moved along the right-hand normal (−dy, dx) of the direction from i to j.
    const at = {
      x: (a.at.x + b.at.x) / 2 - (dy / length) * offset,
      y: (a.at.y + b.at.y) / 2 + (dx / length) * offset,
    };
    const user = add(at, isPrivate, `shared helper ${s}`);
    links.push({ user, idea: i }, { user, idea: j });
  });

  const counts = ideas.map((_, i) => links.filter((link) => link.idea === i).length);
  return {
    ideas: ideas.map((idea, i) => ({ at: idea.at, private: idea.private ?? false, helpers: counts[i] ?? 0 })),
    users,
    links,
    busiest: counts.indexOf(Math.max(...counts)),
  };
}

/**
 * The crowd.inc figure's network, in its SVG units (320 wide): the idea with the most helpers,
 * seven more public ideas around it (clockwise from the top left), and two private ideas inside
 * the region on the right. Schematic, like the counts, and the caption says so. `radius` is the
 * drawn size of an idea and of a person, which the tests use to check that nothing overlaps.
 */
export const IDEA_NETWORK = {
  radius: { idea: 7, user: 2 },
  region: { x: 228, y: 22, width: 84, height: 144 },
  ideas: [
    { at: { x: 100, y: 98 }, helpers: 11, ring: [16, 32], phase: 273 },
    { at: { x: 34, y: 50 }, helpers: 4, ring: [15, 20], phase: 3 },
    { at: { x: 96, y: 34 }, helpers: 2, ring: [15, 16], phase: 210 },
    { at: { x: 160, y: 42 }, helpers: 5, ring: [15, 21], phase: 333 },
    { at: { x: 200, y: 98 }, helpers: 3, ring: [15, 18], phase: 3 },
    { at: { x: 172, y: 148 }, helpers: 4, ring: [15, 19], phase: 3 },
    { at: { x: 102, y: 158 }, helpers: 1, ring: [15, 15], phase: 267 },
    { at: { x: 30, y: 138 }, helpers: 3, ring: [15, 18], phase: 33 },
    { at: { x: 266, y: 58 }, helpers: 3, ring: [15, 19], phase: -90, private: true },
    { at: { x: 272, y: 126 }, helpers: 3, ring: [15, 18], phase: 0, private: true },
  ],
  shared: [
    [0, 1, 4],
    [0, 3, -6],
    [0, 5, -4],
    [0, 7, -6],
    [2, 1, 4],
    [2, 3, 4],
    [3, 4, 6],
    [4, 5, -6],
    [6, 5, 4],
    [6, 7, 4],
    [8, 9, 10],
  ],
} as const satisfies IdeaNetworkSpec & { radius: { idea: number; user: number } };

/* ------------------------------------------------------------------------------------------ */
/* Sums of odd numbers: a square built from L-shaped pieces                                     */
/* ------------------------------------------------------------------------------------------ */

export interface Gnomon {
  /** The piece's cells as [row, column]; piece k has 2k − 1 of them. */
  cells: Cell[];
  /** The cell where the two arms of the L meet: [k − 1, k − 1]. */
  corner: Cell;
  /** The piece's outline in cell units (x = column, y = row, y down), for a closed SVG path. */
  outline: Point[];
}

/**
 * The n nested L-shaped pieces (gnomons) that build an n×n square of unit cells, smallest
 * first. Piece k (k = 1 … n) holds the cells whose larger coordinate is k − 1: column k − 1
 * down to row k − 1, then row k − 1 back to the left edge. Its 2k − 1 cells turn the
 * (k − 1)×(k − 1) square into a k×k one, which is why the odd numbers add up to squares:
 * 1 + 3 + … + (2n − 1) = n².
 */
export function gnomons(n: number): Gnomon[] {
  if (!(Number.isInteger(n) && n > 0)) throw new RangeError(`gnomons: n must be a positive integer, got ${n}`);
  return Array.from({ length: n }, (_, index) => {
    const k = index + 1;
    const edge = k - 1;
    const cells: Cell[] = [
      ...Array.from({ length: edge }, (_, row): Cell => [row, edge]),
      ...Array.from({ length: k }, (_, i): Cell => [edge, edge - i]),
    ];
    const outline: Point[] =
      k === 1
        ? [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ]
        : [
            { x: edge, y: 0 },
            { x: k, y: 0 },
            { x: k, y: k },
            { x: 0, y: k },
            { x: 0, y: edge },
            { x: edge, y: edge },
          ];
    return { cells, corner: [edge, edge], outline };
  });
}
