import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EncryptedPDFError,
  PDFArray,
  PDFBool,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNull,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFString,
  StandardFonts,
  degrees,
} from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import {
  DAMAGED_PDF_MESSAGE,
  NOT_A_PDF_MESSAGE,
  PASSWORD_PROTECTED_MESSAGE,
  PdfInvalidError,
  PdfPasswordError,
  extractPages,
  getPdfInfo,
  loadPdf,
  loadPdfInfo,
  mentionsEncryption,
  planOutputs,
  toLoadError,
} from '../src/lib/pdf/split-pdf.ts';
import type { SplitMode } from '../src/lib/pdf/split-pdf.ts';

/** Page i (0-based) is (100 + 10i) × (200 + 5i) points, so order and identity are checkable. */
function sizeOf(index: number): { width: number; height: number } {
  return { width: 100 + 10 * index, height: 200 + 5 * index };
}

async function makePdf(pageCount = 10, setup?: (doc: PDFDocument, pages: PDFPage[]) => void | Promise<void>) {
  const doc = await PDFDocument.create();
  doc.setTitle('Test document');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages: PDFPage[] = [];
  for (let i = 0; i < pageCount; i++) {
    const { width, height } = sizeOf(i);
    const page = doc.addPage([width, height]);
    page.drawText(`Page ${i + 1}`, { x: 10, y: 10, size: 12, font });
    pages.push(page);
  }
  await setup?.(doc, pages);
  return doc.save();
}

async function reload(bytes: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes, { updateMetadata: false });
}

function sizes(doc: PDFDocument): Array<{ width: number; height: number }> {
  return doc.getPages().map((page) => page.getSize());
}

function expectedSizes(indices: readonly number[]): Array<{ width: number; height: number }> {
  return indices.map(sizeOf);
}

function pageObjectCount(doc: PDFDocument): number {
  return doc.context
    .enumerateIndirectObjects()
    .filter(([, object]) => object instanceof PDFDict && object.get(PDFName.of('Type')) === PDFName.of('Page')).length;
}

function annotationsOf(doc: PDFDocument, page: PDFPage): PDFDict[] {
  const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (!annots) return [];
  return annots.asArray().map((item) => {
    assert.ok(item instanceof PDFRef, 'annotations are indirect references');
    const dict = doc.context.lookup(item);
    assert.ok(dict instanceof PDFDict);
    return dict;
  });
}

const tenPages = await makePdf(10);

test('loadPdfInfo reads the page count and title', async () => {
  assert.deepEqual(await loadPdfInfo(tenPages), { pageCount: 10, title: 'Test document' });
  const untitled = await makePdf(2, (doc) => {
    doc.setTitle('   ');
  });
  assert.deepEqual(await loadPdfInfo(untitled), { pageCount: 2 });
});

test('loadPdf keeps one parsed document that can be split repeatedly', async () => {
  const doc = await loadPdf(tenPages, { parseSpeed: Infinity });
  assert.equal(getPdfInfo(doc).pageCount, 10);
  const first = await reload(await extractPages(doc, [0, 1], { objectsPerTick: Infinity }));
  const second = await reload(await extractPages(doc, [9]));
  assert.deepEqual(sizes(first), expectedSizes([0, 1]));
  assert.deepEqual(sizes(second), expectedSizes([9]));
  assert.equal(doc.getPageCount(), 10, 'the source document is not modified');
});

test('extractPages keeps the requested order, repeats and text content', async () => {
  const doc = await loadPdf(tenPages);
  const indices = [7, 8, 9, 0, 1, 4, 4];
  const bytes = await extractPages(doc, indices);
  const out = await reload(bytes);
  assert.equal(out.getPageCount(), indices.length);
  assert.deepEqual(sizes(out), expectedSizes(indices));
  // Repeated pages are separate page objects that share their content.
  const [a, b] = [out.getPage(5).node, out.getPage(6).node];
  assert.notEqual(a, b);
  assert.equal(a.get(PDFName.of('Contents'))?.toString(), b.get(PDFName.of('Contents'))?.toString());
  // Fonts come along with the pages.
  const fonts = out.getPage(0).node.Resources()?.lookup(PDFName.of('Font'), PDFDict);
  assert.ok(fonts && fonts.keys().length > 0);
});

test('extractPages rejects empty and out-of-range selections', async () => {
  const doc = await loadPdf(tenPages);
  await assert.rejects(extractPages(doc, []), RangeError);
  await assert.rejects(extractPages(doc, [10]), RangeError);
  await assert.rejects(extractPages(doc, [-1]), RangeError);
  await assert.rejects(extractPages(doc, [1.5]), RangeError);
});

async function runPlan(mode: SplitMode, input: string, doc: PDFDocument) {
  const plan = planOutputs(mode, input, doc.getPageCount(), 'source.pdf');
  assert.ok(plan.ok, plan.ok ? '' : plan.error);
  const outputs = [];
  for (const output of plan.outputs) {
    outputs.push({ filename: output.filename, indices: output.indices, doc: await reload(await extractPages(doc, output.indices)) });
  }
  return outputs;
}

test('every mode produces the expected files', async () => {
  const doc = await loadPdf(tenPages);

  const extract = await runPlan('extract', '1-3, 5, 8-', doc);
  assert.equal(extract.length, 1);
  assert.equal(extract[0]!.filename, 'source-pages-1-3_5_8-10.pdf');
  assert.deepEqual(sizes(extract[0]!.doc), expectedSizes([0, 1, 2, 4, 7, 8, 9]));

  const ranges = await runPlan('ranges', '3-1, 5, 8-', doc);
  assert.deepEqual(
    ranges.map((output) => output.filename),
    ['source-pages-3-1.pdf', 'source-page-5.pdf', 'source-pages-8-10.pdf'],
  );
  assert.deepEqual(sizes(ranges[0]!.doc), expectedSizes([2, 1, 0]));
  assert.deepEqual(sizes(ranges[1]!.doc), expectedSizes([4]));
  assert.deepEqual(sizes(ranges[2]!.doc), expectedSizes([7, 8, 9]));

  const every = await runPlan('every', '4', doc);
  assert.deepEqual(
    every.map((output) => output.filename),
    ['source-part-01.pdf', 'source-part-02.pdf', 'source-part-03.pdf'],
  );
  assert.deepEqual(
    every.map((output) => output.doc.getPageCount()),
    [4, 4, 2],
  );
  assert.deepEqual(sizes(every[2]!.doc), expectedSizes([8, 9]));

  const single = await runPlan('single', '', doc);
  assert.equal(single.length, 10);
  single.forEach((output, index) => {
    assert.equal(output.filename, `source-page-${String(index + 1).padStart(2, '0')}.pdf`);
    assert.deepEqual(sizes(output.doc), expectedSizes([index]));
  });
});

test('inherited page attributes and rotation are preserved', async () => {
  const bytes = await makePdf(3, (doc, pages) => {
    // Page 1 inherits its MediaBox and rotation from the page tree root.
    const root = doc.catalog.Pages();
    root.set(PDFName.of('MediaBox'), doc.context.obj([0, 0, 555, 777]));
    root.set(PDFName.of('Rotate'), PDFNumber.of(180));
    pages[0]!.node.delete(PDFName.of('MediaBox'));
    pages[2]!.setRotation(degrees(90));
  });
  const doc = await loadPdf(bytes);
  const out = await reload(await extractPages(doc, [0, 2]));
  assert.deepEqual(out.getPage(0).getSize(), { width: 555, height: 777 });
  assert.equal(out.getPage(0).getRotation().angle, 180);
  assert.equal(out.getPage(1).getRotation().angle, 90);
});

test('links, popups and form fields never drag other pages into the output', async () => {
  const bytes = await makePdf(10, (doc, pages) => {
    const context = doc.context;
    const first = pages[0]!;
    const last = pages[9]!;

    // A large content stream on the last page: it must not end up in page 1's file.
    last.node.addContentStream(context.register(context.stream(new Uint8Array(300_000).fill(0x20))));

    const internalLink = context.register(
      context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [0, 0, 10, 10], Dest: [last.ref, 'Fit'], P: first.ref }),
    );
    const goToAction = context.register(
      context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [0, 20, 10, 30],
        A: { S: 'GoTo', D: [last.ref, 'Fit'] },
      }),
    );
    const webLink = context.register(
      context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [20, 0, 30, 10],
        A: { S: 'URI', URI: context.obj('https://example.com/'), Next: { S: 'GoTo', D: [last.ref, 'Fit'] } },
      }),
    );
    const noteRef = context.nextRef();
    const popup = context.register(
      context.obj({ Type: 'Annot', Subtype: 'Popup', Rect: [40, 40, 90, 90], Parent: noteRef, P: first.ref }),
    );
    context.assign(
      noteRef,
      context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [40, 0, 50, 10], Contents: context.obj('Note'), P: first.ref, Popup: popup, IRT: internalLink }),
    );
    first.node.set(PDFName.of('Annots'), context.obj([internalLink, goToAction, webLink, noteRef, popup]));

    // One form field with widgets on the first and the last page.
    const form = doc.getForm();
    const field = form.createTextField('name');
    field.setText('Ada');
    field.addToPage(first, { x: 10, y: 50, width: 80, height: 20 });
    field.addToPage(last, { x: 10, y: 50, width: 80, height: 20 });
  });
  assert.ok(bytes.length > 300_000);

  const doc = await loadPdf(bytes);
  const outBytes = await extractPages(doc, [0]);
  const out = await reload(outBytes);

  assert.equal(out.getPageCount(), 1);
  assert.equal(pageObjectCount(out), 1, 'no orphan copies of other pages');
  assert.ok(outBytes.length < 20_000, `output is small (${outBytes.length} bytes)`);
  assert.equal(out.catalog.get(PDFName.of('AcroForm')), undefined, 'form structure is not copied');

  const annotations = annotationsOf(out, out.getPage(0));
  const subtypes = annotations.map((annot) => annot.get(PDFName.of('Subtype'))?.toString());
  assert.deepEqual(subtypes, ['/Link', '/Text', '/Widget']);

  const [link, note, widget] = annotations as [PDFDict, PDFDict, PDFDict];
  const action = link.lookup(PDFName.of('A'), PDFDict);
  assert.equal(action.get(PDFName.of('S')), PDFName.of('URI'));
  assert.equal(action.get(PDFName.of('Next')), undefined);
  for (const annot of annotations) {
    for (const key of ['P', 'Parent', 'Popup', 'IRT', 'Dest']) {
      assert.equal(annot.get(PDFName.of(key)), undefined, `${key} is removed`);
    }
  }
  assert.ok(note.get(PDFName.of('Contents')));
  assert.ok(widget.get(PDFName.of('AP')), 'the widget keeps its visible appearance');
});

test('the source keeps its annotations after a split', async () => {
  const bytes = await makePdf(2, (doc, pages) => {
    const link = doc.context.register(
      doc.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [0, 0, 1, 1], Dest: [pages[1]!.ref, 'Fit'] }),
    );
    pages[0]!.node.set(PDFName.of('Annots'), doc.context.obj([link]));
  });
  const doc = await loadPdf(bytes);
  await extractPages(doc, [0]);
  assert.equal(doc.getPage(0).node.Annots()?.size(), 1);
});

test('encrypted PDFs are reported as password-protected', async () => {
  const bytes = await makePdf(2, (doc) => {
    const encrypt = doc.context.obj({ Filter: 'Standard', V: 1, R: 2, P: -44, O: doc.context.obj('owner'), U: doc.context.obj('user') });
    doc.context.trailerInfo.Encrypt = doc.context.register(encrypt);
  });
  await assert.rejects(loadPdf(bytes), (error: unknown) => {
    assert.ok(error instanceof PdfPasswordError);
    assert.equal(error.name, 'PdfPasswordError');
    assert.equal(error.message, PASSWORD_PROTECTED_MESSAGE);
    return true;
  });
  await assert.rejects(loadPdfInfo(bytes), PdfPasswordError);
});

/**
 * Linearized layout with cross-reference streams: the first-page section at the start of the
 * file carries /Root, /Info and /ID (and /Encrypt), the main section at the end only /Size.
 */
function linearizedXrefStreamPdf(encrypted: boolean): Uint8Array {
  const entries = '\x01\x00\x00\x00\x10\x00'.repeat(9);
  const xref = (extra: string) =>
    `<< /Type /XRef /Size 9 /W [1 4 1] ${extra}/Length ${entries.length} >>\nstream\n${entries}\nendstream`;
  const objects: Array<[number, string]> = [
    [7, '<< /Linearized 1 /L 1000 /N 1 >>'],
    [8, xref(`/Root 1 0 R /Info 4 0 R /ID [<0102AB> <0102AB>] ${encrypted ? '/Encrypt 5 0 R ' : ''}/Prev 900 `)],
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    [3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>'],
    [4, '<< /Title (Scanned letter) >>'],
    ...(encrypted ? [[5, '<< /Filter /Standard /V 2 /R 3 /Length 128 /O <00> /U <00> /P -4 >>'] as [number, string]] : []),
    [6, xref('')],
  ];
  let text = '%PDF-1.5\n';
  let lastOffset = 0;
  for (const [number, body] of objects) {
    lastOffset = text.length;
    text += `${number} 0 obj\n${body}\nendobj\n`;
  }
  text += `startxref\n${lastOffset}\n%%EOF\n`;
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

test('an encrypted file is detected when its last cross-reference stream omits /Encrypt', async () => {
  const info = await loadPdfInfo(linearizedXrefStreamPdf(false));
  assert.deepEqual(info, { pageCount: 1, title: 'Scanned letter' });
  await assert.rejects(loadPdf(linearizedXrefStreamPdf(true)), PdfPasswordError);
});

test('toLoadError maps pdf-lib failures', () => {
  assert.ok(toLoadError(new EncryptedPDFError()) instanceof PdfPasswordError);
  // Encrypted object streams can make parsing fail before pdf-lib's own check.
  const encryptedBytes = new TextEncoder().encode('%PDF-1.7\n1 0 obj << /Encrypt 2 0 R >> endobj');
  assert.ok(toLoadError(new Error('invalid stored block lengths'), encryptedBytes) instanceof PdfPasswordError);
  const damaged = toLoadError(new Error('Failed to parse PDF document'), new TextEncoder().encode('%PDF-1.7'));
  assert.ok(damaged instanceof PdfInvalidError);
  assert.equal(damaged.message, DAMAGED_PDF_MESSAGE);
  const oom = new RangeError('Array buffer allocation failed');
  assert.equal(toLoadError(oom), oom);
  assert.ok(toLoadError(new RangeError('Maximum call stack size exceeded')) instanceof PdfInvalidError);
});

test('mentionsEncryption finds the /Encrypt key', () => {
  const encoder = new TextEncoder();
  assert.equal(mentionsEncryption(encoder.encode('trailer << /Root 1 0 R /Encrypt 5 0 R >>')), true);
  assert.equal(mentionsEncryption(encoder.encode('trailer << /Root 1 0 R /Encryp')), false);
  assert.equal(mentionsEncryption(encoder.encode('/Encrypt')), true);
  assert.equal(mentionsEncryption(new Uint8Array(0)), false);
});

test('files that are not PDFs or are damaged are rejected clearly', async () => {
  const encoder = new TextEncoder();
  await assert.rejects(loadPdf(encoder.encode('<!doctype html><title>nope</title>')), (error: unknown) => {
    assert.ok(error instanceof PdfInvalidError);
    assert.equal(error.message, NOT_A_PDF_MESSAGE);
    return true;
  });
  await assert.rejects(loadPdf(encoder.encode('%PDF-1.7\nthis is not really a pdf\n%%EOF')), PdfInvalidError);
  await assert.rejects(loadPdf(new Uint8Array(0)), PdfInvalidError);
});

/** Pseudo-random bytes, so a fake image keeps its size in the file. */
function noise(length: number, seed: number): Uint8Array {
  const bytes = new Uint8Array(length);
  let state = (seed + 1) * 2654435761;
  for (let i = 0; i < length; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    bytes[i] = state & 0xff;
  }
  return bytes;
}

function resourceKeys(page: PDFPage, category: string): string[] {
  const dict = page.node.Resources()?.lookupMaybe(PDFName.of(category), PDFDict);
  return (dict?.keys() ?? []).map((key) => key.decodeText()).sort();
}

function imageCount(doc: PDFDocument): number {
  return doc.context
    .enumerateIndirectObjects()
    .filter(([, object]) => object instanceof PDFRawStream && object.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')).length;
}

test('pages that share one resource dictionary take only the resources they use', async () => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const images = [0, 1, 2, 3, 4].map((seed) =>
    context.register(
      context.stream(noise(40_000, seed), { Type: 'XObject', Subtype: 'Image', Width: 200, Height: 200, BitsPerComponent: 8, ColorSpace: 'DeviceGray' }),
    ),
  );
  // A form without resources of its own paints with the page's.
  const form = context.register(context.flateStream('q /Im4 Do Q', { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 10, 10] }));
  const shared = context.register(
    context.obj({
      ProcSet: ['PDF', 'Text', 'ImageB'],
      Font: { F1: font.ref },
      XObject: { Im0: images[0]!, Im1: images[1]!, Im2: images[2]!, Im3: images[3]!, Im4: images[4]!, Fm0: form },
      ExtGState: { GS0: { CA: 0.5 }, GS1: { ca: 0.5 } },
    }),
  );
  const contents = [
    'q 10 0 0 10 0 0 cm /Im#30 Do Q BT /F1 12 Tf 10 10 Td (Hello) Tj ET', // an escaped name
    '/Im1 Do /Fm0 Do',
    '/GS0 gs /Im2 Do',
    null, // content that can't be decoded here
    '/Im4 Do',
  ];
  for (const content of contents) {
    const page = doc.addPage([100, 100]);
    page.node.set(PDFName.of('Resources'), shared);
    const stream = content === null ? context.stream('garbage', { Filter: 'JBIG2Decode' }) : context.flateStream(content);
    page.node.set(PDFName.of('Contents'), context.register(stream));
  }
  // The last page inherits the shared resources from the page tree.
  doc.catalog.Pages().set(PDFName.of('Resources'), shared);
  doc.getPage(4).node.delete(PDFName.of('Resources'));

  const src = await loadPdf(await doc.save());
  const extract = async (indices: number[]) => {
    const outBytes = await extractPages(src, indices);
    return { outBytes, out: await reload(outBytes) };
  };

  const first = await extract([0]);
  assert.deepEqual(resourceKeys(first.out.getPage(0), 'XObject'), ['Im0']);
  assert.deepEqual(resourceKeys(first.out.getPage(0), 'Font'), ['F1']);
  assert.deepEqual(resourceKeys(first.out.getPage(0), 'ExtGState'), []);
  assert.ok(first.out.getPage(0).node.Resources()?.get(PDFName.of('ProcSet')), 'other entries are kept');
  assert.equal(imageCount(first.out), 1);
  assert.ok(first.outBytes.length < 60_000, `output is small (${first.outBytes.length} bytes)`);

  assert.deepEqual(resourceKeys((await extract([1])).out.getPage(0), 'XObject'), ['Fm0', 'Im1', 'Im4']);
  const third = (await extract([2])).out.getPage(0);
  assert.deepEqual(resourceKeys(third, 'XObject'), ['Im2']);
  assert.deepEqual(resourceKeys(third, 'ExtGState'), ['GS0']);
  assert.deepEqual(resourceKeys((await extract([3])).out.getPage(0), 'XObject'), ['Fm0', 'Im0', 'Im1', 'Im2', 'Im3', 'Im4']);
  assert.deepEqual(resourceKeys((await extract([4])).out.getPage(0), 'XObject'), ['Im4']);

  const several = await extract([0, 1, 2, 0]);
  assert.equal(imageCount(several.out), 4, 'each image in use is copied once');
  assert.equal(resourceKeys(src.getPage(0), 'XObject').length, 6, 'the source is not modified');
});

test('a signature value never pulls the signed document into the output', async () => {
  const bytes = await makePdf(10, (doc, pages) => {
    const context = doc.context;
    pages[9]!.node.addContentStream(context.register(context.stream(new Uint8Array(300_000).fill(0x20))));
    // A certification signature as iText writes it: /Reference → /Data → the catalog.
    const signature = context.register(
      context.obj({
        Type: 'Sig',
        Filter: 'Adobe.PPKLite',
        SubFilter: 'adbe.pkcs7.detached',
        ByteRange: [0, 0, 0, 0],
        Contents: PDFHexString.of('00'.repeat(64)),
        Reference: [{ Type: 'SigRef', TransformMethod: 'DocMDP', TransformParams: { Type: 'TransformParams', P: 2 }, Data: context.trailerInfo.Root }],
      }),
    );
    const widget = context.register(
      context.obj({
        Type: 'Annot',
        Subtype: 'Widget',
        FT: 'Sig',
        T: PDFString.of('Signature1'),
        V: signature,
        Lock: { Type: 'SigFieldLock', Action: 'All' },
        F: 132,
        Rect: [0, 0, 0, 0],
        P: pages[0]!.ref,
      }),
    );
    pages[0]!.node.set(PDFName.of('Annots'), context.obj([widget]));
    doc.catalog.set(PDFName.of('AcroForm'), context.obj({ Fields: [widget], SigFlags: 3 }));
  });

  const outBytes = await extractPages(await loadPdf(bytes), [0]);
  const out = await reload(outBytes);
  assert.equal(pageObjectCount(out), 1, 'no hidden copies of the document');
  assert.ok(outBytes.length < 20_000, `output is small (${outBytes.length} bytes)`);
  const [widget] = annotationsOf(out, out.getPage(0));
  assert.ok(widget);
  assert.equal(widget.get(PDFName.of('V')), undefined);
  assert.equal(widget.get(PDFName.of('Lock')), undefined);
});

test('other paths back to the document structure become null instead of hidden pages', async () => {
  const bytes = await makePdf(10, (doc, pages) => {
    const context = doc.context;
    pages[9]!.node.addContentStream(context.register(context.stream(new Uint8Array(300_000).fill(0x20))));
    pages[0]!.node.set(PDFName.of('SeparationInfo'), context.obj({ Pages: [pages[0]!.ref, pages[9]!.ref], DeviceColorant: 'Cyan' }));
    pages[0]!.node.set(PDFName.of('PieceInfo'), context.obj({ Producer: { Private: context.trailerInfo.Root } }));
  });

  const outBytes = await extractPages(await loadPdf(bytes), [0]);
  const out = await reload(outBytes);
  assert.equal(out.getPageCount(), 1);
  assert.equal(pageObjectCount(out), 1, 'no hidden copies of other pages');
  assert.ok(outBytes.length < 20_000, `output is small (${outBytes.length} bytes)`);
  const separation = out.getPage(0).node.lookup(PDFName.of('SeparationInfo'), PDFDict).lookup(PDFName.of('Pages'), PDFArray);
  assert.equal(separation.lookup(1), PDFNull);
});

test('layers keep their default visibility', async () => {
  const bytes = await makePdf(2, (doc, pages) => {
    const context = doc.context;
    const layer = context.register(context.obj({ Type: 'OCG', Name: PDFString.of('Watermark') }));
    doc.catalog.set(PDFName.of('OCProperties'), context.obj({ OCGs: [layer], D: { OFF: [layer], Order: [layer] } }));
    pages[0]!.node.Resources()!.set(PDFName.of('Properties'), context.obj({ oc1: layer }));
    pages[0]!.node.addContentStream(context.register(context.stream('/OC /oc1 BDC 0 0 10 10 re f EMC')));
  });

  const out = await reload(await extractPages(await loadPdf(bytes), [0]));
  const pageLayer = out.getPage(0).node.Resources()!.lookup(PDFName.of('Properties'), PDFDict).get(PDFName.of('oc1'));
  assert.ok(pageLayer instanceof PDFRef);
  const properties = out.catalog.lookup(PDFName.of('OCProperties'), PDFDict);
  const hidden = properties.lookup(PDFName.of('D'), PDFDict).lookup(PDFName.of('OFF'), PDFArray);
  assert.equal(hidden.get(0), pageLayer, 'the same layer is still off by default');
  assert.equal(out.context.lookup(pageLayer, PDFDict).get(PDFName.of('Type')), PDFName.of('OCG'));
});

test('forms that rely on the viewer to draw their values keep standalone fields', async () => {
  const bytes = await makePdf(3, (doc, pages) => {
    const context = doc.context;
    pages[2]!.node.addContentStream(context.register(context.stream(new Uint8Array(300_000).fill(0x20))));
    const helvetica = context.register(context.obj({ Type: 'Font', Subtype: 'Type1', BaseFont: 'Helvetica' }));
    // A field that is its own widget, without an appearance stream.
    const city = context.register(
      context.obj({ Type: 'Annot', Subtype: 'Widget', FT: 'Tx', T: PDFString.of('city'), V: PDFString.of('Paris'), Rect: [10, 10, 90, 30], P: pages[0]!.ref }),
    );
    // person.name has widgets on pages 1 and 3, which inherit its type, value and appearance string.
    const personRef = context.nextRef();
    const nameRef = context.nextRef();
    const widgetOn = (page: PDFPage) =>
      context.register(context.obj({ Type: 'Annot', Subtype: 'Widget', Parent: nameRef, Rect: [10, 40, 90, 60], P: page.ref }));
    const first = widgetOn(pages[0]!);
    const last = widgetOn(pages[2]!);
    context.assign(
      nameRef,
      context.obj({ T: PDFString.of('name'), FT: 'Tx', V: PDFHexString.fromText('Ada Lovelace'), Parent: personRef, Kids: [first, last] }),
    );
    context.assign(personRef, context.obj({ T: PDFString.of('person'), DA: PDFString.of('/Helv 12 Tf 0 g'), Kids: [nameRef] }));
    pages[0]!.node.set(PDFName.of('Annots'), context.obj([city, first]));
    pages[2]!.node.set(PDFName.of('Annots'), context.obj([last]));
    doc.catalog.set(
      PDFName.of('AcroForm'),
      context.obj({ Fields: [city, personRef], NeedAppearances: true, DA: PDFString.of('/Helv 0 Tf 0 g'), DR: { Font: { Helv: helvetica } } }),
    );
  });

  const outBytes = await extractPages(await loadPdf(bytes), [0]);
  const out = await reload(outBytes);
  assert.equal(pageObjectCount(out), 1, 'no hidden copies of other pages');
  assert.ok(outBytes.length < 20_000, `output is small (${outBytes.length} bytes)`);

  const acroForm = out.catalog.lookup(PDFName.of('AcroForm'), PDFDict);
  assert.equal(acroForm.lookup(PDFName.of('NeedAppearances')), PDFBool.True);
  assert.ok(acroForm.lookup(PDFName.of('DR'), PDFDict).lookup(PDFName.of('Font'), PDFDict).get(PDFName.of('Helv')));
  const [cityWidget, nameWidget] = annotationsOf(out, out.getPage(0)) as [PDFDict, PDFDict];
  const fieldRefs = acroForm.lookup(PDFName.of('Fields'), PDFArray).asArray();
  assert.deepEqual(
    fieldRefs.map((ref) => out.context.lookup(ref)),
    [cityWidget, nameWidget],
  );
  assert.equal(nameWidget.get(PDFName.of('Parent')), undefined);
  assert.equal(nameWidget.lookup(PDFName.of('DA'), PDFString).decodeText(), '/Helv 12 Tf 0 g');

  const form = out.getForm();
  assert.deepEqual(
    form.getFields().map((field) => field.getName()),
    ['city', 'person.name'],
  );
  assert.equal(form.getTextField('city').getText(), 'Paris');
  assert.equal(form.getTextField('person.name').getText(), 'Ada Lovelace');
});
