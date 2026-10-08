/**
 * The CubeSat figure (#journey-cubesat), computed during the build: a schematic 1U CubeSat (a
 * 10 cm cube with solar cells on its faces and two antenna whips) drawn in 3D as a wireframe, on
 * its orbit above the Earth, with the stretch of the orbit a ground station can see.
 *
 * The cube is a small 3D model in centimetres, projected orthographically from a camera a little
 * above it: faces turned away from the camera are culled, and an edge shows when one of its two
 * faces does (a line drawing, like the other figures). The scene around it is the
 * ground-station geometry from geometry.ts (visibleHalfAngle()) for the drawn radii, so the
 * highlighted arc ends exactly where the satellite sinks to 10° above the station's horizon.
 *
 * Pure TypeScript (no DOM, no `astro:*`), so `node --test` can load it. The component only
 * renders what cubesatScene() returns.
 */
import { MIN_ELEVATION, visibleHalfAngle, type Point } from './geometry.ts';

export type Vec3 = readonly [number, number, number];

/* ------------------------------------------------------------------------------------------ */
/* The model, in centimetres: a cube centred on the origin, z up (away from the Earth)          */
/* ------------------------------------------------------------------------------------------ */

/** A 1U CubeSat is a 10 cm cube. */
export const EDGE = 10;
/** The rails along the cube's edges are 8.5 mm wide; the solar cells sit inside them. */
export const RAIL = 0.85;
/** Two solar cells on each face, 8 × 4 cm (the usual size of a triple-junction cell), one above the other. */
export const CELL = { width: 8, height: 4, perFace: 2, gap: 0.25 } as const;
/**
 * Two antenna whips folded out in the plane of the top face, from the middle of its left and back
 * edges. Those are the edges on the cube's outline from this camera, so the whips never cross a
 * face. Drawn short: the figure only needs to say that the satellite has antennas.
 */
export const WHIP = { count: 2, length: 9 } as const;
const WHIP_DIRECTIONS: Vec3[] = [
  [-1, 0, 0],
  [0, 1, 0],
];

/* ------------------------------------------------------------------------------------------ */
/* The camera                                                                                   */
/* ------------------------------------------------------------------------------------------ */

/** The drawing's frame, in viewBox units. */
export const VIEW = { width: 320, height: 200 } as const;

export interface Camera {
  /** Degrees the camera has swung round from straight in front (−y), towards +x. */
  azimuth: number;
  /** Degrees above the cube's top face. */
  elevation: number;
  /** viewBox units per centimetre. */
  scale: number;
  /** Where the cube's centre lands. */
  centre: Point;
}

const RAD = Math.PI / 180;

export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The camera's frame: screen right, screen up, and the direction towards the viewer. */
export function cameraBasis(camera: Pick<Camera, 'azimuth' | 'elevation'>): { right: Vec3; up: Vec3; toward: Vec3 } {
  const a = camera.azimuth * RAD;
  const e = camera.elevation * RAD;
  return {
    right: [Math.cos(a), Math.sin(a), 0],
    up: [-Math.sin(e) * Math.sin(a), Math.sin(e) * Math.cos(a), Math.cos(e)],
    toward: [Math.cos(e) * Math.sin(a), -Math.cos(e) * Math.cos(a), Math.sin(e)],
  };
}

/** A projected point: screen position (viewBox units) and depth (larger is farther away). */
export interface Projected extends Point {
  depth: number;
}

/** Orthographic projection; screen y grows downwards. */
export function project(p: Vec3, camera: Camera): Projected {
  const { right, up, toward } = cameraBasis(camera);
  return {
    x: camera.centre.x + camera.scale * dot(p, right),
    y: camera.centre.y - camera.scale * dot(p, up),
    depth: -camera.scale * dot(p, toward),
  };
}

/* ------------------------------------------------------------------------------------------ */
/* The cube                                                                                     */
/* ------------------------------------------------------------------------------------------ */

/** The eight corners, indexed by bits: x is bit 0, y bit 1, z bit 2 (0 is −5 cm, 1 is +5 cm). */
const CORNERS: Vec3[] = Array.from({ length: 8 }, (_, i) => [
  (i & 1 ? 1 : -1) * (EDGE / 2),
  (i & 2 ? 1 : -1) * (EDGE / 2),
  (i & 4 ? 1 : -1) * (EDGE / 2),
]);

/** The six faces: outward normal, the four corners in order round the face, and its in-plane axes. */
const FACES: { normal: Vec3; corners: number[]; across: Vec3; upward: Vec3 }[] = [
  { normal: [1, 0, 0], corners: [1, 3, 7, 5], across: [0, 1, 0], upward: [0, 0, 1] },
  { normal: [-1, 0, 0], corners: [0, 4, 6, 2], across: [0, -1, 0], upward: [0, 0, 1] },
  { normal: [0, 1, 0], corners: [2, 6, 7, 3], across: [-1, 0, 0], upward: [0, 0, 1] },
  { normal: [0, -1, 0], corners: [0, 1, 5, 4], across: [1, 0, 0], upward: [0, 0, 1] },
  { normal: [0, 0, 1], corners: [4, 5, 7, 6], across: [1, 0, 0], upward: [0, 1, 0] },
  { normal: [0, 0, -1], corners: [0, 2, 3, 1], across: [1, 0, 0], upward: [0, -1, 0] },
];

/** The twelve edges, as pairs of corners that differ in one coordinate. */
const EDGES: [number, number][] = [];
for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) if (!(i & bit)) EDGES.push([i, i | bit]);

export interface CubeFace {
  normal: Vec3;
  outline: Projected[];
  /** The face's solar cells: closed quads, projected. */
  cells: Projected[][];
}

export interface Cube {
  /** The corners, projected, in CORNERS order. */
  corners: Projected[];
  /** Faces turned towards the camera (back faces culled). */
  faces: CubeFace[];
  /** The edges of the visible faces; the three behind them are left out. */
  edges: [Projected, Projected][];
  /** The cube's outline on screen (convex), filled with the panel colour behind the edges. */
  silhouette: Point[];
  whips: [Projected, Projected][];
}

const plus = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];

/** The convex hull of points on screen (Andrew's monotone chain). */
export function convexHull(points: readonly Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: Point[]) => {
    const chain: Point[] = [];
    for (const p of list) {
      while (chain.length >= 2 && cross(chain[chain.length - 2] as Point, chain[chain.length - 1] as Point, p) <= 1e-9) chain.pop();
      chain.push(p);
    }
    chain.pop();
    return chain;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

export function cube(camera: Camera): Cube {
  const { toward } = cameraBasis(camera);
  const corners = CORNERS.map((c) => project(c, camera));
  const front = FACES.map((face) => dot(face.normal, toward) > 0);
  const faces: CubeFace[] = FACES.filter((_, i) => front[i]).map((face) => {
    const centre: Vec3 = [face.normal[0] * (EDGE / 2), face.normal[1] * (EDGE / 2), face.normal[2] * (EDGE / 2)];
    const cells = Array.from({ length: CELL.perFace }, (_, k) => {
      // The cells stack round the face's centre: k = 0 below, k = 1 above.
      const offset = (k - (CELL.perFace - 1) / 2) * (CELL.height + CELL.gap);
      const middle = plus(centre, face.upward, offset);
      const u = CELL.width / 2;
      const v = CELL.height / 2;
      return [
        plus(plus(middle, face.across, -u), face.upward, -v),
        plus(plus(middle, face.across, u), face.upward, -v),
        plus(plus(middle, face.across, u), face.upward, v),
        plus(plus(middle, face.across, -u), face.upward, v),
      ].map((p) => project(p, camera));
    });
    return { normal: face.normal, outline: face.corners.map((i) => corners[i] as Projected), cells };
  });
  // An edge belongs to the two faces that contain both its corners; it shows when one of them does.
  const edges = EDGES.filter(([a, b]) =>
    FACES.some((face, i) => front[i] && face.corners.includes(a) && face.corners.includes(b)),
  ).map(([a, b]): [Projected, Projected] => [corners[a] as Projected, corners[b] as Projected]);
  const whips = WHIP_DIRECTIONS.map((direction): [Projected, Projected] => {
    const root = plus([0, 0, EDGE / 2], direction, EDGE / 2);
    return [project(root, camera), project(plus(root, direction, WHIP.length), camera)];
  });
  return { corners, faces, edges, silhouette: convexHull(corners), whips };
}

/* ------------------------------------------------------------------------------------------ */
/* The scene: the Earth, the orbit, the ground station and its visible arc                      */
/* ------------------------------------------------------------------------------------------ */

/**
 * Earth's centre and the two radii, in viewBox units. Not to scale (the altitude is exaggerated
 * about fifteen times, and the satellite far more); the caption says so. The bottom of the Earth
 * and of the orbit run off the frame: the pass happens at the top.
 */
export const EARTH = { centre: { x: 160, y: 178 }, radius: 64 } as const;
export const ORBIT = 120;
/** Where the satellite is on its orbit, degrees from the top (negative is left): inside the pass. */
export const SATELLITE_ANGLE = -22;

/** The camera on the cube: a little above it, from the front right. */
const CAMERA_VIEW = { azimuth: 36, elevation: 30, scale: 4 } as const;

/** The point at `angle` degrees from the top of a circle of radius r round the Earth's centre. */
export function onCircle(radius: number, angle: number): Point {
  const a = angle * RAD;
  return { x: EARTH.centre.x + radius * Math.sin(a), y: EARTH.centre.y - radius * Math.cos(a) };
}

/** Points on a circle round the Earth's centre, from angle `from` to `to` (degrees from the top). */
export function circleArc(radius: number, from: number, to: number, steps = 64): Point[] {
  return Array.from({ length: steps + 1 }, (_, i) => onCircle(radius, from + ((to - from) * i) / steps));
}

export interface CubesatScene {
  camera: Camera;
  cube: Cube;
  /** The ground station, at the top of the Earth. */
  station: Point;
  /** Half the Earth-central angle of the arc the station sees ≥ 10° above its horizon, degrees. */
  halfAngle: number;
  /** That arc of the orbit, and the rest of the orbit (whatever crosses the frame). */
  visibleArc: Point[];
  hiddenArc: Point[];
  /** The line of sight from the station to the satellite. */
  link: [Point, Point];
}

export function cubesatScene(): CubesatScene {
  const centre = onCircle(ORBIT, SATELLITE_ANGLE);
  const camera: Camera = { ...CAMERA_VIEW, centre };
  const halfAngle = visibleHalfAngle(EARTH.radius, ORBIT - EARTH.radius, MIN_ELEVATION);
  const station = onCircle(EARTH.radius, 0);
  return {
    camera,
    cube: cube(camera),
    station,
    halfAngle,
    visibleArc: circleArc(ORBIT, -halfAngle, halfAngle, 64),
    hiddenArc: circleArc(ORBIT, halfAngle, 360 - halfAngle, 192),
    link: [station, centre],
  };
}
