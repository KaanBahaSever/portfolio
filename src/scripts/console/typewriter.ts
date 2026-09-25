/**
 * Simulated typing for command output, done so that assistive technology never sees it.
 *
 * The transcript is an aria-live log, and text that grows a few characters per frame would be
 * announced as a stream of fragments. So the real output element is built complete but kept out
 * of the document; a copy of it is "typed" into a separate layer that is inert and aria-hidden
 * and sits where the output will appear. When typing ends (or any key or tap skips it), the copy
 * is removed and the real element is appended to the log in the same frame: the screen does not
 * change, and screen readers hear the whole output once, with working links.
 *
 * Progress follows the clock, not the frame count, and a timer finishes the output even if the
 * browser stops delivering animation frames (a throttled or background tab), so output can never
 * get stuck half-typed.
 */

/** Typing speed for short outputs, in characters per millisecond (180 per second). */
const CHARS_PER_MS = 0.18;
/** Longer outputs speed up so that none takes more than this. */
const MAX_DURATION_MS = 500;
/** Grace period after the planned end before the safety timer completes the output. */
const SAFETY_MARGIN_MS = 250;

interface Chunk {
  node: Text;
  text: string;
}

export class Typewriter {
  private readonly layer: HTMLElement;
  private readonly onFrame: () => void;
  private readonly onBusyChange: (busy: boolean) => void;
  private chunks: Chunk[] = [];
  private total = 0;
  private shown = 0;
  private startedAt = 0;
  private duration = 0;
  private frame = 0;
  private safety = 0;
  private commit: (() => void) | null = null;

  constructor(layer: HTMLElement, options: { onFrame: () => void; onBusyChange: (busy: boolean) => void }) {
    this.layer = layer;
    this.onFrame = options.onFrame;
    this.onBusyChange = options.onBusyChange;
  }

  get busy(): boolean {
    return this.commit !== null;
  }

  /** Types a copy of `output`, then calls `commit` (which should append the real element). */
  play(output: HTMLElement, commit: () => void): void {
    this.finish();

    const ghost = output.cloneNode(true) as HTMLElement;
    const chunks: Chunk[] = [];
    // Visually hidden text (e.g. "opens in a new tab") takes no screen space; typing it would only add a pause.
    const walker = document.createTreeWalker(ghost, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        node.parentElement?.closest('.sr-only') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    let total = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node as Text;
      if (text.data === '') continue;
      chunks.push({ node: text, text: text.data });
      total += text.data.length;
      text.data = '';
    }
    if (total === 0) {
      commit();
      return;
    }

    this.chunks = chunks;
    this.total = total;
    this.shown = 0;
    this.startedAt = performance.now();
    this.duration = Math.min(total / CHARS_PER_MS, MAX_DURATION_MS);
    this.commit = commit;
    this.layer.replaceChildren(ghost);
    this.onBusyChange(true);
    this.frame = requestAnimationFrame(this.tick);
    this.safety = window.setTimeout(() => this.finish(), this.duration + SAFETY_MARGIN_MS);
  }

  /** Shows the whole output at once (any key or tap). Does nothing when idle. */
  finish(): void {
    const commit = this.commit;
    if (!commit) return;
    this.stop();
    commit();
  }

  /** Drops the output being typed without committing it (clear screen). */
  cancel(): void {
    if (this.commit) this.stop();
  }

  private stop(): void {
    cancelAnimationFrame(this.frame);
    window.clearTimeout(this.safety);
    this.layer.replaceChildren();
    this.chunks = [];
    this.commit = null;
    this.onBusyChange(false);
  }

  /** Reveals text up to where the clock says typing should be. */
  private readonly tick = (now: number): void => {
    const progress = Math.min(1, Math.max(0, now - this.startedAt) / this.duration);
    const target = Math.ceil(this.total * progress);
    let remaining = target;
    for (const chunk of this.chunks) {
      if (remaining <= 0) break;
      const length = Math.min(remaining, chunk.text.length);
      if (chunk.node.data.length !== length) chunk.node.data = chunk.text.slice(0, length);
      remaining -= length;
    }
    this.shown = target;
    this.onFrame();
    if (this.shown >= this.total) this.finish();
    else this.frame = requestAnimationFrame(this.tick);
  };
}
