/**
 * City presets for the distance calculator: decimal degrees to four places (about 11 m), at
 * each city's customary reference point. Names are translated in src/i18n/tools/geo-distance.ts.
 *
 * - Istanbul: Sultanahmet, the historic peninsula (41°00′29.5″N 28°58′42.2″E)
 * - Ankara: the city centre, between Ulus and Kızılay
 * - London: Charing Cross, from which distances to London are traditionally measured
 * - New York: City Hall, Lower Manhattan
 * - Tokyo: the Tokyo Metropolitan Government Building, Shinjuku
 * - Sydney: the central business district
 */
import type { LatLon } from './sphere.ts';

export const CITY_IDS = ['istanbul', 'ankara', 'london', 'new-york', 'tokyo', 'sydney'] as const;
export type CityId = (typeof CITY_IDS)[number];

export const CITIES: Readonly<Record<CityId, LatLon>> = {
  istanbul: { lat: 41.0082, lon: 28.9784 },
  ankara: { lat: 39.9334, lon: 32.8597 },
  london: { lat: 51.5074, lon: -0.1278 },
  'new-york': { lat: 40.7128, lon: -74.006 },
  tokyo: { lat: 35.6895, lon: 139.6917 },
  sydney: { lat: -33.8688, lon: 151.2093 },
};

/** The route shown when the page opens. */
export const DEFAULT_ROUTE: Readonly<{ a: CityId; b: CityId }> = { a: 'istanbul', b: 'new-york' };

export function isCityId(value: unknown): value is CityId {
  return (CITY_IDS as readonly unknown[]).includes(value);
}

/** The preset at exactly these coordinates (to 1e-9°), if any. */
export function cityAt(point: LatLon): CityId | null {
  for (const id of CITY_IDS) {
    const city = CITIES[id];
    if (Math.abs(city.lat - point.lat) < 1e-9 && Math.abs(city.lon - point.lon) < 1e-9) return id;
  }
  return null;
}
