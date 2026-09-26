/**
 * Vectors, shapes and projections (src/lib/geometry/vec.ts, shapes.ts, interval.ts, clip.ts,
 * closest.ts): the building blocks of the collision tests.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { closestPointOnSegment, closestPointsBetweenPolygons } from '../src/lib/geometry/closest.ts';
import { convexIntersection } from '../src/lib/geometry/clip.ts';
import {
  intervalIntersection,
  intervalPenetration,
  intervalsOverlap,
  projectAabb,
  projectCircle,
  projectPolygon,
} from '../src/lib/geometry/interval.ts';
import {
  aabb,
  aabbCorners,
  aabbFromCenter,
  aabbOfPolygon,
  centroid,
  circle,
  closestPointOnAabb,
  isConvex,
  isDegenerate,
  orientedRect,
  pointInConvexPolygon,
  pointInTriangle,
  polygonArea,
  regularPolygon,
  rotatePolygon,
  signedArea,
  toCounterClockwise,
  translatePolygon,
  triangle,
  triangleCentroid,
  triangleSignedArea,
} from '../src/lib/geometry/shapes.ts';
import {
  EPSILON,
  ZERO,
  add,
  cross,
  distance,
  dot,
  length,
  nearlyEqual,
  normalize,
  perp,
  rotate,
  rotateAbout,
  toleranceFor,
  vec,
  vecNearlyEqual,
  type Vec,
} from '../src/lib/geometry/vec.ts';

const close = (actual: number, expected: number, tolerance = 1e-9, message?: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, message ?? `expected ${expected}, got ${actual}`);

const closeVec = (actual: Vec, expected: Vec, tolerance = 1e-9) =>
  assert.ok(
    Math.abs(actual.x - expected.x) <= tolerance && Math.abs(actual.y - expected.y) <= tolerance,
    `expected (${expected.x}, ${expected.y}), got (${actual.x}, ${actual.y})`,
  );

/** Same vertex set, whatever the starting vertex and orientation. */
function samePolygon(actual: readonly Vec[], expected: readonly Vec[], tolerance = 1e-9): void {
  assert.equal(actual.length, expected.length);
  for (const p of expected) {
    assert.ok(
      actual.some((q) => Math.abs(p.x - q.x) <= tolerance && Math.abs(p.y - q.y) <= tolerance),
      `vertex (${p.x}, ${p.y}) missing from ${JSON.stringify(actual)}`,
    );
  }
}

// ---------------------------------------------------------------- vectors

test('vector arithmetic', () => {
  const a = vec(3, 4);
  const b = vec(-1, 2);
  assert.deepEqual(add(a, b), vec(2, 6));
  assert.equal(dot(a, b), 5);
  assert.equal(cross(a, b), 10);
  assert.equal(cross(b, a), -10);
  assert.equal(length(a), 5);
  assert.equal(distance(a, b), Math.hypot(4, 2));
  assert.deepEqual(perp(vec(1, 0)), vec(-0, 1));
  assert.equal(dot(perp(a), a), 0);
  closeVec(normalize(a), vec(0.6, 0.8));
});

test('normalize returns the zero vector for a zero-length (or tiny) vector', () => {
  assert.equal(normalize(vec(0, 0)), ZERO);
  assert.equal(normalize(vec(1e-12, 0), 1e-9), ZERO);
  closeVec(normalize(vec(1e-12, 0)), vec(1, 0));
});

test('rotation by π/2 is exact only up to rounding: cos(π/2) is 6e-17, not 0', () => {
  const turned = rotate(vec(1, 0), Math.PI / 2);
  assert.notEqual(turned.x, 0, 'if this ever becomes exact, the tolerance tests below lose their point');
  assert.ok(Math.abs(turned.x) < 1e-16);
  assert.equal(turned.y, 1);
  assert.ok(vecNearlyEqual(turned, vec(0, 1)));
  // Four quarter turns come back to the start within the tolerance.
  let v = vec(3, -7);
  for (let i = 0; i < 4; i++) v = rotate(v, Math.PI / 2);
  assert.ok(vecNearlyEqual(v, vec(3, -7)));
  // Rotation keeps lengths and turns the right way (+x towards +y).
  close(length(rotate(vec(3, 4), 1.234)), 5);
  assert.ok(cross(vec(1, 0), rotate(vec(1, 0), 0.3)) > 0);
  closeVec(rotateAbout(vec(2, 1), Math.PI, vec(1, 1)), vec(0, 1));
});

test('the tolerance grows with the size of the coordinates', () => {
  assert.equal(toleranceFor(), EPSILON);
  assert.equal(toleranceFor(0.5), EPSILON);
  assert.equal(toleranceFor(-2000, 3), 2000 * EPSILON);
  assert.ok(nearlyEqual(0.1 + 0.2, 0.3));
  assert.notEqual(0.1 + 0.2, 0.3);
  // Four units in the last place of 1e7 are ~9e-9: beyond an absolute 1e-9, within the relative
  // tolerance (1e-9 × 1e7 = 0.01).
  const drifted = 1e7 * (1 + 4 * Number.EPSILON);
  assert.ok(drifted - 1e7 > 1e-9);
  assert.ok(nearlyEqual(drifted, 1e7));
  assert.ok(!nearlyEqual(1.001, 1));
});

// ---------------------------------------------------------------- boxes and circles

test('boxes: corners in any order, centre form, corners with positive area', () => {
  assert.deepEqual(aabb(10, 8, 2, 4), { min: vec(2, 4), max: vec(10, 8) });
  assert.deepEqual(aabbFromCenter(vec(5, 5), 2, -3), { min: vec(3, 2), max: vec(7, 8) });
  const corners = aabbCorners(aabb(0, 0, 4, 2));
  assert.equal(signedArea(corners), 8);
  assert.deepEqual(aabbOfPolygon(corners), aabb(0, 0, 4, 2));
});

test('the closest point of a box clamps each coordinate', () => {
  const box = aabb(0, 0, 10, 6);
  assert.deepEqual(closestPointOnAabb(box, vec(13, 3)), vec(10, 3)); // face region
  assert.deepEqual(closestPointOnAabb(box, vec(-4, -5)), vec(0, 0)); // corner region
  assert.deepEqual(closestPointOnAabb(box, vec(4, 2)), vec(4, 2)); // inside: unchanged
});

test('circles reject negative radii', () => {
  assert.throws(() => circle(vec(0, 0), -1), RangeError);
  assert.throws(() => circle(vec(0, 0), Number.NaN), RangeError);
  assert.equal(circle(vec(0, 0), 0).radius, 0);
});

// ---------------------------------------------------------------- polygons

test('signed area, orientation and centroid', () => {
  const square = [vec(0, 0), vec(2, 0), vec(2, 2), vec(0, 2)];
  assert.equal(signedArea(square), 4);
  assert.equal(signedArea([...square].reverse()), -4);
  assert.equal(signedArea(toCounterClockwise([...square].reverse())), 4);
  assert.deepEqual(centroid(square), vec(1, 1));
  // An L of three unit squares: centroid ((0.5 + 1.5 + 0.5) / 3, (0.5 + 0.5 + 1.5) / 3).
  const ell = [vec(0, 0), vec(2, 0), vec(2, 1), vec(1, 1), vec(1, 2), vec(0, 2)];
  closeVec(centroid(ell), vec(5 / 6, 5 / 6));
  // Far from the origin the centroid stays accurate.
  closeVec(centroid(translatePolygon(square, vec(1e7, -1e7))), vec(1e7 + 1, -1e7 + 1), 1e-6);
  // Degenerate polygons fall back to the vertex mean.
  assert.deepEqual(centroid([vec(0, 0), vec(4, 0)]), vec(2, 0));
  assert.deepEqual(centroid([vec(0, 0), vec(2, 0), vec(4, 0)]), vec(2, 0));
  assert.ok(isDegenerate([vec(0, 0), vec(2, 0), vec(4, 0)]));
  assert.ok(isDegenerate([vec(1, 1)]));
  assert.ok(!isDegenerate(square));
});

test('convexity', () => {
  assert.ok(isConvex([vec(0, 0), vec(2, 0), vec(2, 2), vec(0, 2)]));
  assert.ok(isConvex([vec(0, 2), vec(2, 2), vec(2, 0), vec(0, 0)]), 'either orientation');
  assert.ok(isConvex(regularPolygon(vec(0, 0), 1, 7)));
  assert.ok(isConvex([vec(0, 0), vec(1, 0), vec(2, 0), vec(2, 2), vec(0, 2)]), 'collinear vertex');
  assert.ok(isConvex([vec(0, 0), vec(1, 1)]), 'a segment is a (flat) convex set');
  assert.ok(!isConvex([vec(0, 0), vec(2, 0), vec(2, 1), vec(1, 1), vec(1, 2), vec(0, 2)]), 'an L');
  const star = [0, 2, 4, 1, 3].map((k) => rotate(vec(1, 0), (2 * Math.PI * k) / 5));
  assert.ok(!isConvex(star), 'a pentagram turns the same way at every vertex but winds twice');
});

test('oriented rectangles: rotation about the centre, and a quarter turn swaps the sides', () => {
  const c = vec(5, -3);
  samePolygon(orientedRect(c, 2, 1), aabbCorners(aabbFromCenter(c, 2, 1)));
  const quarter = orientedRect(c, 2, 1, Math.PI / 2);
  samePolygon(quarter, aabbCorners(aabbFromCenter(c, 1, 2)));
  const box = aabbOfPolygon(quarter);
  assert.ok(vecNearlyEqual(box.min, vec(4, -5)) && vecNearlyEqual(box.max, vec(6, -1)));
  // The same rectangle rotated by π/2 with rotatePolygon.
  samePolygon(rotatePolygon(orientedRect(c, 2, 1), Math.PI / 2), quarter);
  // Area and centroid survive any rotation.
  const tilted = orientedRect(c, 3, 0.5, 0.7);
  close(polygonArea(tilted), 6);
  closeVec(centroid(tilted), c);
  assert.ok(signedArea(tilted) > 0);
});

test('regular polygons: vertices on the circumcircle, area n/2 · r² · sin(2π/n)', () => {
  for (const n of [3, 4, 5, 6, 12]) {
    const poly = regularPolygon(vec(1, 2), 3, n, 0.2);
    assert.equal(poly.length, n);
    for (const p of poly) close(distance(p, vec(1, 2)), 3);
    close(signedArea(poly), (n / 2) * 9 * Math.sin((2 * Math.PI) / n));
  }
  assert.throws(() => regularPolygon(vec(0, 0), 1, 2), RangeError);
  assert.throws(() => regularPolygon(vec(0, 0), 1, 4.5), RangeError);
});

test('triangles: orientation, area, centroid and point containment', () => {
  const a = vec(0, 0);
  const b = vec(4, 0);
  const c = vec(0, 3);
  assert.equal(triangleSignedArea(a, b, c), 6);
  assert.equal(triangleSignedArea(a, c, b), -6);
  assert.ok(signedArea(triangle(a, c, b)) > 0, 'triangle() fixes the orientation');
  assert.deepEqual(triangleCentroid(a, b, c), vec(4 / 3, 1));
  closeVec(centroid(triangle(a, b, c)), vec(4 / 3, 1));

  assert.ok(pointInTriangle(vec(1, 1), a, b, c));
  assert.ok(pointInTriangle(vec(1, 1), c, b, a), 'either orientation');
  assert.ok(!pointInTriangle(vec(3, 3), a, b, c));
  assert.ok(pointInTriangle(vec(2, 0), a, b, c), 'on an edge counts (closed set)');
  assert.ok(pointInTriangle(vec(4, 0), a, b, c), 'on a vertex counts');
  assert.ok(pointInTriangle(vec(2, 1.5), a, b, c), 'on the hypotenuse');
  assert.ok(!pointInTriangle(vec(2, 1.5 + 1e-6), a, b, c));
  assert.ok(pointInTriangle(vec(2, 1.5 + 1e-6), a, b, c, 1e-5), 'within a looser tolerance');
  // A degenerate (flat) triangle contains exactly the points of its segment.
  assert.ok(pointInTriangle(vec(1, 1), vec(0, 0), vec(1, 1), vec(2, 2)));
  assert.ok(!pointInTriangle(vec(3, 3), vec(0, 0), vec(1, 1), vec(2, 2)));
  assert.ok(!pointInTriangle(vec(1, 1.1), vec(0, 0), vec(1, 1), vec(2, 2)));
});

test('points in convex polygons, including flat ones', () => {
  const hexagon = regularPolygon(vec(0, 0), 2, 6);
  assert.ok(pointInConvexPolygon(vec(0, 0), hexagon));
  assert.ok(pointInConvexPolygon(vec(2, 0), hexagon));
  assert.ok(!pointInConvexPolygon(vec(2.01, 0), hexagon));
  assert.ok(pointInConvexPolygon(vec(1, 1), [vec(0, 0), vec(2, 2)]));
  assert.ok(!pointInConvexPolygon(vec(3, 3), [vec(0, 0), vec(2, 2)]));
  assert.ok(pointInConvexPolygon(vec(1, 1), [vec(1, 1)]));
  assert.ok(!pointInConvexPolygon(vec(1, 1), []));
});

// ---------------------------------------------------------------- projections

test('projections of polygons, boxes and circles', () => {
  const square = aabbCorners(aabb(0, 0, 2, 2));
  const diagonal = normalize(vec(1, 1));
  const shadow = projectPolygon(square, diagonal);
  close(shadow.min, 0);
  close(shadow.max, 2 * Math.SQRT2);
  // Projecting a box directly gives the same interval as projecting its corners.
  for (const angle of [0, 0.3, 1, 2, 4]) {
    const axis = rotate(vec(1, 0), angle);
    const box = aabb(-1, 2, 5, 3);
    const direct = projectAabb(box, axis);
    const corners = projectPolygon(aabbCorners(box), axis);
    close(direct.min, corners.min);
    close(direct.max, corners.max);
  }
  assert.deepEqual(projectCircle(circle(vec(3, 4), 2), vec(0, 1)), { min: 2, max: 6 });
  assert.throws(() => projectPolygon([], vec(1, 0)), RangeError);
});

test('interval penetration: overlap, touching, gap and containment', () => {
  const a = { min: 0, max: 10 };
  assert.deepEqual(intervalPenetration(a, { min: 8, max: 15 }), { overlap: 2, direction: 1 });
  assert.deepEqual(intervalPenetration(a, { min: -5, max: 1 }), { overlap: 1, direction: -1 });
  assert.deepEqual(intervalPenetration(a, { min: 10, max: 12 }), { overlap: 0, direction: 1 });
  assert.deepEqual(intervalPenetration(a, { min: 13, max: 20 }), { overlap: -3, direction: 1 });
  assert.deepEqual(intervalPenetration(a, { min: -9, max: -4 }), { overlap: -4, direction: -1 });
  // Nested (the post's example): [3, 5] must travel 7 to the right (left end 3 → 10) or 5 to the
  // left (right end 5 → 0), although only 2 units overlap. The cheaper push, left, wins.
  assert.deepEqual(intervalPenetration(a, { min: 3, max: 5 }), { overlap: 5, direction: -1 });
  // The same shadow nearer the right end: now the push to the right is the cheaper one.
  assert.deepEqual(intervalPenetration(a, { min: 5, max: 7 }), { overlap: 5, direction: 1 });
  assert.deepEqual(intervalPenetration(a, { min: 6, max: 8 }), { overlap: 4, direction: 1 });
  // A tie (B centred on A) goes the way the caller asks.
  assert.deepEqual(intervalPenetration(a, { min: 4, max: 6 }, -1), { overlap: 6, direction: -1 });
  assert.ok(intervalsOverlap(a, { min: 10, max: 11 }));
  assert.ok(!intervalsOverlap(a, { min: 10.5, max: 11 }));
  assert.ok(intervalsOverlap(a, { min: 10.5, max: 11 }, 0.5));
  assert.deepEqual(intervalIntersection(a, { min: 8, max: 15 }), { min: 8, max: 10 });
  assert.equal(intervalIntersection(a, { min: 11, max: 15 }), null);
});

// ---------------------------------------------------------------- clipping and closest points

test('convex intersection by clipping', () => {
  const a = aabbCorners(aabb(0, 0, 4, 4));
  const overlap = convexIntersection(a, aabbCorners(aabb(2, 1, 6, 3)));
  samePolygon(overlap, aabbCorners(aabb(2, 1, 4, 3)));
  close(polygonArea(overlap), 4);
  // Nested: the inner polygon itself (either argument order).
  const inner = triangle(vec(1, 1), vec(3, 1), vec(2, 3));
  samePolygon(convexIntersection(a, inner), inner);
  samePolygon(convexIntersection(inner, a), inner);
  // Apart: empty. Touching along an edge: a flat polygon (the shared segment).
  assert.deepEqual(convexIntersection(a, aabbCorners(aabb(5, 0, 6, 1))), []);
  const edge = convexIntersection(a, aabbCorners(aabb(4, 1, 6, 3)));
  assert.ok(edge.length >= 2);
  close(polygonArea(edge), 0);
  for (const p of edge) close(p.x, 4);
  // A diamond over a square: an octagon of known area 4² − 4 · ½ · 1² = 14.
  const diamond = regularPolygon(vec(2, 2), 3, 4, 0);
  close(polygonArea(convexIntersection(a, diamond)), 14);
});

test('closest points on segments and between polygons', () => {
  assert.deepEqual(closestPointOnSegment(vec(1, 5), vec(0, 0), vec(4, 0)), vec(1, 0));
  assert.deepEqual(closestPointOnSegment(vec(-3, 1), vec(0, 0), vec(4, 0)), vec(0, 0));
  assert.deepEqual(closestPointOnSegment(vec(9, 1), vec(0, 0), vec(4, 0)), vec(4, 0));
  assert.deepEqual(closestPointOnSegment(vec(9, 1), vec(2, 2), vec(2, 2)), vec(2, 2));

  const square = aabbCorners(aabb(0, 0, 2, 2));
  const tri = triangle(vec(5, 1), vec(8, 0), vec(8, 3));
  const pair = closestPointsBetweenPolygons(square, tri);
  assert.equal(pair.distance, 3);
  assert.deepEqual(pair.a, vec(2, 1));
  assert.deepEqual(pair.b, vec(5, 1));
  // Corner to corner.
  const far = closestPointsBetweenPolygons(square, aabbCorners(aabb(5, 6, 7, 8)));
  assert.equal(far.distance, 5);
  assert.deepEqual([far.a, far.b], [vec(2, 2), vec(5, 6)]);
  // A single point against a polygon.
  assert.equal(closestPointsBetweenPolygons([vec(1, 5)], square).distance, 3);
});
