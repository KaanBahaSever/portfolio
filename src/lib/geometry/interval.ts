/**
 * Projections of shapes onto an axis, and the overlap of the resulting intervals: the
 * one-dimensional core of every test in collide.ts (boxes use the x and y axes, polygons the
 * normals of their edges).
 *
 * Pure module, erasable TypeScript only.
 */
import type { Aabb, Circle, Polygon } from './shapes.ts';
import { dot, type Vec } from './vec.ts';

/** The closed interval [min, max] of a real line. */
export interface Interval {
  readonly min: number;
  readonly max: number;
}

/**
 * The shadow of a polygon on the line through the origin with direction `axis`:
 * [min over vertices of axis·v, max over vertices of axis·v]. With a unit axis the numbers are
 * distances along it; with any other axis they are scaled by its length, which does not change
 * whether two shadows overlap.
 */
export function projectPolygon(poly: Polygon, axis: Vec): Interval {
  if (poly.length === 0) throw new RangeError('projectPolygon: empty polygon');
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const d = dot(p, axis);
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return { min, max };
}

/** The shadow of a disc on a UNIT axis: its centre's projection ± the radius. */
export function projectCircle(c: Circle, axis: Vec): Interval {
  const d = dot(c.center, axis);
  return { min: d - c.radius, max: d + c.radius };
}

/** The shadow of a box on a unit axis: the centre's projection ± the projected half-extents. */
export function projectAabb(box: Aabb, axis: Vec): Interval {
  const cx = (box.min.x + box.max.x) / 2;
  const cy = (box.min.y + box.max.y) / 2;
  const reach = (Math.abs(axis.x) * (box.max.x - box.min.x) + Math.abs(axis.y) * (box.max.y - box.min.y)) / 2;
  const d = axis.x * cx + axis.y * cy;
  return { min: d - reach, max: d + reach };
}

/**
 * How far B's interval must slide to stop overlapping A's, and which way.
 *
 * Sliding B forward (+1) by `a.max − b.min` makes it start where A ends; sliding it backward
 * (−1) by `b.max − a.min` makes it end where A starts. The penetration is the smaller of the two:
 *
 *   overlap = min(a.max − b.min, b.max − a.min)
 *
 * Positive: the intervals overlap and B must move that far. Zero: they touch. Negative: they are
 * apart and −overlap is the gap. This is NOT the length of the intersection: when one interval
 * contains the other (nested shapes), the inner one has to travel past the nearer end of the
 * outer one, which is further than its own length.
 *
 * `direction` is the way B should move: +1 forward, −1 backward. On a tie (B centred on A),
 * `tieBreak` decides; callers pass the sign of the centres' difference so that B is pushed away
 * from A.
 */
export function intervalPenetration(a: Interval, b: Interval, tieBreak: 1 | -1 = 1): { overlap: number; direction: 1 | -1 } {
  const forward = a.max - b.min;
  const backward = b.max - a.min;
  if (forward < backward) return { overlap: forward, direction: 1 };
  if (backward < forward) return { overlap: backward, direction: -1 };
  return { overlap: forward, direction: tieBreak };
}

/** Whether the closed intervals share a point (within `tolerance`). */
export function intervalsOverlap(a: Interval, b: Interval, tolerance = 0): boolean {
  return a.min <= b.max + tolerance && b.min <= a.max + tolerance;
}

/** The common part [max of mins, min of maxes], or null when the intervals are apart. */
export function intervalIntersection(a: Interval, b: Interval): Interval | null {
  const min = Math.max(a.min, b.min);
  const max = Math.min(a.max, b.max);
  return min <= max ? { min, max } : null;
}
