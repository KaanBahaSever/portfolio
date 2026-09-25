/**
 * Which format the compressed image is written in. Pure: no DOM.
 *
 * Browsers can encode JPEG and PNG everywhere and WebP in most engines (Safari writes PNG
 * when asked for WebP, so support is detected at run time and passed in). Everything else a
 * browser can open (GIF, AVIF, HEIC, BMP, …) can be read but not written.
 */

import type { ImageFormat } from '../sniff.ts';
import type { FormatChoice } from './settings.ts';

export type OutputFormat = 'jpeg' | 'png' | 'webp';
export type OutputMime = 'image/jpeg' | 'image/png' | 'image/webp';

export const OUTPUT_MIME: Readonly<Record<OutputFormat, OutputMime>> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Display names of formats. They are proper names, identical in every language. */
export const FORMAT_LABELS: Readonly<Record<ImageFormat, string>> = {
  jpeg: 'JPEG',
  png: 'PNG',
  gif: 'GIF',
  webp: 'WebP',
  bmp: 'BMP',
  tiff: 'TIFF',
  ico: 'ICO',
  avif: 'AVIF',
  heic: 'HEIC',
  jxl: 'JPEG XL',
  svg: 'SVG',
  unknown: '?',
};

/** What the encoder in this browser can write besides JPEG and PNG. */
export interface EncoderSupport {
  webp: boolean;
}

/**
 * Codes the page turns into explanations:
 * - png-lossless: PNG output, so the quality setting has no effect.
 * - alpha-flattened: JPEG output of a transparent image; transparent areas become white.
 * - webp-unsupported: WebP was wanted (chosen, or as the original format) but cannot be written here.
 * - original-not-writable: "Original" was chosen but browsers cannot write the source format.
 */
export type FormatNote = 'png-lossless' | 'alpha-flattened' | 'webp-unsupported' | 'original-not-writable';

export interface FormatDecision {
  format: OutputFormat;
  mime: OutputMime;
  /** Whether the quality setting applies. */
  lossy: boolean;
  /** Draw on white first: the output cannot store transparency the source has. */
  flattenAlpha: boolean;
  notes: FormatNote[];
}

export interface FormatInput {
  choice: FormatChoice;
  source: ImageFormat;
  /** The decoded image has at least one pixel that is not fully opaque. */
  hasAlpha: boolean;
  support: EncoderSupport;
}

function decision(format: OutputFormat, hasAlpha: boolean, notes: FormatNote[]): FormatDecision {
  const flattenAlpha = format === 'jpeg' && hasAlpha;
  const all = [...notes];
  if (format === 'png') all.push('png-lossless');
  if (flattenAlpha) all.push('alpha-flattened');
  return { format, mime: OUTPUT_MIME[format], lossy: format !== 'png', flattenAlpha, notes: all };
}

/**
 * Without WebP, a transparent image stays PNG (keeping its transparency matters more than
 * size) and an opaque one becomes JPEG.
 */
function withoutWebp(hasAlpha: boolean): OutputFormat {
  return hasAlpha ? 'png' : 'jpeg';
}

export function decideOutputFormat({ choice, source, hasAlpha, support }: FormatInput): FormatDecision {
  if (choice === 'jpeg') return decision('jpeg', hasAlpha, []);

  if (choice === 'webp') {
    return support.webp ? decision('webp', hasAlpha, []) : decision(withoutWebp(hasAlpha), hasAlpha, ['webp-unsupported']);
  }

  // 'original'
  switch (source) {
    case 'jpeg':
      return decision('jpeg', hasAlpha, []);
    case 'png':
      return decision('png', hasAlpha, []);
    case 'webp':
      return support.webp
        ? decision('webp', hasAlpha, [])
        : decision(withoutWebp(hasAlpha), hasAlpha, ['webp-unsupported']);
    default:
      // GIF, AVIF, HEIC, BMP, …: WebP keeps transparency at a small size; otherwise as above.
      return decision(support.webp ? 'webp' : withoutWebp(hasAlpha), hasAlpha, ['original-not-writable']);
  }
}

/** Whether "Original" writes the source format itself (the option label can then name it). */
export function isWritableSource(source: ImageFormat, support: EncoderSupport): boolean {
  return source === 'jpeg' || source === 'png' || (source === 'webp' && support.webp);
}
