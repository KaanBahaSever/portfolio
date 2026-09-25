/**
 * Builds a PDF with one image per page. No DOM: runs in the browser and under Node.
 *
 * Why pdf-lib (and not jsPDF):
 * - embeds JPEG bytes as-is (DCTDecode passthrough): no re-encode, no quality loss;
 * - exposes low-level content-stream operators, so EXIF orientation is applied
 *   losslessly with a transformation matrix instead of re-rendering pixels;
 * - the Split PDF and Compress PDF tools use it too.
 *
 * The browser runs this module in a Web Worker that is only created when the user
 * clicks Generate, so pdf-lib stays out of the page JavaScript and its synchronous
 * PNG decoding and compression never block the page.
 *
 * Errors thrown here are for developers and for the embed fallback (an image pdf-lib cannot
 * read is prepared again through a canvas); the page never shows their text. It reports
 * failures with its own localized messages (src/i18n/tools/images-to-pdf.ts).
 */

import {
  JpegEmbedder,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PngEmbedder,
  concatTransformationMatrix,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
} from 'pdf-lib';
import type { PDFRef } from 'pdf-lib';
import { readIccProfile } from '../image/icc.ts';
import { orientationMatrix, orientedSize } from '../image/orientation.ts';
import type { Orientation } from '../image/orientation.ts';
import { computePlacement } from './page-layout.ts';
import type { MarginOption, OrientationOption, PageSizeOption } from './page-layout.ts';

export interface PreparedImage {
  kind: 'jpeg' | 'png';
  bytes: Uint8Array;
  /** STORED pixel dimensions of `bytes` (before orientation). */
  width: number;
  height: number;
  /** Not 1 only for passthrough JPEGs; the page matrix applies it losslessly. */
  orientation: Orientation;
  /**
   * ICC profile of the source (passthrough images only). Used as the image's ICCBased
   * colour space when it matches the embedded colour components; ignored otherwise.
   */
  icc?: Uint8Array;
}

export interface BuildOptions {
  pageSize: PageSizeOption;
  orientation: OrientationOption;
  margin: MarginOption;
  title?: string;
  /**
   * The document's Creator entry, shown in a viewer's document properties. The page passes
   * it in its own language; DEFAULT_CREATOR otherwise.
   */
  creator?: string;
}

export const DEFAULT_CREATOR = 'Images to PDF (runs in your browser)';

export type BuildStage = 'embedding' | 'saving';

export interface BuildArgs {
  count: number;
  getImage: (index: number) => Promise<PreparedImage>;
  /** Called when embedding the primary image throws (e.g. a JPEG pdf-lib cannot parse). */
  getFallbackImage?: (index: number, error: unknown) => Promise<PreparedImage>;
  options: BuildOptions;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number, stage: BuildStage) => void;
  /** Objects serialized between yields while saving (pdf-lib default 50). Infinity never yields. */
  objectsPerTick?: number;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
}

/**
 * Lets other tasks run. Uses scheduler.yield() or a MessageChannel message rather than
 * setTimeout, which browsers throttle to once per second (or less) in background tabs.
 */
function yieldToEventLoop(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (typeof scheduler?.yield === 'function') return scheduler.yield();
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

/** Keeps content streams short and free of float noise such as 0.30000000000000004. */
function round(value: number): number {
  const rounded = Math.round(value * 10_000) / 10_000;
  return rounded === 0 ? 0 : rounded;
}

type IccCache = Map<string, Array<{ data: Uint8Array; ref: PDFRef }>>;

const COMPONENTS: Record<string, number> = { DeviceGray: 1, DeviceRGB: 3, DeviceCMYK: 4 };
const ALTERNATES: Record<number, string> = { 1: 'DeviceGray', 3: 'DeviceRGB', 4: 'DeviceCMYK' };

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** FNV-1a over the bytes: a cheap cache key; equal keys are still compared byte by byte. */
function hashBytes(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i]!, 0x01000193);
  return hash >>> 0;
}

/**
 * Replaces the image's Device colour space with [/ICCBased profile] so viewers show
 * Display P3 / Adobe RGB samples with the right colours. Identical profiles are stored once.
 */
function applyIccProfile(doc: PDFDocument, imageRef: PDFRef, colorSpace: string, icc: Uint8Array, cache: IccCache): void {
  const profile = readIccProfile(icc);
  const components = COMPONENTS[colorSpace];
  const image = doc.context.lookup(imageRef);
  if (!profile || profile.components !== components || !(image instanceof PDFRawStream)) return;
  const key = `${components}:${profile.data.length}:${hashBytes(profile.data)}`;
  const entries = cache.get(key) ?? [];
  let profileRef = entries.find((entry) => sameBytes(entry.data, profile.data))?.ref;
  if (!profileRef) {
    profileRef = doc.context.register(
      doc.context.flateStream(profile.data, { N: components, Alternate: ALTERNATES[components]! }),
    );
    entries.push({ data: profile.data, ref: profileRef });
    cache.set(key, entries);
  }
  image.dict.set(PDFName.of('ColorSpace'), doc.context.obj([PDFName.of('ICCBased'), profileRef]));
}

/**
 * Embeds one image XObject and returns its reference.
 *
 * Uses pdf-lib's public JpegEmbedder / PngEmbedder (what doc.embedJpg / embedPng use
 * internally) instead of PDFDocument.embedJpg/embedPng: those register the image with
 * the document up front and embed it lazily at save time, so a failed or rejected
 * image would break save() or leave an orphaned copy of its bytes in the file.
 * Here nothing is registered until the image has parsed and its size is verified.
 */
async function embed(doc: PDFDocument, image: PreparedImage, iccCache: IccCache): Promise<PDFRef> {
  // pdf-lib's JPEG parser reads `bytes.buffer` from offset 0, so hand it an exact-size view.
  // (new Uint8Array(view) copies; Buffer#slice would not.)
  const bytes =
    image.bytes.byteOffset === 0 && image.bytes.byteLength === image.bytes.buffer.byteLength
      ? image.bytes
      : new Uint8Array(image.bytes);
  let embedder: JpegEmbedder | PngEmbedder;
  try {
    embedder = image.kind === 'jpeg' ? await JpegEmbedder.for(bytes) : await PngEmbedder.for(bytes);
  } catch (error) {
    // pdf-lib's PNG decoder throws plain strings.
    throw error instanceof Error ? error : new Error(`Could not read ${image.kind.toUpperCase()} data: ${String(error)}`);
  }
  // pdf-lib's marker walk is naive; a size mismatch means it misread the file.
  if (embedder.width !== image.width || embedder.height !== image.height) {
    throw new Error(
      `Embedded image is ${embedder.width}x${embedder.height}, expected ${image.width}x${image.height}`,
    );
  }
  const ref = await embedder.embedIntoContext(doc.context);
  if (image.icc) applyIccProfile(doc, ref, embedder.colorSpace, image.icc, iccCache);
  return ref;
}

export async function buildImagesPdf(args: BuildArgs): Promise<Uint8Array> {
  const { count, getImage, getFallbackImage, options, signal, onProgress, objectsPerTick = 50 } = args;
  if (!Number.isInteger(count) || count < 1) throw new Error('At least one image is required');
  throwIfAborted(signal);

  const doc = await PDFDocument.create();
  const now = new Date();
  if (options.title) doc.setTitle(options.title);
  doc.setCreator(options.creator || DEFAULT_CREATOR);
  doc.setProducer('pdf-lib');
  doc.setCreationDate(now);
  doc.setModificationDate(now);
  const iccCache: IccCache = new Map();

  for (let index = 0; index < count; index++) {
    throwIfAborted(signal);
    let prepared = await getImage(index);
    throwIfAborted(signal);

    let imageRef: PDFRef;
    try {
      imageRef = await embed(doc, prepared, iccCache);
    } catch (error) {
      if (!getFallbackImage) throw error;
      throwIfAborted(signal);
      prepared = await getFallbackImage(index, error);
      throwIfAborted(signal);
      imageRef = await embed(doc, prepared, iccCache);
    }

    const displayed = orientedSize(prepared.width, prepared.height, prepared.orientation);
    const placement = computePlacement(displayed.width, displayed.height, options);
    const page = doc.addPage([round(placement.pageWidth), round(placement.pageHeight)]);
    // Same XObject registration as PDFPage.drawImage in pdf-lib 1.17.1.
    const name = page.node.newXObject('Image', imageRef);
    const [a, b, c, d, e, f] = orientationMatrix(prepared.orientation, placement).map(round);
    page.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(a!, b!, c!, d!, e!, f!),
      drawObject(name),
      popGraphicsState(),
    );

    onProgress?.(index + 1, count, 'embedding');
    await yieldToEventLoop();
  }

  throwIfAborted(signal);
  onProgress?.(count, count, 'saving');
  const bytes = await doc.save({ useObjectStreams: true, objectsPerTick });
  throwIfAborted(signal);
  return bytes;
}
