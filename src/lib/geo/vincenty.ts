/**
 * Vincenty's inverse method on the WGS-84 ellipsoid (T. Vincenty, "Direct and inverse solutions
 * of geodesics on the ellipsoid with application of nested equations", Survey Review, 1975),
 * shown next to the spherical result so the difference between the two Earth models is visible.
 *
 * The method iterates on λ, the longitude difference on the auxiliary sphere, and is accurate to
 * well under a millimetre. For nearly antipodal points the iteration can oscillate instead of
 * converging; this module then reports a code instead of a number (the caller shows the sphere
 * alone). The structure follows the widely used formulation by Chris Veness (Movable Type),
 * including its handling of exactly antipodal points on the equator.
 */
import { normalizeBearing, toDegrees, toRadians, type LatLon } from './sphere.ts';

/** WGS-84: semi-major axis a (metres) and flattening f; b = (1 − f)·a. */
export const WGS84 = { a: 6378137, f: 1 / 298.257223563 } as const;

/** Convergence threshold on λ, in radians (about 0.006 mm). */
const TOLERANCE = 1e-12;
const MAX_ITERATIONS = 1000;
/** Below this, sin²σ is zero for practical purposes: the points coincide or are antipodal. */
const EPSILON = 1e-24;

export type VincentyResult =
  | {
      ok: true;
      distanceKm: number;
      /** Forward azimuth at A, degrees [0, 360); null when the points coincide. */
      initialBearing: number | null;
      /** Azimuth on arrival at B, degrees [0, 360); null when the points coincide. */
      finalBearing: number | null;
      iterations: number;
    }
  | {
      ok: false;
      /** The iteration did not settle (nearly antipodal points). */
      code: 'no-convergence';
      iterations: number;
    };

export function vincentyInverse(p1: LatLon, p2: LatLon, ellipsoid: { a: number; f: number } = WGS84): VincentyResult {
  const { a, f } = ellipsoid;
  const b = (1 - f) * a;
  const φ1 = toRadians(p1.lat);
  const φ2 = toRadians(p2.lat);
  const L = toRadians(p2.lon - p1.lon);

  // Reduced latitudes (latitude on the auxiliary sphere).
  const tanU1 = (1 - f) * Math.tan(φ1);
  const cosU1 = 1 / Math.sqrt(1 + tanU1 * tanU1);
  const sinU1 = tanU1 * cosU1;
  const tanU2 = (1 - f) * Math.tan(φ2);
  const cosU2 = 1 / Math.sqrt(1 + tanU2 * tanU2);
  const sinU2 = tanU2 * cosU2;

  // Starting values: points more than a quarter of the way round start from σ = π.
  const antipodal = Math.abs(L) > Math.PI / 2 || Math.abs(φ2 - φ1) > Math.PI / 2;
  let λ = L;
  let sinλ = 0;
  let cosλ = 0;
  let σ = antipodal ? Math.PI : 0;
  let sinσ = 0;
  let cosσ = antipodal ? -1 : 1;
  let sinSqσ = 0;
  let cos2σm = 1;
  let cosSqα = 1;
  let iterations = 0;
  let previousλ = λ;

  do {
    sinλ = Math.sin(λ);
    cosλ = Math.cos(λ);
    const t1 = cosU2 * sinλ;
    const t2 = cosU1 * sinU2 - sinU1 * cosU2 * cosλ;
    sinSqσ = t1 * t1 + t2 * t2;
    // Coincident points, or antipodal points on the equator: keep the starting σ.
    if (Math.abs(sinSqσ) < EPSILON) break;
    sinσ = Math.sqrt(sinSqσ);
    cosσ = sinU1 * sinU2 + cosU1 * cosU2 * cosλ;
    σ = Math.atan2(sinσ, cosσ);
    const sinα = (cosU1 * cosU2 * sinλ) / sinσ;
    cosSqα = 1 - sinα * sinα;
    // On the equatorial line cos²α = 0 and the term vanishes.
    cos2σm = cosSqα !== 0 ? cosσ - (2 * sinU1 * sinU2) / cosSqα : 0;
    const C = (f / 16) * cosSqα * (4 + f * (4 - 3 * cosSqα));
    previousλ = λ;
    λ = L + (1 - C) * f * sinα * (σ + C * sinσ * (cos2σm + C * cosσ * (-1 + 2 * cos2σm * cos2σm)));
    const check = antipodal ? Math.abs(λ) - Math.PI : Math.abs(λ);
    if (check > Math.PI) return { ok: false, code: 'no-convergence', iterations: iterations + 1 };
  } while (Math.abs(λ - previousλ) > TOLERANCE && ++iterations < MAX_ITERATIONS);

  if (iterations >= MAX_ITERATIONS) return { ok: false, code: 'no-convergence', iterations };

  const uSq = (cosSqα * (a * a - b * b)) / (b * b);
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const Δσ =
    B *
    sinσ *
    (cos2σm +
      (B / 4) *
        (cosσ * (-1 + 2 * cos2σm * cos2σm) - (B / 6) * cos2σm * (-3 + 4 * sinσ * sinσ) * (-3 + 4 * cos2σm * cos2σm)));
  const metres = b * A * (σ - Δσ);

  if (metres < 1e-9) {
    return { ok: true, distanceKm: 0, initialBearing: null, finalBearing: null, iterations };
  }

  // Exactly antipodal on the equator: the geodesic runs over a pole, due north then due south.
  const degenerate = Math.abs(sinSqσ) < EPSILON;
  const α1 = degenerate ? 0 : Math.atan2(cosU2 * sinλ, cosU1 * sinU2 - sinU1 * cosU2 * cosλ);
  const α2 = degenerate ? Math.PI : Math.atan2(cosU1 * sinλ, -sinU1 * cosU2 + cosU1 * sinU2 * cosλ);

  return {
    ok: true,
    distanceKm: metres / 1000,
    initialBearing: normalizeBearing(toDegrees(α1)),
    finalBearing: normalizeBearing(toDegrees(α2)),
    iterations,
  };
}
