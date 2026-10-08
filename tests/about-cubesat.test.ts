/**
 * The CubeSat figure (#journey-cubesat) is a 3D wireframe of a 1U CubeSat projected during the
 * build, on its orbit above the Earth (cubesat.ts). These checks hold the drawing to what the
 * caption promises: a true 10 cm cube, two solar cells on each visible face, the hidden edges
 * really hidden, the highlighted arc ending exactly at 10° above the station's horizon, and a
 * picture that fits its frame, the same on every build.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MIN_ELEVATION } from '../src/components/about/geometry.ts';
import {
  CELL,
  EARTH,
  EDGE,
  ORBIT,
  RAIL,
  VIEW,
  WHIP,
  cameraBasis,
  convexHull,
  cubesatScene,
  dot,
  type Projected,
  type Vec3,
} from '../src/components/about/cubesat.ts';

const close = (actual: number, expected: number, tolerance: number, what: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} is not within ${tolerance} of ${expected}`);

const scene = cubesatScene();
const { camera, cube } = scene;

/** Back from the screen to the model: the projection is orthographic, so it can be undone exactly. */
function unproject(p: Projected): Vec3 {
  const { right, up, toward } = cameraBasis(camera);
  const r = (p.x - camera.centre.x) / camera.scale;
  const u = (camera.centre.y - p.y) / camera.scale;
  const t = -p.depth / camera.scale;
  return [0, 1, 2].map((i) => (right[i] ?? 0) * r + (up[i] ?? 0) * u + (toward[i] ?? 0) * t) as unknown as Vec3;
}
const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const length3d = ([a, b]: [Projected, Projected]) => distance(unproject(a), unproject(b));

/** Even-odd point-in-polygon test. */
function inside(p: { x: number; y: number }, polygon: readonly { x: number; y: number }[]): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (!a || !b) continue;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

test('the satellite is a 1U CubeSat: a true 10 cm cube, every drawn edge 10 cm long', () => {
  assert.equal(EDGE, 10);
  for (const edge of cube.edges) close(length3d(edge), EDGE, 1e-9, 'edge');
  for (const face of cube.faces) {
    for (let i = 0; i < 4; i++) {
      const a = face.outline[i];
      const b = face.outline[(i + 1) % 4];
      assert.ok(a && b);
      close(length3d([a, b]), EDGE, 1e-9, 'face side');
    }
  }
  // Opposite corners are a space diagonal apart, so the cube is not squashed in any direction.
  const [first] = cube.corners;
  const last = cube.corners[7];
  assert.ok(first && last);
  close(distance(unproject(first), unproject(last)), EDGE * Math.sqrt(3), 1e-9, 'space diagonal');
});

test('back faces are culled: three faces show, with their nine edges; the far corner is left out', () => {
  const { toward } = cameraBasis(camera);
  assert.equal(cube.faces.length, 3);
  for (const face of cube.faces) assert.ok(dot(face.normal, toward) > 0, face.normal.join(','));
  assert.equal(cube.edges.length, 9);
  // Every drawn edge is a side of a visible face.
  for (const [a, b] of cube.edges) assert.ok(cube.faces.some((f) => f.outline.includes(a) && f.outline.includes(b)));
  // The far corner, where the three hidden edges meet, is the deepest one and on no drawn edge.
  const far = cube.corners.reduce((a, b) => (b.depth > a.depth ? b : a));
  for (const edge of cube.edges) assert.ok(!edge.includes(far));
  assert.ok(inside(far, cube.silhouette));
  // The outline of a cube seen corner-on is a hexagon round all eight corners.
  assert.equal(cube.silhouette.length, 6);
  assert.deepEqual(convexHull(cube.silhouette), cube.silhouette);
});

test('the solar panels are on the faces: two 8 × 4 cm cells inside the rails of each visible face', () => {
  assert.equal(CELL.perFace, 2);
  // The cells and the gap between them fit inside the rails.
  assert.ok(CELL.width <= EDGE - 2 * RAIL);
  assert.ok(CELL.perFace * CELL.height + (CELL.perFace - 1) * CELL.gap <= EDGE - 2 * RAIL);
  for (const face of cube.faces) {
    assert.equal(face.cells.length, 2);
    for (const cell of face.cells) {
      // Every corner of a cell lies in its face's plane, on the face.
      const normal = face.normal;
      for (const corner of cell) close(dot(unproject(corner), normal), EDGE / 2, 1e-9, 'cell on the face');
      const sides = cell.map((p, i) => distance(unproject(p), unproject(cell[(i + 1) % 4] ?? p))).sort((a, b) => a - b);
      close(sides[0] ?? 0, CELL.height, 1e-9, 'cell height');
      close(sides[3] ?? 0, CELL.width, 1e-9, 'cell width');
      const centre = { x: cell.reduce((s, p) => s + p.x, 0) / 4, y: cell.reduce((s, p) => s + p.y, 0) / 4 };
      assert.ok(inside(centre, face.outline));
    }
  }
});

test('the two antenna whips stand off the cube’s outline, so they never cross a face', () => {
  assert.equal(cube.whips.length, WHIP.count);
  for (const whip of cube.whips) {
    close(length3d(whip), WHIP.length, 1e-9, 'whip length');
    // Lying in the plane of the top face.
    for (const end of whip) close(unproject(end)[2], EDGE / 2, 1e-9, 'in the top plane');
    // Past its root, no point of the whip falls inside the cube's outline.
    for (let k = 1; k <= 10; k++) {
      const t = k / 10;
      const p = { x: whip[0].x + t * (whip[1].x - whip[0].x), y: whip[0].y + t * (whip[1].y - whip[0].y) };
      assert.ok(!inside(p, cube.silhouette), 'whip over the cube');
    }
  }
});

test('the highlighted arc ends exactly where the satellite is 10° above the station’s horizon', () => {
  const lambda = (scene.halfAngle * Math.PI) / 180;
  // Station at the top of the Earth; the arc's end at Earth-central angle λ on the orbit. The
  // elevation is the angle between the line of sight and the station's horizontal.
  const dx = ORBIT * Math.sin(lambda);
  const dy = ORBIT * Math.cos(lambda) - EARTH.radius;
  close((Math.atan2(dy, dx) * 180) / Math.PI, MIN_ELEVATION, 1e-9, 'elevation at the arc’s end');
  const end = scene.visibleArc.at(-1);
  assert.ok(end);
  close(end.x, EARTH.centre.x + dx, 1e-9, 'end x');
  close(end.y, EARTH.centre.y - ORBIT * Math.cos(lambda), 1e-9, 'end y');
  // The station sits on the Earth, the satellite on the visible arc, and the dashed line joins them.
  close(Math.hypot(scene.station.x - EARTH.centre.x, scene.station.y - EARTH.centre.y), EARTH.radius, 1e-9, 'station');
  const sat = camera.centre;
  close(Math.hypot(sat.x - EARTH.centre.x, sat.y - EARTH.centre.y), ORBIT, 1e-9, 'satellite on its orbit');
  const angle = (Math.atan2(sat.x - EARTH.centre.x, EARTH.centre.y - sat.y) * 180) / Math.PI;
  assert.ok(Math.abs(angle) < scene.halfAngle, 'the satellite is in view');
  assert.deepEqual(scene.link, [scene.station, sat]);
});

test('the drawing fits its frame, with the cube clearly the subject, above the Earth', () => {
  const points = [...cube.corners, ...cube.whips.flat(), ...scene.visibleArc, scene.station];
  for (const p of points) {
    assert.ok(p.x >= 6 && p.x <= VIEW.width - 6, `x ${p.x}`);
    assert.ok(p.y >= 6 && p.y <= VIEW.height - 6, `y ${p.y}`);
  }
  // The cube is the subject: clearly larger than the station dot, and above the Earth.
  const xs = cube.silhouette.map((p) => p.x);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 40, 'cube width on screen');
  for (const p of cube.silhouette) {
    assert.ok(Math.hypot(p.x - EARTH.centre.x, p.y - EARTH.centre.y) > EARTH.radius + 10, 'cube above the Earth');
  }
});

test('the drawing is the same on every build', () => {
  assert.equal(JSON.stringify(cubesatScene()), JSON.stringify(scene));
});
