/**
 * The x value under the hole in the 404 figure: the address the visitor asked for, so /abc
 * shows "abc" (the owner asked for it). Cloudflare Pages serves the same 404.html for every
 * missing URL, so the label is filled in by the browser from location.pathname.
 *
 * Pure module: `node --test` imports it (tests/not-found-label.test.ts).
 */

/**
 * Longest label, in characters: 22 monospace characters at 12px (~160 of the figure’s 320 units)
 * still sit centered under the hole without reaching the y axis.
 */
export const NOT_FOUND_LABEL_MAX = 22;

/**
 * The path without its slashes and locale prefix, percent-decoded where that is valid, with
 * control characters dropped. Long labels keep their start and end around a middle "…", since
 * both ends tend to matter (the section and the page). Returns null when nothing is left.
 */
export function notFoundLabel(pathname: string, localePrefix = '', max = NOT_FOUND_LABEL_MAX): string | null {
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    // A malformed escape (e.g. /%E0): show the address as typed.
  }
  path = path.replace(/[\u0000-\u001f\u007f]/g, '').replace(/^\/+|\/+$/g, '');
  if (localePrefix && (path === localePrefix || path.startsWith(`${localePrefix}/`))) {
    path = path.slice(localePrefix.length).replace(/^\/+/, '');
  }
  if (!path) return null;

  // Code points, so a long Turkish or emoji label is never cut inside a character.
  const chars = Array.from(path);
  if (chars.length <= max) return path;
  const head = Math.ceil((max - 1) / 2);
  const tail = max - 1 - head;
  return `${chars.slice(0, head).join('')}…${chars.slice(chars.length - tail).join('')}`;
}
