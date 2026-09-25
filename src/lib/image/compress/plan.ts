/**
 * Turns the source image, the user's settings and what this device can do into one encode
 * job: output format, size, quality and background. Pure: no DOM.
 */

import type { ImageFormat } from '../sniff.ts';
import { decideOutputFormat, type EncoderSupport, type FormatNote, type OutputFormat, type OutputMime } from './formats.ts';
import { WEBP_MAX_SIDE, fitSize, type FitReason } from './fit.ts';
import { encoderQuality, type CompressSettings } from './settings.ts';

export interface SourceImage {
  format: ImageFormat;
  /** Upright size, after EXIF orientation. */
  width: number;
  height: number;
  hasAlpha: boolean;
}

export interface DeviceLimits {
  maxArea: number;
  maxSide: number;
}

/** Format notes plus the two size notes (the device or the encoder made the image smaller). */
export type PlanNote = FormatNote | 'canvas-limit' | 'encoder-limit';

export interface EncodePlan {
  format: OutputFormat;
  mime: OutputMime;
  /** 0–1 for lossy formats; null for PNG, whose encoder ignores quality. */
  quality: number | null;
  width: number;
  height: number;
  /** Fill drawn under the image (JPEG output of a transparent image), or null. */
  background: string | null;
  resizedBy: FitReason;
  notes: PlanNote[];
}

/** JPEG has no alpha channel: transparent pixels are composited onto white, like on paper. */
export const FLATTEN_BACKGROUND = '#ffffff';

export function planEncode(
  source: SourceImage,
  settings: CompressSettings,
  support: EncoderSupport,
  device: DeviceLimits,
): EncodePlan {
  const decision = decideOutputFormat({ choice: settings.format, source: source.format, hasAlpha: source.hasAlpha, support });
  const fit = fitSize(source.width, source.height, {
    maxLongSide: settings.maxDimension,
    maxArea: device.maxArea,
    maxSide: device.maxSide,
    ...(decision.format === 'webp' ? { encoderMaxSide: WEBP_MAX_SIDE } : {}),
  });

  const notes: PlanNote[] = [...decision.notes];
  if (fit.reason === 'canvas') notes.push('canvas-limit');
  if (fit.reason === 'encoder') notes.push('encoder-limit');

  return {
    format: decision.format,
    mime: decision.mime,
    quality: decision.lossy ? encoderQuality(settings.quality) : null,
    width: fit.width,
    height: fit.height,
    background: decision.flattenAlpha ? FLATTEN_BACKGROUND : null,
    resizedBy: fit.reason,
    notes,
  };
}

/**
 * Whether two plans produce the same file, so the second encode can be skipped (moving the
 * quality slider while the output is PNG changes nothing).
 */
export function samePlanOutput(a: EncodePlan | null, b: EncodePlan | null): boolean {
  if (!a || !b) return false;
  return (
    a.mime === b.mime &&
    a.quality === b.quality &&
    a.width === b.width &&
    a.height === b.height &&
    a.background === b.background
  );
}
