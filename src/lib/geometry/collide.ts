/**
 * Narrow-phase collision tests between pairs of 2D shapes: box–box, circle–circle, box–circle
 * and convex polygon–polygon with the separating axis theorem (SAT).
 *
 * Conventions shared by every test (see shapes.ts for the shapes themselves):
 * - Shapes are closed sets. Shapes that only share boundary points TOUCH, and touching counts as
 *   a hit: `relation` is 'touching', `hit` is true, and depth and MTV are zero.
 * - "Touching" is decided with a tolerance, because a configuration that is exactly touching on
 *   paper is rarely exact in floating point (0.1 + 0.2 ≠ 0.3). An overlap within ±tolerance is
 *   touching. The default is EPSILON relative to the size of the coordinates (vec.ts); pass
 *   `{ tolerance }` in the units of the scene, e.g. half a pixel for what a person can see.
 * - `normal` is a unit vector pointing from A (the first shape) towards B (the second).
 * - `mtv`, the minimum translation vector, is the shortest translation of B that ends the
 *   overlap (afterwards the shapes touch): normal × depth. Moving A by −mtv works as well, and
 *   a physics step often moves each body part of the way.
 * - When the shapes are apart, `distance` is the Euclidean distance between them and `closest`
 *   the pair of points that realises it; otherwise they are 0 and null.
 *
 * Pure module, erasable TypeScript only. No test allocates more than a few small arrays.
 */
import { closestPointsBetweenPolygons, type ClosestPair } from './closest.ts';
import { convexIntersection } from './clip.ts';
import { intervalIntersection, intervalPenetration, projectPolygon, type Interval } from './interval.ts';
import {
  aabbCenter,
  centroid,
  closestPointOnAabb,
  isDegenerate,
  signedArea,
  type Aabb,
  type Circle,
  type Polygon,
} from './shapes.ts';
import {
  EPSILON,
  ZERO,
  add,
  cross,
  dot,
  magnitudeOf,
  midpoint,
  neg,
  normalize,
  scale,
  sub,
  toleranceFor,
  vec,
  type Vec,
} from './vec.ts';

export type Relation = 'separated' | 'touching' | 'overlapping';

export interface CollisionOptions {
  /** Overlaps within ±tolerance count as touching (same units as the coordinates). */
  tolerance?: number;
}

export interface Collision {
  readonly relation: Relation;
  /** The shapes share at least one point (touching or overlapping). */
  readonly hit: boolean;
  /** Penetration depth: |mtv|. Zero unless the shapes overlap. */
  readonly depth: number;
  /** Unit vector from A towards B: the direction of the MTV, or of the gap when apart. */
  readonly normal: Vec;
  /** Minimum translation vector: move B by it (or A by its opposite) to end the overlap. */
  readonly mtv: Vec;
  /** A representative contact point when the shapes touch or overlap. */
  readonly contact: Vec | null;
  /** Distance between the shapes when they are apart, else 0. */
  readonly distance: number;
  /** Nearest points of A and B when they are apart, else null. */
  readonly closest: ClosestPair | null;
}

/** Sorts a signed overlap into the three relations (see the tolerance note above). */
export function classify(overlap: number, tolerance: number): Relation {
  if (overlap < -tolerance) return 'separated';
  if (overlap <= tolerance) return 'touching';
  return 'overlapping';
}

function hitResult(relation: Relation, overlap: number, normal: Vec, contact: Vec): Collision {
  const depth = relation === 'overlapping' ? overlap : 0;
  return {
    relation,
    hit: true,
    depth,
    normal,
    mtv: depth > 0 ? scale(normal, depth) : ZERO,
    contact,
    distance: 0,
    closest: null,
  };
}

function apartResult(closest: ClosestPair, fallbackNormal: Vec): Collision {
  const normal = normalize(sub(closest.b, closest.a));
  return {
    relation: 'separated',
    hit: false,
    depth: 0,
    normal: normal === ZERO ? fallbackNormal : normal,
    mtv: ZERO,
    contact: null,
    distance: closest.distance,
    closest,
  };
}

const sign = (value: number): 1 | -1 => (value < 0 ? -1 : 1);

// ---------------------------------------------------------------- AABB vs AABB

export interface AabbCollision extends Collision {
  /** Signed overlap of the shadows on x and on y (negative: the gap on that axis). */
  readonly overlapX: number;
  readonly overlapY: number;
  /** The overlapping region when the boxes touch or overlap (possibly flat), else null. */
  readonly intersection: Aabb | null;
}

/**
 * Two axis-aligned boxes collide exactly when their shadows overlap on BOTH axes:
 *
 *   A.min.x ≤ B.max.x  and  B.min.x ≤ A.max.x  and  A.min.y ≤ B.max.y  and  B.min.y ≤ A.max.y.
 *
 * The MTV runs along the axis that needs the shorter push (x wins a tie). This is the separating
 * axis theorem with the two axes a box has.
 */
export function aabbVsAabb(a: Aabb, b: Aabb, options: CollisionOptions = {}): AabbCollision {
  const tolerance =
    options.tolerance ?? toleranceFor(magnitudeOf([a.min, a.max, b.min, b.max]));
  const ca = aabbCenter(a);
  const cb = aabbCenter(b);
  const ax: Interval = { min: a.min.x, max: a.max.x };
  const bx: Interval = { min: b.min.x, max: b.max.x };
  const ay: Interval = { min: a.min.y, max: a.max.y };
  const by: Interval = { min: b.min.y, max: b.max.y };
  const px = intervalPenetration(ax, bx, sign(cb.x - ca.x));
  const py = intervalPenetration(ay, by, sign(cb.y - ca.y));
  const extra = { overlapX: px.overlap, overlapY: py.overlap };

  if (px.overlap < -tolerance || py.overlap < -tolerance) {
    // Nearest points: across the gap on a separated axis, mid-overlap on an overlapping one.
    const nearest = (ia: Interval, ib: Interval): [number, number] => {
      const common = intervalIntersection(ia, ib);
      if (common) return [(common.min + common.max) / 2, (common.min + common.max) / 2];
      return ib.min > ia.max ? [ia.max, ib.min] : [ia.min, ib.max];
    };
    const [xa, xb] = nearest(ax, bx);
    const [ya, yb] = nearest(ay, by);
    const pa = vec(xa, ya);
    const pb = vec(xb, yb);
    const closest = { a: pa, b: pb, distance: Math.hypot(xb - xa, yb - ya) };
    const fallback = px.overlap <= py.overlap ? vec(px.direction, 0) : vec(0, py.direction);
    return { ...apartResult(closest, fallback), ...extra, intersection: null };
  }

  const useX = px.overlap <= py.overlap;
  const overlap = useX ? px.overlap : py.overlap;
  const normal = useX ? vec(px.direction, 0) : vec(0, py.direction);
  const intersection: Aabb = {
    min: vec(Math.max(a.min.x, b.min.x), Math.max(a.min.y, b.min.y)),
    max: vec(Math.min(a.max.x, b.max.x), Math.min(a.max.y, b.max.y)),
  };
  const contact = aabbCenter(intersection);
  return { ...hitResult(classify(overlap, tolerance), overlap, normal, contact), ...extra, intersection };
}

// ---------------------------------------------------------------- circle vs circle

export interface CircleCollision extends Collision {
  /** |c_B − c_A| */
  readonly centerDistance: number;
  /** r_A + r_B */
  readonly radiusSum: number;
}

/**
 * Two discs collide exactly when the distance between their centres is at most the sum of their
 * radii. The overlap along the line of centres is r_A + r_B − |c_B − c_A|; the normal is that
 * line's direction. Concentric discs have no such line: the normal is then +x by convention.
 * The contact point is halfway between the two deepest points, c_A + r_A n and c_B − r_B n.
 */
export function circleVsCircle(a: Circle, b: Circle, options: CollisionOptions = {}): CircleCollision {
  const tolerance =
    options.tolerance ?? toleranceFor(magnitudeOf([a.center, b.center]), a.radius, b.radius);
  const delta = sub(b.center, a.center);
  const centerDistance = Math.hypot(delta.x, delta.y);
  const radiusSum = a.radius + b.radius;
  const normal = centerDistance > 0 ? scale(delta, 1 / centerDistance) : vec(1, 0);
  const onA = add(a.center, scale(normal, a.radius));
  const onB = sub(b.center, scale(normal, b.radius));
  const overlap = radiusSum - centerDistance;
  const relation = classify(overlap, tolerance);
  const extra = { centerDistance, radiusSum };
  if (relation === 'separated') {
    return { ...apartResult({ a: onA, b: onB, distance: -overlap }, normal), ...extra };
  }
  return { ...hitResult(relation, overlap, normal, midpoint(onA, onB)), ...extra };
}

// ---------------------------------------------------------------- box vs circle

/** A face of a box, named by the coordinate that is constant on it. */
export type AabbFace = 'min-x' | 'max-x' | 'min-y' | 'max-y';

export interface AabbCircleCollision extends Collision {
  /** The point of the box nearest to the circle's centre: clamp(c, min, max). */
  readonly clamped: Vec;
  /** |c − clamped|: the distance from the centre to the box (0 when the centre is inside). */
  readonly clampDistance: number;
  /** The centre lies in the box (boundary included), so clamping leaves it where it is. */
  readonly inside: boolean;
  /** When the centre is inside: the face it leaves through (the nearest one), else null. */
  readonly face: AabbFace | null;
}

/**
 * A box and a disc collide exactly when the point p of the box nearest to the centre c is within
 * the radius: |c − p| ≤ r. The nearest point is found coordinate by coordinate,
 * p = (clamp(c.x, min.x, max.x), clamp(c.y, min.y, max.y)), because the squared distance
 * (c.x − p.x)² + (c.y − p.y)² splits into two terms that can be minimised independently.
 *
 * If the centre is inside the box, p = c and the line c − p gives no direction. The circle must
 * then leave through the nearest face (ties: min-x, max-x, min-y, max-y): the depth is r plus the
 * distance from c to that face, and the normal is the face's outward normal.
 *
 * `normal` and `mtv` push the CIRCLE (B) out of the box (A).
 */
export function aabbVsCircle(box: Aabb, disc: Circle, options: CollisionOptions = {}): AabbCircleCollision {
  const c = disc.center;
  const r = disc.radius;
  const tolerance = options.tolerance ?? toleranceFor(magnitudeOf([box.min, box.max, c]), r);
  const clamped = closestPointOnAabb(box, c);
  const delta = sub(c, clamped);
  const dist = Math.hypot(delta.x, delta.y);

  if (dist > tolerance) {
    const normal = scale(delta, 1 / dist);
    const overlap = r - dist;
    const relation = classify(overlap, tolerance);
    const extra = { clamped, clampDistance: dist, inside: false, face: null };
    if (relation === 'separated') {
      return { ...apartResult({ a: clamped, b: sub(c, scale(normal, r)), distance: -overlap }, normal), ...extra };
    }
    return { ...hitResult(relation, overlap, normal, clamped), ...extra };
  }

  const faces: [AabbFace, number, Vec, Vec][] = [
    ['min-x', c.x - box.min.x, vec(-1, 0), vec(box.min.x, c.y)],
    ['max-x', box.max.x - c.x, vec(1, 0), vec(box.max.x, c.y)],
    ['min-y', c.y - box.min.y, vec(0, -1), vec(c.x, box.min.y)],
    ['max-y', box.max.y - c.y, vec(0, 1), vec(c.x, box.max.y)],
  ];
  let nearest = faces[0]!;
  for (const face of faces) if (face[1] < nearest[1]) nearest = face;
  const [face, faceDistance, normal, onFace] = nearest;
  // The centre may sit a hair outside the box (dist ≤ tolerance): never let that shrink the depth.
  const overlap = r + Math.max(0, faceDistance);
  return {
    ...hitResult(classify(overlap, tolerance), overlap, normal, onFace),
    clamped,
    clampDistance: dist,
    inside: true,
    face,
  };
}

/** The same test with the circle as A and the box as B: normal and MTV now push the box. */
export function circleVsAabb(disc: Circle, box: Aabb, options: CollisionOptions = {}): AabbCircleCollision {
  const result = aabbVsCircle(box, disc, options);
  return {
    ...result,
    normal: neg(result.normal),
    mtv: result.depth > 0 ? neg(result.mtv) : ZERO,
    closest: result.closest ? { a: result.closest.b, b: result.closest.a, distance: result.closest.distance } : null,
  };
}

// ---------------------------------------------------------------- SAT for convex polygons

export interface PolygonAxis {
  /** Unit outward normal of the edge (for a flat polygon: a normal or the direction of the line). */
  readonly axis: Vec;
  /** Index i of the edge from vertex i to vertex i + 1, or −1 for an axis that is not an edge normal. */
  readonly edge: number;
}

/**
 * The candidate separating axes a polygon contributes: the unit outward normals of its edges,
 * one per direction (a rectangle has 4 edges but only 2 directions; a triangle has 3).
 * Zero-length edges are skipped. A flat polygon (a segment) also contributes the direction of its
 * line: two segments on one line can only be told apart along it.
 */
export function polygonAxes(poly: Polygon): PolygonAxis[] {
  const orientation = signedArea(poly) < 0 ? -1 : 1;
  const axes: PolygonAxis[] = [];
  const addAxis = (axis: Vec, edge: number) => {
    if (axis === ZERO) return;
    if (axes.some((known) => Math.abs(cross(known.axis, axis)) <= EPSILON)) return;
    axes.push({ axis, edge });
  };
  let longest = ZERO;
  let longestLength = 0;
  for (let i = 0; i < poly.length; i++) {
    const edge = sub(poly[(i + 1) % poly.length]!, poly[i]!);
    const len = Math.hypot(edge.x, edge.y);
    if (len === 0) continue;
    if (len > longestLength) {
      longest = edge;
      longestLength = len;
    }
    // Outward normal: to the right of the edge for positive area, to the left otherwise.
    addAxis(scale(vec(edge.y, -edge.x), orientation / len), i);
  }
  if (poly.length >= 2 && isDegenerate(poly) && longestLength > 0) addAxis(scale(longest, 1 / longestLength), -1);
  return axes;
}

export interface SatAxis extends PolygonAxis {
  /** Which polygon's edge the axis comes from. */
  readonly source: 'a' | 'b';
  /** The shadows of A and B on the axis. */
  readonly a: Interval;
  readonly b: Interval;
  /** Signed overlap of the shadows (see intervalPenetration): < 0 is a gap. */
  readonly overlap: number;
  /** Which way along the axis B should move to leave A: +1 or −1. */
  readonly direction: 1 | -1;
  /** The shadows are apart on this axis (by more than the tolerance). */
  readonly separating: boolean;
  /** Parallel to an axis earlier in the list (from the other polygon): it adds no information. */
  readonly duplicate: boolean;
}

export interface SatCollision extends Collision {
  /** Every candidate axis with its shadows: A's axes first, then B's. */
  readonly axes: readonly SatAxis[];
  /** Index in `axes` of the axis with the widest gap, or −1 when no axis separates. */
  readonly separatingAxis: number;
  /** Index in `axes` of the axis of least penetration (the MTV's), or −1 when apart. */
  readonly mtvAxis: number;
  /** The overlapping region A ∩ B when the shapes touch or overlap, else empty. */
  readonly intersection: Polygon;
}

function candidateAxes(a: Polygon, b: Polygon): { axis: Vec; edge: number; source: 'a' | 'b'; duplicate: boolean }[] {
  const fromA = polygonAxes(a).map((entry) => ({ ...entry, source: 'a' as const, duplicate: false }));
  const fromB = polygonAxes(b).map((entry) => ({
    ...entry,
    source: 'b' as const,
    duplicate: fromA.some((known) => Math.abs(cross(known.axis, entry.axis)) <= EPSILON),
  }));
  const axes = [...fromA, ...fromB];
  if (axes.length === 0) {
    // Both polygons are single points: the line through them is the only useful axis.
    const between = normalize(sub(centroid(b), centroid(a)));
    axes.push({ axis: between === ZERO ? vec(1, 0) : between, edge: -1, source: 'a', duplicate: false });
  }
  return axes;
}

function checkPolygons(a: Polygon, b: Polygon): void {
  if (a.length === 0 || b.length === 0) throw new RangeError('SAT: a polygon needs at least one vertex');
}

/**
 * Separating axis theorem for two CONVEX polygons (segments and points included).
 *
 * Two convex shapes are disjoint exactly when some line separates them; for polygons one of the
 * lines to try is always perpendicular to an edge, so it suffices to project both polygons onto
 * each edge normal and look for a gap. If no axis has a gap the polygons intersect, and the
 * axis of least overlap gives the MTV (the depth is exact, not an estimate: see the blog post).
 *
 * This version projects onto every axis so that a figure can show them all: O((n + m)²) for
 * polygons with n and m vertices. `polygonsIntersect` stops at the first gap.
 *
 * For a concave polygon the answer can be wrong (a false "hit"): split it into convex pieces.
 */
export function polygonVsPolygon(a: Polygon, b: Polygon, options: CollisionOptions = {}): SatCollision {
  checkPolygons(a, b);
  const tolerance = options.tolerance ?? toleranceFor(magnitudeOf(a), magnitudeOf(b));
  const between = sub(centroid(b), centroid(a));
  const axes: SatAxis[] = candidateAxes(a, b).map((candidate) => {
    const ia = projectPolygon(a, candidate.axis);
    const ib = projectPolygon(b, candidate.axis);
    const { overlap, direction } = intervalPenetration(ia, ib, sign(dot(between, candidate.axis)));
    return { ...candidate, a: ia, b: ib, overlap, direction, separating: overlap < -tolerance };
  });

  let separatingAxis = -1;
  let mtvAxis = 0;
  axes.forEach((entry, index) => {
    if (entry.separating && (separatingAxis < 0 || entry.overlap < axes[separatingAxis]!.overlap)) separatingAxis = index;
    if (entry.overlap < axes[mtvAxis]!.overlap) mtvAxis = index;
  });

  if (separatingAxis >= 0) {
    const gapAxis = axes[separatingAxis]!;
    const result = apartResult(closestPointsBetweenPolygons(a, b), scale(gapAxis.axis, gapAxis.direction));
    return { ...result, axes, separatingAxis, mtvAxis: -1, intersection: [] };
  }

  const best = axes[mtvAxis]!;
  const normal = scale(best.axis, best.direction);
  const intersection = convexIntersection(a, b);
  const contact = intersection.length > 0 ? centroid(intersection) : midpoint(centroid(a), centroid(b));
  return {
    ...hitResult(classify(best.overlap, tolerance), best.overlap, normal, contact),
    axes,
    separatingAxis,
    mtvAxis,
    intersection,
  };
}

/**
 * The yes/no version of the SAT test: true when the convex polygons touch or overlap. It stops
 * at the first axis with a gap and computes no MTV, contact point or report. The axes are not
 * normalised (whether the shadows overlap does not depend on the length of the axis); the
 * tolerance, a distance, is scaled by that length instead.
 */
export function polygonsIntersect(a: Polygon, b: Polygon, options: CollisionOptions = {}): boolean {
  checkPolygons(a, b);
  const tolerance = options.tolerance ?? toleranceFor(magnitudeOf(a), magnitudeOf(b));
  const test = (poly: Polygon): boolean | undefined => {
    for (let i = 0; i < poly.length; i++) {
      const edge = sub(poly[(i + 1) % poly.length]!, poly[i]!);
      const axis = vec(edge.y, -edge.x);
      const len = Math.hypot(edge.x, edge.y);
      if (len === 0) continue;
      const ia = projectPolygon(a, axis);
      const ib = projectPolygon(b, axis);
      if (ia.max < ib.min - tolerance * len || ib.max < ia.min - tolerance * len) return false;
    }
    return undefined;
  };
  if (test(a) === false || test(b) === false) return false;
  // Flat polygons and single points need the extra axes of the full test.
  if (isDegenerate(a) || isDegenerate(b)) return polygonVsPolygon(a, b, options).hit;
  return true;
}
