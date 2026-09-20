/**
 * Swaps an image XObject's data for a new JPEG. Pure: no DOM, runs under Node.
 */

import { PDFDict, PDFName, PDFNumber, PDFRawStream, PDFStream } from 'pdf-lib';
import type { PDFDocument, PDFObject, PDFRef } from 'pdf-lib';

/**
 * Entries that describe the old encoded data and must not survive the swap.
 * DL (decoded length) and the F/FFilter/FDecodeParms external-file keys also describe it.
 */
const REPLACED_KEYS = new Set([
  'Length',
  'Filter',
  'DecodeParms',
  'Width',
  'Height',
  'BitsPerComponent',
  'ColorSpace',
  'Decode',
  'DL',
  'F',
  'FFilter',
  'FDecodeParms',
  'Type',
  'Subtype',
]);

export interface ReplaceImageOptions {
  /**
   * Colour space to write instead of DeviceRGB/DeviceGray, e.g. the original
   * [/ICCBased …] array when the samples were kept in that space. Its component count
   * must match `colorComponents`.
   */
  colorSpace?: PDFObject;
}

/**
 * Replaces the image stream at `ref` with `jpegBytes` (DCTDecode, 8 bits per component).
 * Every other entry is kept: SMask, Mask (explicit mask stream), Intent, Interpolate, OC,
 * Metadata, StructParent, Alternates… An SMask may have different dimensions from its
 * base image; the PDF specification allows that (unless the SMask has /Matte).
 */
export function replaceImageStream(
  doc: PDFDocument,
  ref: PDFRef,
  jpegBytes: Uint8Array,
  width: number,
  height: number,
  colorComponents: 1 | 3,
  options: ReplaceImageOptions = {},
): void {
  const original = doc.context.lookup(ref);
  if (!(original instanceof PDFStream)) throw new Error(`Object ${ref.toString()} is not a stream`);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError('Image dimensions must be positive integers');
  }

  const context = doc.context;
  const dict = PDFDict.withContext(context);
  dict.set(PDFName.of('Type'), PDFName.of('XObject'));
  dict.set(PDFName.of('Subtype'), PDFName.of('Image'));
  dict.set(PDFName.of('Width'), PDFNumber.of(width));
  dict.set(PDFName.of('Height'), PDFNumber.of(height));
  dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
  dict.set(
    PDFName.of('ColorSpace'),
    options.colorSpace ?? PDFName.of(colorComponents === 1 ? 'DeviceGray' : 'DeviceRGB'),
  );
  dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
  for (const [key, value] of original.dict.entries()) {
    if (!REPLACED_KEYS.has(key.decodeText())) dict.set(key, value);
  }
  context.assign(ref, PDFRawStream.of(dict, jpegBytes));
}
