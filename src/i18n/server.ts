/**
 * Helpers for .astro pages and components. Astro's i18n routing (astro.config.mjs) sets
 * `Astro.currentLocale` from the URL, so components read the locale themselves instead of
 * receiving it as a prop.
 */
import { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from './config.ts';

/** The page's locale ('en' at the root, 'tr' under /tr/). */
export function getLocale(astro: { currentLocale?: string | undefined }): Locale {
  return isLocale(astro.currentLocale) ? astro.currentLocale : DEFAULT_LOCALE;
}

/** The `lang` route parameter for a locale: undefined for English (no prefix), 'tr' for Turkish. */
export function langParam(locale: Locale): string | undefined {
  return locale === DEFAULT_LOCALE ? undefined : locale;
}

/**
 * getStaticPaths() result for a page under src/pages/[...lang]/ that exists once per locale.
 *
 *   export const getStaticPaths = (() => localeStaticPaths()) satisfies GetStaticPaths;
 */
export function localeStaticPaths(): { params: { lang: string | undefined }; props: { locale: Locale } }[] {
  return LOCALES.map((locale) => ({ params: { lang: langParam(locale) }, props: { locale } }));
}
