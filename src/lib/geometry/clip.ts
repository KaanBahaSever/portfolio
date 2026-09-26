/**
 * The intersection of two convex polygons (Sutherland–Hodgman clipping), used to shade the
 * region where two shapes overlap and to place a contact point at its centroid.
 *
 * Pure module, erasable TypeScript only.
 */
import { toCounterClockwise, type Polygon } from './shapes.ts';
import { add, cross, magnitudeOf, scale, sub, toleranceFor, type Vec } from './vec.ts';

/**
 * The convex polygon A ∩ B, with positive signed area; an empty array when the shapes are apart.
 * When they only touch, the result has (almost) no area: the shared segment or point.
 *
 * Sutherland–Hodgman keeps, for each edge of the clipping polygon B in turn, the part of the
 * subject on the inner side of that edge's line; after every edge of B only A ∩ B is left. B
 * must be convex (each of its edge lines then bounds it); A may be any simple polygon, though
 * the result is only guaranteed to be a single polygon when A is convex too. O(n·m).
 */
export function convexIntersection(subject: Polygon, clipper: Polygon): Polygon {
  const size = Math.max(magnitudeOf(subject), magnitudeOf(clipper));
  const tolerance = toleranceFor(size);
  let output: Vec[] = [...toCounterClockwise(subject)];
  const clip = toCounterClockwise(clipper);
  for (let i = 0; i < clip.length && output.length > 0; i++) {
    const a = clip[i]!;
    const b = clip[(i + 1) % clip.length]!;
    const edge = sub(b, a);
    const len = Math.hypot(edge.x, edge.y);
    if (len === 0) continue;
    // Signed distance from the edge line, positive on the inner (left) side.
    const side = (p: Vec) => cross(edge, sub(p, a)) / len;
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const current = input[j]!;
      const next = input[(j + 1) % input.length]!;
      const dc = side(current);
      const dn = side(next);
      const currentIn = dc >= -tolerance;
      const nextIn = dn >= -tolerance;
      if (currentIn) output.push(current);
      // The edge crosses the line strictly: add the crossing point.
      if ((currentIn && dn < -tolerance) || (nextIn && dc < -tolerance)) {
        const t = dc / (dc - dn);
        output.push(add(current, scale(sub(next, current), t)));
      }
    }
  }
  return dedupe(output, tolerance);
}

/** Drops consecutive (and last-to-first) duplicates that clipping produces at shared vertices. */
function dedupe(points: readonly Vec[], tolerance: number): Polygon {
  const result: Vec[] = [];
  for (const p of points) {
    const last = result[result.length - 1];
    if (!last || Math.abs(last.x - p.x) > tolerance || Math.abs(last.y - p.y) > tolerance) result.push(p);
  }
  while (result.length > 1) {
    const first = result[0]!;
    const last = result[result.length - 1]!;
    if (Math.abs(last.x - first.x) > tolerance || Math.abs(last.y - first.y) > tolerance) break;
    result.pop();
  }
  return result;
}
