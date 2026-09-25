/**
 * The compression engine the page talks to (browser only): decodes on the page, then
 * resamples and encodes in a Web Worker on an OffscreenCanvas, or on the page with a
 * <canvas> where the worker cannot (no OffscreenCanvas 2D, or an image only an <img> could
 * decode). Both paths share raster.ts, so they produce the same files.
 *
 * Encodes are "latest wins": while one runs, only the newest request waits; older waiting
 * requests are rejected with an AbortError. The page adds its own generation check on top.
 */

import type { EncoderSupport } from '../../../lib/image/compress/formats.ts';
import { decodeImage, type DecodedImage } from './decode.ts';
import { Rasterizer, elementSurface, failureCode, probeWebp } from './raster.ts';
import type { EncodeSpec, FromEncodeWorker, RasterFailure, ToEncodeWorker } from './types.ts';

/** 'decode': the browser cannot read the file; 'crashed': the worker died (usually memory). */
export type EngineFailure = 'decode' | 'crashed' | RasterFailure;

export class EngineError extends Error {
  readonly code: EngineFailure;

  constructor(code: EngineFailure, message: string) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
  }
}

export function abortError(): DOMException {
  return new DOMException('Superseded', 'AbortError');
}

export function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

interface Backend {
  readonly webp: boolean;
  /** Takes ownership of `decoded`. */
  load(decoded: DecodedImage, scanAlpha: boolean): Promise<{ hasAlpha: boolean }>;
  encode(spec: EncodeSpec): Promise<Blob>;
  unload(): void;
}

class MainBackend implements Backend {
  readonly webp: boolean;
  private readonly rasterizer = new Rasterizer(elementSurface);

  private constructor(webp: boolean) {
    this.webp = webp;
  }

  static async create(): Promise<MainBackend> {
    return new MainBackend(await probeWebp(elementSurface));
  }

  async load(decoded: DecodedImage, scanAlpha: boolean): Promise<{ hasAlpha: boolean }> {
    try {
      return this.rasterizer.load(decoded, scanAlpha);
    } catch (error) {
      this.rasterizer.clear();
      throw new EngineError(failureCode(error), 'Could not prepare the image');
    }
  }

  async encode(spec: EncodeSpec): Promise<Blob> {
    try {
      return await this.rasterizer.encode(spec);
    } catch (error) {
      throw new EngineError(failureCode(error), error instanceof Error ? error.message : String(error));
    }
  }

  unload(): void {
    this.rasterizer.clear();
  }
}

/** How long a new worker may take to report that it is ready before the page encodes itself. */
const WORKER_START_TIMEOUT_MS = 8000;

type Pending = { resolve(message: FromEncodeWorker): void; reject(error: Error): void };

class WorkerBackend implements Backend {
  readonly webp: boolean;
  private readonly worker: Worker;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private alive = true;

  private constructor(worker: Worker, webp: boolean) {
    this.worker = worker;
    this.webp = webp;
    worker.onmessage = (event: MessageEvent<FromEncodeWorker>) => {
      const message = event.data;
      if (message.type === 'ready') return;
      const waiting = this.pending.get(message.id);
      this.pending.delete(message.id);
      waiting?.resolve(message);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      this.die();
    };
    worker.onmessageerror = () => this.die();
  }

  /** Starts a worker; null when it cannot run here (the page then encodes on the main thread). */
  static start(): Promise<WorkerBackend | null> {
    return new Promise((resolve) => {
      let worker: Worker;
      try {
        worker = new Worker(new URL('./encode-worker.ts', import.meta.url), { type: 'module' });
      } catch {
        resolve(null);
        return;
      }
      const fail = () => {
        window.clearTimeout(timer);
        worker.terminate();
        resolve(null);
      };
      const timer = window.setTimeout(fail, WORKER_START_TIMEOUT_MS);
      worker.onmessage = (event: MessageEvent<FromEncodeWorker>) => {
        if (event.data.type !== 'ready') return;
        window.clearTimeout(timer);
        if (event.data.ok) resolve(new WorkerBackend(worker, event.data.webp));
        else fail();
      };
      worker.onerror = (event) => {
        event.preventDefault();
        fail();
      };
    });
  }

  get isAlive(): boolean {
    return this.alive;
  }

  private die(): void {
    if (!this.alive) return;
    this.alive = false;
    this.worker.terminate();
    const error = new EngineError('crashed', 'The encoder stopped unexpectedly (the device may be out of memory)');
    for (const waiting of this.pending.values()) waiting.reject(error);
    this.pending.clear();
  }

  private request(message: ToEncodeWorker, transfer: Transferable[] = []): Promise<FromEncodeWorker> {
    return new Promise((resolve, reject) => {
      if (!this.alive) {
        reject(new EngineError('crashed', 'The encoder is no longer running'));
        return;
      }
      if ('id' in message) this.pending.set(message.id, { resolve, reject });
      this.worker.postMessage(message, transfer);
    });
  }

  async load(decoded: DecodedImage, scanAlpha: boolean): Promise<{ hasAlpha: boolean }> {
    const bitmap = decoded.bitmap;
    if (!bitmap) throw new Error('The worker needs an ImageBitmap');
    // The bitmap is transferred: from here on the worker owns (and closes) it.
    const reply = await this.request({ type: 'load', id: this.nextId++, bitmap, scanAlpha }, [bitmap]);
    if (reply.type === 'loaded') return { hasAlpha: reply.hasAlpha };
    if (reply.type === 'error') throw new EngineError(reply.code, reply.message);
    throw new EngineError('encode', 'Unexpected reply from the encoder');
  }

  async encode(spec: EncodeSpec): Promise<Blob> {
    const reply = await this.request({ type: 'encode', id: this.nextId++, spec });
    if (reply.type === 'encoded') return reply.blob;
    if (reply.type === 'error') throw new EngineError(reply.code, reply.message);
    throw new EngineError('encode', 'Unexpected reply from the encoder');
  }

  unload(): void {
    if (this.alive) this.worker.postMessage({ type: 'unload' } satisfies ToEncodeWorker);
  }
}

export interface LoadedImage {
  /** Upright size (EXIF orientation applied). */
  width: number;
  height: number;
  hasAlpha: boolean;
  /** What the encoder that holds this image can write. */
  support: EncoderSupport;
}

interface Job {
  spec: EncodeSpec;
  resolve(blob: Blob): void;
  reject(error: unknown): void;
}

export class ImageEngine {
  private workerBackend: Promise<WorkerBackend | null> | null = null;
  private mainBackend: Promise<MainBackend> | null = null;
  private backend: Backend | null = null;
  private queued: Job | null = null;
  private running = false;
  /** Incremented per load and unload: an older load that finishes late must not install its image. */
  private loadToken = 0;

  /** Starts the worker ahead of the first image, so opening it is quicker. */
  warmUp(): void {
    void this.worker();
  }

  private async worker(): Promise<WorkerBackend | null> {
    this.workerBackend ??= WorkerBackend.start();
    const backend = await this.workerBackend;
    return backend?.isAlive ? backend : null;
  }

  private main(): Promise<MainBackend> {
    this.mainBackend ??= MainBackend.create();
    return this.mainBackend;
  }

  /**
   * Decodes `file` and hands it to an encoder. `scanAlpha`: look for transparent pixels;
   * `orientation`: the JPEG's EXIF orientation. Rejects with EngineError or an AbortError.
   */
  async load(file: Blob, scanAlpha: boolean, orientation = 1): Promise<LoadedImage> {
    const token = ++this.loadToken;
    this.cancelQueued();
    this.backend?.unload();
    this.backend = null;

    let decoded: DecodedImage;
    try {
      decoded = await decodeImage(file, orientation);
    } catch (error) {
      throw new EngineError('decode', error instanceof Error ? error.message : String(error));
    }
    const { width, height } = decoded;
    let owned = true;
    try {
      const worker = decoded.bitmap ? await this.worker() : null;
      const backend: Backend = worker ?? (await this.main());
      if (token !== this.loadToken) throw abortError();
      owned = false; // the backend owns the decoded image now, even if loading fails
      const { hasAlpha } = await backend.load(decoded, scanAlpha);
      // Superseded: the newer load replaces this image in the backend (unloading it here
      // could, with the worker's message order, remove the newer one instead).
      if (token !== this.loadToken) throw abortError();
      this.backend = backend;
      return { width, height, hasAlpha, support: { webp: backend.webp } };
    } finally {
      if (owned) decoded.close();
    }
  }

  /** Encodes the loaded image. Superseded requests reject with an AbortError. */
  encode(spec: EncodeSpec): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.queued?.reject(abortError());
      this.queued = { spec, resolve, reject };
      if (!this.running) void this.pump();
    });
  }

  private async pump(): Promise<void> {
    this.running = true;
    try {
      while (this.queued) {
        const job = this.queued;
        this.queued = null;
        const backend = this.backend;
        if (!backend) {
          job.reject(new EngineError('encode', 'No image is loaded'));
          continue;
        }
        try {
          job.resolve(await backend.encode(job.spec));
        } catch (error) {
          job.reject(error);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private cancelQueued(): void {
    this.queued?.reject(abortError());
    this.queued = null;
  }

  /** Forgets the current image and frees its memory. */
  unload(): void {
    this.loadToken += 1;
    this.cancelQueued();
    this.backend?.unload();
    this.backend = null;
  }
}
