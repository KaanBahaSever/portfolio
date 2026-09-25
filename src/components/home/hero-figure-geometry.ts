/**
 * Geometry of the home page figure: a point P turning on a unit circle, and the sine wave its
 * height traces over time. Shared by the server render (the initial pose, so the figure is
 * complete without JavaScript) and the client animation, so both draw exactly the same shapes.
 *
 * Pure module: numbers in, SVG path strings out.
 *
 * Coordinates are SVG user units in a 480 × 280 viewBox, y pointing down. An angle θ is measured
 * counter-clockwise from the positive x-axis, as in mathematics, so P = (cx + r cos θ, cy − r sin θ).
 */

export const FIGURE = {
  width: 480,
  height: 280,
  /** Centre and radius of the unit circle (one unit = r user units). */
  cx: 108,
  cy: 140,
  r: 72,
  /** The wave runs from x0 to x1; `period` user units correspond to 2π on its axis. */
  x0: 216,
  x1: 456,
  period: 160,
  /** Radius of the small arc that marks θ at the centre. */
  arcRadius: 20,
  /** Pose rendered on the server and used without animation (reduced motion, no JavaScript). */
  initialAngle: Math.PI / 3,
} as const;

const TAU = 2 * Math.PI;

/** Two decimals are far below a device pixel at any size the figure is drawn. */
function n(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** θ reduced to [0, 2π). */
export function normalizeAngle(theta: number): number {
  return ((theta % TAU) + TAU) % TAU;
}

export function pointOnCircle(theta: number): { x: number; y: number } {
  return { x: FIGURE.cx + FIGURE.r * Math.cos(theta), y: FIGURE.cy - FIGURE.r * Math.sin(theta) };
}

/**
 * The wave y(x) = cy − r·sin(θ − k(x − x0)), k = 2π / period, for x0 ≤ x ≤ x1: at x0 it sits
 * exactly at P's height, and further right it shows where P was earlier.
 *
 * Drawn as cubic Hermite segments (value and slope matched at both ends), eight per period:
 * visually exact, and a dozen segments instead of the ~100 points a polyline would need.
 */
export function wavePath(theta: number, segmentsPerPeriod = 8): string {
  const { cy, r, x0, x1, period } = FIGURE;
  const k = TAU / period;
  const count = Math.max(1, Math.ceil(((x1 - x0) / period) * segmentsPerPeriod));
  const h = (x1 - x0) / count;
  const y = (x: number) => cy - r * Math.sin(theta - k * (x - x0));
  // dy/dx of −r·sin(θ − k(x − x0)) is r·k·cos(θ − k(x − x0)).
  const slope = (x: number) => r * k * Math.cos(theta - k * (x - x0));

  let d = `M${n(x0)} ${n(y(x0))}`;
  for (let i = 0; i < count; i += 1) {
    const a = x0 + i * h;
    const b = a + h;
    d +=
      `C${n(a + h / 3)} ${n(y(a) + (h / 3) * slope(a))} ` +
      `${n(b - h / 3)} ${n(y(b) - (h / 3) * slope(b))} ${n(b)} ${n(y(b))}`;
  }
  return d;
}

/** The arc from the positive x-axis to θ at the circle's centre (counter-clockwise on screen). */
export function anglePath(theta: number, radius: number = FIGURE.arcRadius): string {
  const t = normalizeAngle(theta);
  const { cx, cy } = FIGURE;
  const end = { x: cx + radius * Math.cos(t), y: cy - radius * Math.sin(t) };
  const largeArc = t > Math.PI ? 1 : 0;
  // y points down, so the mathematically positive direction is SVG's sweep-flag 0.
  return `M${n(cx + radius)} ${n(cy)}A${radius} ${radius} 0 ${largeArc} 0 ${n(end.x)} ${n(end.y)}`;
}

/** Where the "θ" label sits: halfway along the arc, just outside it. */
export function angleLabelPoint(theta: number, radius: number = FIGURE.arcRadius + 11): { x: number; y: number } {
  const half = normalizeAngle(theta) / 2;
  return { x: FIGURE.cx + radius * Math.cos(half), y: FIGURE.cy - radius * Math.sin(half) };
}

/** The unit circle as a path (paths, unlike <circle>, animate reliably with pathLength). */
export function circlePath(): string {
  const { cx, cy, r } = FIGURE;
  return `M${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}`;
}

/** Formats a number for an SVG attribute. */
export const svgNumber = n;
