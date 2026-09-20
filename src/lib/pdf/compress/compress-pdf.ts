/**
 * Makes a PDF smaller. No DOM: runs in the compression Web Worker and under Node.
 *
 * Steps (each one keeps the pages looking the same, apart from image quality):
 * 1. optional metadata removal, embedded page thumbnails removed;
 * 2. unreachable objects deleted and identical streams merged;
 * 3. large images recompressed as JPEG: the pixels are decoded and re-encoded by the
 *    browser through `transcode` (a canvas is needed), and an image is only replaced
 *    when the result is at least 10% smaller;
 * 4. with metadata removal, Exif/XMP/IPTC segments dropped from the JPEG images left as
 *    they are (losslessly);
 * 5. uncompressed streams deflated, and the file saved with object streams (not for files
 *    declaring PDF/A-1 or PDF/X, which predate them).
 */

import { PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import type { PDFContext, PDFObject } from 'pdf-lib';
import { keepTrailerEntriesAcrossXRefStreams } from '../xref-trailer.ts';
import { insertExifOrientation, isPdfPassthroughJpeg, readJpegInfo, stripJpegForPdf } from '../../image/jpeg-info.ts';
import {
  collectReachableRefs,
  deflateUnfilteredStreams,
  removePageThumbnails,
  removeUnreachableObjects,
  stripJpegImageMetadata,
  stripMetadata,
} from './cleanup.ts';
import { mergeDuplicateStreams } from './dedupe.ts';
import { DEFAULT_MAX_IMAGE_PIXELS, candidatesForLevel, findImageCandidates } from './images.ts';
import type { ImageCandidate } from './images.ts';
import { downscalePixels, samplesFromDecoded } from './pixels.ts';
import { COMPRESSION_LEVELS, LEVELS, fitsCanvas, maxReplacementBytes, targetImageSize } from './plan.ts';
import type { CompressionLevel } from './plan.ts';
import { replaceImageStream } from './replace.ts';

export type CompressErrorCode = 'encrypted' | 'invalid';

/** The file cannot be compressed (as opposed to a failure while compressing it). */
export class PdfCompressError extends Error {
  readonly code: CompressErrorCode;

  constructor(code: CompressErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PdfCompressError';
    this.code = code;
  }
}

/** Something the browser has to encode: JPEG bytes to decode, or raw samples. */
export interface TranscodeRequest {
  kind: 'jpeg' | 'pixels';
  /**
   * 'jpeg': a JPEG file (metadata removed, no EXIF rotation). 'pixels': interleaved 8-bit
   * samples, `channels` per pixel, already at the target size. The array owns its whole
   * ArrayBuffer, so it can be transferred to another thread.
   */
  data: Uint8Array;
  width: number;
  height: number;
  channels: 1 | 3;
  /** Exact size of the JPEG to produce. */
  targetWidth: number;
  targetHeight: number;
  /** JPEG quality, 0–1. */
  quality: number;
  /** Results larger than this are not used; the encoder side may skip returning them. */
  maxBytes: number;
}

export interface TranscodeResult {
  bytes: Uint8Array;
  width: number;
  height: number;
}

export type Transcoder = (
  request: TranscodeRequest,
  position: { index: number; total: number },
) => Promise<TranscodeResult | null>;

/** Decodes a stream's filters (not predictors). The result must not share memory with the stream. */
export type StreamDecoder = (stream: PDFRawStream, filters: readonly string[]) => Promise<Uint8Array>;

export type CompressStage = 'cleanup' | 'images' | 'saving';

export interface CompressProgress {
  stage: CompressStage;
  done: number;
  total: number;
}

export interface CompressStats {
  level: CompressionLevel;
  /** Images the level tried to recompress. */
  imagesConsidered: number;
  imagesReplaced: number;
  /** Encoded size of the replaced images before and after. */
  imageBytesBefore: number;
  imageBytesAfter: number;
  objectsRemoved: number;
  duplicatesMerged: number;
  streamsDeflated: number;
  thumbnailsRemoved: number;
  metadataRemoved: boolean;
}

export interface CompressResult {
  bytes: Uint8Array;
  stats: CompressStats;
}

export interface CompressArgs {
  doc: PDFDocument;
  level: CompressionLevel;
  stripMetadata: boolean;
  transcode: Transcoder;
  decodeStream?: StreamDecoder;
  onProgress?: (progress: CompressProgress) => void;
  signal?: AbortSignal;
  maxImagePixels?: number;
  /** Objects serialized between yields while saving (pdf-lib default 50). Infinity never yields. */
  objectsPerTick?: number;
}

export interface PdfSummary {
  pageCount: number;
  /** Images each level would try to recompress. */
  imageCounts: Record<CompressionLevel, number>;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

/** Allocation failures: continuing with the next image would most likely fail too. */
export function isOutOfMemoryError(error: unknown): boolean {
  if (!(error instanceof RangeError)) return false;
  return /memory|allocat|array buffer|invalid array length|invalid typed array length/i.test(error.message);
}

/** Parses a PDF for compression. Throws PdfCompressError for encrypted or unreadable files. */
export async function loadPdfForCompression(bytes: Uint8Array | ArrayBuffer): Promise<PDFDocument> {
  keepTrailerEntriesAcrossXRefStreams();
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: false,
      throwOnInvalidObject: false,
      parseSpeed: Infinity,
    });
  } catch (error) {
    if (isOutOfMemoryError(error)) throw error;
    throw new PdfCompressError('invalid', 'The PDF could not be read', { cause: error });
  }
  if (doc.isEncrypted) throw new PdfCompressError('encrypted', 'The PDF is encrypted');
  if (!(doc.context.lookup(doc.context.trailerInfo.Root) instanceof PDFDict)) {
    throw new PdfCompressError('invalid', 'The PDF has no document catalog');
  }
  let pageCount: number;
  try {
    pageCount = doc.getPageCount();
  } catch (error) {
    throw new PdfCompressError('invalid', 'The PDF page tree could not be read', { cause: error });
  }
  if (pageCount < 1) throw new PdfCompressError('invalid', 'The PDF has no pages');
  return doc;
}

/** Page count and how many images each level would try; does not modify the document. */
export function analyzePdf(doc: PDFDocument, options: { maxImagePixels?: number } = {}): PdfSummary {
  const candidates = findImageCandidates(doc, {
    include: collectReachableRefs(doc),
    maxPixels: options.maxImagePixels ?? DEFAULT_MAX_IMAGE_PIXELS,
  });
  const imageCounts = {} as Record<CompressionLevel, number>;
  for (const level of COMPRESSION_LEVELS) {
    imageCounts[level] = candidatesForLevel(candidates, LEVELS[level].convertFlate).length;
  }
  return { pageCount: doc.getPageCount(), imageCounts };
}

/** pdf-lib's JavaScript decoders (Flate, LZW, RunLength, ASCII85, ASCIIHex). */
export const decodeWithPdfLib: StreamDecoder = async (stream) => decodePDFRawStream(stream).decode();

/** The catalog's XMP metadata as Latin-1 text; '' when there is none or it cannot be decoded. */
function catalogXmpText(doc: PDFDocument): string {
  const catalog = doc.context.lookup(doc.context.trailerInfo.Root);
  if (!(catalog instanceof PDFDict)) return '';
  const metadata = doc.context.lookup(catalog.get(PDFName.of('Metadata')));
  if (!(metadata instanceof PDFRawStream)) return '';
  let bytes: Uint8Array;
  try {
    bytes = metadata.dict.has(PDFName.of('Filter')) ? decodePDFRawStream(metadata).decode() : metadata.contents;
  } catch {
    return '';
  }
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return text;
}

/**
 * True when the catalog's XMP metadata declares PDF/A-1. PDF/A-1 is based on PDF 1.4,
 * which has no object streams, so such files are saved without them.
 */
export function declaresPdfA1(doc: PDFDocument): boolean {
  return /pdfaid:part\s*(?:=\s*["']\s*1\s*["']|>\s*1\s*<)/.test(catalogXmpText(doc));
}

/**
 * True when the Info dictionary (PDF/X-1a, X-3) or the XMP metadata (PDF/X-4 and later)
 * declares PDF/X. PDF/X-1a and X-3 are based on PDF 1.3/1.4 and forbid object streams, and
 * print preflight checks that, so PDF/X files are saved without them (later versions allow
 * both layouts).
 */
export function declaresPdfX(doc: PDFDocument): boolean {
  const info = doc.context.lookup(doc.context.trailerInfo.Info);
  if (info instanceof PDFDict && info.has(PDFName.of('GTS_PDFXVersion'))) return true;
  return /pdfx(?:id)?:GTS_PDFXVersion/.test(catalogXmpText(doc));
}

/**
 * pdf-lib always writes a %PDF-1.7 header. For a file saved without object streams to keep
 * a declared standard, writes back the original 1.x version when it was lower (at least
 * 1.2, the version that introduced FlateDecode). Same length, so no offset changes.
 */
function restoreHeaderVersion(output: Uint8Array, header: PDFContext['header']): void {
  const original = /^%PDF-1\.(\d+)\s/.exec(header.toString());
  const prefix = '%PDF-1.7';
  if (!original || output.length < prefix.length) return;
  for (let i = 0; i < prefix.length; i++) if (output[i] !== prefix.charCodeAt(i)) return;
  const minor = Number(original[1]);
  if (minor < 7) output[7] = 0x30 + Math.max(minor, 2);
}

function ownsBuffer(bytes: Uint8Array): boolean {
  return bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength;
}

/**
 * JPEG bytes a browser decodes to exactly the samples a PDF viewer uses: no EXIF rotation
 * (viewers ignore it) and no embedded ICC profile (the PDF colour space applies instead).
 * Always a fresh copy.
 */
export function prepareJpegForBrowser(bytes: Uint8Array): Uint8Array {
  let jpeg = stripJpegForPdf(bytes);
  const info = readJpegInfo(jpeg);
  if (info && info.orientation !== 1) jpeg = insertExifOrientation(jpeg, 1);
  return jpeg === bytes || !ownsBuffer(jpeg) ? jpeg.slice() : jpeg;
}

interface ImageOutcome {
  replaced: boolean;
  before: number;
  after: number;
}

async function recompressImage(
  doc: PDFDocument,
  candidate: ImageCandidate,
  args: CompressArgs,
  position: { index: number; total: number },
): Promise<ImageOutcome> {
  const skipped: ImageOutcome = { replaced: false, before: 0, after: 0 };
  const stream = doc.context.lookup(candidate.ref);
  if (!(stream instanceof PDFRawStream)) return skipped;
  const settings = LEVELS[args.level];
  const { width, height } = candidate;
  const channels = candidate.colorSpace.components === 1 ? 1 : 3;

  let target: { width: number; height: number };
  if (candidate.keepSize) {
    if (!fitsCanvas(width, height)) return skipped;
    target = { width, height };
  } else {
    target = targetImageSize(width, height, settings.maxDimension);
  }
  const maxBytes = maxReplacementBytes(stream.contents.length);

  let request: TranscodeRequest;
  if (candidate.kind === 'jpeg') {
    request = {
      kind: 'jpeg',
      data: prepareJpegForBrowser(stream.contents),
      width,
      height,
      channels,
      targetWidth: target.width,
      targetHeight: target.height,
      quality: settings.jpegQuality,
      maxBytes,
    };
  } else if (candidate.kind === 'flate-raw' && candidate.predictor) {
    const decoded =
      candidate.filters.length === 0 ? stream.contents : await (args.decodeStream ?? decodeWithPdfLib)(stream, candidate.filters);
    const owned = decoded.buffer !== stream.contents.buffer;
    const samples = samplesFromDecoded(decoded, { width, height, channels, predictor: candidate.predictor }, owned);
    if (!samples) return skipped;
    let pixels = downscalePixels(samples, width, height, channels, target.width, target.height);
    if (!ownsBuffer(pixels) || pixels.buffer === stream.contents.buffer) pixels = pixels.slice();
    request = {
      kind: 'pixels',
      data: pixels,
      width: target.width,
      height: target.height,
      channels,
      targetWidth: target.width,
      targetHeight: target.height,
      quality: settings.jpegQuality,
      maxBytes,
    };
  } else {
    return skipped;
  }

  throwIfAborted(args.signal);
  const result = await args.transcode(request, position);
  throwIfAborted(args.signal);
  if (!result || result.bytes.length > maxBytes) return skipped;

  // Trust nothing from the encoder: the new stream must be a JPEG viewers can decode, at the planned size.
  const info = readJpegInfo(result.bytes);
  if (
    !info ||
    !isPdfPassthroughJpeg(info) ||
    (info.components !== 1 && info.components !== 3) ||
    info.width !== target.width ||
    info.height !== target.height ||
    result.width !== target.width ||
    result.height !== target.height
  ) {
    return skipped;
  }

  // Samples stay in the source colour space, so an ICC profile still describes them when the
  // component count is unchanged. Gray sources come back as RGB JPEGs: DeviceRGB then (only
  // plain DeviceGray images where that renders the same are candidates, see images.ts).
  let colorSpace: PDFObject | undefined;
  if (info.components === candidate.colorSpace.components) {
    colorSpace = stream.dict.get(PDFName.of('ColorSpace'));
  }
  const bytes = ownsBuffer(result.bytes) ? result.bytes : result.bytes.slice();
  replaceImageStream(doc, candidate.ref, bytes, info.width, info.height, info.components as 1 | 3, { colorSpace });
  return { replaced: true, before: stream.contents.length, after: bytes.length };
}

export async function compressPdf(args: CompressArgs): Promise<CompressResult> {
  const { doc, level, signal, onProgress } = args;
  const settings = LEVELS[level];
  if (!settings) throw new Error(`Unknown compression level: ${String(level)}`);
  throwIfAborted(signal);

  onProgress?.({ stage: 'cleanup', done: 0, total: 0 });
  // Checked before metadata removal: once the Info dictionary and XMP are gone, the file no
  // longer claims PDF/A-1 or PDF/X.
  const classicLayout = !args.stripMetadata && (declaresPdfA1(doc) || declaresPdfX(doc));
  if (args.stripMetadata) stripMetadata(doc);
  const thumbnailsRemoved = removePageThumbnails(doc);
  let objectsRemoved = removeUnreachableObjects(doc);
  const duplicatesMerged = mergeDuplicateStreams(doc);
  throwIfAborted(signal);

  const candidates = candidatesForLevel(
    findImageCandidates(doc, { maxPixels: args.maxImagePixels ?? DEFAULT_MAX_IMAGE_PIXELS }),
    settings.convertFlate,
  );
  const total = candidates.length;
  const stats: CompressStats = {
    level,
    imagesConsidered: total,
    imagesReplaced: 0,
    imageBytesBefore: 0,
    imageBytesAfter: 0,
    objectsRemoved: 0,
    duplicatesMerged,
    streamsDeflated: 0,
    thumbnailsRemoved,
    metadataRemoved: args.stripMetadata,
  };

  for (let index = 0; index < total; index++) {
    throwIfAborted(signal);
    onProgress?.({ stage: 'images', done: index, total });
    try {
      const outcome = await recompressImage(doc, candidates[index]!, args, { index, total });
      if (outcome.replaced) {
        stats.imagesReplaced++;
        stats.imageBytesBefore += outcome.before;
        stats.imageBytesAfter += outcome.after;
      }
    } catch (error) {
      if (isAbortError(error) || isOutOfMemoryError(error)) throw error;
      // A damaged or unusual image stays as it is; the rest of the file is still compressed.
    }
  }

  throwIfAborted(signal);
  onProgress?.({ stage: 'saving', done: total, total });
  // After the image loop, so the images considered (and their size thresholds) match analyzePdf.
  if (args.stripMetadata) stripJpegImageMetadata(doc);
  stats.streamsDeflated = deflateUnfilteredStreams(doc).streams;
  objectsRemoved += removeUnreachableObjects(doc);
  stats.objectsRemoved = objectsRemoved;
  throwIfAborted(signal);

  const bytes = await doc.save({
    useObjectStreams: !classicLayout,
    addDefaultPage: false,
    updateFieldAppearances: false,
    objectsPerTick: args.objectsPerTick ?? Infinity,
  });
  if (classicLayout) restoreHeaderVersion(bytes, doc.context.header);
  throwIfAborted(signal);
  return { bytes, stats };
}
