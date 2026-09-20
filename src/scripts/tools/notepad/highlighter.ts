/**
 * Match highlights for a plain <textarea> (browser only).
 *
 * A textarea cannot style parts of its text, so a "mirror" element behind it repeats the
 * text with <mark> elements around the matches. The mirror uses the same font, padding,
 * border and wrapping as the textarea and follows its scroll position; its own text is
 * transparent, and the textarea (with a transparent background) draws the visible text.
 */

import type { TextMatch } from '../../../lib/text/search.ts';

export interface MatchBox {
  /** Offsets inside the textarea's scrollable content (0 = top of the padding box). */
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Highlighter {
  /** True while the mirror holds text (a search with results is being shown). */
  readonly active: boolean;
  /** Draws `matches` (sorted, from `text`) with `current` emphasised (-1 for none). */
  render(text: string, matches: readonly TextMatch[], current: number): void;
  clear(): void;
  setCurrent(index: number): void;
  /** Replace mode draws every match struck through. */
  setReplaceMode(on: boolean): void;
  /** Re-measures scrollbar compensation and follows the textarea's scroll position. */
  sync(): void;
  syncScroll(): void;
  /** Where a drawn match is, or null (not drawn, or nothing rendered). */
  matchBox(index: number): MatchBox | null;
  /** The element drawn for a match (a zero-size span for zero-length matches). */
  anchor(index: number): HTMLElement | null;
}

export interface HighlighterElements {
  textarea: HTMLTextAreaElement;
  mirror: HTMLElement;
  markTemplate: HTMLTemplateElement;
}

/**
 * WebKit on iOS adds 3px of padding inside a textarea on the left and right that no CSS
 * can remove; the mirror needs the same inset.
 */
function textareaInnerInset(): number {
  const platform = navigator.platform ?? '';
  const iOS = /iPhone|iPad|iPod/.test(platform) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return iOS ? 3 : 0;
}

const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);

export function createHighlighter({ textarea, mirror, markTemplate }: HighlighterElements): Highlighter {
  const markPrototype = markTemplate.content.firstElementChild;
  if (!(markPrototype instanceof HTMLElement)) throw new Error('Notepad: mark template is empty');

  const innerInset = textareaInnerInset();
  let anchors: Array<HTMLElement | null> = [];
  let currentAnchor: HTMLElement | null = null;
  let active = false;
  let appliedLeft = '';
  let appliedRight = '';

  function measure(): void {
    const style = getComputedStyle(textarea);
    const borderLeft = parseFloat(style.borderLeftWidth) || 0;
    const borderRight = parseFloat(style.borderRightWidth) || 0;
    // A classic (non-overlay) vertical scrollbar narrows the textarea's text area.
    const scrollbar = Math.max(0, textarea.offsetWidth - textarea.clientWidth - borderLeft - borderRight);
    // The mirror's border is transparent, so widening it shifts and narrows its text
    // without touching the padding set by the shared utility classes.
    const left = `${borderLeft + innerInset}px`;
    const right = `${borderRight + innerInset + scrollbar}px`;
    if (left !== appliedLeft) {
      mirror.style.borderLeftWidth = left;
      appliedLeft = left;
    }
    if (right !== appliedRight) {
      mirror.style.borderRightWidth = right;
      appliedRight = right;
    }
  }

  function syncScroll(): void {
    if (!active) return;
    mirror.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;
  }

  function setCurrent(index: number): void {
    if (currentAnchor) delete currentAnchor.dataset.current;
    currentAnchor = null;
    const anchor = anchors[index];
    // Zero-length matches are counted but not drawn.
    if (anchor && anchor.tagName === 'MARK') {
      anchor.dataset.current = '';
      currentAnchor = anchor;
    }
  }

  function clear(): void {
    if (!active && anchors.length === 0) return;
    mirror.replaceChildren();
    mirror.style.transform = '';
    anchors = [];
    currentAnchor = null;
    active = false;
  }

  function render(text: string, matches: readonly TextMatch[], current: number): void {
    if (text === '' || matches.length === 0) {
      clear();
      return;
    }
    measure();

    const fragment = document.createDocumentFragment();
    const nextAnchors: Array<HTMLElement | null> = new Array(matches.length);
    let last = 0;
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i]!;
      if (match.start < last) {
        nextAnchors[i] = null; // never happens for matches from one search; stay safe
        continue;
      }
      if (match.start > last) fragment.append(text.slice(last, match.start));
      let anchor: HTMLElement;
      if (match.end > match.start) {
        anchor = markPrototype!.cloneNode(false) as HTMLElement;
        anchor.textContent = text.slice(match.start, match.end);
      } else {
        anchor = document.createElement('span');
      }
      fragment.append(anchor);
      nextAnchors[i] = anchor;
      last = match.end;
    }
    // Text after the line of the last match can't move any mark: leave it out, so the mirror
    // doesn't copy the rest of a long document on every redraw.
    const lineEnd = text.indexOf('\n', last);
    let tail = lineEnd === -1 ? text.slice(last) : text.slice(last, lineEnd);
    // A trailing line break starts an empty last line in a textarea but not in a div.
    if (lineEnd === -1 && (text.endsWith('\n') || text.endsWith('\r'))) tail += ZERO_WIDTH_SPACE;
    if (tail) fragment.append(tail);

    mirror.replaceChildren(fragment);
    anchors = nextAnchors;
    currentAnchor = null;
    active = true;
    setCurrent(current);
    syncScroll();
  }

  function matchBox(index: number): MatchBox | null {
    const anchor = anchors[index];
    if (!active || !anchor) return null;
    // Offsets are measured from the mirror's padding edge (it is position: relative) and
    // ignore its transform, which matches the textarea's scroll coordinates.
    return {
      top: anchor.offsetTop,
      left: anchor.offsetLeft + innerInset,
      width: anchor.offsetWidth,
      height: anchor.offsetHeight,
    };
  }

  return {
    get active() {
      return active;
    },
    render,
    clear,
    setCurrent,
    setReplaceMode(on) {
      if (on) mirror.dataset.replace = '';
      else delete mirror.dataset.replace;
    },
    sync() {
      measure();
      syncScroll();
    },
    syncScroll,
    matchBox,
    anchor: (index) => anchors[index] ?? null,
  };
}
