/**
 * Merges byte-identical streams (the same ICC profile, logo, font or form stored many
 * times, common in merged or scanned PDFs). Lossless. Pure: no DOM, runs under Node.
 */

import { PDFArray, PDFDict, PDFInvalidObject, PDFName, PDFRawStream, PDFRef, PDFStream } from 'pdf-lib';
import type { PDFDocument, PDFObject } from 'pdf-lib';

const LENGTH = PDFName.of('Length');
/** Streams tied to the structure tree stay separate so accessibility tags keep their targets. */
const STRUCTURE_KEYS = [PDFName.of('StructParent'), PDFName.of('StructParents')];
const MAX_PASSES = 4;

/** Order-independent signature of a stream dictionary, ignoring /Length. */
function dictSignature(dict: PDFDict): string {
  return dict
    .entries()
    .filter(([key]) => key !== LENGTH)
    .map(([key, value]) => `${key.asString()} ${value.toString()}`)
    .sort()
    .join('\n');
}

/** FNV-1a; equal hashes are always confirmed byte by byte. */
function hashBytes(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i]!, 0x01000193);
  return hash >>> 0;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Points every reference in `replacements` (duplicate -> kept) at the kept object. */
function rewriteReferences(doc: PDFDocument, replacements: Map<PDFRef, PDFRef>): void {
  const stack: PDFObject[] = doc.context.enumerateIndirectObjects().map(([, object]) => object);
  while (stack.length > 0) {
    const object = stack.pop()!;
    if (object instanceof PDFDict) {
      for (const [key, value] of object.entries()) {
        const target = value instanceof PDFRef ? replacements.get(value) : undefined;
        if (target) object.set(key, target);
        else if (value instanceof PDFDict || value instanceof PDFArray) stack.push(value);
      }
    } else if (object instanceof PDFArray) {
      for (let i = 0; i < object.size(); i++) {
        const value = object.get(i);
        const target = value instanceof PDFRef ? replacements.get(value) : undefined;
        if (target) object.set(i, target);
        else if (value instanceof PDFDict || value instanceof PDFArray) stack.push(value);
      }
    } else if (object instanceof PDFStream) {
      stack.push(object.dict);
    }
  }
  const trailer = doc.context.trailerInfo;
  if (trailer.Root instanceof PDFRef) trailer.Root = replacements.get(trailer.Root) ?? trailer.Root;
  if (trailer.Info instanceof PDFRef) trailer.Info = replacements.get(trailer.Info) ?? trailer.Info;
}

/** Returns how many duplicate stream objects were merged into an identical one. */
export function mergeDuplicateStreams(doc: PDFDocument): number {
  // References inside objects pdf-lib could not parse cannot be rewritten.
  if (doc.context.enumerateIndirectObjects().some(([, object]) => object instanceof PDFInvalidObject)) return 0;
  let merged = 0;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const groups = new Map<string, Array<[PDFRef, PDFRawStream]>>();
    for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
      if (!(object instanceof PDFRawStream) || object.contents.length === 0) continue;
      if (STRUCTURE_KEYS.some((key) => object.dict.has(key))) continue;
      const key = `${object.contents.length}|${dictSignature(object.dict)}`;
      const group = groups.get(key);
      if (group) group.push([ref, object]);
      else groups.set(key, [[ref, object]]);
    }

    const replacements = new Map<PDFRef, PDFRef>();
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const kept = new Map<number, Array<[PDFRef, PDFRawStream]>>();
      for (const [ref, stream] of group) {
        const hash = hashBytes(stream.contents);
        const candidates = kept.get(hash) ?? [];
        const match = candidates.find(([, other]) => sameBytes(other.contents, stream.contents));
        if (match) {
          replacements.set(ref, match[0]);
        } else {
          candidates.push([ref, stream]);
          kept.set(hash, candidates);
        }
      }
    }
    if (replacements.size === 0) break;

    rewriteReferences(doc, replacements);
    for (const ref of replacements.keys()) doc.context.delete(ref);
    merged += replacements.size;
  }
  return merged;
}
