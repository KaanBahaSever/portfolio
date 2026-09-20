/**
 * PDF file detection and output naming. Pure: no DOM, runs under Node.
 */

/** Bytes to read from the start of a file before deciding whether it is a PDF. */
export const PDF_SNIFF_BYTES = 1024;

const SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

/**
 * True when "%PDF-" appears within the first 1024 bytes. Viewers (and pdf-lib) accept
 * junk before the header, such as a mail or HTTP preamble, so the signature may not be at 0.
 */
export function looksLikePdf(head: Uint8Array): boolean {
  const end = Math.min(head.length, PDF_SNIFF_BYTES) - SIGNATURE.length;
  outer: for (let i = 0; i <= end; i++) {
    for (let j = 0; j < SIGNATURE.length; j++) {
      if (head[i + j] !== SIGNATURE[j]) continue outer;
    }
    return true;
  }
  return false;
}

const MAX_BASE_CODE_POINTS = 80;

/** "Report.pdf" -> "Report-compressed.pdf"; unsafe characters are cleaned by toPdfFilename. */
export function compressedBaseName(originalName: string): string {
  const base = String(originalName ?? '').replace(/\.pdf$/i, '').trim();
  const shortened = Array.from(base).slice(0, MAX_BASE_CODE_POINTS).join('').trim();
  return `${shortened || 'document'}-compressed.pdf`;
}
