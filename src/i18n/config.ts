/**
 * Locale configuration and pure path helpers, shared by pages, client scripts and tests.
 *
 * English lives at the site root ('/about/'), Turkish under '/tr/' ('/tr/about/'). Slugs are the
 * same in both languages, so switching language only adds or removes the prefix.
 *
 * Pure module: no `astro:*` imports and erasable TypeScript only, so `node --test` can load it.
 * Keep LOCALES in sync with `i18n.locales` in astro.config.mjs.
 */

export const LOCALES = ['en', 'tr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** localStorage key holding the language the visitor picked with the header toggle. */
export const LOCALE_STORAGE_KEY = 'locale';

export const LOCALE_META = {
  en: { htmlLang: 'en', intl: 'en-US', og: 'en_US', name: 'English', short: 'EN' },
  tr: { htmlLang: 'tr', intl: 'tr-TR', og: 'tr_TR', name: 'Türkçe', short: 'TR' },
} as const satisfies Record<Locale, { htmlLang: string; intl: string; og: string; name: string; short: string }>;

/** A value that exists once per locale; the compiler enforces that none is missing. */
export type Localized<T> = Readonly<Record<Locale, T>>;

export function isLocale(value: unknown): value is Locale {
  return (LOCALES as readonly unknown[]).includes(value);
}

/** Picks the value for `locale` from a Localized record. */
export function pick<T>(value: Localized<T>, locale: Locale): T {
  return value[locale];
}

/** The other locale; with two locales this is what the language toggle links to. */
export function otherLocale(locale: Locale): Locale {
  return locale === 'en' ? 'tr' : 'en';
}

/**
 * Splits a site path into its locale and the locale-free path.
 *   '/tr/about/' → { locale: 'tr', path: '/about/' }
 *   '/tr'        → { locale: 'tr', path: '/' }
 *   '/about/'    → { locale: 'en', path: '/about/' }
 */
export function stripLocale(pathname: string): { locale: Locale; path: string } {
  const match = /^\/([a-z]{2})(?=\/|$)(.*)$/.exec(pathname);
  if (match && isLocale(match[1]) && match[1] !== DEFAULT_LOCALE) {
    const rest = match[2] ?? '';
    return { locale: match[1], path: rest === '' ? '/' : rest };
  }
  return { locale: DEFAULT_LOCALE, path: pathname === '' ? '/' : pathname };
}

/**
 * Adds the locale prefix to a locale-free site path (keeps query strings and fragments).
 *   localizePath('/about/', 'tr') → '/tr/about/'
 *   localizePath('/', 'tr')       → '/tr/'
 *   localizePath('/#projects', 'tr') → '/tr/#projects'
 * External URLs, mailto: links and protocol-relative URLs are returned unchanged.
 */
export function localizePath(path: string, locale: Locale): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  const { path: bare } = stripLocale(path);
  return locale === DEFAULT_LOCALE ? bare : `/${locale}${bare}`;
}

/** The same page in another locale: '/tr/blog/' → '/blog/' for 'en'. */
export function switchLocalePath(pathname: string, locale: Locale): string {
  return localizePath(stripLocale(pathname).path, locale);
}
