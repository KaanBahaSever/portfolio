/**
 * Image compressor: DOM wiring and state (browser only). Everything happens on the device;
 * nothing is uploaded.
 *
 * Flow: a file (picked, dropped or pasted) is sniffed from its first bytes, decoded once by
 * the engine, then re-encoded whenever a setting changes: debounced, latest request wins,
 * and results of superseded requests are discarded by a generation counter.
 */

import { saveBlob } from '../../../lib/download.ts';
import { getPageLocale } from '../../../i18n/client.ts';
import { formatters } from '../../../i18n/format.ts';
import { imageCompressorMessages } from '../../../i18n/tools/image-compressor.ts';
import { outputFileName } from '../../../lib/image/compress/filename.ts';
import { WEBP_MAX_SIDE, canDecode, canvasLimits, maxDecodePixels, megapixels } from '../../../lib/image/compress/fit.ts';
import { FORMAT_LABELS, isWritableSource, type EncoderSupport } from '../../../lib/image/compress/formats.ts';
import { planEncode, samePlanOutput, type EncodePlan } from '../../../lib/image/compress/plan.ts';
import {
  DEFAULT_SETTINGS,
  clampQuality,
  isFormatChoice,
  parseMaxDimension,
  type CompressSettings,
} from '../../../lib/image/compress/settings.ts';
import { compareSizes } from '../../../lib/image/compress/stats.ts';
import {
  IMAGE_HEAD_BYTES,
  mayHaveTransparency,
  readImageDimensions,
  readOrientation,
  sniffAnimation,
  sniffImageFormat,
  type Animation,
  type ImageFormat,
} from '../../../lib/image/sniff.ts';
import { initCompare } from './compare.ts';
import { EngineError, ImageEngine, isAbortError } from './engine.ts';

/** Quiet time after the last slider movement before re-encoding. */
const QUALITY_DEBOUNCE_MS = 200;
/** Format and size are single clicks; a shorter pause still merges quick successive changes. */
const CHOICE_DEBOUNCE_MS = 150;
/** Longest wait for a new preview to decode before it is shown anyway. */
const PREVIEW_DECODE_WAIT_MS = 1000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

type Phase = 'empty' | 'opening' | 'ready';

interface OpenImage {
  file: File;
  name: string;
  format: ImageFormat;
  animation: Animation;
  scanAlpha: boolean;
  orientation: number;
  width: number;
  height: number;
  hasAlpha: boolean;
  support: EncoderSupport;
  url: string;
}

interface Result {
  blob: Blob;
  url: string;
  plan: EncodePlan;
  fileName: string;
}

/** An image with its latest result, set aside while another image opens. */
interface OpenState {
  image: OpenImage;
  result: Result | null;
}

/**
 * Where the visible error came from: a file that could not be opened, or a failed encode.
 * A later successful encode clears only the latter.
 */
type ErrorSource = 'file' | 'encode';

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Image compressor: missing element ${selector}`);
  return element;
}

function hasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return !!types && Array.from(types).includes('Files');
}

let pageDropGuardInstalled = false;

/** Dropping a file outside the tool would open it in the tab and lose the current image. */
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

/** Phones and tablets: iOS limits canvases to 16.7 MP, and memory is scarce on all of them. */
function isMobileDevice(): boolean {
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iPadOS || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.matchMedia('(pointer: coarse)').matches;
}

function isApplePlatform(): boolean {
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}

/** Pasted files: DataTransfer.files where supported, else file items. */
function clipboardFiles(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files = Array.from(data.files ?? []);
  if (files.length > 0) return files;
  return Array.from(data.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}

/** The image to open from several files: the first one that says it is an image. */
function pickFile(files: File[]): File | undefined {
  return files.find((file) => file.type.startsWith('image/')) ?? files[0];
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && !['range', 'radio', 'checkbox', 'file', 'button'].includes(target.type);
}

export function initImageCompressor(root: HTMLElement): void {
  if (root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const locale = getPageLocale();
  const m = imageCompressorMessages[locale];
  const f = formatters(locale);

  const el = {
    announcer: query<HTMLElement>(root, '[data-announcer]'),
    dropzone: query<HTMLLabelElement>(root, '[data-dropzone]'),
    input: query<HTMLInputElement>(root, '[data-file-input]'),
    dropzoneTitle: query<HTMLElement>(root, '[data-dropzone-title]'),
    pasteKeys: Array.from(root.querySelectorAll<HTMLElement>('[data-paste-key]')),
    status: query<HTMLElement>(root, '[data-status]'),
    error: query<HTMLElement>(root, '[data-error]'),
    errorMessage: query<HTMLElement>(root, '[data-error-message]'),
    errorHint: query<HTMLElement>(root, '[data-error-hint]'),
    errorDismiss: query<HTMLButtonElement>(root, '[data-error-dismiss]'),
    notice: query<HTMLElement>(root, '[data-notice]'),
    noticeMessage: query<HTMLElement>(root, '[data-notice-message]'),
    workspace: query<HTMLElement>(root, '[data-workspace]'),
    fileName: query<HTMLElement>(root, '[data-file-name]'),
    removeFile: query<HTMLButtonElement>(root, '[data-remove-file]'),
    compare: query<HTMLElement>(root, '[data-compare]'),
    result: query<HTMLElement>(root, '[data-result]'),
    resultBody: query<HTMLElement>(root, '[data-result-body]'),
    resultBusy: query<HTMLElement>(root, '[data-result-busy]'),
    headline: query<HTMLElement>(root, '[data-headline]'),
    sizes: query<HTMLElement>(root, '[data-sizes]'),
    barBefore: query<HTMLElement>(root, '[data-bar-before]'),
    barAfter: query<HTMLElement>(root, '[data-bar-after]'),
    advice: query<HTMLElement>(root, '[data-advice]'),
    download: query<HTMLButtonElement>(root, '[data-download]'),
    downloadLabel: query<HTMLElement>(root, '[data-download-label]'),
    downloadOriginal: query<HTMLButtonElement>(root, '[data-download-original]'),
    outputName: query<HTMLElement>(root, '[data-output-name]'),
    details: query<HTMLElement>(root, '[data-details]'),
    originalMeta: query<HTMLElement>(root, '[data-original-meta]'),
    settings: query<HTMLFormElement>(root, '[data-settings]'),
    quality: query<HTMLInputElement>(root, '[data-quality]'),
    qualityOutput: query<HTMLOutputElement>(root, '[data-quality-output]'),
    qualityNote: query<HTMLElement>(root, '[data-quality-note]'),
    formatInputs: Array.from(root.querySelectorAll<HTMLInputElement>('input[data-format]')),
    originalFormat: query<HTMLElement>(root, '[data-original-format]'),
    formatNotes: query<HTMLElement>(root, '[data-format-notes]'),
    maxDimension: query<HTMLSelectElement>(root, '[data-max-dimension]'),
    sizeNote: query<HTMLElement>(root, '[data-size-note]'),
  };

  const engine = new ImageEngine();
  const mobile = isMobileDevice();
  const device = canvasLimits(mobile);
  const compare = initCompare(el.compare, {
    dividerText: (split) => m.compare.dividerValue(f.percent(split), f.percent(1 - split)),
    scrollLabels: { split: m.compare.scrollSplit, before: m.compare.scrollBefore, after: m.compare.scrollAfter },
  });

  let phase: Phase = 'empty';
  let image: OpenImage | null = null;
  let result: Result | null = null;
  /** The image that was open when another one started to open: it returns if that one fails. */
  let previous: OpenState | null = null;
  let errorSource: ErrorSource | null = null;
  /** Incremented per file: only the latest pick may install its image. */
  let loadGeneration = 0;
  /** Incremented per encode request: only the latest request may show its result. */
  let encodeGeneration = 0;
  let encodeTimer = 0;
  let busy = false;
  /** The encoder crashed: the image must be decoded again before the next encode. */
  let needsReload = false;
  let announceTimer = 0;

  installPageDropGuard();
  for (const key of el.pasteKeys) key.textContent = isApplePlatform() ? '⌘ V' : 'Ctrl V';
  // Start the worker while the visitor is still choosing a file (Safari has no requestIdleCallback).
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => engine.warmUp(), { timeout: 2000 });
  else window.setTimeout(() => engine.warmUp(), 200);

  // ---------------------------------------------------------------- messages

  function announce(message: string): void {
    window.clearTimeout(announceTimer);
    el.announcer.textContent = '';
    // Re-setting after a tick makes screen readers repeat identical messages.
    announceTimer = window.setTimeout(() => {
      el.announcer.textContent = message;
    }, 50);
  }

  function showError(message: string, hint = '', source: ErrorSource = 'file'): void {
    errorSource = source;
    el.error.hidden = false;
    el.errorMessage.textContent = message;
    el.errorHint.textContent = hint;
  }

  function clearError(): void {
    errorSource = null;
    el.error.hidden = true;
    el.errorMessage.textContent = '';
    el.errorHint.textContent = '';
  }

  function showNotice(message: string): void {
    el.notice.hidden = false;
    el.noticeMessage.textContent = message;
  }

  function clearNotice(): void {
    el.notice.hidden = true;
    el.noticeMessage.textContent = '';
  }

  el.errorDismiss.addEventListener('click', () => {
    clearError();
    el.input.focus();
  });

  /** 'memory', 'canvas' (no 2D context) and 'crashed' (the worker died) all mean: out of memory. */
  function isMemoryFailure(error: unknown): boolean {
    const code = error instanceof EngineError ? error.code : 'encode';
    return code === 'memory' || code === 'canvas' || code === 'crashed';
  }

  /**
   * A failed encode. Out of memory, a smaller maximum size helps (the settings are on screen);
   * only on a phone or tablet is a computer worth suggesting too.
   */
  function encodeErrorText(error: unknown): string {
    if (!isMemoryFailure(error)) return m.errors.encodeFailed;
    return mobile ? m.errors.memory : m.errors.memoryDesktop;
  }

  function megapixelText(pixels: number): string {
    return `${f.number(megapixels(pixels), { maximumFractionDigits: 1 })} MP`;
  }

  // ---------------------------------------------------------------- settings

  function readSettings(): CompressSettings {
    const format = el.formatInputs.find((input) => input.checked)?.value;
    return {
      quality: clampQuality(el.quality.value),
      format: isFormatChoice(format) ? format : DEFAULT_SETTINGS.format,
      maxDimension: parseMaxDimension(el.maxDimension.value),
    };
  }

  function currentPlan(): EncodePlan | null {
    if (!image) return null;
    return planEncode(image, readSettings(), image.support, device);
  }

  function renderQualityValue(): void {
    const text = f.percent(clampQuality(el.quality.value) / 100);
    el.qualityOutput.textContent = text;
    el.quality.setAttribute('aria-valuetext', text);
  }

  function dimensions(width: number, height: number): string {
    return `${width} × ${height} px`;
  }

  function setNote(target: HTMLElement, text: string | null): void {
    target.hidden = !text;
    target.textContent = text ?? '';
  }

  function addFormatNote(text: string, tone: 'info' | 'warning'): void {
    const note = document.createElement('p');
    note.className = el.formatNotes.dataset.noteClass ?? '';
    note.dataset.tone = tone;
    note.textContent = text;
    el.formatNotes.append(note);
  }

  /** Explanations next to the control they concern: quality, format and size. */
  function renderNotes(plan: EncodePlan): void {
    if (!image) return;
    const lossless = plan.quality === null;
    setNote(el.qualityNote, lossless ? m.notes.pngLossless : null);
    el.quality.toggleAttribute('data-inactive', lossless);

    el.formatNotes.replaceChildren();
    if (plan.notes.includes('original-not-writable')) {
      addFormatNote(m.notes.originalNotWritable(FORMAT_LABELS[image.format], FORMAT_LABELS[plan.format]), 'info');
    }
    if (plan.notes.includes('webp-unsupported')) {
      addFormatNote(m.notes.webpUnsupported(FORMAT_LABELS[plan.format]), 'info');
    } else if (!image.support.webp) {
      addFormatNote(m.notes.webpOptionUnavailable, 'info');
    }
    if (plan.notes.includes('alpha-flattened')) {
      addFormatNote(image.support.webp ? m.notes.alphaFlattened : m.notes.alphaFlattenedNoWebp, 'warning');
    }
    if (image.animation === 'yes') addFormatNote(m.notes.animation, 'warning');
    else if (image.animation === 'maybe') addFormatNote(m.notes.animationMaybe, 'info');

    const size = dimensions(plan.width, plan.height);
    setNote(
      el.sizeNote,
      plan.notes.includes('canvas-limit')
        ? m.notes.canvasLimit(size)
        : plan.notes.includes('encoder-limit')
          ? m.notes.encoderLimit(f.number(WEBP_MAX_SIDE), size)
          : null,
    );
  }

  /** "Original" names the format it keeps; WebP is offered only where it can be written. */
  function renderFormatOptions(): void {
    if (!image) return;
    el.originalFormat.textContent = isWritableSource(image.format, image.support) ? FORMAT_LABELS[image.format] : '';
    for (const input of el.formatInputs) {
      if (input.value === 'webp') input.disabled = !image.support.webp;
    }
  }

  // ---------------------------------------------------------------- result

  function setBusy(value: boolean): void {
    busy = value;
    compare.setBusy(value);
    el.resultBusy.hidden = !value;
    el.resultBody.toggleAttribute('data-busy', value);
    el.result.setAttribute('aria-busy', String(value));
    // aria-disabled, not disabled: the button keeps keyboard focus while a new version is made.
    el.download.setAttribute('aria-disabled', String(value || !result));
  }

  function captions(): void {
    if (!image) return;
    const before = [m.compare.before, f.bytes(image.file.size), `${image.width} × ${image.height}`].join(' · ');
    let after = `${m.compare.after} · ${m.status.compressing}`;
    if (result) {
      const parts = [m.compare.after, f.bytes(result.blob.size), FORMAT_LABELS[result.plan.format]];
      if (result.plan.width !== image.width || result.plan.height !== image.height) {
        parts.push(`${result.plan.width} × ${result.plan.height}`);
      }
      after = parts.join(' · ');
    }
    compare.setCaptions(before, after);
  }

  function renderResult(): void {
    if (!image || !result) {
      el.headline.textContent = '—';
      delete el.headline.dataset.tone;
      el.sizes.textContent = '';
      el.outputName.textContent = '';
      el.details.textContent = '';
      el.advice.hidden = true;
      el.downloadOriginal.hidden = true;
      el.originalMeta.hidden = true;
      el.barBefore.style.transform = 'scaleX(1)';
      el.barAfter.style.transform = 'scaleX(0)';
      return;
    }
    const stats = compareSizes(image.file.size, result.blob.size);
    const headline =
      stats.outcome === 'smaller'
        ? m.result.reduced(f.percent(stats.fraction))
        : stats.outcome === 'larger'
          ? m.result.larger(f.percent(stats.fraction))
          : m.result.same;
    el.headline.textContent = headline;
    el.headline.dataset.tone = stats.outcome;
    el.sizes.textContent = m.result.sizes(f.bytes(stats.originalBytes), f.bytes(stats.outputBytes));

    const largest = Math.max(stats.originalBytes, stats.outputBytes, 1);
    el.barBefore.style.transform = `scaleX(${stats.originalBytes / largest})`;
    el.barAfter.style.transform = `scaleX(${stats.outputBytes / largest})`;

    // Not smaller: say so, and make keeping the original the main action.
    const keepOriginal = stats.outcome !== 'smaller';
    el.advice.hidden = !keepOriginal;
    el.downloadOriginal.hidden = !keepOriginal;
    el.originalMeta.hidden = !keepOriginal;
    el.downloadLabel.textContent = keepOriginal ? m.result.downloadAnyway : m.result.download;
    el.download.dataset.variant = keepOriginal ? 'secondary' : 'primary';
    el.downloadOriginal.dataset.variant = 'primary';

    el.outputName.textContent = result.fileName;
    const quality = result.plan.quality === null ? m.result.lossless : m.result.quality(f.percent(result.plan.quality));
    el.details.textContent = [FORMAT_LABELS[result.plan.format], dimensions(result.plan.width, result.plan.height), quality].join(' · ');
    captions();
  }

  function summary(): string {
    if (!image || !result) return '';
    const stats = compareSizes(image.file.size, result.blob.size);
    const headline =
      stats.outcome === 'smaller'
        ? m.result.reduced(f.percent(stats.fraction))
        : stats.outcome === 'larger'
          ? m.result.larger(f.percent(stats.fraction))
          : m.result.same;
    return m.result.summary(headline, f.bytes(stats.originalBytes), f.bytes(stats.outputBytes));
  }

  // ---------------------------------------------------------------- encoding

  function requestEncode(delay: number): void {
    if (!image) return;
    window.clearTimeout(encodeTimer);
    const generation = ++encodeGeneration;
    const plan = currentPlan();
    if (!plan) return;
    renderNotes(plan);
    if (!needsReload && samePlanOutput(plan, result?.plan ?? null)) {
      // Nothing that affects the file changed (e.g. the quality slider while writing PNG).
      setBusy(false);
      return;
    }
    setBusy(true);
    encodeTimer = window.setTimeout(() => void runEncode(generation, plan), delay);
  }

  async function runEncode(generation: number, plan: EncodePlan): Promise<void> {
    const target = image;
    if (!target) return;
    const stale = () => generation !== encodeGeneration || target !== image;
    try {
      if (needsReload) {
        const loaded = await engine.load(target.file, target.scanAlpha, target.orientation);
        if (target !== image) return;
        needsReload = false;
        target.support = loaded.support;
        renderFormatOptions();
      }
      const blob = await engine.encode({
        width: plan.width,
        height: plan.height,
        mime: plan.mime,
        quality: plan.quality,
        background: plan.background,
      });
      if (stale()) return;
      if (blob.type !== plan.mime) {
        // The encoder quietly wrote another format (WebP where it is not supported):
        // remember that and plan again, which falls back with an explanation.
        if (plan.format === 'webp' && target.support.webp) {
          target.support = { ...target.support, webp: false };
          renderFormatOptions();
          requestEncode(0);
          return;
        }
        throw new EngineError('encode', `Expected ${plan.mime}, got ${blob.type || 'no type'}`);
      }
      await showResult(target, blob, plan, stale);
    } catch (error) {
      if (isAbortError(error) || stale()) return;
      if (error instanceof EngineError && error.code === 'crashed') needsReload = true;
      setBusy(false);
      showError(encodeErrorText(error), '', 'encode');
    }
  }

  async function showResult(target: OpenImage, blob: Blob, plan: EncodePlan, stale: () => boolean): Promise<void> {
    const url = URL.createObjectURL(blob);
    // Decode before swapping, so the preview never flashes empty. Bounded: decode() may stay
    // pending while the page is not rendering (a background tab), and the result must not wait.
    const probe = new Image();
    probe.src = url;
    await Promise.race([probe.decode().catch(() => undefined), wait(PREVIEW_DECODE_WAIT_MS)]);
    if (stale()) {
      URL.revokeObjectURL(url);
      return;
    }
    const replaced = result;
    result = { blob, url, plan, fileName: outputFileName(target.name, plan.format, m.outputNames) };
    compare.setSize(plan.width, plan.height);
    compare.setImages({
      beforeUrl: target.url,
      beforeAlt: m.compare.altBefore(target.name),
      afterUrl: url,
      afterAlt: m.compare.altAfter(target.name),
    });
    if (replaced) URL.revokeObjectURL(replaced.url);
    // A new result settles an earlier failed encode, but not a file that could not be opened.
    if (errorSource === 'encode') clearError();
    setBusy(false);
    renderResult();
    announce(summary());
  }

  // ---------------------------------------------------------------- opening files

  function setPhase(next: Phase): void {
    const wasVisible = !el.workspace.hidden;
    phase = next;
    // While a replacement opens, the workspace stays in place (busy) instead of collapsing
    // and growing back; a first image shows it only once it is ready.
    const visible = next === 'ready' || (next === 'opening' && wasVisible);
    el.workspace.hidden = !visible;
    el.dropzone.toggleAttribute('data-compact', visible);
    el.dropzoneTitle.textContent = visible ? m.dropzone.titleLoaded : m.dropzone.title;
    root.dataset.phase = next;
    if (visible) compare.refresh();
  }

  /** Revokes the object URLs of an image and its result. */
  function release(state: OpenState | null): void {
    if (!state) return;
    URL.revokeObjectURL(state.image.url);
    if (state.result) URL.revokeObjectURL(state.result.url);
  }

  /** Stops all work on the open image and empties the view; the caller decides what to keep. */
  function detach(): void {
    window.clearTimeout(encodeTimer);
    encodeGeneration += 1;
    engine.unload();
    image = null;
    result = null;
    needsReload = false;
    compare.clear();
    setBusy(false);
    renderResult();
  }

  /** Frees everything that belongs to the open image, and any image set aside. */
  function closeImage(): void {
    release(image ? { image, result } : null);
    release(previous);
    previous = null;
    detach();
  }

  /**
   * Sets the open image aside while another one opens, so that it can return if that one
   * fails. When an earlier pick was still opening, the image set aside before it stays the
   * one to return to. The engine forgets it either way: memory goes to the new image.
   */
  function setAside(): void {
    if (image) {
      release(previous);
      previous = { image, result };
    }
    detach();
  }

  /** Brings back the image set aside, with its result. False when there is none. */
  function restorePrevious(): boolean {
    const kept = previous;
    previous = null;
    if (!kept) return false;
    image = kept.image;
    result = kept.result;
    // The engine let go of this image when the other one started to open: the next encode
    // decodes it again from its file.
    needsReload = true;
    el.fileName.textContent = image.name;
    el.fileName.title = image.name;
    renderFormatOptions();
    const shown = result?.plan ?? image;
    compare.setSize(shown.width, shown.height);
    compare.setImages({
      beforeUrl: image.url,
      beforeAlt: m.compare.altBefore(image.name),
      afterUrl: result?.url ?? null,
      afterAlt: result ? m.compare.altAfter(image.name) : '',
    });
    setBusy(false);
    setPhase('ready');
    renderResult();
    captions();
    // The settings may have changed while the other image was opening: encode only if the
    // result no longer matches them.
    const plan = currentPlan();
    if (plan && samePlanOutput(plan, result?.plan ?? null)) renderNotes(plan);
    else requestEncode(0);
    return true;
  }

  /**
   * A file that cannot be opened. An open image stays as it is. If this pick replaced one that
   * was still opening, that one stops too, and the image open before it (if any) returns.
   */
  function rejectFile(message: string): void {
    if (!image && phase === 'opening') {
      engine.unload(); // frees the half-opened image, whose own open now stops
      el.status.textContent = '';
      if (!restorePrevious()) {
        setBusy(false);
        setPhase('empty');
      }
    }
    showError(message);
  }

  async function openFile(file: File, others: number): Promise<void> {
    const generation = ++loadGeneration;
    const name = file.name || m.outputNames.fallbackBase;
    clearError();
    clearNotice();

    if (file.size === 0) {
      rejectFile(m.errors.empty(name));
      return;
    }
    let head: Uint8Array;
    try {
      head = new Uint8Array(await file.slice(0, IMAGE_HEAD_BYTES).arrayBuffer());
    } catch {
      if (generation === loadGeneration) rejectFile(m.errors.unreadable(name));
      return;
    }
    if (generation !== loadGeneration) return;

    const format = sniffImageFormat(head);
    if (format === 'svg') {
      rejectFile(m.errors.svg(name));
      return;
    }
    // Unknown bytes are still tried when the file says it is an image (a format this list
    // does not know may still be one the browser can decode).
    if (format === 'unknown' && !file.type.startsWith('image/')) {
      rejectFile(m.errors.notImage(name));
      return;
    }
    const stored = readImageDimensions(format, head);
    if (stored && !canDecode(stored.width, stored.height, mobile)) {
      // Refused before decoding, so no setting can help: only a smaller file.
      rejectFile(m.errors.tooManyPixels(name, megapixelText(stored.width * stored.height), megapixelText(maxDecodePixels(mobile))));
      return;
    }

    // The open image stays in memory until this one has decoded: if it cannot be, the
    // open image returns instead of leaving the tool empty.
    setAside();
    setPhase('opening');
    setBusy(true);
    el.fileName.textContent = name;
    el.status.textContent = m.status.opening(name);
    announce(m.status.opening(name));

    const scanAlpha = mayHaveTransparency(format, head);
    const orientation = readOrientation(format, head);
    try {
      const loaded = await engine.load(file, scanAlpha, orientation);
      if (generation !== loadGeneration) return;
      image = {
        file,
        name,
        format,
        animation: sniffAnimation(format, head),
        scanAlpha,
        orientation,
        width: loaded.width,
        height: loaded.height,
        hasAlpha: loaded.hasAlpha,
        support: loaded.support,
        url: URL.createObjectURL(file),
      };
    } catch (error) {
      if (generation !== loadGeneration || isAbortError(error)) return;
      el.status.textContent = '';
      if (!restorePrevious()) {
        setBusy(false);
        setPhase('empty');
      }
      if (isMemoryFailure(error)) {
        showError(m.errors.openMemory(name));
      } else {
        const label = FORMAT_LABELS[format] === '?' ? file.type || '?' : FORMAT_LABELS[format];
        showError(m.errors.undecodable(name, label), format === 'heic' ? m.errors.heicHint : '');
      }
      return;
    }

    // The new image is in: the one set aside for a failure is no longer needed.
    release(previous);
    previous = null;
    el.status.textContent = '';
    el.fileName.textContent = name;
    el.fileName.title = name;
    renderFormatOptions();
    compare.setSize(image.width, image.height);
    compare.setImages({ beforeUrl: image.url, beforeAlt: m.compare.altBefore(name), afterUrl: null, afterAlt: '' });
    setPhase('ready');
    captions();
    if (others > 0) showNotice(m.notices.multiple(name));
    announce(m.status.opened(name, dimensions(image.width, image.height), f.bytes(file.size)));
    requestEncode(0);
  }

  function openFiles(files: File[]): void {
    const file = pickFile(files);
    if (file) void openFile(file, files.length - 1);
  }

  // ---------------------------------------------------------------- input: picker, drop, paste

  el.input.addEventListener('change', () => {
    openFiles(Array.from(el.input.files ?? []));
    // Choosing the same file again must fire 'change' again.
    el.input.value = '';
  });

  function setDragOver(value: boolean): void {
    el.dropzone.toggleAttribute('data-dragover', value);
  }

  root.addEventListener('dragenter', (event) => {
    if (hasFiles(event)) setDragOver(true);
  });
  root.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  });
  root.addEventListener('dragleave', (event) => {
    if (!root.contains(event.relatedTarget as Node | null)) setDragOver(false);
  });
  root.addEventListener('drop', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    setDragOver(false);
    openFiles(Array.from(event.dataTransfer?.files ?? []));
  });

  document.addEventListener('paste', (event) => {
    if (event.defaultPrevented || isEditable(event.target)) return;
    const files = clipboardFiles(event.clipboardData);
    if (files.length === 0) {
      showError(m.errors.pasteEmpty);
      return;
    }
    event.preventDefault();
    openFiles(files);
  });

  el.removeFile.addEventListener('click', () => {
    loadGeneration += 1;
    closeImage();
    clearNotice();
    clearError();
    setPhase('empty');
    announce(m.status.removed);
    el.input.focus();
  });

  // ---------------------------------------------------------------- controls

  el.settings.addEventListener('submit', (event) => event.preventDefault());

  el.quality.addEventListener('input', () => {
    renderQualityValue();
    requestEncode(QUALITY_DEBOUNCE_MS);
  });
  for (const input of el.formatInputs) {
    input.addEventListener('change', () => requestEncode(CHOICE_DEBOUNCE_MS));
  }
  el.maxDimension.addEventListener('change', () => requestEncode(CHOICE_DEBOUNCE_MS));

  el.download.addEventListener('click', () => {
    if (busy || !result) return;
    saveBlob(result.blob, result.fileName);
  });
  el.downloadOriginal.addEventListener('click', () => {
    if (image) saveBlob(image.file, image.name);
  });

  renderQualityValue();
  renderResult();
  setPhase(phase);
}
