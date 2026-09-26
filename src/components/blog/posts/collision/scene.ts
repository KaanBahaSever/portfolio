/**
 * State of an interactive collision figure: two shapes in a 600 × 400 world, what the reader can
 * do to them (move, rotate, swap B's polygon), and the collision test that matches the figure.
 *
 * Pure module (no DOM), shared by CollisionDemo.astro, which renders the starting position at
 * build time, and controller.ts, which re-renders after every move. World units are called
 * "px" in the interface: on a wide screen one unit is about one CSS pixel.
 */
import {
  aabbVsAabb,
  aabbVsCircle,
  circleVsCircle,
  polygonVsPolygon,
  type AabbCircleCollision,
  type AabbCollision,
  type CircleCollision,
  type Collision,
  type SatCollision,
} from '../../../../lib/geometry/collide.ts';
import {
  aabbFromCenter,
  aabbOfPoints,
  centroid,
  orientedRect,
  regularPolygon,
  type Aabb,
  type Circle,
  type Polygon,
} from '../../../../lib/geometry/shapes.ts';
import { add, rotate, sub, vec, type Vec } from '../../../../lib/geometry/vec.ts';
import type { DemoKind, PolygonName, ShapeKey } from './messages.ts';

export type { DemoKind, PolygonName, ShapeKey };

export const WORLD = { width: 600, height: 400 } as const;

export const DEMO_KINDS: readonly DemoKind[] = ['aabb', 'circles', 'circle-box', 'sat', 'concave'];
export const POLYGON_NAMES: readonly PolygonName[] = ['triangle', 'rectangle', 'pentagon'];

/**
 * Overlaps within half a unit count as touching: about what the eye can tell apart, and it
 * keeps the rounded numbers honest (an overlap shown as "depth 1 px" is at least half a unit).
 */
export const TOLERANCE = 0.5;

/** Keyboard steps: arrow keys move by MOVE_STEP units, Q and E rotate by ROTATE_STEP degrees. */
export const MOVE_STEP = 5;
export const ROTATE_STEP = 15;
/** With Shift held, steps are this many times larger. */
export const LARGE_STEP_FACTOR = 5;
export const LARGE_ROTATE_STEP = 45;

export type ShapeState =
  | { readonly kind: 'box'; readonly center: Vec; readonly half: Vec }
  | { readonly kind: 'circle'; readonly center: Vec; readonly radius: number }
  | {
      readonly kind: 'polygon';
      /** B's choice in the SAT figure, or the U of the concave figure. */
      readonly name: PolygonName | 'notch';
      readonly center: Vec;
      /** Radians; positive turns clockwise on screen, where y points down. */
      readonly angle: number;
      /** Vertices relative to the centre, before rotation; their centroid is the origin. */
      readonly local: Polygon;
    };

export interface Scene {
  readonly kind: DemoKind;
  readonly a: ShapeState;
  readonly b: ShapeState;
}

const degrees = (value: number) => (value * Math.PI) / 180;

/** B's polygon in the SAT figure, centred on its centroid so that it rotates in place. */
export function localPolygon(name: PolygonName): Polygon {
  const raw =
    name === 'rectangle'
      ? orientedRect(vec(0, 0), 72, 42)
      : name === 'pentagon'
        ? regularPolygon(vec(0, 0), 78, 5, -Math.PI / 2)
        : // A scalene triangle: three edge directions, none parallel to another.
          [vec(-78, 58), vec(92, 36), vec(-18, -86)];
  const c = centroid(raw);
  return raw.map((p) => sub(p, c));
}

/**
 * The concave figure's U, open at the top: 300 wide and 270 tall, with a notch 110 wide and 180
 * deep. Its three convex pieces (two columns and the base) are in notchPieces().
 */
const NOTCH = { halfWidth: 150, halfHeight: 135, notchHalfWidth: 55, notchBottom: 45 } as const;

function notchOutline(): Polygon {
  const { halfWidth: w, halfHeight: h, notchHalfWidth: n, notchBottom: b } = NOTCH;
  return [vec(-w, -h), vec(-n, -h), vec(-n, b), vec(n, b), vec(n, -h), vec(w, -h), vec(w, h), vec(-w, h)];
}

/** Offset from the U's outline coordinates to its centroid-centred local coordinates. */
const notchCentroid = centroid(notchOutline());

/** The U split into convex pieces (left column, right column, base), in world coordinates. */
export function notchPieces(shape: ShapeState): Polygon[] {
  if (shape.kind !== 'polygon' || shape.name !== 'notch') return [];
  const { halfWidth: w, halfHeight: h, notchHalfWidth: n, notchBottom: b } = NOTCH;
  const pieces: Polygon[] = [
    [vec(-w, -h), vec(-n, -h), vec(-n, b), vec(-w, b)],
    [vec(n, -h), vec(w, -h), vec(w, b), vec(n, b)],
    [vec(-w, b), vec(w, b), vec(w, h), vec(-w, h)],
  ];
  return pieces.map((piece) => piece.map((p) => add(shape.center, rotate(sub(p, notchCentroid), shape.angle))));
}

export function initialScene(kind: DemoKind, polygon: PolygonName = 'triangle'): Scene {
  switch (kind) {
    case 'aabb':
      return {
        kind,
        a: { kind: 'box', center: vec(235, 195), half: vec(115, 75) },
        b: { kind: 'box', center: vec(410, 235), half: vec(85, 60) },
      };
    case 'circles':
      return {
        kind,
        a: { kind: 'circle', center: vec(235, 205), radius: 100 },
        b: { kind: 'circle', center: vec(390, 185), radius: 75 },
      };
    case 'circle-box':
      return {
        kind,
        a: { kind: 'box', center: vec(250, 225), half: vec(135, 80) },
        b: { kind: 'circle', center: vec(425, 125), radius: 70 },
      };
    case 'sat':
      return {
        kind,
        a: { kind: 'polygon', name: 'rectangle', center: vec(230, 210), angle: degrees(-15), local: orientedRect(vec(0, 0), 120, 62) },
        b: { kind: 'polygon', name: polygon, center: vec(405, 185), angle: degrees(15), local: localPolygon(polygon) },
      };
    case 'concave': {
      // The U's outline spans [150, 450] × [80, 350]; the square waits in the notch, clear of it.
      const outlineCenter = vec(300, 215);
      return {
        kind,
        a: {
          kind: 'polygon',
          name: 'notch',
          center: add(outlineCenter, notchCentroid),
          angle: 0,
          local: notchOutline().map((p) => sub(p, notchCentroid)),
        },
        b: { kind: 'box', center: vec(300, 170), half: vec(30, 38) },
      };
    }
  }
}

// ---------------------------------------------------------------- geometry of a shape

export function asAabb(shape: ShapeState & { kind: 'box' }): Aabb {
  return aabbFromCenter(shape.center, shape.half.x, shape.half.y);
}

export function asCircle(shape: ShapeState & { kind: 'circle' }): Circle {
  return { center: shape.center, radius: shape.radius };
}

/** The polygon in world coordinates (boxes as their four corners). Circles have none. */
export function asPolygon(shape: ShapeState): Polygon {
  if (shape.kind === 'box') return orientedRect(shape.center, shape.half.x, shape.half.y);
  if (shape.kind === 'polygon') return shape.local.map((p) => add(shape.center, rotate(p, shape.angle)));
  throw new TypeError('asPolygon: a circle is not a polygon');
}

export function shapeBounds(shape: ShapeState): Aabb {
  if (shape.kind === 'circle') return aabbFromCenter(shape.center, shape.radius, shape.radius);
  if (shape.kind === 'box') return asAabb(shape);
  return aabbOfPoints(asPolygon(shape));
}

/** Shifts the shape as little as possible so that all of it stays inside the world. */
export function clampShape(shape: ShapeState): ShapeState {
  const bounds = shapeBounds(shape);
  const dx = bounds.min.x < 0 ? -bounds.min.x : bounds.max.x > WORLD.width ? WORLD.width - bounds.max.x : 0;
  const dy = bounds.min.y < 0 ? -bounds.min.y : bounds.max.y > WORLD.height ? WORLD.height - bounds.max.y : 0;
  return dx === 0 && dy === 0 ? shape : { ...shape, center: add(shape.center, vec(dx, dy)) };
}

export function placeShape(shape: ShapeState, center: Vec): ShapeState {
  return clampShape({ ...shape, center });
}

export function moveShape(shape: ShapeState, delta: Vec): ShapeState {
  return placeShape(shape, add(shape.center, delta));
}

/** Rotates a polygon by `delta` degrees (positive: clockwise on screen); other shapes do not turn. */
export function rotateShape(shape: ShapeState, delta: number): ShapeState {
  if (shape.kind !== 'polygon') return shape;
  // Keep the angle in (−180°, 180°] so repeated turns do not grow it without bound.
  let angle = shape.angle + degrees(delta);
  angle = Math.atan2(Math.sin(angle), Math.cos(angle));
  return clampShape({ ...shape, angle });
}

/** B with another polygon, keeping its position and angle. */
export function withPolygon(shape: ShapeState, name: PolygonName): ShapeState {
  if (shape.kind !== 'polygon') return shape;
  return clampShape({ ...shape, name, local: localPolygon(name) });
}

/** Only the SAT figure turns its shapes (a box stays axis-aligned by definition; the U stays upright). */
export function canRotate(scene: Scene): boolean {
  return scene.kind === 'sat';
}

// ---------------------------------------------------------------- the test that matches the figure

export type Analysis =
  | { readonly kind: 'aabb'; readonly result: AabbCollision }
  | { readonly kind: 'circles'; readonly result: CircleCollision }
  | { readonly kind: 'circle-box'; readonly result: AabbCircleCollision }
  | { readonly kind: 'sat'; readonly result: SatCollision }
  | {
      readonly kind: 'concave';
      /** SAT applied to the whole U, which is not convex: its verdict may be wrong. */
      readonly sat: SatCollision;
      /** The true answer, from SAT on each convex piece (the collision with the nearest piece). */
      readonly result: Collision;
    };

export function analyse(scene: Scene): Analysis {
  const options = { tolerance: TOLERANCE };
  const { a, b } = scene;
  if (scene.kind === 'aabb' && a.kind === 'box' && b.kind === 'box') {
    return { kind: 'aabb', result: aabbVsAabb(asAabb(a), asAabb(b), options) };
  }
  if (scene.kind === 'circles' && a.kind === 'circle' && b.kind === 'circle') {
    return { kind: 'circles', result: circleVsCircle(asCircle(a), asCircle(b), options) };
  }
  if (scene.kind === 'circle-box' && a.kind === 'box' && b.kind === 'circle') {
    return { kind: 'circle-box', result: aabbVsCircle(asAabb(a), asCircle(b), options) };
  }
  if (scene.kind === 'sat' && a.kind !== 'circle' && b.kind !== 'circle') {
    return { kind: 'sat', result: polygonVsPolygon(asPolygon(a), asPolygon(b), options) };
  }
  if (scene.kind === 'concave' && a.kind === 'polygon' && b.kind === 'box') {
    const peg = asPolygon(b);
    const pieces = notchPieces(a).map((piece) => polygonVsPolygon(piece, peg, options));
    return { kind: 'concave', sat: polygonVsPolygon(asPolygon(a), peg, options), result: combinePieces(pieces) };
  }
  throw new TypeError(`analyse: the shapes do not match the ${scene.kind} figure`);
}

const RANK = { separated: 0, touching: 1, overlapping: 2 } as const;

/**
 * One verdict for a shape made of convex pieces: the deepest overlap if any piece overlaps, else
 * a touch, else the nearest piece's distance. (Depth and MTV of a concave union need more care
 * than the deepest piece; the concave figure only reports the verdict and the distance.)
 */
export function combinePieces(pieces: readonly Collision[]): Collision {
  if (pieces.length === 0) throw new RangeError('combinePieces: no pieces');
  return pieces.reduce((best, piece) => {
    if (RANK[piece.relation] !== RANK[best.relation]) return RANK[piece.relation] > RANK[best.relation] ? piece : best;
    if (piece.relation === 'separated') return piece.distance < best.distance ? piece : best;
    return piece.depth > best.depth ? piece : best;
  });
}

/** Where B ends up if it is moved by the MTV (for the dashed "resolved" outline). */
export function resolvedB(scene: Scene, mtv: Vec): ShapeState {
  return { ...scene.b, center: add(scene.b.center, mtv) };
}
