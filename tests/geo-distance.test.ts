import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KM_PER_UNIT,
  MEAN_EARTH_RADIUS_KM,
  compassPoint,
  destination,
  finalBearing,
  fromKm,
  greatCircle,
  haversineAngle,
  haversineDistance,
  initialBearing,
  interpolate,
  midpoint,
  normalizeBearing,
  normalizeLongitude,
  vectorAngle,
  type LatLon,
} from '../src/lib/geo/sphere.ts';
import { CITIES, cityAt } from '../src/lib/geo/presets.ts';

function close(actual: number, expected: number, tolerance: number, message = ''): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message} expected ${expected} ± ${tolerance}, got ${actual}`.trim(),
  );
}

/** Degrees, minutes, seconds → decimal degrees. */
const dms = (d: number, m: number, s: number) => d + m / 60 + s / 3600;

/** A small seeded generator (Park–Miller), so the random checks are the same on every run. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

/** Points spread evenly over the sphere. */
function randomPoint(random: () => number): LatLon {
  return { lat: (Math.asin(2 * random() - 1) * 180) / Math.PI, lon: random() * 360 - 180 };
}

test('the mean radius is the IUGG value and the units are the international ones', () => {
  assert.equal(MEAN_EARTH_RADIUS_KM, 6371.0088);
  assert.equal(KM_PER_UNIT.mi, 1.609344);
  assert.equal(KM_PER_UNIT.nmi, 1.852);
  assert.equal(fromKm(1.852, 'nmi'), 1);
  close(fromKm(1.609344, 'mi'), 1, 1e-15);
  assert.equal(fromKm(42, 'km'), 42);
});

test('Istanbul to Ankara is about 350 km', () => {
  const summary = greatCircle(CITIES.istanbul, CITIES.ankara);
  close(summary.distanceKm, 349.36, 0.05);
  assert.equal(summary.relation, 'distinct');
  // Ankara lies east-southeast of Istanbul.
  assert.equal(compassPoint(summary.initialBearing ?? -1), 'ESE');
});

test('London to New York is about 5570 km, leaving west-northwest', () => {
  const summary = greatCircle(CITIES.london, CITIES['new-york']);
  close(summary.distanceKm, 5570.2, 0.1);
  close(summary.initialBearing ?? -1, 288.33, 0.01);
  assert.equal(compassPoint(summary.initialBearing ?? -1), 'WNW');
  // The great circle arrives heading south-west, 57° further round than it left.
  close(summary.finalBearing ?? -1, 231.21, 0.01);
});

test("matches a published worked example: Land's End to John o' Groats", () => {
  // Chris Veness, "Calculate distance, bearing and more between latitude/longitude points"
  // (R = 6371 km): 968.9 km, initial bearing 009°07′11″, final bearing 011°16′31″,
  // midpoint 54°21′44″N 004°31′50″W.
  const landsEnd = { lat: dms(50, 3, 59), lon: -dms(5, 42, 53) };
  const johnOGroats = { lat: dms(58, 38, 38), lon: -dms(3, 4, 12) };
  close(haversineDistance(landsEnd, johnOGroats, 6371), 968.9, 0.05);
  close(initialBearing(landsEnd, johnOGroats), dms(9, 7, 11), 1 / 3600);
  close(finalBearing(landsEnd, johnOGroats), dms(11, 16, 31), 1 / 3600);
  const middle = midpoint(landsEnd, johnOGroats);
  assert.ok(middle);
  close(middle.lat, dms(54, 21, 44), 1 / 3600);
  close(middle.lon, -dms(4, 31, 50), 1 / 3600);
});

test('identical points: zero distance, no bearings, the point as its own midpoint', () => {
  const summary = greatCircle(CITIES.tokyo, CITIES.tokyo);
  assert.equal(summary.relation, 'coincident');
  assert.equal(summary.distanceKm, 0);
  assert.equal(summary.angle, 0);
  assert.equal(summary.initialBearing, null);
  assert.equal(summary.finalBearing, null);
  assert.deepEqual(summary.midpoint, CITIES.tokyo);
  assert.deepEqual(summary.atPole, { a: false, b: false });
});

test('a pole is one point whatever longitude is given for it', () => {
  const summary = greatCircle({ lat: 90, lon: 0 }, { lat: 90, lon: 123 });
  assert.equal(summary.relation, 'coincident');
  assert.equal(summary.distanceKm, 0);
  // So is the antimeridian written two ways.
  assert.equal(greatCircle({ lat: 10, lon: 180 }, { lat: 10, lon: -180 }).relation, 'coincident');
});

test('antipodes: half the circumference, and no route, bearings or midpoint', () => {
  const halfCircumference = Math.PI * MEAN_EARTH_RADIUS_KM;
  for (const [a, b] of [
    [{ lat: 0, lon: 0 }, { lat: 0, lon: 180 }],
    [{ lat: 90, lon: 0 }, { lat: -90, lon: 0 }],
    [CITIES.istanbul, { lat: -CITIES.istanbul.lat, lon: CITIES.istanbul.lon - 180 }],
    [CITIES.sydney, { lat: -CITIES.sydney.lat, lon: CITIES.sydney.lon - 180 }],
  ] as const) {
    const summary = greatCircle(a, b);
    assert.equal(summary.relation, 'antipodal', `${JSON.stringify(a)} ↔ ${JSON.stringify(b)}`);
    assert.equal(summary.angle, Math.PI);
    close(summary.distanceKm, halfCircumference, 1e-9);
    assert.equal(summary.initialBearing, null);
    assert.equal(summary.finalBearing, null);
    assert.equal(summary.midpoint, null);
  }
  close(halfCircumference, 20015.114, 0.001);
});

test('points a few metres short of antipodal are still distinct', () => {
  // 0.001° of latitude is about 111 m.
  const summary = greatCircle({ lat: 0, lon: 0 }, { lat: 0.001, lon: 180 });
  assert.equal(summary.relation, 'distinct');
  assert.ok(summary.distanceKm < Math.PI * MEAN_EARTH_RADIUS_KM);
  close(Math.PI * MEAN_EARTH_RADIUS_KM - summary.distanceKm, 0.111, 0.001);
  assert.notEqual(summary.initialBearing, null);
});

test('bearings along meridians and the equator are the cardinal directions', () => {
  assert.equal(initialBearing({ lat: 0, lon: 0 }, { lat: 10, lon: 0 }), 0);
  assert.equal(initialBearing({ lat: 10, lon: 0 }, { lat: 0, lon: 0 }), 180);
  close(initialBearing({ lat: 0, lon: 0 }, { lat: 0, lon: 10 }), 90, 1e-12);
  close(initialBearing({ lat: 0, lon: 10 }, { lat: 0, lon: 0 }), 270, 1e-12);
  // Across the antimeridian the short way round is still due east.
  close(initialBearing({ lat: 0, lon: 170 }, { lat: 0, lon: -170 }), 90, 1e-12);
  close(finalBearing({ lat: 0, lon: 0 }, { lat: 0, lon: 10 }), 90, 1e-12);
});

test('a quarter of the way round the equator', () => {
  const summary = greatCircle({ lat: 0, lon: 0 }, { lat: 0, lon: 90 });
  close(summary.angle, Math.PI / 2, 1e-15);
  close(summary.distanceKm, (Math.PI / 2) * MEAN_EARTH_RADIUS_KM, 1e-9);
  assert.ok(summary.midpoint);
  close(summary.midpoint.lat, 0, 1e-12);
  close(summary.midpoint.lon, 45, 1e-12);
});

test('the final bearing is the reverse initial bearing turned round', () => {
  const random = seeded(7);
  for (let i = 0; i < 200; i++) {
    const a = randomPoint(random);
    const b = randomPoint(random);
    close(finalBearing(a, b), normalizeBearing(initialBearing(b, a) + 180), 1e-9);
  }
});

test('from a pole every route starts south, measured from the given meridian', () => {
  const summary = greatCircle({ lat: 90, lon: 0 }, { lat: 45, lon: 90 });
  assert.deepEqual(summary.atPole, { a: true, b: false });
  // At the North Pole the formula gives 180° − Δλ, relative to the meridian given for the pole.
  close(summary.initialBearing ?? -1, 90, 1e-9);
  close(summary.distanceKm, (Math.PI / 4) * MEAN_EARTH_RADIUS_KM, 1e-9);
  assert.deepEqual(greatCircle({ lat: 10, lon: 0 }, { lat: -90, lon: 0 }).atPole, { a: false, b: true });
});

test('haversine and the vector formula agree away from the antipodes', () => {
  const random = seeded(42);
  for (let i = 0; i < 2000; i++) {
    const a = randomPoint(random);
    const b = randomPoint(random);
    const exact = vectorAngle(a, b);
    if (Math.PI - exact < 1e-3) continue;
    close(haversineAngle(a, b), exact, 1e-12);
  }
  // Short distances, where the haversine is at its best: one metre.
  const a = { lat: 41, lon: 29 };
  const b = { lat: 41 + 1 / 111195, lon: 29 };
  close(haversineDistance(a, b) * 1000, 1, 1e-6);
});

test('travelling the initial bearing for the central angle arrives at B', () => {
  const random = seeded(3);
  for (let i = 0; i < 300; i++) {
    const a = randomPoint(random);
    const b = randomPoint(random);
    const summary = greatCircle(a, b);
    if (summary.initialBearing === null) continue;
    const arrived = destination(a, summary.initialBearing, summary.angle);
    assert.ok(vectorAngle(arrived, b) < 1e-9, `${JSON.stringify(a)} → ${JSON.stringify(b)}`);
  }
});

test('interpolate walks the great circle at a constant rate', () => {
  const a = CITIES.london;
  const b = CITIES.tokyo;
  const δ = vectorAngle(a, b);
  assert.deepEqual(interpolate(a, b, 0), a);
  const end = interpolate(a, b, 1);
  assert.ok(end && vectorAngle(end, b) < 1e-12);
  for (const fraction of [0.1, 0.25, 0.5, 0.9]) {
    const point = interpolate(a, b, fraction);
    assert.ok(point);
    close(vectorAngle(a, point), fraction * δ, 1e-12);
    close(vectorAngle(point, b), (1 - fraction) * δ, 1e-12);
  }
  const half = interpolate(a, b, 0.5);
  const middle = midpoint(a, b);
  assert.ok(half && middle && vectorAngle(half, middle) < 1e-12);
  // Antipodal points have no single path between them.
  assert.equal(interpolate({ lat: 0, lon: 0 }, { lat: 0, lon: 180 }, 0.5), null);
});

test('the 16 compass points, with boundaries going clockwise', () => {
  assert.equal(compassPoint(0), 'N');
  assert.equal(compassPoint(11.24), 'N');
  assert.equal(compassPoint(11.25), 'NNE');
  assert.equal(compassPoint(45), 'NE');
  assert.equal(compassPoint(90), 'E');
  assert.equal(compassPoint(202.5), 'SSW');
  assert.equal(compassPoint(292.5), 'WNW');
  assert.equal(compassPoint(348.74), 'NNW');
  assert.equal(compassPoint(348.75), 'N');
  assert.equal(compassPoint(359.99), 'N');
  assert.equal(compassPoint(-45), 'NW');
  assert.equal(compassPoint(720 + 180), 'S');
});

test('longitudes and bearings wrap into their ranges', () => {
  assert.equal(normalizeLongitude(28.9784), 28.9784);
  assert.equal(normalizeLongitude(190), -170);
  assert.equal(normalizeLongitude(-190), 170);
  assert.equal(normalizeLongitude(-180), 180);
  assert.equal(normalizeLongitude(540), 180);
  assert.ok(Object.is(normalizeLongitude(-0), 0));
  assert.equal(normalizeBearing(-90), 270);
  assert.equal(normalizeBearing(360), 0);
  assert.equal(normalizeBearing(-1e-15), 0);
});

test('city presets are real coordinates and recognised exactly', () => {
  for (const [id, city] of Object.entries(CITIES)) {
    assert.ok(Math.abs(city.lat) <= 90 && Math.abs(city.lon) <= 180, id);
    assert.equal(cityAt(city), id);
  }
  assert.equal(cityAt({ lat: 41.0082, lon: 28.9785 }), null);
  // The hemispheres are the right way round.
  assert.ok(CITIES.sydney.lat < 0 && CITIES.sydney.lon > 0);
  assert.ok(CITIES['new-york'].lon < 0 && CITIES.london.lon < 0);
});
