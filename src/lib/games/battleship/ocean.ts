/**
 * One side's waters: where its ships are and which cells have been fired at. Pure: no DOM.
 *
 * An Ocean is a plain object owned by whoever created it (a game instance or a test); fire()
 * updates it in place. There is no shared state between oceans.
 */
import { BOARD_SIZE, placementCells, type Placement, type ShipId } from './rules.ts';

export interface Ocean {
  readonly size: number;
  readonly placements: readonly Placement[];
  /** For each cell, the index into `placements` of the ship on it, or -1 for open water. */
  readonly occupant: Int8Array;
  /** 1 for every cell that has been fired at. */
  readonly fired: Uint8Array;
  /** Hits taken by each ship, parallel to `placements`. */
  readonly hits: number[];
}

export type ShotOutcome =
  | { result: 'miss'; index: number }
  | { result: 'hit'; index: number; ship: ShipId }
  | { result: 'sunk'; index: number; ship: ShipId; cells: number[] }
  /** The cell had already been fired at: nothing changes (the UI never allows it; the AI never does it). */
  | { result: 'repeat'; index: number };

/** Throws on overlapping or off-board placements (a caller bug: validate with checkPlacement first). */
export function createOcean(placements: readonly Placement[], size = BOARD_SIZE): Ocean {
  const occupant = new Int8Array(size * size).fill(-1);
  placements.forEach((placement, shipIndex) => {
    for (const cell of placementCells(placement, size)) {
      if (occupant[cell] !== -1) throw new Error(`createOcean: ships overlap at cell ${cell}`);
      occupant[cell] = shipIndex;
    }
  });
  return {
    size,
    placements: [...placements],
    occupant,
    fired: new Uint8Array(size * size),
    hits: placements.map(() => 0),
  };
}

export function fire(ocean: Ocean, index: number): ShotOutcome {
  if (!Number.isInteger(index) || index < 0 || index >= ocean.fired.length) {
    throw new RangeError(`fire: bad cell ${index}`);
  }
  if (ocean.fired[index]) return { result: 'repeat', index };
  ocean.fired[index] = 1;
  const shipIndex = ocean.occupant[index] ?? -1;
  if (shipIndex < 0) return { result: 'miss', index };
  const placement = ocean.placements[shipIndex] as Placement;
  const hits = (ocean.hits[shipIndex] ?? 0) + 1;
  ocean.hits[shipIndex] = hits;
  if (hits === placement.length) {
    return { result: 'sunk', index, ship: placement.ship, cells: placementCells(placement, ocean.size) };
  }
  return { result: 'hit', index, ship: placement.ship };
}

export function isSunk(ocean: Ocean, ship: ShipId): boolean {
  const shipIndex = ocean.placements.findIndex((p) => p.ship === ship);
  if (shipIndex < 0) return false;
  return ocean.hits[shipIndex] === (ocean.placements[shipIndex] as Placement).length;
}

export function allSunk(ocean: Ocean): boolean {
  return ocean.placements.every((placement, i) => ocean.hits[i] === placement.length);
}

export function shotsFired(ocean: Ocean): number {
  let count = 0;
  for (const shot of ocean.fired) count += shot;
  return count;
}

export function hitsTaken(ocean: Ocean): number {
  return ocean.hits.reduce((sum, hits) => sum + hits, 0);
}

/** The ship on a cell, if any. */
export function shipAt(ocean: Ocean, index: number): ShipId | null {
  const shipIndex = ocean.occupant[index] ?? -1;
  return shipIndex < 0 ? null : (ocean.placements[shipIndex] as Placement).ship;
}
