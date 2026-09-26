/**
 * The words and numbers around a collision figure: the status line ("Colliding — depth 12 px"),
 * the readout under the drawing, and one row per SAT axis with its two shadows as bars.
 *
 * Pure module: CollisionDemo.astro renders the starting position with it at build time and the
 * controller updates the same elements after every move.
 */
import type { SatAxis } from '../../../../lib/geometry/collide.ts';
import type { Vec } from '../../../../lib/geometry/vec.ts';
import type { Formatters } from '../../../../i18n/format.ts';
import type { CollisionMessages } from './messages.ts';
import { axisNames } from './draw.ts';
import type { Analysis } from './scene.ts';

/** Whole units with a true minus sign: "12", "−3", "0" (never "−0"). */
export function formatUnits(value: number, format: Formatters): string {
  const rounded = Math.round(value);
  if (rounded === 0) return format.number(0);
  return rounded < 0 ? `−${format.number(-rounded)}` : format.number(rounded);
}

export function formatPoint(point: Vec, m: CollisionMessages, format: Formatters): string {
  return m.point(formatUnits(point.x, format), formatUnits(point.y, format));
}

export function statusText(analysis: Analysis, m: CollisionMessages, format: Formatters): string {
  if (analysis.kind === 'concave') {
    const truth = analysis.result;
    if (truth.relation === 'separated') {
      const gap = formatUnits(truth.distance, format);
      return analysis.sat.hit ? m.status.falseHit(gap) : m.status.separated(gap);
    }
    return truth.relation === 'touching' ? m.status.agreeTouching : m.status.agreeOverlapping;
  }
  const r = analysis.result;
  if (r.relation === 'overlapping') return m.status.overlapping(formatUnits(r.depth, format));
  if (r.relation === 'touching') return m.status.touching;
  return m.status.separated(formatUnits(r.distance, format));
}

export interface ReadoutItem {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

/** Four label–value pairs per figure, always the same keys, so the layout never jumps. */
export function readout(analysis: Analysis, m: CollisionMessages, format: Formatters): ReadoutItem[] {
  const r = analysis.result;
  const none = m.readout.none;
  const px = (value: number) => m.px(formatUnits(value, format));
  const mtv = r.depth > 0 ? formatPoint(r.mtv, m, format) : none;
  const contact = r.contact ? formatPoint(r.contact, m, format) : none;
  switch (analysis.kind) {
    case 'aabb':
      return [
        { key: 'overlapX', label: m.readout.overlapX, value: px(analysis.result.overlapX) },
        { key: 'overlapY', label: m.readout.overlapY, value: px(analysis.result.overlapY) },
        { key: 'mtv', label: m.readout.mtv, value: mtv },
        { key: 'contact', label: m.readout.contact, value: contact },
      ];
    case 'circles':
      return [
        { key: 'centerDistance', label: m.readout.centerDistance, value: px(analysis.result.centerDistance) },
        { key: 'radiusSum', label: m.readout.radiusSum, value: px(analysis.result.radiusSum) },
        { key: 'mtv', label: m.readout.mtv, value: mtv },
        { key: 'contact', label: m.readout.contact, value: contact },
      ];
    case 'circle-box': {
      const result = analysis.result;
      return [
        { key: 'closestPoint', label: m.readout.closestPoint, value: formatPoint(result.clamped, m, format) },
        { key: 'center', label: m.readout.center, value: result.inside ? m.readout.inside : m.readout.outside },
        { key: 'toCenter', label: m.readout.toCenter, value: px(result.clampDistance) },
        { key: 'mtv', label: m.readout.mtv, value: mtv },
      ];
    }
    case 'sat': {
      const result = analysis.result;
      const names = axisNames(result.axes);
      return [
        { key: 'axes', label: m.readout.axes, value: format.number(result.axes.length) },
        { key: 'separatingAxis', label: m.readout.separatingAxis, value: result.separatingAxis >= 0 ? names[result.separatingAxis]! : none },
        { key: 'mtv', label: m.readout.mtv, value: mtv },
        { key: 'contact', label: m.readout.contact, value: contact },
      ];
    }
    case 'concave': {
      const sat = analysis.sat;
      return [
        { key: 'satSays', label: m.readout.satSays, value: m.relations[sat.relation] },
        { key: 'piecesSay', label: m.readout.piecesSay, value: m.relations[r.relation] },
        { key: 'distance', label: m.readout.distance, value: px(r.distance) },
        {
          key: 'separatingAxis',
          label: m.readout.separatingAxis,
          value: sat.separatingAxis >= 0 ? axisNames(sat.axes)[sat.separatingAxis]! : none,
        },
      ];
    }
  }
}

// ---------------------------------------------------------------- SAT axis rows

export interface AxisRow {
  readonly name: string;
  /** "overlap 23 px" / "gap 12 px", plus "separates" or "parallel…" where it applies. */
  readonly detail: string;
  readonly state: 'overlap' | 'separating' | 'gap';
  readonly duplicate: boolean;
  /** Bars in a 0–100 wide box: A's shadow, B's shadow, and their common part or the gap. */
  readonly bars: {
    readonly a: readonly [number, number];
    readonly b: readonly [number, number];
    readonly common: readonly [number, number] | null;
    readonly gap: readonly [number, number] | null;
  };
}

/**
 * One row per axis. Every row uses the same scale (units per bar width), so lengths compare
 * across rows; each row is centred on its own two shadows.
 */
export function axisRows(axes: readonly SatAxis[], m: CollisionMessages, format: Formatters): AxisRow[] {
  const names = axisNames(axes);
  const span = Math.max(1, ...axes.map((axis) => Math.max(axis.a.max, axis.b.max) - Math.min(axis.a.min, axis.b.min)));
  const unit = 94 / span;
  return axes.map((axis, index) => {
    const mid = (Math.min(axis.a.min, axis.b.min) + Math.max(axis.a.max, axis.b.max)) / 2;
    const x = (u: number) => 50 + (u - mid) * unit;
    const bar = (lo: number, hi: number) => [x(lo), Math.max(0, x(hi) - x(lo))] as const;
    const lo = Math.max(axis.a.min, axis.b.min);
    const hi = Math.min(axis.a.max, axis.b.max);
    const value = formatUnits(Math.abs(axis.overlap), format);
    const parts = [axis.overlap >= 0 ? m.axes.overlap(value) : m.axes.gap(value)];
    if (axis.separating) parts.push(m.axes.separating);
    if (axis.duplicate) {
      // Name the earlier axis it repeats (parallel unit vectors: their cross product vanishes).
      const twin = axes.findIndex((other, j) => j < index && Math.abs(other.axis.x * axis.axis.y - other.axis.y * axis.axis.x) <= 1e-9);
      if (twin >= 0) parts.push(m.axes.parallel(names[twin]!));
    }
    const detail = parts.join(', ');
    const name = names[index]!;
    return {
      name,
      detail,
      state: axis.separating ? 'separating' : axis.overlap >= 0 ? 'overlap' : 'gap',
      duplicate: axis.duplicate,
      bars: {
        a: bar(axis.a.min, axis.a.max),
        b: bar(axis.b.min, axis.b.max),
        common: lo <= hi ? bar(lo, hi) : null,
        gap: lo > hi ? bar(hi, lo) : null,
      },
    };
  });
}
