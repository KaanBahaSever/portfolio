/**
 * Two-dimensional vectors and the scalar helpers the collision tests share.
 *
 * Pure module (no DOM, no `astro:*`, erasable TypeScript only) so `node --test` can import it.
 * Vectors are plain immutable `{ x, y }` records: every function returns a new vector.
 *
 * Orientation: the maths is the usual one (angles grow from +x towards +y). On a screen, where y
 * points down (SVG, canvas), a positive angle therefore looks clockwise.
 */

export interface Vec {
  readonly x: number;
  readonly y: number;
}

/**
 * Default tolerance for "equal" and "touching", relative to the size of the coordinates involved
 * (see `toleranceFor`). 1e-9 is far above the rounding error of a few double-precision operations
 * on coordinates of that size (about 1e-16 relative) and far below anything a person can see.
 */
export const EPSILON = 1e-9;

export function vec(x: number, y: number): Vec {
  return { x, y };
}

export const ZERO: Vec = vec(0, 0);

export function add(a: Vec, b: Vec): Vec {
  return vec(a.x + b.x, a.y + b.y);
}

export function sub(a: Vec, b: Vec): Vec {
  return vec(a.x - b.x, a.y - b.y);
}

export function scale(v: Vec, factor: number): Vec {
  return vec(v.x * factor, v.y * factor);
}

export function neg(v: Vec): Vec {
  return vec(-v.x, -v.y);
}

export function dot(a: Vec, b: Vec): number {
  return a.x * b.x + a.y * b.y;
}

/** The z component of the 3D cross product: positive when b is counter-clockwise from a. */
export function cross(a: Vec, b: Vec): number {
  return a.x * b.y - a.y * b.x;
}

export function lengthSq(v: Vec): number {
  return v.x * v.x + v.y * v.y;
}

export function length(v: Vec): number {
  return Math.hypot(v.x, v.y);
}

export function distance(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Unit vector in the direction of v, or the zero vector when v has (almost) no length. */
export function normalize(v: Vec, tolerance = 0): Vec {
  const len = length(v);
  return len > tolerance && len > 0 ? vec(v.x / len, v.y / len) : ZERO;
}

/** v turned a quarter turn counter-clockwise (in the maths orientation): (x, y) → (−y, x). */
export function perp(v: Vec): Vec {
  return vec(-v.y, v.x);
}

export function lerp(a: Vec, b: Vec, t: number): Vec {
  return vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
}

export function midpoint(a: Vec, b: Vec): Vec {
  return lerp(a, b, 0.5);
}

/** v rotated by `angle` radians about the origin: R(θ)v = (x cos θ − y sin θ, x sin θ + y cos θ). */
export function rotate(v: Vec, angle: number): Vec {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return vec(v.x * c - v.y * s, v.x * s + v.y * c);
}

/** p rotated by `angle` radians about `pivot`. */
export function rotateAbout(p: Vec, angle: number, pivot: Vec): Vec {
  return add(pivot, rotate(sub(p, pivot), angle));
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * An absolute tolerance for comparisons between quantities built from the given coordinates:
 * EPSILON times the largest magnitude involved (at least 1). Rounding errors grow with the size
 * of the numbers, so a fixed 1e-9 would be too strict for coordinates in the millions.
 */
export function toleranceFor(...magnitudes: number[]): number {
  let largest = 1;
  for (const value of magnitudes) {
    const size = Math.abs(value);
    if (size > largest) largest = size;
  }
  return EPSILON * largest;
}

/** Largest absolute coordinate among the points: the scale that `toleranceFor` needs. */
export function magnitudeOf(points: Iterable<Vec>): number {
  let largest = 0;
  for (const p of points) {
    const size = Math.max(Math.abs(p.x), Math.abs(p.y));
    if (size > largest) largest = size;
  }
  return largest;
}

/** |a − b| ≤ tolerance (by default EPSILON relative to the larger of the two, at least 1). */
export function nearlyEqual(a: number, b: number, tolerance = toleranceFor(a, b)): boolean {
  return Math.abs(a - b) <= tolerance;
}

export function vecNearlyEqual(a: Vec, b: Vec, tolerance = toleranceFor(a.x, a.y, b.x, b.y)): boolean {
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;
}
