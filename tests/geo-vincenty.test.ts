import { test } from 'node:test';
import assert from 'node:assert/strict';
import { greatCircle, type LatLon } from '../src/lib/geo/sphere.ts';
import { CITIES, CITY_IDS } from '../src/lib/geo/presets.ts';
import { WGS84, vincentyInverse } from '../src/lib/geo/vincenty.ts';

function close(actual: number, expected: number, tolerance: number, message = ''): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message} expected ${expected} ± ${tolerance}, got ${actual}`.trim(),
  );
}

const dms = (d: number, m: number, s: number) => d + m / 60 + s / 3600;

function seeded(seed: number): () => number {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

function randomPoint(random: () => number): LatLon {
  return { lat: (Math.asin(2 * random() - 1) * 180) / Math.PI, lon: random() * 360 - 180 };
}

function distanceKm(a: LatLon, b: LatLon): number {
  const result = vincentyInverse(a, b);
  assert.ok(result.ok, `no convergence for ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
  return result.distanceKm;
}

test('WGS-84 constants', () => {
  assert.equal(WGS84.a, 6378137);
  assert.equal(WGS84.f, 1 / 298.257223563);
});

test("Vincenty's own test line: Flinders Peak to Buninyong", () => {
  // The classic geodetic example (Geoscience Australia): 54 972.271 m,
  // azimuths 306°52′05.37″ and 307°10′25.07″.
  const flindersPeak = { lat: -dms(37, 57, 3.72030), lon: dms(144, 25, 29.52440) };
  const buninyong = { lat: -dms(37, 39, 10.15610), lon: dms(143, 55, 35.38390) };
  const result = vincentyInverse(flindersPeak, buninyong);
  assert.ok(result.ok);
  close(result.distanceKm * 1000, 54972.271, 0.001);
  close(result.initialBearing ?? -1, dms(306, 52, 5.37), 0.01 / 3600);
  close(result.finalBearing ?? -1, dms(307, 10, 25.07), 0.01 / 3600);
});

test('coincident points: zero, with no azimuths', () => {
  const result = vincentyInverse(CITIES.ankara, CITIES.ankara);
  assert.deepEqual(result, { ok: true, distanceKm: 0, initialBearing: null, finalBearing: null, iterations: 0 });
});

test('exactly antipodal on the equator: half a meridian, over a pole', () => {
  const result = vincentyInverse({ lat: 0, lon: 0 }, { lat: 0, lon: 180 });
  assert.ok(result.ok);
  // Half the WGS-84 meridian: twice the 10 001 965.729 m quadrant.
  close(result.distanceKm * 1000, 20003931.459, 0.001);
  assert.equal(result.initialBearing, 0);
  assert.equal(result.finalBearing, 180);
});

test('nearly antipodal: converges slowly, or reports that it cannot', () => {
  const slow = vincentyInverse({ lat: 0, lon: 0 }, { lat: 0.5, lon: 179.5 });
  assert.ok(slow.ok);
  close(slow.distanceKm * 1000, 19936288.579, 0.001);
  assert.ok(slow.iterations > 100);

  const failed = vincentyInverse({ lat: 0, lon: 0 }, { lat: 0.5, lon: 179.7 });
  assert.equal(failed.ok, false);
  assert.equal(failed.ok ? '' : failed.code, 'no-convergence');
});

test('London to New York on the ellipsoid', () => {
  close(distanceKm(CITIES.london, CITIES['new-york']), 5585.23, 0.01);
});

test('symmetric in its two points', () => {
  const random = seeded(11);
  for (let i = 0; i < 200; i++) {
    const a = randomPoint(random);
    const b = randomPoint(random);
    const there = vincentyInverse(a, b);
    const back = vincentyInverse(b, a);
    if (!there.ok || !back.ok) continue;
    close(there.distanceKm, back.distanceKm, 1e-9);
  }
});

test('sphere and ellipsoid differ by less than 0.6 % for every pair', () => {
  const random = seeded(2024);
  let largest = 0;
  let checked = 0;
  for (let i = 0; i < 20000; i++) {
    const a = randomPoint(random);
    const b = randomPoint(random);
    const ellipsoid = vincentyInverse(a, b);
    if (!ellipsoid.ok || ellipsoid.distanceKm < 1) continue;
    const ratio = greatCircle(a, b).distanceKm / ellipsoid.distanceKm - 1;
    largest = Math.max(largest, Math.abs(ratio));
    checked++;
  }
  assert.ok(checked > 19000, `only ${checked} pairs converged`);
  assert.ok(largest < 0.006, `largest difference ${largest}`);
  // The two models do disagree measurably somewhere (the flattening is 1/298).
  assert.ok(largest > 0.004, `largest difference ${largest}`);
});

test('between the presets, sphere and ellipsoid stay within 0.5 %', () => {
  for (const one of CITY_IDS) {
    for (const two of CITY_IDS) {
      if (one === two) continue;
      const sphere = greatCircle(CITIES[one], CITIES[two]).distanceKm;
      const ellipsoid = distanceKm(CITIES[one], CITIES[two]);
      assert.ok(Math.abs(sphere / ellipsoid - 1) < 0.005, `${one} → ${two}: ${sphere} vs ${ellipsoid}`);
    }
  }
  // East–west at mid-latitudes the ellipsoid is longer; north–south near the equator, shorter.
  assert.ok(distanceKm(CITIES.istanbul, CITIES.ankara) > greatCircle(CITIES.istanbul, CITIES.ankara).distanceKm);
  assert.ok(distanceKm(CITIES.tokyo, CITIES.sydney) < greatCircle(CITIES.tokyo, CITIES.sydney).distanceKm);
});
