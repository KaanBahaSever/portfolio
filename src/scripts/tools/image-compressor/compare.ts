/**
 * The before/after comparison (browser only): a split view whose divider follows a range
 * input or a drag on the image, and side-by-side panels; both at "Fit" or 1:1 (one output
 * pixel per CSS pixel, scrollable, with the two sides kept in step).
 *
 * Layout is CSS-driven: the controller sets --w/--h (output size) and the element sizes come
 * from aspect-ratio. This module only positions the divider and the clip of the two images,
 * which depend on what part of the image is visible.
 */

export type CompareView = 'split' | 'side';
export type CompareZoom = 'fit' | 'actual';

export interface CompareImages {
  beforeUrl: string;
  beforeAlt: string;
  /** Null while the first compressed version is being made. */
  afterUrl: string | null;
  afterAlt: string;
}

export interface CompareController {
  setImages(images: CompareImages): void;
  /** Output size in pixels: sets the aspect ratio and the 1:1 size. */
  setSize(width: number, height: number): void;
  setBusy(busy: boolean): void;
  setCaptions(before: string, after: string): void;
  /** Called by the controller when the workspace becomes visible. */
  refresh(): void;
  clear(): void;
}

interface Options {
  /** aria-valuetext of the divider input for a split fraction (0 = all compressed). */
  dividerText(split: number): string;
}

/** Wide screens start with side-by-side panels; narrow ones only have the split view. */
const SIDE_BY_SIDE_QUERY = '(min-width: 48rem)';
const DEFAULT_SIDE_QUERY = '(min-width: 64rem)';
/** Movement before a touch drag counts as moving the divider rather than a tap. */
const TOUCH_SLOP_PX = 6;

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Image compressor: missing element ${selector}`);
  return element;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function initCompare(root: HTMLElement, options: Options): CompareController {
  const el = {
    stage: query<HTMLElement>(root, '[data-stage]'),
    viewport: query<HTMLElement>(root, '[data-viewport]'),
    canvas: query<HTMLElement>(root, '[data-canvas]'),
    before: query<HTMLImageElement>(root, '[data-before]'),
    after: query<HTMLImageElement>(root, '[data-after]'),
    divider: query<HTMLElement>(root, '[data-divider]'),
    handle: query<HTMLElement>(root, '[data-handle]'),
    labelBefore: query<HTMLElement>(root, '[data-label-before]'),
    labelAfter: query<HTMLElement>(root, '[data-label-after]'),
    dividerInput: query<HTMLInputElement>(root, '[data-divider-input]'),
    split: query<HTMLElement>(root, '[data-split-view]'),
    side: query<HTMLElement>(root, '[data-side-view]'),
    sideViewports: Array.from(root.querySelectorAll<HTMLElement>('[data-side-viewport]')),
    sideBefore: query<HTMLImageElement>(root, '[data-side-before]'),
    sideAfter: query<HTMLImageElement>(root, '[data-side-after]'),
    viewInputs: Array.from(root.querySelectorAll<HTMLInputElement>('input[data-view]')),
    zoomInputs: Array.from(root.querySelectorAll<HTMLInputElement>('input[data-zoom]')),
    busy: Array.from(root.querySelectorAll<HTMLElement>('[data-busy]')),
    captionBefore: query<HTMLElement>(root, '[data-caption-before]'),
    captionAfter: query<HTMLElement>(root, '[data-caption-after]'),
  };

  const sideQuery = window.matchMedia(SIDE_BY_SIDE_QUERY);
  let chosenView: CompareView = window.matchMedia(DEFAULT_SIDE_QUERY).matches ? 'side' : 'split';
  let zoom: CompareZoom = 'fit';
  let split = 0.5;
  let frame = 0;

  // ------------------------------------------------------------------ view and zoom

  function effectiveView(): CompareView {
    return sideQuery.matches ? chosenView : 'split';
  }

  function applyView(): void {
    const view = effectiveView();
    root.dataset.view = view;
    root.dataset.zoom = zoom;
    el.split.hidden = view !== 'split';
    el.side.hidden = view !== 'side';
    for (const input of el.viewInputs) input.checked = input.value === chosenView;
    for (const input of el.zoomInputs) input.checked = input.value === zoom;
    // Touch: in Fit, horizontal drags move the divider and vertical ones still scroll the
    // page; at 1:1 the image area scrolls natively (the handle keeps touch-action: none).
    el.stage.style.touchAction = zoom === 'fit' ? 'pan-y' : 'auto';
    schedule();
  }

  function centerScroll(viewport: HTMLElement): void {
    viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
    viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2;
  }

  for (const input of el.viewInputs) {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      chosenView = input.value === 'side' ? 'side' : 'split';
      applyView();
    });
  }

  for (const input of el.zoomInputs) {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      zoom = input.value === 'actual' ? 'actual' : 'fit';
      applyView();
      if (zoom === 'actual') {
        // Start at the centre of the image, where the eye goes first.
        centerScroll(el.viewport);
        for (const viewport of el.sideViewports) centerScroll(viewport);
      }
    });
  }

  sideQuery.addEventListener('change', applyView);

  // ------------------------------------------------------------------ divider

  /** The horizontal span of the image that is visible in the viewport (client coordinates). */
  function visibleSpan(): { left: number; right: number; top: number; bottom: number } {
    const canvas = el.canvas.getBoundingClientRect();
    const viewport = el.viewport.getBoundingClientRect();
    return {
      left: Math.max(canvas.left, viewport.left),
      right: Math.min(canvas.right, viewport.right),
      top: Math.max(canvas.top, viewport.top),
      bottom: Math.min(canvas.bottom, viewport.bottom),
    };
  }

  function layout(): void {
    frame = 0;
    if (el.split.hidden) return;
    const stage = el.stage.getBoundingClientRect();
    const canvas = el.canvas.getBoundingClientRect();
    const span = visibleSpan();
    const x = span.left + split * Math.max(0, span.right - span.left);
    const cut = x - canvas.left;
    // Clip both layers so they never overlap: a semi-transparent pixel would otherwise be
    // composited twice and look more opaque than it is.
    el.before.style.clipPath = `inset(0 ${Math.max(0, canvas.width - cut)}px 0 0)`;
    el.after.style.clipPath = `inset(0 0 0 ${Math.max(0, cut)}px)`;
    el.divider.style.transform = `translateX(${x - stage.left}px)`;
    el.divider.style.top = `${Math.max(0, span.top - stage.top)}px`;
    el.divider.style.height = `${Math.max(0, span.bottom - span.top)}px`;
    // Corner labels step aside when the divider reaches them.
    el.labelBefore.style.opacity = split < 0.18 ? '0' : '';
    el.labelAfter.style.opacity = split > 0.82 ? '0' : '';
  }

  function schedule(): void {
    if (!frame) frame = window.requestAnimationFrame(layout);
  }

  function setSplit(value: number, fromInput = false): void {
    split = clamp01(value);
    const percent = Math.round(split * 100);
    if (!fromInput) el.dividerInput.value = String(percent);
    el.dividerInput.setAttribute('aria-valuetext', options.dividerText(split));
    schedule();
  }

  el.dividerInput.addEventListener('input', () => setSplit(Number(el.dividerInput.value) / 100, true));
  // The handle on the image mirrors the input's keyboard focus.
  el.dividerInput.addEventListener('focus', () => (el.divider.dataset.focused = 'true'));
  el.dividerInput.addEventListener('blur', () => delete el.divider.dataset.focused);

  function splitAt(clientX: number): number {
    const span = visibleSpan();
    const width = span.right - span.left;
    return width > 0 ? (clientX - span.left) / width : split;
  }

  // ------------------------------------------------------------------ pointer: divider and pan

  type Gesture =
    | { kind: 'divider'; pointerId: number }
    | { kind: 'pending'; pointerId: number; startX: number; startY: number }
    | { kind: 'pan'; pointerId: number; startX: number; startY: number; scrollLeft: number; scrollTop: number; targets: HTMLElement[] };

  let gesture: Gesture | null = null;

  /** Keeps receiving moves outside the element; a pointer released in the meantime throws. */
  function capture(element: HTMLElement, pointerId: number): void {
    try {
      element.setPointerCapture(pointerId);
    } catch {
      // The gesture still works while the pointer stays over the element.
    }
  }

  function startDivider(event: PointerEvent): void {
    gesture = { kind: 'divider', pointerId: event.pointerId };
    capture(el.stage, event.pointerId);
    el.divider.dataset.dragging = 'true';
    setSplit(splitAt(event.clientX));
  }

  function startPan(event: PointerEvent, target: HTMLElement, targets: HTMLElement[]): void {
    const first = targets[0]!;
    gesture = {
      kind: 'pan',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: first.scrollLeft,
      scrollTop: first.scrollTop,
      targets,
    };
    capture(target, event.pointerId);
    target.dataset.panning = 'true';
  }

  function endGesture(event: PointerEvent, target: HTMLElement): void {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    // A touch that never moved is a tap: the divider jumps there.
    if (gesture.kind === 'pending' && event.type === 'pointerup') setSplit(splitAt(event.clientX));
    gesture = null;
    delete el.divider.dataset.dragging;
    delete target.dataset.panning;
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
  }

  el.stage.addEventListener('pointerdown', (event) => {
    if (gesture || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (el.handle.contains(event.target as Node)) {
      event.preventDefault();
      startDivider(event);
    } else if (zoom === 'fit') {
      if (event.pointerType === 'mouse') {
        event.preventDefault();
        startDivider(event);
      } else {
        gesture = { kind: 'pending', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
      }
    } else if (event.pointerType === 'mouse') {
      // 1:1 with a mouse: drag to pan (touch scrolls natively).
      event.preventDefault();
      startPan(event, el.stage, [el.viewport]);
    }
  });

  el.stage.addEventListener('pointermove', (event) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.kind === 'pending') {
      if (Math.abs(event.clientX - gesture.startX) < TOUCH_SLOP_PX) return;
      startDivider(event);
    } else if (gesture.kind === 'divider') {
      setSplit(splitAt(event.clientX));
    } else {
      for (const target of gesture.targets) {
        target.scrollLeft = gesture.scrollLeft - (event.clientX - gesture.startX);
        target.scrollTop = gesture.scrollTop - (event.clientY - gesture.startY);
      }
    }
  });

  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    el.stage.addEventListener(type, (event) => endGesture(event, el.stage));
  }

  // Side by side: mouse drag pans both panels together; scrolling one scrolls the other.
  for (const viewport of el.sideViewports) {
    viewport.addEventListener('pointerdown', (event) => {
      if (gesture || zoom !== 'actual' || event.pointerType !== 'mouse' || event.button !== 0) return;
      event.preventDefault();
      startPan(event, viewport, el.sideViewports);
    });
    viewport.addEventListener('pointermove', (event) => {
      if (gesture?.kind !== 'pan' || gesture.pointerId !== event.pointerId) return;
      for (const target of gesture.targets) {
        target.scrollLeft = gesture.scrollLeft - (event.clientX - gesture.startX);
        target.scrollTop = gesture.scrollTop - (event.clientY - gesture.startY);
      }
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      viewport.addEventListener(type, (event) => endGesture(event, viewport));
    }
    viewport.addEventListener(
      'scroll',
      () => {
        for (const other of el.sideViewports) {
          if (other === viewport) continue;
          // Equal values end the ping-pong between the two scroll handlers.
          if (other.scrollLeft !== viewport.scrollLeft) other.scrollLeft = viewport.scrollLeft;
          if (other.scrollTop !== viewport.scrollTop) other.scrollTop = viewport.scrollTop;
        }
      },
      { passive: true },
    );
  }

  // Positions are relative to the stage, so page scrolling changes nothing; only the image's
  // own scrolling (1:1) and size changes move the divider.
  el.viewport.addEventListener('scroll', schedule, { passive: true });
  new ResizeObserver(schedule).observe(el.stage);

  // Dragging an <img> would start the browser's own image drag and cancel ours.
  for (const image of [el.before, el.after, el.sideBefore, el.sideAfter]) {
    image.draggable = false;
    image.addEventListener('dragstart', (event) => event.preventDefault());
  }

  // ------------------------------------------------------------------ public API

  function setImage(image: HTMLImageElement, url: string | null, alt: string): void {
    if (url) {
      if (image.getAttribute('src') !== url) image.src = url;
      image.alt = alt;
      image.hidden = false;
    } else {
      image.removeAttribute('src');
      image.alt = '';
      image.hidden = true;
    }
  }

  setSplit(split);
  applyView();

  return {
    setImages(images) {
      setImage(el.before, images.beforeUrl, images.beforeAlt);
      setImage(el.sideBefore, images.beforeUrl, images.beforeAlt);
      setImage(el.after, images.afterUrl, images.afterAlt);
      setImage(el.sideAfter, images.afterUrl, images.afterAlt);
      schedule();
    },
    setSize(width, height) {
      root.style.setProperty('--w', String(width));
      root.style.setProperty('--h', String(height));
      schedule();
    },
    setBusy(busy) {
      root.setAttribute('aria-busy', String(busy));
      for (const chip of el.busy) chip.hidden = !busy;
    },
    setCaptions(before, after) {
      el.captionBefore.textContent = before;
      el.captionAfter.textContent = after;
    },
    refresh() {
      applyView();
    },
    clear() {
      for (const image of [el.before, el.after, el.sideBefore, el.sideAfter]) setImage(image, null, '');
      el.captionBefore.textContent = '';
      el.captionAfter.textContent = '';
      zoom = 'fit';
      setSplit(0.5);
      applyView();
    },
  };
}
