/**
 * Geometry behind the About page figures. Each figure is drawn from the model it illustrates
 * (a real placement count, a real minimax search, an integrated flight profile, an integrated
 * steering field), so the pictures stay honest when someone reads them closely.
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
