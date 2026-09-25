/**
 * The page grid of the Split PDF tool (browser only): one tile per page with a lazily
 * rendered thumbnail, selection toggles, and keyboard support.
 *
 * The grid owns no selection. It reports what the person did (onPick, onSelectAll) and the
 * controller, which keeps the page field as the single source of truth, answers with
 * setView(). That keeps typing and clicking in sync in both directions.
 *
 * Accessibility: tiles are toggle buttons (aria-pressed) in one tab stop with a roving
 * tabindex: arrow keys move, Home/End jump, Space/Enter toggle, Shift adds a range, Ctrl/⌘+A
 * selects all. In modes without a selection the tiles are read-only (aria-disabled) and only
 * show which output file each page goes into.
 */

import type { PdfSplitMessages } from '../../../i18n/tools/pdf-split.ts';
import { gridTarget, pagesBetween } from './grid-math.ts';
import type { ThumbnailService } from './thumbnails.ts';

export interface GridView {
  /** Toggle tiles (Extract pages, Split by ranges) or read-only tiles (the other modes). */
  interactive: boolean;
  /** Per page (index 0 is page 1): how many times the outputs use it. */
  uses: Uint32Array;
  /** Per page: 1-based number of its output file (0: none); null hides file labels. */
  files: Uint32Array | null;
}

export interface PageGridOptions {
  list: HTMLOListElement;
  template: HTMLTemplateElement;
  messages: PdfSplitMessages;
  /** The person asked to select (or deselect) these pages. */
  onPick(pages: number[], select: boolean): void;
  onSelectAll(): void;
}

export interface PageGrid {
  /** Creates one placeholder tile per page; `aspect` (width / height) shapes every sheet. */
  build(pageCount: number, aspect: number): void;
  /** Removes all tiles and stops previews (thumbnail URLs are revoked by the service). */
  clear(): void;
  setView(view: GridView): void;
  /** Starts lazy thumbnails: tiles near the viewport are requested from `service`. */
  showPreviews(service: ThumbnailService): void;
  /** Stops asking for thumbnails (already shown ones stay). */
  stopPreviews(): void;
  /** Shows a page's thumbnail (`width` × `height` pixels) at its own shape inside the tile. */
  setThumbnail(page: number, url: string, width: number, height: number): void;
  /** One page could not be rendered: its tile says "Preview unavailable". */
  setPageUnavailable(page: number): void;
  /**
   * The preview engine can't show this document at all (it failed to open it, or counts a
   * different number of pages): stops previews and labels every tile without a thumbnail.
   */
  setAllUnavailable(): void;
  readonly pageCount: number;
}

interface Tile {
  button: HTMLButtonElement;
  sheet: HTMLElement;
  placeholder: HTMLElement;
  img: HTMLImageElement;
  unavailable: HTMLElement;
  label: HTMLElement;
  /** Last state written to the DOM, so setView only touches tiles that changed. */
  uses: number;
  file: number;
  interactive: boolean | null;
  done: boolean;
}

function part<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Split PDF: tile template is missing ${selector}`);
  return element;
}

export function createPageGrid({ list, template, messages: m, onPick, onSelectAll }: PageGridOptions): PageGrid {
  let tiles: Tile[] = [];
  let view: GridView | null = null;
  let focusIndex = 0;
  /** Page of the last plain toggle: Shift+click selects from here. */
  let anchor: number | null = null;
  /** Shift was held when Space/Enter was pressed on a tile: not every browser copies it onto the click that follows. */
  let keyboardShift = false;
  let observer: IntersectionObserver | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let service: ThumbnailService | null = null;
  /** Width / height of every tile's box (page 1's shape, see sheetAspect). */
  let sheetRatio = 1 / Math.SQRT2;

  function pageOf(target: EventTarget | null): number | null {
    const button = (target as Element | null)?.closest?.<HTMLElement>('[data-tile]');
    if (!button || !list.contains(button)) return null;
    const page = Number(button.dataset.page);
    return Number.isInteger(page) && page >= 1 && page <= tiles.length ? page : null;
  }

  function isSelected(page: number): boolean {
    return (view?.uses[page - 1] ?? 0) > 0;
  }

  function setFocusIndex(index: number, moveFocus: boolean): void {
    const previous = tiles[focusIndex];
    const next = tiles[index];
    if (!next) return;
    if (previous && previous !== next) previous.button.tabIndex = -1;
    next.button.tabIndex = 0;
    focusIndex = index;
    if (moveFocus) next.button.focus();
  }

  /** Columns in the current layout (the grid's resolved track list). */
  function columns(): number {
    const tracks = getComputedStyle(list).gridTemplateColumns.split(' ').filter(Boolean).length;
    return Math.max(1, tracks);
  }

  function activate(page: number, range: boolean): void {
    if (!view?.interactive) return;
    const select = !isSelected(page);
    if (range && anchor !== null && anchor !== page && anchor <= tiles.length) {
      onPick(pagesBetween(anchor, page), select);
    } else {
      onPick([page], select);
    }
    anchor = page;
  }

  list.addEventListener('click', (event) => {
    const page = pageOf(event.target);
    if (page === null) return;
    setFocusIndex(page - 1, false);
    const range = event.shiftKey || keyboardShift;
    keyboardShift = false;
    activate(page, range);
  });

  list.addEventListener('keydown', (event) => {
    const page = pageOf(event.target);
    if (page === null) return;
    if (event.key === ' ' || event.key === 'Enter') {
      // A held Enter would toggle the page on and off repeatedly.
      if (event.repeat) {
        event.preventDefault();
        return;
      }
      // The button's own click follows (keyup for Space, keydown for Enter); remember Shift for it.
      keyboardShift = event.shiftKey;
      return;
    }
    if ((event.key === 'a' || event.key === 'A') && (event.ctrlKey || event.metaKey) && !event.altKey) {
      if (!view?.interactive) return;
      event.preventDefault();
      onSelectAll();
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = gridTarget(event.key, page - 1, tiles.length, columns());
    if (target === null) return;
    event.preventDefault(); // arrow keys would scroll the page
    setFocusIndex(target, true);
  });

  // The click that a key triggers is dispatched before this timer runs; later clicks start clean.
  list.addEventListener('keyup', () => {
    window.setTimeout(() => {
      keyboardShift = false;
    }, 0);
  });
  list.addEventListener('pointerdown', () => {
    keyboardShift = false;
  });

  list.addEventListener('focusin', (event) => {
    const page = pageOf(event.target);
    if (page !== null && page - 1 !== focusIndex) setFocusIndex(page - 1, false);
  });

  function renderTile(tile: Tile, page: number): void {
    if (!view) return;
    const uses = view.uses[page - 1] ?? 0;
    const file = view.files ? (view.files[page - 1] ?? 0) : 0;
    if (tile.uses === uses && tile.file === file && tile.interactive === view.interactive) return;
    tile.uses = uses;
    tile.file = file;
    tile.interactive = view.interactive;

    const { button, label } = tile;
    if (view.interactive) {
      button.setAttribute('aria-pressed', uses > 0 ? 'true' : 'false');
      button.removeAttribute('aria-disabled');
    } else {
      button.removeAttribute('aria-pressed');
      button.setAttribute('aria-disabled', 'true');
    }
    button.setAttribute('aria-label', m.grid.tile(page, file, uses));
    label.textContent = file > 0 ? m.grid.fileTag(file) : uses > 1 ? `×${uses}` : '';
  }

  /**
   * Layout size of the sheets (all share page 1's box). offsetWidth/offsetHeight ignore CSS
   * transforms: a selected sheet is drawn scaled down (and mid-transition in between), which
   * getBoundingClientRect() would report, so thumbnails would render too small and look soft
   * once stretched. Transforms don't trigger the ResizeObserver either, so that would stick.
   */
  function measureBox(): void {
    const sheet = tiles[0]?.sheet;
    if (!sheet || !service) return;
    service.setBox({ width: sheet.offsetWidth, height: sheet.offsetHeight });
  }

  /** The tile keeps its numbered placeholder and says why no thumbnail follows. */
  function markUnavailable(tile: Tile): void {
    tile.done = true;
    observer?.unobserve(tile.button);
    delete tile.placeholder.dataset.loading;
    tile.unavailable.textContent = m.grid.previewUnavailable;
    tile.unavailable.hidden = false;
  }

  function stopPreviews(): void {
    observer?.disconnect();
    observer = null;
    resizeObserver?.disconnect();
    resizeObserver = null;
    service = null;
    for (const tile of tiles) delete tile.placeholder.dataset.loading;
  }

  function clear(): void {
    stopPreviews();
    list.replaceChildren();
    tiles = [];
    focusIndex = 0;
    anchor = null;
  }

  return {
    get pageCount() {
      return tiles.length;
    },

    build(pageCount, aspect) {
      clear();
      const blueprint = template.content.firstElementChild;
      if (!blueprint) throw new Error('Split PDF: empty tile template');
      sheetRatio = aspect;
      list.style.setProperty('--pds-sheet', String(aspect));
      const fragment = document.createDocumentFragment();
      const created: Tile[] = [];
      for (let page = 1; page <= pageCount; page++) {
        const item = blueprint.cloneNode(true) as HTMLElement;
        const button = part<HTMLButtonElement>(item, '[data-tile]');
        button.dataset.page = String(page);
        button.tabIndex = page === 1 ? 0 : -1;
        const placeholder = part<HTMLElement>(item, '[data-tile-placeholder]');
        placeholder.textContent = String(page);
        part<HTMLElement>(item, '[data-tile-number]').textContent = String(page);
        created.push({
          button,
          sheet: part<HTMLElement>(item, '[data-tile-sheet]'),
          placeholder,
          img: part<HTMLImageElement>(item, '[data-tile-img]'),
          unavailable: part<HTMLElement>(item, '[data-tile-unavailable]'),
          label: part<HTMLElement>(item, '[data-tile-label]'),
          uses: -1,
          file: -1,
          interactive: null,
          done: false,
        });
        fragment.append(item);
      }
      tiles = created;
      focusIndex = 0;
      anchor = null;
      list.append(fragment);
      if (view) tiles.forEach((tile, index) => renderTile(tile, index + 1));
    },

    clear,

    setView(next) {
      view = next;
      tiles.forEach((tile, index) => renderTile(tile, index + 1));
    },

    showPreviews(next) {
      stopPreviews();
      service = next;
      measureBox();
      if (typeof ResizeObserver === 'function') {
        resizeObserver = new ResizeObserver(() => measureBox());
        resizeObserver.observe(list);
      }
      if (typeof IntersectionObserver !== 'function') {
        // Very old browsers: render everything in page order.
        tiles.forEach((tile, index) => {
          if (tile.done) return;
          tile.placeholder.dataset.loading = '';
          next.request(index + 1);
        });
        return;
      }
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const page = Number((entry.target as HTMLElement).dataset.page);
            const tile = tiles[page - 1];
            if (!tile || tile.done) continue;
            if (entry.isIntersecting) {
              tile.placeholder.dataset.loading = '';
              next.request(page);
            } else {
              delete tile.placeholder.dataset.loading;
              next.cancel(page);
            }
          }
        },
        // Start a little before tiles scroll into view, so they are usually ready on arrival.
        { rootMargin: '400px 0px' },
      );
      for (const tile of tiles) if (!tile.done) observer.observe(tile.button);
    },

    stopPreviews,

    setThumbnail(page, url, width, height) {
      const tile = tiles[page - 1];
      if (!tile) return;
      tile.done = true;
      observer?.unobserve(tile.button);
      const { img, placeholder } = tile;
      // The box has page 1's shape: a wider page fills its width, a taller one its height, so
      // landscape and rotated pages show as they are (object-fit would hide their outline).
      const wide = width / height >= sheetRatio;
      img.style.aspectRatio = `${width} / ${height}`;
      img.style.width = wide ? '100%' : 'auto';
      img.style.height = wide ? 'auto' : '100%';
      img.addEventListener(
        'load',
        () => {
          img.dataset.loaded = '';
          placeholder.hidden = true;
        },
        { once: true },
      );
      img.src = url;
      img.hidden = false;
      delete placeholder.dataset.loading;
    },

    setPageUnavailable(page) {
      const tile = tiles[page - 1];
      if (tile) markUnavailable(tile);
    },

    setAllUnavailable() {
      stopPreviews();
      for (const tile of tiles) if (!tile.done) markUnavailable(tile);
    },
  };
}
