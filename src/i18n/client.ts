/**
 * Browser-side locale lookup for client scripts. BaseLayout renders <html lang="en|tr">,
 * so controllers pick their message catalogue with:
 *
 *   import { notepadMessages } from '../../../i18n/tools/notepad.ts';
 *   const m = notepadMessages[getPageLocale()];
 */
import { DEFAULT_LOCALE, isLocale, type Locale } from './config.ts';

export function getPageLocale(): Locale {
  const lang = document.documentElement.lang.slice(0, 2).toLowerCase();
  return isLocale(lang) ? lang : DEFAULT_LOCALE;
}
