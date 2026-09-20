/**
 * Undoes the PNG and TIFF predictors that PDF FlateDecode/LZWDecode streams may use
 * (DecodeParms /Predictor). Pure: no DOM, runs under Node. 8 bits per component only.
 */

export interface PredictorOptions {
  /**
   * Decode inside `data` and return a view of it (the input is consumed). Saves one copy
   * of the pixel data for large images. The default returns a new array.
   */
  inPlace?: boolean;
}

const PNG_NONE = 0;
const PNG_SUB = 1;
const PNG_UP = 2;
const PNG_AVERAGE = 3;
const PNG_PAETH = 4;

function checkLayout(colors: number, bpc: number, columns: number): void {
  if (bpc !== 8) throw new RangeError(`Unsupported bits per component: ${bpc}`);
  if (!Number.isInteger(colors) || colors < 1 || colors > 32) throw new RangeError(`Invalid Colors: ${colors}`);
  if (!Number.isInteger(columns) || columns < 1) throw new RangeError(`Invalid Columns: ${columns}`);
}

function paeth(left: number, up: number, upLeft: number): number {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  return pb <= pc ? up : upLeft;
}

/**
 * Reverses PNG predictors (PDF Predictor 10–15): every row starts with a filter-type byte
 * (None, Sub, Up, Average, Paeth), which may differ per row. Returns the samples without
 * the filter bytes; an incomplete last row is dropped. Throws on an unknown filter type.
 */
export function undoPngPredictors(
  data: Uint8Array,
  colors: number,
  bpc: 8,
  columns: number,
  options: PredictorOptions = {},
): Uint8Array {
  checkLayout(colors, bpc, columns);
  const rowBytes = colors * columns;
  const bpp = colors; // bytes per pixel at 8 bits per component
  const rows = Math.floor(data.length / (rowBytes + 1));
  // In place is safe: output row r starts r + 1 bytes before input row r, so every write
  // lands on input that has already been read, and the previous output row stays intact.
  const out = options.inPlace ? data.subarray(0, rows * rowBytes) : new Uint8Array(rows * rowBytes);

  for (let row = 0; row < rows; row++) {
    const src = row * (rowBytes + 1);
    const type = data[src]!;
    const dst = row * rowBytes;
    const prev = dst - rowBytes; // start of the previous output row (negative for row 0)
    const hasPrev = row > 0;
    const input = src + 1;

    switch (type) {
      case PNG_NONE:
        copyRow(data, input, out, dst, rowBytes);
        break;
      case PNG_SUB:
        for (let i = 0; i < rowBytes; i++) {
          const left = i >= bpp ? out[dst + i - bpp]! : 0;
          out[dst + i] = (data[input + i]! + left) & 0xff;
        }
        break;
      case PNG_UP:
        for (let i = 0; i < rowBytes; i++) {
          const up = hasPrev ? out[prev + i]! : 0;
          out[dst + i] = (data[input + i]! + up) & 0xff;
        }
        break;
      case PNG_AVERAGE:
        for (let i = 0; i < rowBytes; i++) {
          const left = i >= bpp ? out[dst + i - bpp]! : 0;
          const up = hasPrev ? out[prev + i]! : 0;
          out[dst + i] = (data[input + i]! + ((left + up) >> 1)) & 0xff;
        }
        break;
      case PNG_PAETH:
        for (let i = 0; i < rowBytes; i++) {
          const left = i >= bpp ? out[dst + i - bpp]! : 0;
          const up = hasPrev ? out[prev + i]! : 0;
          const upLeft = hasPrev && i >= bpp ? out[prev + i - bpp]! : 0;
          out[dst + i] = (data[input + i]! + paeth(left, up, upLeft)) & 0xff;
        }
        break;
      default:
        throw new RangeError(`Unknown PNG predictor type ${type} in row ${row}`);
    }
  }
  return out;
}

/** Copies one row; correct when `out` is a view of `data` and dst < src (in place). */
function copyRow(data: Uint8Array, src: number, out: Uint8Array, dst: number, length: number): void {
  if (data.buffer === out.buffer) data.copyWithin(out.byteOffset - data.byteOffset + dst, src, src + length);
  else out.set(data.subarray(src, src + length), dst);
}

/**
 * Reverses TIFF Predictor 2 (horizontal differencing): each sample is stored as the
 * difference from the same component of the pixel to its left. Rows restart at zero.
 * An incomplete last row is dropped.
 */
export function undoTiffPredictor2(
  data: Uint8Array,
  colors: number,
  bpc: 8,
  columns: number,
  options: PredictorOptions = {},
): Uint8Array {
  checkLayout(colors, bpc, columns);
  const rowBytes = colors * columns;
  const rows = Math.floor(data.length / rowBytes);
  const out = options.inPlace ? data.subarray(0, rows * rowBytes) : data.slice(0, rows * rowBytes);
  for (let row = 0; row < rows; row++) {
    const start = row * rowBytes;
    for (let i = colors; i < rowBytes; i++) {
      out[start + i] = (out[start + i]! + out[start + i - colors]!) & 0xff;
    }
  }
  return out;
}
