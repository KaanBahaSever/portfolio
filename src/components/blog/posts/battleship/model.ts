/**
 * Data behind the figures of the Battleship post ("The Battleship Hunt & Target Algorithm" and
 * its Turkish translation). Everything is computed from the game's own library in
 * src/lib/games/battleship/, so the pictures and numbers in the post show what the computer
 * opponent at /games/battleship/ actually does, and follow it if that code changes.
 *
 * Pure module (no DOM, no `astro:*`, '.ts' import extensions), so `node --test` can load it too.
 * It returns data only; the components turn it into SVG and localized text.
 */
import {
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
  type CellKnowledge,
  type Knowledge,
} from '../../../../lib/games/battleship/ai.ts';
import { allSunk, createOcean, fire, type ShotOutcome } from '../../../../lib/games/battleship/ocean.ts';
import {
  BOARD_SIZE,
  COLUMN_LETTERS,
  FLEET,
  allPlacements,
  colOf,
  placementCells,
  randomFleet,
  rowOf,
  type Placement,
  type ShipId,
  type ShipSpec,
} from '../../../../lib/games/battleship/rules.ts';
import { mulberry32 } from '../../../../lib/games/random.ts';

export { BOARD_SIZE, FLEET, HIT, MISS, SUNK, UNKNOWN, targetWeight, type CellKnowledge, type ShipId, type ShipSpec };

/** 'E5' → the cell index (column letter, then the row counted from 1), as the game labels cells. */
export function cell(label: string, size = BOARD_SIZE): number {
  const match = /^([A-Z])(\d{1,2})$/.exec(label);
  const col = match ? COLUMN_LETTERS.indexOf(match[1] ?? '') : -1;
  const row = match ? Number(match[2]) - 1 : -1;
  if (col < 0 || col >= size || row < 0 || row >= size) throw new RangeError(`cell: bad label ${label}`);
  return row * size + col;
}

export interface Position {
  misses?: readonly string[];
  hits?: readonly string[];
  sunk?: readonly string[];
  /** Ships still afloat (default: the whole fleet). */
  remaining?: readonly ShipSpec[];
  size?: number;
}

/** A shooter's knowledge written by hand with cell labels, for the worked examples. */
export function knowledgeOf(position: Position): Knowledge {
  const size = position.size ?? BOARD_SIZE;
  const knowledge = createKnowledge(position.remaining ?? FLEET, size);
  for (const label of position.misses ?? []) knowledge.cells[cell(label, size)] = MISS;
  for (const label of position.hits ?? []) knowledge.cells[cell(label, size)] = HIT;
  for (const label of position.sunk ?? []) knowledge.cells[cell(label, size)] = SUNK;
  return knowledge;
}

export interface DensityMap {
  size: number;
  /** What the shooter knows about each cell. */
  cells: CellKnowledge[];
  /** The game's probability density, one value per cell (0 for cells already fired at). */
  density: number[];
  /** Cells the Hard computer would choose between: the density maximum. */
  peaks: number[];
  max: number;
  /** The weight of one unresolved hit in this position (w in the post). */
  weight: number;
}

export function densityMap(knowledge: Knowledge): DensityMap {
  const density = [...probabilityDensity(knowledge)];
  const peaks = densityPeaks(knowledge);
  return {
    size: knowledge.size,
    cells: [...knowledge.cells] as CellKnowledge[],
    density,
    peaks,
    max: Math.max(0, ...density),
    weight: targetWeight(knowledge.remaining),
  };
}

/** How many positions each ship of the fleet has on an empty board. */
export function placementCounts(size = BOARD_SIZE): { ship: ShipSpec; count: number }[] {
  return FLEET.map((ship) => ({ ship, count: allPlacements(ship, size).length }));
}

/**
 * The number of ways to place the whole standard fleet on a 10×10 board (ships distinguishable,
 * touching allowed, no overlaps). Too slow to recount on every build (about 7·10^10 candidate
 * combinations; a few seconds even with pruning), so it is recorded here. It was counted with
 * three nested loops over the placements of the three largest ships and, for each such triple,
 * the last two ships in closed form: |A|·|B| minus the overlapping pairs, where A and B are their
 * placements clear of the first three.
 */
export const FLEET_ARRANGEMENTS = 30_093_975_536;

/**
 * The hunting lattice of the Normal computer (ai.ts, huntAndTarget): the cells whose row + column
 * is a multiple of m, the length of the shortest ship still afloat. (The computer fires only at
 * those it has not tried yet.)
 */
export function latticeCells(modulus: number, size = BOARD_SIZE): number[] {
  const cells: number[] = [];
  for (let index = 0; index < size * size; index++) {
    if ((rowOf(index, size) + colOf(index, size)) % modulus === 0) cells.push(index);
  }
  return cells;
}

/**
 * How many positions of a ship of `length` avoid the lattice of `modulus` entirely: none when
 * length ≥ modulus (a ship covers `length` consecutive values of row + column), and many for a
 * shorter ship, which is why the lattice follows the shortest ship afloat.
 */
export function placementsMissingLattice(modulus: number, length: number, size = BOARD_SIZE): number {
  const lattice = new Set(latticeCells(modulus, size));
  const ship: ShipSpec = { id: 'destroyer', length };
  return allPlacements(ship, size).filter((placement) => !placementCells(placement, size).some((c) => lattice.has(c)))
    .length;
}

export type Mode = 'hunt' | 'target' | 'line';

/**
 * The Normal computer's mode in a position, derived the way ai.ts derives it (it keeps no mode
 * variable): hunting without unresolved hits, following a line when two unresolved hits are
 * adjacent and an unknown cell continues their run, otherwise probing neighbours.
 *
 * 'line' mirrors the private lineExtensions() of ai.ts (non-empty exactly when this returns
 * 'line'). If that rule changes, update this too: TargetReplay.astro fails the build when the
 * replayed modes differ from the ones its caption narrates.
 */
export function modeOf(knowledge: Knowledge): Mode {
  const { size, cells } = knowledge;
  const hits = unresolvedHits(knowledge);
  if (hits.length === 0) return 'hunt';
  const isHit = (r: number, c: number) => r >= 0 && r < size && c >= 0 && c < size && cells[r * size + c] === HIT;
  const isUnknown = (r: number, c: number) =>
    r >= 0 && r < size && c >= 0 && c < size && cells[r * size + c] === UNKNOWN;
  for (const hit of hits) {
    const row = rowOf(hit, size);
    const col = colOf(hit, size);
    for (const [dr, dc] of [
      [0, 1],
      [1, 0],
    ] as const) {
      if (!isHit(row + dr, col + dc)) continue;
      // A run of at least two hits starts here: look past both of its ends.
      let r = row;
      let c = col;
      while (isHit(r - dr, c - dc)) {
        r -= dr;
        c -= dc;
      }
      if (isUnknown(r - dr, c - dc)) return 'line';
      r = row + dr;
      c = col + dc;
      while (isHit(r + dr, c + dc)) {
        r += dr;
        c += dc;
      }
      if (isUnknown(r + dr, c + dc)) return 'line';
    }
  }
  return 'target';
}

/* ------------------------------------------------------------------------------------------- */
/* Replays of the real computer players                                                         */

export interface Shot {
  index: number;
  result: 'miss' | 'hit' | 'sunk';
  /** The Normal computer's mode after this shot (what it does next). */
  after: Mode;
}

function outcomeResult(outcome: ShotOutcome): Shot['result'] {
  if (outcome.result === 'repeat') throw new Error('replay: the computer fired twice at one cell');
  return outcome.result;
}

/**
 * A fixed fleet for the worked examples, bow cells as labels: the cruiser that the target-mode
 * figure chases lies in the middle, the rest out of its way.
 */
export const EXAMPLE_FLEET: readonly Placement[] = [
  { ship: 'carrier', length: 5, start: cell('A1'), orientation: 'vertical' },
  { ship: 'battleship', length: 4, start: cell('G9'), orientation: 'horizontal' },
  { ship: 'cruiser', length: 3, start: cell('D5'), orientation: 'horizontal' },
  { ship: 'submarine', length: 3, start: cell('J1'), orientation: 'vertical' },
  { ship: 'destroyer', length: 2, start: cell('C9'), orientation: 'vertical' },
];

/** The worked examples of the post: the target-mode replay and the hunting snapshot. */
export const TARGET_EXAMPLE = { firstHit: 'E5', seed: 15 } as const;
export const HUNT_EXAMPLE = { seed: 10, shots: 12 } as const;

/**
 * The Normal computer finishing off a ship: it has just hit `firstHit` and plays on until that ship
 * sinks. Returns every shot, the first hit included.
 */
export function replayTarget(firstHit: string, seed: number, fleet: readonly Placement[] = EXAMPLE_FLEET): Shot[] {
  const ocean = createOcean(fleet);
  const knowledge = createKnowledge();
  const rng = mulberry32(seed);
  const shots: Shot[] = [];
  let index = cell(firstHit);
  for (let guard = 0; guard < 100; guard++) {
    const outcome = fire(ocean, index);
    recordShot(knowledge, outcome);
    shots.push({ index, result: outcomeResult(outcome), after: modeOf(knowledge) });
    if (outcome.result === 'sunk') return shots;
    index = chooseShot(knowledge, 'normal', rng);
  }
  throw new Error('replayTarget: the ship never sank');
}

/** The first `count` shots of a Hard game against a random fleet, and what it knew afterwards. */
export function replayHunt(seed: number, count: number): { shots: Shot[]; knowledge: Knowledge } {
  const ocean = createOcean(randomFleet(mulberry32(seed)));
  const knowledge = createKnowledge();
  const rng = mulberry32(seed * 7919 + 17);
  const shots: Shot[] = [];
  for (let i = 0; i < count && !allSunk(ocean); i++) {
    const index = chooseShot(knowledge, 'hard', rng);
    const outcome = fire(ocean, index);
    recordShot(knowledge, outcome);
    shots.push({ index, result: outcomeResult(outcome), after: modeOf(knowledge) });
  }
  return { shots, knowledge };
}

/* ------------------------------------------------------------------------------------------- */
/* Simulation                                                                                   */

/**
 * The strategies compared in the post. Three are the game's difficulty levels; 'no-parity' is the
 * Normal computer with its hunting lattice switched off (it hunts like Easy and targets like
 * Normal), built from the same library calls to measure what the lattice is worth.
 */
export const STRATEGIES = ['random', 'no-parity', 'parity', 'density'] as const;
export type Strategy = (typeof STRATEGIES)[number];

function nextShot(strategy: Strategy, knowledge: Knowledge, rng: () => number): number {
  switch (strategy) {
    case 'random':
      return chooseShot(knowledge, 'easy', rng);
    case 'no-parity':
      return chooseShot(knowledge, unresolvedHits(knowledge).length > 0 ? 'normal' : 'easy', rng);
    case 'parity':
      return chooseShot(knowledge, 'normal', rng);
    case 'density':
      return chooseShot(knowledge, 'hard', rng);
  }
}

/**
 * Shots needed to sink a whole fleet. Game `seed` places the fleet with mulberry32(seed) and gives
 * the computer mulberry32(seed · 7919 + 17), as the game's tests do, so every strategy faces the
 * same fleets and each game can be replayed exactly.
 */
export function playGame(strategy: Strategy, seed: number): number {
  const ocean = createOcean(randomFleet(mulberry32(seed)));
  const knowledge = createKnowledge();
  const rng = mulberry32(seed * 7919 + 17);
  let shots = 0;
  while (!allSunk(ocean)) {
    const outcome = fire(ocean, nextShot(strategy, knowledge, rng));
    if (outcome.result === 'repeat') throw new Error(`playGame: ${strategy} repeated a shot`);
    recordShot(knowledge, outcome);
    shots++;
  }
  return shots;
}

export interface Summary {
  games: number;
  mean: number;
  /** Sample standard deviation. */
  sd: number;
  median: number;
  p10: number;
  p90: number;
  min: number;
  max: number;
  /** games finished within n shots, for n = 0…100 (index n). */
  finished: number[];
}

/** Nearest-rank percentile of sorted data. */
function percentile(sorted: readonly number[], p: number): number {
  const rank = Math.max(1, Math.ceil(p * sorted.length));
  return sorted[rank - 1] ?? Number.NaN;
}

export function summarize(results: readonly number[], cells = BOARD_SIZE * BOARD_SIZE): Summary {
  const sorted = [...results].sort((a, b) => a - b);
  const games = sorted.length;
  const mean = sorted.reduce((sum, x) => sum + x, 0) / games;
  const sd = Math.sqrt(sorted.reduce((sum, x) => sum + (x - mean) ** 2, 0) / Math.max(1, games - 1));
  const finished = Array.from({ length: cells + 1 }, () => 0);
  for (const shots of sorted) for (let n = shots; n <= cells; n++) finished[n] = (finished[n] ?? 0) + 1;
  return {
    games,
    mean,
    sd,
    median: percentile(sorted, 0.5),
    p10: percentile(sorted, 0.1),
    p90: percentile(sorted, 0.9),
    min: sorted[0] ?? Number.NaN,
    max: sorted[games - 1] ?? Number.NaN,
    finished,
  };
}

/** Games per strategy in the post: seeds 1…GAMES. */
export const GAMES = 1000;

let cached: Record<Strategy, Summary> | undefined;

/**
 * Every strategy against the same GAMES fleets. Takes a few seconds (the density player dominates),
 * so the result is kept for the rest of the build: both language versions share it.
 */
export function simulation(): Record<Strategy, Summary> {
  if (!cached) {
    const entries = STRATEGIES.map((strategy) => {
      const results = Array.from({ length: GAMES }, (_, i) => playGame(strategy, i + 1));
      return [strategy, summarize(results)] as const;
    });
    cached = Object.fromEntries(entries) as Record<Strategy, Summary>;
  }
  return cached;
}

/* ------------------------------------------------------------------------------------------- */
/* Random fire, exactly                                                                         */

/** Total ship cells of the standard fleet (17). */
export const FLEET_CELLS = FLEET.reduce((sum, ship) => sum + ship.length, 0);

/**
 * P(T ≤ n) for random fire: all k ship cells among the first n of N shots, C(n, k) / C(N, k).
 * Computed as a product of ratios, so no huge binomials are formed.
 */
export function randomFinishedBy(n: number, k = FLEET_CELLS, cells = BOARD_SIZE * BOARD_SIZE): number {
  if (n < k) return 0;
  let p = 1;
  for (let i = 0; i < k; i++) p *= (n - i) / (cells - i);
  return p;
}

/** E[T] for random fire: the last of k marked cells in a random order of N, k(N + 1)/(k + 1). */
export function randomExpectedShots(k = FLEET_CELLS, cells = BOARD_SIZE * BOARD_SIZE): number {
  return (k * (cells + 1)) / (k + 1);
}
