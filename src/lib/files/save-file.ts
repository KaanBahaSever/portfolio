/**
 * File names and MIME types for saving user text. Pure: no DOM.
 */

const MAX_LENGTH = 150;
const DEFAULT_EXTENSION = '.txt';

// Control characters (C0, DEL, C1) and characters reserved on common file systems.
const UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f<>:"/\\|?*]/g;

/**
 * An extension is a final dot followed by up to 16 letters, digits, "_", "-" or "+",
 * with at least one letter: "notes.md", "archive.7z", but not "Version 2.5" or "Mr. Smith".
 */
const EXTENSION = /\.(?=[\p{L}\p{N}_+-]*\p{L})[\p{L}\p{N}_+-]{1,16}$/u;

/** Windows device names, reserved with or without an extension ("con.txt" too). */
const RESERVED_NAME = /^(?:CON|PRN|AUX|NUL|COM[0-9¹²³]|LPT[0-9¹²³])(?:\s*\..*)?$/i;

function extensionOf(name: string): string {
  return EXTENSION.exec(name)?.[0] ?? '';
}

/**
 * Turns user input into a safe download name that keeps the extension the user typed
 * ("data.json", "script.md"); names without one get ".txt". Empty -> fallback.
 */
export function sanitizeFilename(input: string, fallback = 'untitled.txt'): string {
  let name = String(input ?? '')
    .replace(/\s+/g, ' ') // tabs and line breaks become spaces before control chars are removed
    .replace(UNSAFE_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '');

  if (!name) return fallback;

  let extension = extensionOf(name);
  if (!extension) {
    extension = DEFAULT_EXTENSION;
    name += extension;
  }

  if (RESERVED_NAME.test(name)) name = `_${name}`;

  const codePoints = Array.from(name);
  if (codePoints.length > MAX_LENGTH) {
    // Cut the base name by code points (never inside an emoji's surrogate pair).
    const base = codePoints
      .slice(0, MAX_LENGTH - Array.from(extension).length)
      .join('')
      .replace(/[.\s]+$/, '');
    name = base + extension;
  }

  return name;
}

const MIME_TYPES: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  cjs: 'text/javascript',
  // Plain text on purpose: the registered type for .ts is video/mp2t.
  ts: 'text/plain',
  tsx: 'text/plain',
  xml: 'application/xml',
  svg: 'image/svg+xml',
  yml: 'text/yaml',
  yaml: 'text/yaml',
};

/** MIME type for a saved text file, chosen by extension; everything is labelled UTF-8. */
export function mimeTypeForFilename(name: string): string {
  const dot = name.lastIndexOf('.');
  const extension = dot === -1 ? '' : name.slice(dot + 1).trim().toLowerCase();
  const type = Object.hasOwn(MIME_TYPES, extension) ? MIME_TYPES[extension]! : 'text/plain';
  return `${type}; charset=utf-8`;
}
