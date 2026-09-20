/**
 * Split PDF: DOM wiring and state (browser only). Everything happens on the device;
 * nothing is uploaded. pdf-lib lives in the worker behind ./split-engine.ts and is never
 * imported here.
 */

import { formatBytes } from '../../../lib/files/filename.ts';
import { saveBlob } from '../../../lib/download.ts';
import {
  PDF_SIGNATURE_WINDOW,
  hasPdfSignature,
  outputBaseName,
  planOutputs,
  summarizePlan,
  zipFilename,
} from '../../../lib/pdf/page-ranges.ts';
import type { PlanResult, SplitMode } from '../../../lib/pdf/page-ranges.ts';
import { FileReadError, PdfEngineLoadError, WorkerCrashError, createSplitEngine } from './split-engine.ts';
import type { SplitProgress, SplitResult } from './split-engine.ts';

/**
 * empty: no file · loading: reading/parsing a file · ready: file parsed, options editable ·
 * splitting: creating the outputs (options locked, Cancel shown).
 */
type Phase = 'empty' | 'loading' | 'ready' | 'splitting';

const MODES: readonly SplitMode[] = ['extract', 'ranges', 'every', 'single'];
/** Files above this size get a memory warning on touch devices (phones and tablets). */
const LARGE_FILE_BYTES_TOUCH = 100 * 1024 * 1024;
const MAX_LISTED_FILES = 50;

const MESSAGES = {
  engine: 'Couldn’t load the PDF engine — check your connection and reload the page.',
  memory: 'This device ran out of memory. Try creating fewer files at once, or use a computer for very large PDFs.',
} as const;

function plural(count: number, word: string): string {
  return `${count.toLocaleString('en-US')} ${word}${count === 1 ? '' : 's'}`;
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : '';
}

function looksLikeOutOfMemory(error: unknown): boolean {
  if (error instanceof WorkerCrashError) return true;
  if (!(error instanceof Error)) return false;
  return error.name === 'RangeError' && /alloc|memory|array length|buffer/i.test(error.message);
}

/** Errors whose message is already written for people (from src/lib/pdf/split-pdf.ts and zip-store.ts). */
function hasFriendlyMessage(error: unknown): boolean {
  return ['PdfPasswordError', 'PdfInvalidError', 'ZipLimitError'].includes(errorName(error));
}

function hasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return !!types && Array.from(types).includes('Files');
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
    options: query<HTMLFieldSetElement>(root, '[data-options]'),
    modes: Array.from(root.querySelectorAll<HTMLInputElement>('input[data-mode]')),
    pagesField: query<HTMLElement>(root, '[data-pages-field]'),
    pagesLabel: query<HTMLElement>(root, '[data-pages-label]'),
    pages: query<HTMLInputElement>(root, '[data-pages]'),
    pagesHint: query<HTMLElement>(root, '[data-pages-hint]'),
    pagesError: query<HTMLElement>(root, '[data-pages-error]'),
    everyField: query<HTMLElement>(root, '[data-every-field]'),
    every: query<HTMLInputElement>(root, '[data-every]'),
    everyError: query<HTMLElement>(root, '[data-every-error]'),
    plan: query<HTMLElement>(root, '[data-plan]'),
    basename: query<HTMLInputElement>(root, '[data-basename]'),
    nameHint: query<HTMLElement>(root, '[data-name-hint]'),
    actionBar: query<HTMLElement>(root, '[data-action-bar]'),
    run: query<HTMLButtonElement>(root, '[data-run]'),
    cancel: query<HTMLButtonElement>(root, '[data-cancel]'),
    progressBlock: query<HTMLElement>(root, '[data-progress-block]'),
    progress: query<HTMLProgressElement>(root, '[data-progress]'),
    progressText: query<HTMLElement>(root, '[data-progress-text]'),
    status: query<HTMLElement>(root, '[data-status]'),
    result: query<HTMLElement>(root, '[data-result]'),
    resultText: query<HTMLElement>(root, '[data-result-text]'),
    downloadAgain: query<HTMLAnchorElement>(root, '[data-download-again]'),
    resultFiles: query<HTMLUListElement>(root, '[data-result-files]'),
    resultFileTemplate: query<HTMLTemplateElement>(root, 'template[data-result-file-template]'),
  };
}

export function initPdfSplit(root: HTMLElement): void {
  if (root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

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

  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;

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
    return planOutputs(mode, input, pageCount, el.basename.value);
  }

  function setFieldError(input: HTMLInputElement, output: HTMLElement, message: string): void {
    output.textContent = message;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  /**
   * Updates the mode-dependent fields, inline errors and the plan preview.
   * Errors for an empty field only appear once the person tries to run (`showEmptyErrors`).
   */
  function renderPlan(showEmptyErrors = false): PlanResult | null {
    const mode = currentMode();
    const usesPages = mode === 'extract' || mode === 'ranges';
    el.pagesField.hidden = !usesPages;
    el.everyField.hidden = mode !== 'every';
    el.pagesLabel.textContent = mode === 'extract' ? 'Pages to extract' : 'Page ranges';
    el.pagesHint.textContent =
      mode === 'extract'
        ? 'In the order you want them, e.g. 1-3, 5, 8- (8- means page 8 to the end).'
        : 'Each range becomes its own PDF, e.g. 1-4, 5-8, 9-end.';
    el.run.textContent = mode === 'extract' ? 'Extract pages' : 'Split PDF';

    const plan = file && pageCount > 0 ? computePlan(mode) : null;
    let pagesError = '';
    let everyError = '';
    let prompt = '';
    if (plan && !plan.ok) {
      const field = mode === 'every' ? el.every : el.pages;
      const empty = field.value.trim() === '' && !field.validity.badInput;
      if (!empty || showEmptyErrors) {
        if (mode === 'every') everyError = plan.error;
        else pagesError = plan.error;
      } else {
        prompt = mode === 'every' ? 'Enter how many pages each file should have.' : 'Enter the pages to see what will be created.';
      }
    }
    setFieldError(el.pages, el.pagesError, usesPages ? pagesError : '');
    setFieldError(el.every, el.everyError, mode === 'every' ? everyError : '');

    el.plan.textContent = plan?.ok ? summarizePlan(plan.outputs) : prompt;

    const base = outputBaseName(el.basename.value);
    if (plan?.ok && plan.outputs.length === 1) {
      el.nameHint.textContent = `Saves as ${plan.outputs[0]!.filename}`;
    } else if (plan?.ok) {
      el.nameHint.textContent = `Saves as ${zipFilename(base)}, with ${plural(plan.outputs.length, 'PDF')} inside`;
    } else {
      el.nameHint.textContent = `New files are named like ${base}-pages-1-3.pdf`;
    }
    return plan;
  }

  // ---------------------------------------------------------------- ui

  function updateUi(): void {
    const splitting = phase === 'splitting';
    const hasFile = phase !== 'empty';
    el.dropzone.hidden = hasFile;
    el.fileCard.hidden = !hasFile;
    el.input.disabled = splitting;
    el.chooseAnother.disabled = splitting;
    el.options.disabled = splitting;
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
    el.downloadAgain.removeAttribute('href');
    el.resultFiles.replaceChildren();
    el.resultFiles.hidden = true;
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
      message = `Your PDF is ready — ${plural(result.file.pages, 'page')} · ${formatBytes(result.blob.size)}`;
      el.resultFiles.hidden = true;
    } else {
      message = `${plural(result.files.length, 'PDF')} · ${formatBytes(result.blob.size)} in a ZIP`;
      for (const info of result.files.slice(0, MAX_LISTED_FILES)) {
        const fragment = el.resultFileTemplate.content.cloneNode(true) as DocumentFragment;
        const name = query<HTMLElement>(fragment, '[data-result-file-name]');
        name.textContent = info.name;
        name.title = info.name;
        query<HTMLElement>(fragment, '[data-result-file-meta]').textContent =
          `${plural(info.pages, 'page')} · ${formatBytes(info.size)}`;
        el.resultFiles.append(fragment);
      }
      const hidden = result.files.length - MAX_LISTED_FILES;
      if (hidden > 0) {
        const more = document.createElement('li');
        more.className = 'px-3 py-2 text-zinc-600 dark:text-zinc-400';
        more.textContent = `and ${plural(hidden, 'more file')} in the ZIP`;
        el.resultFiles.append(more);
      }
      el.resultFiles.hidden = false;
    }
    el.resultText.textContent = message;
    el.result.hidden = false;
    return message;
  }

  // ---------------------------------------------------------------- loading

  function describeLoadError(error: unknown, name: string): string {
    if (error instanceof PdfEngineLoadError) return MESSAGES.engine;
    if (error instanceof FileReadError) return `Couldn’t read “${name}”. It may have been moved or changed — choose it again.`;
    if (hasFriendlyMessage(error)) return (error as Error).message;
    if (looksLikeOutOfMemory(error)) return `This device ran out of memory while reading “${name}”. Try on a computer.`;
    return `Couldn’t open “${name}”. The file may be damaged.`;
  }

  /** Loading the chosen file failed: back to the empty state, with the reason next to the picker. */
  function failLoad(message: string): void {
    // Checked before hiding: a hidden element can still be document.activeElement for a moment.
    const refocus = el.fileCard.contains(document.activeElement) || focusIsLost();
    engine.dispose(); // free the worker and anything it still holds
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
    const name = next.name || 'Unnamed file';

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
      rejectPick(`“${name}” isn’t a PDF. Choose a PDF file.`);
      return;
    }

    // From here on the new file replaces the current one.
    const generation = ++loadGeneration;
    loadController?.abort();
    const controller = new AbortController();
    loadController = controller;
    const refocus = el.dropzone.contains(document.activeElement) || focusIsLost();

    hideResult();
    setStatus('');
    setLoadError('');
    file = next;
    pageCount = 0;
    phase = 'loading';
    el.fileName.textContent = name;
    el.fileName.title = name;
    el.fileMeta.textContent = `${formatBytes(next.size)} · Reading PDF…`;
    el.basename.value = outputBaseName(name);
    removeNotice('large-file');
    updateUi();
    renderPlan();
    // The picker (inside the dropzone) is hidden now: keep keyboard focus on the file card.
    if (refocus) el.fileName.focus();
    announce(`Reading ${name}…`);

    if (coarsePointer && next.size > LARGE_FILE_BYTES_TOUCH) {
      showNotice(
        'large-file',
        `Large file (${formatBytes(next.size)}). Splitting it needs a lot of memory, so on a phone or tablet the page may reload. If that happens, use a computer.`,
      );
    }

    try {
      const summary = await engine.load(next, controller.signal);
      if (generation !== loadGeneration) return;
      pageCount = summary.pageCount;
      phase = 'ready';
      el.fileMeta.textContent = `${plural(pageCount, 'page')} · ${formatBytes(next.size)}`;
      updateUi();
      const plan = renderPlan();
      announce(`Loaded ${name}: ${plural(pageCount, 'page')}.${plan?.ok ? ` ${summarizePlan(plan.outputs)}.` : ''}`);
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
      showNotice('one-file', `One PDF at a time: using “${chosen.name || 'Unnamed file'}”.`);
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
    if ((event.target as Element).matches('input[data-mode]') && plan?.ok) announce(summarizePlan(plan.outputs));
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
    const base = outputBaseName(el.basename.value);
    if (el.basename.value !== base) {
      el.basename.value = base;
      renderPlan();
    }
  });

  // ---------------------------------------------------------------- split

  function progressText({ stage, done, total }: SplitProgress): string {
    if (stage === 'reading') return 'Reading PDF…';
    if (stage === 'zipping') return 'Packing ZIP…';
    const count = (value: number) => value.toLocaleString('en-US');
    return total > 1 ? `Creating file ${count(Math.min(done + 1, total))} of ${count(total)}…` : 'Creating PDF…';
  }

  function describeSplitError(error: unknown): string {
    const name = file?.name || 'the file';
    if (error instanceof PdfEngineLoadError) return MESSAGES.engine;
    if (error instanceof FileReadError) return `Couldn’t read “${name}” again. It may have been moved or changed — choose it again.`;
    if (hasFriendlyMessage(error)) return (error as Error).message;
    if (looksLikeOutOfMemory(error)) return MESSAGES.memory;
    return 'Something went wrong while splitting the PDF. The file may be damaged.';
  }

  async function run(): Promise<void> {
    if (phase !== 'ready' || !file) return;
    const plan = renderPlan(true);
    if (!plan || !plan.ok) {
      const mode = currentMode();
      const field = mode === 'every' ? el.every : mode === 'single' ? null : el.pages;
      field?.focus();
      announce(plan && !plan.ok ? plan.error : 'Choose a PDF first');
      return;
    }

    hideResult();
    setStatus('');
    const base = outputBaseName(el.basename.value);
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
    announce(total > 1 ? `Creating ${plural(total, 'file')}…` : 'Creating PDF…');

    try {
      const result = await engine.split(
        outputs.map(({ filename, indices }) => ({ filename, indices })),
        {
          signal: controller.signal,
          onProgress: (progress) => {
            if (controller.signal.aborted) return;
            const done = progress.stage === 'zipping' ? progress.total : progress.done;
            setProgress(done, progress.total, progressText(progress));
            if (progress.stage === 'zipping') announce('Packing ZIP…');
          },
        },
      );
      if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const downloadName = result.kind === 'zip' ? zipFilename(base) : result.file.name;
      saveBlob(result.blob, downloadName);
      announce(showResult(result, downloadName));
    } catch (error) {
      if (isAbortError(error)) {
        setStatus('Cancelled.');
        announce('Cancelled');
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
    el.progressText.textContent = 'Cancelling…';
  });

  // ---------------------------------------------------------------- lifecycle

  // Lets focus scrolling keep controls clear of the sticky action bar (scroll-padding-bottom).
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      const height = Math.ceil(el.actionBar.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--pds-action-bar-height', `${height}px`);
    }).observe(el.actionBar);
  }

  window.addEventListener('pagehide', (event) => {
    // A page kept in the back/forward cache may be shown again with its download link.
    if (event.persisted) return;
    revokeResult();
    engine.dispose();
  });

  updateUi();
  renderPlan();
}
