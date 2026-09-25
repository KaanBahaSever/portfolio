/**
 * Tic-tac-toe opponent: minimax in negamax form, with and without alpha–beta pruning. Pure: no DOM.
 *
 * Scores are from the point of view of the side to move:
 *   a win completed on ply p scores  WIN_SCORE − p   (the move being considered is ply 1),
 *   a loss on ply p scores         −(WIN_SCORE − p),
 *   a draw scores 0.
 * Subtracting the ply makes the search prefer faster wins and slower losses. A game has at most
 * nine plies, so every win stays positive and every loss negative.
 */
import { CELL_COUNT, emptyCells, findWin, otherMark, type Board, type Cell, type Mark } from './board.ts';
import { pickOne, type Rng } from '../random.ts';

export const WIN_SCORE = 10;

/** Plies the Medium opponent looks ahead: its own move and the reply. */
export const MEDIUM_DEPTH = 2;

export type Difficulty = 'easy' | 'medium' | 'unbeatable';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'unbeatable'];

/**
 * Centre, corners, then edges: strong moves first make alpha–beta cut off sooner.
 * The order never changes a value, only how many positions are visited.
 */
const SEARCH_ORDER = [4, 0, 2, 6, 8, 1, 3, 5, 7] as const;

/** Negating a draw gives −0; public results use +0 so callers and tests can compare with Object.is. */
function plusZero(value: number): number {
  return value === 0 ? 0 : value;
}

/** Score of a finished position for the side to move, or null if play goes on. */
function terminalScore(cells: readonly Cell[], toMove: Mark, ply: number): number | null {
  const win = findWin(cells);
  // On a legal board the line belongs to whoever moved last, i.e. the opponent of `toMove`.
  if (win) return win.mark === toMove ? WIN_SCORE - ply : -(WIN_SCORE - ply);
  return null;
}

/** Plain minimax (negamax form, no pruning): the reference the pruned search is tested against. */
export function minimax(board: Board, toMove: Mark): number {
  return plusZero(negamax(board.slice(), toMove, 0));
}

function negamax(cells: Cell[], toMove: Mark, ply: number): number {
  const terminal = terminalScore(cells, toMove, ply);
  if (terminal !== null) return terminal;
  let best = -Infinity;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (cells[i] !== null) continue;
    cells[i] = toMove;
    const value = -negamax(cells, otherMark(toMove), ply + 1);
    cells[i] = null;
    if (value > best) best = value;
  }
  // No empty cell and no line: a draw.
  return best === -Infinity ? 0 : best;
}

export interface SearchOptions {
  /** Plies to search before treating an unfinished position as 0 (default: to the end of the game). */
  maxDepth?: number;
}

/** Minimax value with alpha–beta pruning. With the full window it equals minimax() exactly. */
export function alphaBeta(board: Board, toMove: Mark, options: SearchOptions = {}): number {
  return plusZero(search(board.slice(), toMove, 0, -Infinity, Infinity, options.maxDepth ?? Infinity));
}

/** Fail-soft negamax alpha–beta. `ply` counts moves from the root position. */
function search(cells: Cell[], toMove: Mark, ply: number, alpha: number, beta: number, maxDepth: number): number {
  const terminal = terminalScore(cells, toMove, ply);
  if (terminal !== null) return terminal;
  // Horizon of a depth-limited search: an unfinished position counts as even.
  if (ply >= maxDepth) return 0;
  let best = -Infinity;
  for (const i of SEARCH_ORDER) {
    if (cells[i] !== null) continue;
    cells[i] = toMove;
    const value = -search(cells, otherMark(toMove), ply + 1, -beta, -alpha, maxDepth);
    cells[i] = null;
    if (value > best) best = value;
    if (best > alpha) alpha = best;
    // The opponent already has a better option elsewhere: the rest of this node cannot matter.
    if (alpha >= beta) break;
  }
  return best === -Infinity ? 0 : best;
}

export interface MoveScore {
  index: number;
  score: number;
}

/**
 * The exact score of every empty cell for the side to move (ascending cell order). Each move is
 * searched with a full window, so ties are real ties; that is what the "Show evaluation" overlay
 * displays and what lets the opponent break ties at random.
 */
export function evaluateMoves(board: Board, toMove: Mark, options: SearchOptions = {}): MoveScore[] {
  if (findWin(board)) return [];
  const maxDepth = options.maxDepth ?? Infinity;
  const cells = board.slice();
  return emptyCells(board).map((index) => {
    cells[index] = toMove;
    const score = plusZero(-search(cells, otherMark(toMove), 1, -Infinity, Infinity, maxDepth));
    cells[index] = null;
    return { index, score };
  });
}

/** Every cell with the highest score (empty when the game is over). */
export function bestMoves(board: Board, toMove: Mark, options: SearchOptions = {}): number[] {
  const scores = evaluateMoves(board, toMove, options);
  const top = Math.max(...scores.map((s) => s.score));
  return scores.filter((s) => s.score === top).map((s) => s.index);
}

/**
 * The computer's move.
 *   easy:       any empty cell.
 *   medium:     minimax two plies deep: takes a win in one, blocks a loss in one, misses forks.
 *   unbeatable: full minimax; among equally good moves it picks at random, so games vary
 *               without ever giving anything away.
 */
export function chooseMove(board: Board, toMove: Mark, difficulty: Difficulty, rng: Rng): number {
  if (findWin(board)) throw new Error('chooseMove: the game is over');
  const empty = emptyCells(board);
  if (empty.length === 0) throw new Error('chooseMove: the board is full');
  switch (difficulty) {
    case 'easy':
      return pickOne(rng, empty);
    case 'medium':
      return pickOne(rng, bestMoves(board, toMove, { maxDepth: MEDIUM_DEPTH }));
    case 'unbeatable':
      return pickOne(rng, bestMoves(board, toMove));
  }
}

/** What a score means for the side to move, and how many plies until the game ends. */
export function readScore(score: number): { result: 'win' | 'draw' | 'loss'; plies: number } {
  if (score === 0) return { result: 'draw', plies: 0 };
  return { result: score > 0 ? 'win' : 'loss', plies: WIN_SCORE - Math.abs(score) };
}
