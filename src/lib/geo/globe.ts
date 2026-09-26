/**
 * The globe figure as SVG path data: an orthographic projection (the Earth as seen from far
 * away) with a graticule, the great circle through two points and the route between them.
 * Pure geometry; the page renders the first frame on the server and the browser redraws it.
 *
 * Coordinates are SVG user units with the disc centred on (0, 0) and y pointing down. Every
 * curve is sampled on the sphere and cut exactly where it crosses the horizon (the limb), so
 * the near side and the far side can be styled apart.
 */
import {
  POINT_TOLERANCE,
  cross,
  destination,
  fromVector,
  midpoint,
  norm,
  normalizeLongitude,
  toVector,
  vectorAngle,
  type LatLon,
  type Vec3,
} from './sphere.ts';

export interface GlobeOptions {
  /** Radius of the disc in user units. */
  radius: number;
  /** Degrees between graticule lines. */
  graticuleStep?: number;
  /** Degrees between samples along a curve (5° keeps chords within 0.1 % of the radius). */
  sampleStep?: number;
  /** Decimals in the path data. */
  decimals?: number;
}

/** The viewer's axes: out of the screen (towards the viewer), to the right, and up. */
export interface ViewFrame {
  center: Vec3;
  east: Vec3;
  north: Vec3;
}

/** A point on the unit disc: x right, y down; z > 0 on the near side, z < 0 behind the globe. */
export interface Projected {
  x: number;
  y: number;
  z: number;
}

export interface Marker {
  x: number;
  y: number;
  visible: boolean;
}

export interface LabelledMarker extends Marker {
  /** Centre of the marker's letter, set off away from the other marker. */
  labelX: number;
  labelY: number;
}

export interface GlobeScene {
  /** Meridians and parallels except the equator, near side only. */
  graticule: string;
  equator: string;
  /** The rest of the great circle through A and B, near and far side. */
  circleFront: string;
  circleBack: string;
  /** The route from A to B: near side, and any part behind the globe while it turns. */
  route: string;
  routeHidden: string;
  a: LabelledMarker;
  b: LabelledMarker;
  midpoint: Marker | null;
}

export function viewFrame(center: LatLon): ViewFrame {
  const c = toVector(center);
  const λ = (center.lon * Math.PI) / 180;
  const φ = (center.lat * Math.PI) / 180;
  return {
    center: c,
    east: [-Math.sin(λ), Math.cos(λ), 0],
    north: [-Math.sin(φ) * Math.cos(λ), -Math.sin(φ) * Math.sin(λ), Math.cos(φ)],
  };
}

function projectVector(v: Vec3, frame: ViewFrame): Projected {
  const { center, east, north } = frame;
  return {
    x: v[0] * east[0] + v[1] * east[1] + v[2] * east[2],
    y: -(v[0] * north[0] + v[1] * north[1] + v[2] * north[2]),
    z: v[0] * center[0] + v[1] * center[1] + v[2] * center[2],
  };
}

/** Projects a point onto the unit disc of a globe facing `frame`. */
export function project(point: LatLon, frame: ViewFrame): Projected {
  return projectVector(toVector(point), frame);
}

/** How far the view is tilted off the route's midpoint, in radians (25°). */
export const VIEW_TILT = (25 * Math.PI) / 180;

/**
 * Where the globe should face. Seen from straight above its midpoint, any great-circle route
 * projects to a straight diameter and its curve disappears; so the view is tilted by VIEW_TILT
 * from the midpoint, at right angles to the route and towards the equator, and the route shows
 * as an arc bowing towards the pole, as on a printed globe. The whole route stays on the near
 * side: by the spherical Pythagorean theorem its ends are acos(cos(δ/2)·cos(tilt)) < 90° from
 * the centre.
 *
 * Coincident points: the view tilts from the point towards the equator. Antipodal points: a
 * quarter turn north of A, so A and B sit on opposite edges of the disc.
 */
export function viewCenter(a: LatLon, b: LatLon): LatLon {
  const δ = vectorAngle(a, b);
  if (Math.PI - δ < POINT_TOLERANCE) return destination(a, 0, Math.PI / 2);
  if (δ < POINT_TOLERANCE) return destination(a, a.lat >= 0 ? 180 : 0, VIEW_TILT);
  const middle = midpoint(a, b);
  const normal = cross(toVector(a), toVector(b));
  const length = norm(normal);
  if (!middle || length === 0) return { lat: a.lat, lon: normalizeLongitude(a.lon) };
  const m = toVector(middle);
  // The normal of the route's plane is a tangent at the midpoint, square to the route. Point it
  // towards the equator (for a route along a meridian it is level: either way will do).
  const sign = m[2] * normal[2] > 0 ? -1 : 1;
  const p: Vec3 = [(sign * normal[0]) / length, (sign * normal[1]) / length, (sign * normal[2]) / length];
  const c = Math.cos(VIEW_TILT);
  const s = Math.sin(VIEW_TILT);
  return fromVector([c * m[0] + s * p[0], c * m[1] + s * p[1], c * m[2] + s * p[2]]);
}

// ------------------------------------------------------------------ path data

type Side = 'front' | 'back';

interface PathWriter {
  /** Draws a sampled curve, starting a new subpath wherever it crosses the horizon. */
  curve(points: readonly Projected[]): void;
  /** The path data drawn so far on one side. */
  data(side: Side): string;
}

function pathWriter(radius: number, decimals: number): PathWriter {
  const parts: Record<Side, string[]> = { front: [], back: [] };
  const open: Record<Side, boolean> = { front: false, back: false };
  const scale = 10 ** decimals;
  // + 0 turns −0 into 0.
  const number = (value: number) => String(Math.round(value * radius * scale) / scale + 0);

  const point = (side: Side, p: { x: number; y: number }) => {
    parts[side].push(`${open[side] ? 'L' : 'M'}${number(p.x)} ${number(p.y)}`);
    open[side] = true;
  };

  return {
    curve(points) {
      let previous: Projected | undefined;
      for (const current of points) {
        const side: Side = current.z >= 0 ? 'front' : 'back';
        if (previous && previous.z >= 0 !== current.z >= 0) {
          // The crossing, by linear interpolation between the samples, pushed out onto the limb.
          const t = previous.z / (previous.z - current.z);
          const x = previous.x + (current.x - previous.x) * t;
          const y = previous.y + (current.y - previous.y) * t;
          const length = Math.hypot(x, y) || 1;
          const limb = { x: x / length, y: y / length };
          const previousSide: Side = side === 'front' ? 'back' : 'front';
          point(previousSide, limb);
          open[previousSide] = false;
          point(side, limb);
        }
        point(side, current);
        previous = current;
      }
      open.front = false;
      open.back = false;
    },
    data(side) {
      return parts[side].join('');
    },
  };
}

function range(from: number, to: number, step: number): number[] {
  const count = Math.max(1, Math.ceil((to - from) / step - 1e-9));
  return Array.from({ length: count + 1 }, (_, i) => (i === count ? to : from + i * step));
}

/** Samples of the great circle through u (at t = 0) in the plane spanned by u and w, for t in [from, to] radians. */
function arc(u: Vec3, w: Vec3, from: number, to: number, step: number): Vec3[] {
  return range(from, to, step).map((t) => {
    const c = Math.cos(t);
    const s = Math.sin(t);
    return [c * u[0] + s * w[0], c * u[1] + s * w[1], c * u[2] + s * w[2]] as const;
  });
}

function marker(p: Projected, radius: number): Marker {
  return { x: p.x * radius, y: p.y * radius, visible: p.z >= -1e-9 };
}

/**
 * Sets a letter off its marker, on the side facing away from the other marker (beyond the end
 * of the route), and keeps it inside the figure.
 */
function label(own: Marker, other: Marker, fallback: -1 | 1, radius: number): LabelledMarker {
  let dx = own.x - other.x;
  let dy = own.y - other.y;
  let length = Math.hypot(dx, dy);
  if (length < radius * 0.01) {
    dx = fallback;
    dy = 0;
    length = 1;
  }
  const offset = radius * 0.1;
  const limit = radius * 1.02;
  const clamp = (value: number) => Math.min(limit, Math.max(-limit, value));
  return { ...own, labelX: clamp(own.x + (dx / length) * offset), labelY: clamp(own.y + (dy / length) * offset) };
}

/** Builds every path and marker of the figure for points `a` and `b`, seen from above `center`. */
export function globeScene(a: LatLon, b: LatLon, center: LatLon, options: GlobeOptions): GlobeScene {
  const { radius, graticuleStep = 15, sampleStep = 5, decimals = 1 } = options;
  const frame = viewFrame(center);
  const toScreen = (v: Vec3) => projectVector(v, frame);
  const step = (sampleStep * Math.PI) / 180;

  // Graticule: meridians pole to pole, parallels all the way round; the equator on its own.
  const graticule = pathWriter(radius, decimals);
  for (const lon of range(-180, 180 - graticuleStep, graticuleStep)) {
    graticule.curve(range(-90, 90, sampleStep).map((lat) => toScreen(toVector({ lat, lon }))));
  }
  for (const lat of range(-90 + graticuleStep, 90 - graticuleStep, graticuleStep)) {
    if (Math.abs(lat) < 1e-9) continue;
    graticule.curve(range(-180, 180, sampleStep).map((lon) => toScreen(toVector({ lat, lon }))));
  }
  const equator = pathWriter(radius, decimals);
  equator.curve(range(-180, 180, sampleStep).map((lon) => toScreen(toVector({ lat: 0, lon }))));

  // The great circle through A and B, from A: u = A, w = the direction of travel towards B.
  const circle = pathWriter(radius, decimals);
  const route = pathWriter(radius, decimals);
  const va = toVector(a);
  const vb = toVector(b);
  const δ = vectorAngle(a, b);
  const normal = cross(va, vb);
  const normalLength = norm(normal);
  if (δ >= POINT_TOLERANCE && Math.PI - δ >= POINT_TOLERANCE && normalLength > 0) {
    const n: Vec3 = [normal[0] / normalLength, normal[1] / normalLength, normal[2] / normalLength];
    const w = cross(n, va);
    route.curve(arc(va, w, 0, δ, step).map(toScreen));
    circle.curve(arc(va, w, δ, 2 * Math.PI, step).map(toScreen));
  }

  const markerA = marker(toScreen(va), radius);
  const markerB = marker(toScreen(vb), radius);
  const middle = midpoint(a, b);

  return {
    graticule: graticule.data('front'),
    equator: equator.data('front'),
    circleFront: circle.data('front'),
    circleBack: circle.data('back'),
    route: route.data('front'),
    routeHidden: route.data('back'),
    a: label(markerA, markerB, -1, radius),
    b: label(markerB, markerA, 1, radius),
    midpoint: middle && δ >= POINT_TOLERANCE ? marker(project(middle, frame), radius) : null,
  };
}
