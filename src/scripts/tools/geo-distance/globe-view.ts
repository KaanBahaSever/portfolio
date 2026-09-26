/**
 * The globe figure in the browser: redraws the server-rendered SVG for new points and turns
 * the globe towards the new route instead of jumping (a short slerp of the view centre; one
 * requestAnimationFrame loop that stops when it arrives). With prefers-reduced-motion, or in a
 * hidden tab, it jumps.
 */
import { globeScene, viewCenter, type GlobeScene } from '../../../lib/geo/globe.ts';
import { interpolate, toDegrees, vectorAngle, type LatLon } from '../../../lib/geo/sphere.ts';
import { GLOBE } from './figure.ts';

export interface GlobeView {
  show(a: LatLon, b: LatLon, options: { animate: boolean }): void;
}

function element<T extends Element>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`Geo distance: missing figure element ${selector}`);
  return found;
}

/** Turning speed: short turns stay brisk, a half-turn of the globe takes at most this long. */
const MIN_DURATION_MS = 220;
const MAX_DURATION_MS = 650;
const MS_PER_DEGREE = 4;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function createGlobeView(svg: SVGSVGElement): GlobeView {
  const paths = {
    graticule: element<SVGPathElement>(svg, '[data-graticule]'),
    equator: element<SVGPathElement>(svg, '[data-equator]'),
    circleFront: element<SVGPathElement>(svg, '[data-circle-front]'),
    circleBack: element<SVGPathElement>(svg, '[data-circle-back]'),
    route: element<SVGPathElement>(svg, '[data-route]'),
    routeHidden: element<SVGPathElement>(svg, '[data-route-hidden]'),
  } satisfies Partial<Record<keyof GlobeScene, SVGPathElement>>;
  const markers = {
    a: element<SVGGElement>(svg, '[data-marker="a"]'),
    b: element<SVGGElement>(svg, '[data-marker="b"]'),
  };
  const labels = {
    a: element<SVGTextElement>(svg, '[data-label="a"]'),
    b: element<SVGTextElement>(svg, '[data-label="b"]'),
  };
  const middle = element<SVGCircleElement>(svg, '[data-midpoint]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /** The centre currently on screen (null until the first draw). */
  let shown: LatLon | null = null;
  let frame = 0;
  /**
   * Draws the end state if animation frames stop arriving (a throttled or hidden view), so
   * the figure never stays on an old route.
   */
  let fallback = 0;

  function apply(scene: GlobeScene): void {
    for (const [key, path] of Object.entries(paths) as Array<[keyof typeof paths, SVGPathElement]>) {
      path.setAttribute('d', scene[key]);
    }
    for (const id of ['a', 'b'] as const) {
      const placed = scene[id];
      markers[id].setAttribute('transform', `translate(${placed.x.toFixed(1)} ${placed.y.toFixed(1)})`);
      // A point that has turned to the far side while the globe rotates is only hinted at.
      markers[id].setAttribute('opacity', placed.visible ? '1' : '0.25');
      labels[id].setAttribute('x', placed.labelX.toFixed(1));
      labels[id].setAttribute('y', placed.labelY.toFixed(1));
      labels[id].setAttribute('opacity', placed.visible ? '1' : '0.25');
    }
    if (scene.midpoint) {
      middle.setAttribute('cx', scene.midpoint.x.toFixed(1));
      middle.setAttribute('cy', scene.midpoint.y.toFixed(1));
      middle.setAttribute('visibility', scene.midpoint.visible ? 'visible' : 'hidden');
    } else {
      middle.setAttribute('visibility', 'hidden');
    }
  }

  function draw(a: LatLon, b: LatLon, center: LatLon): void {
    apply(globeScene(a, b, center, GLOBE));
    shown = center;
  }

  return {
    show(a, b, { animate }) {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
      const target = viewCenter(a, b);
      const from = shown;
      const turn = from ? toDegrees(vectorAngle(from, target)) : 0;
      // No turn to show, or no well-defined path for it (opposite centres): draw the end state.
      if (!animate || !from || turn < 0.01 || turn > 179.9 || reducedMotion.matches || document.hidden) {
        draw(a, b, target);
        return;
      }
      const duration = Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, turn * MS_PER_DEGREE));
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        draw(a, b, interpolate(from, target, easeInOutCubic(t)) ?? target);
        if (t < 1) frame = window.requestAnimationFrame(step);
        else window.clearTimeout(fallback);
      };
      frame = window.requestAnimationFrame(step);
      fallback = window.setTimeout(() => {
        window.cancelAnimationFrame(frame);
        draw(a, b, target);
      }, duration + 250);
    },
  };
}
