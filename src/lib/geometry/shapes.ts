/**
 * The shapes the collision tests work on: axis-aligned boxes, circles (discs) and convex
 * polygons, with constructors for oriented rectangles, regular polygons and triangles.
 *
 * Every shape is a CLOSED set: its boundary belongs to it. Two shapes that only share boundary
 * points therefore intersect ("touching"), which is what src/lib/geometry/collide.ts reports.
 *
 * Polygons are arrays of vertices in order. Orientation is read from the shoelace formula:
 * positive signed area = counter-clockwise in the maths orientation (y up), which looks clockwise
 * on a screen where y points down. Functions that need a particular orientation normalise it
 * themselves, so callers may pass either.
 *
 * Pure module, erasable TypeScript only.
 */
import {
  EPSILON,
  add,
  cross,
  magnitudeOf,
  rotate,
  rotateAbout,
  sub,
  toleranceFor,
  vec,
  type Vec,
} from './vec.ts';

/** Axis-aligned bounding box: every point p with min.x ≤ p.x ≤ max.x and min.y ≤ p.y ≤ max.y. */
export interface Aabb {
  readonly min: Vec;
  readonly max: Vec;
}

/** A disc: every point within `radius` of `center` (the boundary circle included). */
export interface Circle {
  readonly center: Vec;
  readonly radius: number;
}

/** Vertices in order (either orientation). The collision tests assume the polygon is convex. */
export type Polygon = readonly Vec[];

// ---------------------------------------------------------------- boxes

/** A box from two opposite corners given in any order. */
export function aabb(x0: number, y0: number, x1: number, y1: number): Aabb {
  return { min: vec(Math.min(x0, x1), Math.min(y0, y1)), max: vec(Math.max(x0, x1), Math.max(y0, y1)) };
}

/** A box from its centre and half-extents (negative half-extents are taken as positive). */
export function aabbFromCenter(center: Vec, halfWidth: number, halfHeight: number): Aabb {
  const hw = Math.abs(halfWidth);
  const hh = Math.abs(halfHeight);
  return { min: vec(center.x - hw, center.y - hh), max: vec(center.x + hw, center.y + hh) };
}

export function aabbCenter(box: Aabb): Vec {
  return vec((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2);
}

export function aabbSize(box: Aabb): Vec {
  return vec(box.max.x - box.min.x, box.max.y - box.min.y);
}

export function translateAabb(box: Aabb, offset: Vec): Aabb {
  return { min: add(box.min, offset), max: add(box.max, offset) };
}

/** The four corners, starting at min and going through (max.x, min.y): positive signed area. */
export function aabbCorners(box: Aabb): Polygon {
  return [box.min, vec(box.max.x, box.min.y), box.max, vec(box.min.x, box.max.y)];
}

/** The smallest box around the points. Throws on an empty list (a programming error). */
export function aabbOfPoints(points: readonly Vec[]): Aabb {
  if (points.length === 0) throw new RangeError('aabbOfPoints: no points');
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { min: vec(minX, minY), max: vec(maxX, maxY) };
}

export function aabbOfCircle(c: Circle): Aabb {
  return aabbFromCenter(c.center, c.radius, c.radius);
}

/** Whether p lies in the box, boundary included (within `tolerance`). */
export function aabbContainsPoint(box: Aabb, p: Vec, tolerance = 0): boolean {
  return (
    p.x >= box.min.x - tolerance &&
    p.x <= box.max.x + tolerance &&
    p.y >= box.min.y - tolerance &&
    p.y <= box.max.y + tolerance
  );
}

/** The point of the box nearest to p: each coordinate clamped to the box's range on that axis. */
export function closestPointOnAabb(box: Aabb, p: Vec): Vec {
  return vec(Math.min(Math.max(p.x, box.min.x), box.max.x), Math.min(Math.max(p.y, box.min.y), box.max.y));
}

// ---------------------------------------------------------------- circles

export function circle(center: Vec, radius: number): Circle {
  if (!(radius >= 0)) throw new RangeError(`circle: the radius must be ≥ 0 (got ${radius})`);
  return { center, radius };
}

// ---------------------------------------------------------------- polygons

/** Shoelace formula: half the sum of cross(vᵢ, vᵢ₊₁). Positive for counter-clockwise (y up). */
export function signedArea(poly: Polygon): number {
  let twice = 0;
  for (let i = 0; i < poly.length; i++) {
    twice += cross(poly[i]!, poly[(i + 1) % poly.length]!);
  }
  return twice / 2;
}

export function polygonArea(poly: Polygon): number {
  return Math.abs(signedArea(poly));
}

/**
 * Areas at or below this count as zero: EPSILON times the squared size of the coordinates, since
 * an area is a product of two lengths (and so is its rounding error).
 */
export function areaTolerance(poly: Polygon): number {
  const size = Math.max(1, magnitudeOf(poly));
  return EPSILON * size * size;
}

/** Whether the polygon has (almost) no area: fewer than three vertices, or all on one line. */
export function isDegenerate(poly: Polygon): boolean {
  return poly.length < 3 || Math.abs(signedArea(poly)) <= areaTolerance(poly);
}

/** Average of the vertices (the centroid of a degenerate polygon, and a cheap centre otherwise). */
export function vertexMean(poly: Polygon): Vec {
  if (poly.length === 0) throw new RangeError('vertexMean: empty polygon');
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return vec(x / poly.length, y / poly.length);
}

/**
 * Centroid (centre of mass) of the polygon's area. A polygon with (almost) no area, such as a
 * segment or a point, has no area centroid; it falls back to the mean of its vertices.
 */
export function centroid(poly: Polygon): Vec {
  const area = signedArea(poly);
  if (Math.abs(area) <= areaTolerance(poly)) return vertexMean(poly);
  // Relative to the first vertex, to keep the products small when the polygon is far from 0.
  const origin = poly[0]!;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = sub(poly[i]!, origin);
    const q = sub(poly[(i + 1) % poly.length]!, origin);
    const c = cross(p, q);
    cx += (p.x + q.x) * c;
    cy += (p.y + q.y) * c;
  }
  return vec(origin.x + cx / (6 * area), origin.y + cy / (6 * area));
}

/** The same polygon with positive signed area (counter-clockwise in the maths orientation). */
export function toCounterClockwise(poly: Polygon): Polygon {
  return signedArea(poly) < 0 ? [...poly].reverse() : poly;
}

/**
 * Whether the polygon is convex: every turn goes the same way (collinear vertices allowed).
 * Fewer than three vertices, or all of them on one line, count as (degenerate) convex sets.
 * A polygon that winds around more than once also fails, because its turns add up to more
 * than one full turn.
 */
export function isConvex(poly: Polygon, tolerance = EPSILON): boolean {
  const n = poly.length;
  if (n < 4) return true;
  const scaleSq = Math.max(1, magnitudeOf(poly)) ** 2;
  let sign = 0;
  let turning = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    const c = poly[(i + 2) % n]!;
    const e1 = sub(b, a);
    const e2 = sub(c, b);
    const turn = cross(e1, e2);
    if (Math.abs(turn) <= tolerance * scaleSq) continue;
    const s = Math.sign(turn);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
    turning += Math.atan2(turn, e1.x * e2.x + e1.y * e2.y);
  }
  // Exterior angles of a simple convex polygon add up to exactly one turn (2π).
  return sign === 0 || Math.abs(turning) <= 2 * Math.PI + 1e-6;
}

export function translatePolygon(poly: Polygon, offset: Vec): Polygon {
  return poly.map((p) => add(p, offset));
}

/** The polygon rotated by `angle` radians about `pivot` (by default its centroid). */
export function rotatePolygon(poly: Polygon, angle: number, pivot: Vec = centroid(poly)): Polygon {
  return poly.map((p) => rotateAbout(p, angle, pivot));
}

export function aabbOfPolygon(poly: Polygon): Aabb {
  return aabbOfPoints(poly);
}

/**
 * Whether p lies in the convex polygon, boundary included (within `tolerance`, a distance).
 * p is inside when it is on the inner side of every edge line.
 */
export function pointInConvexPolygon(p: Vec, poly: Polygon, tolerance = toleranceFor(p.x, p.y, magnitudeOf(poly))): boolean {
  const ccw = toCounterClockwise(poly);
  const n = ccw.length;
  if (n === 0) return false;
  if (n === 1) return Math.hypot(p.x - ccw[0]!.x, p.y - ccw[0]!.y) <= tolerance;
  for (let i = 0; i < n; i++) {
    const a = ccw[i]!;
    const b = ccw[(i + 1) % n]!;
    const edge = sub(b, a);
    const len = Math.hypot(edge.x, edge.y);
    if (len === 0) continue;
    // Signed distance of p from the edge line, positive on the inner (left) side.
    if (cross(edge, sub(p, a)) / len < -tolerance) return false;
  }
  if (isDegenerate(ccw)) {
    // All vertices on one line: also require p to lie between the extreme points.
    const box = aabbOfPoints(ccw);
    return aabbContainsPoint(box, p, tolerance);
  }
  return true;
}

// ---------------------------------------------------------------- constructors

/**
 * A rectangle of half-extents (halfWidth, halfHeight) centred at `center` and rotated by `angle`
 * radians: its corners are c + R(θ)(±w, ±h). With angle 0 it is the box aabbFromCenter(…).
 */
export function orientedRect(center: Vec, halfWidth: number, halfHeight: number, angle = 0): Polygon {
  const w = Math.abs(halfWidth);
  const h = Math.abs(halfHeight);
  const corners = [vec(-w, -h), vec(w, -h), vec(w, h), vec(-w, h)];
  return corners.map((corner) => add(center, rotate(corner, angle)));
}

/**
 * A regular polygon with `sides` vertices on the circle of radius `circumradius` about `center`.
 * The first vertex points in the direction `angle` (0 = +x); vertices follow counter-clockwise.
 */
export function regularPolygon(center: Vec, circumradius: number, sides: number, angle = 0): Polygon {
  if (!Number.isInteger(sides) || sides < 3) throw new RangeError(`regularPolygon: need at least 3 sides (got ${sides})`);
  return Array.from({ length: sides }, (_, i) => {
    const theta = angle + (2 * Math.PI * i) / sides;
    return vec(center.x + circumradius * Math.cos(theta), center.y + circumradius * Math.sin(theta));
  });
}

/** A triangle with positive signed area, whatever the order of a, b and c. */
export function triangle(a: Vec, b: Vec, c: Vec): Polygon {
  return triangleSignedArea(a, b, c) < 0 ? [a, c, b] : [a, b, c];
}

/** Half of cross(b − a, c − a): positive when a, b, c turn counter-clockwise, 0 when collinear. */
export function triangleSignedArea(a: Vec, b: Vec, c: Vec): number {
  return cross(sub(b, a), sub(c, a)) / 2;
}

/** The centroid of a triangle: the mean of its vertices (where the medians meet). */
export function triangleCentroid(a: Vec, b: Vec, c: Vec): Vec {
  return vec((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3);
}

/**
 * Whether p lies in the triangle abc, edges included, using the signs of the three sub-triangle
 * areas (the barycentric coordinates up to a common factor): p is inside when none of them has
 * the opposite sign to the whole triangle. `tolerance` is a distance from the edges.
 */
export function pointInTriangle(p: Vec, a: Vec, b: Vec, c: Vec, tolerance?: number): boolean {
  return pointInConvexPolygon(p, [a, b, c], tolerance ?? toleranceFor(p.x, p.y, magnitudeOf([a, b, c])));
}
