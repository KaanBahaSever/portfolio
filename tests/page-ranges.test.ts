import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_OUTPUT_NAMES,
  MAX_TOTAL_PAGES,
  chunkPages,
  describeRange,
  describeRanges,
  expandRanges,
  formatPageRanges,
  formatPageSelection,
  formatPageSequence,
  hasPdfSignature,
  outputBaseName,
  pageUsage,
  pagesToRanges,
  parsePageRanges,
  planOutputs,
  reconcileRanges,
  reconcileSequence,
  sequenceToRanges,
  summarizePlan,
  zipFilename,
} from '../src/lib/pdf/page-ranges.ts';
import type { OutputNames, PageRange, PageRangeError, PlannedOutput } from '../src/lib/pdf/page-ranges.ts';

function ranges(input: string, pageCount = 10): PageRange[] {
  const result = parsePageRanges(input, pageCount);
  assert.ok(result.ok, `expected "${input}" to parse, got: ${result.ok ? '' : JSON.stringify(result.error)}`);
  return result.ranges;
}

function error(input: string, pageCount = 10): PageRangeError {
  const result = parsePageRanges(input, pageCount);
  assert.ok(!result.ok, `expected "${input}" to be rejected`);
  return result.error;
}

function plan(...args: Parameters<typeof planOutputs>): PlannedOutput[] {
  const result = planOutputs(...args);
  assert.ok(result.ok, `expected a plan, got: ${result.ok ? '' : JSON.stringify(result.error)}`);
  return result.outputs;
}

/** 1-based pages of a parsed input, in order (what the grid and the split see). */
function pagesOf(input: string, pageCount = 10): number[] {
  return expandRanges(ranges(input, pageCount)).map((index) => index + 1);
}

// ------------------------------------------------------------------ parsing

test('parsePageRanges: single pages and ranges', () => {
  assert.deepEqual(ranges('5'), [{ from: 5, to: 5 }]);
  assert.deepEqual(ranges('1-3'), [{ from: 1, to: 3 }]);
  assert.deepEqual(ranges('1-3, 5, 8-10'), [
    { from: 1, to: 3 },
    { from: 5, to: 5 },
    { from: 8, to: 10 },
  ]);
  assert.deepEqual(ranges('1-10'), [{ from: 1, to: 10 }]);
  assert.deepEqual(ranges('007'), [{ from: 7, to: 7 }]);
});

test('parsePageRanges: open ends and keywords', () => {
  assert.deepEqual(ranges('8-'), [{ from: 8, to: 10 }]);
  assert.deepEqual(ranges('-4'), [{ from: 1, to: 4 }]);
  assert.deepEqual(ranges('10-'), [{ from: 10, to: 10 }]);
  assert.deepEqual(ranges('end'), [{ from: 10, to: 10 }]);
  assert.deepEqual(ranges('LAST'), [{ from: 10, to: 10 }]);
  assert.deepEqual(ranges('3-end'), [{ from: 3, to: 10 }]);
  assert.deepEqual(ranges('-end'), [{ from: 1, to: 10 }]);
  assert.deepEqual(ranges('end-1'), [{ from: 10, to: 1 }]);
  assert.deepEqual(ranges('1-3, 8-'), [
    { from: 1, to: 3 },
    { from: 8, to: 10 },
  ]);
  assert.deepEqual(ranges('2-,5'), [
    { from: 2, to: 10 },
    { from: 5, to: 5 },
  ]);
});

test('parsePageRanges: the Turkish keyword "son" means the last page', () => {
  assert.deepEqual(ranges('son'), [{ from: 10, to: 10 }]);
  assert.deepEqual(ranges('SON'), [{ from: 10, to: 10 }]);
  assert.deepEqual(ranges('9-son'), [{ from: 9, to: 10 }]);
  assert.deepEqual(ranges('son-8, 1'), [
    { from: 10, to: 8 },
    { from: 1, to: 1 },
  ]);
  // Only whole words count.
  assert.deepEqual(error('sonra'), { code: 'unexpected', text: 'sonra', position: 1 });
});

test('parsePageRanges: dashes, separators and whitespace', () => {
  assert.deepEqual(ranges('1–3'), [{ from: 1, to: 3 }]); // en dash
  assert.deepEqual(ranges('1—3'), [{ from: 1, to: 3 }]); // em dash
  assert.deepEqual(ranges('1−3'), [{ from: 1, to: 3 }]); // minus sign
  assert.deepEqual(ranges(' 1 - 3 ; 5 '), [
    { from: 1, to: 3 },
    { from: 5, to: 5 },
  ]);
  assert.deepEqual(ranges('1 3 5'), [
    { from: 1, to: 1 },
    { from: 3, to: 3 },
    { from: 5, to: 5 },
  ]);
  assert.deepEqual(ranges('1,,2,'), [
    { from: 1, to: 1 },
    { from: 2, to: 2 },
  ]);
  assert.deepEqual(ranges('\t1\n- 2\n'), [{ from: 1, to: 2 }]);
});

test('parsePageRanges: descending ranges and repeats are kept', () => {
  assert.deepEqual(ranges('5-1'), [{ from: 5, to: 1 }]);
  assert.deepEqual(ranges('2, 2, 1-2'), [
    { from: 2, to: 2 },
    { from: 2, to: 2 },
    { from: 1, to: 2 },
  ]);
});

test('parsePageRanges: errors are codes with parameters', () => {
  assert.deepEqual(error(''), { code: 'empty' });
  assert.deepEqual(error('   '), { code: 'empty' });
  assert.deepEqual(error(', ;'), { code: 'empty' });
  assert.deepEqual(error('12'), { code: 'page-out-of-range', page: '12', pageCount: 10 });
  assert.deepEqual(error('1-12'), { code: 'page-out-of-range', page: '12', pageCount: 10 });
  assert.deepEqual(error('2', 1), { code: 'page-out-of-range', page: '2', pageCount: 1 });
  assert.deepEqual(error('0'), { code: 'page-zero' });
  assert.deepEqual(error('0-3'), { code: 'page-zero' });
  assert.deepEqual(error('1-3,x'), { code: 'unexpected', text: 'x', position: 5 });
  assert.deepEqual(error('1-3, x'), { code: 'unexpected', text: 'x', position: 6 });
  assert.deepEqual(error('page 3'), { code: 'unexpected', text: 'page', position: 1 });
  assert.deepEqual(error('1.5'), { code: 'unexpected', text: '.', position: 2 });
  assert.deepEqual(error('1-3-5'), { code: 'unexpected', text: '-', position: 4 });
  assert.deepEqual(error('1--3'), { code: 'unexpected', text: '-', position: 3 });
  assert.deepEqual(error('-'), { code: 'missing-page', dash: '-', position: 1 });
  assert.deepEqual(error('3, –'), { code: 'missing-page', dash: '–', position: 4 });
  // Leading zeros are dropped and huge numbers are kept as text.
  assert.deepEqual(error('0012'), { code: 'page-out-of-range', page: '12', pageCount: 10 });
  assert.deepEqual(error('99999999999999999999'), {
    code: 'page-out-of-range',
    page: '99999999999999999999',
    pageCount: 10,
  });
  assert.deepEqual(error('1', 0), { code: 'no-pages' });
});

test('parsePageRanges: positions count characters, not UTF-16 units', () => {
  assert.deepEqual(error('😀x'), { code: 'unexpected', text: '😀', position: 1 });
  assert.deepEqual(error('1,😀'), { code: 'unexpected', text: '😀', position: 3 });
});

// ------------------------------------------------------------------ ranges

test('expandRanges: 0-based indices in order, duplicates kept', () => {
  assert.deepEqual(expandRanges([{ from: 1, to: 3 }]), [0, 1, 2]);
  assert.deepEqual(expandRanges([{ from: 3, to: 1 }]), [2, 1, 0]);
  assert.deepEqual(
    expandRanges([
      { from: 5, to: 5 },
      { from: 1, to: 2 },
      { from: 5, to: 5 },
    ]),
    [4, 0, 1, 4],
  );
  assert.deepEqual(expandRanges([]), []);
});

test('chunkPages splits into consecutive parts', () => {
  assert.deepEqual(chunkPages(10, 4), [
    { from: 1, to: 4 },
    { from: 5, to: 8 },
    { from: 9, to: 10 },
  ]);
  assert.deepEqual(chunkPages(10, 5), [
    { from: 1, to: 5 },
    { from: 6, to: 10 },
  ]);
  assert.deepEqual(chunkPages(3, 1), [
    { from: 1, to: 1 },
    { from: 2, to: 2 },
    { from: 3, to: 3 },
  ]);
  assert.deepEqual(chunkPages(3, 50), [{ from: 1, to: 3 }]);
  assert.deepEqual(chunkPages(0, 2), []);
  assert.deepEqual(chunkPages(5, 2.9), chunkPages(5, 2));
  assert.throws(() => chunkPages(10, 0), RangeError);
  assert.throws(() => chunkPages(10, Number.NaN), RangeError);
});

test('describeRange and describeRanges', () => {
  assert.equal(describeRange({ from: 1, to: 3 }), '1–3');
  assert.equal(describeRange({ from: 5, to: 5 }), '5');
  assert.equal(describeRange({ from: 9, to: 2 }), '9–2');
  assert.equal(
    describeRanges([
      { from: 1, to: 3 },
      { from: 5, to: 5 },
      { from: 8, to: 10 },
    ]),
    '1–3, 5, 8–10',
  );
  assert.equal(describeRanges([]), '');
});

// ------------------------------------------------------------------ selections

test('pagesToRanges: ascending runs, duplicates and order ignored', () => {
  assert.deepEqual(pagesToRanges([5, 1, 2, 3, 2]), [
    { from: 1, to: 3 },
    { from: 5, to: 5 },
  ]);
  assert.deepEqual(pagesToRanges(new Set([10, 9, 8])), [{ from: 8, to: 10 }]);
  assert.deepEqual(pagesToRanges([]), []);
});

test('formatPageSelection writes the canonical compact form', () => {
  assert.equal(formatPageSelection([1, 2, 3, 5, 7, 8]), '1-3, 5, 7-8');
  assert.equal(formatPageSelection(new Set([4])), '4');
  assert.equal(formatPageSelection([8, 7, 3, 2, 1, 5]), '1-3, 5, 7-8');
  assert.equal(formatPageSelection(Array.from({ length: 12 }, (_, i) => i + 1)), '1-12');
  assert.equal(formatPageSelection([]), '');
});

test('sequenceToRanges and formatPageSequence keep order and repeats', () => {
  assert.deepEqual(sequenceToRanges([3, 1, 2]), [
    { from: 3, to: 3 },
    { from: 1, to: 2 },
  ]);
  assert.equal(formatPageSequence([10, 9, 8, 1, 1]), '10-8, 1, 1');
  assert.equal(formatPageSequence([1, 2, 3, 2, 1]), '1-3, 2-1');
  assert.equal(formatPageSequence([1, 2, 3, 5]), '1-3, 5');
  assert.equal(formatPageSequence([]), '');
  assert.equal(formatPageRanges([{ from: 9, to: 2 }]), '9-2');
});

test('formatted text parses back to exactly the same pages', () => {
  // A small deterministic generator, so failures are reproducible.
  let seed = 7;
  const random = (max: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return 1 + (seed % max);
  };
  for (let trial = 0; trial < 500; trial++) {
    const pageCount = random(40);
    const sequence = Array.from({ length: random(25) }, () => random(pageCount));
    assert.deepEqual(pagesOf(formatPageSequence(sequence), pageCount), sequence);
    const set = new Set(sequence);
    assert.deepEqual(
      pagesOf(formatPageSelection(set), pageCount),
      [...set].sort((a, b) => a - b),
    );
  }
});

test('reconcileSequence keeps ascending selections canonical', () => {
  assert.deepEqual(reconcileSequence([1, 2, 3], new Set([1, 2, 3, 5])), [1, 2, 3, 5]);
  assert.deepEqual(reconcileSequence([1, 2, 3, 5], new Set([1, 2, 3, 4, 5])), [1, 2, 3, 4, 5]);
  assert.deepEqual(reconcileSequence([2, 5], new Set([1, 2, 5, 9])), [1, 2, 5, 9]);
  assert.deepEqual(reconcileSequence([1, 2, 3], new Set([1, 3])), [1, 3]);
  assert.deepEqual(reconcileSequence([], new Set([4, 2])), [2, 4]);
  assert.deepEqual(reconcileSequence([1, 2], new Set()), []);
});

test('reconcileSequence keeps a typed order and adds new pages at the end', () => {
  assert.deepEqual(reconcileSequence([3, 1, 2], new Set([1, 2, 3, 5])), [3, 1, 2, 5]);
  assert.deepEqual(reconcileSequence([3, 1, 2], new Set([1, 2])), [1, 2]);
  assert.deepEqual(reconcileSequence([10, 9, 8], new Set([8, 9, 10, 1, 2])), [10, 9, 8, 1, 2]);
  // Repeats of a page that stays selected are kept; deselecting removes every copy.
  assert.deepEqual(reconcileSequence([2, 2, 5], new Set([2, 5, 7])), [2, 2, 5, 7]);
  assert.deepEqual(reconcileSequence([2, 2, 5], new Set([5])), [5]);
});

test('reconcileRanges keeps each typed range as its own file', () => {
  const r = (input: string) => (input === '' ? [] : ranges(input, 12));
  const f = (input: string, pages: number[]) => formatPageRanges(reconcileRanges(r(input), new Set(pages)));
  // Clicking a new page far away adds a file, in page order.
  assert.equal(f('1-2, 3-4', [1, 2, 3, 4, 7]), '1-2, 3-4, 7');
  assert.equal(f('5-6, 9', [1, 5, 6, 9]), '1, 5-6, 9');
  // A page next to a range joins it (consecutive pages form one file).
  assert.equal(f('1-3', [1, 2, 3, 4]), '1-4');
  assert.equal(f('5-8', [4, 5, 6, 7, 8]), '4-8');
  assert.equal(f('1-2, 4-5', [1, 2, 3, 4, 5]), '1-3, 4-5');
  // Deselecting splits a range where the gap opens.
  assert.equal(f('1-10', [1, 2, 3, 4, 6, 7, 8, 9, 10]), '1-4, 6-10');
  assert.equal(f('1-3, 7', [1, 2, 3]), '1-3');
  // Order and direction as typed survive; new pages then go at the end.
  assert.equal(f('9-7, 1-2', [1, 2, 7, 8, 9, 11]), '9-7, 1-2, 11');
  assert.equal(f('9-7', [9, 7]), '9, 7');
  // Select all, clear and invert.
  assert.equal(f('', Array.from({ length: 12 }, (_, i) => i + 1)), '1-12');
  assert.equal(f('1-3, 7', []), '');
  assert.equal(f('1-3, 7', [4, 5, 6, 8, 9, 10, 11, 12]), '4-6, 8-12');
});

test('pageUsage counts uses and finds each page’s first output', () => {
  const usage = pageUsage([[0, 1, 2], [4], [2, 9, 99, -1]], 10);
  assert.deepEqual(Array.from(usage.uses), [1, 1, 2, 0, 1, 0, 0, 0, 0, 1]);
  assert.deepEqual(Array.from(usage.firstOutput), [1, 1, 1, 0, 2, 0, 0, 0, 0, 3]);
  assert.equal(pageUsage([], 0).uses.length, 0);
});

// ------------------------------------------------------------------ files and plans

test('hasPdfSignature looks for %PDF- in the first 1024 bytes', () => {
  const encoder = new TextEncoder();
  assert.equal(hasPdfSignature(encoder.encode('%PDF-1.7\n')), true);
  assert.equal(hasPdfSignature(encoder.encode('junk before %PDF-1.4')), true);
  assert.equal(hasPdfSignature(encoder.encode('%PDF')), false);
  assert.equal(hasPdfSignature(encoder.encode('<!doctype html>')), false);
  assert.equal(hasPdfSignature(new Uint8Array(0)), false);
  const late = new Uint8Array(2048);
  late.set(encoder.encode('%PDF-1.7'), 1500);
  assert.equal(hasPdfSignature(late), false);
});

test('outputBaseName and zipFilename', () => {
  assert.equal(outputBaseName('report'), 'report');
  assert.equal(outputBaseName('Report 2026.PDF'), 'Report 2026');
  assert.equal(outputBaseName('  a/b:c  '), 'abc');
  assert.equal(outputBaseName(''), 'document');
  assert.equal(outputBaseName('.pdf'), 'document');
  assert.equal(outputBaseName('', 'belge'), 'belge');
  assert.equal(Array.from(outputBaseName('x'.repeat(200))).length, 60);
  assert.equal(zipFilename('report.pdf'), 'report-split.zip');
  assert.equal(zipFilename(''), 'document-split.zip');
});

test('planOutputs: extract makes one file in the given order', () => {
  const outputs = plan('extract', '8-, 1-2, 5', 10, 'report.pdf');
  assert.equal(outputs.length, 1);
  assert.deepEqual(outputs[0]!.indices, [7, 8, 9, 0, 1, 4]);
  assert.equal(outputs[0]!.filename, 'report-pages-8-10_1-2_5.pdf');

  assert.equal(plan('extract', '1-3', 10, 'report')[0]!.filename, 'report-pages-1-3.pdf');
  assert.equal(plan('extract', '5', 10, 'report')[0]!.filename, 'report-page-5.pdf');
  assert.equal(plan('extract', '3-1', 10, 'report')[0]!.filename, 'report-pages-3-1.pdf');
  const many = plan('extract', '1,3,5,7,9,2,4,6,8,10,1,3,5,7,9', 10, 'report');
  assert.equal(many[0]!.filename, 'report-selected-pages.pdf');
  assert.equal(many[0]!.indices.length, 15);
});

test('planOutputs: ranges makes one file per range with unique names', () => {
  const outputs = plan('ranges', '1-3, 5, 8-, 5', 10, 'report');
  assert.deepEqual(
    outputs.map((output) => output.filename),
    ['report-pages-1-3.pdf', 'report-page-5.pdf', 'report-pages-8-10.pdf', 'report-page-5 (2).pdf'],
  );
  assert.deepEqual(
    outputs.map((output) => output.indices),
    [[0, 1, 2], [4], [7, 8, 9], [4]],
  );
});

test('planOutputs: every N pages', () => {
  const outputs = plan('every', '4', 10, 'Scan');
  assert.deepEqual(
    outputs.map((output) => output.filename),
    ['Scan-part-01.pdf', 'Scan-part-02.pdf', 'Scan-part-03.pdf'],
  );
  assert.deepEqual(outputs[2]!.indices, [8, 9]);
  assert.equal(plan('every', 25, 10, 'Scan').length, 1);
  assert.equal(plan('every', ' 1 ', 120, 'Scan')[119]!.filename, 'Scan-part-120.pdf');
  assert.equal(plan('every', '1', 120, 'Scan')[0]!.filename, 'Scan-part-001.pdf');

  for (const bad of ['', '0', '-2', '1.5', 'two']) {
    const result = planOutputs('every', bad, 10, 'Scan');
    assert.ok(!result.ok);
    assert.deepEqual(result.error, { code: 'invalid-every' });
  }
});

test('planOutputs: one file per page, zero-padded for sorting', () => {
  const outputs = plan('single', '', 12, 'deck');
  assert.equal(outputs.length, 12);
  assert.equal(outputs[0]!.filename, 'deck-page-01.pdf');
  assert.equal(outputs[11]!.filename, 'deck-page-12.pdf');
  assert.deepEqual(outputs[11]!.indices, [11]);
  assert.equal(plan('single', '', 3, 'deck')[2]!.filename, 'deck-page-03.pdf');
});

test('planOutputs: file names in another language', () => {
  const tr: OutputNames = {
    fallbackBase: 'belge',
    page: 'sayfa',
    pages: 'sayfa',
    selected: 'seçili-sayfalar',
    part: 'parça',
    zip: 'bölünmüş',
  };
  assert.equal(plan('extract', '1-3', 10, 'rapor', tr)[0]!.filename, 'rapor-sayfa-1-3.pdf');
  assert.equal(plan('extract', '5', 10, '', tr)[0]!.filename, 'belge-sayfa-5.pdf');
  assert.equal(plan('extract', '1,3,5,7,9,2,4,6,8,10,1,3,5,7,9', 10, 'rapor', tr)[0]!.filename, 'rapor-seçili-sayfalar.pdf');
  assert.equal(plan('every', '5', 10, 'rapor', tr)[1]!.filename, 'rapor-parça-02.pdf');
  assert.equal(plan('single', '', 10, 'rapor', tr)[9]!.filename, 'rapor-sayfa-10.pdf');
  assert.equal(zipFilename('rapor.pdf', tr), 'rapor-bölünmüş.zip');
  assert.equal(zipFilename('', tr), 'belge-bölünmüş.zip');
  assert.equal(zipFilename('x', DEFAULT_OUTPUT_NAMES), 'x-split.zip');
});

test('planOutputs: errors and limits', () => {
  const bad = planOutputs('ranges', '1-3, 42', 10, 'report');
  assert.ok(!bad.ok);
  assert.deepEqual(bad.error, { code: 'page-out-of-range', page: '42', pageCount: 10 });

  const empty = planOutputs('extract', '', 10, 'report');
  assert.ok(!empty.ok);
  assert.deepEqual(empty.error, { code: 'empty' });

  const noPages = planOutputs('single', '', 0, 'report');
  assert.ok(!noPages.ok);
  assert.deepEqual(noPages.error, { code: 'no-pages' });

  const unknown = planOutputs('shuffle' as never, '', 10, 'report');
  assert.ok(!unknown.ok);
  assert.deepEqual(unknown.error, { code: 'invalid-mode' });

  const huge = planOutputs('extract', Array(5).fill('1-end').join(','), 5000, 'report');
  assert.ok(!huge.ok);
  assert.deepEqual(huge.error, { code: 'too-many-pages', total: 25_000, limit: MAX_TOTAL_PAGES });
});

test('planOutputs: unsafe or long base names are cleaned up', () => {
  assert.equal(plan('extract', '1', 10, 'a/b\\c.pdf')[0]!.filename, 'abc-page-1.pdf');
  assert.equal(plan('extract', '1', 10, '   ')[0]!.filename, 'document-page-1.pdf');
  const long = plan('ranges', '1-2, 3-4', 10, 'x'.repeat(300));
  assert.equal(long[0]!.filename, `${'x'.repeat(60)}-pages-1-2.pdf`);
  assert.notEqual(long[0]!.filename, long[1]!.filename);
});

test('summarizePlan returns structured data for the preview', () => {
  assert.deepEqual(summarizePlan(plan('every', '4', 10, 'r')), {
    files: 3,
    pages: 10,
    items: ['1–4', '5–8', '9–10'],
    more: 0,
  });
  assert.deepEqual(summarizePlan(plan('extract', '1-3, 5, 8-', 10, 'r')), {
    files: 1,
    pages: 7,
    items: ['1–3', '5', '8–10'],
    more: 0,
  });
  assert.deepEqual(summarizePlan(plan('extract', '5', 10, 'r')), { files: 1, pages: 1, items: ['5'], more: 0 });
  assert.deepEqual(summarizePlan(plan('single', '', 10, 'r')), {
    files: 10,
    pages: 10,
    items: ['1', '2', '3', '4', '5', '6'],
    more: 4,
  });
  assert.deepEqual(summarizePlan(plan('single', '', 10, 'r'), 3)?.more, 7);
  assert.deepEqual(summarizePlan(plan('extract', '1,3,5,7,9,2,4,6', 10, 'r'), 3), {
    files: 1,
    pages: 8,
    items: ['1', '3', '5'],
    more: 5,
  });
  assert.equal(summarizePlan([]), null);
});
