/**
 * The separating axis theorem for convex polygons (src/lib/geometry/collide.ts): candidate axes,
 * projections, the separating axis, the MTV, degenerate polygons, and the concave case SAT
 * cannot handle. Random convex polygons are checked against an independent brute-force oracle.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { polygonAxes, polygonVsPolygon, polygonsIntersect } from '../src/lib/geometry/collide.ts';
import {
  aabb,
  aabbCorners,
  isConvex,
  orientedRect,
  pointInConvexPolygon,
  polygonArea,
  regularPolygon,
  translatePolygon,
  triangle,
  type Polygon,
} from '../src/lib/geometry/shapes.ts';
import { closestPointsBetweenPolygons } from '../src/lib/geometry/closest.ts';
import { cross, dot, rotate, scale, sub, vec, type Vec } from '../src/lib/geometry/vec.ts';

const close = (actual: number, expected: number, tolerance = 1e-9, message?: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, message ?? `expected ${expected}, got ${actual}`);

const closeVec = (actual: Vec | null, expected: Vec, tolerance = 1e-9) => {
  assert.ok(actual, 'expected a point');
  assert.ok(
    Math.abs(actual.x - expected.x) <= tolerance && Math.abs(actual.y - expected.y) <= tolerance,
    `expected (${expected.x}, ${expected.y}), got (${actual.x}, ${actual.y})`,
  );
};

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The rectangle [0, 4] × [0, 2] and a triangle whose left vertex pokes into it.
const rect = aabbCorners(aabb(0, 0, 4, 2));
const wedge = (tipX: number) => triangle(vec(tipX, 1), vec(tipX + 2.5, 0), vec(tipX + 2.5, 2));

// ---------------------------------------------------------------- candidate axes

test('candidate axes: one unit outward normal per edge direction', () => {
  assert.equal(polygonAxes(rect).length, 2, 'a rectangle has two directions');
  assert.equal(polygonAxes(orientedRect(vec(0, 0), 3, 1, 0.4)).length, 2);
  assert.equal(polygonAxes(wedge(0)).length, 3, 'a triangle has three');
  assert.equal(polygonAxes(regularPolygon(vec(0, 0), 1, 5)).length, 5, 'a pentagon has five');
  assert.equal(polygonAxes(regularPolygon(vec(0, 0), 1, 6)).length, 3, 'a hexagon has three pairs');
  for (const { axis } of polygonAxes(regularPolygon(vec(0, 0), 2, 7, 0.3))) close(Math.hypot(axis.x, axis.y), 1);
  // Outward, whatever the orientation of the input.
  for (const poly of [rect, [...rect].reverse()]) {
    for (const { axis, edge } of polygonAxes(poly)) {
      const midpoint = scale(vec(poly[edge]!.x + poly[(edge + 1) % poly.length]!.x, poly[edge]!.y + poly[(edge + 1) % poly.length]!.y), 0.5);
      assert.ok(dot(sub(midpoint, vec(2, 1)), axis) > 0, 'the normal points away from the centre');
    }
  }
  // A repeated vertex (zero-length edge) adds nothing.
  assert.equal(polygonAxes([vec(0, 0), vec(4, 0), vec(4, 0), vec(4, 2), vec(0, 2)]).length, 2);
  // A segment: its normal and its own direction. A point: nothing.
  const segment = polygonAxes([vec(0, 0), vec(3, 4)]);
  assert.equal(segment.length, 2);
  assert.ok(segment.some(({ axis }) => Math.abs(cross(axis, vec(3, 4))) < 1e-12));
  assert.deepEqual(polygonAxes([vec(1, 1)]), []);
});

// ---------------------------------------------------------------- the three relations

test('SAT: overlapping rectangle and triangle', () => {
  const r = polygonVsPolygon(rect, wedge(3.5));
  assert.equal(r.relation, 'overlapping');
  assert.equal(r.hit, true);
  assert.equal(r.separatingAxis, -1);
  assert.equal(r.axes.length, 5);
  close(r.depth, 0.5);
  closeVec(r.normal, vec(1, 0));
  closeVec(r.mtv, vec(0.5, 0));
  const best = r.axes[r.mtvAxis]!;
  assert.equal(best.source, 'a');
  // The overlap is the small triangle (3.5, 1), (4, 0.8), (4, 1.2); the contact is its centroid.
  close(polygonArea(r.intersection), 0.5 * 0.4 * 0.5);
  closeVec(r.contact, vec((3.5 + 4 + 4) / 3, 1));
  // Every axis reports its shadows and a positive overlap.
  for (const axis of r.axes) {
    assert.ok(axis.overlap > 0);
    assert.ok(!axis.separating);
  }
});

test('SAT: touching at a vertex, then separated with a gap', () => {
  const touching = polygonVsPolygon(rect, wedge(4));
  assert.equal(touching.relation, 'touching');
  assert.equal(touching.depth, 0);
  assert.deepEqual(touching.mtv, vec(0, 0));
  closeVec(touching.contact, vec(4, 1));

  const apart = polygonVsPolygon(rect, wedge(4.5));
  assert.equal(apart.relation, 'separated');
  assert.equal(apart.hit, false);
  assert.equal(apart.mtvAxis, -1);
  assert.deepEqual(apart.intersection, []);
  const separating = apart.axes[apart.separatingAxis]!;
  assert.ok(separating.separating);
  close(separating.overlap, -0.5);
  close(apart.distance, 0.5);
  closeVec(apart.closest?.a ?? null, vec(4, 1));
  closeVec(apart.closest?.b ?? null, vec(4.5, 1));
  closeVec(apart.normal, vec(1, 0));
});

test('SAT: the separating axis is the one with the widest gap, and can come from B', () => {
  // A right triangle off the square's corner, its hypotenuse on the line x + y = 4.5. The
  // shadows overlap on x and on y; only the hypotenuse's normal (1, 1)/√2 finds the gap.
  const square = aabbCorners(aabb(0, 0, 2, 2));
  const tri = triangle(vec(3, 1.5), vec(3, 3), vec(1.5, 3));
  const r = polygonVsPolygon(square, tri);
  assert.equal(r.relation, 'separated');
  const axis = r.axes[r.separatingAxis]!;
  assert.equal(axis.source, 'b');
  closeVec(axis.axis, vec(-Math.SQRT1_2, -Math.SQRT1_2));
  close(axis.overlap, -0.5 / Math.SQRT2);
  for (const other of r.axes) assert.ok(other.overlap >= axis.overlap);
  assert.ok(r.axes.filter((a) => a.source === 'a').every((a) => !a.separating));
  // Here the gap along the separating axis is the whole distance: corner (2, 2) to the hypotenuse.
  close(r.distance, 0.5 / Math.SQRT2);
  closeVec(r.closest?.a ?? null, vec(2, 2));
  closeVec(r.closest?.b ?? null, vec(2.25, 2.25));
});

// ---------------------------------------------------------------- nesting and rotation

test('SAT: a polygon inside another is pushed out through the nearest side', () => {
  const outer = aabbCorners(aabb(0, 0, 10, 10));
  const inner = triangle(vec(1, 4), vec(3, 4), vec(2, 6));
  const r = polygonVsPolygon(outer, inner);
  assert.equal(r.relation, 'overlapping');
  // Out through x = 0 needs 3 (the rightmost vertex x = 3 must reach 0).
  close(r.depth, 3);
  closeVec(r.mtv, vec(-3, 0));
  assert.equal(polygonVsPolygon(outer, translatePolygon(inner, r.mtv)).relation, 'touching');
  close(polygonArea(r.intersection), polygonArea(inner));
});

test('SAT: identical polygons need a full width to separate', () => {
  const r = polygonVsPolygon(rect, rect);
  assert.equal(r.relation, 'overlapping');
  close(r.depth, 2, 1e-12, 'the rectangle is 2 tall');
});

test('SAT: a quarter turn is only exact within the tolerance', () => {
  // [2, 4] × [5, 9] after rotating a 4 × 2 rectangle by π/2; one corner lands on x = 1.9999999999999998.
  const turned = orientedRect(vec(3, 7), 2, 1, Math.PI / 2);
  const left = aabbCorners(aabb(0, 5, 2, 9));
  const strict = polygonVsPolygon(turned, left, { tolerance: 0 });
  assert.equal(strict.relation, 'overlapping', 'without a tolerance the rounding error looks like a collision');
  assert.ok(strict.depth > 0 && strict.depth < 1e-15);
  assert.equal(polygonVsPolygon(turned, left).relation, 'touching');
  // The same pair, turned back by −π/2, is an ordinary side-by-side touch.
  assert.equal(polygonVsPolygon(orientedRect(vec(3, 7), 1, 2, 0), left).relation, 'touching');
});

test('SAT: rotated rectangles (a diamond over a square)', () => {
  const square = aabbCorners(aabb(0, 0, 2, 2));
  // A square of half-side 1 turned by 45°: its corners reach √2 from the centre.
  const diamond = (x: number) => orientedRect(vec(x, 1), 1, 1, Math.PI / 4);
  const r = polygonVsPolygon(square, diamond(3));
  // The left corner is at x = 3 − √2 ≈ 1.586: 0.414 inside the square.
  assert.equal(r.relation, 'overlapping');
  close(r.depth, 2 - (3 - Math.SQRT2));
  closeVec(r.normal, vec(1, 0));
  assert.equal(polygonVsPolygon(square, diamond(2 + Math.SQRT2)).relation, 'touching');
  assert.equal(polygonVsPolygon(square, diamond(2 + Math.SQRT2 + 0.01)).relation, 'separated');
});

// ---------------------------------------------------------------- degenerate polygons

test('SAT: points and segments', () => {
  const square = aabbCorners(aabb(0, 0, 4, 4));
  const inside = polygonVsPolygon(square, [vec(1, 2)]);
  assert.equal(inside.relation, 'overlapping');
  close(inside.depth, 1, 1e-12, 'a point 1 from the left side leaves through it');
  assert.equal(polygonVsPolygon(square, [vec(4, 2)]).relation, 'touching');
  const outside = polygonVsPolygon(square, [vec(7, 8)]);
  assert.equal(outside.relation, 'separated');
  close(outside.distance, 5);

  // Collinear segments: their normals agree, so only the direction axis can tell them apart.
  const s1 = [vec(0, 0), vec(1, 0)];
  const s2 = [vec(2, 0), vec(3, 0)];
  const collinear = polygonVsPolygon(s1, s2);
  assert.equal(collinear.relation, 'separated');
  close(collinear.distance, 1);
  assert.equal(polygonVsPolygon(s1, [vec(0.5, 0), vec(3, 0)]).hit, true);
  assert.equal(polygonVsPolygon(s1, [vec(1, 0), vec(3, 0)]).relation, 'touching');
  // Crossing segments (an X) hit; parallel segments apart do not.
  assert.equal(polygonVsPolygon([vec(0, 0), vec(2, 2)], [vec(0, 2), vec(2, 0)]).hit, true);
  assert.equal(polygonVsPolygon([vec(0, 0), vec(2, 0)], [vec(0, 1), vec(2, 1)]).hit, false);
  // A segment through a square.
  assert.equal(polygonVsPolygon(square, [vec(-1, 2), vec(5, 2)]).hit, true);

  // Two points: the same point touches, different points are apart by their distance.
  assert.equal(polygonVsPolygon([vec(1, 1)], [vec(1, 1)]).relation, 'touching');
  const points = polygonVsPolygon([vec(0, 0)], [vec(3, 4)]);
  assert.equal(points.relation, 'separated');
  close(points.distance, 5);

  assert.throws(() => polygonVsPolygon([], square), RangeError);
  assert.throws(() => polygonsIntersect(square, []), RangeError);
});

// ---------------------------------------------------------------- concave shapes

test('SAT is only valid for convex shapes: a concave "U" gives a false hit', () => {
  // A U open at the top, and a small square resting in its notch without touching it.
  const u: Polygon = [vec(0, 0), vec(6, 0), vec(6, 6), vec(4, 6), vec(4, 2), vec(2, 2), vec(2, 6), vec(0, 6)];
  const peg = aabbCorners(aabb(2.5, 3, 3.5, 5));
  assert.equal(isConvex(u), false);
  // Every projection overlaps, so SAT reports a collision...
  const r = polygonVsPolygon(u, peg);
  assert.equal(r.hit, true);
  assert.ok(r.axes.every((axis) => axis.overlap > 0));
  // ...but the U is the union of three convex pieces, none of which meets the peg.
  const pieces = [aabbCorners(aabb(0, 0, 6, 2)), aabbCorners(aabb(0, 2, 2, 6)), aabbCorners(aabb(4, 2, 6, 6))];
  assert.ok(pieces.every((piece) => !polygonVsPolygon(piece, peg).hit));
});

// ---------------------------------------------------------------- random convex polygons

/** Independent oracle: convex polygons intersect iff a vertex of one lies in the other or two edges cross. */
function segmentsIntersect(p1: Vec, p2: Vec, q1: Vec, q2: Vec): boolean {
  const d1 = cross(sub(p2, p1), sub(q1, p1));
  const d2 = cross(sub(p2, p1), sub(q2, p1));
  const d3 = cross(sub(q2, q1), sub(p1, q1));
  const d4 = cross(sub(q2, q1), sub(p2, q1));
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function bruteForceHit(a: Polygon, b: Polygon): boolean {
  if (a.some((p) => pointInConvexPolygon(p, b, 1e-9)) || b.some((p) => pointInConvexPolygon(p, a, 1e-9))) return true;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (segmentsIntersect(a[i]!, a[(i + 1) % a.length]!, b[j]!, b[(j + 1) % b.length]!)) return true;
    }
  }
  return false;
}

function randomConvex(random: () => number): Polygon {
  const center = vec(random() * 60, random() * 60);
  const angle = random() * 2 * Math.PI;
  const kind = Math.floor(random() * 3);
  if (kind === 0) return orientedRect(center, 2 + random() * 12, 2 + random() * 12, angle);
  if (kind === 1) return regularPolygon(center, 3 + random() * 12, 3 + Math.floor(random() * 6), angle);
  const corner = () => sub(vec(random() * 24, random() * 24), vec(12, 12));
  const tri = triangle(center, sub(center, corner()), sub(center, corner()));
  return polygonArea(tri) > 1 ? tri : orientedRect(center, 3, 2, angle);
}

test('SAT agrees with a brute-force oracle and with its early-exit version', () => {
  const random = rng(314159);
  let hits = 0;
  for (let i = 0; i < 1500; i++) {
    const a = randomConvex(random);
    const b = randomConvex(random);
    const r = polygonVsPolygon(a, b);
    assert.equal(r.hit, bruteForceHit(a, b), `oracle disagrees on ${JSON.stringify({ a, b })}`);
    assert.equal(polygonsIntersect(a, b), r.hit);
    if (r.hit) hits += 1;
  }
  assert.ok(hits > 200 && hits < 1300, `a useful mix of hits and misses (${hits})`);
});

test('SAT MTV: symmetric, resolves the overlap, and no shorter push works', () => {
  const random = rng(2718);
  let checked = 0;
  for (let i = 0; i < 600; i++) {
    const a = randomConvex(random);
    const b = randomConvex(random);
    const ab = polygonVsPolygon(a, b);
    const ba = polygonVsPolygon(b, a);
    assert.equal(ab.relation, ba.relation);
    close(ab.depth, ba.depth, 1e-9);
    if (ab.relation !== 'overlapping') continue;
    checked += 1;
    // Moving B by the MTV leaves the shapes touching.
    const moved = polygonVsPolygon(a, translatePolygon(b, ab.mtv), { tolerance: 1e-7 });
    assert.equal(moved.relation, 'touching');
    // Minimality: a push 1% shorter than the depth in ANY direction still overlaps.
    for (let k = 0; k < 16; k++) {
      const direction = rotate(vec(1, 0), (2 * Math.PI * k) / 16 + 0.05);
      const nudged = polygonVsPolygon(a, translatePolygon(b, scale(direction, ab.depth * 0.99)));
      assert.equal(nudged.relation, 'overlapping');
    }
  }
  assert.ok(checked > 50);
});

test('SAT distance: exact for separated shapes, never below the gap on the separating axis', () => {
  const random = rng(1618);
  for (let i = 0; i < 600; i++) {
    const a = randomConvex(random);
    const b = randomConvex(random);
    const r = polygonVsPolygon(a, b);
    if (r.relation !== 'separated') continue;
    const gap = -r.axes[r.separatingAxis]!.overlap;
    assert.ok(r.distance >= gap - 1e-9);
    const pair = closestPointsBetweenPolygons(a, b);
    close(r.distance, pair.distance);
    // Sampled boundary points are never closer than the reported distance.
    for (let s = 0; s < 8; s++) {
      const t = random();
      const i1 = Math.floor(random() * a.length);
      const i2 = Math.floor(random() * b.length);
      const pa = vec(
        a[i1]!.x + (a[(i1 + 1) % a.length]!.x - a[i1]!.x) * t,
        a[i1]!.y + (a[(i1 + 1) % a.length]!.y - a[i1]!.y) * t,
      );
      const pb = b[i2]!;
      assert.ok(Math.hypot(pa.x - pb.x, pa.y - pb.y) >= r.distance - 1e-9);
    }
  }
});
