/**
 * Collision figures: DOM wiring (browser only). The state of each figure lives in a closure per
 * root element, so several figures work side by side on one page. Geometry and drawing are the
 * pure modules next to this file; this one turns input into a new Scene and re-renders.
 *
 * Input: drag a shape with a mouse, pen or finger (pointer capture keeps the drag going outside
 * the shape); or Tab to a shape and use the arrow keys (Shift for larger steps), Q and E to
 * rotate. Buttons rotate the shape chosen in "Rotate" and reset the figure. The status line
 * updates on every frame; a polite live region repeats it once the reader pauses.
 */
import { DEFAULT_LOCALE, isLocale, type Locale } from '../../../../i18n/config.ts';
import { formatters } from '../../../../i18n/format.ts';
import { add, sub, vec, type Vec } from '../../../../lib/geometry/vec.ts';
import { axisRows, readout, statusText, type AxisRow } from './describe.ts';
import { automaticAxis, drawOver, drawUnder, shapePath, tagPosition } from './draw.ts';
import { collisionMessages, type DemoKind, type PolygonName, type ShapeKey } from './messages.ts';
import {
  DEMO_KINDS,
  LARGE_ROTATE_STEP,
  LARGE_STEP_FACTOR,
  MOVE_STEP,
  POLYGON_NAMES,
  ROTATE_STEP,
  WORLD,
  analyse,
  canRotate,
  initialScene,
  moveShape,
  placeShape,
  rotateShape,
  withPolygon,
  type Scene,
} from './scene.ts';

/** Quiet time after the last move before the live region speaks. */
const ANNOUNCE_DELAY_MS = 500;
const KEYS: readonly ShapeKey[] = ['a', 'b'];

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Collision figure: missing element ${selector}`);
  return element;
}

function setText(element: Element, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}

function setAttr(element: Element, name: string, value: string): void {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

/** The figure's language: its own data-locale, else the nearest lang attribute (the article's). */
function figureLocale(root: HTMLElement): Locale {
  const own = root.dataset.locale;
  if (isLocale(own)) return own;
  const lang = root.closest('[lang]')?.getAttribute('lang')?.slice(0, 2).toLowerCase();
  return isLocale(lang) ? lang : DEFAULT_LOCALE;
}

export function initCollisionDemo(root: HTMLElement): void {
  if (root.dataset.ready === 'true') return;
  const kind = root.dataset.kind as DemoKind;
  if (!DEMO_KINDS.includes(kind)) throw new Error(`Collision figure: unknown kind ${String(kind)}`);
  root.dataset.ready = 'true';

  const locale = figureLocale(root);
  const m = collisionMessages[locale];
  const format = formatters(locale);

  const svg = query<SVGSVGElement>(root, '[data-stage]');
  const layers = {
    under: query<SVGGElement>(root, '[data-layer="under"]'),
    over: query<SVGGElement>(root, '[data-layer="over"]'),
  };
  const shapes = Object.fromEntries(
    KEYS.map((key) => {
      const group = query<SVGGElement>(root, `[data-shape="${key}"]`);
      return [
        key,
        {
          group,
          paths: Array.from(group.querySelectorAll<SVGPathElement>('path')),
          tag: query<SVGTextElement>(group, '[data-part="tag"]'),
        },
      ];
    }),
  ) as Record<ShapeKey, { group: SVGGElement; paths: SVGPathElement[]; tag: SVGTextElement }>;
  const status = query<HTMLElement>(root, '[data-status]');
  const live = query<HTMLElement>(root, '[data-live]');
  const values = new Map(
    Array.from(root.querySelectorAll<HTMLElement>('[data-readout]')).map((item) => [
      item.dataset.readout ?? '',
      query<HTMLElement>(item, '[data-value]'),
    ]),
  );
  const axisList = root.querySelector<HTMLElement>('[data-axis-list]');
  const axisShown = root.querySelector<HTMLElement>('[data-axis-shown]');
  const polygonInputs = Array.from(root.querySelectorAll<HTMLInputElement>('[data-polygon]'));
  const targetInputs = Array.from(root.querySelectorAll<HTMLInputElement>('[data-rotate-target]'));
  const rotateButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-rotate]'));
  const reset = query<HTMLButtonElement>(root, '[data-reset]');

  // ---------------------------------------------------------------- state

  const currentPolygon = (): PolygonName => {
    const value = polygonInputs.find((input) => input.checked)?.value;
    return POLYGON_NAMES.find((name) => name === value) ?? 'triangle';
  };
  let scene: Scene = initialScene(kind, currentPolygon());
  const rotatable = canRotate(scene);
  /** World units per CSS pixel (see --k in CollisionDemo.astro). */
  let k = 1;
  /** The SAT axis the reader picked, or null to follow the separating / MTV axis. */
  let pinned: number | null = null;
  let target: ShapeKey = 'a';
  let frame = 0;
  let announceTimer: ReturnType<typeof setTimeout> | undefined;
  let lastAnnounced = status.textContent ?? '';

  // ---------------------------------------------------------------- rendering

  function updateRows(rows: readonly AxisRow[], shown: number): void {
    if (!axisList) return;
    const first = axisList.firstElementChild;
    if (!first) return;
    while (axisList.children.length < rows.length) axisList.append(first.cloneNode(true));
    while (axisList.children.length > rows.length) axisList.lastElementChild?.remove();
    rows.forEach((row, index) => {
      const button = query<HTMLButtonElement>(axisList.children[index]!, '[data-axis-row]');
      button.dataset.axisRow = String(index);
      button.dataset.state = row.state;
      button.toggleAttribute('data-shown', index === shown);
      setAttr(button, 'aria-pressed', String(pinned === index));
      setText(query(button, '[data-axis-name]'), row.name);
      setText(query(button, '[data-axis-detail]'), row.detail);
      const bars = { a: row.bars.a, b: row.bars.b, common: row.bars.common ?? [0, 0], gap: row.bars.gap ?? [0, 0] };
      for (const [name, [x, width]] of Object.entries(bars)) {
        const rect = query<SVGRectElement>(button, `[data-bar="${name}"]`);
        setAttr(rect, 'x', x.toFixed(2));
        setAttr(rect, 'width', width.toFixed(2));
      }
    });
    if (axisShown) {
      const name = rows[shown]?.name ?? '';
      setText(axisShown, pinned === null ? m.axes.shownAuto(name) : m.axes.shownPinned(name));
    }
  }

  function render(): void {
    const analysis = analyse(scene);
    const axisCount = analysis.kind === 'sat' ? analysis.result.axes.length : 0;
    if (pinned !== null && pinned >= axisCount) pinned = null;
    const axis = pinned ?? automaticAxis(analysis);
    const view = { k, axis };

    for (const key of KEYS) {
      const d = shapePath(scene[key]);
      for (const path of shapes[key].paths) setAttr(path, 'd', d);
      const tag = tagPosition(scene[key]);
      setAttr(shapes[key].tag, 'x', tag.x.toFixed(2));
      setAttr(shapes[key].tag, 'y', tag.y.toFixed(2));
    }
    layers.under.innerHTML = drawUnder(scene, analysis, view);
    layers.over.innerHTML = drawOver(scene, analysis, view);

    root.dataset.relation = analysis.result.relation;
    setText(status, statusText(analysis, m, format));
    for (const item of readout(analysis, m, format)) {
      const value = values.get(item.key);
      if (value) setText(value, item.value);
    }
    if (analysis.kind === 'sat') updateRows(axisRows(analysis.result.axes, m, format), axis);
  }

  function schedule(): void {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      render();
    });
  }

  /** Speak the status once the reader pauses, and only if it changed since the last time. */
  function announceSoon(): void {
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      const text = statusText(analyse(scene), m, format);
      if (text === lastAnnounced) return;
      lastAnnounced = text;
      live.textContent = text;
    }, ANNOUNCE_DELAY_MS);
  }

  function update(next: Scene): void {
    scene = next;
    schedule();
    announceSoon();
  }

  function selectTarget(key: ShapeKey): void {
    target = key;
    for (const input of targetInputs) input.checked = input.value === key;
  }

  // ---------------------------------------------------------------- pointer

  function toWorld(event: PointerEvent): Vec | null {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return vec(point.x, point.y);
  }

  let drag: { key: ShapeKey; pointerId: number; offset: Vec } | null = null;

  for (const key of KEYS) {
    const { group } = shapes[key];

    group.addEventListener('pointerdown', (event) => {
      if (drag || (event.pointerType === 'mouse' && event.button !== 0)) return;
      const point = toWorld(event);
      if (!point) return;
      // No text selection, no emulated mouse events; focus is moved by hand below.
      event.preventDefault();
      drag = { key, pointerId: event.pointerId, offset: sub(scene[key].center, point) };
      try {
        group.setPointerCapture(event.pointerId);
      } catch {
        // The pointer is no longer active (e.g. released already); without capture the drag
        // simply follows it while it stays over the shape.
      }
      group.dataset.dragging = '';
      selectTarget(key);
      group.focus({ preventScroll: true });
    });

    group.addEventListener('pointermove', (event) => {
      if (!drag || drag.key !== key || event.pointerId !== drag.pointerId) return;
      const point = toWorld(event);
      if (!point) return;
      update({ ...scene, [key]: placeShape(scene[key], add(point, drag.offset)) });
    });

    const endDrag = (event: PointerEvent) => {
      if (!drag || drag.key !== key || event.pointerId !== drag.pointerId) return;
      drag = null;
      delete group.dataset.dragging;
    };
    group.addEventListener('pointerup', endDrag);
    group.addEventListener('pointercancel', endDrag);
    group.addEventListener('lostpointercapture', endDrag);

    // ---------------------------------------------------------------- keyboard

    group.addEventListener('focus', () => selectTarget(key));

    group.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const step = event.shiftKey ? MOVE_STEP * LARGE_STEP_FACTOR : MOVE_STEP;
      const turn = event.shiftKey ? LARGE_ROTATE_STEP : ROTATE_STEP;
      const moves: Record<string, Vec> = {
        ArrowLeft: vec(-step, 0),
        ArrowRight: vec(step, 0),
        ArrowUp: vec(0, -step),
        ArrowDown: vec(0, step),
      };
      const delta = moves[event.key];
      const lower = event.key.toLowerCase();
      if (delta) {
        update({ ...scene, [key]: moveShape(scene[key], delta) });
      } else if ((lower === 'q' || lower === 'e') && rotatable) {
        update({ ...scene, [key]: rotateShape(scene[key], lower === 'q' ? -turn : turn) });
      } else {
        return;
      }
      event.preventDefault();
      selectTarget(key);
    });
  }

  // ---------------------------------------------------------------- controls

  for (const input of targetInputs) {
    input.addEventListener('change', () => {
      if (input.checked && (input.value === 'a' || input.value === 'b')) target = input.value;
    });
  }

  for (const button of rotateButtons) {
    button.addEventListener('click', () => {
      const direction = Number(button.dataset.rotate) < 0 ? -1 : 1;
      update({ ...scene, [target]: rotateShape(scene[target], direction * ROTATE_STEP) });
    });
  }

  for (const input of polygonInputs) {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      pinned = null;
      update({ ...scene, b: withPolygon(scene.b, currentPolygon()) });
    });
  }

  axisList?.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('[data-axis-row]');
    if (!button) return;
    const index = Number(button.dataset.axisRow);
    pinned = pinned === index ? null : index;
    schedule();
  });

  reset.addEventListener('click', () => {
    pinned = null;
    update(initialScene(kind, currentPolygon()));
  });

  // ---------------------------------------------------------------- scale

  /** Reads the drawing's width; true when the scale changed (and the figure must be redrawn). */
  function measure(): boolean {
    const width = svg.getBoundingClientRect().width;
    if (width <= 0) return false;
    const next = WORLD.width / width;
    if (Math.abs(next - k) < 0.005) return false;
    k = next;
    svg.style.setProperty('--k', k.toFixed(3));
    return true;
  }

  const remeasure = () => {
    if (measure()) schedule();
  };
  if (typeof ResizeObserver === 'function') new ResizeObserver(remeasure).observe(svg);
  else addEventListener('resize', remeasure);
  measure();
  render();
}
