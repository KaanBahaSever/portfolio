/**
 * Web Worker that parses the PDF and creates the split files with pdf-lib (browser only).
 *
 * The parsed source document stays here between runs, so changing the split mode never
 * parses the file again; a new file replaces it. The page cancels by terminating the
 * worker, which stops pdf-lib wherever it is.
 *
 * Each finished file goes into a Blob at once, which moves its bytes out of this worker's
 * memory: only the file being created is ever held here. The page receives one Blob (a
 * handle, not a copy), and the ZIP around several files only references their Blobs.
 */

import type { PDFDocument } from 'pdf-lib';
import { extractPages, getPdfInfo, loadPdf } from '../../../lib/pdf/split-pdf.ts';
import { crc32, createZipIndex } from '../../../lib/zip/zip-store.ts';
import type { FromSplitWorker, OutputFileInfo, OutputRequest, ToSplitWorker } from './types.ts';

const scope = self as unknown as {
  postMessage(message: FromSplitWorker, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<ToSplitWorker>) => void) | null;
};

let source: Promise<PDFDocument> | null = null;

function post(message: FromSplitWorker, transfer: Transferable[] = []): void {
  scope.postMessage(message, transfer);
}

function postError(id: number, error: unknown): void {
  post({
    type: 'error',
    id,
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
  });
}

async function load(id: number, bytes: Uint8Array): Promise<void> {
  // Release the previous document before parsing the next one: both at once could exhaust memory.
  source = null;
  const pending = loadPdf(bytes, { parseSpeed: Infinity });
  source = pending;
  try {
    const info = getPdfInfo(await pending);
    post({ type: 'loaded', id, pageCount: info.pageCount, ...(info.title ? { title: info.title } : {}) });
  } catch (error) {
    if (source === pending) source = null;
    postError(id, error);
  }
}

interface StoredOutput {
  file: OutputFileInfo;
  blob: Blob;
  checksum: number;
}

async function split(id: number, outputs: OutputRequest[], zip: boolean): Promise<void> {
  try {
    if (!source) throw new Error('No PDF is loaded');
    const doc = await source;
    const total = outputs.length;
    const asZip = zip || total !== 1;
    const stored: StoredOutput[] = [];

    for (let index = 0; index < total; index++) {
      post({ type: 'progress', id, stage: 'creating', done: index, total });
      const output = outputs[index]!;
      // Nothing else runs in this worker, so saving never needs to pause.
      const bytes = await extractPages(doc, output.indices, { objectsPerTick: Infinity });
      stored.push({
        file: { name: output.filename, size: bytes.byteLength, pages: output.indices.length },
        checksum: asZip ? crc32(bytes) : 0,
        blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
      });
    }

    if (!asZip) {
      const [only] = stored as [StoredOutput];
      post({ type: 'pdf', id, blob: only.blob, file: only.file });
      return;
    }

    post({ type: 'progress', id, stage: 'zipping', done: total, total });
    const date = new Date();
    const zipIndex = createZipIndex(stored.map(({ file, checksum }) => ({ name: file.name, size: file.size, crc32: checksum, date })));
    const parts: BlobPart[] = [];
    zipIndex.headers.forEach((header, i) => parts.push(header, stored[i]!.blob));
    parts.push(zipIndex.tail);
    const files = stored.map(({ file }, i) => ({ ...file, name: zipIndex.entries[i]!.name }));
    post({ type: 'zip', id, blob: new Blob(parts, { type: 'application/zip' }), files });
  } catch (error) {
    postError(id, error);
  }
}

scope.onmessage = (event) => {
  const message = event.data;
  if (message.type === 'load') void load(message.id, message.bytes);
  else if (message.type === 'split') void split(message.id, message.outputs, message.zip);
};

post({ type: 'ready' });
