/**
 * The numbers quoted in the prose of the Battleship post, formatted for the post's language.
 * The MDX files interpolate these instead of hard-coding results, so the text always matches the
 * figures and the table (all computed from the game's code during the build).
 */
import type { Locale } from '../../../../i18n/config.ts';
import { formatters } from '../../../../i18n/format.ts';
import { coordinateLabel } from '../../../../lib/games/battleship/rules.ts';
import { weightDigits } from './format.ts';
import {
  BOARD_SIZE,
  FLEET_ARRANGEMENTS,
  FLEET_CELLS,
  GAMES,
  HUNT_EXAMPLE,
  REPLAY_EXAMPLE,
  STRATEGIES,
  TARGET_EXAMPLE,
  cell,
  densityMap,
  knowledgeOf,
  latticeCells,
  placementCounts,
  randomExpectedShots,
  randomFinishedBy,
  replayGame,
  replayHunt,
  simulation,
  tally,
  targetWeight,
  type Strategy,
} from './model.ts';

type PerStrategy = Record<Strategy, string>;

export function postNumbers(lang: Locale) {
  const f = formatters(lang);
  const one = (x: number) => f.number(x, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const int = (x: number) => f.number(x);
  const results = simulation();
  const per = (pick: (s: (typeof results)[Strategy]) => number, format = int): PerStrategy =>
    Object.fromEntries(STRATEGIES.map((strategy) => [strategy, format(pick(results[strategy]))])) as PerStrategy;

  // The smallest n by which random fire has finished at least half of all games (exact).
  let randomMedian = FLEET_CELLS;
  while (randomFinishedBy(randomMedian) < 0.5) randomMedian++;
  const empty = densityMap(knowledgeOf({}));
  const placements = placementCounts().reduce((sum, row) => sum + row.count, 0);
  const labels = (cells: readonly number[]) => f.list(cells.map((index) => coordinateLabel(index)));

  // The hit examples: the peak's base-w digits, and E5's other neighbours after one hit.
  const oneHit = densityMap(knowledgeOf({ hits: ['E5'] }));
  const [oneNone = 0, oneThrough = 0] = weightDigits(oneHit.max, oneHit.weight);
  const otherNeighbours = [cell('E4'), cell('F5'), cell('E6'), cell('D5')].filter((c) => !oneHit.peaks.includes(c));
  const twoHits = densityMap(knowledgeOf({ hits: ['E5', 'F5'] }));
  const [twoNone = 0, twoOne = 0, twoBoth = 0] = weightDigits(twoHits.max, twoHits.weight);
  const hunt = replayHunt(HUNT_EXAMPLE.seed, HUNT_EXAMPLE.shots);
  const huntPeaks = densityMap(hunt.knowledge).peaks;
  // Two standard errors of the least precise mean: how far the simulated means may be off.
  const margin = Math.max(...STRATEGIES.map((s) => (2 * results[s].sd) / Math.sqrt(results[s].games)));

  // The parity replay: one game, with and without the lattice (ParityReplay.astro).
  const withParity = replayGame('parity', REPLAY_EXAMPLE.seed);
  const withoutParity = replayGame('no-parity', REPLAY_EXAMPLE.seed);
  const counts = (replay: typeof withParity) => {
    const t = tally(replay);
    return { shots: int(t.shots), hunt: int(t.hunt), target: int(t.target) };
  };
  const destroyerSunk = withParity.shots.findIndex((shot) => shot.sunk?.ship === 'destroyer') + 1;
  // Every ship's positions multiplied together: the fleets there would be if ships could overlap.
  const fleetsIfOverlap = placementCounts().reduce((product, row) => product * row.count, 1);
  const water = BOARD_SIZE * BOARD_SIZE - FLEET_CELLS;

  return {
    margin: one(margin),
    oneHit: {
      peaks: labels(oneHit.peaks),
      value: int(oneHit.max),
      through: int(oneThrough),
      none: int(oneNone),
      others: labels(otherNeighbours),
      othersValue: int(oneHit.density[otherNeighbours[0] ?? 0] ?? 0),
    },
    twoHits: {
      peaks: labels(twoHits.peaks),
      value: int(twoHits.max),
      both: int(twoBoth),
      one: int(twoOne),
      none: int(twoNone),
    },
    hunt: {
      seed: int(HUNT_EXAMPLE.seed),
      shots: int(HUNT_EXAMPLE.shots),
      next: int(HUNT_EXAMPLE.shots + 1),
      peaks: labels(huntPeaks),
    },
    target: { seed: int(TARGET_EXAMPLE.seed) },
    /** Share of games over within 50 shots. */
    within50: per((s) => (s.finished[50] ?? 0) / s.games, (x) => f.percent(x)),
    replay: {
      seed: int(REPLAY_EXAMPLE.seed),
      /** The shot the figure opens on. */
      start: int(REPLAY_EXAMPLE.start),
      /** The shot that sinks the destroyer in the parity game (the lattice goes from m = 2 to 3). */
      destroyerSunk: int(destroyerSunk),
      parity: counts(withParity),
      noParity: counts(withoutParity),
      /** Shots the lattice saved in this game. */
      saved: int(withoutParity.shots.length - withParity.shots.length),
    },
    games: int(GAMES),
    fleets: int(FLEET_ARRANGEMENTS),
    fleetsIfOverlap: int(fleetsIfOverlap),
    /** The share of those products that are real fleets (no two ships overlapping). */
    fleetsShare: f.percent(FLEET_ARRANGEMENTS / fleetsIfOverlap),
    placements: int(placements),
    shipCells: int(FLEET_CELLS),
    weight: int(targetWeight(placementCounts().map((row) => row.ship))),
    emptyMax: int(empty.max),
    emptyMin: int(Math.min(...empty.density)),
    lattice: { 2: int(latticeCells(2).length), 3: int(latticeCells(3).length) },
    random: {
      expected: one(randomExpectedShots()),
      median: int(randomMedian),
      within85: f.percent(randomFinishedBy(85), { maximumFractionDigits: 1 }),
      /** The average size of each of the 18 gaps the 17 ship cells cut the 83 water cells into. */
      gap: one(water / (FLEET_CELLS + 1)),
    },
    mean: per((s) => s.mean, one),
    median: per((s) => s.median),
    p90: per((s) => s.p90),
    worst: per((s) => s.max),
    best: per((s) => s.min),
    /** Shots saved on average: by the lattice, and by the density over hunt & target. */
    saved: {
      parity: one(results['no-parity'].mean - results.parity.mean),
      density: one(results.parity.mean - results.density.mean),
    },
  };
}
