import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TOTAL_PAGES,
  chunkPages,
  describeRange,
  describeRanges,
  expandRanges,
  hasPdfSignature,
  outputBaseName,
  parsePageRanges,
  planOutputs,
  summarizePlan,
  zipFilename,
} from '../src/lib/pdf/page-ranges.ts';
import type { PageRange, PlannedOutput } from '../src/lib/pdf/page-ranges.ts';

function ranges(input: string, pageCount = 10): PageRange[] {
  const result = parsePageRanges(input, pageCount);
  assert.ok(result.ok, `expected "${input}" to parse, got: ${result.ok ? '' : result.error}`);
  return result.ranges;
}

function error(input: string, pageCount = 10): string {
  const result = parsePageRanges(input, pageCount);
  assert.ok(!result.ok, `expected "${input}" to be rejected`);
  return result.error;
}

function plan(...args: Parameters<typeof planOutputs>): PlannedOutput[] {
  const result = planOutputs(...args);
  assert.ok(result.ok, `expected a plan, got: ${result.ok ? '' : result.error}`);
  return result.outputs;
}

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
  assert.deepEqual(ranges('\t1\n- 2\n'), [{ from: 1, to: 2 }]);
});

test('parsePageRanges: descending ranges and repeats are kept', () => {
  assert.deepEqual(ranges('5-1'), [{ from: 5, to: 1 }]);
  assert.deepEqual(ranges('2, 2, 1-2'), [
    { from: 2, to: 2 },
    { from: 2, to: 2 },
    { from: 1, to: 2 },
  ]);
});

test('parsePageRanges: human-readable errors', () => {
  assert.equal(error(''), 'Enter at least one page');
  assert.equal(error('   '), 'Enter at least one page');
  assert.equal(error(', ;'), 'Enter at least one page');
  assert.equal(error('12'), "Page 12 doesn't exist — this PDF has 10 pages");
  assert.equal(error('1-12'), "Page 12 doesn't exist — this PDF has 10 pages");
  assert.equal(error('2', 1), "Page 2 doesn't exist — this PDF has 1 page");
  assert.equal(error('0'), 'Page numbers start at 1');
  assert.equal(error('0-3'), 'Page numbers start at 1');
  assert.equal(error('1-3,x'), 'Unexpected "x" near position 5');
  assert.equal(error('1-3, x'), 'Unexpected "x" near position 6');
  assert.equal(error('page 3'), 'Unexpected "page" near position 1');
  assert.equal(error('1.5'), 'Unexpected "." near position 2');
  assert.equal(error('1-3-5'), 'Unexpected "-" near position 4');
  assert.equal(error('1--3'), 'Unexpected "-" near position 3');
  assert.equal(error('-'), 'Add a page number before or after "-" near position 1');
  assert.equal(error('3, -'), 'Add a page number before or after "-" near position 4');
  assert.equal(error('99999999999999999999'), "Page 99999999999999999999 doesn't exist — this PDF has 10 pages");
  assert.equal(error('1', 0), 'This PDF has no pages');
});

test('parsePageRanges: positions count characters, not UTF-16 units', () => {
  assert.equal(error('😀x'), 'Unexpected "😀" near position 1');
  assert.equal(error('1,😀'), 'Unexpected "😀" near position 3');
});

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
  const list = [
    { from: 1, to: 3 },
    { from: 5, to: 5 },
    { from: 8, to: 10 },
  ];
  assert.equal(describeRanges(list), '1–3, 5, 8–10');
  assert.equal(describeRanges(list, 2), '1–3, 5 and 1 more');
});

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
    assert.equal(result.error, 'Enter a whole number of pages (1 or more)');
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

test('planOutputs: errors and limits', () => {
  const bad = planOutputs('ranges', '1-3, 42', 10, 'report');
  assert.ok(!bad.ok);
  assert.equal(bad.error, "Page 42 doesn't exist — this PDF has 10 pages");

  const empty = planOutputs('extract', '', 10, 'report');
  assert.ok(!empty.ok);
  assert.equal(empty.error, 'Enter at least one page');

  const noPages = planOutputs('single', '', 0, 'report');
  assert.ok(!noPages.ok);

  const huge = planOutputs('extract', Array(5).fill('1-end').join(','), 5000, 'report');
  assert.ok(!huge.ok);
  assert.match(huge.error, /25,000 pages/);
  assert.match(huge.error, new RegExp(MAX_TOTAL_PAGES.toLocaleString('en-US')));
});

test('planOutputs: unsafe or long base names are cleaned up', () => {
  assert.equal(plan('extract', '1', 10, 'a/b\\c.pdf')[0]!.filename, 'abc-page-1.pdf');
  assert.equal(plan('extract', '1', 10, '   ')[0]!.filename, 'document-page-1.pdf');
  const long = plan('ranges', '1-2, 3-4', 10, 'x'.repeat(300));
  assert.equal(long[0]!.filename, `${'x'.repeat(60)}-pages-1-2.pdf`);
  assert.notEqual(long[0]!.filename, long[1]!.filename);
});

test('summarizePlan', () => {
  assert.equal(summarizePlan(plan('every', '4', 10, 'r')), 'Will create 3 files: pages 1–4, 5–8, 9–10');
  assert.equal(summarizePlan(plan('extract', '1-3, 5, 8-', 10, 'r')), 'Will create 1 file with 7 pages: 1–3, 5, 8–10');
  assert.equal(summarizePlan(plan('extract', '5', 10, 'r')), 'Will create 1 file: page 5');
  assert.equal(summarizePlan(plan('single', '', 10, 'r')), 'Will create 10 files: pages 1, 2, 3, 4, 5, 6 and 4 more');
  assert.equal(summarizePlan(plan('single', '', 10, 'r'), 3), 'Will create 10 files: pages 1, 2, 3 and 7 more');
  assert.equal(
    summarizePlan(plan('extract', '1,3,5,7,9,2,4,6', 10, 'r'), 3),
    'Will create 1 file with 8 pages: 1, 3, 5 and 5 more',
  );
  assert.equal(summarizePlan([]), '');
});
