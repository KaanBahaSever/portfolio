/**
 * Link helpers for project cards and pages.
 *
 * Pure module (no `astro:*` imports, erasable TypeScript, '.ts' extensions) so `node --test`
 * can load it.
 */
import { DEFAULT_LOCALE, localizePath, type Locale } from '../../i18n/config.ts';

/** 'https://www.asion.app/beta' → 'asion.app'. Falls back to the input for unparsable URLs. */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Code hosts are named the way people say them ("GitHub"); anything else shows its host. */
const CODE_HOSTS: Readonly<Record<string, string>> = {
  'github.com': 'GitHub',
  'gitlab.com': 'GitLab',
  'codeberg.org': 'Codeberg',
  'bitbucket.org': 'Bitbucket',
};

export function codeHostName(url: string): string {
  const host = displayHost(url);
  return CODE_HOSTS[host] ?? host;
}

export interface LiveLink {
  href: string;
  /** False for a page on this site ('/tools/pdf-split/'), which opens in the same tab. */
  external: boolean;
  /** Host shown on buttons ("asion.app"); empty for internal links. */
  host: string;
}

/**
 * Where a project's live version lives. Site paths get the page locale's prefix, so a Turkish
 * page links to the Turkish tool; absolute URLs are returned as they are.
 */
export function liveLink(liveUrl: string | undefined, locale: Locale): LiveLink | undefined {
  if (!liveUrl) return undefined;
  const internal = liveUrl.startsWith('/') && !liveUrl.startsWith('//');
  return internal
    ? { href: localizePath(liveUrl, locale), external: false, host: '' }
    : { href: liveUrl, external: true, host: displayHost(liveUrl) };
}

/**
 * Adds the locale prefix to site links in rendered project Markdown, so bodies can write
 * locale-free paths ('/about/#journey') in every language, and an English body shown on a
 * Turkish page as a fallback still links to Turkish pages.
 *
 * Only page paths are rewritten: the path must end in '/' (Astro builds every page as a
 * directory), so files such as '/cv/kaan-cv.pdf' keep their address. Absolute and
 * protocol-relative URLs, fragments and already prefixed paths are left alone.
 */
export function localizeProseLinks(html: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return html;
  return html.replace(
    /(<a\b[^>]*?\shref=)(["'])(\/(?!\/)(?:[^"'#?]*\/)?)([?#][^"']*)?\2/gi,
    (_match, start: string, quote: string, path: string, rest: string | undefined) =>
      `${start}${quote}${localizePath(path, locale)}${rest ?? ''}${quote}`,
  );
}
