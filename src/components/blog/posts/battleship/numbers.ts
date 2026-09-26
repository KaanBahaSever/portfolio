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
  FLEET_ARRANGEMENTS,
  FLEET_CELLS,
  GAMES,
  HUNT_EXAMPLE,
  STRATEGIES,
  TARGET_EXAMPLE,
  cell,
  densityMap,
  knowledgeOf,
  latticeCells,
  placementCounts,
  randomExpectedShots,
  randomFinishedBy,
  replayHunt,
  simulation,
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
    games: int(GAMES),
    fleets: int(FLEET_ARRANGEMENTS),
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
