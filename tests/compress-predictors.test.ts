import { test } from 'node:test';
import assert from 'node:assert/strict';
import { undoPngPredictors, undoTiffPredictor2 } from '../src/lib/pdf/compress/predictors.ts';
import { samplesFromDecoded } from '../src/lib/pdf/compress/pixels.ts';

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Reference PNG row encoder: the inverse of what is under test. */
function encodePng(samples: Uint8Array, colors: number, columns: number, types: number[]): Uint8Array {
  const rowBytes = colors * columns;
  const rows = samples.length / rowBytes;
  const out = new Uint8Array(rows * (rowBytes + 1));
  for (let row = 0; row < rows; row++) {
    const type = types[row % types.length]!;
    const o = row * (rowBytes + 1);
    out[o] = type;
    for (let i = 0; i < rowBytes; i++) {
      const x = samples[row * rowBytes + i]!;
      const a = i >= colors ? samples[row * rowBytes + i - colors]! : 0;
      const b = row > 0 ? samples[(row - 1) * rowBytes + i]! : 0;
      const c = row > 0 && i >= colors ? samples[(row - 1) * rowBytes + i - colors]! : 0;
      const predicted = type === 0 ? 0 : type === 1 ? a : type === 2 ? b : type === 3 ? (a + b) >> 1 : paeth(a, b, c);
      out[o + 1 + i] = (x - predicted) & 0xff;
    }
  }
  return out;
}

function pseudoRandom(length: number, seed = 7): Uint8Array {
  const out = new Uint8Array(length);
  let state = seed;
  for (let i = 0; i < length; i++) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    out[i] = state >>> 24;
  }
  return out;
}

test('PNG predictors: hand-built rows of every type decode', () => {
  // 2 columns, 1 colour. Row 0 None, row 1 Sub, row 2 Up, row 3 Average, row 4 Paeth.
  const encoded = Uint8Array.from([
    0, 10, 20, // None -> 10 20
    1, 5, 3, // Sub -> 5, 3+5=8
    2, 1, 2, // Up -> 5+1=6, 8+2=10
    3, 4, 4, // Average -> 4+(0+6)/2=7, 4+(7+10)/2=12
    4, 1, 1, // Paeth -> left 0, up 7, upleft 0 -> 7+1=8; left 8, up 12, upleft 7 -> p=13 -> up 12 -> 13
  ]);
  const decoded = undoPngPredictors(encoded, 1, 8, 2);
  assert.deepEqual(Array.from(decoded), [10, 20, 5, 8, 6, 10, 7, 12, 8, 13]);
});

test('PNG predictors: Sub wraps around modulo 256', () => {
  const decoded = undoPngPredictors(Uint8Array.from([1, 200, 100]), 1, 8, 2);
  assert.deepEqual(Array.from(decoded), [200, 44]);
});

test('PNG predictors: RGB round trip with mixed row types', () => {
  const colors = 3;
  const columns = 17;
  const samples = pseudoRandom(colors * columns * 11);
  const encoded = encodePng(samples, colors, columns, [0, 1, 2, 3, 4, 4, 2]);
  assert.deepEqual(undoPngPredictors(encoded, colors, 8, columns), samples);
});

test('PNG predictors: in-place decoding matches and reuses the input buffer', () => {
  const colors = 3;
  const columns = 9;
  const samples = pseudoRandom(colors * columns * 6, 99);
  const encoded = encodePng(samples, colors, columns, [4, 3, 1, 2, 0, 4]);
  const copy = encoded.slice();
  const decoded = undoPngPredictors(copy, colors, 8, columns, { inPlace: true });
  assert.equal(decoded.buffer, copy.buffer);
  assert.deepEqual(Array.from(decoded), Array.from(samples));
  // The default does not touch its input.
  const untouched = encoded.slice();
  undoPngPredictors(untouched, colors, 8, columns);
  assert.deepEqual(untouched, encoded);
});

test('PNG predictors: incomplete last row is dropped, unknown filter type throws', () => {
  const decoded = undoPngPredictors(Uint8Array.from([0, 1, 2, 0, 3]), 1, 8, 2);
  assert.deepEqual(Array.from(decoded), [1, 2]);
  assert.throws(() => undoPngPredictors(Uint8Array.from([5, 1, 2]), 1, 8, 2), RangeError);
  assert.throws(() => undoPngPredictors(Uint8Array.from([0, 1, 2]), 1, 16 as 8, 2), RangeError);
});

test('TIFF predictor 2: horizontal differences per component, reset each row', () => {
  // 3 columns, 2 colours. Row 0: (10,100) (+1,+1) (+2,-1)  Row 1: (5,5) (+250,+0) (+10,+1)
  const encoded = Uint8Array.from([10, 100, 1, 1, 2, 255, 5, 5, 250, 0, 10, 1]);
  const decoded = undoTiffPredictor2(encoded, 2, 8, 3);
  assert.deepEqual(Array.from(decoded), [10, 100, 11, 101, 13, 100, 5, 5, 255, 5, 9, 6]);
  assert.deepEqual(Array.from(encoded.subarray(0, 2)), [10, 100], 'input untouched by default');
  const inPlace = encoded.slice();
  assert.equal(undoTiffPredictor2(inPlace, 2, 8, 3, { inPlace: true }).buffer, inPlace.buffer);
  assert.deepEqual(Array.from(inPlace), Array.from(decoded));
});

test('samplesFromDecoded: validates length and strips predictor bytes', () => {
  const samples = pseudoRandom(4 * 3 * 3, 3);
  const encoded = encodePng(samples, 3, 4, [1]);
  const layout = { width: 4, height: 3, channels: 3 as const, predictor: { kind: 'png' as const, colors: 3, columns: 4 } };
  assert.deepEqual(samplesFromDecoded(encoded.slice(), layout, true), samples);
  // Extra trailing bytes are ignored; truncated data is rejected.
  const padded = new Uint8Array(encoded.length + 13);
  padded.set(encoded);
  assert.deepEqual(samplesFromDecoded(padded, layout, false), samples);
  assert.equal(samplesFromDecoded(encoded.subarray(0, encoded.length - 1), layout, false), null);
  const raw = { ...layout, predictor: { kind: 'none' as const, colors: 3, columns: 4 } };
  assert.equal(samplesFromDecoded(samples.subarray(0, 10), raw, false), null);
  assert.equal(samplesFromDecoded(Uint8Array.from([9, 9, 9]), layout, false), null, 'bad filter type -> null');
});
