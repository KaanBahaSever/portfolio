/**
 * Box–box, circle–circle and box–circle tests (src/lib/geometry/collide.ts).
 *
 * Conventions under test: shapes are closed, so touching is a hit with depth 0; the MTV moves the
 * SECOND shape out of the first; after moving it by the MTV the shapes touch.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  aabbVsAabb,
  aabbVsCircle,
  circleVsAabb,
  circleVsCircle,
  classify,
  polygonVsPolygon,
} from '../src/lib/geometry/collide.ts';
import {
  aabb,
  aabbCorners,
  aabbFromCenter,
  circle,
  closestPointOnAabb,
  translateAabb,
  type Aabb,
  type Circle,
} from '../src/lib/geometry/shapes.ts';
import { ZERO, add, distance, vec, type Vec } from '../src/lib/geometry/vec.ts';

const close = (actual: number, expected: number, tolerance = 1e-9, message?: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, message ?? `expected ${expected}, got ${actual}`);

const closeVec = (actual: Vec | null, expected: Vec, tolerance = 1e-9) => {
  assert.ok(actual, 'expected a point');
  assert.ok(
    Math.abs(actual.x - expected.x) <= tolerance && Math.abs(actual.y - expected.y) <= tolerance,
    `expected (${expected.x}, ${expected.y}), got (${actual.x}, ${actual.y})`,
  );
};

/** Deterministic pseudo-random numbers (mulberry32), so failures reproduce. */
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

const translateCircle = (c: Circle, offset: Vec): Circle => ({ center: add(c.center, offset), radius: c.radius });

test('classify: the tolerance band around zero is "touching"', () => {
  assert.equal(classify(-0.2, 0.1), 'separated');
  assert.equal(classify(-0.1, 0.1), 'touching');
  assert.equal(classify(0, 0), 'touching');
  assert.equal(classify(0.1, 0.1), 'touching');
  assert.equal(classify(0.2, 0.1), 'overlapping');
});

// ---------------------------------------------------------------- AABB vs AABB

test('AABB: overlapping boxes push B out along the axis of least overlap', () => {
  const r = aabbVsAabb(aabb(0, 0, 10, 10), aabb(8, 3, 12, 7));
  assert.equal(r.relation, 'overlapping');
  assert.equal(r.hit, true);
  assert.equal(r.overlapX, 2);
  assert.equal(r.overlapY, 7);
  assert.equal(r.depth, 2);
  assert.deepEqual(r.normal, vec(1, 0));
  assert.deepEqual(r.mtv, vec(2, 0));
  assert.deepEqual(r.intersection, aabb(8, 3, 10, 7));
  assert.deepEqual(r.contact, vec(9, 5));
  assert.equal(r.distance, 0);
  assert.equal(r.closest, null);
  // Pushed up instead of right when y needs less.
  const up = aabbVsAabb(aabb(0, 0, 10, 10), aabb(2, -3, 6, 1));
  assert.deepEqual(up.mtv, vec(0, -1));
});

test('AABB: sharing an edge or a corner is touching (a hit with depth 0)', () => {
  const a = aabb(0, 0, 10, 10);
  const edge = aabbVsAabb(a, aabb(10, 2, 20, 8));
  assert.equal(edge.relation, 'touching');
  assert.equal(edge.hit, true);
  assert.equal(edge.depth, 0);
  assert.equal(edge.mtv, ZERO);
  assert.deepEqual(edge.contact, vec(10, 5));
  const corner = aabbVsAabb(a, aabb(10, 10, 20, 20));
  assert.equal(corner.relation, 'touching');
  assert.deepEqual(corner.contact, vec(10, 10));
});

test('AABB: separated boxes report the exact gap and the nearest points', () => {
  const a = aabb(0, 0, 10, 10);
  const diagonal = aabbVsAabb(a, aabb(13, 14, 20, 20));
  assert.equal(diagonal.relation, 'separated');
  assert.equal(diagonal.hit, false);
  assert.equal(diagonal.distance, 5);
  assert.deepEqual(diagonal.closest, { a: vec(10, 10), b: vec(13, 14), distance: 5 });
  closeVec(diagonal.normal, vec(0.6, 0.8));
  assert.equal(diagonal.mtv, ZERO);
  assert.equal(diagonal.contact, null);
  assert.equal(diagonal.intersection, null);
  // Apart on x only: the nearest points sit mid-way along the shared y range.
  const beside = aabbVsAabb(a, aabb(13, 2, 20, 8));
  assert.equal(beside.distance, 3);
  assert.deepEqual(beside.closest, { a: vec(10, 5), b: vec(13, 5), distance: 3 });
  // B on the left: the normal points left.
  assert.deepEqual(aabbVsAabb(a, aabb(-9, 0, -4, 10)).normal, vec(-1, 0));
});

test('AABB: a nested box travels past the nearer side, not by the overlap length', () => {
  const outer = aabb(0, 0, 100, 100);
  const inner = aabb(10, 40, 30, 60);
  const r = aabbVsAabb(outer, inner);
  assert.equal(r.depth, 30);
  assert.deepEqual(r.mtv, vec(-30, 0));
  assert.deepEqual(r.intersection, inner);
  assert.equal(aabbVsAabb(outer, translateAabb(inner, r.mtv)).relation, 'touching');
  // Identical boxes: a full width either way; x wins the tie and B moves forward.
  const same = aabbVsAabb(aabb(0, 0, 10, 10), aabb(0, 0, 10, 10));
  assert.equal(same.depth, 10);
  assert.deepEqual(same.mtv, vec(10, 0));
});

test('AABB: floating-point touching needs the tolerance', () => {
  let right = 0;
  for (let i = 0; i < 10; i++) right += 0.1; // 0.9999999999999999
  const a = aabb(0, 0, right, 1);
  const b = aabb(1, 0, 2, 1);
  assert.equal(aabbVsAabb(a, b, { tolerance: 0 }).relation, 'separated');
  assert.equal(aabbVsAabb(a, b).relation, 'touching');
  // Far from the origin the default tolerance scales with the coordinates.
  const far = 1e8;
  const shifted = aabbVsAabb(aabb(far, 0, far + right, 1), aabb(far + 1, 0, far + 2, 1));
  assert.equal(shifted.relation, 'touching');
  // A tolerance in scene units: half a pixel.
  assert.equal(aabbVsAabb(aabb(0, 0, 10, 10), aabb(10.4, 0, 20, 10), { tolerance: 0.5 }).relation, 'touching');
  assert.equal(aabbVsAabb(aabb(0, 0, 10, 10), aabb(10.6, 0, 20, 10), { tolerance: 0.5 }).relation, 'separated');
});

test('AABB: properties on random boxes (symmetry, MTV resolves, agrees with SAT)', () => {
  const random = rng(20260926);
  const box = (): Aabb => {
    const x = Math.round(random() * 40);
    const y = Math.round(random() * 40);
    return aabb(x, y, x + 1 + Math.round(random() * 20), y + 1 + Math.round(random() * 20));
  };
  for (let i = 0; i < 400; i++) {
    const a = box();
    const b = box();
    const ab = aabbVsAabb(a, b);
    const ba = aabbVsAabb(b, a);
    assert.equal(ab.relation, ba.relation);
    close(ab.depth, ba.depth);
    close(ab.distance, ba.distance);
    const sat = polygonVsPolygon(aabbCorners(a), aabbCorners(b));
    assert.equal(sat.relation, ab.relation, `SAT disagrees on ${JSON.stringify([a, b])}`);
    close(sat.depth, ab.depth);
    close(sat.distance, ab.distance);
    if (ab.relation === 'overlapping') {
      assert.equal(aabbVsAabb(a, translateAabb(b, ab.mtv)).relation, 'touching');
      assert.equal(aabbVsAabb(translateAabb(a, { x: -ab.mtv.x, y: -ab.mtv.y }), b).relation, 'touching');
    }
  }
});

// ---------------------------------------------------------------- circle vs circle

test('circles: overlap along the line of centres', () => {
  const r = circleVsCircle(circle(vec(0, 0), 5), circle(vec(8, 0), 5));
  assert.equal(r.relation, 'overlapping');
  assert.equal(r.depth, 2);
  assert.deepEqual(r.normal, vec(1, 0));
  assert.deepEqual(r.mtv, vec(2, 0));
  assert.deepEqual(r.contact, vec(4, 0));
  assert.equal(r.centerDistance, 8);
  assert.equal(r.radiusSum, 10);
  // A 3-4-5 direction.
  const slanted = circleVsCircle(circle(vec(0, 0), 5), circle(vec(3, 4), 5));
  assert.equal(slanted.depth, 5);
  closeVec(slanted.normal, vec(0.6, 0.8));
  closeVec(slanted.mtv, vec(3, 4));
});

test('circles: touching and separated', () => {
  const touching = circleVsCircle(circle(vec(0, 0), 5), circle(vec(6, 8), 5));
  assert.equal(touching.relation, 'touching');
  assert.equal(touching.depth, 0);
  closeVec(touching.contact, vec(3, 4));
  const apart = circleVsCircle(circle(vec(0, 0), 5), circle(vec(13, 0), 5));
  assert.equal(apart.relation, 'separated');
  assert.equal(apart.distance, 3);
  assert.deepEqual(apart.closest, { a: vec(5, 0), b: vec(8, 0), distance: 3 });
  // A point (radius 0) on a circle touches it.
  assert.equal(circleVsCircle(circle(vec(0, 0), 5), circle(vec(0, 5), 0)).relation, 'touching');
});

test('circles: concentric and nested discs', () => {
  const concentric = circleVsCircle(circle(vec(2, 2), 4), circle(vec(2, 2), 1));
  assert.equal(concentric.relation, 'overlapping');
  assert.deepEqual(concentric.normal, vec(1, 0), 'no line of centres: +x by convention');
  assert.equal(concentric.depth, 5);
  // A small disc inside a large one must travel r_A + r_B − d to get out.
  const nested = circleVsCircle(circle(vec(0, 0), 10), circle(vec(2, 0), 3));
  assert.equal(nested.depth, 11);
  const moved = circleVsCircle(circle(vec(0, 0), 10), translateCircle(circle(vec(2, 0), 3), nested.mtv));
  assert.equal(moved.relation, 'touching');
});

test('circles: properties on random discs', () => {
  const random = rng(7);
  for (let i = 0; i < 400; i++) {
    const a = circle(vec(random() * 100, random() * 100), 1 + random() * 30);
    const b = circle(vec(random() * 100, random() * 100), 1 + random() * 30);
    const ab = circleVsCircle(a, b);
    const ba = circleVsCircle(b, a);
    assert.equal(ab.relation, ba.relation);
    close(ab.depth, ba.depth);
    assert.equal(ab.hit, distance(a.center, b.center) <= a.radius + b.radius);
    if (ab.relation === 'overlapping') {
      assert.equal(circleVsCircle(a, translateCircle(b, ab.mtv)).relation, 'touching');
    } else if (ab.relation === 'separated') {
      close(ab.distance, distance(a.center, b.center) - a.radius - b.radius);
    }
  }
});

// ---------------------------------------------------------------- box vs circle

test('box–circle: a centre beside a face is pushed straight out', () => {
  const r = aabbVsCircle(aabb(0, 0, 10, 10), circle(vec(13, 5), 4));
  assert.equal(r.relation, 'overlapping');
  assert.deepEqual(r.clamped, vec(10, 5));
  assert.equal(r.clampDistance, 3);
  assert.equal(r.inside, false);
  assert.equal(r.face, null);
  assert.equal(r.depth, 1);
  assert.deepEqual(r.normal, vec(1, 0));
  assert.deepEqual(r.mtv, vec(1, 0));
  assert.deepEqual(r.contact, vec(10, 5));
});

test('box–circle: a centre beyond a corner measures from the corner', () => {
  const box = aabb(0, 0, 10, 10);
  const touching = aabbVsCircle(box, circle(vec(13, 14), 5));
  assert.equal(touching.relation, 'touching');
  assert.deepEqual(touching.clamped, vec(10, 10));
  const overlapping = aabbVsCircle(box, circle(vec(13, 14), 6));
  close(overlapping.depth, 1);
  closeVec(overlapping.normal, vec(0.6, 0.8));
  const apart = aabbVsCircle(box, circle(vec(13, 14), 4));
  assert.equal(apart.relation, 'separated');
  close(apart.distance, 1);
  closeVec(apart.closest?.a ?? null, vec(10, 10));
  closeVec(apart.closest?.b ?? null, vec(10.6, 10.8));
});

test('box–circle: a centre inside the box leaves through the nearest face', () => {
  const box = aabb(0, 0, 10, 6);
  const r = aabbVsCircle(box, circle(vec(2, 3), 1));
  assert.equal(r.inside, true);
  assert.equal(r.face, 'min-x');
  assert.deepEqual(r.clamped, vec(2, 3), 'clamping leaves an inside centre where it is');
  assert.equal(r.clampDistance, 0);
  assert.equal(r.depth, 3);
  assert.deepEqual(r.normal, vec(-1, 0));
  assert.deepEqual(r.mtv, vec(-3, 0));
  assert.deepEqual(r.contact, vec(0, 3));
  assert.equal(aabbVsCircle(box, circle(add(vec(2, 3), r.mtv), 1)).relation, 'touching');
  // Nearer the bottom face (larger y).
  const low = aabbVsCircle(box, circle(vec(5, 5), 2));
  assert.equal(low.face, 'max-y');
  assert.deepEqual(low.mtv, vec(0, 3));
  // Dead centre of a square: every face is as near; min-x wins the tie.
  assert.equal(aabbVsCircle(aabb(0, 0, 10, 10), circle(vec(5, 5), 1)).face, 'min-x');
});

test('box–circle: a centre exactly on the boundary goes out through that face', () => {
  const r = aabbVsCircle(aabb(0, 0, 10, 10), circle(vec(10, 4), 2));
  assert.equal(r.inside, true);
  assert.equal(r.face, 'max-x');
  assert.equal(r.depth, 2);
  assert.deepEqual(r.mtv, vec(2, 0));
  // A point (radius 0) on the boundary only touches.
  assert.equal(aabbVsCircle(aabb(0, 0, 10, 10), circle(vec(10, 4), 0)).relation, 'touching');
});

test('box–circle: circleVsAabb is the same test seen from the circle', () => {
  const box = aabb(0, 0, 10, 10);
  const disc = circle(vec(13, 5), 4);
  const fromBox = aabbVsCircle(box, disc);
  const fromCircle = circleVsAabb(disc, box);
  assert.equal(fromCircle.relation, fromBox.relation);
  assert.equal(fromCircle.depth, fromBox.depth);
  assert.deepEqual(fromCircle.normal, vec(-1, -0));
  assert.deepEqual(fromCircle.mtv, vec(-1, -0));
  const apart = circleVsAabb(circle(vec(13, 14), 4), box);
  closeVec(apart.closest?.a ?? null, vec(10.6, 10.8));
  closeVec(apart.closest?.b ?? null, vec(10, 10));
});

test('box–circle: properties on random pairs', () => {
  const random = rng(99);
  for (let i = 0; i < 600; i++) {
    const box = aabbFromCenter(vec(random() * 100, random() * 100), 2 + random() * 30, 2 + random() * 30);
    const disc = circle(vec(random() * 100, random() * 100), 1 + random() * 25);
    const r = aabbVsCircle(box, disc);
    // The hit agrees with the definition: nearest point of the box within the radius.
    const nearest = closestPointOnAabb(box, disc.center);
    const expectedHit = distance(nearest, disc.center) <= disc.radius + 1e-9;
    assert.equal(r.hit, expectedHit);
    if (r.relation === 'overlapping') {
      const moved = aabbVsCircle(box, translateCircle(disc, r.mtv));
      assert.equal(moved.relation, 'touching', `MTV does not resolve ${JSON.stringify({ box, disc })}`);
    }
  }
});
