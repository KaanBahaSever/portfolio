/**
 * Images to PDF: DOM wiring, state and SortableJS (browser only).
 * Everything happens on the device; nothing is uploaded.
 *
 * All text comes from src/i18n/tools/images-to-pdf.ts in the page's language; the import step
 * and the PDF libraries report codes and error types, which are worded here.
 */

import Sortable from 'sortablejs';
import { toPdfFilename } from '../../../lib/files/filename.ts';
import { saveBlob } from '../../../lib/download.ts';
import type { MarginOption, OrientationOption, PageSizeOption } from '../../../lib/pdf/page-layout.ts';
import { getPageLocale } from '../../../i18n/client.ts';
import { LOCALE_META } from '../../../i18n/config.ts';
import { formatters } from '../../../i18n/format.ts';
import { imagesToPdfMessages } from '../../../i18n/tools/images-to-pdf.ts';
import { PdfEngineLoadError, buildPdfInWorker } from './pdf-engine.ts';
import { prepareFallback, prepareImage } from './prepare.ts';
import { importFile } from './thumbnails.ts';
import type { ImageItem, Quality, RejectReason } from './types.ts';

type Phase = 'idle' | 'importing' | 'generating';
type NoticeTone = 'info' | 'warning';

/** Selections above this size (in "Original quality") get a memory warning: phones need a lower limit. */
const LARGE_SELECTION_MB = { touch: 80, other: 150 };
const MAX_LISTED_REJECTIONS = 5;
/** In-app browsers (social apps) that often ignore downloads of generated files. */
const IN_APP_BROWSER = /FBAN|FBAV|Instagram|LinkedInApp|Line\/|Snapchat|musical_ly|BytedanceWebview/i;

const PAGE_SIZES: readonly PageSizeOption[] = ['a4', 'letter', 'fit'];
const ORIENTATIONS: readonly OrientationOption[] = ['auto', 'portrait', 'landscape'];
const MARGINS: readonly MarginOption[] = ['none', 'small', 'large'];
const QUALITIES: readonly Quality[] = ['original', 'compressed'];

/** Error from preparing one specific image, so the message can name the file. */
class ItemError extends Error {
  readonly itemName: string;
  readonly original: unknown;

  constructor(itemName: string, original: unknown) {
    super(original instanceof Error ? original.message : String(original));
    this.name = 'ItemError';
    this.itemName = itemName;
    this.original = original;
  }
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

/**
 * Browsers report exhausted memory in many ways (RangeError, "Array buffer allocation failed",
 * a canvas that cannot be created or encoded, a worker that dies). The texts matched here are
 * the browsers' and this tool's own developer messages (canvas.ts, pdf-engine.ts), never shown.
 */
function looksLikeOutOfMemory(error: unknown): boolean {
  const inner = error instanceof ItemError ? error.original : error;
  if (inner instanceof RangeError) return true;
  const text = inner instanceof Error ? `${inner.name} ${inner.message}` : String(inner);
  return /memory|allocat|too large|array buffer|invalid array length|canvas/i.test(text);
}

function pick<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function hasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return !!types && Array.from(types).includes('Files');
}

let pageDropGuardInstalled = false;

/** Dropping a file outside the tool would navigate away and lose the selection. */
function installPageDropGuard(): void {
  if (pageDropGuardInstalled) return;
  pageDropGuardInstalled = true;
  window.addEventListener('dragover', (event) => {
    if (!hasFiles(event) || event.defaultPrevented) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
  });
  window.addEventListener('drop', (event) => {
    if (hasFiles(event)) event.preventDefault();
  });
}

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Images to PDF: missing element ${selector}`);
  return element;
}

function getElements(root: HTMLElement) {
  return {
    announcer: query<HTMLElement>(root, '[data-announcer]'),
    dropzone: query<HTMLLabelElement>(root, '[data-dropzone]'),
    input: query<HTMLInputElement>(root, '[data-file-input]'),
    dropzoneTitle: query<HTMLElement>(root, '[data-dropzone-title]'),
    importStatus: query<HTMLElement>(root, '[data-import-status]'),
    notices: query<HTMLElement>(root, '[data-notices]'),
    noticeTemplate: query<HTMLTemplateElement>(root, 'template[data-notice-template]'),
    toolbar: query<HTMLElement>(root, '[data-toolbar]'),
    count: query<HTMLElement>(root, '[data-count]'),
    sort: query<HTMLButtonElement>(root, '[data-sort]'),
    reverse: query<HTMLButtonElement>(root, '[data-reverse]'),
    clear: query<HTMLButtonElement>(root, '[data-clear]'),
    gridFrame: query<HTMLElement>(root, '[data-grid-frame]'),
    grid: query<HTMLOListElement>(root, '[data-grid]'),
    cardTemplate: query<HTMLTemplateElement>(root, 'template[data-card-template]'),
    options: query<HTMLFieldSetElement>(root, '[data-options]'),
    marginHint: query<HTMLElement>(root, '[data-margin-hint]'),
    pageSize: query<HTMLSelectElement>(root, '[data-option="pageSize"]'),
    orientation: query<HTMLSelectElement>(root, '[data-option="orientation"]'),
    orientationHint: query<HTMLElement>(root, '[data-orientation-hint]'),
    margin: query<HTMLSelectElement>(root, '[data-option="margin"]'),
    quality: query<HTMLSelectElement>(root, '[data-option="quality"]'),
    filename: query<HTMLInputElement>(root, '[data-filename]'),
    actionBar: query<HTMLElement>(root, '[data-action-bar]'),
    generate: query<HTMLButtonElement>(root, '[data-generate]'),
    cancel: query<HTMLButtonElement>(root, '[data-cancel]'),
    progressBlock: query<HTMLElement>(root, '[data-progress-block]'),
    progress: query<HTMLProgressElement>(root, '[data-progress]'),
    progressText: query<HTMLElement>(root, '[data-progress-text]'),
    status: query<HTMLElement>(root, '[data-status]'),
    result: query<HTMLElement>(root, '[data-result]'),
    resultText: query<HTMLElement>(root, '[data-result-text]'),
    downloadAgain: query<HTMLAnchorElement>(root, '[data-download-again]'),
    share: query<HTMLButtonElement>(root, '[data-share]'),
  };
}

export function initImagesToPdf(root: HTMLElement): void {
  if (root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const locale = getPageLocale();
  const m = imagesToPdfMessages[locale];
  const f = formatters(locale);

  const el = getElements(root);
  const items: ImageItem[] = [];
  const cards = new Map<string, HTMLLIElement>();

  let phase: Phase = 'idle';
  const importQueue: File[] = [];
  let batch = { total: 0, done: 0, added: 0, rejected: [] as Array<{ name: string; reason: RejectReason }> };
  let abortController: AbortController | null = null;
  let resultUrl: string | null = null;
  let shareFile: File | null = null;
  let announceTimer = 0;
  let largeWarningShown = false;
  let importGeneration = 0;
  let sharing = false;

  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const largeSelectionBytes = (coarsePointer ? LARGE_SELECTION_MB.touch : LARGE_SELECTION_MB.other) * 1024 * 1024;
  const inAppBrowser = IN_APP_BROWSER.test(navigator.userAgent);

  installPageDropGuard();

  // ---------------------------------------------------------------- helpers

  function announce(message: string): void {
    window.clearTimeout(announceTimer);
    el.announcer.textContent = '';
    // Re-setting after a tick makes screen readers repeat identical messages.
    announceTimer = window.setTimeout(() => {
      el.announcer.textContent = message;
    }, 50);
  }

  function setStatus(message: string, tone: 'neutral' | 'error' = 'neutral'): void {
    el.status.textContent = message;
    el.status.dataset.tone = tone;
  }

  function cardOf(item: ImageItem): HTMLLIElement {
    const card = cards.get(item.id);
    if (!card) throw new Error(`Images to PDF: no card for ${item.id}`);
    return card;
  }

  function button(card: HTMLElement, selector: string): HTMLButtonElement {
    return query<HTMLButtonElement>(card, selector);
  }

  function totalBytes(): number {
    return items.reduce((sum, item) => sum + item.size, 0);
  }

  // ---------------------------------------------------------------- rendering

  function renumber(): void {
    const busy = phase === 'generating';
    const last = items.length - 1;
    items.forEach((item, index) => {
      const card = cardOf(item);
      const page = index + 1;
      query<HTMLElement>(card, '[data-badge]').textContent = String(page);
      const earlier = button(card, '[data-move="earlier"]');
      const later = button(card, '[data-move="later"]');
      const remove = button(card, '[data-remove]');
      earlier.disabled = busy || index === 0;
      later.disabled = busy || index === last;
      remove.disabled = busy;
      // Labels carry the position: the badge is hidden from screen readers and file names repeat.
      earlier.setAttribute('aria-label', m.grid.moveEarlier(page, item.name));
      later.setAttribute('aria-label', m.grid.moveLater(page, item.name));
      remove.setAttribute('aria-label', m.grid.remove(page, item.name));
    });
  }

  function updateUi(): void {
    const count = items.length;
    const generating = phase === 'generating';
    const importing = phase === 'importing';

    if (count > 0) el.dropzone.dataset.compact = '';
    else delete el.dropzone.dataset.compact;
    el.dropzoneTitle.textContent = count > 0 ? m.dropzone.addMore : m.dropzone.choose;
    el.input.disabled = generating;
    if (generating) el.dropzone.dataset.disabled = '';
    else delete el.dropzone.dataset.disabled;

    el.toolbar.hidden = count === 0 && !importing;
    el.gridFrame.hidden = count === 0;
    el.count.textContent = m.toolbar.count(count);
    el.sort.disabled = generating || count < 2;
    el.reverse.disabled = generating || count < 2;
    // Clear all also stops an import in progress.
    el.clear.disabled = generating || (count === 0 && !importing);

    el.options.disabled = generating;
    const fit = el.pageSize.value === 'fit';
    el.orientation.disabled = fit;
    el.orientationHint.hidden = !fit;
    el.marginHint.hidden = !fit;

    el.generate.disabled = count === 0 || phase !== 'idle';
    el.cancel.hidden = !generating;
    el.progressBlock.hidden = !generating;

    sortable.option('disabled', generating);
    renumber();
  }

  function syncDom(): void {
    items.forEach((item, index) => {
      const card = cardOf(item);
      const current = el.grid.children[index] ?? null;
      if (current !== card) el.grid.insertBefore(card, current);
    });
  }

  function createCard(item: ImageItem): HTMLLIElement {
    const fragment = el.cardTemplate.content.cloneNode(true) as DocumentFragment;
    const card = query<HTMLLIElement>(fragment, '[data-item]');
    card.dataset.id = item.id;
    query<HTMLImageElement>(card, '[data-thumb]').src = item.thumbUrl;
    const name = query<HTMLElement>(card, '[data-name]');
    name.textContent = item.name;
    name.title = item.name;
    query<HTMLElement>(card, '[data-meta]').textContent = m.grid.meta(item.displayWidth, item.displayHeight, f.bytes(item.size));
    return card;
  }

  // ---------------------------------------------------------------- notices

  function showNotice(options: { key?: string; tone: NoticeTone; message: string; list?: string[] }): void {
    if (options.key) removeNotice(options.key);
    const fragment = el.noticeTemplate.content.cloneNode(true) as DocumentFragment;
    const notice = query<HTMLElement>(fragment, '[data-notice]');
    notice.dataset.tone = options.tone;
    if (options.key) notice.dataset.key = options.key;
    query<HTMLElement>(notice, '[data-notice-message]').textContent = options.message;
    const list = query<HTMLUListElement>(notice, '[data-notice-list]');
    if (options.list?.length) {
      for (const line of options.list) {
        const li = document.createElement('li');
        li.textContent = line;
        list.append(li);
      }
      list.hidden = false;
    }
    el.notices.append(notice);
  }

  function removeNotice(key: string): void {
    for (const notice of el.notices.querySelectorAll<HTMLElement>('[data-notice]')) {
      if (notice.dataset.key === key) notice.remove();
    }
  }

  /** Shows or removes the memory warning. Returns its text when it has just been shown. */
  function updateLargeSelectionWarning(): string | null {
    const total = totalBytes();
    if (total <= largeSelectionBytes || el.quality.value !== 'original') {
      removeNotice('large-selection');
      largeWarningShown = false;
      return null;
    }
    // Shown once per crossing of the threshold, so dismissing it sticks.
    if (largeWarningShown) return null;
    largeWarningShown = true;
    const message = m.notices.largeSelection(f.bytes(total));
    showNotice({ key: 'large-selection', tone: 'warning', message });
    return message;
  }

  el.notices.addEventListener('click', (event) => {
    const dismiss = (event.target as Element).closest('[data-notice-dismiss]');
    if (!dismiss) return;
    const notice = dismiss.closest<HTMLElement>('[data-notice]');
    const next = notice?.nextElementSibling?.querySelector<HTMLElement>('[data-notice-dismiss]')
      ?? notice?.previousElementSibling?.querySelector<HTMLElement>('[data-notice-dismiss]');
    notice?.remove();
    (next ?? el.input).focus();
  });

  // ---------------------------------------------------------------- import

  function updateImportStatus(): void {
    el.importStatus.hidden = false;
    el.importStatus.textContent = m.importing(Math.min(batch.done + 1, batch.total), batch.total);
  }

  function finishBatch(): void {
    el.importStatus.hidden = true;
    el.importStatus.textContent = '';
    const { total, added, rejected } = batch;
    batch = { total: 0, done: 0, added: 0, rejected: [] };
    const warning = updateLargeSelectionWarning();
    if (total === 0) return; // cleared while importing: "Removed all images" was announced

    // One announcement: a second announce() within 50 ms would replace the first.
    let message = m.announce.added(added);
    if (rejected.length) {
      const lines = rejected
        .slice(0, MAX_LISTED_REJECTIONS)
        .map(({ name, reason }) => m.notices.rejection(name || m.names.unnamedFile, m.reasons[reason]));
      if (rejected.length > MAX_LISTED_REJECTIONS) lines.push(m.notices.more(rejected.length - MAX_LISTED_REJECTIONS));
      showNotice({ tone: 'warning', message: m.notices.skipped(rejected.length), list: lines });
      message = m.announce.addedSkipped(added, rejected.length, lines.join('; '));
    }
    announce(warning ? `${message}. ${warning}` : message);
  }

  function addItem(item: ImageItem): void {
    invalidateResult();
    items.push(item);
    const card = createCard(item);
    cards.set(item.id, card);
    el.grid.append(card);
  }

  async function pumpImports(): Promise<void> {
    phase = 'importing';
    updateUi();
    try {
      // Sequential on purpose: decoding several camera photos at once can exhaust phone memory.
      for (let file = importQueue.shift(); file; file = importQueue.shift()) {
        updateImportStatus();
        const generation = importGeneration;
        try {
          const result = await importFile(file, m.names.untitledImage);
          if (generation !== importGeneration) {
            // Clear all was used while this file was being read.
            if (result.ok) URL.revokeObjectURL(result.item.thumbUrl);
            continue;
          }
          if (result.ok) {
            addItem(result.item);
            batch.added++;
          } else {
            batch.rejected.push({ name: result.name, reason: result.reason });
          }
        } catch {
          if (generation !== importGeneration) continue;
          batch.rejected.push({ name: file.name, reason: 'undecodable' });
        }
        batch.done++;
        updateUi();
      }
    } finally {
      phase = 'idle';
      finishBatch();
      updateUi();
    }
  }

  function enqueueFiles(files: Iterable<File> | ArrayLike<File>): void {
    if (phase === 'generating') return;
    const list = Array.from(files);
    if (!list.length) return;
    setStatus('');
    importQueue.push(...list);
    batch.total += list.length;
    announce(m.announce.adding(batch.total));
    if (phase !== 'importing') void pumpImports();
    else updateImportStatus();
  }

  el.input.addEventListener('change', () => {
    const files = Array.from(el.input.files ?? []);
    el.input.value = ''; // allow picking the same file again
    enqueueFiles(files);
  });

  let dragDepth = 0;
  root.addEventListener('dragenter', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth++;
    if (phase !== 'generating') el.dropzone.dataset.dragover = '';
  });
  root.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = phase === 'generating' ? 'none' : 'copy';
  });
  root.addEventListener('dragleave', (event) => {
    if (!hasFiles(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) delete el.dropzone.dataset.dragover;
  });
  root.addEventListener('drop', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth = 0;
    delete el.dropzone.dataset.dragover;
    if (event.dataTransfer) enqueueFiles(event.dataTransfer.files);
  });

  // ---------------------------------------------------------------- reordering

  function reorderTo(ids: string[]): void {
    const byId = new Map(items.map((item) => [item.id, item]));
    items.splice(0, items.length, ...ids.map((id) => byId.get(id)!));
  }

  function moveItem(id: string, delta: -1 | 1): void {
    const from = items.findIndex((item) => item.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= items.length) return;
    const [item] = items.splice(from, 1);
    items.splice(to, 0, item!);
    invalidateResult();
    syncDom();
    renumber();

    // Keep focus on the same logical control; fall back to the sibling if it became disabled.
    const card = cardOf(item!);
    const same = button(card, delta < 0 ? '[data-move="earlier"]' : '[data-move="later"]');
    const other = button(card, delta < 0 ? '[data-move="later"]' : '[data-move="earlier"]');
    (same.disabled ? other : same).focus();
    announce(m.announce.moved(item!.name, to + 1, items.length));
  }

  function removeItem(id: string): void {
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return;
    const [item] = items.splice(index, 1);
    invalidateResult();
    URL.revokeObjectURL(item!.thumbUrl);
    cards.get(id)?.remove();
    cards.delete(id);
    updateUi();
    const next = items[index] ?? items[index - 1];
    if (next) button(cardOf(next), '[data-remove]').focus();
    else el.input.focus();
    announce(m.announce.removed(item!.name, items.length));
    updateLargeSelectionWarning();
  }

  el.grid.addEventListener('click', (event) => {
    const target = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!target || target.disabled || phase === 'generating') return;
    const id = target.closest<HTMLElement>('[data-item]')?.dataset.id;
    if (!id) return;
    if (target.matches('[data-remove]')) removeItem(id);
    else if (target.dataset.move === 'earlier') moveItem(id, -1);
    else if (target.dataset.move === 'later') moveItem(id, 1);
  });

  // Focus moves to the next card's Remove button after a removal, so a held-down Enter
  // would otherwise remove one image after another at key-repeat speed.
  el.grid.addEventListener('keydown', (event) => {
    if (!event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return;
    if ((event.target as Element).closest('[data-remove]')) event.preventDefault();
  });

  // File names sort as the page's language expects (ç after c on /tr/), with numbers in order.
  const collator = new Intl.Collator(LOCALE_META[locale].intl, { numeric: true, sensitivity: 'base' });

  el.sort.addEventListener('click', () => {
    if (phase === 'generating' || items.length < 2) return;
    items.sort((a, b) => collator.compare(a.name, b.name));
    invalidateResult();
    syncDom();
    renumber();
    announce(m.announce.sorted);
  });

  el.reverse.addEventListener('click', () => {
    if (phase === 'generating' || items.length < 2) return;
    items.reverse();
    invalidateResult();
    syncDom();
    renumber();
    announce(m.announce.reversed);
  });

  el.clear.addEventListener('click', () => {
    const importing = phase === 'importing';
    if (phase === 'generating' || (items.length === 0 && !importing)) return;
    const question = importing ? m.confirm.clearImporting : m.confirm.clearAll(items.length);
    if (!window.confirm(question)) return;
    // Stop the import: the file being read right now is discarded when it finishes.
    importQueue.length = 0;
    batch = { total: 0, done: 0, added: 0, rejected: [] };
    importGeneration++;
    el.importStatus.hidden = true;
    for (const item of items) URL.revokeObjectURL(item.thumbUrl);
    items.length = 0;
    cards.clear();
    el.grid.replaceChildren();
    for (const notice of el.notices.querySelectorAll<HTMLElement>('[data-notice]')) {
      if (notice.dataset.key !== 'in-app-browser') notice.remove();
    }
    largeWarningShown = false;
    hideResult();
    setStatus('');
    updateUi();
    el.input.focus();
    announce(m.announce.removedAll);
  });

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let savedScrollBehavior: string | null = null;
  let dragStarted = false;
  let dragScrollLimitY = Infinity;

  /**
   * iOS positions Sortable's floating card absolutely inside the page, so near the bottom
   * it makes the page taller and autoscroll keeps scrolling into blank space.
   * (Sideways runaway is prevented by overflow-x: clip on <html>.)
   */
  function clampDragScroll(): void {
    if (window.scrollY > dragScrollLimitY) window.scrollTo(window.scrollX, dragScrollLimitY);
  }

  function restoreScrollBehavior(): void {
    if (savedScrollBehavior === null) return;
    document.documentElement.style.scrollBehavior = savedScrollBehavior;
    savedScrollBehavior = null;
  }

  const sortable = Sortable.create(el.grid, {
    animation: reducedMotion ? 0 : 150,
    draggable: '[data-item]',
    dataIdAttr: 'data-id',
    // Taps on the card buttons must stay clicks, never drags.
    filter: 'button, a, input, select',
    preventOnFilter: false,
    // Touch: a normal swipe still scrolls the page; a 250 ms long-press picks the card up.
    // delayOnTouchOnly: mouse and pen drags start immediately.
    delay: 250,
    delayOnTouchOnly: true,
    touchStartThreshold: 8,
    // forceFallback: Sortable moves its own clone that follows the pointer, identically on
    // iOS, Android and desktop, with reliable autoscroll. Native HTML5 drag and drop is
    // unusable on touch screens.
    forceFallback: true,
    fallbackTolerance: 4,
    ghostClass: 'itp-ghost',
    chosenClass: 'itp-chosen',
    dragClass: 'itp-drag',
    scroll: true,
    scrollSensitivity: 80,
    scrollSpeed: 12,
    bubbleScroll: true,
    onStart() {
      // Smooth scroll-behavior on <html> makes autoscroll stutter while dragging.
      savedScrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      dragStarted = true;
      dragScrollLimitY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.addEventListener('scroll', clampDragScroll, { passive: true });
    },
    onUnchoose() {
      restoreScrollBehavior();
      window.removeEventListener('scroll', clampDragScroll);
      dragScrollLimitY = Infinity;
      if (dragStarted) {
        dragStarted = false;
        // Sortable swallows the next click after a fallback drag (meant for the click a mouse
        // drag produces). A touch drag produces no click, so the user's next tap anywhere
        // would be ignored. This runs after any real click, which clears the flag first.
        // Sortable catches it on document; it is dispatched on <html>, an Element, because
        // other document click listeners (the header's language switch) call target.closest().
        window.setTimeout(() => document.documentElement.dispatchEvent(new MouseEvent('click', { bubbles: true })), 0);
      }
    },
    onEnd(event) {
      restoreScrollBehavior();
      const seen = new Set<string>();
      const order = sortable.toArray().filter((id) => cards.has(id) && !seen.has(id) && seen.add(id));
      if (order.length !== items.length) {
        syncDom(); // unexpected DOM state: restore the known order
        renumber();
        return;
      }
      if (order.every((id, index) => items[index]!.id === id)) return;
      reorderTo(order);
      invalidateResult();
      renumber();
      const movedId = (event.item as HTMLElement).dataset.id;
      const position = items.findIndex((item) => item.id === movedId);
      const moved = items[position];
      if (moved) announce(m.announce.moved(moved.name, position + 1, items.length));
    },
  });

  // ---------------------------------------------------------------- options

  el.pageSize.addEventListener('change', updateUi);
  // Any option change makes an existing PDF out of date (generate() sets the file name
  // in code, which fires no event).
  el.options.addEventListener('input', () => invalidateResult());
  el.options.addEventListener('change', () => invalidateResult());
  el.quality.addEventListener('change', () => {
    const warning = updateLargeSelectionWarning();
    if (warning) announce(warning);
  });

  // ---------------------------------------------------------------- generate

  function revokeResult(): void {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = null;
    shareFile = null;
  }

  function hideResult(): void {
    revokeResult();
    el.result.hidden = true;
    el.downloadAgain.removeAttribute('href');
    el.share.hidden = true;
  }

  /** The pages or options changed: never offer the previous PDF as if it were current. */
  function invalidateResult(): void {
    if (el.result.hidden) return;
    hideResult();
    setStatus('');
  }

  function showResult(blob: Blob, filename: string, pages: number): void {
    revokeResult();
    resultUrl = URL.createObjectURL(blob);
    el.downloadAgain.href = resultUrl;
    el.downloadAgain.download = filename;
    let message = m.result.ready(pages, f.bytes(blob.size));
    if (inAppBrowser) message += ` ${m.result.inAppHint}`;
    el.resultText.textContent = message;
    try {
      const file = new File([blob], filename, { type: 'application/pdf' });
      shareFile = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }) ? file : null;
    } catch {
      shareFile = null;
    }
    el.share.hidden = !shareFile;
    el.result.hidden = false;
    announce(message);
  }

  function setProgress(done: number, total: number, text: string): void {
    el.progress.max = Math.max(1, total);
    el.progress.value = Math.min(done, total);
    el.progressText.textContent = text;
  }

  function describeError(error: unknown): string {
    if (error instanceof PdfEngineLoadError) return m.errors.engine;
    if (looksLikeOutOfMemory(error)) return m.errors.memory;
    if (error instanceof ItemError) return m.errors.item(error.itemName);
    return m.errors.generic;
  }

  async function generate(): Promise<void> {
    if (phase !== 'idle' || items.length === 0) return;
    hideResult();
    setStatus('');

    const snapshot = items.slice();
    const total = snapshot.length;
    const quality = pick(el.quality.value, QUALITIES, 'original');
    const pageSize = pick(el.pageSize.value, PAGE_SIZES, 'a4');
    const orientation = pick(el.orientation.value, ORIENTATIONS, 'auto');
    const margin = pick(el.margin.value, MARGINS, 'small');
    const filename = toPdfFilename(el.filename.value, m.names.fallbackFilename);
    el.filename.value = filename;

    const controller = new AbortController();
    abortController = controller;
    const focusWasOnGenerate = document.activeElement === el.generate;
    phase = 'generating';
    updateUi();
    if (focusWasOnGenerate) el.cancel.focus();
    setProgress(0, total, m.progress.processing(1, total));
    announce(m.announce.creating);

    const withItem = async <T>(index: number, task: (item: ImageItem) => Promise<T>): Promise<T> => {
      const item = snapshot[index]!;
      try {
        return await task(item);
      } catch (error) {
        if (isAbortError(error)) throw error;
        throw new ItemError(item.name, error);
      }
    };

    try {
      // pdf-lib runs in a worker that is only loaded now; Cancel terminates it at once.
      const bytes = await buildPdfInWorker({
        count: total,
        getImage: (index, fallback, signal) =>
          withItem(index, (item) => {
            if (fallback) return prepareFallback(item, quality, signal);
            setProgress(index, total, m.progress.processing(index + 1, total));
            return prepareImage(item, quality, signal);
          }),
        options: {
          pageSize,
          orientation,
          margin,
          title: filename.replace(/\.pdf$/i, ''),
          creator: m.names.creator,
        },
        signal: controller.signal,
        onProgress: (done, count, stage) => {
          if (stage === 'saving') {
            setProgress(count, count, m.progress.saving);
            announce(m.announce.saving);
          } else {
            setProgress(done, count, done < count ? m.progress.processing(done + 1, count) : m.progress.saving);
          }
        },
      });
      if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      saveBlob(blob, filename);
      showResult(blob, filename, total);
    } catch (error) {
      if (isAbortError(error)) {
        setStatus(m.status.cancelled);
        announce(m.announce.cancelled);
      } else {
        console.error('Images to PDF failed:', error instanceof ItemError ? error.original : error);
        const message = describeError(error);
        setStatus(message, 'error');
        announce(message);
      }
    } finally {
      abortController = null;
      const focusWasOnCancel = document.activeElement === el.cancel;
      phase = 'idle';
      updateUi();
      if (focusWasOnCancel || document.activeElement === document.body) {
        if (!el.result.hidden) el.downloadAgain.focus();
        else el.generate.focus();
      }
    }
  }

  el.generate.addEventListener('click', () => {
    void generate();
  });

  el.cancel.addEventListener('click', () => {
    if (!abortController) return;
    abortController.abort();
    el.progressText.textContent = m.progress.cancelling;
  });

  el.share.addEventListener('click', async () => {
    // A second tap while the share sheet is opening would reject with InvalidStateError.
    if (!shareFile || sharing) return;
    sharing = true;
    try {
      await navigator.share({ files: [shareFile] });
      setStatus('');
    } catch (error) {
      const name = (error as { name?: unknown } | null)?.name;
      if (name !== 'AbortError' && name !== 'InvalidStateError') {
        setStatus(m.errors.share, 'error');
        announce(m.errors.share);
      }
    } finally {
      sharing = false;
    }
  });

  // ---------------------------------------------------------------- lifecycle

  // Lets focus scrolling keep controls clear of the sticky action bar (scroll-padding-bottom).
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      const height = Math.ceil(el.actionBar.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--itp-action-bar-height', `${height}px`);
    }).observe(el.actionBar);
  }

  if (inAppBrowser) {
    showNotice({ key: 'in-app-browser', tone: 'info', message: m.notices.inAppBrowser });
  }

  window.addEventListener('pagehide', (event) => {
    // A page kept in the back/forward cache may be shown again with its thumbnails and
    // download link, so only revoke when the document is really going away.
    if (event.persisted) return;
    for (const item of items) URL.revokeObjectURL(item.thumbUrl);
    revokeResult();
  });

  updateUi();
}
