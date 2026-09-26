/**
 * Checks that a printed CV is set in the site's typefaces. When the browser cannot read the
 * @fontsource files (a missing or renamed file, a wrong path, blocked file access), it does not
 * fail: it quietly prints the CV in system fonts (Segoe UI, Georgia, Consolas…), and the result
 * still has two pages and no Type 3 fonts. If only the latin-ext files failed, the Turkish CV
 * would even mix typefaces inside words, since ğ, ş and İ come from those files. So the builder
 * (scripts/build-cv.ts) and the tests (tests/cv-data.test.ts) both read the embedded font names.
 *
 * Pure module (pdf-lib only), so `node --test` imports it.
 */
import { PDFDict, PDFName, type PDFDocument } from 'pdf-lib';

/** The families the CV stylesheet uses, as they begin the embedded PostScript font names. */
export const CV_FONT_FAMILIES = ['IBMPlexSans', 'JetBrainsMono', 'Newsreader'] as const;

/** The /BaseFont of every font dictionary in `pdf`, without the subset tag ("ABCDEF+"), sorted. */
export function embeddedFontNames(pdf: PDFDocument): string[] {
  const names = new Set<string>();
  for (const [, object] of pdf.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict) || object.get(PDFName.of('Type')) !== PDFName.of('Font')) continue;
    const base = object.get(PDFName.of('BaseFont'));
    if (base instanceof PDFName) names.add(base.decodeText().replace(/^[A-Z]{6}\+/, ''));
  }
  return [...names].sort();
}

/**
 * Why `pdf` is not set in exactly the site's typefaces (a font from elsewhere, or one of the
 * three families missing), or undefined when it is.
 */
export function fontFallbackProblem(pdf: PDFDocument): string | undefined {
  const names = embeddedFontNames(pdf);
  const foreign = names.filter((name) => !CV_FONT_FAMILIES.some((family) => name.startsWith(family)));
  const missing = CV_FONT_FAMILIES.filter((family) => !names.some((name) => name.startsWith(family)));
  if (foreign.length === 0 && missing.length === 0) return undefined;
  return [
    foreign.length ? `fonts from outside the site: ${foreign.join(', ')}` : '',
    missing.length ? `missing: ${missing.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('; ');
}
