/**
 * The drawing of a collision figure as SVG markup: the shapes' outlines, and two overlay layers
 * (guides under the shapes; overlap, contact point, MTV and closest points above them).
 *
 * Pure string builders, so the same code renders the starting position at build time (set:html
 * in CollisionDemo.astro) and every later frame in the browser (innerHTML in controller.ts). The
 * markup contains numbers and fixed class names only; the one text node, an axis name, is
 * escaped. Colours and line widths live in CollisionDemo.astro's stylesheet (.cd-* classes).
 *
 * Sizes that should look the same on every screen (dots, arrowheads, gaps between bars) are
 * multiplied by `k`, the number of world units per CSS pixel, which the controller measures.
 */
import type { SatAxis } from '../../../../lib/geometry/collide.ts';
import { aabbCorners, type Aabb, type Polygon } from '../../../../lib/geometry/shapes.ts';
import { add, clamp, dot, length, perp, scale, sub, vec, type Vec } from '../../../../lib/geometry/vec.ts';
import { WORLD, asAabb, asPolygon, notchPieces, resolvedB, shapeBounds, type Analysis, type Scene, type ShapeState } from './scene.ts';

export interface View {
  /** World units per CSS pixel. */
  readonly k: number;
  /** The SAT axis to draw (index into the result's axes). */
  readonly axis: number;
}

// ---------------------------------------------------------------- primitives

/** A coordinate with at most two decimals, never "-0". */
export function num(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function escapeText(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

const pointsAttr = (points: readonly Vec[]) => points.map((p) => `${num(p.x)},${num(p.y)}`).join(' ');

function line(a: Vec, b: Vec, cls: string): string {
  return `<line x1="${num(a.x)}" y1="${num(a.y)}" x2="${num(b.x)}" y2="${num(b.y)}" class="${cls}"/>`;
}

function polygon(points: readonly Vec[], cls: string): string {
  return points.length < 2 ? '' : `<polygon points="${pointsAttr(points)}" class="${cls}"/>`;
}

function dotAt(center: Vec, radius: number, cls: string): string {
  return `<circle cx="${num(center.x)}" cy="${num(center.y)}" r="${num(radius)}" class="${cls}"/>`;
}

function path(d: string, cls: string): string {
  return `<path d="${d}" class="${cls}"/>`;
}

function label(at: Vec, text: string, cls: string, anchor: 'start' | 'middle' | 'end' = 'middle'): string {
  return `<text x="${num(at.x)}" y="${num(at.y)}" text-anchor="${anchor}" class="${cls}">${escapeText(text)}</text>`;
}

/** A shaft with a solid head at `to`. Nothing when the arrow would be shorter than its head. */
function arrow(from: Vec, to: Vec, k: number, cls: string): string {
  const along = sub(to, from);
  const len = length(along);
  const head = 9 * k;
  if (len < head * 0.75) return '';
  const unit = scale(along, 1 / len);
  const side = scale(perp(unit), 4.5 * k);
  const base = sub(to, scale(unit, head));
  return (
    `<g class="${cls}">` +
    line(from, add(base, scale(unit, 1 * k)), 'cd-arrow-shaft') +
    polygon([to, add(base, side), sub(base, side)], 'cd-arrow-head') +
    `</g>`
  );
}

/** SVG path data of a polygon, or of a circle as two half-arcs. */
export function polygonPath(points: Polygon): string {
  if (points.length === 0) return '';
  return `M${points.map((p) => `${num(p.x)} ${num(p.y)}`).join('L')}Z`;
}

function circlePath(center: Vec, radius: number): string {
  const r = num(radius);
  return (
    `M${num(center.x - radius)} ${num(center.y)}` +
    `a${r} ${r} 0 1 0 ${num(2 * radius)} 0` +
    `a${r} ${r} 0 1 0 ${num(-2 * radius)} 0Z`
  );
}

export function shapePath(shape: ShapeState): string {
  return shape.kind === 'circle' ? circlePath(shape.center, shape.radius) : polygonPath(asPolygon(shape));
}

// ---------------------------------------------------------------- shared overlays

/** Closest points of two separated shapes: a dashed segment with an open dot at each end. */
function closestPair(pair: { a: Vec; b: Vec } | null, k: number): string {
  if (!pair) return '';
  return line(pair.a, pair.b, 'cd-closest') + dotAt(pair.a, 3 * k, 'cd-closest-end') + dotAt(pair.b, 3 * k, 'cd-closest-end');
}

function contactDot(contact: Vec | null, k: number): string {
  return contact ? dotAt(contact, 5 * k, 'cd-contact') : '';
}

/** B's outline after moving it by the MTV: where it would rest, just touching A. */
function ghost(scene: Scene, mtv: Vec, depth: number): string {
  if (depth < 1) return '';
  return path(shapePath(resolvedB(scene, mtv)), 'cd-ghost');
}

/** The MTV drawn centred on a point, so that it spans the overlap it removes. */
function centredMtv(contact: Vec | null, mtv: Vec, depth: number, k: number): string {
  if (!contact || depth < 1) return '';
  const half = scale(mtv, 0.5);
  return arrow(sub(contact, half), add(contact, half), k, 'cd-mtv');
}

// ---------------------------------------------------------------- projections on an axis

/**
 * The shadows of A and B on a line of direction `axis` (unit), drawn at offset `s` along the
 * perpendicular t = perp(axis): the point at parameter u of the axis is s·t + u·axis. A's shadow
 * sits just on one side of the line and B's on the other; their common part (or the gap between
 * them) is marked on the line itself.
 */
function shadows(
  axis: Vec,
  s: number,
  ia: { min: number; max: number },
  ib: { min: number; max: number },
  extent: [number, number],
  k: number,
  name: string | null,
): string {
  const t = perp(axis);
  const at = (u: number, offset = 0) => add(scale(t, s + offset), scale(axis, u));
  const [u0, u1] = extent;
  let out = line(at(u0), at(u1), 'cd-axis');
  const gapA = -3.5 * k;
  const gapB = 3.5 * k;
  out += line(at(ia.min, gapA), at(ia.max, gapA), 'cd-bar cd-bar-a');
  out += line(at(ib.min, gapB), at(ib.max, gapB), 'cd-bar cd-bar-b');
  const lo = Math.max(ia.min, ib.min);
  const hi = Math.min(ia.max, ib.max);
  if (lo <= hi) {
    out += line(at(lo), at(hi), 'cd-common');
  } else {
    out += line(at(hi), at(lo), 'cd-gap');
    out += line(at(hi, -6 * k), at(hi, 6 * k), 'cd-gap-tick') + line(at(lo, -6 * k), at(lo, 6 * k), 'cd-gap-tick');
  }
  // The name sits on the line near its far end, on a paper-coloured halo (see .cd-axis-name),
  // pulled back inside the figure where the line leaves it through a corner or an edge.
  if (name) {
    const end = at(u1 - 4 * k);
    const inside = vec(clamp(end.x, 24 * k, WORLD.width - 4 * k), clamp(end.y, 9 * k, WORLD.height - 9 * k));
    out += label(inside, name, 'cd-axis-name', 'end');
  }
  return out;
}

/** Range of parameters u for which s·t + u·axis lies inside the world, inset by `margin`. */
function clipToWorld(axis: Vec, s: number, margin: number): [number, number] | null {
  const t = perp(axis);
  const origin = scale(t, s);
  let lo = -Infinity;
  let hi = Infinity;
  const slabs: [number, number, number, number][] = [
    [origin.x, axis.x, margin, WORLD.width - margin],
    [origin.y, axis.y, margin, WORLD.height - margin],
  ];
  for (const [p, d, min, max] of slabs) {
    if (Math.abs(d) < 1e-12) {
      if (p < min || p > max) return null;
      continue;
    }
    const a = (min - p) / d;
    const b = (max - p) / d;
    lo = Math.max(lo, Math.min(a, b));
    hi = Math.min(hi, Math.max(a, b));
  }
  return lo < hi ? [lo, hi] : null;
}

/**
 * Where to draw the axis line: parallel to the axis, just outside both shapes (so the shadows
 * and the lines that cast them stay readable), on whichever side leaves the longer line inside
 * the figure. Falls back to the middle of the figure when neither side has room.
 */
export function axisPlacement(axis: Vec, polygons: readonly Polygon[], k: number): { s: number; extent: [number, number] } {
  const t = perp(axis);
  let tMin = Infinity;
  let tMax = -Infinity;
  for (const poly of polygons) {
    for (const p of poly) {
      const d = dot(p, t);
      tMin = Math.min(tMin, d);
      tMax = Math.max(tMax, d);
    }
  }
  const offset = 18 + 10 * k;
  const margin = 6 * k;
  const candidates = [tMax + offset, tMin - offset]
    .map((s) => ({ s, extent: clipToWorld(axis, s, margin) }))
    .filter((c): c is { s: number; extent: [number, number] } => c.extent !== null)
    .sort((x, y) => y.extent[1] - y.extent[0] - (x.extent[1] - x.extent[0]));
  const chosen = candidates[0];
  // Long enough to hold both shadows with room to spare? Otherwise the line runs through the middle.
  if (chosen && chosen.extent[1] - chosen.extent[0] > 120) return chosen;
  const middle = dot(vec(WORLD.width / 2, WORLD.height / 2), t);
  return { s: middle, extent: clipToWorld(axis, middle, margin) ?? [0, 1] };
}

/** "A1", "A2", "B1"…: axes numbered per polygon, in the order of the result. */
export function axisNames(axes: readonly SatAxis[]): string[] {
  const counts = { a: 0, b: 0 };
  return axes.map((axis) => {
    counts[axis.source] += 1;
    return `${axis.source.toUpperCase()}${counts[axis.source]}`;
  });
}

/** The axis the figure shows when the reader has not picked one: the separating one, or the MTV's. */
export function automaticAxis(analysis: Analysis): number {
  if (analysis.kind !== 'sat') return -1;
  const { separatingAxis, mtvAxis } = analysis.result;
  return separatingAxis >= 0 ? separatingAxis : Math.max(0, mtvAxis);
}

// ---------------------------------------------------------------- per figure

/** Shadows of two shapes' bounding boxes on rulers along the bottom (x) and left (y) edges. */
function rulers(a: Aabb, b: Aabb, k: number): string {
  const baseX = WORLD.height - 14 - 6 * k;
  const baseY = 14 + 6 * k;
  let out = '';
  // Faint lines carry each box's sides down to the x shadow and across to the y shadow.
  for (const box of [a, b]) {
    for (const x of [box.min.x, box.max.x]) out += line(vec(x, box.max.y), vec(x, baseX), 'cd-cast');
    for (const y of [box.min.y, box.max.y]) out += line(vec(box.min.x, y), vec(baseY, y), 'cd-cast');
  }
  const margin = 6 * k;
  // x axis: direction (1, 0), t = (0, 1), so the line y = baseX. y axis: direction (0, −1),
  // t = (1, 0), so the line x = baseY, read upwards like a graph's y axis.
  out += shadows(vec(1, 0), baseX, { min: a.min.x, max: a.max.x }, { min: b.min.x, max: b.max.x }, [margin, WORLD.width - margin], k, 'x');
  out += shadows(
    vec(0, -1),
    baseY,
    { min: -a.max.y, max: -a.min.y },
    { min: -b.max.y, max: -b.min.y },
    [-(WORLD.height - margin), -margin],
    k,
    'y',
  );
  return out;
}

function underAabb(scene: Scene, k: number): string {
  if (scene.a.kind !== 'box' || scene.b.kind !== 'box') return '';
  return rulers(asAabb(scene.a), asAabb(scene.b), k);
}

function overAabb(scene: Scene, analysis: Analysis & { kind: 'aabb' }, k: number): string {
  const r = analysis.result;
  let out = '';
  if (r.intersection) out += polygon(aabbCorners(r.intersection), 'cd-region');
  out += ghost(scene, r.mtv, r.depth);
  out += centredMtv(r.contact, r.mtv, r.depth, k);
  out += contactDot(r.contact, k);
  out += closestPair(r.closest, k);
  return out;
}

function underCircles(scene: Scene): string {
  if (scene.a.kind !== 'circle' || scene.b.kind !== 'circle') return '';
  return line(scene.a.center, scene.b.center, 'cd-guide');
}

/** The lens where two discs overlap, bounded by an arc of each (or the smaller disc if nested). */
function lens(a: { center: Vec; radius: number }, b: { center: Vec; radius: number }): string {
  const delta = sub(b.center, a.center);
  const d = length(delta);
  if (d <= Math.abs(a.radius - b.radius)) {
    const small = a.radius <= b.radius ? a : b;
    return circlePath(small.center, small.radius);
  }
  if (d >= a.radius + b.radius || d === 0) return '';
  const n = scale(delta, 1 / d);
  const along = (a.radius * a.radius - b.radius * b.radius + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a.radius * a.radius - along * along));
  const foot = add(a.center, scale(n, along));
  const p1 = add(foot, scale(perp(n), h));
  const p2 = sub(foot, scale(perp(n), h));
  const arcThrough = (from: Vec, mid: Vec, to: Vec, radius: number, center: Vec) => {
    const chord = sub(to, from);
    const cross = (u: Vec, v: Vec) => u.x * v.y - u.y * v.x;
    const sweep = cross(sub(mid, from), sub(to, mid)) > 0 ? 1 : 0;
    const large = Math.sign(cross(chord, sub(mid, from))) === Math.sign(cross(chord, sub(center, from))) ? 1 : 0;
    return `A${num(radius)} ${num(radius)} 0 ${large} ${sweep} ${num(to.x)} ${num(to.y)}`;
  };
  const midA = add(a.center, scale(n, a.radius));
  const midB = sub(b.center, scale(n, b.radius));
  return `M${num(p1.x)} ${num(p1.y)}${arcThrough(p1, midA, p2, a.radius, a.center)}${arcThrough(p2, midB, p1, b.radius, b.center)}Z`;
}

function overCircles(scene: Scene, analysis: Analysis & { kind: 'circles' }, k: number): string {
  if (scene.a.kind !== 'circle' || scene.b.kind !== 'circle') return '';
  const r = analysis.result;
  let out = '';
  if (r.relation === 'overlapping') out += path(lens(scene.a, scene.b), 'cd-region');
  out += ghost(scene, r.mtv, r.depth);
  out += dotAt(scene.a.center, 2.5 * k, 'cd-center') + dotAt(scene.b.center, 2.5 * k, 'cd-center');
  out += centredMtv(r.contact, r.mtv, r.depth, k);
  out += contactDot(r.contact, k);
  out += closestPair(r.closest, k);
  return out;
}

function underCircleBox(scene: Scene): string {
  if (scene.a.kind !== 'box') return '';
  const box = asAabb(scene.a);
  // The box's sides, extended: they split the plane into the regions where the nearest point
  // of the box is a corner, a point of a side, or (inside) the centre itself.
  return (
    line(vec(box.min.x, 0), vec(box.min.x, WORLD.height), 'cd-cast') +
    line(vec(box.max.x, 0), vec(box.max.x, WORLD.height), 'cd-cast') +
    line(vec(0, box.min.y), vec(WORLD.width, box.min.y), 'cd-cast') +
    line(vec(0, box.max.y), vec(WORLD.width, box.max.y), 'cd-cast')
  );
}

function overCircleBox(scene: Scene, analysis: Analysis & { kind: 'circle-box' }, k: number): string {
  if (scene.a.kind !== 'box' || scene.b.kind !== 'circle') return '';
  const r = analysis.result;
  const box = asAabb(scene.a);
  const c = scene.b.center;
  let out = '';
  if (r.inside && r.face && r.contact) {
    const [from, to] =
      r.face === 'min-x' || r.face === 'max-x'
        ? [vec(r.contact.x, box.min.y), vec(r.contact.x, box.max.y)]
        : [vec(box.min.x, r.contact.y), vec(box.max.x, r.contact.y)];
    out += line(from, to, 'cd-face');
    out += line(c, r.contact, 'cd-guide');
  } else {
    out += line(c, r.clamped, 'cd-clamp');
  }
  out += ghost(scene, r.mtv, r.depth);
  out += dotAt(c, 2.5 * k, 'cd-center');
  out += label(add(c, vec(8 * k, 12 * k)), 'c', 'cd-var', 'start');
  if (r.contact && r.depth >= 1) out += arrow(sub(r.contact, r.mtv), r.contact, k, 'cd-mtv');
  out += closestPair(r.closest, k);
  // p, the clamped point: an open ring, filled when it is also the contact point.
  const p = r.inside && r.contact ? r.contact : r.clamped;
  out += r.hit ? contactDot(p, k) : dotAt(p, 5 * k, 'cd-point');
  out += label(add(p, vec(-8 * k, 16 * k)), 'p', 'cd-var', 'end');
  return out;
}

function underSat(scene: Scene, analysis: Analysis & { kind: 'sat' }, view: View): string {
  const axes = analysis.result.axes;
  const entry = axes[view.axis];
  if (!entry) return '';
  const pa = asPolygon(scene.a);
  const pb = asPolygon(scene.b);
  const { s, extent } = axisPlacement(entry.axis, [pa, pb], view.k);
  const t = perp(entry.axis);
  let out = '';
  // Lines that cast each shadow: from the extreme vertices of each polygon, across to the axis.
  for (const [poly, interval, offset] of [
    [pa, entry.a, -3.5 * view.k],
    [pb, entry.b, 3.5 * view.k],
  ] as const) {
    for (const u of [interval.min, interval.max]) {
      const vertex = poly.reduce((best, p) => (Math.abs(dot(p, entry.axis) - u) < Math.abs(dot(best, entry.axis) - u) ? p : best));
      out += line(vertex, add(scale(t, s + offset), scale(entry.axis, u)), 'cd-cast');
    }
  }
  out += shadows(entry.axis, s, entry.a, entry.b, extent, view.k, axisNames(axes)[view.axis] ?? null);
  return out;
}

function overSat(scene: Scene, analysis: Analysis & { kind: 'sat' }, k: number): string {
  const r = analysis.result;
  let out = '';
  if (r.relation === 'overlapping') out += polygon(r.intersection, 'cd-region');
  out += ghost(scene, r.mtv, r.depth);
  out += centredMtv(r.contact, r.mtv, r.depth, k);
  out += contactDot(r.contact, k);
  out += closestPair(r.closest, k);
  return out;
}

/**
 * The U's edges are all horizontal or vertical, so SAT's only axes are x and y: its shadows on
 * the rulers are exactly what SAT compares.
 */
function underConcave(scene: Scene, k: number): string {
  return rulers(shapeBounds(scene.a), shapeBounds(scene.b), k);
}

function overConcave(scene: Scene, analysis: Analysis & { kind: 'concave' }, k: number): string {
  const [left, right] = notchPieces(scene.a);
  let out = '';
  // Where the U is cut into its convex pieces: under each column, across the base.
  if (left && right) out += line(left[2]!, left[3]!, 'cd-guide') + line(right[2]!, right[3]!, 'cd-guide');
  out += contactDot(analysis.result.contact, k);
  out += closestPair(analysis.result.closest, k);
  return out;
}

export function drawUnder(scene: Scene, analysis: Analysis, view: View): string {
  switch (analysis.kind) {
    case 'concave':
      return underConcave(scene, view.k);
    case 'aabb':
      return underAabb(scene, view.k);
    case 'circles':
      return underCircles(scene);
    case 'circle-box':
      return underCircleBox(scene);
    case 'sat':
      return underSat(scene, analysis, view);
  }
}

export function drawOver(scene: Scene, analysis: Analysis, view: View): string {
  switch (analysis.kind) {
    case 'concave':
      return overConcave(scene, analysis, view.k);
    case 'aabb':
      return overAabb(scene, analysis, view.k);
    case 'circles':
      return overCircles(scene, analysis, view.k);
    case 'circle-box':
      return overCircleBox(scene, analysis, view.k);
    case 'sat':
      return overSat(scene, analysis, view.k);
  }
}

/**
 * Where a shape's letter goes: its centre, except where the centre is taken. A circle's centre
 * carries a dot (and the line of centres), so its letter sits above it; the U's centroid falls in
 * its notch, outside the shape, so its letter sits in the base.
 */
export function tagPosition(shape: ShapeState): Vec {
  if (shape.kind === 'circle') return add(shape.center, vec(0, -0.5 * shape.radius));
  const base = notchPieces(shape)[2];
  if (base) return scale(add(base[0]!, base[2]!), 0.5);
  return shape.center;
}
