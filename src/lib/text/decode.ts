/**
 * Decoding the bytes of an opened text file. Pure: no DOM.
 */

export type TextFileEncoding = 'utf-8' | 'utf-16le' | 'utf-16be';

/**
 * The encoding a byte order mark announces, or UTF-8 without one. Windows PowerShell 5.1
 * redirection and Notepad's "Unicode" option write UTF-16LE with FF FE.
 */
export function detectEncoding(bytes: Uint8Array): TextFileEncoding {
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  }
  return 'utf-8';
}

/**
 * Decodes like Blob.text() (invalid sequences become U+FFFD, a UTF-8 BOM is dropped) but also
 * reads UTF-16 files that start with a byte order mark. The BOM is never part of the text.
 */
export function decodeTextFile(bytes: Uint8Array): { text: string; encoding: TextFileEncoding } {
  const encoding = detectEncoding(bytes);
  return { text: new TextDecoder(encoding).decode(bytes), encoding };
}
