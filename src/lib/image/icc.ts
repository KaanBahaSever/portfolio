/**
 * Minimal ICC profile header checks. Pure: no DOM, runs under Node.
 */

export interface IccProfile {
  /** The profile bytes, trimmed to the size declared in the header. */
  data: Uint8Array;
  /** Colour components the profile describes: 1 (gray), 3 (RGB) or 4 (CMYK). */
  components: 1 | 3 | 4;
}

const HEADER_SIZE = 128;
const COLOR_SPACES = new Map<string, 1 | 3 | 4>([
  ['GRAY', 1],
  ['RGB ', 3],
  ['CMYK', 4],
]);
/** Device classes a PDF ICCBased colour space can use (not link, abstract or named colour). */
const DEVICE_CLASSES = new Set(['mntr', 'scnr', 'prtr', 'spac']);

function ascii(bytes: Uint8Array, start: number): string {
  return String.fromCharCode(bytes[start]!, bytes[start + 1]!, bytes[start + 2]!, bytes[start + 3]!);
}

/**
 * Validates an ICC profile header. Returns null for anything a PDF viewer might reject:
 * too short, a declared size larger than the data, a missing 'acsp' signature, an
 * unsupported device class or a colour space other than gray, RGB or CMYK.
 */
export function readIccProfile(bytes: Uint8Array): IccProfile | null {
  if (bytes.length < HEADER_SIZE + 4) return null;
  const size = ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0;
  if (size < HEADER_SIZE + 4 || size > bytes.length) return null;
  if (ascii(bytes, 36) !== 'acsp') return null;
  if (!DEVICE_CLASSES.has(ascii(bytes, 12))) return null;
  const components = COLOR_SPACES.get(ascii(bytes, 16));
  if (!components) return null;
  return { data: size === bytes.length ? bytes : bytes.subarray(0, size), components };
}
