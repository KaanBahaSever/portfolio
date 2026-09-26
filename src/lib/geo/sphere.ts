/**
 * Great-circle geometry on a spherical Earth: the haversine distance, initial and final
 * bearings, the midpoint and points along the route.
 *
 * Angles in and out are degrees (latitude φ, longitude λ, bearings clockwise from north);
 * internally everything is radians. Pure module (no DOM), shared by the page, the browser
 * controller and the tests.
 *
 * Two formulas for the same central angle live here on purpose:
 * - the haversine formula (the distance the tool reports) is well conditioned for short
 *   distances, where the spherical law of cosines loses its digits to rounding;
 * - the vector form atan2(|a × b|, a · b) is well conditioned everywhere, including near π,
 *   where the haversine's arcsin flattens out. It decides whether two points coincide or are
 *   antipodal, so that decision does not depend on the haversine's weakest region.
 */

export interface LatLon {
  /** Latitude in degrees, −90 … 90 (south negative). */
  readonly lat: number;
  /** Longitude in degrees, −180 … 180 (west negative). */
  readonly lon: number;
}

/** Mean Earth radius R₁ = (2a + b) / 3 of the IUGG / GRS 80 ellipsoid, in kilometres. */
export const MEAN_EARTH_RADIUS_KM = 6371.0088;

export const DISTANCE_UNITS = ['km', 'mi', 'nmi'] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];

/** Kilometres in one unit: the international mile (1959) and the international nautical mile (1929). */
export const KM_PER_UNIT: Readonly<Record<DistanceUnit, number>> = { km: 1, mi: 1.609344, nmi: 1.852 };

export function isDistanceUnit(value: unknown): value is DistanceUnit {
  return (DISTANCE_UNITS as readonly unknown[]).includes(value);
}

/** Converts a distance in kilometres to `unit`. */
export function fromKm(km: number, unit: DistanceUnit): number {
  return km / KM_PER_UNIT[unit];
}

/**
 * Points closer than this (radians, about 0.6 mm on the Earth) coincide; points this close to
 * antipodal are treated as antipodal. Far below the precision anyone types coordinates with.
 */
export const POINT_TOLERANCE = 1e-10;

const DEG = Math.PI / 180;

export function toRadians(degrees: number): number {
  return degrees * DEG;
}

export function toDegrees(radians: number): number {
  return radians / DEG;
}

/** Wraps a longitude into (−180, 180]. The antimeridian is written as 180, never −180. */
export function normalizeLongitude(lon: number): number {
  // In range already: return it untouched, free of the wrap's rounding.
  if (lon > -180 && lon <= 180) return lon + 0;
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped + 0;
}

/** Wraps a bearing into [0, 360). */
export function normalizeBearing(degrees: number): number {
  const wrapped = ((degrees % 360) + 360) % 360;
  // (−1e-15 % 360 + 360) % 360 is 360 in floating point: fold it back.
  return wrapped >= 360 ? 0 : wrapped + 0;
}

// ------------------------------------------------------------------ vectors

export type Vec3 = readonly [number, number, number];

/** The unit position vector of a point (x towards 0° N 0° E, z towards the North Pole). */
export function toVector(point: LatLon): Vec3 {
  const φ = toRadians(point.lat);
  const λ = toRadians(point.lon);
  const cosφ = Math.cos(φ);
  return [cosφ * Math.cos(λ), cosφ * Math.sin(λ), Math.sin(φ)];
}

/** The point a (not necessarily unit) vector points at. At a pole the longitude is 0. */
export function fromVector(v: Vec3): LatLon {
  const [x, y, z] = v;
  const lat = toDegrees(Math.atan2(z, Math.hypot(x, y)));
  const lon = x === 0 && y === 0 ? 0 : toDegrees(Math.atan2(y, x));
  return { lat: lat + 0, lon: normalizeLongitude(lon) };
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function norm(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

// ------------------------------------------------------------------ distance

/** Central angle between two points, in radians, from the haversine formula. */
export function haversineAngle(a: LatLon, b: LatLon): number {
  const φ1 = toRadians(a.lat);
  const φ2 = toRadians(b.lat);
  const sinHalfΔφ = Math.sin((φ2 - φ1) / 2);
  const sinHalfΔλ = Math.sin(toRadians(b.lon - a.lon) / 2);
  const h = sinHalfΔφ * sinHalfΔφ + Math.cos(φ1) * Math.cos(φ2) * sinHalfΔλ * sinHalfΔλ;
  // Rounding can push h a hair outside [0, 1] for coincident or antipodal points.
  const clamped = Math.min(1, Math.max(0, h));
  // 2·atan2(√h, √(1−h)) equals 2·arcsin(√h) and keeps its accuracy as h approaches 1.
  return 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));
}

/** Great-circle distance by the haversine formula, in kilometres (on a sphere of `radiusKm`). */
export function haversineDistance(a: LatLon, b: LatLon, radiusKm: number = MEAN_EARTH_RADIUS_KM): number {
  return radiusKm * haversineAngle(a, b);
}

/** Central angle between two points, in radians, from atan2(|a × b|, a · b): accurate near 0 and π. */
export function vectorAngle(a: LatLon, b: LatLon): number {
  const va = toVector(a);
  const vb = toVector(b);
  return Math.atan2(norm(cross(va, vb)), dot(va, vb));
}

// ------------------------------------------------------------------ bearings and points on the route

/**
 * Initial bearing (forward azimuth) from `a` towards `b`, in degrees [0, 360), clockwise from
 * north. Meaningless when the points coincide or are antipodal; greatCircle() reports null then.
 * At a pole, north is taken along the meridian of the longitude given for that pole.
 */
export function initialBearing(a: LatLon, b: LatLon): number {
  const φ1 = toRadians(a.lat);
  const φ2 = toRadians(b.lat);
  const Δλ = toRadians(b.lon - a.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return normalizeBearing(toDegrees(Math.atan2(y, x)));
}

/** Bearing on arrival at `b` when travelling from `a` along the great circle, in degrees [0, 360). */
export function finalBearing(a: LatLon, b: LatLon): number {
  return normalizeBearing(initialBearing(b, a) + 180);
}

/**
 * The point halfway along the great-circle route: the normalised sum of the two position
 * vectors. Null for antipodal points, where every great circle through one passes through the
 * other and no midpoint is singled out. "Antipodal" is the same test greatCircle() and
 * interpolate() use (within POINT_TOLERANCE of π), so no pair is antipodal to one and has a
 * midpoint in another.
 */
export function midpoint(a: LatLon, b: LatLon): LatLon | null {
  if (Math.PI - vectorAngle(a, b) < POINT_TOLERANCE) return null;
  const va = toVector(a);
  const vb = toVector(b);
  const sum: Vec3 = [va[0] + vb[0], va[1] + vb[1], va[2] + vb[2]];
  if (norm(sum) === 0) return null;
  return fromVector(sum);
}

/**
 * The point a `fraction` (0 … 1) of the way from `a` to `b` along the great circle (spherical
 * linear interpolation). Null for antipodal points; `a` itself when the points coincide.
 */
export function interpolate(a: LatLon, b: LatLon, fraction: number): LatLon | null {
  const δ = vectorAngle(a, b);
  if (δ < POINT_TOLERANCE) return { lat: a.lat, lon: normalizeLongitude(a.lon) };
  if (Math.PI - δ < POINT_TOLERANCE) return null;
  const va = toVector(a);
  const vb = toVector(b);
  const sinδ = Math.sin(δ);
  const wa = Math.sin((1 - fraction) * δ) / sinδ;
  const wb = Math.sin(fraction * δ) / sinδ;
  return fromVector([wa * va[0] + wb * vb[0], wa * va[1] + wb * vb[1], wa * va[2] + wb * vb[2]]);
}

/** The point reached from `start` by travelling `angle` radians along the great circle with initial `bearing` (degrees). */
export function destination(start: LatLon, bearing: number, angle: number): LatLon {
  const φ1 = toRadians(start.lat);
  const λ1 = toRadians(start.lon);
  const θ = toRadians(bearing);
  const sinφ2 = Math.sin(φ1) * Math.cos(angle) + Math.cos(φ1) * Math.sin(angle) * Math.cos(θ);
  const φ2 = Math.asin(Math.min(1, Math.max(-1, sinφ2)));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(angle) * Math.cos(φ1), Math.cos(angle) - Math.sin(φ1) * sinφ2);
  return { lat: toDegrees(φ2) + 0, lon: normalizeLongitude(toDegrees(λ2)) };
}

// ------------------------------------------------------------------ compass

/** The 16 points of the compass rose, clockwise from north. */
export const COMPASS_POINTS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const;
export type CompassPoint = (typeof COMPASS_POINTS)[number];

/** The nearest of the 16 compass points; each covers 22.5°, and a boundary goes clockwise (11.25° → NNE). */
export function compassPoint(bearing: number): CompassPoint {
  const index = Math.round(normalizeBearing(bearing) / 22.5) % COMPASS_POINTS.length;
  return COMPASS_POINTS[index] ?? 'N';
}

// ------------------------------------------------------------------ summary

export type PointRelation = 'distinct' | 'coincident' | 'antipodal';

export interface GreatCircleSummary {
  relation: PointRelation;
  /** Central angle δ in radians (0 … π). */
  angle: number;
  /** Great-circle distance in kilometres (haversine, on the mean-radius sphere by default). */
  distanceKm: number;
  /** Degrees [0, 360); null when the points coincide or are antipodal. */
  initialBearing: number | null;
  finalBearing: number | null;
  /** Null for antipodal points. */
  midpoint: LatLon | null;
  /**
   * Whether A or B is a pole. Every direction from a pole is south (or north), so its bearing
   * is measured from the meridian of the longitude entered for it.
   */
  atPole: { a: boolean; b: boolean };
}

function isPole(point: LatLon): boolean {
  return Math.abs(point.lat) > 90 - 1e-9;
}

export function greatCircle(a: LatLon, b: LatLon, radiusKm: number = MEAN_EARTH_RADIUS_KM): GreatCircleSummary {
  const exact = vectorAngle(a, b);
  const relation: PointRelation =
    exact < POINT_TOLERANCE ? 'coincident' : Math.PI - exact < POINT_TOLERANCE ? 'antipodal' : 'distinct';
  const angle = relation === 'coincident' ? 0 : relation === 'antipodal' ? Math.PI : haversineAngle(a, b);
  const distinct = relation === 'distinct';
  return {
    relation,
    angle,
    distanceKm: radiusKm * angle,
    initialBearing: distinct ? initialBearing(a, b) : null,
    finalBearing: distinct ? finalBearing(a, b) : null,
    midpoint:
      relation === 'coincident'
        ? { lat: a.lat, lon: normalizeLongitude(a.lon) }
        : relation === 'antipodal'
          ? null
          : midpoint(a, b),
    atPole: { a: distinct && isPole(a), b: distinct && isPole(b) },
  };
}
