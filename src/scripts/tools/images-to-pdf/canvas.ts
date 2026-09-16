/**
 * Canvas helpers that respect mobile browser limits.
 */

/** iOS Safari refuses canvases above 16,777,216 pixels (4096 x 4096). */
export const MAX_CANVAS_AREA = 16_777_216;
/** Common per-side limit (Chrome/Firefox/Safari). */
export const MAX_CANVAS_SIDE = 16_384;

/** Integer canvas size for a w x h source, downscaled (never upscaled) to the limits. */
export function fitCanvasSize(width: number, height: number, maxLongSide = Infinity): { width: number; height: number } {
  const longSide = Math.max(width, height);
  const scale = Math.min(
    1,
    maxLongSide / longSide,
    MAX_CANVAS_SIDE / longSide,
    Math.sqrt(MAX_CANVAS_AREA / (width * height)),
  );
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  // document.createElement (not OffscreenCanvas) for broad Safari support.
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Frees the backing store right away (Safari keeps it until GC otherwise). */
export function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

export function get2dContext(
  canvas: HTMLCanvasElement,
  options?: CanvasRenderingContext2DSettings,
): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', options);
  if (!context) throw new Error('Canvas 2D is not available (the image may be too large for this device)');
  return context;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: 'image/jpeg' | 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not encode the image (the device may be out of memory)'));
      },
      type,
      quality,
    );
  });
}

/** True if any pixel has alpha < 255. Reads in row chunks to cap memory. */
export function hasTransparency(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  const rowsPerChunk = Math.max(1, Math.floor(1_048_576 / width)); // ~4 MB of RGBA per read
  for (let y = 0; y < height; y += rowsPerChunk) {
    const rows = Math.min(rowsPerChunk, height - y);
    const data = context.getImageData(0, y, width, rows).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 255) return true;
    }
  }
  return false;
}
