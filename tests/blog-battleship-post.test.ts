/**
 * The data behind the Battleship post's figures (src/components/blog/posts/battleship/): the
 * worked examples, the lattice and density facts the prose states, the exact formulas for random
 * fire, the base-w notation of the density, and the post's derived modes against the game's own
 * Normal computer.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatters } from '../src/i18n/format.ts';
import { HIT, chooseShot, createKnowledge, recordShot, type Knowledge } from '../src/lib/games/battleship/ai.ts';
import { allSunk, createOcean, fire } from '../src/lib/games/battleship/ocean.ts';
import { BOARD_SIZE, randomFleet } from '../src/lib/games/battleship/rules.ts';
import { mulberry32 } from '../src/lib/games/random.ts';
import { weightDigits, weightFormula } from '../src/components/blog/posts/battleship/format.ts';
import {
  FLEET_CELLS,
  cell,
  densityMap,
  knowledgeOf,
  latticeCells,
  modeOf,
  placementCounts,
  placementsMissingLattice,
  playGame,
  randomExpectedShots,
  randomFinishedBy,
  replayTarget,
  summarize,
} from '../src/components/blog/posts/battleship/model.ts';

test('cell labels map to indices like the game’s coordinates', () => {
  assert.equal(cell('A1'), 0);
  assert.equal(cell('E5'), 44);
  assert.equal(cell('J10'), 99);
  assert.throws(() => cell('K1'));
  assert.throws(() => cell('A11'));
});

test('placement counts follow 2n(n − L + 1)', () => {
  assert.deepEqual(
    placementCounts().map((row) => row.count),
    [120, 140, 160, 160, 180],
  );
});

test('the empty-board density peaks at 34 in the four central cells', () => {
  const map = densityMap(knowledgeOf({}));
  assert.equal(map.max, 34);
  assert.deepEqual(map.peaks, [cell('E5'), cell('F5'), cell('E6'), cell('F6')]);
  assert.equal(Math.min(...map.density), 10);
  assert.equal(map.weight, 35);
});

test('the density after one and two hits reads as base-w digits', () => {
  const one = densityMap(knowledgeOf({ hits: ['E5'] }));
  assert.deepEqual(one.peaks, [cell('F5'), cell('E6')]);
  assert.deepEqual(weightDigits(one.max, one.weight), [22, 12]);
  const two = densityMap(knowledgeOf({ hits: ['E5', 'F5'] }));
  assert.deepEqual(two.peaks, [cell('D5'), cell('G5')]);
  assert.deepEqual(weightDigits(two.max, two.weight), [21, 5, 7]);
  // Both ends blocked: the leading digit falls back to the w place.
  const blocked = densityMap(knowledgeOf({ hits: ['E5', 'F5'], misses: ['D5', 'G5'] }));
  assert.deepEqual(blocked.peaks, [cell('E6'), cell('F6')]);
  assert.equal(weightDigits(blocked.max, blocked.weight).length, 2);
});

test('the gap between two hits is a w² peak although the Normal computer is only targeting', () => {
  // The post's example: "F5 between E5 and G5".
  const gap = knowledgeOf({ hits: ['E5', 'G5'] });
  const map = densityMap(gap);
  assert.deepEqual(map.peaks, [cell('F5')]);
  assert.equal(weightDigits(map.max, map.weight).length, 3);
  assert.equal(modeOf(gap), 'target');
});

test('weightFormula writes base-w expansions in each locale', () => {
  assert.equal(weightFormula([22, 12], 35, formatters('en')), '12 · 35 + 22');
  assert.equal(weightFormula([21, 5, 7], 35, formatters('en')), '7 · 35² + 5 · 35 + 21');
  assert.equal(weightFormula([0, 3], 35, formatters('en')), '3 · 35');
  assert.equal(weightFormula([], 35, formatters('tr')), '0');
  assert.deepEqual(weightDigits(0, 35), []);
  // No ship afloat: w = 1, and the value stays whole instead of looping forever.
  assert.deepEqual(weightDigits(5, 1), [5]);
});

test('lattices: sizes, and every long enough ship touches its lattice', () => {
  assert.equal(latticeCells(2).length, 50);
  assert.equal(latticeCells(3).length, 34);
  for (const m of [2, 3, 4, 5]) {
    for (let length = m; length <= 5; length++) assert.equal(placementsMissingLattice(m, length), 0);
  }
  // A destroyer slips through the lattice of 3.
  assert.ok(placementsMissingLattice(3, 2) > 0);
});

test('modeOf derives hunt, target and line from what is known', () => {
  assert.equal(modeOf(knowledgeOf({})), 'hunt');
  assert.equal(modeOf(knowledgeOf({ hits: ['E5'] })), 'target');
  assert.equal(modeOf(knowledgeOf({ hits: ['E5', 'F5'] })), 'line');
  assert.equal(modeOf(knowledgeOf({ hits: ['E5', 'F5'], misses: ['D5', 'G5'] })), 'target');
  assert.equal(modeOf(knowledgeOf({ sunk: ['E5', 'F5'] })), 'hunt');
});

test('modeOf agrees with the moves of the game’s Normal computer', () => {
  // modeOf re-derives what ai.ts decides privately (lineExtensions): 'line' exactly when some
  // unknown cell continues a run of two or more unresolved hits, and then the computer fires there.
  const size = BOARD_SIZE;
  const isHit = (k: Knowledge, r: number, c: number) =>
    r >= 0 && r < size && c >= 0 && c < size && k.cells[r * size + c] === HIT;
  const extendsRun = (k: Knowledge, index: number) => {
    const r = Math.floor(index / size);
    const c = index % size;
    return [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ].some(([dr = 0, dc = 0]) => isHit(k, r + dr, c + dc) && isHit(k, r + 2 * dr, c + 2 * dc));
  };
  const seen = { line: 0, target: 0 };
  for (let seed = 1; seed <= 60; seed++) {
    const ocean = createOcean(randomFleet(mulberry32(seed)));
    const knowledge = createKnowledge();
    const rng = mulberry32(seed * 7919 + 17);
    while (!allSunk(ocean)) {
      const mode = modeOf(knowledge);
      const index = chooseShot(knowledge, 'normal', rng);
      if (mode !== 'hunt') {
        assert.equal(extendsRun(knowledge, index), mode === 'line', `seed ${seed}, shot at ${index}`);
        seen[mode]++;
      }
      recordShot(knowledge, fire(ocean, index));
    }
  }
  assert.ok(seen.line > 0 && seen.target > 0);
});

test('the target-mode replay is the sequence the post narrates', () => {
  const shots = replayTarget('E5', 15);
  assert.deepEqual(
    shots.map((shot) => [shot.index, shot.result, shot.after]),
    [
      [cell('E5'), 'hit', 'target'],
      [cell('E4'), 'miss', 'target'],
      [cell('E6'), 'miss', 'target'],
      [cell('F5'), 'hit', 'line'],
      [cell('G5'), 'miss', 'line'],
      [cell('D5'), 'sunk', 'hunt'],
    ],
  );
});

test('random fire: E[T] = k(N + 1)/(k + 1) and P(T ≤ t) = C(t, k)/C(N, k)', () => {
  assert.equal(FLEET_CELLS, 17);
  assert.ok(Math.abs(randomExpectedShots() - (17 * 101) / 18) < 1e-12);
  assert.equal(randomFinishedBy(16), 0);
  assert.equal(randomFinishedBy(100), 1);
  // Small case by hand: 2 marked cells among 4, all found within 3 shots: C(3,2)/C(4,2) = 1/2.
  assert.ok(Math.abs(randomFinishedBy(3, 2, 4) - 0.5) < 1e-12);
  // E[T] is the sum of P(T > t).
  let expected = 0;
  for (let t = 0; t < 100; t++) expected += 1 - randomFinishedBy(t);
  assert.ok(Math.abs(expected - randomExpectedShots()) < 1e-9);
  // The figures the post quotes: 4.8% within 85 shots, and a median of 97.
  assert.ok(Math.abs(randomFinishedBy(85) - 0.048) < 5e-4);
  assert.ok(randomFinishedBy(96) < 0.5 && randomFinishedBy(97) >= 0.5);
});

test('summaries: percentiles, and games finished within n shots', () => {
  const s = summarize([30, 10, 20, 40], 50);
  assert.equal(s.mean, 25);
  assert.equal(s.median, 20);
  assert.equal(s.p10, 10);
  assert.equal(s.p90, 40);
  assert.equal(s.min, 10);
  assert.equal(s.max, 40);
  assert.equal(s.finished[9], 0);
  assert.equal(s.finished[20], 2);
  assert.equal(s.finished[50], 4);
});

test('simulated games replay exactly and finish within the board', () => {
  for (const strategy of ['random', 'no-parity', 'parity', 'density'] as const) {
    const shots = playGame(strategy, 7);
    assert.equal(playGame(strategy, 7), shots);
    assert.ok(shots >= 17 && shots <= 100);
  }
});
