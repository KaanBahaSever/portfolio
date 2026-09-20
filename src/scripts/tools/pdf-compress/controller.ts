/**
 * Compress PDF: DOM wiring and state (browser only).
 * Everything happens on the device; nothing is uploaded.
 */

import { saveBlob } from '../../../lib/download.ts';
import { formatBytes, toPdfFilename } from '../../../lib/files/filename.ts';
import type { CompressProgress, CompressStats, PdfSummary, TranscodeRequest } from '../../../lib/pdf/compress/compress-pdf.ts';
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
/** Results that save less than this are reported as "nothing to gain". */
const MIN_USEFUL_SAVING = 0.01;
/** In-app browsers (social apps) that often ignore downloads of generated files. */
const IN_APP_BROWSER = /FBAN|FBAV|Instagram|LinkedInApp|Line\/|Snapchat|musical_ly|BytedanceWebview/i;

const LEVEL_NAMES: Record<CompressionLevel, string> = { light: 'Light', balanced: 'Balanced', strong: 'Strong' };

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

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
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
  };
}

export function initPdfCompress(root: HTMLElement): void {
  if (root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const el = getElements(root);

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

  function imagesText(level: CompressionLevel): string {
    if (!summary) return '';
    const count = summary.imageCounts[level];
    if (count > 0) return `${plural(count, 'image')} can be recompressed at ${LEVEL_NAMES[level]}`;
    if (level === 'light' && summary.imageCounts.balanced > 0) {
      return `No JPEG photos to recompress at Light; Balanced can convert ${plural(summary.imageCounts.balanced, 'image')}`;
    }
    return 'No large images found, so expect only a small reduction';
  }

  function updateUi(): void {
    const compressing = phase === 'compressing';
    const hasFile = file !== null;

    if (hasFile) el.dropzone.dataset.compact = '';
    else delete el.dropzone.dataset.compact;
    el.dropzoneTitle.textContent = hasFile ? 'Choose a different PDF' : 'Choose a PDF';
    el.input.disabled = compressing;
    if (compressing) el.dropzone.dataset.disabled = '';
    else delete el.dropzone.dataset.disabled;

    el.fileCard.hidden = !hasFile;
    if (file) {
      el.fileName.textContent = file.name || 'Untitled.pdf';
      el.fileName.title = file.name;
      const parts = [formatBytes(file.size)];
      if (summary) parts.push(plural(summary.pageCount, 'page'));
      else if (phase === 'opening') parts.push('Reading PDF…');
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

  function percent(value: number): string {
    const rounded = Math.round(value * 100);
    if (rounded === 0 && value > 0) return '<1%';
    if (rounded === 100 && value < 1) return '99%'; // never claim the whole file is gone
    return `${rounded}%`;
  }

  /** Lossless images that Light skipped but Balanced would convert (0 at other levels). */
  function skippedAtLight(stats: CompressStats): number {
    return stats.level === 'light' && stats.imagesConsidered === 0 ? (summary?.imageCounts.balanced ?? 0) : 0;
  }

  function detailsText(stats: CompressStats): string {
    const parts = [`${LEVEL_NAMES[stats.level]} level`];
    if (stats.imagesConsidered === 0) {
      parts.push(skippedAtLight(stats) > 0 ? 'no JPEG photos to recompress' : 'no large images to recompress');
    }
    else parts.push(`${stats.imagesReplaced} of ${plural(stats.imagesConsidered, 'image')} recompressed`);
    if (stats.duplicatesMerged > 0) parts.push(`${plural(stats.duplicatesMerged, 'duplicate')} merged`);
    if (stats.metadataRemoved) parts.push('metadata removed');
    return parts.join(' · ');
  }

  function showResult(blob: Blob, filename: string, originalSize: number, stats: CompressStats): string {
    revokeResult();
    const size = blob.size;
    const saving = originalSize > 0 ? (originalSize - size) / originalSize : 0;
    const smaller = size < originalSize && saving >= MIN_USEFUL_SAVING;
    const largest = Math.max(originalSize, size, 1);

    el.barOriginal.style.width = `${Math.max(1, (originalSize / largest) * 100)}%`;
    el.barResult.style.width = `${Math.max(1, (size / largest) * 100)}%`;
    el.barOriginalLabel.textContent = formatBytes(originalSize);
    el.barResultLabel.textContent = formatBytes(size);

    const sizes = `Original ${formatBytes(originalSize)} → ${formatBytes(size)}`;
    let announcement: string;
    if (smaller) {
      el.result.dataset.tone = 'success';
      el.resultTitle.textContent = `${sizes} (−${percent(saving)})`;
      let details = `${detailsText(stats)}. The download has started.`;
      if (inAppBrowser) details += ' If it doesn’t, open this page in Safari or Chrome.';
      el.resultDetails.textContent = details;
      el.download.textContent = 'Download again';
      announcement = `Compressed. ${sizes}, ${percent(saving)} smaller. The download has started.`;
    } else {
      el.result.dataset.tone = 'neutral';
      const skipped = skippedAtLight(stats);
      const title = skipped > 0 ? 'Light can’t shrink this PDF — try Balanced' : 'This PDF is already well optimized — nothing to gain';
      el.resultTitle.textContent = title;
      const change = size < originalSize ? ` (−${percent(saving)})` : size > originalSize ? ' (larger)' : '';
      let hint = '';
      if (skipped > 0) {
        hint = ` Balanced can convert ${plural(skipped, 'losslessly stored image')} to JPEG for a smaller file.`;
      } else if (stats.level !== 'strong' && stats.imagesConsidered > 0) {
        hint = ' A stronger level may still help, at lower image quality.';
      } else if (stats.imagesConsidered === 0) {
        hint = ' Text and vector graphics are already stored compactly.';
      }
      el.resultDetails.textContent = `${sizes}${change} · ${detailsText(stats)}.${hint}`;
      el.download.textContent = 'Download anyway';
      announcement = `${title.replace(' — ', ', ')}. ${sizes}.${hint}`;
    }

    // Offer the file when it is smaller, or when the user asked for metadata removal.
    const offer = smaller || stats.metadataRemoved;
    if (offer) {
      resultUrl = URL.createObjectURL(blob);
      el.download.href = resultUrl;
      el.download.download = filename;
    }
    el.download.hidden = !offer;
    el.result.hidden = false;
    if (smaller) saveBlob(blob, filename);
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
    if (error instanceof CompressEngineLoadError) {
      return 'Couldn’t load the PDF engine. Check your connection and reload the page.';
    }
    if (error instanceof CompressFailure && error.code === 'encrypted') {
      return `“${fileName}” is password-protected or encrypted, which isn’t supported. Remove the protection in a PDF app, then try again.`;
    }
    if (error instanceof CompressFailure && error.code === 'invalid') {
      return `“${fileName}” couldn’t be read. The file may be damaged.`;
    }
    if (isUnreadableFile(error)) return `Couldn’t read “${fileName}”. Choose the file again.`;
    if (looksLikeOutOfMemory(error)) {
      return `This device ran out of memory while reading “${fileName}”. Close other tabs or apps, or try a smaller file.`;
    }
    return `Something went wrong while reading “${fileName}”. Reload the page and try again.`;
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
      const message = `“${picked.name || 'This file'}” isn’t a PDF. Choose a PDF file.`;
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

    let announcement = `Reading ${picked.name}…`;
    if (coarsePointer && picked.size > LARGE_FILE_BYTES_TOUCH) {
      const warning = `Large file (${formatBytes(picked.size)}). Compressing it needs several times this much memory, so on a phone or tablet the page may reload. Close other tabs and apps first, or use a computer.`;
      showNotice({ key: 'large-file', tone: 'warning', message: warning });
      announcement += ` ${warning}`;
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
      announce(`${picked.name}: ${plural(summary.pageCount, 'page')}. ${imagesText(selectedLevel())}.`);
    } catch (error) {
      if (generation !== fileGeneration || isAbortError(error)) return;
      console.error('Compress PDF: could not open the file:', error);
      const message = describeOpenError(error, picked.name);
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
    announce('Removed the PDF');
  }

  function acceptFiles(files: ArrayLike<File>): void {
    if (phase === 'compressing') return;
    const list = Array.from(files);
    const first = list[0];
    if (!first) return;
    const pdf = list.length > 1 ? (list.find((candidate) => /\.pdf$/i.test(candidate.name)) ?? first) : first;
    if (list.length > 1) {
      showNotice({ key: 'one-file', tone: 'info', message: `One PDF at a time: using “${pdf.name}”.` });
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
        setProgress(null, 0, 'Removing unused data…');
        break;
      case 'images':
        setProgress(progress.done, progress.total, `Optimizing image ${progress.done + 1} of ${progress.total}…`);
        break;
      case 'saving':
        setProgress(null, 0, 'Saving…');
        announce('Saving…');
        break;
      default:
        break;
    }
  }

  function describeRunError(error: unknown, fileName: string): string {
    if (error instanceof CompressEngineLoadError) {
      return 'Couldn’t load the PDF engine. Check your connection and reload the page.';
    }
    if (error instanceof CompressFailure && (error.code === 'encrypted' || error.code === 'invalid')) {
      return describeOpenError(error, fileName);
    }
    if (isUnreadableFile(error)) return `Couldn’t read “${fileName}” again. Choose the file again.`;
    if (looksLikeOutOfMemory(error)) {
      return 'This device ran out of memory while compressing. Close other tabs or apps, or try a smaller file, then try again.';
    }
    return 'Something went wrong while compressing the PDF. Try another level, or reload the page and try again.';
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
      showNotice({
        key: 'canvas-blocked',
        tone: 'warning',
        message:
          'Your browser’s privacy settings block reading image data from a canvas, so images can’t be recompressed here. Other clean-up still runs; for smaller images, try another browser.',
      });
    }

    const controller = new AbortController();
    runController = controller;
    const focusWasOnCompress = document.activeElement === el.compress;
    phase = 'compressing';
    updateUi();
    if (focusWasOnCompress) el.cancel.focus();
    setProgress(null, 0, 'Starting…');
    announce('Compressing PDF…');

    let announcement = '';
    try {
      if (!session?.alive) {
        // Each worker serves one run (and a cancelled or crashed one is gone): read the file again.
        session = null;
        setProgress(null, 0, 'Reading PDF…');
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
        setStatus('Cancelled.');
        announcement = 'Cancelled';
      } else {
        console.error('Compress PDF failed:', error);
        const message = describeRunError(error, picked.name);
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
    el.progressText.textContent = 'Cancelling…';
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
    showNotice({
      key: 'in-app-browser',
      tone: 'info',
      message: 'Downloads may not work inside this app. Open the page in your browser for the best results.',
    });
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
