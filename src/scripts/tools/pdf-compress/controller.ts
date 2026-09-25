/**
 * Compress PDF: DOM wiring and state (browser only).
 * Everything happens on the device; nothing is uploaded.
 *
 * Interface text comes from src/i18n/tools/pdf-compress.ts in the page's language
 * (<html lang>). The worker, the engine and the libraries report codes; this file is the one
 * place that turns them into sentences. Console messages stay in English for developers.
 */

import { getPageLocale } from '../../../i18n/client.ts';
import { formatters } from '../../../i18n/format.ts';
import { pdfCompressMessages } from '../../../i18n/tools/pdf-compress.ts';
import { saveBlob } from '../../../lib/download.ts';
import { toPdfFilename } from '../../../lib/files/filename.ts';
import type { CompressProgress, CompressStats, PdfSummary, TranscodeRequest } from '../../../lib/pdf/compress/compress-pdf.ts';
import { compressOutcome, displayedSaving, imageOutlook } from '../../../lib/pdf/compress/outcome.ts';
import type { CompressOutcome } from '../../../lib/pdf/compress/outcome.ts';
import { DEFAULT_LEVEL, isCompressionLevel } from '../../../lib/pdf/compress/plan.ts';
import type { CompressionLevel } from '../../../lib/pdf/compress/plan.ts';
import { PDF_SNIFF_BYTES, compressedBaseName, looksLikePdf } from '../../../lib/pdf/compress/sniff.ts';
import { CompressEngineLoadError, CompressFailure, openCompressSession } from './compress-engine.ts';
import type { CompressSession } from './compress-engine.ts';
import { canvasReadbackWorks, transcodeOnPage } from './transcode.ts';

/**
 * empty: no file · opening: reading and parsing a new file · ready: file loaded (a result
 * may be shown) · compressing: a run is in progress (it may re-open the file first).
 */
type Phase = 'empty' | 'opening' | 'ready' | 'compressing';
type NoticeTone = 'info' | 'warning';

/** Files above this size get a memory warning on touch devices (phones and tablets). */
const LARGE_FILE_BYTES_TOUCH = 100 * 1024 * 1024;
/** Largest image (in pixels) decoded for recompression; phones have far less memory. */
const MAX_IMAGE_PIXELS = { touch: 30_000_000, other: 100_000_000 };
/** In-app browsers (social apps) that often ignore downloads of generated files. */
const IN_APP_BROWSER = /FBAN|FBAV|Instagram|LinkedInApp|Line\/|Snapchat|musical_ly|BytedanceWebview/i;

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

function errorName(error: unknown): string {
  return typeof error === 'object' && error !== null ? String((error as { name?: unknown }).name ?? '') : '';
}

function looksLikeOutOfMemory(error: unknown): boolean {
  if (error instanceof CompressFailure) {
    if (error.code === 'crashed') return true;
    if (error.originalName === 'RangeError') return true;
  }
  if (error instanceof RangeError) return true;
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /out of memory|allocation failed|array buffer allocation/i.test(text);
}

/** The picked File can no longer be read (moved, deleted, or permission expired). */
function isUnreadableFile(error: unknown): boolean {
  const name = errorName(error);
  return name === 'NotReadableError' || name === 'NotFoundError' || name === 'SecurityError';
}

function hasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return !!types && Array.from(types).includes('Files');
}

let pageDropGuardInstalled = false;

/** Dropping a file outside the tool would navigate away and lose the loaded PDF. */
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
  if (!element) throw new Error(`Compress PDF: missing element ${selector}`);
  return element;
}

function getElements(root: HTMLElement) {
  return {
    announcer: query<HTMLElement>(root, '[data-announcer]'),
    dropzone: query<HTMLLabelElement>(root, '[data-dropzone]'),
    input: query<HTMLInputElement>(root, '[data-file-input]'),
    dropzoneTitle: query<HTMLElement>(root, '[data-dropzone-title]'),
    notices: query<HTMLElement>(root, '[data-notices]'),
    noticeTemplate: query<HTMLTemplateElement>(root, 'template[data-notice-template]'),
    fileCard: query<HTMLElement>(root, '[data-file-card]'),
    fileName: query<HTMLElement>(root, '[data-file-name]'),
    fileMeta: query<HTMLElement>(root, '[data-file-meta]'),
    fileImages: query<HTMLElement>(root, '[data-file-images]'),
    removeFile: query<HTMLButtonElement>(root, '[data-remove-file]'),
    options: query<HTMLFieldSetElement>(root, '[data-options]'),
    levels: Array.from(root.querySelectorAll<HTMLInputElement>('input[data-level]')),
    stripMetadata: query<HTMLInputElement>(root, '[data-strip-metadata]'),
    actionBar: query<HTMLElement>(root, '[data-action-bar]'),
    compress: query<HTMLButtonElement>(root, '[data-compress]'),
    cancel: query<HTMLButtonElement>(root, '[data-cancel]'),
    progressBlock: query<HTMLElement>(root, '[data-progress-block]'),
    progress: query<HTMLProgressElement>(root, '[data-progress]'),
    progressText: query<HTMLElement>(root, '[data-progress-text]'),
    status: query<HTMLElement>(root, '[data-status]'),
    result: query<HTMLElement>(root, '[data-result]'),
    resultTitle: query<HTMLElement>(root, '[data-result-title]'),
    barOriginal: query<HTMLElement>(root, '[data-bar-original]'),
    barOriginalLabel: query<HTMLElement>(root, '[data-bar-original-label]'),
    barResult: query<HTMLElement>(root, '[data-bar-result]'),
    barResultLabel: query<HTMLElement>(root, '[data-bar-result-label]'),
    resultDetails: query<HTMLElement>(root, '[data-result-details]'),
    download: query<HTMLAnchorElement>(root, '[data-download]'),
    downloadLabel: query<HTMLElement>(root, '[data-download-label]'),
  };
}

export function initPdfCompress(root: HTMLElement): void {
  if (root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const el = getElements(root);
  const locale = getPageLocale();
  const m = pdfCompressMessages[locale];
  const f = formatters(locale);

  let phase: Phase = 'empty';
  let file: File | null = null;
  let summary: PdfSummary | null = null;
  let session: CompressSession | null = null;
  /** Aborts the file currently being opened (a new pick or Remove supersedes it). */
  let openController: AbortController | null = null;
  let runController: AbortController | null = null;
  /** Incremented whenever the loaded file changes, so stale async work is ignored. */
  let fileGeneration = 0;
  /** Incremented per pick: only the latest pick may replace the file once it passes the PDF check. */
  let pickGeneration = 0;
  let resultUrl: string | null = null;
  let announceTimer = 0;

  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const maxImagePixels = coarsePointer ? MAX_IMAGE_PIXELS.touch : MAX_IMAGE_PIXELS.other;
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

  function selectedLevel(): CompressionLevel {
    const value = el.levels.find((input) => input.checked)?.value;
    return isCompressionLevel(value) ? value : DEFAULT_LEVEL;
  }

  // ---------------------------------------------------------------- notices

  function showNotice(options: { key: string; tone: NoticeTone; message: string }): void {
    removeNotice(options.key);
    const fragment = el.noticeTemplate.content.cloneNode(true) as DocumentFragment;
    const notice = query<HTMLElement>(fragment, '[data-notice]');
    notice.dataset.tone = options.tone;
    notice.dataset.key = options.key;
    query<HTMLElement>(notice, '[data-notice-message]').textContent = options.message;
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
    const notice = dismiss.closest<HTMLElement>('[data-notice]');
    const next =
      notice?.nextElementSibling?.querySelector<HTMLElement>('[data-notice-dismiss]') ??
      notice?.previousElementSibling?.querySelector<HTMLElement>('[data-notice-dismiss]');
    notice?.remove();
    (next ?? el.input).focus();
  });

  // ---------------------------------------------------------------- rendering

  /** What the chosen level can do with the loaded PDF's images (no full stop). */
  function imagesText(level: CompressionLevel): string {
    if (!summary) return '';
    const outlook = imageOutlook(summary.imageCounts, level);
    switch (outlook.kind) {
      case 'recompressible':
        return m.outlook.recompressible(outlook.count, outlook.level);
      case 'lossless-only':
        return m.outlook.losslessOnly(outlook.count);
      default:
        return m.outlook.none;
    }
  }

  function updateUi(): void {
    const compressing = phase === 'compressing';
    const hasFile = file !== null;

    if (hasFile) el.dropzone.dataset.compact = '';
    else delete el.dropzone.dataset.compact;
    el.dropzoneTitle.textContent = hasFile ? m.chooseAnother : m.chooseFile;
    el.input.disabled = compressing;
    if (compressing) el.dropzone.dataset.disabled = '';
    else delete el.dropzone.dataset.disabled;

    el.fileCard.hidden = !hasFile;
    if (file) {
      el.fileName.textContent = file.name || m.untitled;
      el.fileName.title = file.name;
      const parts = [f.bytes(file.size)];
      if (summary) parts.push(m.pages(summary.pageCount));
      else if (phase === 'opening') parts.push(m.readingPdf);
      el.fileMeta.textContent = parts.join(' · ');
      el.fileImages.textContent = imagesText(selectedLevel());
      el.fileImages.hidden = !summary;
    }
    el.removeFile.disabled = compressing;

    el.options.disabled = compressing;
    el.compress.disabled = phase !== 'ready';
    el.cancel.hidden = !compressing;
    el.progressBlock.hidden = !compressing;
  }

  // ---------------------------------------------------------------- result

  function revokeResult(): void {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = null;
  }

  function hideResult(): void {
    revokeResult();
    el.result.hidden = true;
    el.download.hidden = true;
    el.download.removeAttribute('href');
  }

  /** "54%" / "%54"; a smaller file never shows as 100% smaller. */
  function percent(saving: number): string {
    return f.percent(displayedSaving(saving));
  }

  /** "Balanced level · 3 of 12 images recompressed · metadata removed" (no full stop). */
  function detailsText(stats: CompressStats, outcome: CompressOutcome): string {
    const parts = [m.details.level(stats.level)];
    if (stats.imagesConsidered === 0) {
      parts.push(outcome.skippedAtLight > 0 ? m.details.noJpegPhotos : m.details.noLargeImages);
    } else {
      parts.push(m.details.recompressed(stats.imagesReplaced, stats.imagesConsidered));
    }
    if (stats.duplicatesMerged > 0) parts.push(m.details.duplicatesMerged(stats.duplicatesMerged));
    if (stats.metadataRemoved) parts.push(m.details.metadataRemoved);
    return parts.join(' · ');
  }

  function hintText(outcome: CompressOutcome): string {
    switch (outcome.hint) {
      case 'convert-lossless':
        return m.hints['convert-lossless'](outcome.skippedAtLight);
      case 'stronger-level':
      case 'text-only':
        return m.hints[outcome.hint];
      default:
        return '';
    }
  }

  /** Joins sentences that already end with their own punctuation. */
  function sentences(...parts: string[]): string {
    return parts.filter(Boolean).join(' ');
  }

  /** Shows the result and returns what to announce (a separate message, written to be heard). */
  function showResult(blob: Blob, filename: string, originalSize: number, stats: CompressStats): string {
    revokeResult();
    const size = blob.size;
    const outcome = compressOutcome(originalSize, size, stats, summary?.imageCounts.balanced ?? 0);
    const largest = Math.max(originalSize, size, 1);
    const originalText = f.bytes(originalSize);
    const sizeText = f.bytes(size);

    el.barOriginal.style.width = `${Math.max(1, (originalSize / largest) * 100)}%`;
    el.barResult.style.width = `${Math.max(1, (size / largest) * 100)}%`;
    el.barOriginalLabel.textContent = originalText;
    el.barResultLabel.textContent = sizeText;

    const sizes = m.sizes(originalText, sizeText);
    const details = detailsText(stats, outcome);
    let announcement: string;
    if (outcome.kind === 'smaller') {
      el.result.dataset.tone = 'success';
      el.resultTitle.textContent = `${sizes} ${m.changeSmaller(percent(outcome.saving))}`;
      el.resultDetails.textContent = sentences(`${details}.`, m.downloadStarted, inAppBrowser ? m.inAppDownloadHint : '');
      el.downloadLabel.textContent = m.downloadAgain;
      announcement = m.smallerAnnouncement(originalText, sizeText, percent(outcome.saving));
    } else {
      el.result.dataset.tone = 'neutral';
      const text = m.notSmaller[outcome.kind];
      el.resultTitle.textContent = text.title;
      const change =
        outcome.change === 'smaller'
          ? m.changeSmaller(percent(outcome.saving))
          : outcome.change === 'larger'
            ? m.changeLarger
            : '';
      const hint = hintText(outcome);
      el.resultDetails.textContent = sentences(`${sentences(sizes, change)} · ${details}.`, hint);
      el.downloadLabel.textContent = m.downloadAnyway;
      announcement = sentences(text.announcement, m.sizesSpoken(originalText, sizeText), hint);
    }

    if (outcome.offerDownload) {
      resultUrl = URL.createObjectURL(blob);
      el.download.href = resultUrl;
      el.download.download = filename;
    }
    el.download.hidden = !outcome.offerDownload;
    el.result.hidden = false;
    if (outcome.kind === 'smaller') saveBlob(blob, filename);
    return announcement;
  }

  // ---------------------------------------------------------------- file

  function closeSession(): void {
    openController?.abort();
    openController = null;
    session?.dispose();
    session = null;
  }

  async function openSession(picked: File, signal: AbortSignal): Promise<CompressSession> {
    const bytes = await picked.arrayBuffer();
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    return openCompressSession(bytes, maxImagePixels, signal);
  }

  function describeOpenError(error: unknown, fileName: string): string {
    if (error instanceof CompressEngineLoadError) return m.errors.engine;
    if (error instanceof CompressFailure && error.code === 'encrypted') return m.errors.encrypted(fileName);
    if (error instanceof CompressFailure && error.code === 'invalid') return m.errors.invalid(fileName);
    if (isUnreadableFile(error)) return m.errors.unreadable(fileName);
    if (looksLikeOutOfMemory(error)) return m.errors.memoryOpening(fileName);
    return m.errors.unknownOpening(fileName);
  }

  async function sniff(picked: File): Promise<boolean> {
    const head = new Uint8Array(await picked.slice(0, PDF_SNIFF_BYTES).arrayBuffer());
    return looksLikePdf(head);
  }

  async function openFile(picked: File): Promise<void> {
    const pick = ++pickGeneration;
    removeNotice('file-error');
    setStatus('');

    let isPdf: boolean;
    try {
      isPdf = await sniff(picked);
    } catch {
      isPdf = false;
    }
    if (pick !== pickGeneration || phase === 'compressing') return;
    if (!isPdf) {
      // Keep whatever PDF was loaded (or is still being opened) before.
      const message = picked.name ? m.notPdf(picked.name) : m.notPdfUnnamed;
      showNotice({ key: 'file-error', tone: 'warning', message });
      announce(message);
      return;
    }

    const generation = ++fileGeneration;
    closeSession();
    hideResult();
    removeNotice('large-file');
    file = picked;
    summary = null;
    phase = 'opening';
    updateUi();

    const displayName = picked.name || m.untitled;
    let announcement = m.reading(displayName);
    if (coarsePointer && picked.size > LARGE_FILE_BYTES_TOUCH) {
      const warning = m.largeFile(f.bytes(picked.size));
      showNotice({ key: 'large-file', tone: 'warning', message: warning });
      announcement = sentences(announcement, warning);
    }
    announce(announcement);

    const controller = new AbortController();
    openController = controller;
    try {
      const opened = await openSession(picked, controller.signal);
      if (generation !== fileGeneration) {
        opened.dispose();
        return;
      }
      session = opened;
      summary = opened.summary;
      phase = 'ready';
      updateUi();
      announce(m.loaded(displayName, m.pages(summary.pageCount), imagesText(selectedLevel())));
    } catch (error) {
      if (generation !== fileGeneration || isAbortError(error)) return;
      console.error('Compress PDF: could not open the file:', error);
      const message = describeOpenError(error, displayName);
      file = null;
      summary = null;
      phase = 'empty';
      removeNotice('large-file');
      showNotice({ key: 'file-error', tone: 'warning', message });
      updateUi();
      announce(message);
    } finally {
      if (openController === controller) openController = null;
    }
  }

  function removeFile(): void {
    if (phase === 'compressing' || !file) return;
    fileGeneration++;
    pickGeneration++; // a pick still being checked must not bring a file back
    closeSession();
    file = null;
    summary = null;
    phase = 'empty';
    hideResult();
    setStatus('');
    removeNotice('large-file');
    removeNotice('file-error');
    removeNotice('canvas-blocked');
    updateUi();
    el.input.focus();
    announce(m.removed);
  }

  function acceptFiles(files: ArrayLike<File>): void {
    if (phase === 'compressing') return;
    const list = Array.from(files);
    const first = list[0];
    if (!first) return;
    const pdf = list.length > 1 ? (list.find((candidate) => /\.pdf$/i.test(candidate.name)) ?? first) : first;
    if (list.length > 1) {
      showNotice({ key: 'one-file', tone: 'info', message: m.oneFileAtATime(pdf.name || m.untitled) });
    } else {
      removeNotice('one-file');
    }
    void openFile(pdf);
  }

  el.input.addEventListener('change', () => {
    const files = Array.from(el.input.files ?? []);
    el.input.value = ''; // allow picking the same file again
    acceptFiles(files);
  });

  let dragDepth = 0;
  root.addEventListener('dragenter', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth++;
    if (phase !== 'compressing') el.dropzone.dataset.dragover = '';
  });
  root.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = phase === 'compressing' ? 'none' : 'copy';
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
    if (event.dataTransfer) acceptFiles(event.dataTransfer.files);
  });

  el.removeFile.addEventListener('click', removeFile);

  // ---------------------------------------------------------------- options

  for (const input of el.levels) {
    input.addEventListener('change', () => {
      if (!summary) return;
      el.fileImages.textContent = imagesText(selectedLevel());
    });
  }

  // ---------------------------------------------------------------- compress

  function setProgress(done: number | null, total: number, text: string): void {
    if (done === null) {
      el.progress.removeAttribute('value'); // indeterminate
    } else {
      el.progress.max = Math.max(1, total);
      el.progress.value = Math.min(done, total);
    }
    el.progressText.textContent = text;
  }

  function onProgress(progress: CompressProgress): void {
    switch (progress.stage) {
      case 'cleanup':
        setProgress(null, 0, m.progress.cleanup);
        break;
      case 'images':
        setProgress(progress.done, progress.total, m.progress.image(progress.done + 1, progress.total));
        break;
      case 'saving':
        setProgress(null, 0, m.progress.saving);
        announce(m.progress.saving);
        break;
      default:
        break;
    }
  }

  function describeRunError(error: unknown, fileName: string): string {
    if (error instanceof CompressEngineLoadError) return m.errors.engine;
    if (error instanceof CompressFailure && (error.code === 'encrypted' || error.code === 'invalid')) {
      return describeOpenError(error, fileName);
    }
    if (isUnreadableFile(error)) return m.errors.unreadableAgain(fileName);
    if (looksLikeOutOfMemory(error)) return m.errors.memoryCompressing;
    return m.errors.unknownCompressing;
  }

  async function transcodeImage(request: TranscodeRequest, signal: AbortSignal) {
    try {
      return await transcodeOnPage(request, signal);
    } catch (error) {
      if (isAbortError(error)) throw error;
      // One image the browser cannot decode or encode stays as it is.
      console.warn('Compress PDF: kept an image that could not be re-encoded:', error);
      return null;
    }
  }

  async function compress(): Promise<void> {
    if (phase !== 'ready' || !file) return;
    const picked = file;
    const generation = fileGeneration;
    const level = selectedLevel();
    const stripMetadata = el.stripMetadata.checked;

    hideResult();
    setStatus('');
    const readback = canvasReadbackWorks();
    if (readback) {
      removeNotice('canvas-blocked');
    } else {
      showNotice({ key: 'canvas-blocked', tone: 'warning', message: m.canvasBlocked });
    }

    const controller = new AbortController();
    runController = controller;
    const focusWasOnCompress = document.activeElement === el.compress;
    phase = 'compressing';
    updateUi();
    if (focusWasOnCompress) el.cancel.focus();
    setProgress(null, 0, m.progress.starting);
    announce(m.compressing);

    let announcement = '';
    try {
      if (!session?.alive) {
        // Each worker serves one run (and a cancelled or crashed one is gone): read the file again.
        session = null;
        setProgress(null, 0, m.progress.reading);
        const opened = await openSession(picked, controller.signal);
        if (generation !== fileGeneration) {
          opened.dispose();
          return;
        }
        session = opened;
        summary = opened.summary;
      }
      const result = await session.compress({
        level,
        stripMetadata,
        signal: controller.signal,
        onProgress,
        transcode: (request, signal) => (readback ? transcodeImage(request, signal) : Promise.resolve(null)),
      });
      const blob = new Blob([result.bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const filename = toPdfFilename(compressedBaseName(picked.name), 'compressed.pdf');
      announcement = showResult(blob, filename, picked.size, result.stats);
    } catch (error) {
      if (session && !session.alive) session = null;
      if (isAbortError(error)) {
        setStatus(m.cancelledStatus);
        announcement = m.cancelled;
      } else {
        console.error('Compress PDF failed:', error);
        const message = describeRunError(error, picked.name || m.untitled);
        setStatus(message, 'error');
        announcement = message;
        if (isUnreadableFile(error)) {
          file = null;
          summary = null;
        }
      }
    } finally {
      if (runController === controller) runController = null;
      const focusWasOnCancel = document.activeElement === el.cancel;
      phase = file ? 'ready' : 'empty';
      updateUi();
      if (announcement) announce(announcement);
      if (focusWasOnCancel || document.activeElement === document.body) {
        if (!el.result.hidden && !el.download.hidden) el.download.focus();
        else if (!el.compress.disabled) el.compress.focus();
        else el.input.focus();
      }
    }
  }

  el.compress.addEventListener('click', () => {
    void compress();
  });

  el.cancel.addEventListener('click', () => {
    if (!runController) return;
    runController.abort();
    el.progressText.textContent = m.progress.cancelling;
  });

  // ---------------------------------------------------------------- lifecycle

  // Lets focus scrolling keep controls clear of the sticky action bar (scroll-padding-bottom).
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      const height = Math.ceil(el.actionBar.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--pdc-action-bar-height', `${height}px`);
    }).observe(el.actionBar);
  }

  if (inAppBrowser) {
    showNotice({ key: 'in-app-browser', tone: 'info', message: m.inAppBrowser });
  }

  window.addEventListener('pagehide', (event) => {
    // A page kept in the back/forward cache may be shown again with its download link.
    if (event.persisted) return;
    revokeResult();
    runController?.abort();
    closeSession();
  });

  updateUi();
}
