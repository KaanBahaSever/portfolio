/**
 * The geometry of the tokamak drawing (Tokamak.astro), computed during the build: a small 3D model
 * (an ITER-like torus with D-shaped cross-sections, metres), projected orthographically from a
 * camera a little above the machine, shaded with one light, and painted back to front.
 *
 * The model: the plasma, a vacuum vessel with its blanket around it, toroidal field coils around
 * the vessel, and the central solenoid in the hole. A slice of the vessel and the coils is cut away
 * at the front, so the glowing plasma shows, and the far cut face shows the layers in cross-section.
 * Magnetic field lines are traced on the plasma surface and drawn where they can be seen.
 *
 * Pure TypeScript: the component only renders the paths. Tests check what the drawing promises.
 */

type Vec3 = readonly [number, number, number];
type Point = readonly [number, number];

/** A D-shaped cross-section (Miller parametrisation): minor radius, elongation, triangularity. */
interface Section {
  a: number;
  kappa: number;
  delta: number;
}

/** Major radius of the torus, m (ITER: 6.2 m). */
const R0 = 6.2;
const PLASMA: Section = { a: 2.0, kappa: 1.75, delta: 0.35 };
/** The vacuum gap between the plasma and the first wall. */
const FIRST_WALL: Section = { a: 2.3, kappa: 1.7, delta: 0.33 };
/** The blanket's outer surface, where the vacuum vessel begins. */
const BLANKET: Section = { a: 2.65, kappa: 1.64, delta: 0.3 };
const VESSEL: Section = { a: 2.95, kappa: 1.58, delta: 0.28 };
/** Centre line of the toroidal field coils, their radial thickness and toroidal width, m. */
const COIL: Section = { a: 3.65, kappa: 1.5, delta: 0.3 };
const COIL_THICKNESS = 0.55;
const COIL_WIDTH = 0.75;
const COILS = 18;
/** Central solenoid: radius and half height, m. */
const SOLENOID = { r: 1.85, h: 5.4 } as const;

/** Toroidal angles of the cut-away slice, degrees; −90° faces the camera, 0° points right. */
export const WINDOW = { from: -112, to: 8 } as const;

/** Camera elevation above the machine's midplane, degrees. */
const ELEVATION = 24;
/** Direction towards the light (up, left and towards the viewer), normalised below. */
const LIGHT: Vec3 = normalise([-0.55, -0.55, 0.7]);

/** The drawing's frame (viewBox units) and where the machine sits in it. */
export const VIEW = { width: 760, height: 470 } as const;
const CENTRE: Point = [380, 236];
const SCALE = 21.5;

const RAD = Math.PI / 180;
const sinE = Math.sin(ELEVATION * RAD);
const cosE = Math.cos(ELEVATION * RAD);
/** Unit vector from a surface towards the camera. */
const VIEWER: Vec3 = [0, -cosE, sinE];

function normalise(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / length, v[1] / length, v[2] / length];
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Screen position (viewBox units) and depth (larger is farther from the camera). */
function project([x, y, z]: Vec3): { p: Point; depth: number } {
  const up = z * cosE + y * sinE;
  return { p: [CENTRE[0] + SCALE * x, CENTRE[1] - SCALE * up], depth: y * cosE - z * sinE };
}

/** A point of a D-shaped section at poloidal angle θ, in (R, Z), with the outward normal. */
function sectionPoint(s: Section, theta: number) {
  const phase = theta + s.delta * Math.sin(theta);
  const r = R0 + s.a * Math.cos(phase);
  const z = s.kappa * s.a * Math.sin(theta);
  const dr = -s.a * Math.sin(phase) * (1 + s.delta * Math.cos(theta));
  const dz = s.kappa * s.a * Math.cos(theta);
  const length = Math.hypot(dr, dz);
  return { r, z, nr: dz / length, nz: -dr / length };
}

/** A point on the torus with section s, at toroidal angle φ and poloidal angle θ (radians). */
function torusPoint(s: Section, phi: number, theta: number, offset = 0) {
  const q = sectionPoint(s, theta);
  const r = q.r + offset * q.nr;
  const z = q.z + offset * q.nz;
  const position: Vec3 = [r * Math.cos(phi), r * Math.sin(phi), z];
  const normal: Vec3 = [q.nr * Math.cos(phi), q.nr * Math.sin(phi), q.nz];
  return { position, normal };
}

/** What a painted face is made of; the component maps each kind to a colour. */
export type Material = 'vessel' | 'coil' | 'solenoid' | 'plasma' | 'cut-vessel' | 'cut-blanket' | 'cut-gap' | 'cut-plasma';

export interface Face {
  material: Material;
  /** Lighting, 0 (shadow) to 1 (fully lit), in steps of 0.1. */
  light: number;
  points: Point[];
  depth: number;
  /**
   * Painting layer. Everything outside the cut-away slice lies behind at least one of the two cut
   * planes and the slice's contents lie in front of both, so they never hide what is in the slice:
   * 0 is painted first (outside the slice), then 1 (the cut faces), then 2 (inside the slice).
   */
  layer: 0 | 1 | 2;
}

/** Lambert shading with some ambient light, rounded to tenths so faces share styles. */
function shade(normal: Vec3): number {
  const lit = 0.25 + 0.75 * Math.max(0, dot(normal, LIGHT));
  return Math.round(lit * 10) / 10;
}

const inWindow = (phiDeg: number) => phiDeg > WINDOW.from && phiDeg < WINDOW.to;

/** Quads of a torus surface between toroidal angles, culled when they face away. */
function torusFaces(
  s: Section,
  material: Material,
  layer: Face['layer'],
  phiSteps: number[],
  thetaSteps: number,
  light = shade,
): Face[] {
  const faces: Face[] = [];
  for (let i = 0; i + 1 < phiSteps.length; i++) {
    const phi0 = (phiSteps[i] ?? 0) * RAD;
    const phi1 = (phiSteps[i + 1] ?? 0) * RAD;
    for (let j = 0; j < thetaSteps; j++) {
      const t0 = (j / thetaSteps) * 2 * Math.PI;
      const t1 = ((j + 1) / thetaSteps) * 2 * Math.PI;
      const centre = torusPoint(s, (phi0 + phi1) / 2, (t0 + t1) / 2);
      if (dot(centre.normal, VIEWER) <= 0) continue;
      const corners = [
        torusPoint(s, phi0, t0),
        torusPoint(s, phi1, t0),
        torusPoint(s, phi1, t1),
        torusPoint(s, phi0, t1),
      ].map((c) => project(c.position));
      faces.push({
        material,
        light: light(centre.normal),
        points: corners.map((c) => c.p),
        depth: project(centre.position).depth,
        layer,
      });
    }
  }
  return faces;
}

/** The outline of a section at toroidal angle φ, projected. */
function sectionOutline(s: Section, phi: number, steps = 72): Point[] {
  return Array.from({ length: steps }, (_, j) => project(torusPoint(s, phi, (j / steps) * 2 * Math.PI).position).p);
}

/** The cut face at one end of the window: the vessel, blanket, vacuum gap and plasma, nested. */
function cutFace(phiDeg: number, facing: 1 | -1): Face[] {
  const phi = phiDeg * RAD;
  // The face looks into the window: towards +φ at the window's start, −φ at its end.
  const normal: Vec3 = [-Math.sin(phi) * facing, Math.cos(phi) * facing, 0];
  if (dot(normal, VIEWER) <= 0) return [];
  const depth = project(torusPoint(BLANKET, phi, 0).position).depth;
  const light = shade(normal);
  return [
    { material: 'cut-vessel', light, points: sectionOutline(VESSEL, phi), depth, layer: 1 },
    { material: 'cut-blanket', light, points: sectionOutline(BLANKET, phi), depth, layer: 1 },
    { material: 'cut-gap', light, points: sectionOutline(FIRST_WALL, phi), depth, layer: 1 },
    { material: 'cut-plasma', light, points: sectionOutline(PLASMA, phi), depth, layer: 1 },
  ];
}

/** One toroidal field coil as a chain of boxes around the vessel. */
function coilFaces(phiDeg: number): Face[] {
  const faces: Face[] = [];
  const segments = 18;
  const half = COIL_WIDTH / 2 / (R0 + COIL.a); // half the coil's width as a toroidal angle
  const phi = phiDeg * RAD;
  const sides = [phi - half, phi + half];
  for (let j = 0; j < segments; j++) {
    const t0 = (j / segments) * 2 * Math.PI;
    const t1 = ((j + 1) / segments) * 2 * Math.PI;
    const corner = (side: number, t: number, offset: number) =>
      project(torusPoint(COIL, side, t, offset).position).p;
    const out = COIL_THICKNESS / 2;
    const mid = torusPoint(COIL, phi, (t0 + t1) / 2);
    const add = (normal: Vec3, points: Point[], centre: Vec3) => {
      if (dot(normal, VIEWER) <= 0) return;
      faces.push({ material: 'coil', light: shade(normal), points, depth: project(centre).depth, layer: 0 });
    };
    const [s0 = 0, s1 = 0] = sides;
    // Outer and inner surfaces of the coil case.
    for (const sign of [1, -1]) {
      const offset = sign * out;
      const centre = torusPoint(COIL, phi, (t0 + t1) / 2, offset).position;
      const normal: Vec3 = [mid.normal[0] * sign, mid.normal[1] * sign, mid.normal[2] * sign];
      add(normal, [corner(s0, t0, offset), corner(s1, t0, offset), corner(s1, t1, offset), corner(s0, t1, offset)], centre);
    }
    // The two flat sides.
    for (const [side, sign] of [
      [s0, -1],
      [s1, 1],
    ] as const) {
      const normal: Vec3 = [-Math.sin(side) * sign, Math.cos(side) * sign, 0];
      const centre = torusPoint(COIL, side, (t0 + t1) / 2).position;
      add(normal, [corner(side, t0, -out), corner(side, t0, out), corner(side, t1, out), corner(side, t1, -out)], centre);
    }
  }
  return faces;
}

/** The central solenoid: a cylinder in the hole of the torus, and its lid. */
function solenoidFaces(): Face[] {
  const faces: Face[] = [];
  const steps = 36;
  for (let k = 0; k < steps; k++) {
    const a0 = (k / steps) * 2 * Math.PI;
    const a1 = ((k + 1) / steps) * 2 * Math.PI;
    const am = (a0 + a1) / 2;
    const normal: Vec3 = [Math.cos(am), Math.sin(am), 0];
    if (dot(normal, VIEWER) <= 0) continue;
    const at = (a: number, z: number): Vec3 => [SOLENOID.r * Math.cos(a), SOLENOID.r * Math.sin(a), z];
    faces.push({
      material: 'solenoid',
      light: shade(normal),
      points: [at(a0, -SOLENOID.h), at(a1, -SOLENOID.h), at(a1, SOLENOID.h), at(a0, SOLENOID.h)].map((v) => project(v).p),
      depth: project([normal[0] * SOLENOID.r, normal[1] * SOLENOID.r, 0]).depth,
      layer: inWindow(Math.atan2(normal[1], normal[0]) / RAD) ? 2 : 0,
    });
  }
  faces.push({
    material: 'solenoid',
    light: shade([0, 0, 1]),
    points: Array.from({ length: steps }, (_, k) => {
      const a = (k / steps) * 2 * Math.PI;
      return project([SOLENOID.r * Math.cos(a), SOLENOID.r * Math.sin(a), SOLENOID.h]).p;
    }),
    depth: project([0, 0, SOLENOID.h]).depth,
    layer: 0,
  });
  return faces;
}

/** Toroidal angles from a to b in steps of at most `step` degrees, ending exactly at b. */
function steps(a: number, b: number, step: number): number[] {
  const count = Math.max(1, Math.ceil((b - a) / step));
  return Array.from({ length: count + 1 }, (_, i) => a + ((b - a) * i) / count);
}

/** Even-odd point-in-polygon test. */
function inside(point: Point, polygon: readonly Point[]): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi = 0, yi = 0] = polygon[i] ?? [];
    const [xj = 0, yj = 0] = polygon[j] ?? [];
    if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function boxOf(points: readonly Point[]): Box {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Points spread over a face: its outline every few units and, for quads, a grid inside. */
function probesOf(points: readonly Point[]): Point[] {
  const SPACING = 3;
  const probes: Point[] = [];
  for (let k = 0; k < points.length; k++) {
    const a = points[k] ?? [0, 0];
    const b = points[(k + 1) % points.length] ?? [0, 0];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / SPACING));
    for (let i = 0; i < n; i++) probes.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
  }
  if (points.length === 4) {
    const [p0 = [0, 0], p1 = [0, 0], p2 = [0, 0], p3 = [0, 0]] = points;
    const across = Math.max(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), Math.hypot(p2[0] - p3[0], p2[1] - p3[1]));
    const down = Math.max(Math.hypot(p3[0] - p0[0], p3[1] - p0[1]), Math.hypot(p2[0] - p1[0], p2[1] - p1[1]));
    const nu = Math.max(2, Math.ceil(across / SPACING));
    const nv = Math.max(2, Math.ceil(down / SPACING));
    for (let i = 1; i < nu; i++) {
      for (let j = 1; j < nv; j++) {
        const u = i / nu;
        const v = j / nv;
        probes.push([
          (1 - u) * (1 - v) * p0[0] + u * (1 - v) * p1[0] + u * v * p2[0] + (1 - u) * v * p3[0],
          (1 - u) * (1 - v) * p0[1] + u * (1 - v) * p1[1] + u * v * p2[1] + (1 - u) * v * p3[1],
        ]);
      }
    }
  } else {
    const box = boxOf(points);
    probes.push([(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2]);
  }
  return probes;
}

/**
 * Drops faces that later faces paint over completely: a face goes when points spread over it
 * every few units all lie inside faces painted after it. Saves most of the hidden back of the
 * machine, and page weight with it.
 */
function withoutHidden(faces: readonly Face[]): Face[] {
  const boxes = faces.map((face) => boxOf(face.points));
  const covered = (point: Point, after: number) => {
    for (let j = after + 1; j < faces.length; j++) {
      const box = boxes[j];
      if (!box || point[0] < box.x0 || point[0] > box.x1 || point[1] < box.y0 || point[1] > box.y1) continue;
      if (inside(point, faces[j]?.points ?? [])) return true;
    }
    return false;
  };
  return faces.filter((face, i) => {
    // Cut-face layers cover each other on purpose; keep them all.
    if (face.material.startsWith('cut-')) return true;
    return !probesOf(face.points).every((p) => covered(p, i));
  });
}

/** Number of field lines drawn, evenly spaced around the plasma. */
export const FIELD_LINES = 4;
/**
 * Toroidal turns per poloidal turn of a drawn field line. Real tokamaks twist more gently (about
 * three toroidal turns per poloidal one at the edge); the drawing exaggerates the twist so the
 * helix shows within the cut-away slice.
 */
export const DRAWN_SAFETY_FACTOR = 0.9;

/**
 * Visible stretches of the helical field lines on the plasma surface inside the window, as
 * polylines: a point shows when the surface faces the camera and no nearer face covers it.
 */
function fieldLines(painted: readonly Face[]): Point[][] {
  const runs: Point[][] = [];
  const from = WINDOW.from + 2;
  const to = WINDOW.to - 2;
  for (let line = 0; line < FIELD_LINES; line++) {
    let run: Point[] = [];
    const samples = 160;
    for (let i = 0; i <= samples; i++) {
      const phiDeg = from + ((to - from) * i) / samples;
      const phi = phiDeg * RAD;
      const theta = 0.6 + (line * 2 * Math.PI) / FIELD_LINES + (phi - from * RAD) / DRAWN_SAFETY_FACTOR;
      const { position, normal } = torusPoint(PLASMA, phi, theta, 0.04);
      const { p, depth } = project(position);
      // Only the slice's own contents can hide it (see Face.layer); the plasma tube may hide its
      // own far side, so plasma faces count only when clearly nearer than the point.
      const visible =
        dot(normal, VIEWER) > 0.05 &&
        !painted.some(
          (face) =>
            face.layer === 2 &&
            face.depth < depth - (face.material === 'plasma' ? 0.6 : 0.05) &&
            inside(p, face.points),
        );
      if (visible) run.push(p);
      else if (run.length) {
        if (run.length > 2) runs.push(run);
        run = [];
      }
    }
    if (run.length > 2) runs.push(run);
  }
  return runs;
}

/** Points the labels of the drawing point at (viewBox units). */
export interface Anchors {
  plasma: Point;
  fieldLine: Point;
  coil: Point;
  solenoid: Point;
  blanket: Point;
  vessel: Point;
}

/** The whole drawing: faces in painting order (farthest first), field lines, label anchors. */
function buildDrawing() {
  const vesselSteps = [...steps(WINDOW.to, 360 + WINDOW.from, 6)];
  const faces: Face[] = [
    ...torusFaces(VESSEL, 'vessel', 0, vesselSteps, 22),
    ...torusFaces(PLASMA, 'plasma', 2, steps(WINDOW.from, WINDOW.to, 4), 26, (normal) => {
      // Optically thin plasma looks brightest at its rim, where the line of sight is longest.
      const facing = Math.max(0, dot(normal, VIEWER));
      return Math.round((1 - facing) * 10) / 10;
    }),
    ...cutFace(WINDOW.from, 1),
    ...cutFace(WINDOW.to, -1),
    ...solenoidFaces(),
  ];
  const coilAngles: number[] = [];
  for (let k = 0; k < COILS; k++) {
    const phi = -90 + 10 + (k * 360) / COILS;
    const wrapped = ((phi + 180) % 360 + 360) % 360 - 180;
    const margin = ((COIL_WIDTH / 2 / (R0 + COIL.a)) / RAD) + 1;
    if (wrapped > WINDOW.from - margin && wrapped < WINDOW.to + margin) continue;
    coilAngles.push(wrapped);
    faces.push(...coilFaces(wrapped));
  }
  // Stable order: farthest first; ties keep generation order (a cut face's nested layers).
  const sorted = faces
    .map((face, index) => ({ face, index }))
    .sort((a, b) => a.face.layer - b.face.layer || b.face.depth - a.face.depth || a.index - b.index)
    .map(({ face }) => face);
  const painted = withoutHidden(sorted);

  const lines = fieldLines(painted);
  const longest = [...lines].sort((a, b) => b.length - a.length)[0] ?? [];

  // Label anchors, from the model.
  const at = (s: Section, phiDeg: number, thetaDeg: number, offset = 0) =>
    project(torusPoint(s, phiDeg * RAD, thetaDeg * RAD, offset).position).p;
  // A coil on the left, seen from the side: its outer leg, just below the midplane.
  const sideCoil = coilAngles.reduce((best, phi) => (Math.abs(phi + 160) < Math.abs(best + 160) ? phi : best), 180);
  const anchors: Anchors = {
    plasma: at(PLASMA, -60, -25),
    fieldLine: longest[Math.floor(longest.length * 0.55)] ?? at(PLASMA, -40, 20),
    coil: at(COIL, sideCoil, -12, COIL_THICKNESS / 2),
    solenoid: project([0, -SOLENOID.r * 0.2, SOLENOID.h]).p,
    blanket: at({ ...BLANKET, a: (BLANKET.a + FIRST_WALL.a) / 2 }, WINDOW.to, 60),
    vessel: at({ ...VESSEL, a: (VESSEL.a + BLANKET.a) / 2 }, WINDOW.to, 25),
  };
  // The magnetic axis through the slice, for the plasma's glow.
  const axis = steps(WINDOW.from, WINDOW.to, 4).map((phiDeg) => {
    const r = R0 + 0.15;
    return project([r * Math.cos(phiDeg * RAD), r * Math.sin(phiDeg * RAD), 0]).p;
  });
  return { faces: painted, fieldLines: lines, anchors, axis, coils: coilAngles.length };
}

let cached: ReturnType<typeof buildDrawing> | undefined;

/** The drawing, computed once per build (both language versions of the post use it). */
export function tokamakDrawing() {
  cached ??= buildDrawing();
  return cached;
}

/** A number in tenths of a unit, written short: 12.0 → "12", −0.5 → "-.5". */
function fmt(tenths: number): string {
  const text = (tenths / 10).toString();
  return text.replace(/^(-?)0\./, '$1.');
}

/** Relative path data through points rounded to tenths (deltas between rounded points, so no drift). */
function relative(points: readonly Point[]): string {
  const rounded = points.map(([x, y]) => [Math.round(x * 10), Math.round(y * 10)] as const);
  const [first = [0, 0]] = rounded;
  let d = `M${fmt(first[0])} ${fmt(first[1])}`;
  for (let i = 1; i < rounded.length; i++) {
    const [x = 0, y = 0] = rounded[i] ?? [];
    const [px = 0, py = 0] = rounded[i - 1] ?? [];
    const dx = fmt(x - px);
    const dy = fmt(y - py);
    d += `${i === 1 ? 'l' : dx.startsWith('-') ? '' : ' '}${dx}${dy.startsWith('-') ? '' : ' '}${dy}`;
  }
  return d;
}

/** Twice the signed area of a polygon (positive when clockwise on screen, y pointing down). */
function signedArea(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi = 0, yi = 0] = points[i] ?? [];
    const [xj = 0, yj = 0] = points[j] ?? [];
    sum += (xj - xi) * (yj + yi);
  }
  return -sum;
}

/**
 * SVG path data for a closed polygon, always wound the same way, so that faces merged into one
 * path add up under the nonzero fill rule instead of cutting holes where they overlap.
 */
export function polygonPath(points: readonly Point[]): string {
  const ordered = signedArea(points) < 0 ? [...points].reverse() : points;
  return relative(ordered) + 'z';
}

/** SVG path data for an open polyline. */
export function polylinePath(points: readonly Point[]): string {
  return relative(points);
}

/**
 * Faces grouped into paths: consecutive faces with the same material and light share one path,
 * which keeps the painting order and keeps the page small.
 */
export function paintRuns(faces: readonly Face[]): { material: Material; light: number; d: string }[] {
  const runs: { material: Material; light: number; d: string }[] = [];
  for (const face of faces) {
    const last = runs.at(-1);
    const d = polygonPath(face.points);
    // Cut-face layers are nested shapes painted over each other: never merge them.
    if (last && last.material === face.material && last.light === face.light && !face.material.startsWith('cut-')) {
      last.d += d;
    } else runs.push({ material: face.material, light: face.light, d });
  }
  return runs;
}
