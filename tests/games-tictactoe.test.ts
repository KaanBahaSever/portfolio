import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LINES,
  cellForDigit,
  digitForCell,
  emptyBoard,
  emptyCells,
  findWin,
  isFull,
  otherMark,
  outcomeOf,
  play,
  type Cell,
  type Mark,
} from '../src/lib/games/tictactoe/board.ts';
import {
  MEDIUM_DEPTH,
  WIN_SCORE,
  alphaBeta,
  bestMoves,
  chooseMove,
  evaluateMoves,
  minimax,
  readScore,
} from '../src/lib/games/tictactoe/ai.ts';
import { mulberry32 } from '../src/lib/games/random.ts';

/** 'XO.|.X.|..O' → a board ('.' is empty; '|' and spaces are ignored). */
function parse(text: string): Cell[] {
  const chars = [...text.replace(/[\s|]/g, '')];
  assert.equal(chars.length, 9, `bad board ${text}`);
  return chars.map((c) => (c === 'X' || c === 'O' ? c : null));
}

function key(board: readonly Cell[], toMove: Mark): string {
  return board.map((c) => c ?? '.').join('') + toMove;
}

interface Position {
  board: Cell[];
  toMove: Mark;
}

/** Every position reachable by legal play, with X starting and with O starting (terminal ones included). */
function reachablePositions(): Position[] {
  const seen = new Map<string, Position>();
  const visit = (board: Cell[], toMove: Mark) => {
    const id = key(board, toMove);
    if (seen.has(id)) return;
    seen.set(id, { board, toMove });
    if (outcomeOf(board).kind !== 'ongoing') return;
    for (const i of emptyCells(board)) visit(play(board, i, toMove), otherMark(toMove));
  };
  visit(emptyBoard(), 'X');
  visit(emptyBoard(), 'O');
  return [...seen.values()];
}

const POSITIONS = reachablePositions();

// ---------------------------------------------------------------- rules

test('findWin and outcomeOf detect every row, column and diagonal for both marks', () => {
  for (const mark of ['X', 'O'] as const) {
    LINES.forEach((line, lineId) => {
      const board = emptyBoard();
      for (const i of line) board[i] = mark;
      assert.deepEqual(findWin(board), { mark, line, lineId });
      assert.deepEqual(outcomeOf(board), { kind: 'win', mark, line, lineId });
    });
  }
});

test('a full board without a line is a draw; a line that fills the last cell is a win', () => {
  assert.deepEqual(outcomeOf(emptyBoard()), { kind: 'ongoing' });
  const draw = parse('XOX|XOO|OXX');
  assert.equal(findWin(draw), null);
  assert.equal(isFull(draw), true);
  assert.deepEqual(outcomeOf(draw), { kind: 'draw' });

  const lastCellWin = parse('XOX|OXO|OXX');
  assert.equal(isFull(lastCellWin), true);
  assert.deepEqual(outcomeOf(lastCellWin), { kind: 'win', mark: 'X', line: [0, 4, 8], lineId: 6 });

  // Two marks in a line, or three of mixed marks, are not a win.
  assert.equal(findWin(parse('XX.|OO.|...')), null);
  assert.equal(findWin(parse('XOX|...|...')), null);
  assert.deepEqual(outcomeOf(parse('XX.|OO.|...')), { kind: 'ongoing' });
});

test('there are 5,478 legal positions with X starting, as in the literature', () => {
  const xFirst = new Set<string>();
  const visit = (board: Cell[], toMove: Mark) => {
    const id = board.join(',');
    if (xFirst.has(id)) return;
    xFirst.add(id);
    if (outcomeOf(board).kind !== 'ongoing') return;
    for (const i of emptyCells(board)) visit(play(board, i, toMove), otherMark(toMove));
  };
  visit(emptyBoard(), 'X');
  assert.equal(xFirst.size, 5478);
});

test('play returns a new board and refuses taken or invalid cells', () => {
  const board = emptyBoard();
  const next = play(board, 4, 'X');
  assert.equal(board[4], null);
  assert.equal(next[4], 'X');
  assert.deepEqual(emptyCells(next), [0, 1, 2, 3, 5, 6, 7, 8]);
  assert.throws(() => play(next, 4, 'O'));
  assert.throws(() => play(next, 9, 'O'));
  assert.throws(() => play(next, -1, 'O'));
});

test('digit keys map to cells in phone-keypad and numeric-keypad order', () => {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  assert.deepEqual(
    digits.map((d) => cellForDigit(d, 'phone')),
    [0, 1, 2, 3, 4, 5, 6, 7, 8],
  );
  // Numeric keypad: 7 8 9 on top, 1 2 3 at the bottom.
  assert.deepEqual(
    digits.map((d) => cellForDigit(d, 'numpad')),
    [6, 7, 8, 3, 4, 5, 0, 1, 2],
  );
  for (const layout of ['phone', 'numpad'] as const) {
    for (let i = 0; i < 9; i++) assert.equal(cellForDigit(digitForCell(i, layout), layout), i);
    for (const other of ['0', 'a', '10', '', ' ', 'Enter']) assert.equal(cellForDigit(other, layout), null);
  }
});

// ---------------------------------------------------------------- search

test('alpha–beta returns exactly the plain minimax value in every reachable position', () => {
  assert.ok(POSITIONS.length > 10_000);
  for (const { board, toMove } of POSITIONS) {
    assert.equal(alphaBeta(board, toMove), minimax(board, toMove), key(board, toMove));
  }
});

test('per-move evaluations agree with plain minimax one ply deeper', () => {
  // minimax(child) counts plies from the child; the root sees the same result one ply later.
  const oneLater = (value: number) => (value > 0 ? value - 1 : value < 0 ? value + 1 : 0);
  for (const { board, toMove } of POSITIONS) {
    if (outcomeOf(board).kind !== 'ongoing') {
      assert.deepEqual(evaluateMoves(board, toMove), []);
      continue;
    }
    const expected = emptyCells(board).map((index) => ({
      index,
      score: 0 - oneLater(minimax(play(board, index, toMove), otherMark(toMove))),
    }));
    assert.deepEqual(evaluateMoves(board, toMove), expected, key(board, toMove));
  }
});

test('the empty board is a draw with perfect play, and every opening move keeps it one', () => {
  assert.equal(minimax(emptyBoard(), 'X'), 0);
  assert.equal(alphaBeta(emptyBoard(), 'O'), 0);
  assert.deepEqual(bestMoves(emptyBoard(), 'X'), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
});

test('scores prefer faster wins', () => {
  // X can win now at 2; blocking O at 5 would only delay things.
  const board = parse('XX.|OO.|...');
  const scores = new Map(evaluateMoves(board, 'X').map((s) => [s.index, s.score]));
  assert.equal(scores.get(2), WIN_SCORE - 1);
  assert.deepEqual(bestMoves(board, 'X'), [2]);
  assert.deepEqual(readScore(WIN_SCORE - 1), { result: 'win', plies: 1 });
  assert.deepEqual(readScore(-(WIN_SCORE - 2)), { result: 'loss', plies: 2 });
  assert.deepEqual(readScore(0), { result: 'draw', plies: 0 });
});

test('in a lost position the computer picks the move that loses latest', () => {
  let found = 0;
  for (const { board, toMove } of POSITIONS) {
    const scores = evaluateMoves(board, toMove).map((s) => s.score);
    if (scores.length === 0 || scores.some((s) => s >= 0)) continue;
    if (new Set(scores).size < 2) continue;
    found++;
    const latest = Math.max(...scores);
    for (const move of bestMoves(board, toMove)) {
      assert.equal(evaluateMoves(board, toMove).find((s) => s.index === move)?.score, latest);
    }
  }
  assert.ok(found > 0, 'expected positions with losses of different lengths');
});

// ---------------------------------------------------------------- opponents

test('the unbeatable computer never loses: every opponent line, both marks, either side first', () => {
  const memo = new Map<string, number[]>();
  const best = (board: Cell[], mark: Mark) => {
    const id = key(board, mark);
    let moves = memo.get(id);
    if (!moves) {
      moves = bestMoves(board, mark);
      memo.set(id, moves);
    }
    return moves;
  };
  const tally = { games: 0, computerWins: 0, draws: 0 };

  for (const computer of ['X', 'O'] as const) {
    for (const first of ['X', 'O'] as const) {
      // At the computer's turn every equally good move is explored (the random tie-break could
      // pick any of them); at the opponent's turn, every empty cell.
      const explore = (board: Cell[], toMove: Mark): void => {
        const result = outcomeOf(board);
        if (result.kind !== 'ongoing') {
          tally.games++;
          if (result.kind === 'draw') tally.draws++;
          else {
            assert.equal(result.mark, computer, `lost: ${key(board, toMove)}`);
            tally.computerWins++;
          }
          return;
        }
        const moves = toMove === computer ? best(board, computer) : emptyCells(board);
        for (const i of moves) explore(play(board, i, toMove), otherMark(toMove));
      };
      explore(emptyBoard(), first);
    }
  }

  assert.ok(tally.games > 1000);
  assert.ok(tally.computerWins > 0 && tally.draws > 0);
});

test('the unbeatable computer only ever picks one of the best moves', () => {
  const rng = mulberry32(7);
  for (const { board, toMove } of POSITIONS) {
    if (outcomeOf(board).kind !== 'ongoing') continue;
    const move = chooseMove(board, toMove, 'unbeatable', rng);
    assert.ok(bestMoves(board, toMove).includes(move));
  }
});

test('medium takes a win in one and blocks a loss in one', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const rng = mulberry32(seed);
    assert.equal(chooseMove(parse('XX.|OO.|...'), 'X', 'medium', rng), 2);
    assert.equal(chooseMove(parse('XX.|O..|...'), 'O', 'medium', rng), 2);
    assert.equal(chooseMove(parse('X.O|.X.|...'), 'O', 'medium', rng), 8);
  }
});

test('medium looks only two plies ahead, so it can walk into a fork', () => {
  let blunders = 0;
  for (const { board, toMove } of POSITIONS) {
    if (outcomeOf(board).kind !== 'ongoing') continue;
    const exact = new Map(evaluateMoves(board, toMove).map((s) => [s.index, s.score]));
    const top = Math.max(...exact.values());
    const shallow = bestMoves(board, toMove, { maxDepth: MEDIUM_DEPTH });
    if (shallow.some((move) => (exact.get(move) ?? 0) < top)) blunders++;
  }
  assert.ok(blunders > 0);
});

test('easy plays any empty cell and never a taken one', () => {
  const rng = mulberry32(99);
  const seen = new Set<number>();
  for (const { board, toMove } of POSITIONS) {
    if (outcomeOf(board).kind !== 'ongoing') continue;
    const move = chooseMove(board, toMove, 'easy', rng);
    assert.equal(board[move], null);
    if (board.every((c) => c === null)) seen.add(move);
  }
  for (let i = 0; i < 200; i++) seen.add(chooseMove(emptyBoard(), 'X', 'easy', rng));
  assert.equal(seen.size, 9);
});

test('chooseMove refuses finished games', () => {
  const rng = mulberry32(1);
  assert.throws(() => chooseMove(parse('XXX|OO.|...'), 'O', 'unbeatable', rng));
  assert.throws(() => chooseMove(parse('XOX|XOO|OXX'), 'X', 'easy', rng));
});
