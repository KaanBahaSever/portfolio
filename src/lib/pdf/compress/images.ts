/**
 * Finds image XObjects that can be recompressed safely. Pure: no DOM, runs under Node.
 *
 * Only images whose samples the browser can reproduce exactly are candidates:
 * - 'jpeg': a single DCTDecode filter, 8 bits, Gray or RGB (Device or ICCBased). CMYK
 *   JPEGs are skipped because Adobe apps often store them inverted, and anything with a
 *   /Decode array is skipped because the browser would not apply it.
 * - 'flate-raw': 8-bit Gray or RGB samples stored losslessly: FlateDecode (the common
 *   case), also LZW, RunLength, ASCII filters or no filter at all, with optional PNG
 *   (Predictor >= 10) or TIFF (Predictor 2) predictors.
 * Everything else is left untouched ('skip' with a reason).
 *
 * Browser JPEG encoders always write 3-component JPEGs, so a recompressed gray image becomes
 * DeviceRGB. Only plain DeviceGray images, where that renders the same, are candidates:
 * not ICC-based gray (the profile would be lost), not gray images whose soft mask has
 * /Matte (one value per colour component), and none at all in documents where gray must
 * stay gray (a PDF/X or non-RGB output intent, or a /DefaultGray colour space).
 */

import { PDFArray, PDFBool, PDFDict, PDFName, PDFNull, PDFNumber, PDFRawStream, PDFRef, PDFStream } from 'pdf-lib';
import type { PDFDocument, PDFObject } from 'pdf-lib';
import { isPdfPassthroughJpeg, readJpegInfo } from '../../image/jpeg-info.ts';
import type { PredictorParams } from './pixels.ts';

/** Streams below this size are not worth a decode/encode round trip. */
export const MIN_IMAGE_STREAM_BYTES = 20 * 1024;
/** Images narrower or shorter than this (icons, rules, patterns) are left alone. */
export const MIN_IMAGE_DIMENSION = 64;
/** Default upper bound for one image (decoding needs 3–4 bytes per pixel, several times over). */
export const DEFAULT_MAX_IMAGE_PIXELS = 100_000_000;

export type ImageKind = 'jpeg' | 'flate-raw' | 'skip';

export type SkipReason =
  | 'too-small'
  | 'too-large'
  | 'invalid-dimensions'
  | 'image-mask'
  | 'used-as-mask'
  | 'external-data'
  | 'unsupported-filter'
  | 'unsupported-bits'
  | 'unsupported-color-space'
  | 'gray-color-space'
  | 'decode-array'
  | 'color-key-mask'
  | 'unsupported-decode-parms'
  | 'jpeg-mismatch';

export interface ColorSpaceSummary {
  /** e.g. 'DeviceRGB', 'ICCBased', 'Indexed', 'DeviceCMYK'; 'none' when missing. */
  family: string;
  /** Components per pixel when known. */
  components: number | null;
  /** Gray or RGB that a browser-encoded JPEG can represent. */
  supported: boolean;
}

export interface ImageCandidate {
  ref: PDFRef;
  width: number;
  height: number;
  bitsPerComponent: number | null;
  /** Filter names in order of application when decoding. */
  filters: string[];
  colorSpace: ColorSpaceSummary;
  hasSMask: boolean;
  /** Any /Mask entry (explicit mask stream or colour-key array). */
  hasMask: boolean;
  hasColorKeyMask: boolean;
  /** A /Decode array other than the default one. */
  hasDecode: boolean;
  imageMask: boolean;
  /** Referenced by another image as its /SMask or /Mask. */
  usedAsMask: boolean;
  /** The soft mask has /Matte, which requires the image to keep its pixel size. */
  keepSize: boolean;
  /** Encoded stream length. */
  byteLength: number;
  kind: ImageKind;
  skipReason?: SkipReason;
  /** Predictor to undo after the filters ('flate-raw' only). */
  predictor?: PredictorParams;
}

export interface FindImageOptions {
  maxPixels?: number;
  /** Only report these objects (e.g. the reachable ones). */
  include?: ReadonlySet<PDFRef>;
}

const LOSSLESS_FILTERS = new Set(['FlateDecode', 'LZWDecode', 'RunLengthDecode', 'ASCII85Decode', 'ASCIIHexDecode']);
const PREDICTOR_FILTERS = new Set(['FlateDecode', 'LZWDecode']);

const NAME = {
  Type: PDFName.of('Type'),
  Subtype: PDFName.of('Subtype'),
  Image: PDFName.of('Image'),
  XObject: PDFName.of('XObject'),
  Width: PDFName.of('Width'),
  Height: PDFName.of('Height'),
  BitsPerComponent: PDFName.of('BitsPerComponent'),
  ColorSpace: PDFName.of('ColorSpace'),
  Filter: PDFName.of('Filter'),
  DecodeParms: PDFName.of('DecodeParms'),
  Decode: PDFName.of('Decode'),
  ImageMask: PDFName.of('ImageMask'),
  SMask: PDFName.of('SMask'),
  Mask: PDFName.of('Mask'),
  Matte: PDFName.of('Matte'),
  N: PDFName.of('N'),
  F: PDFName.of('F'),
  Predictor: PDFName.of('Predictor'),
  Colors: PDFName.of('Colors'),
  Columns: PDFName.of('Columns'),
  Root: PDFName.of('Root'),
  OutputIntents: PDFName.of('OutputIntents'),
  S: PDFName.of('S'),
  GTS_PDFX: PDFName.of('GTS_PDFX'),
  DestOutputProfile: PDFName.of('DestOutputProfile'),
  Resources: PDFName.of('Resources'),
  DefaultGray: PDFName.of('DefaultGray'),
} as const;

/** Resolves a reference (or returns a direct object). Never throws on dangling refs. */
function resolve(doc: PDFDocument, object: PDFObject | undefined): PDFObject | undefined {
  const value = object instanceof PDFRef ? doc.context.lookup(object) : object;
  return value === PDFNull ? undefined : value;
}

function numberOf(doc: PDFDocument, dict: PDFDict, key: PDFName): number | null {
  const value = resolve(doc, dict.get(key));
  return value instanceof PDFNumber ? value.asNumber() : null;
}

export function isImageStream(object: PDFObject | undefined): object is PDFRawStream {
  return object instanceof PDFRawStream && object.dict.get(NAME.Subtype) === NAME.Image;
}

/** Filter names of a stream dict; null when the entry is malformed. */
export function readFilters(doc: PDFDocument, dict: PDFDict): string[] | null {
  const filter = resolve(doc, dict.get(NAME.Filter));
  if (filter === undefined) return [];
  if (filter instanceof PDFName) return [filter.decodeText()];
  if (filter instanceof PDFArray) {
    const names: string[] = [];
    for (const item of filter.asArray()) {
      const name = resolve(doc, item);
      if (!(name instanceof PDFName)) return null;
      names.push(name.decodeText());
    }
    return names;
  }
  return null;
}

/** DecodeParms dict for filter `index`: undefined when absent or null, false when malformed. */
function decodeParmsAt(doc: PDFDocument, dict: PDFDict, index: number, filterCount: number): PDFDict | undefined | false {
  const parms = resolve(doc, dict.get(NAME.DecodeParms));
  if (parms === undefined) return undefined;
  // A single dict is only unambiguous for a single filter.
  if (parms instanceof PDFDict) return filterCount === 1 ? parms : false;
  if (parms instanceof PDFArray) {
    const item = index < parms.size() ? resolve(doc, parms.get(index)) : undefined;
    if (item === undefined) return undefined;
    return item instanceof PDFDict ? item : false;
  }
  return false;
}

export function summarizeColorSpace(doc: PDFDocument, value: PDFObject | undefined): ColorSpaceSummary {
  const space = resolve(doc, value);
  if (space === undefined) return { family: 'none', components: null, supported: false };
  if (space instanceof PDFName) {
    const family = space.decodeText();
    const components = family === 'DeviceGray' ? 1 : family === 'DeviceRGB' ? 3 : family === 'DeviceCMYK' ? 4 : null;
    return { family, components, supported: components === 1 || components === 3 };
  }
  if (space instanceof PDFArray && space.size() > 0) {
    const head = resolve(doc, space.get(0));
    const family = head instanceof PDFName ? head.decodeText() : 'unknown';
    if (family === 'ICCBased' && space.size() > 1) {
      const profile = resolve(doc, space.get(1));
      const n = profile instanceof PDFStream ? resolve(doc, profile.dict.get(NAME.N)) : undefined;
      const components = n instanceof PDFNumber ? n.asNumber() : null;
      return { family, components, supported: components === 1 || components === 3 };
    }
    if (family === 'DeviceGray' || family === 'DeviceRGB') {
      // [/DeviceRGB] written as a one-element array: unusual but equivalent.
      return { family, components: family === 'DeviceGray' ? 1 : 3, supported: space.size() === 1 };
    }
    return { family, components: null, supported: false };
  }
  return { family: 'unknown', components: null, supported: false };
}

/** True for a /Decode array that differs from the default [0 1 0 1 …]. */
function hasNonDefaultDecode(doc: PDFDocument, dict: PDFDict): boolean {
  const decode = resolve(doc, dict.get(NAME.Decode));
  if (decode === undefined) return false;
  if (!(decode instanceof PDFArray)) return true;
  const values = decode.asArray();
  if (values.length === 0 || values.length % 2 !== 0) return true;
  return values.some((item, index) => {
    const number = resolve(doc, item);
    return !(number instanceof PDFNumber) || number.asNumber() !== index % 2;
  });
}

/**
 * True when turning gray images into RGB would break the document: a PDF/X output intent
 * (print files must not gain RGB), an output intent whose profile is not RGB (PDF/A only
 * allows DeviceRGB with an RGB one), or a /DefaultGray colour space that remaps DeviceGray.
 * Metadata removal does not touch any of these, so the answer is the same before and after.
 * `include` limits the /DefaultGray search to those objects (e.g. the reachable ones).
 */
export function grayMustStayGray(doc: PDFDocument, include?: ReadonlySet<PDFRef>): boolean {
  const catalog = resolve(doc, doc.context.trailerInfo.Root);
  const intents = catalog instanceof PDFDict ? resolve(doc, catalog.get(NAME.OutputIntents)) : undefined;
  if (intents instanceof PDFArray) {
    for (const item of intents.asArray()) {
      const intent = resolve(doc, item);
      if (!(intent instanceof PDFDict)) continue;
      if (resolve(doc, intent.get(NAME.S)) === NAME.GTS_PDFX) return true;
      const profile = resolve(doc, intent.get(NAME.DestOutputProfile));
      if (profile instanceof PDFStream && numberOf(doc, profile.dict, NAME.N) !== 3) return true;
    }
  }
  for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
    if (include && !include.has(ref)) continue;
    const dict = object instanceof PDFStream ? object.dict : object;
    if (!(dict instanceof PDFDict)) continue;
    const resources = resolve(doc, dict.get(NAME.Resources));
    const spaces = resources instanceof PDFDict ? resolve(doc, resources.get(NAME.ColorSpace)) : undefined;
    if (spaces instanceof PDFDict && spaces.has(NAME.DefaultGray)) return true;
  }
  return false;
}

/** Objects referenced by images as /SMask or /Mask (explicit masks). */
function collectMaskRefs(images: Array<[PDFRef, PDFRawStream]>): Set<PDFRef> {
  const masks = new Set<PDFRef>();
  for (const [, stream] of images) {
    for (const key of [NAME.SMask, NAME.Mask]) {
      const value = stream.dict.get(key);
      if (value instanceof PDFRef) masks.add(value);
    }
  }
  return masks;
}

function readPredictor(
  doc: PDFDocument,
  parms: PDFDict | undefined,
  components: number,
  width: number,
): PredictorParams | null {
  const none: PredictorParams = { kind: 'none', colors: components, columns: width };
  if (!parms) return none;
  const predictor = numberOf(doc, parms, NAME.Predictor) ?? 1;
  if (predictor === 1) return none;
  const colors = numberOf(doc, parms, NAME.Colors) ?? 1;
  const bits = numberOf(doc, parms, NAME.BitsPerComponent) ?? 8;
  const columns = numberOf(doc, parms, NAME.Columns) ?? 1;
  if (colors !== components || bits !== 8 || columns !== width) return null;
  if (predictor === 2) return { kind: 'tiff', colors, columns };
  if (predictor >= 10 && predictor <= 15) return { kind: 'png', colors, columns };
  return null;
}

function classify(
  doc: PDFDocument,
  ref: PDFRef,
  stream: PDFRawStream,
  maskRefs: Set<PDFRef>,
  maxPixels: number,
  keepGray: boolean,
): ImageCandidate {
  const dict = stream.dict;
  const width = numberOf(doc, dict, NAME.Width) ?? 0;
  const height = numberOf(doc, dict, NAME.Height) ?? 0;
  const bitsPerComponent = numberOf(doc, dict, NAME.BitsPerComponent);
  const filters = readFilters(doc, dict);
  const colorSpace = summarizeColorSpace(doc, dict.get(NAME.ColorSpace));
  const imageMaskValue = resolve(doc, dict.get(NAME.ImageMask));
  const imageMask = imageMaskValue instanceof PDFBool && imageMaskValue.asBoolean();
  const mask = resolve(doc, dict.get(NAME.Mask));
  const smask = resolve(doc, dict.get(NAME.SMask));
  const keepSize = smask instanceof PDFStream && smask.dict.has(NAME.Matte);

  const candidate: ImageCandidate = {
    ref,
    width,
    height,
    bitsPerComponent,
    filters: filters ?? [],
    colorSpace,
    hasSMask: smask instanceof PDFStream,
    hasMask: mask !== undefined,
    hasColorKeyMask: mask instanceof PDFArray,
    hasDecode: hasNonDefaultDecode(doc, dict),
    imageMask,
    usedAsMask: maskRefs.has(ref),
    keepSize,
    byteLength: stream.contents.length,
    kind: 'skip',
  };

  const skip = (reason: SkipReason): ImageCandidate => {
    candidate.skipReason = reason;
    return candidate;
  };

  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return skip('invalid-dimensions');
  if (imageMask) return skip('image-mask');
  if (candidate.usedAsMask) return skip('used-as-mask');
  if (dict.has(NAME.F)) return skip('external-data');
  if (candidate.byteLength < MIN_IMAGE_STREAM_BYTES || width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
    return skip('too-small');
  }
  if (width * height > maxPixels) return skip('too-large');
  if (!filters) return skip('unsupported-filter');
  if (bitsPerComponent !== 8) return skip('unsupported-bits');
  if (!colorSpace.supported || colorSpace.components === null) return skip('unsupported-color-space');
  if (colorSpace.components === 1 && (keepGray || keepSize || colorSpace.family !== 'DeviceGray')) {
    return skip('gray-color-space');
  }
  if (candidate.hasDecode) return skip('decode-array');
  if (candidate.hasColorKeyMask) return skip('color-key-mask');

  if (filters.length === 1 && filters[0] === 'DCTDecode') {
    // Any DCT parameters (ColorTransform) could make the browser decode colours differently.
    const parms = decodeParmsAt(doc, dict, 0, 1);
    if (parms === false || (parms && parms.keys().length > 0)) return skip('unsupported-decode-parms');
    const info = readJpegInfo(stream.contents);
    if (
      !info ||
      !isPdfPassthroughJpeg(info) ||
      info.width !== width ||
      info.height !== height ||
      info.components !== colorSpace.components
    ) {
      return skip('jpeg-mismatch');
    }
    candidate.kind = 'jpeg';
    return candidate;
  }

  if (!filters.every((name) => LOSSLESS_FILTERS.has(name))) return skip('unsupported-filter');
  let predictor: PredictorParams | null = { kind: 'none', colors: colorSpace.components, columns: width };
  for (let index = 0; index < filters.length; index++) {
    const parms = decodeParmsAt(doc, dict, index, filters.length);
    if (parms === false) return skip('unsupported-decode-parms');
    if (!parms) continue;
    const isLast = index === filters.length - 1;
    const params = readPredictor(doc, parms, colorSpace.components, width);
    if (!params) return skip('unsupported-decode-parms');
    if (params.kind !== 'none') {
      if (!isLast || !PREDICTOR_FILTERS.has(filters[index]!)) return skip('unsupported-decode-parms');
      predictor = params;
    }
  }
  candidate.kind = 'flate-raw';
  candidate.predictor = predictor;
  return candidate;
}

/** Every image XObject stream in the document, classified. */
export function findImageCandidates(doc: PDFDocument, options: FindImageOptions = {}): ImageCandidate[] {
  const maxPixels = options.maxPixels ?? DEFAULT_MAX_IMAGE_PIXELS;
  const images: Array<[PDFRef, PDFRawStream]> = [];
  for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
    if (isImageStream(object)) images.push([ref, object]);
  }
  const maskRefs = collectMaskRefs(images);
  const keepGray = images.length > 0 && grayMustStayGray(doc, options.include);
  return images
    .filter(([ref]) => !options.include || options.include.has(ref))
    .map(([ref, stream]) => classify(doc, ref, stream, maskRefs, maxPixels, keepGray));
}

/** Candidates a level will try to recompress. */
export function candidatesForLevel(candidates: readonly ImageCandidate[], convertFlate: boolean): ImageCandidate[] {
  return candidates.filter((candidate) => candidate.kind === 'jpeg' || (convertFlate && candidate.kind === 'flate-raw'));
}
