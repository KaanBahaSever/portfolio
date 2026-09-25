/**
 * Tic-tac-toe rules. Pure: no DOM.
 *
 * The board is 9 cells in reading order (0 = top left, 4 = centre, 8 = bottom right). Nothing here
 * assumes X moves first: the side to move is always passed explicitly, because the page lets
 * either mark start.
 */

export type Mark = 'X' | 'O';
export type Cell = Mark | null;
export type Board = readonly Cell[];

export const CELL_COUNT = 9;

/** Row, column and diagonal indices; the order is also the order of the line names in the UI. */
export const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const satisfies readonly (readonly [number, number, number])[];

export type Line = (typeof LINES)[number];
/** Index into LINES. */
export type LineId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Outcome =
  | { kind: 'ongoing' }
  | { kind: 'draw' }
  | { kind: 'win'; mark: Mark; line: Line; lineId: LineId };

export function emptyBoard(): Cell[] {
  return Array<Cell>(CELL_COUNT).fill(null);
}

export function otherMark(mark: Mark): Mark {
  return mark === 'X' ? 'O' : 'X';
}

/** The completed line, if any. On a legal board at most one mark can have one. */
export function findWin(board: Board): { mark: Mark; line: Line; lineId: LineId } | null {
  for (let id = 0; id < LINES.length; id++) {
    const line = LINES[id] as Line;
    const mark = board[line[0]];
    if (mark && mark === board[line[1]] && mark === board[line[2]]) {
      return { mark, line, lineId: id as LineId };
    }
  }
  return null;
}

export function isFull(board: Board): boolean {
  return board.every((cell) => cell !== null);
}

/** A full board without a line is a draw; a line wins even when it fills the last cell. */
export function outcomeOf(board: Board): Outcome {
  const win = findWin(board);
  if (win) return { kind: 'win', ...win };
  return isFull(board) ? { kind: 'draw' } : { kind: 'ongoing' };
}

export function emptyCells(board: Board): number[] {
  const cells: number[] = [];
  for (let i = 0; i < board.length; i++) if (board[i] === null) cells.push(i);
  return cells;
}

/** A new board with `mark` in `index`. Throws on an occupied or out-of-range cell (a caller bug). */
export function play(board: Board, index: number, mark: Mark): Cell[] {
  if (!Number.isInteger(index) || index < 0 || index >= CELL_COUNT) throw new RangeError(`play: bad cell ${index}`);
  if (board[index] !== null) throw new Error(`play: cell ${index} is taken`);
  const next = board.slice();
  next[index] = mark;
  return next;
}

/** Number keys: '1' is top left on a phone keypad, bottom left on a numeric keypad. */
export type KeypadLayout = 'phone' | 'numpad';

/**
 * The cell for a digit key 1–9, or null for any other key.
 *   phone:  1 2 3 / 4 5 6 / 7 8 9  (reading order, like a phone or the top-row number keys)
 *   numpad: 7 8 9 / 4 5 6 / 1 2 3  (the layout of a keyboard's numeric keypad)
 */
export function cellForDigit(key: string, layout: KeypadLayout): number | null {
  if (!/^[1-9]$/.test(key)) return null;
  const n = Number(key) - 1;
  if (layout === 'phone') return n;
  const row = 2 - Math.floor(n / 3);
  return row * 3 + (n % 3);
}

/** The digit that selects `index` in a layout (the inverse of cellForDigit). */
export function digitForCell(index: number, layout: KeypadLayout): string {
  if (layout === 'phone') return String(index + 1);
  const row = Math.floor(index / 3);
  return String((2 - row) * 3 + (index % 3) + 1);
}
