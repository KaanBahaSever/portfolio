/**
 * The CubeSat figure (#journey-cubesat), computed during the build: a small 3D model of an
 * example 3U CubeSat with four deployed solar panels and a turnstile of UHF antennas, projected
 * orthographically from a camera a little above it, shaded with one light and painted back to
 * front. Below it: the curve of the Earth, a faint orbit, and a ground station with its radio link.
 *
 * The model is in centimetres and follows the CubeSat standard: 1U is 10 × 10 × 11.35 cm, so a
 * 3U body is 10 × 10 × 34.05 cm. The panels, cells and antennas are a plausible layout, not a
 * particular satellite (the club's CubeSat was never finished and its size is not on record).
 * The satellite is drawn far larger than the Earth beside it would allow; the caption says so.
 *
 * Pure TypeScript (no DOM, no `astro:*`), so `node --test` can load it. The component only
 * renders what cubesatScene() returns.
 */
import type { Point } from './geometry.ts';

export type Vec3 = readonly [number, number, number];

/* ------------------------------------------------------------------------------------------ */
/* The model, in centimetres: x across the wings, y along the body, z up (away from the Earth)  */
/* ------------------------------------------------------------------------------------------ */

/** One CubeSat unit (1U): a 10 cm square cross-section, 11.35 cm long including the rails. */
export const UNIT = { width: 10, length: 11.35 } as const;
/** A 3U CubeSat: three units in a row, 34.05 cm long. */
export const UNITS = 3;
export const BODY = { width: UNIT.width, height: UNIT.width, length: UNITS * UNIT.length } as const;
/** The rails along the body's four long edges are 8.5 mm wide. */
export const RAIL = 0.85;

/**
 * Deployable solar panels: two per side, hinged along the body's bottom long edges and folded
 * out flat, so each side forms a wing level with the bottom face. Each panel carries a column of
 * seven triple-junction cells of 8 × 4 cm, the usual size of such cells.
 */
export const PANEL = { width: 9.7, length: 32, gap: 0.3, perSide: 2 } as const;
export const CELL = { across: 8, along: 4, count: 7 } as const;

/**
 * UHF antennas: four whips in a turnstile at the far end (+y), each 17 cm long, a quarter of the
 * wavelength at 437 MHz (an amateur satellite band): 3·10⁸ m/s ÷ 437 MHz ÷ 4 ≈ 17 cm. They
 * unfold from the corners of the antenna deck, a few millimetres off the end face, and
 * point out diagonally.
 */
export const ANTENNA = { whips: 4, length: 17, standoff: 0.4 } as const;

/* ------------------------------------------------------------------------------------------ */
/* The camera                                                                                   */
/* ------------------------------------------------------------------------------------------ */

/** The drawing's frame, in viewBox units. */
export const VIEW = { width: 320, height: 200 } as const;

export interface Camera {
  /** Degrees the camera has swung round from straight in front (−y), towards +x. */
  azimuth: number;
  /** Degrees above the plane of the wings. */
  elevation: number;
  /** Degrees the picture is turned on the page (positive is clockwise). */
  roll: number;
  /** viewBox units per centimetre. */
  scale: number;
  /** Where the body's centre lands. */
  centre: Point;
}

/** The figure's camera: in front of the satellite, a little above it and to the right. */
export const CAMERA: Camera = { azimuth: 28, elevation: 34, roll: -4, scale: 2.95, centre: { x: 170, y: 90 } };

/** Direction towards the light (the Sun: up, from the left and a little in front), unit length. */
export const LIGHT: Vec3 = normalise([-0.45, -0.35, 0.82]);

const RAD = Math.PI / 180;

function normalise(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / length, v[1] / length, v[2] / length];
}

export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** a + k·b. */
const plus = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];
const times = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];

/** The camera's frame: screen right, screen up, and the direction towards the viewer. */
export function cameraBasis(camera: Camera): { right: Vec3; up: Vec3; toward: Vec3 } {
  const a = camera.azimuth * RAD;
  const e = camera.elevation * RAD;
  const toward: Vec3 = [Math.cos(e) * Math.sin(a), -Math.cos(e) * Math.cos(a), Math.sin(e)];
  const right: Vec3 = [Math.cos(a), Math.sin(a), 0];
  const up: Vec3 = [-Math.sin(e) * Math.sin(a), Math.sin(e) * Math.cos(a), Math.cos(e)];
  // Turning the picture clockwise on the page turns the camera's right and up the other way.
  const r = -camera.roll * RAD;
  return {
    right: plus(times(right, Math.cos(r)), up, Math.sin(r)),
    up: plus(times(up, Math.cos(r)), right, -Math.sin(r)),
    toward,
  };
}

/** A projected point: screen position (viewBox units) and depth (larger is farther away). */
export interface Projected extends Point {
  depth: number;
}

/** Orthographic projection; screen y grows downwards. */
export function project(p: Vec3, camera: Camera = CAMERA): Projected {
  const { right, up, toward } = cameraBasis(camera);
  return {
    x: camera.centre.x + camera.scale * dot(p, right),
    y: camera.centre.y - camera.scale * dot(p, up),
    depth: -camera.scale * dot(p, toward),
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Faces and whips                                                                              */
/* ------------------------------------------------------------------------------------------ */

/** A flat face of the model, projected. */
export interface Face {
  kind: 'face';
  part: 'body' | 'panel';
  /** Outward normal, in the model. */
  normal: Vec3;
  /** Lambert lighting with some ambient light, 0 (shadow) to 1 (fully lit), in tenths. */
  light: number;
  /** The four corners, projected, in order round the face. */
  outline: Projected[];
  /** Solar cells on the face: closed quads, projected. */
  cells: Point[][];
  /** Lines drawn on the face: the rails and the seams between units, projected. */
  lines: Point[][];
}

/** An antenna whip, projected: a straight segment. */
export interface Whip {
  kind: 'whip';
  from: Projected;
  to: Projected;
}

export type Item = Face | Whip;

/** A rectangle in 3D: its centre and two half-axes. Corners go round it. */
function rectangle(centre: Vec3, u: Vec3, v: Vec3): Vec3[] {
  return [
    plus(plus(centre, u, -1), v, -1),
    plus(plus(centre, u, 1), v, -1),
    plus(plus(centre, u, 1), v, 1),
    plus(plus(centre, u, -1), v, 1),
  ];
}

function shade(normal: Vec3): number {
  return Math.round((0.25 + 0.75 * Math.max(0, dot(normal, LIGHT))) * 10) / 10;
}

/** Faces turned less than this towards the camera are left out (back faces, and edge-on ones). */
const FACING = 0.02;

function face(
  part: Face['part'],
  normal: Vec3,
  corners: Vec3[],
  camera: Camera,
  cells: Vec3[][] = [],
  lines: Vec3[][] = [],
): Face {
  const toScreen = (p: Vec3): Point => {
    const { x, y } = project(p, camera);
    return { x, y };
  };
  return {
    kind: 'face',
    part,
    normal,
    light: shade(normal),
    outline: corners.map((c) => project(c, camera)),
    cells: cells.map((cell) => cell.map(toScreen)),
    lines: lines.map((line) => line.map(toScreen)),
  };
}

/** The body: a 10 × 10 × 34.05 cm box centred on the origin, with its rails and unit seams. */
function bodyFaces(camera: Camera): Face[] {
  const { toward } = cameraBasis(camera);
  const half = { x: BODY.width / 2, y: BODY.length / 2, z: BODY.height / 2 };
  const inset = 1 - RAIL / half.x;
  const faces: Face[] = [];
  // The four long faces: x = ±5 and z = ±5. Their half-axes: across the face (u), along the body (v).
  const long: [Vec3, Vec3][] = [
    [[1, 0, 0], [0, 0, half.z]],
    [[-1, 0, 0], [0, 0, half.z]],
    [[0, 0, 1], [half.x, 0, 0]],
    [[0, 0, -1], [half.x, 0, 0]],
  ];
  for (const [normal, u] of long) {
    if (dot(normal, toward) <= FACING) continue;
    const centre: Vec3 = [normal[0] * half.x, 0, normal[2] * half.z];
    const v: Vec3 = [0, half.y, 0];
    const rails = [1, -1].map((side) => [plus(plus(centre, u, side * inset), v, -1), plus(plus(centre, u, side * inset), v, 1)]);
    const seams = Array.from({ length: UNITS - 1 }, (_, k) => {
      const y = -half.y + (k + 1) * UNIT.length;
      const at: Vec3 = [centre[0], y, centre[2]];
      return [plus(at, u, -inset), plus(at, u, inset)];
    });
    faces.push(face('body', normal, rectangle(centre, u, v), camera, [], [...rails, ...seams]));
  }
  // The two end faces, y = ±17.025, each with the square the four rail ends frame.
  for (const sign of [1, -1]) {
    const normal: Vec3 = [0, sign, 0];
    if (dot(normal, toward) <= FACING) continue;
    const centre: Vec3 = [0, sign * half.y, 0];
    const u: Vec3 = [half.x, 0, 0];
    const v: Vec3 = [0, 0, half.z];
    const deck = rectangle(centre, times(u, inset), times(v, inset));
    faces.push(face('body', normal, rectangle(centre, u, v), camera, [], [[...deck, deck[0] ?? centre]]));
  }
  return faces;
}

/** The four deployed panels, two on each side, level with the body's bottom face. */
function panelFaces(camera: Camera): Face[] {
  const { toward } = cameraBasis(camera);
  const z = -BODY.height / 2;
  // A panel is thin and seen from one side or the other; the cells are on the side facing up.
  const up = dot([0, 0, 1], toward) > 0;
  const normal: Vec3 = up ? [0, 0, 1] : [0, 0, -1];
  if (Math.abs(dot(normal, toward)) <= FACING) return [];
  const between = (PANEL.length - CELL.count * CELL.along) / (CELL.count + 1);
  const faces: Face[] = [];
  for (const side of [-1, 1]) {
    for (let k = 0; k < PANEL.perSide; k++) {
      const inner = BODY.width / 2 + PANEL.gap + k * (PANEL.width + PANEL.gap);
      const centre: Vec3 = [side * (inner + PANEL.width / 2), 0, z];
      const cells = up
        ? Array.from({ length: CELL.count }, (_, i) => {
            const y = -PANEL.length / 2 + between + CELL.along / 2 + i * (CELL.along + between);
            return rectangle([centre[0], y, z], [CELL.across / 2, 0, 0], [0, CELL.along / 2, 0]);
          })
        : [];
      faces.push(face('panel', normal, rectangle(centre, [PANEL.width / 2, 0, 0], [0, PANEL.length / 2, 0]), camera, cells));
    }
  }
  return faces;
}

/** The turnstile: four whips at 45° in the plane of the far end face, from the deck's corners. */
function whips(camera: Camera): Whip[] {
  const root: Vec3 = [0, BODY.length / 2 + ANTENNA.standoff, 0];
  // The deck's corners lie on the diagonals, inside the rails.
  const corner = Math.SQRT2 * (BODY.width / 2 - RAIL);
  return Array.from({ length: ANTENNA.whips }, (_, k) => {
    const angle = (45 + (k * 360) / ANTENNA.whips) * RAD;
    const direction: Vec3 = [Math.cos(angle), 0, Math.sin(angle)];
    return {
      kind: 'whip' as const,
      from: project(plus(root, direction, corner), camera),
      to: project(plus(root, direction, corner + ANTENNA.length), camera),
    };
  });
}

/** The point off the far end face where the antennas meet, projected (hidden behind the body). */
export function antennaRoot(camera: Camera = CAMERA): Projected {
  return project([0, BODY.length / 2 + ANTENNA.standoff, 0], camera);
}

/* ------------------------------------------------------------------------------------------ */
/* Painting order                                                                               */
/* ------------------------------------------------------------------------------------------ */

/** Even-odd point-in-polygon test. */
export function inside(point: Point, polygon: readonly Point[]): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (!a || !b) continue;
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/**
 * The depth of a face at a screen point. In an orthographic view the depth over a flat face is
 * an affine function of the screen position, fixed by three of its corners.
 */
export function depthAt(f: Face, p: Point): number {
  const [a, b, c] = f.outline;
  if (!a || !b || !c) return Number.NaN;
  const det = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
  const s = ((p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y)) / det;
  const t = ((b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y)) / det;
  return a.depth + s * (b.depth - a.depth) + t * (c.depth - a.depth);
}

/** Points spread over an item, away from its edges, with their depths. */
export function probes(item: Item, n = 12): Projected[] {
  if (item.kind === 'whip') {
    return Array.from({ length: n }, (_, i) => {
      const t = (i + 0.5) / n;
      return {
        x: item.from.x + t * (item.to.x - item.from.x),
        y: item.from.y + t * (item.to.y - item.from.y),
        depth: item.from.depth + t * (item.to.depth - item.from.depth),
      };
    });
  }
  const [p0, p1, p2, p3] = item.outline;
  if (!p0 || !p1 || !p2 || !p3) return [];
  const points: Projected[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const u = (i + 0.5) / n;
      const v = (j + 0.5) / n;
      const w = [(1 - u) * (1 - v), u * (1 - v), u * v, (1 - u) * v] as const;
      const mix = (key: 'x' | 'y' | 'depth') => w[0] * p0[key] + w[1] * p1[key] + w[2] * p2[key] + w[3] * p3[key];
      points.push({ x: mix('x'), y: mix('y'), depth: mix('depth') });
    }
  }
  return points;
}

/** Where `a` and `b` overlap on screen: +1 if `a` is nearer there, −1 if `b` is, 0 if they do not. */
export function nearer(a: Item, b: Item): -1 | 0 | 1 {
  const EPS = 1e-6;
  let verdict: -1 | 0 | 1 = 0;
  const check = (from: Item, onto: Item, sign: 1 | -1) => {
    if (onto.kind !== 'face') return;
    for (const p of probes(from)) {
      if (!inside(p, onto.outline)) continue;
      const other = depthAt(onto, p);
      if (Math.abs(p.depth - other) <= EPS) continue;
      const result = (p.depth < other ? sign : -sign) as 1 | -1;
      if (verdict !== 0 && verdict !== result) throw new Error('cubesat: two items hide each other in turn');
      verdict = result;
    }
  };
  check(a, b, 1);
  check(b, a, -1);
  return verdict;
}

/** The mean depth of an item's corners or ends. */
export function meanDepth(item: Item): number {
  const points = item.kind === 'whip' ? [item.from, item.to] : item.outline;
  return points.reduce((sum, p) => sum + p.depth, 0) / points.length;
}

/**
 * Painter's order: whenever two items overlap on screen, the farther one is painted first. A
 * topological sort of that relation, taking the farthest ready item each time; it fails loudly
 * if items hide each other in a cycle (none do in this model).
 */
export function paintingOrder(items: readonly Item[]): Item[] {
  const n = items.length;
  const before: Set<number>[] = items.map(() => new Set());
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = items[i];
      const b = items[j];
      if (!a || !b) continue;
      const v = nearer(a, b);
      if (v === 1) before[i]?.add(j);
      else if (v === -1) before[j]?.add(i);
    }
  }
  const order: Item[] = [];
  const done = new Set<number>();
  while (order.length < n) {
    let pick = -1;
    for (let i = 0; i < n; i++) {
      if (done.has(i) || [...(before[i] ?? [])].some((j) => !done.has(j))) continue;
      if (pick < 0 || meanDepth(items[i] as Item) > meanDepth(items[pick] as Item)) pick = i;
    }
    if (pick < 0) throw new Error('cubesat: no painting order exists');
    done.add(pick);
    order.push(items[pick] as Item);
  }
  return order;
}

/* ------------------------------------------------------------------------------------------ */
/* The scene                                                                                    */
/* ------------------------------------------------------------------------------------------ */

/** The Earth below, in viewBox units: a circle so large that only its curved limb shows. */
export const EARTH = { centre: { x: 160, y: 634 }, radius: 470 } as const;
/** Where the ground station sits on the limb: degrees from the top of the circle (negative is left). */
export const STATION_ANGLE = -11;

/** The point at `angle` degrees from the top of a circle round the Earth's centre. */
export function onCircle(radius: number, angle: number): Point {
  const a = angle * RAD;
  return { x: EARTH.centre.x + radius * Math.sin(a), y: EARTH.centre.y - radius * Math.cos(a) };
}

/** Points on a circle round the Earth's centre, from angle `from` to `to` (degrees). */
export function circleArc(radius: number, from: number, to: number, steps = 64): Point[] {
  return Array.from({ length: steps + 1 }, (_, i) => onCircle(radius, from + ((to - from) * i) / steps));
}

/** The half-angle (degrees) of the part of a circle round the Earth's centre that crosses the frame. */
export function halfSpan(radius: number): number {
  return Math.asin(Math.min(1, (VIEW.width / 2 + 4) / radius)) / RAD;
}

export interface CubesatScene {
  /** The model's visible faces and whips, in painting order (farthest first). */
  items: Item[];
  /** The orbit's radius round the Earth's centre: it runs through the body's centre. */
  orbitRadius: number;
  station: Point;
  /** The radio link, from the antennas to the station. */
  link: [Point, Point];
  /** The bounding box of the satellite on screen. */
  bounds: { x0: number; y0: number; x1: number; y1: number };
}

export function cubesatScene(camera: Camera = CAMERA): CubesatScene {
  const items = paintingOrder([...panelFaces(camera), ...bodyFaces(camera), ...whips(camera)]);
  const points = items.flatMap((item) => (item.kind === 'whip' ? [item.from, item.to] : item.outline));
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const station = onCircle(EARTH.radius, STATION_ANGLE);
  const root = antennaRoot(camera);
  return {
    items,
    orbitRadius: Math.hypot(camera.centre.x - EARTH.centre.x, camera.centre.y - EARTH.centre.y),
    station,
    link: [{ x: root.x, y: root.y }, station],
    bounds: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) },
  };
}
