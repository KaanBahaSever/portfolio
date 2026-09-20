/**
 * Structure clean-up that never changes how pages render. Pure: no DOM, runs under Node.
 */

import { PDFArray, PDFDict, PDFInvalidObject, PDFName, PDFRawStream, PDFRef, PDFStream } from 'pdf-lib';
import type { PDFDocument, PDFObject } from 'pdf-lib';
import { readJpegInfo, stripJpegForPdf } from '../../image/jpeg-info.ts';
import { isImageStream, readFilters } from './images.ts';

const REF_PATTERN = /(\d+)\s+(\d+)\s+R(?![A-Za-z0-9_])/g;

/** Latin-1 view of an object pdf-lib could not parse, so references inside it can be found. */
function invalidObjectText(object: PDFInvalidObject): string {
  const bytes = new Uint8Array(object.sizeInBytes());
  object.copyBytesInto(bytes, 0);
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return text;
}

/**
 * Indirect objects reachable from the trailer (Root, Info, Encrypt), following references
 * through dictionaries, arrays and stream dictionaries. Iterative, so deep page trees or
 * long chains cannot overflow the stack.
 */
export function collectReachableRefs(doc: PDFDocument): Set<PDFRef> {
  const context = doc.context;
  const reachable = new Set<PDFRef>();
  const stack: PDFObject[] = [];
  const { Root, Info, Encrypt } = context.trailerInfo;
  for (const entry of [Root, Info, Encrypt]) if (entry) stack.push(entry);

  // pdf-lib keeps one PDFRef instance per object/generation number, so identity works.
  const byKey = new Map<string, PDFRef>();
  let indexed = false;

  while (stack.length > 0) {
    const object = stack.pop()!;
    if (object instanceof PDFRef) {
      if (reachable.has(object)) continue;
      const target = context.lookup(object);
      if (target === undefined) continue; // dangling reference: nothing to keep
      reachable.add(object);
      stack.push(target);
    } else if (object instanceof PDFDict) {
      for (const value of object.values()) stack.push(value);
    } else if (object instanceof PDFArray) {
      for (const value of object.asArray()) stack.push(value);
    } else if (object instanceof PDFStream) {
      stack.push(object.dict);
    } else if (object instanceof PDFInvalidObject) {
      // Unparsed bytes may still contain "12 0 R": keep anything that looks referenced.
      if (!indexed) {
        for (const [ref] of context.enumerateIndirectObjects()) byKey.set(`${ref.objectNumber} ${ref.generationNumber}`, ref);
        indexed = true;
      }
      for (const match of invalidObjectText(object).matchAll(REF_PATTERN)) {
        const ref = byKey.get(`${Number(match[1])} ${Number(match[2])}`);
        if (ref) stack.push(ref);
      }
    }
  }
  return reachable;
}

/**
 * Writes every stream's /Length as a direct number. pdf-lib does the same when saving,
 * which would otherwise leave "/Length 12 0 R" objects behind with nothing referring to them.
 */
export function inlineStreamLengths(doc: PDFDocument): void {
  const length = PDFName.of('Length');
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (object instanceof PDFStream && object.dict.get(length) instanceof PDFRef) object.updateDict();
  }
}

/**
 * Deletes indirect objects nothing refers to: leftovers of incremental updates, replaced
 * images, linearization hints, orphaned fonts. Returns how many were removed.
 * Encrypted documents are not supported (their objects cannot be rewritten anyway).
 */
export function removeUnreachableObjects(doc: PDFDocument): number {
  const context = doc.context;
  if (!context.trailerInfo.Root) return 0; // no catalog: never empty the file
  inlineStreamLengths(doc);
  const reachable = collectReachableRefs(doc);
  let removed = 0;
  for (const [ref] of context.enumerateIndirectObjects()) {
    if (!reachable.has(ref) && context.delete(ref)) removed++;
  }
  return removed;
}

const METADATA = PDFName.of('Metadata');
const PIECE_INFO = PDFName.of('PieceInfo');
const TYPE = PDFName.of('Type');
const SUBTYPE = PDFName.of('Subtype');
const PAGE = PDFName.of('Page');
const THUMB = PDFName.of('Thumb');

function dictOf(object: PDFObject | undefined): PDFDict | undefined {
  if (object instanceof PDFDict) return object;
  if (object instanceof PDFStream) return object.dict;
  return undefined;
}

/** A /Metadata value that is an XMP stream (not, say, a custom key with another meaning). */
function isXmpStream(doc: PDFDocument, value: PDFObject | undefined): boolean {
  const stream = value instanceof PDFRef ? doc.context.lookup(value) : value;
  if (!(stream instanceof PDFStream)) return false;
  return stream.dict.get(TYPE) === METADATA || stream.dict.get(SUBTYPE) === PDFName.of('XML');
}

/**
 * Removes document metadata: every Info dictionary entry (title, author, subject,
 * keywords, creator, producer, dates, custom keys) and the Info dictionary itself, XMP
 * /Metadata streams on the catalog, pages, images and other objects, and /PieceInfo
 * (private application data). Nothing needed to render the pages is touched. The
 * detached objects are deleted by removeUnreachableObjects().
 */
export function stripMetadata(doc: PDFDocument): void {
  const context = doc.context;
  const info = context.trailerInfo.Info;
  const infoDict = info instanceof PDFRef ? context.lookup(info) : info;
  if (infoDict instanceof PDFDict) {
    for (const key of infoDict.keys()) infoDict.delete(key);
  }
  delete context.trailerInfo.Info;

  const containers: PDFDict[] = [];
  const root = context.lookup(context.trailerInfo.Root);
  if (root instanceof PDFDict) containers.push(root);
  for (const [, object] of context.enumerateIndirectObjects()) {
    const dict = dictOf(object);
    if (dict && dict !== root) containers.push(dict);
  }
  for (const dict of containers) {
    if (dict.has(METADATA) && isXmpStream(doc, dict.get(METADATA))) dict.delete(METADATA);
    if (dict.has(PIECE_INFO)) dict.delete(PIECE_INFO);
  }
}

/** A copy of a stream dictionary without /Length (pdf-lib writes the new one when saving). */
function copyWithoutLength(doc: PDFDocument, dict: PDFDict): PDFDict {
  const next = PDFDict.withContext(doc.context);
  for (const [key, value] of dict.entries()) {
    if (key !== PDFName.of('Length')) next.set(key, value);
  }
  return next;
}

/**
 * Removes metadata stored inside JPEG (DCTDecode) image data: APP1 Exif (camera, GPS) and
 * XMP, APP13 IPTC, comments and the like. stripMetadata() cannot see these, and images that
 * are not re-encoded would keep them. Lossless: the compressed image data and the segments
 * needed to decode it stay byte for byte (see stripJpegForPdf); an image is only rewritten
 * when its frame header reads the same afterwards. Returns how many images changed.
 */
export function stripJpegImageMetadata(doc: PDFDocument): number {
  let changed = 0;
  for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
    if (!isImageStream(object) || object.dict.has(PDFName.of('F'))) continue;
    const filters = readFilters(doc, object.dict);
    if (!filters || filters.length !== 1 || filters[0] !== 'DCTDecode') continue;
    const stripped = stripJpegForPdf(object.contents);
    if (stripped === object.contents) continue;
    const before = readJpegInfo(object.contents);
    const after = readJpegInfo(stripped);
    if (
      !before ||
      !after ||
      after.sofMarker !== before.sofMarker ||
      after.width !== before.width ||
      after.height !== before.height ||
      after.components !== before.components ||
      after.bitsPerSample !== before.bitsPerSample
    ) {
      continue;
    }
    doc.context.assign(ref, PDFRawStream.of(copyWithoutLength(doc, object.dict), stripped));
    changed++;
  }
  return changed;
}

/**
 * Removes embedded page thumbnails (/Thumb). Viewers draw their own; the images only
 * add size. Returns how many pages had one.
 */
export function removePageThumbnails(doc: PDFDocument): number {
  let removed = 0;
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (object instanceof PDFDict && object.get(TYPE) === PAGE && object.has(THUMB)) {
      object.delete(THUMB);
      removed++;
    }
  }
  return removed;
}

/** Streams below this size gain nothing measurable from compression. */
const MIN_DEFLATE_BYTES = 256;
const NO_DEFLATE_TYPES = new Set(['Metadata', 'XRef', 'ObjStm']);

/**
 * Flate-compresses streams stored without any filter (uncompressed content streams,
 * fonts, raw images). Lossless. Skips XMP metadata (PDF/A requires it unfiltered),
 * external-file streams and streams with stray DecodeParms. Returns the bytes saved.
 */
export function deflateUnfilteredStreams(doc: PDFDocument): { streams: number; bytesSaved: number } {
  const context = doc.context;
  let streams = 0;
  let bytesSaved = 0;
  for (const [ref, object] of context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream) || object.contents.length < MIN_DEFLATE_BYTES) continue;
    const dict = object.dict;
    if (dict.has(PDFName.of('Filter')) || dict.has(PDFName.of('DecodeParms')) || dict.has(PDFName.of('F'))) continue;
    const type = dict.get(TYPE);
    if (type instanceof PDFName && NO_DEFLATE_TYPES.has(type.decodeText())) continue;
    if (dict.get(SUBTYPE) === PDFName.of('XML')) continue;

    const deflated = context.flateStream(object.contents).contents;
    // The Filter entry costs a few bytes; require a real gain.
    if (deflated.length + 32 >= object.contents.length) continue;
    const next = copyWithoutLength(doc, dict);
    next.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
    context.assign(ref, PDFRawStream.of(next, deflated));
    streams++;
    bytesSaved += object.contents.length - deflated.length;
  }
  return { streams, bytesSaved };
}
