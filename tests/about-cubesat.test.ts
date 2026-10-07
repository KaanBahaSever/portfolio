/**
 * The CubeSat figure (#journey-cubesat) is a 3D model projected during the build (cubesat.ts).
 * These checks hold the drawing to what the caption promises: a 3U body of the standard's size,
 * four panels of seven cells, antennas a quarter-wave long, faces painted back to front with the
 * hidden ones left out, and a picture that fits its frame above the Earth, the same on every build.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ANTENNA,
  BODY,
  CAMERA,
  CELL,
  EARTH,
  PANEL,
  RAIL,
  UNIT,
  UNITS,
  VIEW,
  cameraBasis,
  cubesatScene,
  depthAt,
  dot,
  inside,
  project,
  type Face,
  type Item,
  type Projected,
  type Vec3,
} from '../src/components/about/cubesat.ts';

const close = (actual: number, expected: number, tolerance: number, what: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} is not within ${tolerance} of ${expected}`);

const scene = cubesatScene();
const faces = scene.items.filter((item): item is Face => item.kind === 'face');
const body = faces.filter((face) => face.part === 'body');
const panels = faces.filter((face) => face.part === 'panel');

/** Back from the screen to the model: the projection is orthographic, so it can be undone exactly. */
function unproject(p: Projected): Vec3 {
  const { right, up, toward } = cameraBasis(CAMERA);
  const r = (p.x - CAMERA.centre.x) / CAMERA.scale;
  const u = (CAMERA.centre.y - p.y) / CAMERA.scale;
  const t = -p.depth / CAMERA.scale;
  return [0, 1, 2].map((i) => right[i]! * r + up[i]! * u + toward[i]! * t) as unknown as Vec3;
}
const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const edges = (face: Face) => face.outline.map((p, i) => distance(unproject(p), unproject(face.outline[(i + 1) % 4]!)));

test('the body is a 3U CubeSat by the standard: three 10 × 10 × 11.35 cm units, 34.05 cm long', () => {
  assert.deepEqual(UNIT, { width: 10, length: 11.35 });
  assert.equal(UNITS, 3);
  close(BODY.length, 34.05, 1e-9, 'length');
  assert.equal(BODY.width, 10);
  assert.equal(BODY.height, 10);
  close(BODY.length / BODY.width, 3.405, 1e-9, 'aspect ratio');
  assert.equal(RAIL, 0.85);
  // The drawn faces, taken back to the model, have exactly those sides: the long faces are
  // 10 × 34.05 cm and the end face is 10 cm square.
  for (const face of body) {
    const sides = edges(face).sort((a, b) => a - b);
    const long = face.normal[1] === 0;
    close(sides[0]!, 10, 1e-9, 'short side');
    close(sides[3]!, long ? 34.05 : 10, 1e-9, 'long side');
  }
  // Each long face shows the two seams between its three units, and the two rails.
  for (const face of body.filter((f) => f.normal[1] === 0)) assert.equal(face.lines.length, 2 + (UNITS - 1));
});

test('the panels: two per side, level with the bottom face, seven 8 × 4 cm cells each', () => {
  assert.equal(panels.length, 4);
  // From wing tip to wing tip: the body and two panels with their hinge gaps on each side.
  const span = BODY.width + 2 * PANEL.perSide * (PANEL.width + PANEL.gap);
  close(span, 50, 1e-9, 'span');
  for (const panel of panels) {
    const corners = panel.outline.map(unproject);
    for (const c of corners) close(c[2], -BODY.height / 2, 1e-9, 'level with the bottom face');
    const sides = edges(panel).sort((a, b) => a - b);
    close(sides[0]!, PANEL.width, 1e-9, 'panel width');
    close(sides[3]!, PANEL.length, 1e-9, 'panel length');
    assert.ok(PANEL.length <= BODY.length, 'a panel folds flat against the body');
    assert.equal(panel.cells.length, CELL.count);
    // The cells fit the panel with room round them, and lie on it.
    assert.ok(CELL.across < PANEL.width && CELL.count * CELL.along < PANEL.length);
    for (const cell of panel.cells) {
      const centre = { x: cell.reduce((s, p) => s + p.x, 0) / 4, y: cell.reduce((s, p) => s + p.y, 0) / 4 };
      assert.ok(inside(centre, panel.outline), 'cell on its panel');
    }
  }
  // The panels and cells face up and the camera is above them, so the cells show.
  assert.ok(panels.every((p) => p.normal[2] === 1));
});

test('the antennas are quarter-wave UHF whips: about 17 cm at 437 MHz', () => {
  close(299_792_458 / 437e6 / 4, ANTENNA.length / 100, 0.002, 'quarter wavelength in metres');
  const whips = scene.items.filter((item) => item.kind === 'whip');
  assert.equal(whips.length, ANTENNA.whips);
  for (const whip of whips) {
    const [from, to] = [unproject(whip.from), unproject(whip.to)];
    close(distance(from, to), ANTENNA.length, 1e-9, 'whip length');
    // In the plane of the far end face, just off it.
    close(from[1], BODY.length / 2 + ANTENNA.standoff, 1e-9, 'whip root');
    close(to[1], from[1], 1e-9, 'whip in the end plane');
  }
});

test('back faces are culled: three faces of the box show, each turned towards the camera', () => {
  const { toward } = cameraBasis(CAMERA);
  assert.equal(body.length, 3);
  for (const face of faces) assert.ok(dot(face.normal, toward) > 0, `${face.part} ${face.normal.join(',')}`);
  // The top, the right side and the near end: the camera is above, to the right and in front.
  assert.deepEqual(
    body.map((f) => f.normal.join(',')).sort(),
    ['0,-1,0', '0,0,1', '1,0,0'],
  );
});

test('faces are painted back to front: wherever two items overlap, the later one is nearer', () => {
  // depthAt() is exact on a flat face: it reproduces the corners' depths.
  for (const face of faces) for (const corner of face.outline) close(depthAt(face, corner), corner.depth, 1e-9, 'corner depth');
  /** Points spread over an item (a fine grid over a face, or along a whip), with their depths. */
  const samples = (item: Item): Projected[] => {
    const n = 24;
    const out: Projected[] = [];
    if (item.kind === 'whip') {
      for (let i = 1; i < n; i++) {
        const t = i / n;
        out.push({
          x: item.from.x + t * (item.to.x - item.from.x),
          y: item.from.y + t * (item.to.y - item.from.y),
          depth: item.from.depth + t * (item.to.depth - item.from.depth),
        });
      }
      return out;
    }
    const xs = item.outline.map((p) => p.x);
    const ys = item.outline.map((p) => p.y);
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const p = {
          x: Math.min(...xs) + ((Math.max(...xs) - Math.min(...xs)) * i) / n,
          y: Math.min(...ys) + ((Math.max(...ys) - Math.min(...ys)) * j) / n,
        };
        if (inside(p, item.outline)) out.push({ ...p, depth: depthAt(item, p) });
      }
    }
    return out;
  };
  let overlaps = 0;
  scene.items.forEach((earlier, i) => {
    scene.items.slice(i + 1).forEach((later) => {
      for (const [a, b, aIsEarlier] of [
        [earlier, later, true],
        [later, earlier, false],
      ] as const) {
        if (b.kind !== 'face') continue;
        for (const p of samples(a)) {
          if (!inside(p, b.outline)) continue;
          const depthA = p.depth;
          const depthB = depthAt(b, p);
          if (Math.abs(depthA - depthB) < 1e-6) continue; // a shared edge
          overlaps++;
          const [earlierDepth, laterDepth] = aIsEarlier ? [depthA, depthB] : [depthB, depthA];
          assert.ok(earlierDepth > laterDepth, `item ${i} is painted before a nearer item over it`);
        }
      }
    });
  });
  // The body really does hide part of the far wing, so the check is not empty.
  assert.ok(overlaps > 50, `${overlaps} overlapping samples`);
});

test('the drawing fits its frame, with the satellite above the Earth’s limb and on its orbit', () => {
  const { x0, y0, x1, y1 } = scene.bounds;
  assert.ok(x0 >= 8 && x1 <= VIEW.width - 8, `x from ${x0} to ${x1}`);
  assert.ok(y0 >= 8 && y1 <= VIEW.height - 8, `y from ${y0} to ${y1}`);
  // Every corner and whip end of the satellite stays clear of the Earth.
  for (const item of scene.items) {
    const points = item.kind === 'whip' ? [item.from, item.to] : item.outline;
    for (const p of points) {
      const r = Math.hypot(p.x - EARTH.centre.x, p.y - EARTH.centre.y);
      assert.ok(r > EARTH.radius + 8, `a point of the satellite is ${r - EARTH.radius} above the limb`);
    }
  }
  // The limb crosses the frame: the Earth's top is inside it, its sides below the bottom edge.
  const top = EARTH.centre.y - EARTH.radius;
  assert.ok(top > y1 && top < VIEW.height, 'limb below the satellite, inside the frame');
  // The orbit runs through the body's centre.
  const centre = project([0, 0, 0]);
  close(Math.hypot(centre.x - EARTH.centre.x, centre.y - EARTH.centre.y), scene.orbitRadius, 1e-9, 'orbit radius');
  // The ground station sits on the limb, and the radio link ends there.
  close(Math.hypot(scene.station.x - EARTH.centre.x, scene.station.y - EARTH.centre.y), EARTH.radius, 1e-9, 'station');
  assert.deepEqual(scene.link[1], scene.station);
  assert.ok(scene.station.x > 8 && scene.station.x < VIEW.width - 8);
});

test('the drawing is the same on every build', () => {
  assert.equal(JSON.stringify(cubesatScene()), JSON.stringify(scene));
  assert.equal(JSON.stringify(cubesatScene({ ...CAMERA })), JSON.stringify(scene));
});
