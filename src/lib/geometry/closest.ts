/**
 * Closest points: on a segment, and between the boundaries of two polygons. Used to report how
 * far apart two shapes are when they do not collide.
 *
 * Pure module, erasable TypeScript only.
 */
import type { Polygon } from './shapes.ts';
import { add, dot, lengthSq, scale, sub, type Vec } from './vec.ts';

/**
 * The point of segment ab nearest to p: the projection of p onto the line ab, with the
 * parameter t = (p − a)·(b − a) / |b − a|² clamped to [0, 1]. A zero-length segment is a point.
 */
export function closestPointOnSegment(p: Vec, a: Vec, b: Vec): Vec {
  const ab = sub(b, a);
  const lenSq = lengthSq(ab);
  if (lenSq === 0) return a;
  const t = Math.min(1, Math.max(0, dot(sub(p, a), ab) / lenSq));
  return add(a, scale(ab, t));
}

export interface ClosestPair {
  /** Point on A's boundary. */
  readonly a: Vec;
  /** Point on B's boundary. */
  readonly b: Vec;
  readonly distance: number;
}

/** Edges of a polygon as [start, end] pairs; a single point is one zero-length edge. */
function edges(poly: Polygon): [Vec, Vec][] {
  if (poly.length === 1) return [[poly[0]!, poly[0]!]];
  return poly.map((p, i) => [p, poly[(i + 1) % poly.length]!]);
}

/**
 * The nearest pair of points on the boundaries of two polygons.
 *
 * For two convex polygons that do not intersect, the distance between them is attained between
 * a vertex of one and an edge of the other (two nearest edges that cross would mean the shapes
 * intersect; two parallel nearest edges also give a vertex–edge pair). So checking every vertex
 * against every edge of the other polygon, both ways, is exact: O(n·m).
 *
 * When the polygons DO intersect this is the distance between the boundaries, not between the
 * shapes (which is 0); call it only after a test has said the shapes are apart.
 */
export function closestPointsBetweenPolygons(a: Polygon, b: Polygon): ClosestPair {
  if (a.length === 0 || b.length === 0) throw new RangeError('closestPointsBetweenPolygons: empty polygon');
  let best: ClosestPair = { a: a[0]!, b: b[0]!, distance: Infinity };
  const consider = (onA: Vec, onB: Vec) => {
    const d = Math.hypot(onA.x - onB.x, onA.y - onB.y);
    if (d < best.distance) best = { a: onA, b: onB, distance: d };
  };
  for (const [p, q] of edges(b)) {
    for (const v of a) consider(v, closestPointOnSegment(v, p, q));
  }
  for (const [p, q] of edges(a)) {
    for (const v of b) consider(closestPointOnSegment(v, p, q), v);
  }
  return best;
}
