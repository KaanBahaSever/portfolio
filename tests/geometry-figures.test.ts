/**
 * The interactive figures of the post "Interactive 2D Collision Detection"
 * (src/components/blog/posts/collision/): their message catalogue, their scenes, and the pure
 * drawing and description code shared by the build and the browser.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { axisRows, formatUnits, readout, statusText } from '../src/components/blog/posts/collision/describe.ts';
import { automaticAxis, axisNames, drawOver, drawUnder, num, shapePath } from '../src/components/blog/posts/collision/draw.ts';
import { collisionMessages } from '../src/components/blog/posts/collision/messages.ts';
import {
  DEMO_KINDS,
  POLYGON_NAMES,
  TOLERANCE,
  WORLD,
  analyse,
  asPolygon,
  canRotate,
  clampShape,
  combinePieces,
  initialScene,
  localPolygon,
  moveShape,
  notchPieces,
  rotateShape,
  shapeBounds,
  withPolygon,
  type Scene,
} from '../src/components/blog/posts/collision/scene.ts';
import { formatters } from '../src/i18n/format.ts';
import { LOCALES } from '../src/i18n/config.ts';
import { centroid, polygonArea } from '../src/lib/geometry/shapes.ts';
import { vec } from '../src/lib/geometry/vec.ts';

/** Leaf paths with a type tag, as in tests/i18n-catalogues.test.ts. */
function shape(value: unknown, prefix = ''): string[] {
  if (typeof value === 'function') return [`${prefix}:function`];
  if (Array.isArray(value)) return value.flatMap((item, index) => shape(item, `${prefix}${index}.`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => shape(child, `${prefix}${key}.`));
  }
  return [`${prefix}:${typeof value}`];
}

const insideWorld = (scene: Scene) =>
  (['a', 'b'] as const).every((key) => {
    const bounds = shapeBounds(scene[key]);
    return bounds.min.x >= -1e-9 && bounds.min.y >= -1e-9 && bounds.max.x <= WORLD.width + 1e-9 && bounds.max.y <= WORLD.height + 1e-9;
  });

// ---------------------------------------------------------------- messages

test('the figure messages have the same shape in English and Turkish', () => {
  assert.deepEqual(shape(collisionMessages.tr).sort(), shape(collisionMessages.en).sort());
});

test('status lines read naturally in both languages, with values that need no suffix', () => {
  const en = collisionMessages.en;
  const tr = collisionMessages.tr;
  assert.equal(en.status.overlapping('12'), 'Colliding — depth 12 px');
  assert.equal(tr.status.overlapping('12'), 'Çarpışıyor — derinlik 12 px');
  assert.equal(en.status.separated('18'), 'Separated — gap 18 px');
  assert.equal(tr.status.separated('18'), 'Çarpışma yok — aralık 18 px');
  assert.equal(tr.axes.parallel('A1'), 'A1 eksenine paralel');
  // Every figure has its own names for the two shapes.
  for (const locale of LOCALES) {
    for (const kind of DEMO_KINDS) {
      const names = collisionMessages[locale].shapes[kind];
      assert.ok(names.a && names.b && names.a !== names.b);
    }
  }
});

test('units are whole numbers with a true minus sign and locale grouping', () => {
  const en = formatters('en');
  const tr = formatters('tr');
  assert.equal(formatUnits(12.4, en), '12');
  assert.equal(formatUnits(-3.6, en), '−4');
  assert.equal(formatUnits(-0.2, en), '0');
  assert.equal(formatUnits(499500, en), '499,500');
  assert.equal(formatUnits(499500, tr), '499.500');
});

// ---------------------------------------------------------------- scenes

test('every figure starts inside the world, in the state its caption describes', () => {
  const expected = { aabb: 'overlapping', circles: 'overlapping', 'circle-box': 'overlapping', sat: 'overlapping', concave: 'separated' };
  for (const kind of DEMO_KINDS) {
    const scene = initialScene(kind);
    assert.ok(insideWorld(scene), `${kind} starts outside the world`);
    assert.equal(analyse(scene).result.relation, expected[kind], kind);
  }
  // The concave figure starts with the false positive the post is about.
  const concave = analyse(initialScene('concave'));
  assert.ok(concave.kind === 'concave' && concave.sat.hit && !concave.result.hit);
});

test('moving and rotating keep every shape inside the world', () => {
  for (const kind of DEMO_KINDS) {
    let scene = initialScene(kind);
    for (let i = 0; i < 40; i++) {
      scene = { ...scene, b: moveShape(scene.b, vec(37, -23)) };
      if (canRotate(scene)) scene = { ...scene, a: rotateShape(scene.a, 15) };
      assert.ok(insideWorld(scene), `${kind} left the world after ${i} steps`);
    }
    scene = { ...scene, a: moveShape(scene.a, vec(-5000, 5000)) };
    assert.ok(insideWorld(scene));
  }
});

test('rotation: only the SAT figure turns, angles stay in (−π, π], a full turn comes back', () => {
  assert.deepEqual(
    DEMO_KINDS.filter((kind) => canRotate(initialScene(kind))),
    ['sat'],
  );
  const box = initialScene('aabb').a;
  assert.equal(rotateShape(box, 90), box);
  const start = initialScene('sat').a;
  let turned = start;
  for (let i = 0; i < 24; i++) turned = rotateShape(turned, 15);
  assert.ok(turned.kind === 'polygon' && start.kind === 'polygon');
  assert.ok(Math.abs(turned.angle - start.angle) < 1e-9);
  for (let i = 0; i < 13; i++) turned = rotateShape(turned, 15);
  assert.ok(turned.kind === 'polygon' && turned.angle > -Math.PI && turned.angle <= Math.PI);
});

test('B’s polygons are centred on their centroid and keep position and angle when swapped', () => {
  for (const name of POLYGON_NAMES) {
    const local = localPolygon(name);
    const c = centroid(local);
    assert.ok(Math.abs(c.x) < 1e-9 && Math.abs(c.y) < 1e-9, name);
  }
  const scene = initialScene('sat');
  const swapped = withPolygon(scene.b, 'pentagon');
  assert.ok(swapped.kind === 'polygon' && scene.b.kind === 'polygon');
  assert.equal(swapped.name, 'pentagon');
  assert.equal(swapped.angle, scene.b.angle);
  const counts = { triangle: 5, rectangle: 4, pentagon: 7 };
  for (const name of POLYGON_NAMES) {
    const result = analyse(initialScene('sat', name));
    assert.equal(result.kind === 'sat' && result.result.axes.length, counts[name], name);
  }
});

test('the U splits into three convex pieces that cover it exactly', () => {
  const u = initialScene('concave').a;
  const pieces = notchPieces(u);
  assert.equal(pieces.length, 3);
  const total = pieces.reduce((sum, piece) => sum + polygonArea(piece), 0);
  assert.ok(Math.abs(total - polygonArea(asPolygon(u))) < 1e-6);
  assert.deepEqual(notchPieces(initialScene('sat').a), []);
});

test('combining pieces: the deepest overlap wins, else a touch, else the nearest piece', () => {
  const apart = (distance: number) => ({ relation: 'separated' as const, hit: false, depth: 0, normal: vec(1, 0), mtv: vec(0, 0), contact: null, distance, closest: null });
  const touching = { ...apart(0), relation: 'touching' as const, hit: true, contact: vec(1, 1) };
  const deep = (depth: number) => ({ ...touching, relation: 'overlapping' as const, depth });
  assert.equal(combinePieces([apart(9), apart(4), apart(7)]).distance, 4);
  assert.equal(combinePieces([apart(4), touching]).relation, 'touching');
  assert.equal(combinePieces([deep(3), touching, deep(8)]).depth, 8);
  assert.throws(() => combinePieces([]), RangeError);
});

test('clamping shifts a shape by the smallest amount', () => {
  const circle = { kind: 'circle' as const, center: vec(-30, 200), radius: 50 };
  assert.deepEqual(clampShape(circle).center, vec(50, 200));
  const inside = { kind: 'circle' as const, center: vec(300, 200), radius: 50 };
  assert.equal(clampShape(inside), inside);
});

// ---------------------------------------------------------------- drawing and description

test('drawings contain no NaN or Infinity, at phone and desktop scales, in every state', () => {
  for (const kind of DEMO_KINDS) {
    const base = initialScene(kind);
    const scenes = [base, { ...base, b: moveShape(base.b, vec(-400, 0)) }, { ...base, b: moveShape(base.b, vec(400, 400)) }];
    // Nested: B's centre on A's.
    scenes.push({ ...base, b: clampShape({ ...base.b, center: base.a.center }) });
    for (const scene of scenes) {
      const analysis = analyse(scene);
      for (const k of [0.85, 2.1]) {
        const markup = drawUnder(scene, analysis, { k, axis: automaticAxis(analysis) }) + drawOver(scene, analysis, { k, axis: automaticAxis(analysis) });
        assert.ok(!/NaN|Infinity|undefined/.test(markup), `${kind}: ${markup.slice(0, 200)}`);
      }
      assert.ok(!/NaN/.test(shapePath(scene.a) + shapePath(scene.b)));
    }
  }
  assert.equal(num(-0.001), '0');
  assert.equal(num(12.345), '12.35');
});

test('readouts keep the same four keys whatever the state, and statuses match the relation', () => {
  const format = formatters('en');
  const m = collisionMessages.en;
  for (const kind of DEMO_KINDS) {
    const base = initialScene(kind);
    const keys = readout(analyse(base), m, format).map((item) => item.key);
    assert.equal(keys.length, 4);
    const moved = { ...base, b: moveShape(base.b, vec(400, 400)) };
    assert.deepEqual(readout(analyse(moved), m, format).map((item) => item.key), keys);
  }
  const touching: Scene = {
    kind: 'aabb',
    a: { kind: 'box', center: vec(100, 100), half: vec(50, 50) },
    b: { kind: 'box', center: vec(200 + TOLERANCE / 2, 100), half: vec(50, 50) },
  };
  assert.equal(statusText(analyse(touching), m, format), 'Touching — depth 0 px');
  const concave = analyse(initialScene('concave'));
  assert.equal(statusText(concave, collisionMessages.tr, formatters('tr')), 'SAT: çarpışıyor — yanlış, şekiller arasında 25 px var');
});

test('SAT axis rows: names per polygon, bars inside the row, the separating row marked', () => {
  const format = formatters('en');
  const m = collisionMessages.en;
  const base = initialScene('sat');
  const apart = { ...base, b: moveShape(base.b, vec(160, 0)) };
  for (const scene of [base, apart]) {
    const analysis = analyse(scene);
    assert.ok(analysis.kind === 'sat');
    const rows = axisRows(analysis.result.axes, m, format);
    assert.deepEqual(axisNames(analysis.result.axes), ['A1', 'A2', 'B1', 'B2', 'B3']);
    for (const row of rows) {
      for (const [x, width] of [row.bars.a, row.bars.b]) {
        assert.ok(x >= 0 && x + width <= 100 + 1e-9, `${row.name}: ${x}, ${width}`);
      }
      assert.ok((row.bars.common === null) !== (row.bars.gap === null));
    }
    // Every axis with a gap is marked; the readout names the widest one.
    const separating = analysis.result.separatingAxis;
    rows.forEach((row, index) => assert.equal(row.state === 'separating', analysis.result.axes[index]!.separating));
    if (separating >= 0) assert.equal(rows[separating]!.state, 'separating');
    assert.equal(automaticAxis(analysis), separating >= 0 ? separating : analysis.result.mtvAxis);
  }
  // A rectangle B turned to A's angle repeats A's axes, and its rows say so.
  assert.ok(base.a.kind === 'polygon' && base.b.kind === 'polygon');
  const aligned = { ...base, b: withPolygon({ ...base.b, angle: base.a.angle }, 'rectangle') };
  const analysis = analyse(aligned);
  assert.ok(analysis.kind === 'sat');
  const rows = axisRows(analysis.result.axes, m, format);
  assert.ok(rows.slice(2).every((row) => row.duplicate && /parallel to A[12]/.test(row.detail)));
});
