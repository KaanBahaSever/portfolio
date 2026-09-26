/**
 * The parity replay of the Battleship post (ParityReplay.astro): the replayed games are the
 * simulation's games, the example game shows what the prose says, the frames the figure steps
 * through add up, and the numbers the prose quotes about it.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseShot, createKnowledge, recordShot, unresolvedHits } from '../src/lib/games/battleship/ai.ts';
import { allSunk, createOcean, fire } from '../src/lib/games/battleship/ocean.ts';
import { colOf, randomFleet, rowOf } from '../src/lib/games/battleship/rules.ts';
import { mulberry32 } from '../src/lib/games/random.ts';
import {
  FLEET_ARRANGEMENTS,
  REPLAY_EXAMPLE,
  STRATEGIES,
  cell,
  latticeModulus,
  modeOf,
  playGame,
  replayGame,
  tally,
} from '../src/components/blog/posts/battleship/model.ts';
import { postNumbers } from '../src/components/blog/posts/battleship/numbers.ts';
import {
  frameAt,
  frameText,
  latticeSize,
  type ReplayData,
} from '../src/components/blog/posts/battleship/parity-replay.ts';

const onLattice = (index: number, modulus: number) => (rowOf(index) + colOf(index)) % modulus === 0;

function exampleData(): ReplayData {
  const parity = replayGame('parity', REPLAY_EXAMPLE.seed);
  const noParity = replayGame('no-parity', REPLAY_EXAMPLE.seed);
  return { seed: REPLAY_EXAMPLE.seed, fleet: parity.fleet, games: { parity: parity.shots, 'no-parity': noParity.shots } };
}

test('a replay is the simulated game: same length as playGame, every strategy, several seeds', () => {
  for (const strategy of STRATEGIES) {
    const seeds = strategy === 'density' ? [1, 2, 3, REPLAY_EXAMPLE.seed] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 99, REPLAY_EXAMPLE.seed];
    for (const seed of seeds) {
      const replay = replayGame(strategy, seed);
      assert.equal(replay.shots.length, playGame(strategy, seed), `${strategy}, game ${seed}`);
      // Every ship sinks exactly once, the last shot sinks the last one, no cell is fired at twice.
      assert.equal(replay.shots.filter((shot) => shot.sunk).length, 5);
      assert.equal(replay.shots.at(-1)?.result, 'sunk');
      assert.equal(new Set(replay.shots.map((shot) => shot.index)).size, replay.shots.length);
    }
  }
});

test('replayed shots record hunt/target and the lattice as the game’s own code sees them', () => {
  for (const seed of [1, 2, 3, 4, 5, REPLAY_EXAMPLE.seed]) {
    const replay = replayGame('parity', seed);
    // Replay the same game here with the library alone and compare shot by shot.
    const ocean = createOcean(randomFleet(mulberry32(seed)));
    const knowledge = createKnowledge();
    const rng = mulberry32(seed * 7919 + 17);
    let i = 0;
    while (!allSunk(ocean)) {
      const shot = replay.shots[i];
      assert.ok(shot, `game ${seed}: the replay ends early`);
      assert.equal(shot.hunt, unresolvedHits(knowledge).length === 0);
      assert.equal(shot.hunt, modeOf(knowledge) === 'hunt');
      assert.equal(shot.modulus, latticeModulus(knowledge.remaining));
      const index = chooseShot(knowledge, 'normal', rng);
      assert.equal(shot.index, index, `game ${seed}, shot ${i + 1}`);
      const outcome = fire(ocean, index);
      assert.equal(shot.result, outcome.result);
      if (outcome.result === 'sunk') assert.deepEqual(shot.sunk, { ship: outcome.ship, cells: outcome.cells });
      else assert.equal(shot.sunk, undefined);
      recordShot(knowledge, outcome);
      i++;
    }
    assert.equal(i, replay.shots.length);
  }
});

test('the example game: 49 = 36 + 13 with parity, 59 = 43 + 16 without, the destroyer sinks with shot 22', () => {
  const parity = replayGame('parity', REPLAY_EXAMPLE.seed);
  const noParity = replayGame('no-parity', REPLAY_EXAMPLE.seed);
  assert.deepEqual(tally(parity), { shots: 49, hunt: 36, target: 13 });
  assert.deepEqual(tally(noParity), { shots: 59, hunt: 43, target: 16 });
  assert.deepEqual(parity.fleet, noParity.fleet);
  const destroyer = parity.shots.findIndex((shot) => shot.sunk?.ship === 'destroyer') + 1;
  assert.equal(destroyer, 22);
  assert.equal(REPLAY_EXAMPLE.start, destroyer - 1);
  // The checkerboard up to and including the destroyer's last shot, every third diagonal after.
  parity.shots.forEach((shot, i) => assert.equal(shot.modulus, i < destroyer ? 2 : 3, `shot ${i + 1}`));
});

test('every hunt shot of the example lands on the lattice of the shortest ship afloat', () => {
  const parity = replayGame('parity', REPLAY_EXAMPLE.seed);
  const hunts = parity.shots.filter((shot) => shot.hunt);
  assert.equal(hunts.length, 36);
  for (const shot of hunts) assert.ok(onLattice(shot.index, shot.modulus), `hunt shot at ${shot.index}`);
  // Without parity the hunt ignores the lattice: many of its hunt shots fall off it.
  const random = replayGame('no-parity', REPLAY_EXAMPLE.seed).shots.filter((shot) => shot.hunt);
  assert.ok(random.some((shot) => !onLattice(shot.index, shot.modulus)));
});

test('frames: the figure opens after shot 21 on the checkerboard, and shot 22 changes the lattice', () => {
  const data = exampleData();
  const start = frameAt(data, 'parity', REPLAY_EXAMPLE.start);
  assert.equal(start.shot, 21);
  assert.equal(start.total, 49);
  assert.equal(start.hunt + start.target, 21);
  assert.deepEqual([start.hunt, start.target], [17, 4]);
  assert.deepEqual(start.sunk, ['carrier']);
  assert.equal(start.modulus, 2);
  assert.equal(start.last?.index, cell('E7'));
  assert.equal(start.last?.hunt, true);

  const sunk = frameAt(data, 'parity', 22);
  assert.equal(sunk.last?.sunk?.ship, 'destroyer');
  assert.equal(sunk.last?.hunt, false);
  assert.equal(sunk.modulus, 3);
  assert.equal(sunk.latticeChanged, true);
  assert.equal(frameAt(data, 'parity', 23).latticeChanged, false);

  const end = frameAt(data, 'parity', 49);
  assert.deepEqual([end.hunt, end.target, end.sunk.length], [36, 13, 5]);
  assert.equal(end.modulus, 3);

  // Clamped to the game: switching games keeps the shot number when it exists.
  assert.equal(frameAt(data, 'parity', 55).shot, 49);
  assert.equal(frameAt(data, 'no-parity', 55).shot, 55);
  const before = frameAt(data, 'no-parity', -4);
  assert.equal(before.shot, 0);
  assert.equal(before.last, null);
  assert.deepEqual([before.hunt, before.target, before.sunk.length], [0, 0, 0]);
  const whole = frameAt(data, 'no-parity', 59);
  assert.deepEqual([whole.hunt, whole.target], [43, 16]);
});

test('frame text in both languages', () => {
  const data = exampleData();
  const start = frameAt(data, 'parity', REPLAY_EXAMPLE.start);
  const en = frameText(data, start, 'en');
  const tr = frameText(data, start, 'tr');
  assert.equal(en.valueText, 'Shot 21 of 49');
  assert.equal(tr.valueText, '21. atış, toplam 49');
  assert.equal(en.shot, '21 of 49');
  assert.equal(en.last, 'E7 · hit');
  assert.equal(tr.last, 'E7 · isabet');
  assert.deepEqual(en.kind, { key: 'hunt', text: 'Hunt shot' });
  assert.deepEqual(tr.kind, { key: 'hunt', text: 'Av atışı' });
  assert.deepEqual(en.lattice, { modulus: '2', cells: '50 cells' });
  assert.deepEqual(tr.lattice, { modulus: '2', cells: '50 hücre' });
  assert.deepEqual([en.hunt, en.target, en.sunk], ['17', '4', '1 of 5']);
  assert.equal(tr.sunk, '1 / 5');
  assert.match(en.board, /^Game 743, with parity: the board after shot 21 of 49\./);
  assert.match(en.board, /Carrier F2 to F6/);
  assert.match(tr.board, /^743 numaralı oyun, parite ile: tahtanın 21\. atıştan sonraki hâli/);

  const sunk = frameText(data, frameAt(data, 'parity', 22), 'tr');
  assert.equal(sunk.last, 'E6 · Muhrip battı');
  assert.equal(sunk.step, '22. atış (toplam 49): E6, Muhrip battı; hedef atışı. Desen artık m = 3.');
  assert.equal(
    frameText(data, frameAt(data, 'parity', 22), 'en').step,
    'Shot 22 of 49: E6, Destroyer sunk, target shot. The lattice is now m = 3.',
  );
  // Without parity there is no lattice to name.
  const noParity = frameText(data, frameAt(data, 'no-parity', 22), 'en');
  assert.equal(noParity.lattice, null);
  assert.doesNotMatch(noParity.step, /lattice/);
  assert.equal(frameText(data, frameAt(data, 'parity', 0), 'en').valueText, 'Before the first shot, 49 in all');
  assert.equal(latticeSize(2), 50);
  assert.equal(latticeSize(3), 34);
});

test('the numbers the prose quotes: the replay, the fleets if ships could overlap, the gaps', () => {
  const en = postNumbers('en');
  const tr = postNumbers('tr');
  assert.deepEqual(en.replay, {
    seed: '743',
    start: '21',
    destroyerSunk: '22',
    parity: { shots: '49', hunt: '36', target: '13' },
    noParity: { shots: '59', hunt: '43', target: '16' },
    saved: '10',
  });
  assert.deepEqual(tr.replay, en.replay);
  assert.equal(en.fleetsIfOverlap, '77,414,400,000');
  assert.equal(tr.fleetsIfOverlap, '77.414.400.000');
  assert.equal(120 * 140 * 160 * 160 * 180, 77_414_400_000);
  assert.ok(Math.abs(FLEET_ARRANGEMENTS / 77_414_400_000 - 0.3887) < 1e-4);
  assert.equal(en.fleetsShare, '39%');
  assert.equal(tr.fleetsShare, '%39');
  assert.equal(en.random.gap, '4.6');
  assert.equal(tr.random.gap, '4,6');
  // Unchanged neighbours.
  assert.equal(en.fleets, '30,093,975,536');
  assert.equal(tr.fleets, '30.093.975.536');
  assert.equal(en.random.expected, '95.4');
  assert.equal(tr.random.expected, '95,4');
});
