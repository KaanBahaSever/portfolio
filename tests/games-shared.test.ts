import assert from 'node:assert/strict';
import { test } from 'node:test';

import { moveInGrid } from '../src/lib/games/grid.ts';
import { mulberry32, pickOne, randomInt, randomSeed } from '../src/lib/games/random.ts';
import { FLEET } from '../src/lib/games/battleship/rules.ts';
import { LINES } from '../src/lib/games/tictactoe/board.ts';
import { battleshipMessages } from '../src/i18n/games/battleship.ts';
import { gamesHubMessages } from '../src/i18n/games/hub.ts';
import { ticTacToeMessages } from '../src/i18n/games/tictactoe.ts';

// ---------------------------------------------------------------- randomness

test('mulberry32 is deterministic per seed and stays in [0, 1)', () => {
  const a = mulberry32(123);
  const b = mulberry32(123);
  const c = mulberry32(124);
  const first = Array.from({ length: 1000 }, () => a());
  assert.deepEqual(
    first,
    Array.from({ length: 1000 }, () => b()),
  );
  assert.notDeepEqual(
    first.slice(0, 10),
    Array.from({ length: 10 }, () => c()),
  );
  assert.ok(first.every((x) => x >= 0 && x < 1));
  // Roughly uniform: each tenth of the interval gets a fair share.
  const buckets = new Array<number>(10).fill(0);
  for (const x of first) buckets[Math.floor(x * 10)]! += 1;
  assert.ok(buckets.every((count) => count > 60 && count < 140), String(buckets));
});

test('randomInt covers exactly [0, n) and rejects bad bounds', () => {
  const rng = mulberry32(5);
  const seen = new Set<number>();
  for (let i = 0; i < 500; i++) seen.add(randomInt(rng, 7));
  assert.deepEqual(
    [...seen].sort((a, b) => a - b),
    [0, 1, 2, 3, 4, 5, 6],
  );
  // A generator that returns exactly 1 must not produce n.
  assert.equal(randomInt(() => 1, 7), 6);
  assert.throws(() => randomInt(rng, 0));
  assert.throws(() => randomInt(rng, 2.5));
  assert.throws(() => pickOne(rng, []));
  assert.equal(pickOne(rng, ['only']), 'only');
  const seed = randomSeed();
  assert.ok(Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32);
});

// ---------------------------------------------------------------- grid keyboard

test('moveInGrid moves one cell, stops at the edges and ignores other keys', () => {
  // 10×10: cell 0 is the top-left corner, 99 the bottom-right.
  assert.equal(moveInGrid(0, { key: 'ArrowUp' }, 10, 10), 0);
  assert.equal(moveInGrid(0, { key: 'ArrowLeft' }, 10, 10), 0);
  assert.equal(moveInGrid(0, { key: 'ArrowRight' }, 10, 10), 1);
  assert.equal(moveInGrid(0, { key: 'ArrowDown' }, 10, 10), 10);
  // No wrapping from the end of a row to the next.
  assert.equal(moveInGrid(9, { key: 'ArrowRight' }, 10, 10), 9);
  assert.equal(moveInGrid(10, { key: 'ArrowLeft' }, 10, 10), 10);
  assert.equal(moveInGrid(95, { key: 'ArrowDown' }, 10, 10), 95);
  assert.equal(moveInGrid(4, { key: 'Enter' }, 3, 3), null);
  assert.equal(moveInGrid(4, { key: 'a' }, 3, 3), null);
});

test('moveInGrid jumps with Home, End, Page Up and Page Down', () => {
  assert.equal(moveInGrid(55, { key: 'Home' }, 10, 10), 50);
  assert.equal(moveInGrid(55, { key: 'End' }, 10, 10), 59);
  assert.equal(moveInGrid(55, { key: 'Home', ctrlKey: true }, 10, 10), 0);
  assert.equal(moveInGrid(55, { key: 'End', metaKey: true }, 10, 10), 99);
  assert.equal(moveInGrid(55, { key: 'PageUp' }, 10, 10), 5);
  assert.equal(moveInGrid(55, { key: 'PageDown' }, 10, 10), 95);
  assert.equal(moveInGrid(4, { key: 'PageDown' }, 3, 3), 7);
});

// ---------------------------------------------------------------- catalogues

test('every ship has a name and both sinking sentences in each language', () => {
  for (const locale of ['en', 'tr'] as const) {
    const m = battleshipMessages[locale];
    for (const ship of FLEET) {
      const text = m.ships[ship.id];
      assert.ok(text.name.length > 0);
      assert.ok(text.youSankMine.endsWith('.'));
      assert.ok(text.yoursSunk.endsWith('.'));
    }
  }
  // The Turkish sentences are written out per ship (possessive suffixes differ), not templated.
  assert.equal(battleshipMessages.tr.ships.destroyer.youSankMine, 'Muhribimi batırdınız.');
  assert.equal(battleshipMessages.tr.ships.carrier.yoursSunk, 'Uçak geminiz battı.');
});

test('interpolated values stand alone in the Turkish battle messages', () => {
  const tr = battleshipMessages.tr;
  assert.equal(tr.battle.playerShot.hit('C7'), 'C7: isabet.');
  assert.equal(tr.battle.computerShot.miss('B2'), 'Bilgisayarın atışı: B2, ıska.');
  assert.equal(tr.status.overlaps('Kruvazör', 'C7', 'Muhrip'), 'Kruvazör, başlangıç C7: Muhrip ile çakışıyor.');
  assert.equal(tr.result.winSummary(47), 'Düşman filosunun tamamını batırdınız. Atış sayısı: 47.');
  assert.equal(battleshipMessages.en.cell.label('C7', 'hit'), 'C7, hit');
  assert.equal(battleshipMessages.en.cell.label('C7', 'Cruiser', 'sunk'), 'C7, Cruiser, sunk');
});

test('tic-tac-toe names all nine squares and eight lines in each language', () => {
  for (const locale of ['en', 'tr'] as const) {
    const m = ticTacToeMessages[locale];
    assert.equal(m.squares.length, 9);
    assert.equal(m.squaresInline.length, 9);
    assert.equal(m.lines.length, LINES.length);
    assert.equal(new Set(m.squares).size, 9);
    assert.equal(new Set(m.lines).size, 8);
  }
  assert.equal(ticTacToeMessages.tr.announce.computerMove('O', 'sol üst'), 'Bilgisayar O oynadı: sol üst.');
  assert.equal(ticTacToeMessages.en.announce.markWins('X', 'top row'), 'X wins: top row.');
  assert.equal(gamesHubMessages.tr.figure(2), 'Şekil 2');
});
