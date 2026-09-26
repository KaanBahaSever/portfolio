/**
 * The parity replay: one game of the Normal computer, with and without its hunting lattice, stepped
 * through shot by shot (ParityReplay.astro).
 *
 * Two halves. The pure half (frameAt, frameText) turns the recorded games into what the figure
 * shows after k shots; ParityReplay.astro renders its first state with it at build time, and the
 * browser half (initParityReplay) keeps using it, so the page reads the same before and after the
 * script runs. Module scope touches no DOM, and model.ts is imported for its types only: the games
 * are computed during the build and reach the browser as JSON inside the figure.
 *
 * Text follows the article's language (data-lang on the root), like the rest of the post.
 */
import { isLocale, type Locale } from '../../../../i18n/config.ts';
import { formatters } from '../../../../i18n/format.ts';
import { BOARD_SIZE, colOf, coordinateLabel, rowOf, type ShipId } from '../../../../lib/games/battleship/rules.ts';
import { battleshipPostMessages } from './messages.ts';
import type { ReplayShot } from './model.ts';

export const REPLAY_GAMES = ['parity', 'no-parity'] as const;
export type ReplayGame = (typeof REPLAY_GAMES)[number];

/** What the figure carries for the script: the fleet, and both games shot by shot. */
export interface ReplayData {
  seed: number;
  fleet: { ship: ShipId; cells: number[] }[];
  games: Record<ReplayGame, ReplayShot[]>;
}

/** The replay after `shot` shots of one game. */
export interface Frame {
  game: ReplayGame;
  /** Shots fired so far: 0 before the first, `total` at the end. */
  shot: number;
  total: number;
  /** The latest shot (null before the first). */
  last: ReplayShot | null;
  /** Hunt and target shots among the first `shot`. */
  hunt: number;
  target: number;
  /** Ships sunk so far, in the order they sank. */
  sunk: ShipId[];
  /**
   * The lattice the computer hunts on now: the length of the shortest ship afloat. At the end,
   * with nothing afloat, the lattice of the last shot.
   */
  modulus: number;
  /** The latest shot changed the lattice (it sank the last ship of the shortest length). */
  latticeChanged: boolean;
}

export function isReplayGame(value: unknown): value is ReplayGame {
  return value === 'parity' || value === 'no-parity';
}

export function frameAt(data: ReplayData, game: ReplayGame, shot: number): Frame {
  const shots = data.games[game];
  const total = shots.length;
  const k = Math.max(0, Math.min(total, Math.round(Number.isFinite(shot) ? shot : 0)));
  let hunt = 0;
  const sunk: ShipId[] = [];
  for (const fired of shots.slice(0, k)) {
    if (fired.hunt) hunt++;
    if (fired.sunk) sunk.push(fired.sunk.ship);
  }
  // A shot records the modulus before it, so after j shots the lattice is shot j + 1's.
  const modulusAfter = (j: number) => shots[j]?.modulus ?? shots[j - 1]?.modulus ?? 2;
  return {
    game,
    shot: k,
    total,
    last: shots[k - 1] ?? null,
    hunt,
    target: k - hunt,
    sunk,
    modulus: modulusAfter(k),
    latticeChanged: k > 0 && modulusAfter(k) !== modulusAfter(k - 1),
  };
}

/** The number of cells whose row + column is a multiple of m (50 for m = 2, 34 for m = 3). */
export function latticeSize(modulus: number, size = BOARD_SIZE): number {
  let count = 0;
  for (let index = 0; index < size * size; index++) {
    if ((rowOf(index, size) + colOf(index, size)) % modulus === 0) count++;
  }
  return count;
}

export interface FrameText {
  /** Readout: "21 of 49", the latest shot, its type, the tallies. */
  shot: string;
  last: string;
  /** null before the first shot. */
  kind: { key: 'hunt' | 'target'; text: string } | null;
  /** The lattice in use, or null without parity. */
  lattice: { modulus: string; cells: string } | null;
  hunt: string;
  target: string;
  sunk: string;
  /** The slider's aria-valuetext. */
  valueText: string;
  /** The board's accessible description. */
  board: string;
  /** What a step to this frame announces. */
  step: string;
}

export function frameText(data: ReplayData, frame: Frame, lang: Locale): FrameText {
  const m = battleshipPostMessages[lang];
  const r = m.replay;
  const f = formatters(lang);
  const n = (x: number) => f.number(x);
  const { last } = frame;
  const kindKey = last ? (last.hunt ? 'hunt' : 'target') : null;
  const result = last
    ? last.sunk
      ? r.result.sunk(m.ships[last.sunk.ship])
      : last.result === 'hit'
        ? r.result.hit
        : r.result.miss
    : '';
  const cell = last ? coordinateLabel(last.index) : '';
  const parity = frame.game === 'parity';
  const cells = latticeSize(frame.modulus);

  const step = last
    ? r.announce.step(frame.shot, frame.total, cell, result, kindKey ? r.kindInline[kindKey] : '') +
      (parity && frame.latticeChanged ? r.announce.latticeNow(frame.modulus) : '')
    : r.announce.start;

  const sunkNames = frame.sunk.map((ship) => m.ships[ship]);
  const fleet = f.list(
    data.fleet.map(({ ship, cells: shipCells }) =>
      r.board.ship(m.ships[ship], coordinateLabel(shipCells[0] ?? 0), coordinateLabel(shipCells.at(-1) ?? 0)),
    ),
  );
  const board =
    r.board.state(data.seed, r.gamesInline[frame.game], frame.shot, frame.total) +
    (parity ? r.board.lattice(frame.modulus, cells) : r.board.noLattice) +
    (last && kindKey ? r.board.last(frame.shot, cell, result, r.kindInline[kindKey]) : '') +
    r.board.counts(frame.hunt, frame.target, sunkNames.length > 0 ? f.list(sunkNames) : r.board.noneSunk) +
    r.board.fleet(fleet);

  return {
    shot: r.readout.shotValue(frame.shot, frame.total),
    last: last ? r.lastValue(cell, result) : r.readout.none,
    kind: kindKey ? { key: kindKey, text: r.kind[kindKey] } : null,
    lattice: parity ? { modulus: n(frame.modulus), cells: m.parity.cells(cells) } : null,
    hunt: n(frame.hunt),
    target: n(frame.target),
    sunk: r.readout.sunkValue(frame.sunk.length, data.fleet.length),
    valueText: r.valueText(frame.shot, frame.total),
    board,
    step,
  };
}

/* ------------------------------------------------------------------------------------------- */
/* Browser                                                                                      */

/** About three shots a second while playing. */
const PLAY_INTERVAL = 330;

function show(element: Element, visible: boolean): void {
  // SVG marks are hidden with the display attribute (the hidden attribute is HTML only).
  if (element instanceof HTMLElement) element.hidden = !visible;
  else if (visible) element.removeAttribute('display');
  else element.setAttribute('display', 'none');
}

export function initParityReplay(root: HTMLElement): void {
  if (root.dataset.ready !== undefined) return;
  const source = root.querySelector('script[data-replay-data]');
  let data: ReplayData;
  try {
    data = JSON.parse(source?.textContent ?? '') as ReplayData;
  } catch {
    return;
  }
  const lang = isLocale(root.dataset.lang) ? root.dataset.lang : 'en';
  const r = battleshipPostMessages[lang].replay;

  const q = <T extends Element>(selector: string) => root.querySelector<T>(selector);
  const board = q<HTMLElement>('[data-board]');
  const slider = q<HTMLInputElement>('input[data-slider]');
  const playButton = q<HTMLButtonElement>('[data-play]');
  const ring = q<SVGElement>('[data-latest]');
  const status = q<HTMLElement>('[data-status]');
  const latticeOn = q<HTMLElement>('[data-lattice-on]');
  const latticeOff = q<HTMLElement>('[data-lattice-off]');
  const kindSwatch = q<HTMLElement>('[data-kind-swatch]');
  if (!board || !slider || !playButton || !ring || !status || !latticeOn || !latticeOff || !kindSwatch) return;
  // Narrowed once here, so the functions below can use them without null checks.
  const ui = { board, slider, playButton, ring, status, latticeOn, latticeOff, kindSwatch };
  const out = (name: string) => q<HTMLElement>(`[data-out="${name}"]`);
  const outputs = {
    shot: out('shot'),
    last: out('last'),
    kind: out('kind'),
    modulus: out('modulus'),
    cells: out('cells'),
    hunt: out('hunt'),
    target: out('target'),
    sunk: out('sunk'),
  };
  const radios = [...root.querySelectorAll<HTMLInputElement>('input[data-game]')];
  const steps = [...root.querySelectorAll<HTMLButtonElement>('[data-step]')];
  const markers = [...root.querySelectorAll<SVGGElement>('[data-marker]')];
  const lattices = [...root.querySelectorAll<SVGGElement>('[data-lattice]')];
  const ships = [...root.querySelectorAll<SVGElement>('[data-ship]')];
  const playIcon = q<HTMLElement>('[data-icon="play"]');
  const pauseIcon = q<HTMLElement>('[data-icon="pause"]');

  // Start where the page was rendered (the browser may have restored other control values).
  let game: ReplayGame = isReplayGame(root.dataset.game) ? root.dataset.game : 'parity';
  let shot = Number(root.dataset.shot ?? 0);
  let timer = 0;
  root.dataset.ready = '';

  function render(): { frame: Frame; text: FrameText } {
    const frame = frameAt(data, game, shot);
    shot = frame.shot;
    const text = frameText(data, frame, lang);
    root.dataset.game = game;
    root.dataset.shot = String(shot);

    // The board: the lattice in use, the shots so far, the ships sunk, a ring on the latest shot.
    for (const layer of lattices) show(layer, game === 'parity' && Number(layer.dataset.lattice) === frame.modulus);
    let latest: SVGGElement | undefined;
    for (const marker of markers) {
      const own = marker.dataset.game === game;
      const n = Number(marker.dataset.shot);
      show(marker, own && n <= shot);
      if (own && n === shot) latest = marker;
    }
    const sunk = new Set(frame.sunk);
    for (const ship of ships) ship.classList.toggle('is-sunk', sunk.has(ship.dataset.ship as ShipId));
    const dot = latest?.querySelector('circle');
    if (dot) {
      ui.ring.setAttribute('cx', dot.getAttribute('cx') ?? '0');
      ui.ring.setAttribute('cy', dot.getAttribute('cy') ?? '0');
    }
    show(ui.ring, Boolean(dot));
    ui.board.setAttribute('aria-label', text.board);

    // The readout.
    const write = (element: HTMLElement | null, value: string) => {
      if (element && element.textContent !== value) element.textContent = value;
    };
    write(outputs.shot, text.shot);
    write(outputs.last, text.last);
    write(outputs.kind, text.kind?.text ?? '—');
    if (text.kind) ui.kindSwatch.dataset.kind = text.kind.key;
    show(ui.kindSwatch, Boolean(text.kind));
    show(ui.latticeOn, Boolean(text.lattice));
    show(ui.latticeOff, !text.lattice);
    if (text.lattice) {
      write(outputs.modulus, text.lattice.modulus);
      write(outputs.cells, text.lattice.cells);
    }
    write(outputs.hunt, text.hunt);
    write(outputs.target, text.target);
    write(outputs.sunk, text.sunk);

    // The controls.
    ui.slider.max = String(frame.total);
    ui.slider.value = String(shot);
    ui.slider.setAttribute('aria-valuetext', text.valueText);
    for (const button of steps) {
      const back = button.dataset.step === 'first' || button.dataset.step === 'previous';
      button.setAttribute('aria-disabled', String(back ? shot === 0 : shot === frame.total));
    }
    for (const radio of radios) radio.checked = radio.value === game;
    return { frame, text };
  }

  let pending = 0;
  function announce(text: string, delay = 60): void {
    // Clear first, then write after a short pause, so the same sentence twice in a row is still
    // read out; a newer announcement replaces one that has not been written yet (a slider drag
    // only announces where it stops).
    ui.status.textContent = '';
    window.clearTimeout(pending);
    pending = window.setTimeout(() => {
      ui.status.textContent = text;
    }, delay);
  }

  function setPlaying(playing: boolean): void {
    const label = playing ? r.pause : r.play;
    ui.playButton.setAttribute('aria-label', label);
    ui.playButton.title = label;
    if (playIcon) playIcon.hidden = playing;
    if (pauseIcon) pauseIcon.hidden = !playing;
  }

  /** Stops autoplay; returns whether it was running. */
  function stop(): boolean {
    if (timer === 0) return false;
    window.clearInterval(timer);
    timer = 0;
    setPlaying(false);
    return true;
  }

  /** A manual move: stop playing, go to `next`, and say where the replay is. */
  function goTo(next: number, delay?: number): void {
    stop();
    shot = next;
    announce(render().text.step, delay);
  }

  function play(): void {
    if (timer !== 0) return;
    if (shot >= data.games[game].length) {
      shot = 0;
      render();
    }
    setPlaying(true);
    // Autoplay frames are not announced: only where playback pauses or ends.
    timer = window.setInterval(() => {
      shot++;
      const { frame } = render();
      if (frame.shot >= frame.total) {
        stop();
        announce(r.announce.ended(frame.total, frame.hunt, frame.target));
      }
    }, PLAY_INTERVAL);
  }

  for (const button of steps) {
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-disabled') === 'true') return;
      const targets: Record<string, number> = { first: 0, previous: shot - 1, next: shot + 1, last: data.games[game].length };
      const target = targets[button.dataset.step ?? ''];
      if (target !== undefined) goTo(target);
    });
  }

  ui.playButton.addEventListener('click', () => {
    if (stop()) announce(r.announce.paused(frameText(data, frameAt(data, game, shot), lang).step));
    else play();
  });

  // A drag fires many input events: announce only once it settles.
  ui.slider.addEventListener('input', () => goTo(Number(ui.slider.value), 400));

  for (const radio of radios) {
    radio.addEventListener('change', () => {
      if (!radio.checked || !isReplayGame(radio.value)) return;
      stop();
      // Same shot number in the other game, clamped to its length (render does the clamping).
      game = radio.value;
      announce(`${r.games[game]}. ${render().text.step}`);
    });
  }

  // Hand the controls over: until now they were disabled (and hidden when scripting is off).
  for (const control of root.querySelectorAll<HTMLInputElement | HTMLButtonElement>('[data-control]')) {
    control.disabled = false;
  }
  setPlaying(false);
  render();
}
