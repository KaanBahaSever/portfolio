/**
 * Battleship board geometry, the fleet and ship placement. Pure: no DOM.
 *
 * Cells are numbered row by row: index = row * size + col. The page uses a 10×10 board, but every
 * function takes the board size so tests can reason about small handcrafted boards.
 *
 * Placement rule (as in the classic paper game): a ship lies in a straight horizontal or vertical
 * line inside the board; ships may touch, but never overlap.
 */
import { pickOne, randomInt, type Rng } from '../random.ts';

export const BOARD_SIZE = 10;

export type ShipId = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';

export interface ShipSpec {
  readonly id: ShipId;
  readonly length: number;
}

/** The standard fleet: 17 cells in five ships. */
export const FLEET: readonly ShipSpec[] = [
  { id: 'carrier', length: 5 },
  { id: 'battleship', length: 4 },
  { id: 'cruiser', length: 3 },
  { id: 'submarine', length: 3 },
  { id: 'destroyer', length: 2 },
];

export type Orientation = 'horizontal' | 'vertical';

export interface Placement {
  readonly ship: ShipId;
  readonly length: number;
  /** The bow: the leftmost cell of a horizontal ship, the topmost of a vertical one. */
  readonly start: number;
  readonly orientation: Orientation;
}

/** Column letters for coordinates: A is the leftmost column. */
export const COLUMN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function rowOf(index: number, size = BOARD_SIZE): number {
  return Math.floor(index / size);
}

export function colOf(index: number, size = BOARD_SIZE): number {
  return index % size;
}

/** 'C7' for column C, row 7 (rows count from 1). Locale-neutral, like a map grid reference. */
export function coordinateLabel(index: number, size = BOARD_SIZE): string {
  return `${COLUMN_LETTERS[colOf(index, size)]}${rowOf(index, size) + 1}`;
}

/**
 * The cells a ship would cover, bow first, or null when any of them would fall off the board.
 */
export function shipCells(start: number, length: number, orientation: Orientation, size = BOARD_SIZE): number[] | null {
  if (!Number.isInteger(start) || start < 0 || start >= size * size || length < 1) return null;
  const row = rowOf(start, size);
  const col = colOf(start, size);
  if (orientation === 'horizontal' ? col + length > size : row + length > size) return null;
  const step = orientation === 'horizontal' ? 1 : size;
  return Array.from({ length }, (_, i) => start + i * step);
}

export function placementCells(placement: Placement, size = BOARD_SIZE): number[] {
  const cells = shipCells(placement.start, placement.length, placement.orientation, size);
  if (!cells) throw new RangeError(`placementCells: ${placement.ship} does not fit`);
  return cells;
}

export type PlacementCheck =
  | { ok: true; cells: number[] }
  | { ok: false; reason: 'out-of-bounds'; cells: number[] }
  | { ok: false; reason: 'overlap'; cells: number[]; conflicts: ShipId[] };

/**
 * Whether `candidate` can join `placements`. A placement of the same ship already on the board is
 * ignored, so moving a ship never collides with its old position.
 *
 * For an out-of-bounds candidate, `cells` lists only the cells that are on the board (what a
 * preview can highlight); for an overlap it lists every cell and names the ships in the way.
 */
export function checkPlacement(
  placements: readonly Placement[],
  candidate: Placement,
  size = BOARD_SIZE,
): PlacementCheck {
  const cells = shipCells(candidate.start, candidate.length, candidate.orientation, size);
  if (!cells) {
    const onBoard: number[] = [];
    const row = rowOf(candidate.start, size);
    const col = colOf(candidate.start, size);
    for (let i = 0; i < candidate.length; i++) {
      const r = candidate.orientation === 'vertical' ? row + i : row;
      const c = candidate.orientation === 'horizontal' ? col + i : col;
      if (r < size && c < size) onBoard.push(r * size + c);
    }
    return { ok: false, reason: 'out-of-bounds', cells: onBoard };
  }
  const conflicts: ShipId[] = [];
  for (const other of placements) {
    if (other.ship === candidate.ship) continue;
    const taken = placementCells(other, size);
    if (cells.some((cell) => taken.includes(cell))) conflicts.push(other.ship);
  }
  return conflicts.length > 0 ? { ok: false, reason: 'overlap', cells, conflicts } : { ok: true, cells };
}

/** True when every ship of `fleet` is placed exactly once, on the board, without overlaps. */
export function isCompleteFleet(placements: readonly Placement[], fleet: readonly ShipSpec[] = FLEET, size = BOARD_SIZE): boolean {
  if (placements.length !== fleet.length) return false;
  const seen = new Set<number>();
  for (const spec of fleet) {
    const matching = placements.filter((p) => p.ship === spec.id);
    if (matching.length !== 1) return false;
    const placement = matching[0] as Placement;
    if (placement.length !== spec.length) return false;
    const cells = shipCells(placement.start, placement.length, placement.orientation, size);
    if (!cells) return false;
    for (const cell of cells) {
      if (seen.has(cell)) return false;
      seen.add(cell);
    }
  }
  return true;
}

/** Every legal position of one ship on an empty board, as placements. */
export function allPlacements(spec: ShipSpec, size = BOARD_SIZE): Placement[] {
  const result: Placement[] = [];
  const orientations: Orientation[] = spec.length > 1 ? ['horizontal', 'vertical'] : ['horizontal'];
  for (const orientation of orientations) {
    for (let start = 0; start < size * size; start++) {
      if (shipCells(start, spec.length, orientation, size)) {
        result.push({ ship: spec.id, length: spec.length, start, orientation });
      }
    }
  }
  return result;
}

/**
 * A random legal fleet. Ships go on largest first, each at a uniformly random position among those
 * still free, so it always succeeds for a fleet that fits (a 10×10 board has plenty of room: even
 * the last ship has dozens of options). Throws if a ship has no room at all.
 */
export function randomFleet(rng: Rng, fleet: readonly ShipSpec[] = FLEET, size = BOARD_SIZE): Placement[] {
  const placed: Placement[] = [];
  const order = [...fleet].sort((a, b) => b.length - a.length);
  for (const spec of order) {
    // Try random spots first (cheap), then fall back to the full list of legal spots.
    let chosen: Placement | null = null;
    for (let attempt = 0; attempt < 50 && !chosen; attempt++) {
      const candidate: Placement = {
        ship: spec.id,
        length: spec.length,
        start: randomInt(rng, size * size),
        orientation: rng() < 0.5 ? 'horizontal' : 'vertical',
      };
      if (checkPlacement(placed, candidate, size).ok) chosen = candidate;
    }
    if (!chosen) {
      const free = allPlacements(spec, size).filter((p) => checkPlacement(placed, p, size).ok);
      if (free.length === 0) throw new Error(`randomFleet: no room for ${spec.id}`);
      chosen = pickOne(rng, free);
    }
    placed.push(chosen);
  }
  // Report the fleet in its canonical order, whatever order the ships were placed in.
  return fleet.map((spec) => placed.find((p) => p.ship === spec.id) as Placement);
}
