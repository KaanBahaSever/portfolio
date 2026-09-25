/**
 * The computer admiral. Pure: no DOM.
 *
 * The AI sees only what a player would: the result of each of its shots, and which ship sank
 * (the game announces and reveals sunk ships). That view is a Knowledge object, updated with
 * recordShot() after every shot. Three strategies choose the next cell:
 *
 *   easy    a random cell it has not fired at.
 *   normal  hunt & target. Hunting, it fires on a parity lattice: cells with (row + col) divisible
 *           by the shortest ship still afloat, since every such ship must cover one of them.
 *           After a hit it probes the neighbours, and once two hits line up it extends the line.
 *   hard    probability density. For every unknown cell it counts the placements of each
 *           remaining ship that avoid misses and sunk ships; placements through unresolved hits
 *           are weighted heavily, so after a hit it closes in on that ship. It fires at the
 *           highest count, breaking ties at random.
 */
import { pickOne, type Rng } from '../random.ts';
import type { ShotOutcome } from './ocean.ts';
import { BOARD_SIZE, FLEET, colOf, rowOf, shipCells, type Orientation, type ShipSpec } from './rules.ts';

/** What the shooter knows about a cell of the opponent's board. */
export const UNKNOWN = 0;
export const MISS = 1;
/** A hit on a ship that is still afloat. */
export const HIT = 2;
/** A cell of a ship that has been sunk (and revealed). */
export const SUNK = 3;
export type CellKnowledge = typeof UNKNOWN | typeof MISS | typeof HIT | typeof SUNK;

export interface Knowledge {
  readonly size: number;
  /** One CellKnowledge value per cell. */
  readonly cells: Uint8Array;
  /** Ships not sunk yet. */
  remaining: readonly ShipSpec[];
}

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export function createKnowledge(fleet: readonly ShipSpec[] = FLEET, size = BOARD_SIZE): Knowledge {
  return { size, cells: new Uint8Array(size * size), remaining: [...fleet] };
}

/** Updates `knowledge` with the result of a shot. */
export function recordShot(knowledge: Knowledge, outcome: ShotOutcome): void {
  switch (outcome.result) {
    case 'miss':
      knowledge.cells[outcome.index] = MISS;
      break;
    case 'hit':
      knowledge.cells[outcome.index] = HIT;
      break;
    case 'sunk':
      for (const cell of outcome.cells) knowledge.cells[cell] = SUNK;
      knowledge.remaining = knowledge.remaining.filter((spec) => spec.id !== outcome.ship);
      break;
    case 'repeat':
      break;
  }
}

export function unknownCells(knowledge: Knowledge): number[] {
  const cells: number[] = [];
  knowledge.cells.forEach((state, index) => {
    if (state === UNKNOWN) cells.push(index);
  });
  return cells;
}

/** Hits on ships that are still afloat. */
export function unresolvedHits(knowledge: Knowledge): number[] {
  const cells: number[] = [];
  knowledge.cells.forEach((state, index) => {
    if (state === HIT) cells.push(index);
  });
  return cells;
}

/**
 * Weight of a placement per unresolved hit it covers. A cell collects at most 2·L placements of a
 * ship of length L (L horizontal, L vertical), so a cell that no hit-covering placement reaches
 * scores at most 2·ΣL. One more than that makes any cell on a placement through a hit outrank
 * every such cell: in target mode, the density never wanders off the wounded ship.
 */
export function targetWeight(remaining: readonly ShipSpec[]): number {
  return 1 + 2 * remaining.reduce((sum, spec) => sum + spec.length, 0);
}

function orientationsFor(length: number): Orientation[] {
  // A one-cell ship has a single placement per cell, not two.
  return length > 1 ? ['horizontal', 'vertical'] : ['horizontal'];
}

/**
 * The probability density: for each unknown cell, the weighted number of placements of every
 * remaining ship that cover it. A placement counts when none of its cells is a miss or part of a
 * sunk ship, and it weighs targetWeight^k when it covers k unresolved hits (1 when k = 0).
 * Placements made only of hits are skipped: a ship with every cell hit would already have sunk.
 * Cells that are not unknown score 0.
 *
 * Ships are counted independently (the sum over ships of each ship's placements). The exact joint
 * distribution over whole fleets is far too large to enumerate; this is the standard approximation.
 */
export function probabilityDensity(knowledge: Knowledge): Float64Array {
  const { size, cells } = knowledge;
  const density = new Float64Array(size * size);
  const weight = targetWeight(knowledge.remaining);
  for (const spec of knowledge.remaining) {
    for (const orientation of orientationsFor(spec.length)) {
      for (let start = 0; start < size * size; start++) {
        const covered = shipCells(start, spec.length, orientation, size);
        if (!covered) continue;
        let hits = 0;
        let unknown = 0;
        let blocked = false;
        for (const cell of covered) {
          const state = cells[cell];
          if (state === MISS || state === SUNK) {
            blocked = true;
            break;
          }
          if (state === HIT) hits++;
          else unknown++;
        }
        if (blocked || unknown === 0) continue;
        const value = weight ** hits;
        for (const cell of covered) if (cells[cell] === UNKNOWN) density[cell] = (density[cell] ?? 0) + value;
      }
    }
  }
  return density;
}

/** The unknown cells with the highest density (all unknown cells if every density is 0). */
export function densityPeaks(knowledge: Knowledge, density = probabilityDensity(knowledge)): number[] {
  let best = 0;
  let peaks: number[] = [];
  for (const cell of unknownCells(knowledge)) {
    const value = density[cell] ?? 0;
    if (value > best) {
      best = value;
      peaks = [cell];
    } else if (value === best && value > 0) {
      peaks.push(cell);
    }
  }
  return peaks.length > 0 ? peaks : unknownCells(knowledge);
}

function neighbours(index: number, size: number): number[] {
  const row = rowOf(index, size);
  const col = colOf(index, size);
  const result: number[] = [];
  if (row > 0) result.push(index - size);
  if (col < size - 1) result.push(index + 1);
  if (row < size - 1) result.push(index + size);
  if (col > 0) result.push(index - 1);
  return result;
}

/**
 * Unknown cells just past either end of a run of two or more adjacent unresolved hits: when hits
 * line up, the ship most likely continues along that line.
 */
function lineExtensions(knowledge: Knowledge, hits: readonly number[]): number[] {
  const { size, cells } = knowledge;
  const found = new Set<number>();
  const directions = [
    { dr: 0, dc: 1 },
    { dr: 1, dc: 0 },
  ];
  for (const hit of hits) {
    const row = rowOf(hit, size);
    const col = colOf(hit, size);
    for (const { dr, dc } of directions) {
      const isHit = (r: number, c: number) =>
        r >= 0 && r < size && c >= 0 && c < size && cells[r * size + c] === HIT;
      if (!isHit(row + dr, col + dc) && !isHit(row - dr, col - dc)) continue;
      for (const sign of [1, -1]) {
        let r = row;
        let c = col;
        while (isHit(r + sign * dr, c + sign * dc)) {
          r += sign * dr;
          c += sign * dc;
        }
        const nr = r + sign * dr;
        const nc = c + sign * dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size && cells[nr * size + nc] === UNKNOWN) {
          found.add(nr * size + nc);
        }
      }
    }
  }
  return [...found];
}

function huntAndTarget(knowledge: Knowledge, rng: Rng, unknown: readonly number[]): number {
  const hits = unresolvedHits(knowledge);
  if (hits.length > 0) {
    const along = lineExtensions(knowledge, hits);
    if (along.length > 0) return pickOne(rng, along);
    const around = new Set<number>();
    for (const hit of hits) {
      for (const cell of neighbours(hit, knowledge.size)) {
        if (knowledge.cells[cell] === UNKNOWN) around.add(cell);
      }
    }
    if (around.size > 0) return pickOne(rng, [...around]);
  }
  // With no ship left (never asked in a real game) every cell is on the lattice.
  const shortest = knowledge.remaining.length > 0 ? Math.min(...knowledge.remaining.map((spec) => spec.length)) : 1;
  const size = knowledge.size;
  const lattice = unknown.filter((cell) => (rowOf(cell, size) + colOf(cell, size)) % shortest === 0);
  return pickOne(rng, lattice.length > 0 ? lattice : unknown);
}

/** The computer's next target. Always a cell it has not fired at. */
export function chooseShot(knowledge: Knowledge, difficulty: Difficulty, rng: Rng): number {
  const unknown = unknownCells(knowledge);
  if (unknown.length === 0) throw new Error('chooseShot: no cells left');
  switch (difficulty) {
    case 'easy':
      return pickOne(rng, unknown);
    case 'normal':
      return huntAndTarget(knowledge, rng, unknown);
    case 'hard':
      return pickOne(rng, densityPeaks(knowledge));
  }
}
