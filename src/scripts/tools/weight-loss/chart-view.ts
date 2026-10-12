/**
 * Draws the weight chart into an <svg> (browser only), in the thin-line style of the site's
 * figures: zinc gridlines and axis, the projected weight in the accent colour, the target as a
 * dashed line with a dot on the day it is reached. The faint dashed line is the naive estimate
 * that keeps the first day's deficit forever, which reaches the target sooner.
 *
 * The SVG is redrawn at its real pixel width whenever the figure resizes, so text stays 11 px.
 * Pointing at the chart (mouse, pen or a finger dragged sideways) shows the nearest day in the
 * readout; keyboard and screen-reader users have the table, which holds the same values.
 */
import type { Locale } from '../../../i18n/config.ts';
import { addDays, type Plan, type PlanDay } from '../../../lib/health/weight-plan.ts';
import { chartScene, frameFor, type Scene } from './chart.ts';
import type { Presenter } from './present.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

type Attributes = Record<string, string | number>;

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Attributes,
  text?: string,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
}

const CLASSES = {
  grid: 'text-zinc-200 dark:text-zinc-800',
  axis: 'text-zinc-400 dark:text-zinc-600',
  label: 'fill-zinc-600 font-mono text-[11px] tabular-nums dark:fill-zinc-400',
  ink: 'text-zinc-900 dark:text-zinc-100',
  inkLabel: 'fill-zinc-900 font-mono text-[11px] tabular-nums dark:fill-zinc-100',
  faint: 'text-zinc-500 dark:text-zinc-400',
  accent: 'text-accent-600 dark:text-accent-400',
  accentLabel: 'fill-accent-700 font-mono text-[11px] font-semibold tabular-nums dark:fill-accent-400',
  dot: 'fill-accent-600 stroke-white dark:fill-accent-400 dark:stroke-zinc-900',
} as const;

/** Rough width of an 11 px monospace label, for keeping labels inside the figure. */
const labelWidth = (text: string) => text.length * 6.7;

export interface ChartView {
  show(plan: Plan): void;
}

export function createChartView(
  host: HTMLElement,
  element: SVGSVGElement,
  readout: HTMLElement,
  present: Presenter,
  locale: Locale,
  idleText: string,
): ChartView {
  let plan: Plan | null = null;
  let scene: Scene | null = null;
  let width = 0;
  const hover = {
    guide: svg('line', { 'stroke-width': 1, 'stroke-dasharray': '2 3', stroke: 'currentColor', class: CLASSES.axis }),
    dot: svg('circle', { r: 4, 'stroke-width': 2, class: CLASSES.dot }),
  };

  function draw(): void {
    if (!plan || width <= 0) return;
    const frame = frameFor(width);
    const current = chartScene(plan, frame, locale);
    scene = current;
    const { margin } = frame;
    const left = margin.left;
    const right = frame.width - margin.right;
    const top = margin.top;
    const bottom = frame.height - margin.bottom;

    element.setAttribute('viewBox', `0 0 ${frame.width} ${frame.height}`);
    element.setAttribute('height', String(frame.height));

    const parts: SVGElement[] = [];

    // Gridlines and the weight scale.
    const grid = svg('g', { stroke: 'currentColor', 'stroke-width': 1, class: CLASSES.grid });
    const yLabels = svg('g', { 'text-anchor': 'end', class: CLASSES.label });
    for (const value of current.yTicks) {
      const y = current.y(value).toFixed(1);
      grid.append(svg('line', { x1: left, x2: right, y1: y, y2: y }));
      yLabels.append(svg('text', { x: left - 7, y, dy: '0.32em' }, present.fixed(value, Number.isInteger(value) ? 0 : 1)));
    }
    yLabels.append(svg('text', { x: left - 7, y: top - 9 }, 'kg'));
    parts.push(grid, yLabels);

    // Time axis: the baseline, ticks and their labels.
    const axis = svg('g', { stroke: 'currentColor', 'stroke-width': 1, class: CLASSES.axis });
    axis.append(svg('line', { x1: left, x2: right, y1: bottom, y2: bottom }));
    const xLabels = svg('g', { class: CLASSES.label });
    for (const tick of current.xTicks) {
      const x = current.x(tick.day);
      axis.append(svg('line', { x1: x.toFixed(1), x2: x.toFixed(1), y1: bottom, y2: bottom + 4 }));
      const half = labelWidth(tick.label) / 2;
      const anchor = x - half < 2 ? 'start' : x + half > frame.width - 2 ? 'end' : 'middle';
      const lx = anchor === 'start' ? Math.max(2, x - 4) : anchor === 'end' ? Math.min(frame.width - 2, x + 4) : x;
      xLabels.append(svg('text', { x: lx.toFixed(1), y: bottom + 18, 'text-anchor': anchor }, tick.label));
    }
    parts.push(axis, xLabels);

    // Target: a dashed line, labelled above its left end, where the curve is still high.
    const targetY = current.y(plan.input.targetKg);
    parts.push(
      svg('line', {
        x1: left,
        x2: right,
        y1: targetY.toFixed(1),
        y2: targetY.toFixed(1),
        stroke: 'currentColor',
        'stroke-width': 1,
        'stroke-dasharray': '5 4',
        'stroke-opacity': 0.75,
        class: CLASSES.ink,
      }),
      svg(
        'text',
        { x: left + 6, y: (targetY - 7).toFixed(1), class: CLASSES.inkLabel },
        weightLabel(plan, 'target'),
      ),
    );

    // Where the curve levels off, when the target is out of reach.
    if (current.levelKg !== null) {
      const levelY = current.y(current.levelKg);
      parts.push(
        svg('line', {
          x1: left,
          x2: right,
          y1: levelY.toFixed(1),
          y2: levelY.toFixed(1),
          stroke: 'currentColor',
          'stroke-width': 1,
          'stroke-dasharray': '1 4',
          'stroke-linecap': 'round',
          class: CLASSES.faint,
        }),
        svg(
          'text',
          // Under the line: the curve approaches it from above.
          { x: right, y: (levelY + 15).toFixed(1), 'text-anchor': 'end', class: CLASSES.label },
          weightLabel(plan, 'level'),
        ),
      );
    }

    if (current.linearPath) {
      parts.push(
        svg('path', {
          d: current.linearPath,
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': 1.25,
          'stroke-dasharray': '3 4',
          class: CLASSES.faint,
        }),
      );
    }

    parts.push(
      svg('path', {
        d: current.weightPath,
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round',
        class: CLASSES.accent,
      }),
    );

    // The day the target is reached: a dot, and its date under the line, where the curve never is.
    if (plan.outcome === 'reached' && plan.targetDay !== null) {
      const x = current.x(plan.targetDay);
      const label = present.shortDate(addDays(plan.input.start, plan.targetDay));
      const fits = x - 4 - labelWidth(label) >= left;
      parts.push(
        svg('circle', { cx: x.toFixed(1), cy: targetY.toFixed(1), r: 4.5, 'stroke-width': 2, class: CLASSES.dot }),
        svg(
          'text',
          {
            x: (fits ? x - 4 : x + 10).toFixed(1),
            y: (targetY + 16).toFixed(1),
            'text-anchor': fits ? 'end' : 'start',
            class: CLASSES.accentLabel,
          },
          label,
        ),
      );
    }

    hover.guide.setAttribute('y1', String(top));
    hover.guide.setAttribute('y2', String(bottom));
    hover.guide.setAttribute('visibility', 'hidden');
    hover.dot.setAttribute('visibility', 'hidden');
    parts.push(hover.guide, hover.dot);

    element.replaceChildren(...parts);
  }

  function weightLabel(current: Plan, which: 'target' | 'level'): string {
    if (which === 'target') return present.targetLine(current.input.targetKg);
    return present.levelLine(current.equilibriumKg ?? 0);
  }

  function showDay(day: PlanDay): void {
    if (!plan || !scene) return;
    const x = scene.x(day.day).toFixed(1);
    hover.guide.setAttribute('x1', x);
    hover.guide.setAttribute('x2', x);
    hover.guide.setAttribute('visibility', 'visible');
    hover.dot.setAttribute('cx', x);
    hover.dot.setAttribute('cy', scene.y(day.weightKg).toFixed(1));
    hover.dot.setAttribute('visibility', 'visible');
    readout.textContent = present.readout(plan, day);
  }

  function clearHover(): void {
    hover.guide.setAttribute('visibility', 'hidden');
    hover.dot.setAttribute('visibility', 'hidden');
    readout.textContent = idleText;
  }

  function onPointer(event: PointerEvent): void {
    if (!plan || !scene) return;
    const box = element.getBoundingClientRect();
    if (box.width === 0) return;
    const px = ((event.clientX - box.left) / box.width) * scene.frame.width;
    const day = plan.days[scene.dayAt(px)];
    if (day) showDay(day);
  }

  element.addEventListener('pointermove', onPointer);
  element.addEventListener('pointerdown', onPointer);
  element.addEventListener('pointerleave', (event) => {
    // A finger lifting also "leaves"; keep its reading on screen.
    if (event.pointerType === 'mouse') clearHover();
  });

  new ResizeObserver((entries) => {
    const next = Math.round(entries[0]?.contentRect.width ?? 0);
    if (next > 0 && next !== width) {
      width = next;
      draw();
    }
  }).observe(host);

  return {
    show(next) {
      plan = next;
      width = Math.round(host.getBoundingClientRect().width) || width;
      draw();
      clearHover();
    },
  };
}
