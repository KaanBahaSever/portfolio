import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEW_TILT, globeScene, project, viewCenter, viewFrame, type GlobeScene } from '../src/lib/geo/globe.ts';
import { CITIES } from '../src/lib/geo/presets.ts';
import { destination, midpoint, vectorAngle, type LatLon } from '../src/lib/geo/sphere.ts';

const RADIUS = 148;
const OPTIONS = { radius: RADIUS };

/** Every coordinate pair in a path, per subpath. */
function subpaths(d: string): Array<Array<[number, number]>> {
  assert.match(d, /^(?:[ML]-?\d+(?:\.\d+)? -?\d+(?:\.\d+)?)*$/, 'only absolute M/L commands');
  const result: Array<Array<[number, number]>> = [];
  for (const [, command, x, y] of d.matchAll(/([ML])(-?[\d.]+) (-?[\d.]+)/g)) {
    if (command === 'M') result.push([]);
    result.at(-1)?.push([Number(x), Number(y)]);
  }
  return result;
}

function allPoints(d: string): Array<[number, number]> {
  return subpaths(d).flat();
}

function scene(a: LatLon, b: LatLon, center: LatLon = viewCenter(a, b)): GlobeScene {
  return globeScene(a, b, center, OPTIONS);
}

test('the view centre projects to the middle of the disc, facing the viewer', () => {
  const center = { lat: 40, lon: 30 };
  const p = project(center, viewFrame(center));
  assert.ok(Math.abs(p.x) < 1e-12 && Math.abs(p.y) < 1e-12);
  assert.ok(Math.abs(p.z - 1) < 1e-12);
});

test('north is up and east is right', () => {
  const center = { lat: 20, lon: 10 };
  const frame = viewFrame(center);
  const north = project({ lat: 30, lon: 10 }, frame);
  const east = project({ lat: 20, lon: 20 }, frame);
  assert.ok(north.y < 0 && Math.abs(north.x) < 1e-12, 'north is above (SVG y grows downwards)');
  assert.ok(east.x > 0, 'east is to the right');
});

test('points a quarter turn from the centre lie on the rim', () => {
  const center = { lat: 35, lon: -20 };
  const frame = viewFrame(center);
  for (const bearing of [0, 45, 130, 270]) {
    const p = project(destination(center, bearing, Math.PI / 2), frame);
    assert.ok(Math.abs(Math.hypot(p.x, p.y) - 1) < 1e-9);
    assert.ok(Math.abs(p.z) < 1e-9);
  }
});

test('the view is tilted off the midpoint, square to the route and towards the equator', () => {
  for (const [a, b] of [
    [CITIES.istanbul, CITIES['new-york']],
    [CITIES.tokyo, CITIES.sydney],
    [CITIES.sydney, { lat: -60, lon: -70 }],
    [{ lat: 0, lon: -20 }, { lat: 0, lon: 40 }],
  ] as const) {
    const center = viewCenter(a, b);
    const middle = midpoint(a, b);
    assert.ok(middle);
    // VIEW_TILT from the midpoint, and equally far from A and B (on the perpendicular bisector).
    assert.ok(Math.abs(vectorAngle(center, middle) - VIEW_TILT) < 1e-9);
    assert.ok(Math.abs(vectorAngle(center, a) - vectorAngle(center, b)) < 1e-9);
    // Towards the equator (or across it, for a route that nearly crosses it).
    assert.ok(Math.sign(middle.lat) * (center.lat - middle.lat) <= 1e-9, 'towards the equator');
    // So the route is not a straight line through the centre: its midpoint is off the centre.
    const s = scene(a, b);
    assert.ok(s.midpoint && Math.abs(Math.hypot(s.midpoint.x, s.midpoint.y) - RADIUS * Math.sin(VIEW_TILT)) < 1e-6);
  }
  // A northern route bows north (up, smaller y) of the straight chord between its ends.
  const s = scene(CITIES.london, CITIES['new-york']);
  assert.ok(s.midpoint);
  const chordY = s.a.y + ((s.b.y - s.a.y) * (s.midpoint.x - s.a.x)) / (s.b.x - s.a.x);
  assert.ok(s.midpoint.y < chordY - 5, `midpoint ${s.midpoint.y}, chord ${chordY}`);
});

test('the route runs from marker A to marker B, all on the near side', () => {
  for (const [a, b] of [
    [CITIES.istanbul, CITIES['new-york']],
    [CITIES.tokyo, CITIES.sydney],
    [CITIES.london, CITIES.sydney],
    [{ lat: 0, lon: 0 }, { lat: 0.5, lon: 179.5 }],
  ] as const) {
    const s = scene(a, b);
    assert.equal(s.routeHidden, '', 'nothing of the route is hidden when facing its midpoint');
    const route = subpaths(s.route);
    assert.equal(route.length, 1, 'one unbroken stroke');
    const points = route[0] ?? [];
    const [first, last] = [points[0], points.at(-1)];
    assert.ok(first && last);
    assert.ok(Math.hypot(first[0] - s.a.x, first[1] - s.a.y) < 0.1, 'starts at A');
    assert.ok(Math.hypot(last[0] - s.b.x, last[1] - s.b.y) < 0.1, 'ends at B');
    assert.ok(s.a.visible && s.b.visible);
    assert.ok(s.midpoint?.visible);
  }
});

test('nothing is drawn outside the disc', () => {
  const s = scene(CITIES.london, CITIES.tokyo);
  for (const d of [s.graticule, s.equator, s.circleFront, s.circleBack, s.route]) {
    for (const [x, y] of allPoints(d)) {
      assert.ok(Math.hypot(x, y) <= RADIUS + 0.1, `(${x}, ${y})`);
    }
  }
});

test('the far side of the great circle is cut exactly at the rim', () => {
  const s = scene(CITIES.london, CITIES.tokyo);
  const back = subpaths(s.circleBack);
  assert.ok(back.length >= 1);
  for (const path of back) {
    const [first, last] = [path[0], path.at(-1)];
    assert.ok(first && last);
    // Where the circle passes behind the globe, it leaves and rejoins at the limb.
    assert.ok(Math.abs(Math.hypot(...first) - RADIUS) < 0.15);
    assert.ok(Math.abs(Math.hypot(...last) - RADIUS) < 0.15);
  }
});

test('while the globe turns, a route behind it is drawn as hidden', () => {
  const a = CITIES.istanbul;
  const b = CITIES.ankara;
  // Seen from the opposite side of the Earth, the whole route is behind the globe.
  const s = scene(a, b, { lat: -40, lon: -150 });
  assert.equal(s.route, '');
  assert.notEqual(s.routeHidden, '');
  assert.equal(s.a.visible, false);
  assert.equal(s.b.visible, false);
});

test('antipodal points sit on opposite edges, with no route', () => {
  const a = { lat: 0, lon: 0 };
  const b = { lat: 0, lon: 180 };
  const s = scene(a, b);
  assert.equal(s.route, '');
  assert.equal(s.circleFront, '');
  assert.equal(s.midpoint, null);
  assert.ok(Math.abs(Math.hypot(s.a.x, s.a.y) - RADIUS) < 1e-6);
  assert.ok(Math.abs(Math.hypot(s.b.x, s.b.y) - RADIUS) < 1e-6);
  assert.ok(Math.abs(s.a.x + s.b.x) < 1e-6 && Math.abs(s.a.y + s.b.y) < 1e-6, 'diametrically opposite');
});

test('nearly antipodal points within the tolerance get no route and no midpoint marker', () => {
  const s = scene({ lat: 0, lon: 0 }, { lat: 0, lon: 180 - 1e-9 });
  assert.equal(s.route, '');
  assert.equal(s.circleFront, '');
  assert.equal(s.midpoint, null);
});

test('coincident points: one marker above the centre, letters on either side', () => {
  const s = scene(CITIES.ankara, CITIES.ankara);
  assert.equal(s.route, '');
  assert.ok(s.a.visible);
  assert.ok(Math.abs(s.a.x) < 1e-9, 'on the central meridian');
  assert.ok(Math.abs(s.a.y + RADIUS * Math.sin(VIEW_TILT)) < 1e-6, 'tilted up by VIEW_TILT');
  assert.ok(s.a.labelX < s.a.x && s.b.labelX > s.b.x, 'A to the left, B to the right');
});

test('letters are set off beyond each end of the route and stay in the figure', () => {
  const s = scene(CITIES.istanbul, CITIES['new-york']);
  // Istanbul is east (right) of New York on this view: A's letter further right, B's further left.
  assert.ok(s.a.x > s.b.x);
  assert.ok(s.a.labelX > s.a.x && s.b.labelX < s.b.x);
  for (const pair of [
    [{ lat: 0, lon: 0 }, { lat: 0, lon: 180 }],
    [{ lat: 89, lon: 0 }, { lat: -89, lon: 179 }],
  ] as const) {
    const edge = scene(pair[0], pair[1]);
    for (const marker of [edge.a, edge.b]) {
      assert.ok(Math.abs(marker.labelX) <= RADIUS * 1.02 + 1e-9 && Math.abs(marker.labelY) <= RADIUS * 1.02 + 1e-9);
    }
  }
});

test('the graticule has the expected lines and the scene is deterministic', () => {
  const s = scene(CITIES.london, CITIES['new-york']);
  assert.equal(JSON.stringify(s), JSON.stringify(scene(CITIES.london, CITIES['new-york'])));
  // 24 meridians and 10 parallels (every 15°, the equator drawn on its own), near side only.
  const lines = subpaths(s.graticule).length;
  assert.ok(lines >= 20 && lines <= 60, `${lines} subpaths`);
  assert.equal(subpaths(s.equator).length, 1);
  // One decimal keeps the markup small.
  assert.ok(s.graticule.length < 12000, `${s.graticule.length} characters`);
  assert.doesNotMatch(s.graticule, /\d\.\d\d/);
});
