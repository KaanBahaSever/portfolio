/**
 * Decoding on the page (browser only). createImageBitmap decodes off the main thread in most
 * engines and, with imageOrientation 'from-image', applies EXIF orientation, so phone photos
 * come out upright. An <img> element (which every current engine draws upright) is the
 * fallback for formats createImageBitmap rejects, and for rotated JPEGs in engines whose
 * createImageBitmap ignores the orientation.
 */

import { insertExifOrientation } from '../../../lib/image/jpeg-info.ts';
import type { RasterSource } from './raster.ts';

export interface DecodedImage extends RasterSource {
  /** Set when decoded with createImageBitmap: the bitmap can be transferred to the worker. */
  bitmap: ImageBitmap | null;
}

async function decodeWithBitmap(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap !== 'function') throw new Error('createImageBitmap is not supported');
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  if (!bitmap.width || !bitmap.height) {
    bitmap.close();
    throw new Error('Decoded image is empty');
  }
  return { image: bitmap, width: bitmap.width, height: bitmap.height, bitmap, close: () => bitmap.close() };
}

async function decodeWithElement(blob: Blob): Promise<DecodedImage> {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  const close = () => {
    image.removeAttribute('src');
    URL.revokeObjectURL(url);
  };
  try {
    // The load event, not decode(): decode() may stay pending while the page is not rendering
    // (a background tab), and a loaded image can be drawn to a canvas either way.
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The image could not be loaded'));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Decoded image is empty');
  } catch (error) {
    close();
    throw error;
  }
  // The object URL is revoked in close(), once the image is no longer drawn.
  return { image, width: image.naturalWidth, height: image.naturalHeight, bitmap: null, close };
}

let bitmapOrientation: Promise<boolean> | null = null;

/**
 * Whether createImageBitmap applies EXIF orientation here. Memoized: a 2 × 1 JPEG tagged
 * "rotate 90°" (orientation 6) decodes as 1 × 2 when it does.
 */
function bitmapAppliesOrientation(): Promise<boolean> {
  bitmapOrientation ??= (async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 1;
    try {
      const context = canvas.getContext('2d');
      if (!context) return true;
      context.fillRect(0, 0, 2, 1);
      const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!jpeg) return true;
      const rotated = insertExifOrientation(new Uint8Array(await jpeg.arrayBuffer()), 6);
      const decoded = await decodeWithBitmap(new Blob([rotated as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }));
      decoded.close();
      return decoded.width === 1 && decoded.height === 2;
    } catch {
      // Detection failed: current engines do apply it, so keep the faster path.
      return true;
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  })();
  return bitmapOrientation;
}

/**
 * Decodes an image file; rejects when neither way can read it. `orientation` is the JPEG's
 * EXIF orientation (1 for upright images and other formats).
 */
export async function decodeImage(blob: Blob, orientation = 1): Promise<DecodedImage> {
  if (orientation !== 1 && !(await bitmapAppliesOrientation())) return decodeWithElement(blob);
  try {
    return await decodeWithBitmap(blob);
  } catch {
    return decodeWithElement(blob);
  }
}
