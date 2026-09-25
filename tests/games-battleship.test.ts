import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BOARD_SIZE,
  FLEET,
  allPlacements,
  checkPlacement,
  colOf,
  coordinateLabel,
  isCompleteFleet,
  placementCells,
  randomFleet,
  rowOf,
  shipCells,
  type Placement,
  type ShipSpec,
} from '../src/lib/games/battleship/rules.ts';
import { allSunk, createOcean, fire, hitsTaken, isSunk, shipAt, shotsFired } from '../src/lib/games/battleship/ocean.ts';
import {
  DIFFICULTIES,
  HIT,
  MISS,
  SUNK,
  UNKNOWN,
  chooseShot,
  createKnowledge,
  densityPeaks,
  probabilityDensity,
  recordShot,
  targetWeight,
  unresolvedHits,
  type Difficulty,
  type Knowledge,
} from '../src/lib/games/battleship/ai.ts';
import { mulberry32 } from '../src/lib/games/random.ts';

const at = (row: number, col: number, size = BOARD_SIZE) => row * size + col;

function place(ship: Placement['ship'], start: number, orientation: Placement['orientation'] = 'horizontal'): Placement {
  const length = FLEET.find((s) => s.id === ship)?.length ?? 0;
  return { ship, length, start, orientation };
}

// ---------------------------------------------------------------- geometry and placement

test('coordinates name the column by letter and the row by number', () => {
  assert.equal(coordinateLabel(0), 'A1');
  assert.equal(coordinateLabel(9), 'J1');
  assert.equal(coordinateLabel(90), 'A10');
  assert.equal(coordinateLabel(99), 'J10');
  assert.equal(coordinateLabel(at(6, 2)), 'C7');
  assert.equal(coordinateLabel(at(1, 3, 4), 4), 'D2');
});

test('shipCells stays inside the board and never wraps to the next row', () => {
  assert.deepEqual(shipCells(5, 5, 'horizontal'), [5, 6, 7, 8, 9]);
  assert.equal(shipCells(6, 5, 'horizontal'), null);
  assert.equal(shipCells(8, 3, 'horizontal'), null);
  assert.deepEqual(shipCells(50, 5, 'vertical'), [50, 60, 70, 80, 90]);
  assert.equal(shipCells(60, 5, 'vertical'), null);
  assert.equal(shipCells(-1, 2, 'horizontal'), null);
  assert.equal(shipCells(100, 2, 'horizontal'), null);
  assert.equal(shipCells(1.5, 2, 'horizontal'), null);
  assert.deepEqual(shipCells(99, 1, 'vertical'), [99]);
});

test('checkPlacement rejects ships off the board and reports which cells still fit', () => {
  const result = checkPlacement([], place('carrier', at(2, 7)));
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.reason, 'out-of-bounds');
  assert.deepEqual(result.cells, [at(2, 7), at(2, 8), at(2, 9)]);

  const vertical = checkPlacement([], place('battleship', at(8, 0), 'vertical'));
  assert.equal(!vertical.ok && vertical.reason, 'out-of-bounds');
  assert.deepEqual(vertical.cells, [at(8, 0), at(9, 0)]);
});

test('checkPlacement rejects overlaps, names the ships in the way and allows touching', () => {
  const fleet = [place('carrier', at(0, 0)), place('destroyer', at(2, 0), 'vertical')];

  const crossing = checkPlacement(fleet, place('cruiser', at(0, 0), 'vertical'));
  assert.equal(crossing.ok, false);
  assert.equal(!crossing.ok && crossing.reason, 'overlap');
  assert.deepEqual(!crossing.ok && crossing.reason === 'overlap' && crossing.conflicts, ['carrier', 'destroyer']);

  // Directly below the carrier and beside the destroyer: touching is allowed.
  const touching = checkPlacement(fleet, place('cruiser', at(1, 1)));
  assert.deepEqual(touching, { ok: true, cells: [at(1, 1), at(1, 2), at(1, 3)] });

  // Moving a ship onto its own old cells is fine.
  const moved = checkPlacement(fleet, place('carrier', at(0, 1)));
  assert.equal(moved.ok, true);
});

test('isCompleteFleet requires every ship once, on the board, without overlaps', () => {
  const good = [
    place('carrier', at(0, 0)),
    place('battleship', at(1, 0)),
    place('cruiser', at(2, 0)),
    place('submarine', at(3, 0)),
    place('destroyer', at(4, 0)),
  ];
  assert.equal(isCompleteFleet(good), true);
  assert.equal(isCompleteFleet(good.slice(0, 4)), false);
  assert.equal(isCompleteFleet([...good.slice(0, 4), place('destroyer', at(0, 3))]), false);
  assert.equal(isCompleteFleet([...good.slice(0, 4), place('destroyer', at(4, 9))]), false);
  assert.equal(isCompleteFleet([...good.slice(0, 4), place('cruiser', at(5, 0))]), false);
});

test('allPlacements counts (size − L + 1) · size positions per orientation', () => {
  assert.equal(allPlacements({ id: 'carrier', length: 5 }).length, 2 * 6 * 10);
  assert.equal(allPlacements({ id: 'destroyer', length: 2 }).length, 2 * 9 * 10);
  assert.equal(allPlacements({ id: 'destroyer', length: 1 }, 4).length, 16);
});

test('random fleets are always complete and legal', () => {
  const starts = new Set<number>();
  for (let seed = 1; seed <= 2000; seed++) {
    const fleet = randomFleet(mulberry32(seed));
    assert.equal(isCompleteFleet(fleet), true, `seed ${seed}`);
    assert.deepEqual(
      fleet.map((p) => p.ship),
      FLEET.map((s) => s.id),
    );
    starts.add(fleet[0]?.start ?? -1);
  }
  // The carrier lands in many different places.
  assert.ok(starts.size > 50);
});

// ---------------------------------------------------------------- firing

test('fire reports misses, hits and sunk ships, and ignores repeated shots', () => {
  const ocean = createOcean([place('destroyer', at(0, 0)), place('cruiser', at(2, 2), 'vertical')]);
  assert.equal(shipAt(ocean, at(0, 1)), 'destroyer');
  assert.equal(shipAt(ocean, at(5, 5)), null);

  assert.deepEqual(fire(ocean, at(5, 5)), { result: 'miss', index: at(5, 5) });
  assert.deepEqual(fire(ocean, at(5, 5)), { result: 'repeat', index: at(5, 5) });
  assert.deepEqual(fire(ocean, at(0, 0)), { result: 'hit', index: at(0, 0), ship: 'destroyer' });
  assert.equal(isSunk(ocean, 'destroyer'), false);
  assert.deepEqual(fire(ocean, at(0, 1)), {
    result: 'sunk',
    index: at(0, 1),
    ship: 'destroyer',
    cells: [at(0, 0), at(0, 1)],
  });
  assert.equal(isSunk(ocean, 'destroyer'), true);
  assert.equal(allSunk(ocean), false);
  fire(ocean, at(2, 2));
  fire(ocean, at(3, 2));
  assert.equal(fire(ocean, at(4, 2)).result, 'sunk');
  assert.equal(allSunk(ocean), true);
  assert.equal(shotsFired(ocean), 6);
  assert.equal(hitsTaken(ocean), 5);
  assert.throws(() => fire(ocean, 100));
  assert.throws(() => createOcean([place('destroyer', 0), place('cruiser', 1)]));
});

// ---------------------------------------------------------------- probability density

/**
 * Builds a knowledge state from rows of characters: '.' unknown, 'o' miss, 'x' unresolved hit,
 * '#' part of a sunk ship.
 */
function board(rows: string[], remaining: ShipSpec[]): Knowledge {
  const size = rows.length;
  const codes: Record<string, number> = { '.': UNKNOWN, o: MISS, x: HIT, '#': SUNK };
  const cells = Uint8Array.from(rows.join('').split(''), (c) => {
    const code = codes[c];
    if (code === undefined) throw new Error(`bad cell ${c}`);
    return code;
  });
  assert.equal(cells.length, size * size);
  return { size, cells, remaining };
}

/**
 * Brute force: every set of L cells that forms a contiguous straight line, found by trying all
 * C(n, L) subsets of the board. Independent of shipCells() and of the start/orientation loop.
 */
function straightLines(size: number, length: number): number[][] {
  const lines: number[][] = [];
  const n = size * size;
  const choose = (from: number, picked: number[]) => {
    if (picked.length === length) {
      const rows = new Set(picked.map((c) => Math.floor(c / size)));
      const cols = new Set(picked.map((c) => c % size));
      const sorted = [...picked].sort((a, b) => a - b);
      const sameRow = rows.size === 1 && sorted.every((c, i) => i === 0 || c === (sorted[i - 1] as number) + 1);
      const sameCol = cols.size === 1 && sorted.every((c, i) => i === 0 || c === (sorted[i - 1] as number) + size);
      if (sameRow || sameCol) lines.push(sorted);
      return;
    }
    for (let c = from; c < n; c++) choose(c + 1, [...picked, c]);
  };
  choose(0, []);
  return lines;
}

function bruteForceDensity(knowledge: Knowledge): number[] {
  const { size, cells, remaining } = knowledge;
  const weight = targetWeight(remaining);
  const density = new Array<number>(size * size).fill(0);
  for (const ship of remaining) {
    for (const line of straightLines(size, ship.length)) {
      const states = line.map((c) => cells[c]);
      if (states.some((s) => s === MISS || s === SUNK)) continue;
      const hits = states.filter((s) => s === HIT).length;
      if (hits === line.length) continue;
      for (const c of line) if (cells[c] === UNKNOWN) density[c] = (density[c] ?? 0) + weight ** hits;
    }
  }
  return density;
}

const cruiser: ShipSpec = { id: 'cruiser', length: 3 };
const submarine: ShipSpec = { id: 'submarine', length: 3 };
const destroyer: ShipSpec = { id: 'destroyer', length: 2 };
const battleship: ShipSpec = { id: 'battleship', length: 4 };

test('density on an empty 4×4 board counts placements by hand', () => {
  // One destroyer: a corner has 2 placements, an edge cell next to it 3, a centre cell 4.
  const k = board(['....', '....', '....', '....'], [destroyer]);
  assert.deepEqual([...probabilityDensity(k)], [2, 3, 3, 2, 3, 4, 4, 3, 3, 4, 4, 3, 2, 3, 3, 2]);
});

test('density matches brute-force enumeration on handcrafted small boards', () => {
  const cases: Knowledge[] = [
    board(['....', '....', '....', '....'], [cruiser, destroyer]),
    board(['.o..', '....', '..o.', '....'], [cruiser, destroyer]),
    board(['.....', '.o...', '..x..', '.....', '#o...'], [cruiser, destroyer, submarine]),
    board(['.....', '..x..', '..x..', '.o...', '###..'], [battleship, destroyer]),
    board(['x....', '.o...', '...o.', '.o..x', '...o.'], [cruiser, destroyer]),
    board(['...', '.x.', '...'], [destroyer]),
    board(['o.o', '.x.', 'o.o'], [cruiser, destroyer]),
    board(['......', '.oo...', '..xx..', '......', '....o.', '#.....'], [battleship, cruiser, destroyer]),
    board(['...', '...', '...'], [{ id: 'destroyer', length: 1 }]),
  ];
  for (const k of cases) {
    assert.deepEqual([...probabilityDensity(k)], bruteForceDensity(k));
  }
});

test('density is zero on fired cells and follows the hits in target mode', () => {
  const k = board(['.....', '.....', '..x..', '.....', '.....'], [cruiser]);
  const density = probabilityDensity(k);
  assert.equal(density[at(2, 2, 5)], 0);
  // The four neighbours of the hit tie for first place: each lies on two placements through it.
  const peaks = densityPeaks(k, density).sort((a, b) => a - b);
  assert.deepEqual(peaks, [at(1, 2, 5), at(2, 1, 5), at(2, 3, 5), at(3, 2, 5)]);
  // Three hits in a row and a four-cell ship: the two ends of the line win.
  const line = board(['.....', '.....', '.xxx.', '.....', '.....'], [battleship]);
  assert.deepEqual(densityPeaks(line).sort((a, b) => a - b), [at(2, 0, 5), at(2, 4, 5)]);
  // Two hits and a cruiser: the far side has one more placement through a hit, so it wins alone.
  const pair = board(['.....', '.....', '.xx..', '.....', '.....'], [cruiser]);
  assert.deepEqual(densityPeaks(pair), [at(2, 3, 5)]);
});

test('hard fires at a density peak and breaks ties at random', () => {
  const k = board(['.....', '.....', '.xxx.', '.....', '.....'], [battleship]);
  const chosen = new Set<number>();
  for (let seed = 1; seed <= 20; seed++) chosen.add(chooseShot(k, 'hard', mulberry32(seed)));
  assert.deepEqual([...chosen].sort((a, b) => a - b), [at(2, 0, 5), at(2, 4, 5)]);
});

test('recordShot marks misses, hits and sunk ships and forgets sunk ships', () => {
  const ocean = createOcean([place('destroyer', at(0, 0))]);
  const k = createKnowledge();
  recordShot(k, fire(ocean, at(5, 5)));
  recordShot(k, fire(ocean, at(0, 0)));
  assert.equal(k.cells[at(5, 5)], MISS);
  assert.equal(k.cells[at(0, 0)], HIT);
  assert.deepEqual(unresolvedHits(k), [at(0, 0)]);
  recordShot(k, fire(ocean, at(0, 1)));
  assert.equal(k.cells[at(0, 0)], SUNK);
  assert.equal(k.cells[at(0, 1)], SUNK);
  assert.deepEqual(unresolvedHits(k), []);
  assert.deepEqual(
    k.remaining.map((s) => s.id),
    ['carrier', 'battleship', 'cruiser', 'submarine'],
  );
});

// ---------------------------------------------------------------- whole games

/** Is `cell` on a placement of a remaining ship through an unresolved hit that avoids misses and sunk ships? */
function onPlacementThroughHit(k: Knowledge, cell: number): boolean {
  for (const ship of k.remaining) {
    for (const p of allPlacements(ship, k.size)) {
      const cells = placementCells(p, k.size);
      if (!cells.includes(cell)) continue;
      const states = cells.map((c) => k.cells[c]);
      if (states.some((s) => s === MISS || s === SUNK)) continue;
      if (states.some((s) => s === HIT)) return true;
    }
  }
  return false;
}

/** In the same row or column as an unresolved hit, closer than the longest ship afloat. */
function inLineWithHit(k: Knowledge, cell: number): boolean {
  const reach = Math.max(...k.remaining.map((s) => s.length));
  return unresolvedHits(k).some((hit) => {
    const sameRow = rowOf(hit) === rowOf(cell) && Math.abs(colOf(hit) - colOf(cell)) < reach;
    const sameCol = colOf(hit) === colOf(cell) && Math.abs(rowOf(hit) - rowOf(cell)) < reach;
    return sameRow || sameCol;
  });
}

function simulate(difficulty: Difficulty, seed: number): number {
  const ocean = createOcean(randomFleet(mulberry32(seed)));
  const k = createKnowledge();
  const rng = mulberry32(seed * 7919 + 17);
  const fired = new Set<number>();
  while (!allSunk(ocean)) {
    const targeting = unresolvedHits(k).length > 0;
    const shot = chooseShot(k, difficulty, rng);
    assert.equal(fired.has(shot), false, `${difficulty} #${seed} fired twice at ${coordinateLabel(shot)}`);
    assert.equal(k.cells[shot], UNKNOWN);
    fired.add(shot);
    // Once a ship is hit, Normal and Hard stay on it until it sinks.
    if (targeting && difficulty !== 'easy') {
      assert.ok(inLineWithHit(k, shot), `${difficulty} #${seed} left a wounded ship for ${coordinateLabel(shot)}`);
      if (difficulty === 'hard') assert.ok(onPlacementThroughHit(k, shot));
    }
    recordShot(k, fire(ocean, shot));
    assert.ok(fired.size <= BOARD_SIZE * BOARD_SIZE);
  }
  assert.equal(unresolvedHits(k).length, 0);
  assert.equal(k.remaining.length, 0);
  return fired.size;
}

test('seeded games end within 100 shots without repeats, and harder levels need fewer shots', () => {
  const means = new Map<Difficulty, number>();
  for (const difficulty of DIFFICULTIES) {
    let total = 0;
    const games = 60;
    for (let seed = 1; seed <= games; seed++) {
      const shots = simulate(difficulty, seed);
      assert.ok(shots >= 17 && shots <= 100);
      total += shots;
    }
    means.set(difficulty, total / games);
  }
  const easy = means.get('easy') ?? 0;
  const normal = means.get('normal') ?? 0;
  const hard = means.get('hard') ?? 0;
  assert.ok(hard < normal && normal < easy, `means: easy ${easy}, normal ${normal}, hard ${hard}`);
  // Random fire needs nearly the whole board; the density map is known to average in the 40s–50s.
  assert.ok(easy > 85, `easy ${easy}`);
  assert.ok(hard < 60, `hard ${hard}`);
});

test('the same seed replays the same game', () => {
  for (const difficulty of DIFFICULTIES) {
    assert.equal(simulate(difficulty, 42), simulate(difficulty, 42));
  }
});

test('the target weight outranks any cell that no hit-covering placement reaches', () => {
  // 2 · (5 + 4 + 3 + 3 + 2) = 34 placements at most through one cell.
  assert.equal(targetWeight(FLEET), 35);
  const k = createKnowledge();
  const density = probabilityDensity(k);
  assert.ok(Math.max(...density) < targetWeight(FLEET));
});
