/**
 * Web Worker that resamples and encodes the image on an OffscreenCanvas (browser only), so
 * a multi-second WebP encode of a large photo never freezes the page.
 *
 * The decoded image arrives once, as a transferred ImageBitmap, and stays here until the
 * next one replaces it. Messages are handled strictly one at a time: a 'load' that arrives
 * during an encode waits for it, so a bitmap is never closed while it is being drawn.
 */

import { Rasterizer, failureCode, offscreenSurface, probeWebp } from './raster.ts';
import type { FromEncodeWorker, ToEncodeWorker } from './types.ts';

const scope = self as unknown as {
  postMessage(message: FromEncodeWorker): void;
  onmessage: ((event: MessageEvent<ToEncodeWorker>) => void) | null;
};

const rasterizer = new Rasterizer(offscreenSurface);
let queue: Promise<void> = Promise.resolve();

function post(message: FromEncodeWorker): void {
  scope.postMessage(message);
}

function postError(id: number, error: unknown): void {
  post({ type: 'error', id, code: failureCode(error), message: error instanceof Error ? error.message : String(error) });
}

async function handle(message: ToEncodeWorker): Promise<void> {
  switch (message.type) {
    case 'load': {
      const { bitmap } = message;
      try {
        const { hasAlpha } = rasterizer.load(
          { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() },
          message.scanAlpha,
        );
        post({ type: 'loaded', id: message.id, hasAlpha });
      } catch (error) {
        rasterizer.clear();
        postError(message.id, error);
      }
      break;
    }
    case 'encode':
      try {
        post({ type: 'encoded', id: message.id, blob: await rasterizer.encode(message.spec) });
      } catch (error) {
        postError(message.id, error);
      }
      break;
    case 'unload':
      rasterizer.clear();
      break;
    default:
      break;
  }
}

scope.onmessage = (event) => {
  const message = event.data;
  queue = queue.then(() => handle(message));
};

// Report what this worker can do. Safari before 16.4 has OffscreenCanvas without a 2D
// context; the page then encodes on the main thread instead.
void (async () => {
  let ok = false;
  let webp = false;
  try {
    offscreenSurface(1, 1).release();
    ok = true;
    webp = await probeWebp(offscreenSurface);
  } catch {
    ok = false;
  }
  post({ type: 'ready', ok, webp });
})();
