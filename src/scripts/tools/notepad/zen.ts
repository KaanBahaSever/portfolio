/**
 * Zen mode for the notepad (browser only).
 *
 * The tool covers the viewport as a CSS overlay ([data-zen] on the root, styled in
 * Notepad.astro), which works everywhere, including iPhone Safari and embedded frames. Where
 * the Fullscreen API is allowed the root also goes full screen. Meanwhile the rest of the page
 * is inert and can't scroll, focus stays in the tool, and on the way out it returns to where it
 * came from: the Zen mode button, or the text when zen mode was entered from there.
 */

export interface ZenModeOptions {
  root: HTMLElement;
  /** The tool's window; it replays a short settle animation after zen mode. */
  card: HTMLElement;
  editor: HTMLTextAreaElement;
  toggle: HTMLElement;
  exit: HTMLElement;
  /** On touch screens focusing the text would open the keyboard. */
  coarsePointer: boolean;
  /** After entering or leaving, once the layout has changed. */
  onChange: (on: boolean) => void;
  /**
   * The browser left full screen by itself (its own Esc, F11 or a system gesture). Return true
   * when that Esc went to something inside zen mode instead (the find panel closed), so zen
   * mode stays, as the overlay.
   */
  onFullscreenExit: () => boolean;
}

export interface ZenMode {
  readonly active: boolean;
  set(on: boolean): void;
}

export function createZenMode(options: ZenModeOptions): ZenMode {
  const { root, card, editor, toggle, exit, coarsePointer } = options;
  let active = false;
  /** Zen mode made the root full screen through the Fullscreen API. */
  let fullscreen = false;
  let returnFocus: HTMLElement | null = null;
  let pageScroll = 0;
  const inertElements: HTMLElement[] = [];

  /** Makes everything outside the tool inert: the siblings of each ancestor up to <body>. */
  function setBackgroundInert(on: boolean): void {
    if (!on) {
      for (const element of inertElements.splice(0)) element.inert = false;
      return;
    }
    for (let node: Element = root; node.parentElement && node !== document.body; node = node.parentElement) {
      for (const sibling of Array.from(node.parentElement.children)) {
        if (sibling === node || !(sibling instanceof HTMLElement) || sibling.inert) continue;
        if (sibling instanceof HTMLScriptElement || sibling instanceof HTMLStyleElement) continue;
        sibling.inert = true;
        inertElements.push(sibling);
      }
    }
  }

  function scrollRatio(): number {
    const range = editor.scrollHeight - editor.clientHeight;
    return range > 0 ? editor.scrollTop / range : 0;
  }

  function requestFullscreen(): void {
    if (!document.fullscreenEnabled || document.fullscreenElement || typeof root.requestFullscreen !== 'function') return;
    root
      .requestFullscreen({ navigationUI: 'hide' })
      .then(() => {
        // Zen mode ended before the browser finished switching.
        if (!active) {
          document.exitFullscreen().catch(() => {});
          return;
        }
        fullscreen = true;
      })
      .catch(() => {
        // Refused (a frame without permission, a browser setting): the overlay alone is zen mode.
      });
  }

  function set(on: boolean, { fromFullscreenExit = false } = {}): void {
    if (on === active) return;
    const editorFocused = document.activeElement === editor;
    const ratio = scrollRatio();
    active = on;

    if (on) {
      returnFocus = editorFocused ? editor : toggle;
      pageScroll = window.scrollY;
      root.dataset.zen = '';
      document.documentElement.dataset.npZen = '';
      setBackgroundInert(true);
      // Must run inside the click or key press that asked for zen mode (a user gesture).
      requestFullscreen();
      if (editorFocused || !coarsePointer) editor.focus({ preventScroll: true });
      else exit.focus({ preventScroll: true });
    } else {
      delete root.dataset.zen;
      delete document.documentElement.dataset.npZen;
      setBackgroundInert(false);
      const wasFullscreen = fullscreen;
      fullscreen = false;
      if (!fromFullscreenExit && (wasFullscreen || document.fullscreenElement === root)) {
        document.exitFullscreen().catch(() => {});
      }
      window.scrollTo({ top: pageScroll, behavior: 'instant' });
      const target = returnFocus?.isConnected ? returnFocus : toggle;
      returnFocus = null;
      target.focus({ preventScroll: true });
      // Settle back into the page (opacity and transform only).
      card.classList.remove('np-settle');
      void card.offsetWidth;
      card.classList.add('np-settle');
    }

    // The text column changed width: keep roughly the same part of the text in view.
    const range = editor.scrollHeight - editor.clientHeight;
    if (range > 0) editor.scrollTop = Math.round(ratio * range);
    options.onChange(on);
  }

  toggle.addEventListener('click', () => set(true));
  exit.addEventListener('click', () => set(false));
  card.addEventListener('animationend', () => card.classList.remove('np-settle'));

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === root || !fullscreen) return;
    fullscreen = false;
    if (!active) return;
    // The browser's own Esc may never reach the page. Keep the Esc order anyway: an open find
    // panel closes first and zen mode stays (as the overlay, where the next Esc reaches the
    // page); otherwise zen mode ends too.
    if (!options.onFullscreenExit()) set(false, { fromFullscreenExit: true });
  });

  return {
    get active() {
      return active;
    },
    set: (on) => set(on),
  };
}
