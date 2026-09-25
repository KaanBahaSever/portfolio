/**
 * Download names for compressed images: "photo.jpg" → "photo-compressed.webp". Pure: no DOM.
 * The words added to a name (the suffix, and the base used when nothing of the original is
 * usable) come from the page's language, as in Split PDF: "foto-sıkıştırılmış.webp" on the
 * Turkish page. The user's own base name is kept as typed, in any script.
 */

import type { OutputFormat } from './formats.ts';

const EXTENSIONS: Readonly<Record<OutputFormat, string>> = { jpeg: '.jpg', png: '.png', webp: '.webp' };
/** Control characters (C0, DEL, C1) and characters reserved on common file systems. */
const UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f<>:"/\\|?*]/g;
/** A trailing extension: a dot and 1–5 letters or digits ("photo.JPEG", "scan.tiff", "a.b2"). */
const EXTENSION = /\.[a-z0-9]{1,5}$/i;
const MAX_BASE_CODE_POINTS = 80;

/**
 * The words in generated file names. The page passes its language's words (the image
 * compressor catalogue's outputNames); the defaults are English and what the tests pin.
 */
export interface OutputNames {
  /** Appended to the base name: "photo-compressed.webp". */
  suffix: string;
  /** Base name when nothing usable is left of the original: "image-compressed.webp". */
  fallbackBase: string;
}

export const DEFAULT_OUTPUT_NAMES: Readonly<OutputNames> = { suffix: '-compressed', fallbackBase: 'image' };
/** The English defaults, kept as named exports for existing imports. */
export const FALLBACK_BASE_NAME = DEFAULT_OUTPUT_NAMES.fallbackBase;
export const COMPRESSED_SUFFIX = DEFAULT_OUTPUT_NAMES.suffix;

/** The file extension for an output format; JPEG keeps ".jpeg" when the original used it. */
export function extensionFor(format: OutputFormat, originalName = ''): string {
  if (format === 'jpeg' && /\.jpeg$/i.test(originalName.trim())) return '.jpeg';
  return EXTENSIONS[format];
}

/** The user's file name without its extension, made safe to save on any system. */
export function baseName(originalName: string, fallback: string = DEFAULT_OUTPUT_NAMES.fallbackBase): string {
  let name = String(originalName ?? '')
    .replace(/\s+/g, ' ') // tabs and newlines become spaces before control characters go
    .replace(UNSAFE_CHARS, '')
    .trim()
    .replace(EXTENSION, '');
  name = name
    .replace(/^[\s.]+/, '') // no hidden (dot) files
    .replace(/[\s.]+$/, ''); // Windows drops trailing dots and spaces
  const codePoints = Array.from(name);
  if (codePoints.length > MAX_BASE_CODE_POINTS) {
    name = codePoints.slice(0, MAX_BASE_CODE_POINTS).join('').replace(/[\s.]+$/, '');
  }
  return name || fallback;
}

/** "IMG_2041.HEIC" + webp → "IMG_2041-compressed.webp" (English words by default). */
export function outputFileName(
  originalName: string,
  format: OutputFormat,
  names: Readonly<OutputNames> = DEFAULT_OUTPUT_NAMES,
): string {
  return `${baseName(originalName, names.fallbackBase)}${names.suffix}${extensionFor(format, originalName)}`;
}
