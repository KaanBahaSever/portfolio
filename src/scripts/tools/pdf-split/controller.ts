/**
 * Split PDF: DOM wiring and state (browser only). Everything happens on the device;
 * nothing is uploaded.
 *
 * - pdf-lib lives in the worker behind ./split-engine.ts: it reads the file (the source of
 *   truth for page count and encryption) and creates the outputs.
 * - PDF.js renders the page thumbnails behind ./thumbnails.ts, loaded only once a file has
 *   been read; if it fails, the tool keeps working without previews.
 * - The page field is the single source of truth for the selection: typing updates the
 *   grid, and grid clicks rewrite the field (./page-grid.ts reports, this file decides).
 *
 * All text comes from src/i18n/tools/pdf-split.ts in the page's language.
 */

import { saveBlob } from '../../../lib/download.ts';
import {
  PDF_SIGNATURE_WINDOW,
  expandRanges,
  formatPageRanges,
  formatPageSequence,
  hasPdfSignature,
  outputBaseName,
  pageUsage,
  parsePageRanges,
  planOutputs,
  reconcileRanges,
  reconcileSequence,
  summarizePlan,
  zipFilename,
} from '../../../lib/pdf/page-ranges.ts';
import type { PageRange, PlanResult, SplitMode } from '../../../lib/pdf/page-ranges.ts';
import type { ZipLimitCode } from '../../../lib/zip/zip-store.ts';
import { getPageLocale } from '../../../i18n/client.ts';
import { formatters } from '../../../i18n/format.ts';
import { pdfSplitMessages } from '../../../i18n/tools/pdf-split.ts';
import { MAX_GRID_PAGES, previewGate, sheetAspect } from './grid-math.ts';
import { createPageGrid } from './page-grid.ts';
import type { GridView } from './page-grid.ts';
import { FileReadError, PdfEngineLoadError, WorkerCrashError, createSplitEngine } from './split-engine.ts';
import type { CodedError, PdfSummary, SplitProgress, SplitResult } from './split-engine.ts';
import { createThumbnailService } from './thumbnails.ts';

/**
 * empty: no file · loading: reading/parsing a file · ready: file parsed, options editable ·
 * splitting: creating the outputs (options locked, Cancel shown).
 */
type Phase = 'empty' | 'loading' | 'ready' | 'splitting';

const MODES: readonly SplitMode[] = ['extract', 'ranges', 'every', 'single'];
/** Files above this size get a memory warning on touch devices (phones and tablets). */
const LARGE_FILE_BYTES_TOUCH = 100 * 1024 * 1024;
const MAX_LISTED_FILES = 50;
const ZIP_LIMIT_CODES: readonly string[] = ['too-many-entries', 'too-large', 'name-too-long'] satisfies ZipLimitCode[];

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

function looksLikeOutOfMemory(error: unknown): boolean {
  if (error instanceof WorkerCrashError) return true;
  if (!(error instanceof Error)) return false;
  return error.name === 'RangeError' && /alloc|memory|array length|buffer/i.test(error.message);
}

function hasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return !!types && Array.from(types).includes('Files');
}

function isStrictlyAscending(values: readonly number[]): boolean {
  for (let i = 1; i < values.length; i++) if (values[i]! <= values[i - 1]!) return false;
  return true;
}

let pageDropGuardInstalled = false;

/** Dropping a file outside the tool would navigate away from the page. */
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
  if (!element) throw new Error(`Split PDF: missing element ${selector}`);
  return element;
}

function getElements(root: HTMLElement) {
  return {
    announcer: query<HTMLElement>(root, '[data-announcer]'),
    dropzone: query<HTMLLabelElement>(root, '[data-dropzone]'),
    input: query<HTMLInputElement>(root, '[data-file-input]'),
    loadError: query<HTMLElement>(root, '[data-load-error]'),
    notices: query<HTMLElement>(root, '[data-notices]'),
    noticeTemplate: query<HTMLTemplateElement>(root, 'template[data-notice-template]'),
    fileCard: query<HTMLElement>(root, '[data-file-card]'),
    fileName: query<HTMLElement>(root, '[data-file-name]'),
    fileMeta: query<HTMLElement>(root, '[data-file-meta]'),
    chooseAnother: query<HTMLButtonElement>(root, '[data-choose-another]'),
    workspace: query<HTMLElement>(root, '[data-workspace]'),
    options: query<HTMLFieldSetElement>(root, '[data-options]'),
    modes: Array.from(root.querySelectorAll<HTMLInputElement>('input[data-mode]')),
    modeDescription: query<HTMLElement>(root, '[data-mode-description]'),
    pagesField: query<HTMLElement>(root, '[data-pages-field]'),
    pagesLabel: query<HTMLElement>(root, '[data-pages-label]'),
    pages: query<HTMLInputElement>(root, '[data-pages]'),
    pagesHint: query<HTMLElement>(root, '[data-pages-hint]'),
    pagesError: query<HTMLElement>(root, '[data-pages-error]'),
    everyField: query<HTMLElement>(root, '[data-every-field]'),
    every: query<HTMLInputElement>(root, '[data-every]'),
    everyError: query<HTMLElement>(root, '[data-every-error]'),
    basename: query<HTMLInputElement>(root, '[data-basename]'),
    nameHint: query<HTMLElement>(root, '[data-name-hint]'),
    gridFieldset: query<HTMLFieldSetElement>(root, '[data-grid-fieldset]'),
    gridCount: query<HTMLElement>(root, '[data-grid-count]'),
    gridTools: query<HTMLElement>(root, '[data-grid-tools]'),
    selectAll: query<HTMLButtonElement>(root, '[data-select-all]'),
    selectNone: query<HTMLButtonElement>(root, '[data-select-none]'),
    selectInvert: query<HTMLButtonElement>(root, '[data-select-invert]'),
    gridHint: query<HTMLElement>(root, '[data-grid-hint]'),
    hintInteractive: query<HTMLElement>(root, '[data-hint-interactive]'),
    hintRanges: query<HTMLElement>(root, '[data-hint-ranges]'),
    hintReadOnly: query<HTMLElement>(root, '[data-hint-readonly]'),
    customOrder: query<HTMLElement>(root, '[data-custom-order]'),
    previewNotice: query<HTMLElement>(root, '[data-preview-notice]'),
    previewMessage: query<HTMLElement>(root, '[data-preview-message]'),
    showPreviews: query<HTMLButtonElement>(root, '[data-show-previews]'),
    gridFrame: query<HTMLElement>(root, '[data-grid-frame]'),
    grid: query<HTMLOListElement>(root, '[data-grid]'),
    tileTemplate: query<HTMLTemplateElement>(root, 'template[data-tile-template]'),
    actionBar: query<HTMLElement>(root, '[data-action-bar]'),
    plan: query<HTMLElement>(root, '[data-plan]'),
    run: query<HTMLButtonElement>(root, '[data-run]'),
    runLabel: query<HTMLElement>(root, '[data-run-label]'),
    cancel: query<HTMLButtonElement>(root, '[data-cancel]'),
    progressBlock: query<HTMLElement>(root, '[data-progress-block]'),
    progress: query<HTMLProgressElement>(root, '[data-progress]'),
    progressText: query<HTMLElement>(root, '[data-progress-text]'),
    status: query<HTMLElement>(root, '[data-status]'),
    result: query<HTMLElement>(root, '[data-result]'),
    resultText: query<HTMLElement>(root, '[data-result-text]'),
    downloadAgain: query<HTMLAnchorElement>(root, '[data-download-again]'),
    resultDetails: query<HTMLDetailsElement>(root, '[data-result-details]'),
    resultSummary: query<HTMLElement>(root, '[data-result-summary]'),
    resultFiles: query<HTMLUListElement>(root, '[data-result-files]'),
    resultFileTemplate: query<HTMLTemplateElement>(root, 'template[data-result-file-template]'),
  };
}

export function initPdfSplit(root: HTMLElement): void {
  if (root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const locale = getPageLocale();
  const m = pdfSplitMessages[locale];
  const f = formatters(locale);
  /** "3,9 KB" with a no-break space, so a size never wraps between number and unit. */
  const NO_BREAK_SPACE = String.fromCharCode(0xa0);
  const size = (bytes: number) => f.bytes(bytes).replace(' ', NO_BREAK_SPACE);
  const el = getElements(root);
  const engine = createSplitEngine();

  let phase: Phase = 'empty';
  let file: File | null = null;
  let pageCount = 0;
  let loadGeneration = 0;
  let loadController: AbortController | null = null;
  let splitController: AbortController | null = null;
  let resultUrl: string | null = null;
  let announceTimer = 0;
  let countTimer = 0;
  /** The page field's last readable selection ([] when empty). Grid clicks start from it. */
  let lastRanges: PageRange[] = [];
  /** A page grid exists for the current file (not for PDFs above MAX_GRID_PAGES). */
  let gridActive = false;
  /** Bumped whenever previews are reset, so a slow preview start for an old file is ignored. */
  let previewToken = 0;

  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;

  const grid = createPageGrid({
    list: el.grid,
    template: el.tileTemplate,
    messages: m,
    onPick: pickPages,
    onSelectAll: () => applySelection(allPages()),
  });
  const thumbnails = createThumbnailService({
    onThumbnail: (page, url, width, height) => grid.setThumbnail(page, url, width, height),
    onPageError: (page) => grid.setPageUnavailable(page),
  });

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

  function setLoadError(message: string): void {
    el.loadError.textContent = message;
    if (message) el.input.setAttribute('aria-invalid', 'true');
    else el.input.removeAttribute('aria-invalid');
  }

  function currentMode(): SplitMode {
    const checked = el.modes.find((radio) => radio.checked)?.value ?? '';
    return (MODES as readonly string[]).includes(checked) ? (checked as SplitMode) : 'extract';
  }

  function focusIsLost(): boolean {
    const active = document.activeElement;
    return !active || active === document.body;
  }

  // ---------------------------------------------------------------- notices

  function showNotice(key: string, message: string): void {
    removeNotice(key);
    const fragment = el.noticeTemplate.content.cloneNode(true) as DocumentFragment;
    const notice = query<HTMLElement>(fragment, '[data-notice]');
    notice.dataset.key = key;
    query<HTMLElement>(notice, '[data-notice-message]').textContent = message;
    el.notices.append(notice);
  }

  function removeNotice(key: string): void {
    for (const notice of el.notices.querySelectorAll<HTMLElement>('[data-notice]')) {
      if (notice.dataset.key === key) notice.remove();
    }
  }

  el.notices.addEventListener('click', (event) => {
    const dismiss = (event.target as Element).closest('[data-notice-dismiss]');
    if (!dismiss) return;
    dismiss.closest('[data-notice]')?.remove();
    (phase === 'empty' ? el.input : phase === 'splitting' ? el.cancel : el.chooseAnother).focus();
  });

  // ---------------------------------------------------------------- plan

  function computePlan(mode: SplitMode): PlanResult {
    const input = mode === 'every' ? el.every.value : mode === 'single' ? '' : el.pages.value;
    return planOutputs(mode, input, pageCount, el.basename.value, m.outputNames);
  }

  function setFieldError(input: HTMLInputElement, output: HTMLElement, message: string): void {
    output.textContent = message;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  /**
   * Updates the mode-dependent fields, inline errors, the plan preview and the page grid.
   * Errors for an empty field only appear once the person tries to run (`showEmptyErrors`).
   */
  function renderPlan(showEmptyErrors = false): PlanResult | null {
    const mode = currentMode();
    const usesPages = mode === 'extract' || mode === 'ranges';
    el.pagesField.hidden = !usesPages;
    el.everyField.hidden = mode !== 'every';
    el.modeDescription.textContent = m.modes[mode].description;
    el.pagesLabel.textContent = mode === 'extract' ? m.pages.labelExtract : m.pages.labelRanges;
    el.pagesHint.textContent = mode === 'extract' ? m.pages.hintExtract : m.pages.hintRanges;
    el.runLabel.textContent = mode === 'extract' ? m.actions.extract : m.actions.split;

    // The grid follows the field; while the field can't be read, it keeps the last selection.
    if (pageCount > 0) {
      const parsed = parsePageRanges(el.pages.value, pageCount);
      if (parsed.ok) lastRanges = parsed.ranges;
      else if (parsed.error.code === 'empty') lastRanges = [];
    }

    const plan = file && pageCount > 0 ? computePlan(mode) : null;
    let pagesError = '';
    let everyError = '';
    let prompt = '';
    if (plan && !plan.ok) {
      if (mode === 'single') {
        prompt = m.rangeError(plan.error); // no field to show it next to
      } else {
        const field = mode === 'every' ? el.every : el.pages;
        const empty = field.value.trim() === '' && !field.validity.badInput;
        if (!empty || showEmptyErrors) {
          if (mode === 'every') everyError = m.rangeError(plan.error);
          else pagesError = m.rangeError(plan.error);
        } else {
          prompt = mode === 'every' ? m.every.prompt : m.pages.prompt;
        }
      }
    }
    setFieldError(el.pages, el.pagesError, usesPages ? pagesError : '');
    setFieldError(el.every, el.everyError, mode === 'every' ? everyError : '');

    const summary = plan?.ok ? summarizePlan(plan.outputs) : null;
    el.plan.textContent = summary ? m.plan.summary(summary) : prompt;

    const base = outputBaseName(el.basename.value, m.outputNames.fallbackBase);
    if (plan?.ok && plan.outputs.length === 1) {
      el.nameHint.textContent = m.name.savesAs(plan.outputs[0]!.filename);
    } else if (plan?.ok) {
      el.nameHint.textContent = m.name.savesZip(zipFilename(base, m.outputNames), plan.outputs.length);
    } else {
      el.nameHint.textContent = m.name.example(`${base}-${m.outputNames.pages}-1-3.pdf`);
    }

    renderGrid(mode, plan);
    return plan;
  }

  // ---------------------------------------------------------------- grid

  function renderGrid(mode: SplitMode, plan: PlanResult | null): void {
    if (!gridActive) return;
    let view: GridView;
    if (mode === 'extract') {
      view = { interactive: true, uses: pageUsage([expandRanges(lastRanges)], pageCount).uses, files: null };
    } else if (mode === 'ranges') {
      const usage = pageUsage(
        lastRanges.map((range) => expandRanges([range])),
        pageCount,
      );
      view = { interactive: true, uses: usage.uses, files: usage.firstOutput };
    } else {
      const usage = pageUsage(plan?.ok ? plan.outputs.map((output) => output.indices) : [], pageCount);
      view = { interactive: false, uses: usage.uses, files: plan?.ok ? usage.firstOutput : null };
    }
    grid.setView(view);

    el.gridTools.hidden = !view.interactive;
    el.hintInteractive.hidden = !view.interactive;
    el.hintRanges.hidden = mode !== 'ranges';
    el.hintReadOnly.hidden = view.interactive;
    el.customOrder.hidden = !(mode === 'extract' && !isStrictlyAscending(expandRanges(lastRanges)));

    let distinct = 0;
    let total = 0;
    for (const uses of view.uses) {
      if (uses > 0) distinct++;
      total += uses;
    }
    if (mode === 'extract') {
      el.gridCount.textContent =
        distinct === 0 ? m.grid.countNone : distinct === pageCount ? m.grid.countAll(pageCount) : m.grid.countSome(distinct, pageCount);
    } else if (mode === 'ranges') {
      el.gridCount.textContent = lastRanges.length === 0 ? m.grid.countNone : m.grid.countFiles(total, lastRanges.length);
    } else {
      el.gridCount.textContent = plan?.ok ? m.grid.countFiles(total, plan.outputs.length) : '';
    }
  }

  function currentSelection(): Set<number> {
    const pages = new Set<number>();
    for (const index of expandRanges(lastRanges)) pages.add(index + 1);
    return pages;
  }

  function allPages(): Set<number> {
    return new Set(Array.from({ length: pageCount }, (_, index) => index + 1));
  }

  /**
   * Writes a new set of selected pages into the page field (keeping a typed order or range
   * grouping where possible), then re-renders everything from the field.
   */
  function applySelection(next: Set<number>): void {
    if (phase !== 'ready') return;
    const mode = currentMode();
    if (mode === 'extract') {
      const sequence = expandRanges(lastRanges).map((index) => index + 1);
      el.pages.value = formatPageSequence(reconcileSequence(sequence, next));
    } else if (mode === 'ranges') {
      el.pages.value = formatPageRanges(reconcileRanges(lastRanges, next));
    } else {
      return;
    }
    // Setting .value fires no input event: do what the options listener would.
    invalidateResult();
    renderPlan();
    // The pressed state of a tile is announced by itself; the total follows once clicking pauses.
    window.clearTimeout(countTimer);
    countTimer = window.setTimeout(() => announce(el.gridCount.textContent ?? ''), 700);
  }

  function pickPages(pages: number[], select: boolean): void {
    const next = currentSelection();
    for (const page of pages) {
      if (select) next.add(page);
      else next.delete(page);
    }
    applySelection(next);
  }

  el.selectAll.addEventListener('click', () => applySelection(allPages()));
  el.selectNone.addEventListener('click', () => applySelection(new Set()));
  el.selectInvert.addEventListener('click', () => {
    const current = currentSelection();
    const next = new Set<number>();
    for (let page = 1; page <= pageCount; page++) if (!current.has(page)) next.add(page);
    applySelection(next);
  });

  function showPreviewNotice(message: string, offerPreviews: boolean): void {
    el.previewMessage.textContent = message;
    el.showPreviews.hidden = !offerPreviews;
    el.previewNotice.hidden = false;
  }

  function hidePreviewNotice(): void {
    el.previewNotice.hidden = true;
    el.previewMessage.textContent = '';
  }

  /** Forgets the grid and its previews (a new file, a failed load, or leaving the page). */
  function resetGrid(): void {
    previewToken++;
    thumbnails.close();
    grid.clear();
    gridActive = false;
    hidePreviewNotice();
  }

  async function startPreviews(source: File): Promise<void> {
    const token = ++previewToken;
    hidePreviewNotice();
    try {
      await thumbnails.open(source, pageCount);
      if (token !== previewToken) return;
      grid.showPreviews(thumbnails);
    } catch (error) {
      if (token !== previewToken || isAbortError(error)) return;
      console.warn('Split PDF: previews are unavailable for this file:', error);
      showPreviewNotice(m.grid.previewsFailed, false);
    }
  }

  /** Builds the page grid for a freshly loaded file and decides whether previews start now. */
  function setupGrid(source: File, summary: PdfSummary): void {
    const gate = previewGate(pageCount, source.size, coarsePointer);
    const showGrid = gate !== 'too-many';
    el.gridFrame.hidden = !showGrid;
    el.gridHint.hidden = !showGrid;
    el.gridCount.textContent = '';
    if (!showGrid) {
      el.gridTools.hidden = true;
      el.customOrder.hidden = true;
      showPreviewNotice(m.grid.tooManyPages(pageCount, MAX_GRID_PAGES), false);
      return;
    }
    gridActive = true;
    grid.build(pageCount, sheetAspect(summary.firstPage));
    if (gate === 'show') void startPreviews(source);
    else showPreviewNotice(gate === 'ask-size' ? m.grid.previewsOffSize(size(source.size)) : m.grid.previewsOffPages(pageCount), true);
  }

  el.showPreviews.addEventListener('click', () => {
    if (!file || !gridActive) return;
    // The button disappears: keep keyboard focus in the grid.
    el.grid.querySelector<HTMLElement>('[data-tile][tabindex="0"]')?.focus();
    void startPreviews(file);
  });

  // ---------------------------------------------------------------- ui

  function updateUi(): void {
    const splitting = phase === 'splitting';
    const hasFile = phase !== 'empty';
    el.dropzone.hidden = hasFile;
    el.fileCard.hidden = !hasFile;
    el.workspace.hidden = !(phase === 'ready' || splitting);
    el.input.disabled = splitting;
    el.chooseAnother.disabled = splitting;
    el.options.disabled = splitting;
    el.gridFieldset.disabled = splitting;
    el.run.disabled = phase !== 'ready';
    el.cancel.hidden = !splitting;
    el.progressBlock.hidden = !splitting;
  }

  function setProgress(done: number, total: number, text: string): void {
    el.progress.max = Math.max(1, total);
    el.progress.value = Math.min(done, total);
    el.progressText.textContent = text;
  }

  // ---------------------------------------------------------------- result

  function revokeResult(): void {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = null;
  }

  function hideResult(): void {
    revokeResult();
    el.result.hidden = true;
    el.plan.hidden = false;
    el.downloadAgain.removeAttribute('href');
    el.resultFiles.replaceChildren();
    el.resultDetails.hidden = true;
  }

  /** The file or the options changed: never offer the previous output as if it were current. */
  function invalidateResult(): void {
    if (el.result.hidden) return;
    hideResult();
    setStatus('');
  }

  function showResult(result: SplitResult, downloadName: string): string {
    revokeResult();
    resultUrl = URL.createObjectURL(result.blob);
    el.downloadAgain.href = resultUrl;
    el.downloadAgain.download = downloadName;

    let message: string;
    el.resultFiles.replaceChildren();
    if (result.kind === 'pdf') {
      message = m.result.pdf(result.file.pages, size(result.blob.size));
      el.resultDetails.hidden = true;
    } else {
      message = m.result.zip(result.files.length, size(result.blob.size));
      for (const info of result.files.slice(0, MAX_LISTED_FILES)) {
        const fragment = el.resultFileTemplate.content.cloneNode(true) as DocumentFragment;
        const name = query<HTMLElement>(fragment, '[data-result-file-name]');
        name.textContent = info.name;
        name.title = info.name;
        query<HTMLElement>(fragment, '[data-result-file-meta]').textContent = m.result.fileMeta(info.pages, size(info.size));
        el.resultFiles.append(fragment);
      }
      const hidden = result.files.length - MAX_LISTED_FILES;
      if (hidden > 0) {
        const more = document.createElement('li');
        more.className = 'px-3 py-2 text-zinc-600 dark:text-zinc-400';
        more.textContent = m.result.moreFiles(hidden);
        el.resultFiles.append(more);
      }
      el.resultSummary.textContent = m.actions.zipFiles(result.files.length);
      el.resultDetails.open = false;
      el.resultDetails.hidden = false;
    }
    el.resultText.textContent = message;
    el.result.hidden = false;
    // The result says what was created; the plan would repeat it and make the sticky bar taller.
    el.plan.hidden = true;
    return message;
  }

  // ---------------------------------------------------------------- loading

  function describeLoadError(error: unknown, name: string): string {
    if (error instanceof PdfEngineLoadError) return m.errors.engine;
    if (error instanceof FileReadError) return m.errors.read(name);
    const coded = error as CodedError | null;
    if (coded?.name === 'PdfPasswordError') return m.errors.password;
    if (coded?.name === 'PdfInvalidError') {
      if (coded.code === 'not-pdf') return m.errors.notPdf(name);
      if (coded.code === 'no-pages') return m.errors.noPages(name);
      return m.errors.damaged(name);
    }
    if (looksLikeOutOfMemory(error)) return m.errors.memoryReading(name);
    return m.errors.damaged(name);
  }

  /** Loading the chosen file failed: back to the empty state, with the reason next to the picker. */
  function failLoad(message: string): void {
    // Checked before hiding: a hidden element can still be document.activeElement for a moment.
    const refocus = el.fileCard.contains(document.activeElement) || focusIsLost();
    engine.dispose(); // free the worker and anything it still holds
    resetGrid();
    file = null;
    pageCount = 0;
    phase = 'empty';
    removeNotice('large-file');
    updateUi();
    renderPlan();
    setLoadError(message);
    announce(message);
    if (refocus) el.input.focus();
  }

  /** A pick that is not usable at all (not a PDF, unreadable): any file already loaded stays. */
  function rejectPick(message: string): void {
    setLoadError(message);
    announce(message);
    if (focusIsLost()) (phase === 'empty' ? el.input : el.chooseAnother).focus();
  }

  let pickCounter = 0;

  /** The phase can change while a pick is checked; a function call avoids TypeScript's stale narrowing. */
  function isSplitting(): boolean {
    return phase === 'splitting';
  }

  async function openFile(next: File): Promise<void> {
    if (phase === 'splitting') return;
    const pick = ++pickCounter;
    const name = next.name || m.file.unnamed;

    // Check the signature first: no reason to load the engine for a photo or a Word file.
    let head: Uint8Array;
    try {
      head = new Uint8Array(await next.slice(0, PDF_SIGNATURE_WINDOW).arrayBuffer());
    } catch (error) {
      if (pick === pickCounter && !isSplitting()) rejectPick(describeLoadError(new FileReadError(error), name));
      return;
    }
    if (pick !== pickCounter || isSplitting()) return;
    if (!hasPdfSignature(head)) {
      rejectPick(m.errors.notPdf(name));
      return;
    }

    // From here on the new file replaces the current one.
    const generation = ++loadGeneration;
    loadController?.abort();
    const controller = new AbortController();
    loadController = controller;
    const active = document.activeElement;
    const refocus = el.dropzone.contains(active) || el.workspace.contains(active) || focusIsLost();

    hideResult();
    setStatus('');
    setLoadError('');
    resetGrid();
    file = next;
    pageCount = 0;
    // A page selection belongs to one document; the mode and "pages per file" are settings and stay.
    lastRanges = [];
    el.pages.value = '';
    phase = 'loading';
    el.fileName.textContent = name;
    el.fileName.title = name;
    el.fileMeta.textContent = m.file.reading(size(next.size));
    el.basename.value = outputBaseName(name, m.outputNames.fallbackBase);
    removeNotice('large-file');
    updateUi();
    renderPlan();
    // The picker (or the workspace) is hidden now: keep keyboard focus on the file card.
    if (refocus) el.fileName.focus();
    announce(m.status.reading(name));

    if (coarsePointer && next.size > LARGE_FILE_BYTES_TOUCH) {
      showNotice('large-file', m.status.largeFile(size(next.size)));
    }

    try {
      const summary = await engine.load(next, controller.signal);
      if (generation !== loadGeneration) return;
      pageCount = summary.pageCount;
      phase = 'ready';
      el.fileMeta.textContent = m.file.summary(pageCount, size(next.size));
      setupGrid(next, summary);
      updateUi();
      const plan = renderPlan();
      const planSummary = plan?.ok ? summarizePlan(plan.outputs) : null;
      announce(`${m.status.loaded(name, pageCount)}${planSummary ? ` ${m.plan.summary(planSummary)}.` : ''}`);
    } catch (error) {
      if (generation !== loadGeneration || isAbortError(error)) return;
      console.error('Split PDF: could not load the file:', error);
      failLoad(describeLoadError(error, name));
    } finally {
      if (loadController === controller) loadController = null;
    }
  }

  function handleFiles(list: readonly File[]): void {
    if (phase === 'splitting' || list.length === 0) return;
    const chosen = list.find((candidate) => /\.pdf$/i.test(candidate.name) || candidate.type === 'application/pdf') ?? list[0]!;
    if (list.length > 1) {
      showNotice('one-file', m.status.oneAtATime(chosen.name || m.file.unnamed));
    } else {
      removeNotice('one-file');
    }
    void openFile(chosen);
  }

  el.input.addEventListener('change', () => {
    const files = Array.from(el.input.files ?? []);
    el.input.value = ''; // allow picking the same file again
    handleFiles(files);
  });

  el.chooseAnother.addEventListener('click', () => {
    if (phase === 'splitting') return;
    el.input.click();
  });

  let dragDepth = 0;
  function dropTarget(): HTMLElement {
    return phase === 'empty' ? el.dropzone : el.fileCard;
  }
  function clearDragover(): void {
    delete el.dropzone.dataset.dragover;
    delete el.fileCard.dataset.dragover;
  }
  root.addEventListener('dragenter', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth++;
    if (phase !== 'splitting') dropTarget().dataset.dragover = '';
  });
  root.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = phase === 'splitting' ? 'none' : 'copy';
  });
  root.addEventListener('dragleave', (event) => {
    if (!hasFiles(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) clearDragover();
  });
  root.addEventListener('drop', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth = 0;
    clearDragover();
    if (event.dataTransfer) handleFiles(Array.from(event.dataTransfer.files));
  });

  // ---------------------------------------------------------------- options

  el.options.addEventListener('input', () => {
    invalidateResult();
    renderPlan();
  });
  el.options.addEventListener('change', (event) => {
    invalidateResult();
    const plan = renderPlan();
    if ((event.target as Element).matches('input[data-mode]') && plan?.ok) {
      const summary = summarizePlan(plan.outputs);
      if (summary) announce(m.plan.summary(summary));
    }
  });

  for (const field of [el.pages, el.every, el.basename]) {
    field.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing) return;
      event.preventDefault();
      void run();
    });
  }

  // Tidy the name once editing is done (typing is left alone).
  el.basename.addEventListener('blur', () => {
    const base = outputBaseName(el.basename.value, m.outputNames.fallbackBase);
    if (el.basename.value !== base) {
      el.basename.value = base;
      renderPlan();
    }
  });

  // ---------------------------------------------------------------- split

  function progressText({ stage, done, total }: SplitProgress): string {
    if (stage === 'reading') return m.progress.reading;
    if (stage === 'zipping') return m.progress.zipping;
    return total > 1 ? m.progress.creatingMany(Math.min(done + 1, total), total) : m.progress.creatingOne;
  }

  function describeSplitError(error: unknown): string {
    const name = file?.name || m.file.unnamed;
    if (error instanceof PdfEngineLoadError) return m.errors.engine;
    if (error instanceof FileReadError) return m.errors.readAgain(name);
    const coded = error as CodedError | null;
    if (coded?.name === 'PdfPasswordError') return m.errors.password;
    if (coded?.name === 'ZipLimitError' && coded.code && ZIP_LIMIT_CODES.includes(coded.code)) {
      return m.errors.zip(coded.code as ZipLimitCode, coded.count ?? 0, coded.limit ?? 0);
    }
    if (coded?.name === 'PdfInvalidError') return m.errors.damaged(name);
    if (looksLikeOutOfMemory(error)) return m.errors.memory;
    return m.errors.splitFailed;
  }

  async function run(): Promise<void> {
    if (phase !== 'ready' || !file) return;
    const plan = renderPlan(true);
    if (!plan || !plan.ok) {
      const mode = currentMode();
      const field = mode === 'every' ? el.every : mode === 'single' ? null : el.pages;
      field?.focus();
      announce(plan && !plan.ok ? m.rangeError(plan.error) : m.status.chooseFirst);
      return;
    }

    hideResult();
    setStatus('');
    const base = outputBaseName(el.basename.value, m.outputNames.fallbackBase);
    el.basename.value = base;
    const outputs = plan.outputs;
    const total = outputs.length;

    const controller = new AbortController();
    splitController = controller;
    const focusWasOnRun = document.activeElement === el.run;
    phase = 'splitting';
    updateUi();
    if (focusWasOnRun) el.cancel.focus();
    setProgress(0, total, progressText({ stage: 'creating', done: 0, total }));
    announce(m.progress.starting(total));

    try {
      const result = await engine.split(
        outputs.map(({ filename, indices }) => ({ filename, indices })),
        {
          signal: controller.signal,
          onProgress: (progress) => {
            if (controller.signal.aborted) return;
            const done = progress.stage === 'zipping' ? progress.total : progress.done;
            setProgress(done, progress.total, progressText(progress));
            if (progress.stage === 'zipping') announce(m.progress.zipping);
          },
        },
      );
      if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const downloadName = result.kind === 'zip' ? zipFilename(base, m.outputNames) : result.file.name;
      saveBlob(result.blob, downloadName);
      announce(showResult(result, downloadName));
    } catch (error) {
      if (isAbortError(error)) {
        setStatus(m.actions.cancelled);
        announce(m.actions.cancelled);
      } else {
        console.error('Split PDF failed:', error);
        const message = describeSplitError(error);
        setStatus(message, 'error');
        announce(message);
      }
    } finally {
      if (splitController === controller) splitController = null;
      const focusWasOnCancel = document.activeElement === el.cancel;
      phase = file ? 'ready' : 'empty';
      updateUi();
      if (focusWasOnCancel || focusIsLost()) {
        if (!el.result.hidden) el.downloadAgain.focus();
        else el.run.focus();
      }
    }
  }

  el.run.addEventListener('click', () => {
    void run();
  });

  el.cancel.addEventListener('click', () => {
    if (!splitController) return;
    splitController.abort();
    el.progressText.textContent = m.actions.cancelling;
  });

  // ---------------------------------------------------------------- lifecycle

  // Lets focus scrolling keep controls clear of the sticky action bar (scroll-padding-bottom).
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      const sticky = getComputedStyle(el.actionBar).position === 'sticky';
      const height = sticky ? Math.ceil(el.actionBar.getBoundingClientRect().height) + 16 : 0;
      document.documentElement.style.setProperty('--pds-action-bar-height', `${height}px`);
    }).observe(el.actionBar);
  }

  window.addEventListener('pagehide', (event) => {
    // A page kept in the back/forward cache may be shown again with its download link and previews.
    if (event.persisted) return;
    revokeResult();
    resetGrid();
    engine.dispose();
  });

  updateUi();
  renderPlan();
}
