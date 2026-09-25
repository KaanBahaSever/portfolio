/**
 * Page thumbnails with PDF.js (browser only).
 *
 * PDF.js is imported on demand, into its own chunk, the first time a PDF is previewed; its
 * worker is a separate same-origin file (the `?url` import), and its data files (wasm image
 * decoders, CMaps, standard fonts, ICC profiles) are served from /vendor/pdfjs/<version>/
 * by integrations/pdfjs-assets.mjs. The legacy build is used because it carries polyfills
 * for the newer JavaScript APIs the modern build calls unguarded.
 *
 * pdf-lib (in the split worker) stays the source of truth: previews start only after it
 * has read the file, and any PDF.js failure just means no thumbnails.
 *
 * Memory: pages render two at a time into two reusable canvases; each result becomes a small
 * JPEG blob shown through an <img> (a canvas per tile would cost ~0.5 MB each). Every page is
 * cleaned up after rendering, and close() cancels, destroys the document with its worker,
 * and revokes every blob URL.
 */

import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import { thumbnailScale } from './grid-math.ts';

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pdfjsModule: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsModule) {
    const loading = import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    });
    pdfjsModule = loading;
    // A failed chunk load (offline, or a newer deployment replaced it) may work for the next file.
    loading.catch(() => {
      if (pdfjsModule === loading) pdfjsModule = null;
    });
  }
  return pdfjsModule;
}

/** The CSS size of a tile's sheet: thumbnails are rendered to fit inside it. */
export interface ThumbnailBox {
  width: number;
  height: number;
}

export interface ThumbnailHandlers {
  /** A thumbnail is ready, as a blob: URL that stays valid until close(), with its pixel size. */
  onThumbnail(page: number, url: string, width: number, height: number): void;
  /** This page could not be rendered (the others may still work). */
  onPageError(page: number): void;
}

export interface ThumbnailService {
  /**
   * Opens `file` for previews, replacing any previous one. Rejects when PDF.js can't read it
   * or counts a different number of pages than pdf-lib (thumbnails would be misleading).
   */
  open(file: File, expectedPages: number): Promise<void>;
  /** Queues a page (1-based). Queued pages render in page order, two at a time. */
  request(page: number): void;
  /** Drops a queued page that scrolled out of view; a render already running finishes. */
  cancel(page: number): void;
  setBox(box: ThumbnailBox): void;
  /** Cancels all work, destroys the document and its worker, and revokes every thumbnail URL. */
  close(): void;
}

const CONCURRENCY = 2;
const JPEG_QUALITY = 0.82;

class StaleError extends Error {
  constructor() {
    super('The preview was replaced');
    this.name = 'AbortError';
  }
}

function isCancelled(error: unknown): boolean {
  const name = (error as { name?: unknown } | null)?.name;
  return name === 'RenderingCancelledException' || name === 'AbortError';
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the thumbnail'))), 'image/jpeg', JPEG_QUALITY);
  });
}

export function createThumbnailService(handlers: ThumbnailHandlers): ThumbnailService {
  /** Bumped by close(): every async step checks it, so work for a replaced file is dropped. */
  let generation = 0;
  let task: PDFDocumentLoadingTask | null = null;
  let doc: PDFDocumentProxy | null = null;
  let box: ThumbnailBox = { width: 160, height: 226 };
  const queue = new Set<number>();
  const running = new Map<number, RenderTask | null>();
  const urls: string[] = [];
  /** Free scratch canvases; at most CONCURRENCY exist, since that many renders run at once. */
  const canvases: HTMLCanvasElement[] = [];

  function takeCanvas(): HTMLCanvasElement {
    return canvases.pop() ?? document.createElement('canvas');
  }

  function releaseCanvas(canvas: HTMLCanvasElement, keep: boolean): void {
    if (!keep) {
      // A zero-sized canvas frees its backing store at once (iOS counts canvas memory strictly).
      canvas.width = 0;
      canvas.height = 0;
    }
    if (canvases.length < CONCURRENCY) canvases.push(canvas);
  }

  function pump(): void {
    const source = doc;
    if (!source) return;
    while (running.size < CONCURRENCY && queue.size > 0) {
      let next = Infinity;
      for (const page of queue) if (page < next) next = page;
      queue.delete(next);
      running.set(next, null);
      void renderPage(source, next, generation);
    }
  }

  async function renderPage(source: PDFDocumentProxy, pageNumber: number, gen: number): Promise<void> {
    const canvas = takeCanvas();
    let page: PDFPageProxy | null = null;
    try {
      page = await source.getPage(pageNumber);
      if (gen !== generation) return;
      const unscaled = page.getViewport({ scale: 1 });
      const scale = thumbnailScale(unscaled.width, unscaled.height, box.width, box.height, window.devicePixelRatio);
      const viewport = page.getViewport({ scale });
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      const renderTask = page.render({ canvas, viewport });
      running.set(pageNumber, renderTask);
      await renderTask.promise;
      if (gen !== generation) return;
      const blob = await toJpeg(canvas);
      if (gen !== generation) return;
      const url = URL.createObjectURL(blob);
      urls.push(url);
      handlers.onThumbnail(pageNumber, url, canvas.width, canvas.height);
    } catch (error) {
      if (gen !== generation || isCancelled(error)) return;
      console.warn(`Split PDF: no preview for page ${pageNumber}:`, error);
      handlers.onPageError(pageNumber);
    } finally {
      // Frees the page's operator list and decoded images; nothing else renders this page.
      page?.cleanup();
      const current = gen === generation;
      releaseCanvas(canvas, current);
      if (current) {
        running.delete(pageNumber);
        pump();
      }
    }
  }

  function close(): void {
    generation++;
    queue.clear();
    for (const renderTask of running.values()) renderTask?.cancel();
    running.clear();
    const loading = task;
    task = null;
    doc = null;
    // destroy() also terminates the worker PDF.js created for this document.
    if (loading) void loading.destroy().catch(() => {});
    for (const url of urls.splice(0)) URL.revokeObjectURL(url);
    for (const canvas of canvases) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  return {
    async open(file, expectedPages) {
      close();
      const gen = generation;
      const pdfjs = await loadPdfJs();
      if (gen !== generation) throw new StaleError();
      // A fresh copy for PDF.js, which transfers it to its worker (the split worker owns its own).
      const data = new Uint8Array(await file.arrayBuffer());
      if (gen !== generation) throw new StaleError();

      const base = new URL(`/vendor/pdfjs/${pdfjs.version}/`, window.location.href).href;
      const loading = pdfjs.getDocument({
        data,
        wasmUrl: `${base}wasm/`,
        cMapUrl: `${base}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${base}standard_fonts/`,
        iccUrl: `${base}iccs/`,
        enableXfa: false,
        verbosity: pdfjs.VerbosityLevel.ERRORS,
      });
      task = loading;
      let proxy: PDFDocumentProxy;
      try {
        proxy = await loading.promise;
      } catch (error) {
        // Damaged for PDF.js, or encrypted with a password (pdf-lib has already accepted the file).
        if (gen === generation) close();
        throw error;
      }
      if (gen !== generation) throw new StaleError(); // close() has destroyed `loading`
      if (proxy.numPages !== expectedPages) {
        close();
        throw new Error(`PDF.js counts ${proxy.numPages} pages, pdf-lib ${expectedPages}`);
      }
      doc = proxy;
      pump();
    },

    request(page) {
      if (running.has(page)) return;
      queue.add(page);
      pump();
    },

    cancel(page) {
      queue.delete(page);
    },

    setBox(next) {
      if (next.width > 0 && next.height > 0) box = next;
    },

    close,
  };
}
