/**
 * Links to the CV PDFs (one per language, built by `npm run cv`; see SITE.cvPath). Every CV link
 * on the site takes its attributes from here, so the file, the name it is saved under and the
 * language it declares always agree.
 *
 * Pure module, so tests can import it with `node --test`.
 */
import { SITE } from '../config/site.ts';
import { LOCALE_META, type Locale } from '../i18n/config.ts';

export interface CvLinkAttributes {
  href: string;
  /** The file name the download is saved under (ASCII). */
  download: string;
  /** The language of the CV itself. */
  hreflang: string;
  type: 'application/pdf';
}

/** Attributes for an <a> that downloads the CV in `locale`. */
export function cvLink(locale: Locale): CvLinkAttributes {
  return {
    href: SITE.cvPath[locale],
    download: SITE.cvFileName[locale],
    hreflang: LOCALE_META[locale].htmlLang,
    type: 'application/pdf',
  };
}
