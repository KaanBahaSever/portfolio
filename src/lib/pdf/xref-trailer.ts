/**
 * Works around how pdf-lib 1.17.1 reads trailers from cross-reference streams. No DOM: used
 * by the PDF split and compression workers and under Node in tests.
 *
 * The page scripts must not import this module (it would bundle pdf-lib into the page).
 */

import { PDFXRefStreamParser } from 'pdf-lib';
import type { PDFContext } from 'pdf-lib';

const TRAILER_KEYS = ['Root', 'Encrypt', 'Info', 'ID'] as const;

/**
 * pdf-lib 1.17.1 reads the file front to back and lets every cross-reference stream replace
 * the whole trailer, while a classic `trailer` dictionary only overrides the entries it has.
 * The main xref stream of a linearized file often carries only /Size, so /Info, /ID and
 * /Encrypt from the first-page section were lost: metadata and the file ID disappeared, and
 * an encrypted file looked unencrypted. Entries a section omits now keep their earlier
 * values, as with classic trailers. Call before `PDFDocument.load`. Idempotent; affects only
 * this realm (the worker).
 */
export function keepTrailerEntriesAcrossXRefStreams(): void {
  const prototype = PDFXRefStreamParser.prototype as unknown as {
    parseIntoContext(this: { context: PDFContext }): unknown;
    keepsEarlierTrailerEntries?: boolean;
  };
  if (prototype.keepsEarlierTrailerEntries) return;
  const parseIntoContext = prototype.parseIntoContext;
  prototype.parseIntoContext = function (this: { context: PDFContext }) {
    const earlier = { ...this.context.trailerInfo };
    try {
      return parseIntoContext.call(this);
    } finally {
      const trailer = this.context.trailerInfo;
      for (const key of TRAILER_KEYS) trailer[key] ??= earlier[key];
    }
  };
  prototype.keepsEarlierTrailerEntries = true;
}
