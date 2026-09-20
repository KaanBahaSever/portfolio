/**
 * Loads a PDF and copies selected pages into new PDFs with pdf-lib. No DOM: runs in a
 * Web Worker in the browser and under Node in tests.
 *
 * The page script must not import this module (it would bundle pdf-lib into the page);
 * the planning helpers it re-exports live in ./page-ranges.ts for that reason.
 */

import {
  EncryptedPDFError,
  PDFArray,
  PDFBool,
  PDFCatalog,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNull,
  PDFNumber,
  PDFObjectCopier,
  PDFPage,
  PDFPageLeaf,
  PDFPageTree,
  PDFRawStream,
  PDFStream,
  PDFString,
  decodePDFRawStream,
} from 'pdf-lib';
import type { PDFContext, PDFObject, PDFRef } from 'pdf-lib';
import { hasPdfSignature } from './page-ranges.ts';
import { keepTrailerEntriesAcrossXRefStreams } from './xref-trailer.ts';

export {
  chunkPages,
  describeRange,
  expandRanges,
  hasPdfSignature,
  parsePageRanges,
  planOutputs,
  summarizePlan,
} from './page-ranges.ts';
export type { PageRange, PlannedOutput, PlanResult, SplitMode } from './page-ranges.ts';

export const PASSWORD_PROTECTED_MESSAGE =
  'This PDF is password-protected or has editing restrictions, so it can’t be split here. Save an unprotected copy first (for example with Print → Save as PDF), then try again.';
export const NOT_A_PDF_MESSAGE = 'This file isn’t a PDF.';
export const DAMAGED_PDF_MESSAGE = 'This PDF couldn’t be read. The file may be damaged or incomplete.';
export const NO_PAGES_MESSAGE = 'This PDF has no pages.';

/** The PDF is encrypted (pdf-lib cannot decrypt it). `name` survives postMessage. */
export class PdfPasswordError extends Error {
  constructor(options?: { cause?: unknown }) {
    super(PASSWORD_PROTECTED_MESSAGE, options);
    this.name = 'PdfPasswordError';
  }
}

/** Not a PDF, damaged, or without pages. The message is meant for people. */
export class PdfInvalidError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PdfInvalidError';
  }
}

export interface PdfInfo {
  pageCount: number;
  title?: string;
}

export interface LoadPdfOptions {
  /** Objects parsed between pauses (pdf-lib default 100). A worker can use Infinity. */
  parseSpeed?: number;
}

export interface ExtractOptions {
  /** Objects serialized between pauses while saving (pdf-lib default 50). A worker can use Infinity. */
  objectsPerTick?: number;
}

function isOutOfMemory(error: unknown): boolean {
  if (!(error instanceof RangeError)) return false;
  return /alloc|memory|array length|buffer/i.test(error.message);
}

const ENCRYPT_KEY = [0x2f, 0x45, 0x6e, 0x63, 0x72, 0x79, 0x70, 0x74]; // "/Encrypt"

/**
 * Whether the raw file mentions an /Encrypt entry. Used only after parsing failed:
 * encrypted object streams can't be decoded, so pdf-lib may fail before it reaches its
 * own encryption check.
 */
export function mentionsEncryption(bytes: Uint8Array): boolean {
  const last = bytes.length - ENCRYPT_KEY.length;
  for (let i = bytes.indexOf(0x2f); i !== -1 && i <= last; i = bytes.indexOf(0x2f, i + 1)) {
    let match = true;
    for (let k = 1; k < ENCRYPT_KEY.length; k++) {
      if (bytes[i + k] !== ENCRYPT_KEY[k]) {
        match = false;
        break;
      }
    }
    // "/EncryptMetadata" is a key inside the encryption dictionary: still encrypted.
    if (match) return true;
  }
  return false;
}

function isEncryptedError(error: unknown): boolean {
  return (
    error instanceof EncryptedPDFError ||
    (error instanceof Error && /is encrypted/i.test(error.message) && /PDFDocument\.load/.test(error.message))
  );
}

/** Maps any failure while loading to PdfPasswordError / PdfInvalidError (out-of-memory errors pass through). */
export function toLoadError(error: unknown, bytes?: Uint8Array): Error {
  if (error instanceof PdfPasswordError || error instanceof PdfInvalidError) return error;
  if (isEncryptedError(error)) return new PdfPasswordError({ cause: error });
  if (isOutOfMemory(error)) return error as RangeError;
  if (bytes && mentionsEncryption(bytes)) return new PdfPasswordError({ cause: error });
  return new PdfInvalidError(DAMAGED_PDF_MESSAGE, { cause: error });
}

/** Parses the PDF. Throws PdfInvalidError or PdfPasswordError with a message for people. */
export async function loadPdf(bytes: Uint8Array, options: LoadPdfOptions = {}): Promise<PDFDocument> {
  if (!hasPdfSignature(bytes.subarray(0, 1024))) throw new PdfInvalidError(NOT_A_PDF_MESSAGE);
  // Otherwise an encrypted linearized file with xref streams loads as unencrypted.
  keepTrailerEntriesAcrossXRefStreams();
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, {
      updateMetadata: false,
      parseSpeed: options.parseSpeed ?? 100,
    });
  } catch (error) {
    throw toLoadError(error, bytes);
  }
  let pageCount: number;
  try {
    pageCount = doc.getPageCount();
  } catch (error) {
    throw toLoadError(error);
  }
  if (pageCount < 1) throw new PdfInvalidError(NO_PAGES_MESSAGE);
  return doc;
}

export function getPdfInfo(doc: PDFDocument): PdfInfo {
  const info: PdfInfo = { pageCount: doc.getPageCount() };
  try {
    const title = doc.getTitle()?.trim();
    if (title) info.title = title;
  } catch {
    // A malformed Title entry is not worth failing for.
  }
  return info;
}

export async function loadPdfInfo(bytes: Uint8Array, options?: LoadPdfOptions): Promise<PdfInfo> {
  return getPdfInfo(await loadPdf(bytes, options));
}

// ------------------------------------------------------------------ copying pages

const KEY = {
  A: PDFName.of('A'),
  AA: PDFName.of('AA'),
  AcroForm: PDFName.of('AcroForm'),
  Annots: PDFName.of('Annots'),
  AP: PDFName.of('AP'),
  B: PDFName.of('B'),
  CharProcs: PDFName.of('CharProcs'),
  ColorSpace: PDFName.of('ColorSpace'),
  Contents: PDFName.of('Contents'),
  DA: PDFName.of('DA'),
  DecodeParms: PDFName.of('DecodeParms'),
  Dest: PDFName.of('Dest'),
  DR: PDFName.of('DR'),
  ExtGState: PDFName.of('ExtGState'),
  Font: PDFName.of('Font'),
  FT: PDFName.of('FT'),
  G: PDFName.of('G'),
  IRT: PDFName.of('IRT'),
  Kids: PDFName.of('Kids'),
  Lock: PDFName.of('Lock'),
  NeedAppearances: PDFName.of('NeedAppearances'),
  Next: PDFName.of('Next'),
  OCProperties: PDFName.of('OCProperties'),
  P: PDFName.of('P'),
  Parent: PDFName.of('Parent'),
  Pattern: PDFName.of('Pattern'),
  Popup: PDFName.of('Popup'),
  Predictor: PDFName.of('Predictor'),
  Properties: PDFName.of('Properties'),
  Resources: PDFName.of('Resources'),
  S: PDFName.of('S'),
  Shading: PDFName.of('Shading'),
  SMask: PDFName.of('SMask'),
  Subtype: PDFName.of('Subtype'),
  SV: PDFName.of('SV'),
  T: PDFName.of('T'),
  Type: PDFName.of('Type'),
  V: PDFName.of('V'),
  XObject: PDFName.of('XObject'),
} as const;

const NAME = {
  Image: PDFName.of('Image'),
  Sig: PDFName.of('Sig'),
  Type3: PDFName.of('Type3'),
  Widget: PDFName.of('Widget'),
} as const;

function nameOf(dict: PDFDict, key: PDFName): string | undefined {
  const value = dict.lookup(key);
  return value instanceof PDFName ? value.decodeText() : undefined;
}

// ------------------------------------------------------------------ copying: document structure

const STRUCTURE_TYPES: ReadonlySet<PDFObject> = new Set([PDFName.of('Catalog'), PDFName.of('Pages'), PDFName.of('Page')]);

/**
 * The source as the copier reads it: the catalog, page tree nodes and pages look like null.
 *
 * pdf-lib copies everything an object refers to. Any path from a page back to the document
 * structure (a signature's /Reference → /Data, /SeparationInfo, a structure element…) would
 * otherwise put invisible copies of other pages, or of the whole document, into the output.
 * The page being copied is handed to the copier directly, never through lookup(), which is the
 * only thing PDFObjectCopier (pdf-lib 1.17) reads from its source context.
 */
function withoutDocumentStructure(context: PDFContext): PDFContext {
  const view = Object.create(context) as PDFContext;
  view.lookup = ((ref: Parameters<PDFContext['lookup']>[0]) => {
    const object = context.lookup(ref);
    if (object instanceof PDFCatalog || object instanceof PDFPageTree || object instanceof PDFPageLeaf) return PDFNull;
    const type = object instanceof PDFDict ? object.get(KEY.Type) : undefined;
    return type && STRUCTURE_TYPES.has(type) ? PDFNull : object;
  }) as PDFContext['lookup'];
  return view;
}

// ------------------------------------------------------------------ copying: resources

/** Resource types that content refers to by name. Other entries (such as /ProcSet) are kept as they are. */
const NAMED_RESOURCES: readonly PDFName[] = [
  KEY.XObject,
  KEY.Font,
  KEY.ExtGState,
  KEY.Pattern,
  KEY.Shading,
  KEY.ColorSpace,
  KEY.Properties,
];

function pageResources(leaf: PDFPageLeaf): PDFDict | undefined {
  try {
    return leaf.Resources();
  } catch {
    return undefined; // not a dictionary
  }
}

const sharedResourcesCache = new WeakMap<PDFDocument, ReadonlySet<PDFDict>>();

/** The named-resource dictionaries (such as a page's /XObject) that more than one page of `doc` uses. */
function sharedResourceDicts(doc: PDFDocument): ReadonlySet<PDFDict> {
  const cached = sharedResourcesCache.get(doc);
  if (cached) return cached;
  const seen = new Set<PDFDict>();
  const shared = new Set<PDFDict>();
  for (const page of doc.getPages()) {
    const resources = pageResources(page.node);
    if (!resources) continue;
    const dicts = new Set<PDFDict>();
    for (const key of NAMED_RESOURCES) {
      const dict = resources.lookup(key);
      if (dict instanceof PDFDict) dicts.add(dict);
    }
    for (const dict of dicts) (seen.has(dict) ? shared : seen).add(dict);
  }
  sharedResourcesCache.set(doc, shared);
  return shared;
}

/** A resource key as content spells it without escapes, or undefined if it needs "#xx" escapes. */
function plainKey(key: PDFName): string | undefined {
  const encoded = key.asString(); // "/" + the name, with irregular characters escaped
  return encoded.includes('#') ? undefined : encoded.slice(1);
}

/** Bytes that end a name token: white-space and delimiters, as pdf-lib's parser reads them. */
const ENDS_NAME = new Uint8Array(256);
for (const code of [0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20, 0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]) {
  ENDS_NAME[code] = 1;
}

/**
 * Adds every name token in `bytes` that is one of `wanted` to `found` (and, if new, to `added`).
 * Tokens are not read in context, so a name-like part of a string or of inline image data may
 * match too: that can only keep a resource, never drop one.
 */
function findNames(bytes: Uint8Array, wanted: ReadonlySet<string>, maxLength: number, found: Set<string>, added: string[]): void {
  const length = bytes.length;
  let slash = bytes.indexOf(0x2f);
  while (slash !== -1) {
    let end = slash + 1;
    while (end < length && !ENDS_NAME[bytes[end]!]) end++;
    // An escape ("#xx") spells one character with three bytes: longer tokens can't be any key.
    if (end - slash - 1 <= maxLength * 3) {
      let token = '';
      for (let i = slash + 1; i < end; i++) token += String.fromCharCode(bytes[i]!);
      // The same unescaping as pdf-lib's PDFName.of().
      if (token.includes('#')) token = token.replace(/#([\dABCDEF]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
      if (wanted.has(token) && !found.has(token)) {
        found.add(token);
        added.push(token);
      }
    }
    slash = bytes.indexOf(0x2f, end);
  }
}

function usesPredictor(dict: PDFDict): boolean {
  const params = dict.lookup(KEY.DecodeParms);
  const list = params instanceof PDFArray ? params.asArray().map((item) => dict.context.lookup(item)) : [params];
  return list.some((item) => {
    if (!(item instanceof PDFDict)) return false;
    const predictor = item.lookup(KEY.Predictor);
    return predictor instanceof PDFNumber && predictor.asNumber() > 1;
  });
}

/** The decoded content of a stream, or undefined if it can't be decoded here. */
function contentBytes(stream: PDFStream): Uint8Array | undefined {
  // A parsed file only has raw streams. pdf-lib's decoders ignore predictors, which would garble the content.
  if (!(stream instanceof PDFRawStream) || usesPredictor(stream.dict)) return undefined;
  try {
    return decodePDFRawStream(stream).decode();
  } catch {
    return undefined;
  }
}

function hasOwnResources(stream: PDFStream): boolean {
  return stream.dict.has(KEY.Resources);
}

/** Content that a resource paints with the page's resources, because it has none of its own. */
function contentUsingPageResources(category: PDFName, value: PDFObject | undefined): PDFStream[] {
  if (category === KEY.XObject || category === KEY.Pattern) {
    // Form XObjects and tiling patterns; images have no content.
    const isContent = value instanceof PDFStream && value.dict.lookup(KEY.Subtype) !== NAME.Image;
    return isContent && !hasOwnResources(value) ? [value] : [];
  }
  if (!(value instanceof PDFDict)) return [];
  if (category === KEY.Font) {
    if (value.lookup(KEY.Subtype) !== NAME.Type3 || value.has(KEY.Resources)) return [];
    const glyphs = value.lookup(KEY.CharProcs);
    if (!(glyphs instanceof PDFDict)) return [];
    return glyphs.values().flatMap((glyph) => {
      const stream = glyphs.context.lookup(glyph);
      return stream instanceof PDFStream ? [stream] : [];
    });
  }
  if (category === KEY.ExtGState) {
    const mask = value.lookup(KEY.SMask);
    const group = mask instanceof PDFDict ? mask.lookup(KEY.G) : undefined;
    return group instanceof PDFStream && !hasOwnResources(group) ? [group] : [];
  }
  return [];
}

/**
 * The resource keys the page's content can use, or undefined if some of that content can't be
 * read (then nothing may be dropped). Form XObjects, tiling patterns, soft masks, Type 3 glyphs
 * and annotation appearances without resources of their own paint with the page's, so their
 * content counts too.
 */
function usedResourceKeys(leaf: PDFPageLeaf, resources: PDFDict, annotations: readonly PDFDict[]): Set<string> | undefined {
  const context = leaf.context;
  const pending: PDFStream[] = [];
  const queued = new Set<PDFStream>();
  const queue = (object: PDFObject | undefined) => {
    if (object instanceof PDFStream && !queued.has(object)) {
      queued.add(object);
      pending.push(object);
    }
  };

  const categories: Array<[PDFName, PDFDict]> = [];
  const wanted = new Set<string>();
  let maxLength = 0;
  for (const category of NAMED_RESOURCES) {
    const dict = resources.lookup(category);
    if (!(dict instanceof PDFDict)) continue;
    categories.push([category, dict]);
    for (const [key, value] of dict.entries()) {
      const plain = plainKey(key);
      if (plain === undefined) {
        // Always kept (see trimmedResources), so whatever it paints counts as used.
        for (const stream of contentUsingPageResources(category, context.lookup(value))) queue(stream);
      } else {
        wanted.add(plain);
        maxLength = Math.max(maxLength, plain.length);
      }
    }
  }
  if (wanted.size === 0) return new Set(); // nothing that could be dropped

  const contents = leaf.lookup(KEY.Contents);
  if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i++) queue(contents.lookup(i));
  } else {
    queue(contents);
  }
  for (const annotation of annotations) {
    const appearances = annotation.lookup(KEY.AP);
    if (!(appearances instanceof PDFDict)) continue;
    for (const entry of appearances.values()) {
      const value = context.lookup(entry);
      const states = value instanceof PDFDict ? value.values().map((state) => context.lookup(state)) : [value];
      for (const state of states) {
        if (state instanceof PDFStream && !hasOwnResources(state)) queue(state);
      }
    }
  }

  const used = new Set<string>();
  while (pending.length > 0) {
    const bytes = contentBytes(pending.pop()!);
    if (!bytes) return undefined;
    const added: string[] = [];
    findNames(bytes, wanted, maxLength, used, added);
    for (const name of added) {
      const key = PDFName.of(name); // an existing key, so pdf-lib's name pool doesn't grow
      for (const [category, dict] of categories) {
        for (const stream of contentUsingPageResources(category, dict.lookup(key))) queue(stream);
      }
    }
  }
  return used;
}

/**
 * The page's resources without the entries its content never uses, or undefined to copy them
 * as they are.
 *
 * Many producers (LibreOffice, for one) give every page the same resource dictionary, listing
 * the images and fonts of the whole document. Copied as it is, every output file would carry
 * all of them: larger files, and other pages' images recoverable from each one. Only
 * dictionaries that other pages share are trimmed, and only when all the content can be read.
 */
function trimmedResources(leaf: PDFPageLeaf, annotations: readonly PDFDict[], shared: ReadonlySet<PDFDict>): PDFDict | undefined {
  const resources = pageResources(leaf);
  if (!resources) return undefined;
  const isShared = (value: PDFObject | undefined): value is PDFDict => value instanceof PDFDict && shared.has(value);
  if (!NAMED_RESOURCES.some((category) => isShared(resources.lookup(category)))) return undefined;

  const used = usedResourceKeys(leaf, resources, annotations);
  if (!used) return undefined;

  const context = leaf.context;
  const trimmed = PDFDict.withContext(context);
  for (const [key, value] of resources.entries()) {
    const dict = NAMED_RESOURCES.includes(key) ? context.lookup(value) : undefined;
    if (!isShared(dict)) {
      trimmed.set(key, value);
      continue;
    }
    const kept = PDFDict.withContext(context);
    for (const [name, entry] of dict.entries()) {
      const plain = plainKey(name);
      if (plain === undefined || used.has(plain)) kept.set(name, entry);
    }
    trimmed.set(key, kept);
  }
  return trimmed;
}

// ------------------------------------------------------------------ copying: annotations and forms

/** The source form, if it relies on the viewer to draw field values (/NeedAppearances true). */
function formNeedingAppearances(doc: PDFDocument): PDFDict | undefined {
  const form = doc.catalog.lookup(KEY.AcroForm);
  if (!(form instanceof PDFDict)) return undefined;
  const flag = form.lookup(KEY.NeedAppearances);
  return flag instanceof PDFBool && flag.asBoolean() ? form : undefined;
}

/** Field entries that widgets inherit from their parent fields. */
const FIELD_KEYS = ['FT', 'Ff', 'V', 'DV', 'DA', 'Q', 'MaxLen', 'Opt', 'TI', 'I', 'DS', 'RV'].map((key) => PDFName.of(key));

/**
 * Turns a widget's copy into a field of its own: the entries it inherits from its parent fields
 * (which are not copied) and its full name are set on it. Signature fields are left alone.
 */
function makeStandaloneField(widget: PDFDict, copy: PDFDict): void {
  const entries = new Map<PDFName, PDFObject>();
  const names: string[] = [];
  try {
    const chain: PDFDict[] = [];
    // A loop in a damaged file ends the walk.
    for (let node: PDFObject | undefined = widget; node instanceof PDFDict && !chain.includes(node) && chain.length < 64; node = node.lookup(KEY.Parent)) {
      chain.push(node);
    }
    for (const key of FIELD_KEYS) {
      const value = chain.find((node) => node.has(key))?.get(key);
      if (value !== undefined) entries.set(key, value);
    }
    const type = widget.context.lookup(entries.get(KEY.FT));
    if (!(type instanceof PDFName) || type === NAME.Sig) return;
    for (const node of chain) {
      const title = node.lookup(KEY.T);
      if (title instanceof PDFString || title instanceof PDFHexString) names.unshift(title.decodeText());
    }
  } catch {
    return; // malformed field entries: keep the plain widget
  }
  if (names.length === 0) return;
  for (const [key, value] of entries) copy.set(key, value);
  copy.set(KEY.T, PDFHexString.fromText(names.join('.')));
}

/** Whether a copied widget was made a field by makeStandaloneField. */
function isStandaloneField(annotation: PDFDict): boolean {
  if (annotation.get(KEY.Subtype) !== NAME.Widget || annotation.get(KEY.T) === undefined) return false;
  const type = annotation.lookup(KEY.FT);
  return type instanceof PDFName && type !== NAME.Sig;
}

/**
 * A copy of one annotation that references nothing outside its own page, or null to drop it.
 *
 * pdf-lib copies everything an object refers to. A link to page 40 (or a form field's
 * parent, whose other widgets sit on other pages) would drag those whole pages into
 * every output file, invisibly. So internal links, popups and form-field structure are
 * left out; web links and the visible appearance of other annotations are kept.
 * With `formFields`, widgets become fields of their own (see extractPages).
 */
function portableAnnotation(annotation: PDFDict, formFields: boolean): PDFDict | null {
  const subtype = nameOf(annotation, KEY.Subtype);
  if (subtype === 'Popup') return null;

  const copy = annotation.clone();
  if (formFields && subtype === 'Widget') makeStandaloneField(annotation, copy);
  for (const key of [KEY.P, KEY.Parent, KEY.Popup, KEY.IRT, KEY.AA, KEY.Dest, KEY.Kids, KEY.Lock, KEY.SV]) copy.delete(key);
  // A signature value can lead back to the whole document (/Reference → /Data → catalog).
  if (copy.lookup(KEY.V) instanceof PDFDict) copy.delete(KEY.V);

  let keptLink = false;
  const action = annotation.lookup(KEY.A);
  if (action instanceof PDFDict && nameOf(action, KEY.S) === 'URI') {
    const actionCopy = action.clone();
    actionCopy.delete(KEY.Next); // a follow-up action could be a jump to another page
    copy.set(KEY.A, actionCopy);
    keptLink = true;
  } else {
    copy.delete(KEY.A);
  }

  if (subtype === 'Link' && !keptLink) return null;
  return copy;
}

/**
 * The page dictionary to copy: same content, but only annotations that stay on this page and
 * only the shared resources that this page uses.
 */
function portablePage(leaf: PDFPageLeaf, shared: ReadonlySet<PDFDict>, formFields: boolean): PDFPageLeaf {
  const copy = leaf.clone();
  copy.delete(KEY.B); // article threads link to other pages
  copy.delete(KEY.AA); // page open/close actions

  let annotations: PDFArray | undefined;
  try {
    annotations = leaf.Annots();
  } catch {
    annotations = undefined; // not an array: drop it
  }

  const kept: PDFDict[] = [];
  if (annotations) {
    for (let i = 0; i < annotations.size(); i++) {
      const annotation = annotations.lookup(i);
      if (!(annotation instanceof PDFDict)) continue;
      const portable = portableAnnotation(annotation, formFields);
      if (portable) kept.push(portable);
    }
  }
  if (kept.length > 0) {
    const array = PDFArray.withContext(leaf.context);
    for (const annotation of kept) array.push(annotation);
    copy.set(KEY.Annots, array);
  } else {
    copy.delete(KEY.Annots);
  }

  const resources = trimmedResources(leaf, kept, shared);
  if (resources) copy.set(KEY.Resources, resources);
  return copy;
}

/**
 * A new PDF with the given source pages (0-based, in this order; repeats allowed).
 * Bookmarks, internal links and document-level structure are not copied. Layer visibility is.
 * Form fields are copied only (as standalone fields) when the form relies on the viewer to
 * draw their values, since those values would otherwise disappear.
 */
export async function extractPages(
  src: PDFDocument,
  indices: readonly number[],
  options: ExtractOptions = {},
): Promise<Uint8Array> {
  const pageCount = src.getPageCount();
  if (indices.length === 0) throw new RangeError('No pages to extract');
  for (const index of indices) {
    if (!Number.isInteger(index) || index < 0 || index >= pageCount) {
      throw new RangeError(`Page index ${index} is out of range (0–${pageCount - 1})`);
    }
  }

  const dest = await PDFDocument.create();
  // One copier per output: resources shared by several pages (fonts, images) are copied once.
  const copier = PDFObjectCopier.for(withoutDocumentStructure(src.context), dest.context);
  const pages = src.getPages();
  const shared = sharedResourceDicts(src);
  const form = formNeedingAppearances(src);
  const fields: PDFRef[] = [];

  for (const index of indices) {
    const copied = copier.copy(portablePage(pages[index]!.node, shared, form !== undefined));
    // Annotations were attached as direct dictionaries; the PDF format wants references.
    const annotations = copied.get(KEY.Annots);
    if (annotations instanceof PDFArray) {
      for (let i = 0; i < annotations.size(); i++) {
        const item = annotations.get(i);
        if (!(item instanceof PDFDict)) continue;
        const ref = dest.context.register(item);
        annotations.set(i, ref);
        if (form && isStandaloneField(item)) fields.push(ref);
      }
    }
    const ref = dest.context.register(copied);
    dest.addPage(PDFPage.of(copied, ref, dest));
  }

  // Without /OCProperties, viewers show every layer, including those hidden by default.
  const layers = src.catalog.get(KEY.OCProperties);
  if (layers && src.context.lookup(layers) instanceof PDFDict) {
    dest.catalog.set(KEY.OCProperties, copier.copy(layers));
  }

  if (form && fields.length > 0) {
    const acroForm = dest.context.obj({ Fields: fields, NeedAppearances: true });
    for (const key of [KEY.DA, KEY.DR]) {
      const value = form.get(key);
      if (value !== undefined) acroForm.set(key, copier.copy(value));
    }
    dest.catalog.set(KEY.AcroForm, dest.context.register(acroForm));
  }

  return dest.save({ useObjectStreams: true, objectsPerTick: options.objectsPerTick ?? 50 });
}
