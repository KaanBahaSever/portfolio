/**
 * Battleship: DOM wiring (browser only). Game rules and the computer's aim live in
 * src/lib/games/battleship/*; this file keeps one game's state in a closure per root element (no
 * module-level state, so two boards could share a page) and renders it through data attributes
 * that src/components/games/BattleshipBoard.astro styles.
 *
 * Accessibility: each board is an ARIA grid with a roving tabindex (one Tab stop, arrow keys to
 * move); every cell button's label says its coordinate and state. Setup feedback goes to a status
 * region, battle events to a visible log region (role="log"), so each shot is read exactly once.
 */
import { battleshipMessages } from '../../../i18n/games/battleship.ts';
import { getPageLocale } from '../../../i18n/client.ts';
import { formatters } from '../../../i18n/format.ts';
import { moveInGrid } from '../../../lib/games/grid.ts';
import { isRotateKey, isTypingTarget } from '../../../lib/games/keys.ts';
import { mulberry32, randomSeed } from '../../../lib/games/random.ts';
import {
  DIFFICULTIES,
  chooseShot,
  createKnowledge,
  densityPeaks,
  probabilityDensity,
  recordShot,
  type Difficulty,
  type Knowledge,
} from '../../../lib/games/battleship/ai.ts';
import {
  allSunk,
  createOcean,
  fire,
  hitsTaken,
  isSunk,
  shipAt,
  shotsFired,
  type Ocean,
  type ShotOutcome,
} from '../../../lib/games/battleship/ocean.ts';
import {
  BOARD_SIZE,
  FLEET,
  checkPlacement,
  colOf,
  coordinateLabel,
  isCompleteFleet,
  placementCells,
  randomFleet,
  rowOf,
  type Orientation,
  type Placement,
  type PlacementCheck,
  type ShipId,
} from '../../../lib/games/battleship/rules.ts';

type Phase = 'setup' | 'battle' | 'over';
type Side = 'own' | 'enemy';
type ShipStatus = 'afloat' | 'sunk' | 'revealed';

/** Pause before the computer fires, so its shot reads as a separate turn. */
const COMPUTER_DELAY_MS = 650;
/** Pause between the last shot and the result dialog, so the final hit is seen first. */
const RESULT_DELAY_MS = 700;
/** Lines kept in the visible battle log. */
const LOG_LIMIT = 6;
/** Density peaks listed by name before the rest are summarised as "n more". */
const PEAKS_LISTED = 3;

interface BoardElements {
  grid: HTMLElement;
  cells: HTMLButtonElement[];
  ships: Map<ShipId, HTMLElement>;
}

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Battleship: missing element ${selector}`);
  return element;
}

function getBoard(root: HTMLElement, side: Side): BoardElements {
  const board = query<HTMLElement>(root, `[data-board="${side}"]`);
  const cells = Array.from(board.querySelectorAll<HTMLButtonElement>('[data-cell]'));
  if (cells.length !== BOARD_SIZE * BOARD_SIZE) throw new Error(`Battleship: ${side} board needs 100 cells`);
  const ships = new Map<ShipId, HTMLElement>();
  board.querySelectorAll<HTMLElement>('[data-ship-shape]').forEach((shape) => {
    ships.set(shape.dataset.shipShape as ShipId, shape);
  });
  return { grid: query<HTMLElement>(board, '[data-grid]'), cells, ships };
}

/** Sets (string) or removes (null) a data attribute, touching the DOM only on a change. */
function setData(element: HTMLElement, name: string, value: string | null): void {
  if (value === null) {
    if (name in element.dataset) delete element.dataset[name];
  } else if (element.dataset[name] !== value) {
    element.dataset[name] = value;
  }
}

function setAttr(element: Element, name: string, value: string | null): void {
  if (value === null) element.removeAttribute(name);
  else if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

function setText(element: Element, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}

function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTIES as readonly string[]).includes(value);
}

export function initBattleship(root: HTMLElement): void {
  if (root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const locale = getPageLocale();
  const m = battleshipMessages[locale];
  const format = formatters(locale);
  const rng = mulberry32(randomSeed());

  const el = {
    phaseLabel: query<HTMLElement>(root, '[data-phase-label]'),
    turnStatus: query<HTMLElement>(root, '[data-turn-status]'),
    lastEvent: query<HTMLElement>(root, '[data-last-event]'),
    newGame: query<HTMLButtonElement>(root, '[data-new-game]'),
    enemyPanel: query<HTMLElement>(root, '[data-enemy-panel]'),
    setupPanel: query<HTMLElement>(root, '[data-setup-panel]'),
    battlePanel: query<HTMLElement>(root, '[data-battle-panel]'),
    ownHelp: query<HTMLElement>(root, '[data-own-help]'),
    preview: query<HTMLElement>(root, '[data-preview]'),
    heatPanel: query<HTMLElement>(root, '[data-heat-panel]'),
    heatToggle: query<HTMLInputElement>(root, '[data-heat-toggle]'),
    heatDetails: query<HTMLElement>(root, '[data-heat-details]'),
    heatPeaks: query<HTMLElement>(root, '[data-heat-peaks]'),
    ownFleet: query<HTMLElement>(root, '[data-own-fleet]'),
    ownFleetList: query<HTMLElement>(root, '[data-fleet-status="own"]'),
    enemyFleetList: query<HTMLElement>(root, '[data-fleet-status="enemy"]'),
    difficulties: Array.from(root.querySelectorAll<HTMLInputElement>('[data-difficulty]')),
    difficultyHint: query<HTMLElement>(root, '[data-difficulty-hint]'),
    shipChoices: Array.from(root.querySelectorAll<HTMLInputElement>('[data-ship-choice]')),
    rotate: query<HTMLButtonElement>(root, '[data-rotate]'),
    orientationLabel: query<HTMLElement>(root, '[data-orientation-label]'),
    randomize: query<HTMLButtonElement>(root, '[data-randomize]'),
    clear: query<HTMLButtonElement>(root, '[data-clear]'),
    start: query<HTMLButtonElement>(root, '[data-start]'),
    startHint: query<HTMLElement>(root, '[data-start-hint]'),
    log: query<HTMLElement>(root, '[data-log]'),
    announcer: query<HTMLElement>(root, '[data-announcer]'),
    dialog: query<HTMLDialogElement>(root, '[data-result]'),
    resultTitle: query<HTMLElement>(root, '[data-result-title]'),
    resultSummary: query<HTMLElement>(root, '[data-result-summary]'),
  };
  const boards: Record<Side, BoardElements> = { own: getBoard(root, 'own'), enemy: getBoard(root, 'enemy') };

  // ---------------------------------------------------------------- state

  let phase: Phase = 'setup';
  let difficulty: Difficulty = readDifficulty();
  /** The player's fleet as placed during setup (kept for the next game). */
  let placements: Placement[] = [];
  let selected: ShipId | null = readSelectedShip();
  let orientation: Orientation = 'horizontal';
  /** Cell under the pointer on the player's board during setup (drives the preview). */
  let hover: number | null = null;
  /** Whether keyboard focus is inside the player's board (the cursor then drives the preview). */
  let ownFocused = false;
  const cursor: Record<Side, number> = { own: 0, enemy: 0 };
  /** The player's waters: the computer fires here. */
  let playerOcean: Ocean | null = null;
  /** The computer's waters: the player fires here. */
  let enemyOcean: Ocean | null = null;
  /** What the computer knows about the player's waters. */
  let knowledge: Knowledge = createKnowledge();
  let turn: 'player' | 'computer' = 'player';
  const lastShot: Record<Side, number | null> = { own: null, enemy: null };
  let heatOn = el.heatToggle.checked;
  let computerTimer = 0;
  let resultTimer = 0;
  let announceTimer = 0;
  /** The last two battle log lines, mirrored next to the boards. */
  let recent: string[] = [];

  function readDifficulty(): Difficulty {
    const value = el.difficulties.find((input) => input.checked)?.value ?? '';
    return isDifficulty(value) ? value : 'hard';
  }

  function readSelectedShip(): ShipId | null {
    const value = el.shipChoices.find((input) => input.checked)?.value;
    return FLEET.some((ship) => ship.id === value) ? (value as ShipId) : null;
  }

  // ---------------------------------------------------------------- helpers

  function shipName(ship: ShipId): string {
    return m.ships[ship].name;
  }

  function candidateAt(ship: ShipId, start: number): Placement {
    const length = FLEET.find((spec) => spec.id === ship)?.length ?? 0;
    return { ship, length, start, orientation };
  }

  /** Which of the player's ships covers each cell (from the setup placements). */
  function ownOccupancy(): (ShipId | null)[] {
    const cells: (ShipId | null)[] = new Array<ShipId | null>(BOARD_SIZE * BOARD_SIZE).fill(null);
    for (const placement of placements) {
      for (const cell of placementCells(placement)) cells[cell] = placement.ship;
    }
    return cells;
  }

  function firstUnplaced(): ShipId | null {
    return FLEET.find((spec) => !placements.some((p) => p.ship === spec.id))?.id ?? null;
  }

  function announce(message: string): void {
    window.clearTimeout(announceTimer);
    el.announcer.textContent = '';
    // Re-setting after a tick makes screen readers repeat identical messages.
    announceTimer = window.setTimeout(() => {
      el.announcer.textContent = message;
    }, 50);
  }

  function log(message: string): void {
    recent = [...recent, message].slice(-2);
    setText(el.lastEvent, recent.join('\n'));
    const item = document.createElement('li');
    item.textContent = message;
    el.log.prepend(item);
    while (el.log.children.length > LOG_LIMIT) el.log.lastElementChild?.remove();
  }

  function clearTimers(): void {
    window.clearTimeout(computerTimer);
    window.clearTimeout(resultTimer);
  }

  /** The anchor cell of the setup preview: the hovered cell, else the keyboard cursor. */
  function previewAnchor(): number | null {
    if (phase !== 'setup') return null;
    if (hover !== null) return hover;
    return ownFocused ? cursor.own : null;
  }

  interface Preview {
    anchor: number;
    /** Another ship sits on the anchor: activating the cell selects it instead of placing. */
    pickUp: ShipId | null;
    check: PlacementCheck | null;
  }

  function currentPreview(occupancy: readonly (ShipId | null)[]): Preview | null {
    const anchor = previewAnchor();
    if (anchor === null) return null;
    const occupant = occupancy[anchor] ?? null;
    if (occupant && occupant !== selected) return { anchor, pickUp: occupant, check: null };
    if (!selected) return { anchor, pickUp: null, check: null };
    return { anchor, pickUp: null, check: checkPlacement(placements, candidateAt(selected, anchor)) };
  }

  function placementMessage(ship: ShipId, check: PlacementCheck, anchor: number): string {
    const from = coordinateLabel(anchor);
    if (check.ok) {
      return m.status.fits(shipName(ship), from, coordinateLabel(check.cells[check.cells.length - 1] ?? anchor));
    }
    if (check.reason === 'out-of-bounds') return m.status.offBoard(shipName(ship), from);
    return m.status.overlaps(shipName(ship), from, format.list(check.conflicts.map(shipName)));
  }

  function previewText(preview: Preview | null): string {
    if (preview?.pickUp) return m.status.pickUp(shipName(preview.pickUp));
    if (preview?.check && selected) return placementMessage(selected, preview.check, preview.anchor);
    if (selected) return m.status.selected(shipName(selected), orientation);
    return isCompleteFleet(placements) ? m.status.allPlaced : m.setup.startHint;
  }

  // ---------------------------------------------------------------- rendering

  function renderShips(board: BoardElements, list: readonly Placement[], status: (ship: ShipId) => ShipStatus | null): void {
    for (const [ship, shape] of board.ships) {
      const placement = list.find((p) => p.ship === ship);
      const shipStatus = placement ? status(ship) : null;
      if (!placement || !shipStatus) {
        shape.hidden = true;
        continue;
      }
      const horizontal = placement.orientation === 'horizontal';
      const cell = 100 / BOARD_SIZE;
      shape.style.left = `${colOf(placement.start) * cell}%`;
      shape.style.top = `${rowOf(placement.start) * cell}%`;
      shape.style.width = `${(horizontal ? placement.length : 1) * cell}%`;
      shape.style.height = `${(horizontal ? 1 : placement.length) * cell}%`;
      setData(shape, 'status', shipStatus);
      setData(shape, 'selected', phase === 'setup' && ship === selected ? '' : null);
      shape.hidden = false;
    }
  }

  function ownCellLabel(index: number, occupancy: readonly (ShipId | null)[]): string {
    const coordinate = coordinateLabel(index);
    const ship = occupancy[index] ?? null;
    const fired = playerOcean?.fired[index] === 1;
    if (!ship) return m.cell.label(coordinate, fired ? m.cell.miss : m.cell.empty);
    if (!fired || !playerOcean) return m.cell.label(coordinate, shipName(ship));
    return m.cell.label(coordinate, shipName(ship), isSunk(playerOcean, ship) ? m.cell.sunk : m.cell.hit);
  }

  function renderOwnBoard(occupancy: readonly (ShipId | null)[], density: Float64Array | null, peaks: ReadonlySet<number>): void {
    const board = boards.own;
    const preview = currentPreview(occupancy);
    const previewCells = new Set(preview?.check?.cells ?? []);
    const previewState = preview?.check?.ok ? 'valid' : 'invalid';
    const max = density ? Math.max(...density) : 0;

    board.cells.forEach((cell, index) => {
      let state: string | null = null;
      if (playerOcean?.fired[index]) {
        const ship = shipAt(playerOcean, index);
        state = ship ? (isSunk(playerOcean, ship) ? 'sunk' : 'hit') : 'miss';
      }
      setData(cell, 'state', state);
      setData(cell, 'preview', previewCells.has(index) ? previewState : null);
      setData(cell, 'last', lastShot.own === index ? '' : null);
      setData(cell, 'peak', peaks.has(index) ? '' : null);
      // Linear in the density: in target mode the weights make every cell away from the wounded
      // ship fade out, which is exactly where the computer's attention is.
      const heat = density && max > 0 ? (density[index] ?? 0) / max : 0;
      cell.style.setProperty('--heat', heat.toFixed(3));
      setAttr(cell, 'aria-label', ownCellLabel(index, occupancy));
    });

    setData(board.grid, 'placing', phase === 'setup' ? '' : null);
    setData(board.grid, 'heat', density ? '' : null);
    setAttr(board.grid, 'aria-readonly', phase === 'setup' ? null : 'true');
    renderShips(board, placements, (ship) => {
      if (phase === 'setup' || !playerOcean) return 'afloat';
      return isSunk(playerOcean, ship) ? 'sunk' : 'afloat';
    });
  }

  function enemyCellLabel(index: number): string {
    const coordinate = coordinateLabel(index);
    if (!enemyOcean) return m.cell.label(coordinate, m.cell.unknown);
    const ship = shipAt(enemyOcean, index);
    if (!enemyOcean.fired[index]) {
      return phase === 'over' && ship
        ? m.cell.label(coordinate, shipName(ship))
        : m.cell.label(coordinate, m.cell.unknown);
    }
    if (!ship) return m.cell.label(coordinate, m.cell.miss);
    return isSunk(enemyOcean, ship)
      ? m.cell.label(coordinate, shipName(ship), m.cell.sunk)
      : m.cell.label(coordinate, m.cell.hit);
  }

  function renderEnemyBoard(): void {
    const board = boards.enemy;
    board.cells.forEach((cell, index) => {
      let state: string | null = null;
      if (enemyOcean?.fired[index]) {
        const ship = shipAt(enemyOcean, index);
        state = ship ? (isSunk(enemyOcean, ship) ? 'sunk' : 'hit') : 'miss';
      }
      setData(cell, 'state', state);
      setData(cell, 'last', lastShot.enemy === index ? '' : null);
      setAttr(cell, 'aria-disabled', state ? 'true' : null);
      setAttr(cell, 'aria-label', enemyCellLabel(index));
    });
    setData(board.grid, 'armed', phase === 'battle' && turn === 'player' ? '' : null);
    renderShips(board, enemyOcean?.placements ?? [], (ship) => {
      if (!enemyOcean) return null;
      if (isSunk(enemyOcean, ship)) return 'sunk';
      return phase === 'over' ? 'revealed' : null;
    });
  }

  function renderFleetStatus(list: HTMLElement, ocean: Ocean | null, showHits: boolean): void {
    list.querySelectorAll<HTMLElement>('[data-ship-row]').forEach((row) => {
      const ship = row.dataset.shipRow as ShipId;
      const shipIndex = ocean ? ocean.placements.findIndex((p) => p.ship === ship) : -1;
      const hits = ocean && shipIndex >= 0 ? (ocean.hits[shipIndex] ?? 0) : 0;
      const sunk = ocean ? isSunk(ocean, ship) : false;
      setData(row, 'sunk', sunk ? '' : null);
      row.querySelectorAll<HTMLElement>('[data-pip]').forEach((pip, i) => {
        setData(pip, 'on', sunk || (showHits && i < hits) ? '' : null);
      });
      let state = m.battle.shipAfloat;
      if (sunk) state = m.battle.shipSunk;
      else if (showHits && hits > 0) state = `${m.battle.shipAfloat}, ${m.battle.hitsTaken(hits)}`;
      setText(query(row, '[data-ship-state]'), state);
    });
  }

  function afloat(ocean: Ocean | null): number {
    return ocean ? FLEET.filter((spec) => !isSunk(ocean, spec.id)).length : FLEET.length;
  }

  function accuracy(hits: number, shots: number): string {
    return shots > 0 ? format.percent(hits / shots) : '–';
  }

  function renderStats(): void {
    const rows = {
      player: { ocean: enemyOcean, afloat: afloat(playerOcean) },
      computer: { ocean: playerOcean, afloat: afloat(enemyOcean) },
    };
    for (const [who, { ocean, afloat: shipsAfloat }] of Object.entries(rows)) {
      const shots = ocean ? shotsFired(ocean) : 0;
      const hits = ocean ? hitsTaken(ocean) : 0;
      setText(query(root, `[data-stat="${who}-shots"]`), format.number(shots));
      setText(query(root, `[data-stat="${who}-hits"]`), format.number(hits));
      setText(query(root, `[data-stat="${who}-accuracy"]`), accuracy(hits, shots));
      setText(query(root, `[data-stat="${who}-afloat"]`), format.number(shipsAfloat));
    }
  }

  function renderHeatText(peaks: readonly number[]): void {
    el.heatDetails.hidden = !heatOn;
    if (!heatOn || peaks.length === 0) {
      setText(el.heatPeaks, '');
      return;
    }
    const names = peaks.map((cell) => coordinateLabel(cell));
    const shown =
      names.length <= PEAKS_LISTED + 1
        ? names
        : [...names.slice(0, PEAKS_LISTED), m.heat.more(names.length - PEAKS_LISTED)];
    setText(el.heatPeaks, m.heat.peaks(format.list(shown), names.length));
  }

  function renderSetup(occupancy: readonly (ShipId | null)[]): void {
    for (const input of el.shipChoices) {
      const ship = input.value as ShipId;
      input.checked = ship === selected;
      const placed = placements.some((p) => p.ship === ship);
      const label = input.closest('label')?.querySelector<HTMLElement>('[data-placed-label]');
      if (label) {
        setText(label, placed ? m.setup.placed : m.setup.notPlaced);
        setData(label, 'placed', placed ? '' : null);
      }
    }
    for (const input of el.difficulties) input.checked = input.value === difficulty;
    setText(el.difficultyHint, m.setup.difficultyHints[difficulty]);
    setText(el.orientationLabel, m.setup.orientations[orientation]);
    const complete = isCompleteFleet(placements);
    setAttr(el.start, 'aria-disabled', complete ? 'false' : 'true');
    setText(el.startHint, complete ? m.setup.ready : m.setup.startHint);
    setText(el.preview, previewText(currentPreview(occupancy)));
  }

  function render(): void {
    const occupancy = ownOccupancy();
    const showHeat = phase !== 'setup' && heatOn;
    const density = showHeat ? probabilityDensity(knowledge) : null;
    // Once every ship is sunk there is nothing left to aim at.
    const peakList = density && knowledge.remaining.length > 0 ? densityPeaks(knowledge, density) : [];

    root.dataset.phase = phase;
    setText(el.phaseLabel, m.phases[phase]);
    setText(el.turnStatus, phase === 'battle' ? (turn === 'player' ? m.battle.yourTurn : m.battle.computerTurn) : '');
    el.enemyPanel.hidden = phase === 'setup';
    el.setupPanel.hidden = phase !== 'setup';
    el.battlePanel.hidden = phase === 'setup';
    el.heatPanel.hidden = phase === 'setup';
    el.ownFleet.hidden = phase === 'setup';
    el.newGame.hidden = phase === 'setup';
    el.preview.hidden = phase !== 'setup';
    el.lastEvent.hidden = phase === 'setup';
    setText(el.ownHelp, phase === 'setup' ? m.boards.help.setup : m.boards.help.own);

    renderOwnBoard(occupancy, density, new Set(peakList));
    renderEnemyBoard();
    if (phase === 'setup') {
      renderSetup(occupancy);
    } else {
      renderStats();
      renderFleetStatus(el.ownFleetList, playerOcean, true);
      renderFleetStatus(el.enemyFleetList, enemyOcean, false);
      renderHeatText(peakList);
    }
  }

  // ---------------------------------------------------------------- focus

  function setCursor(side: Side, index: number): void {
    const board = boards[side];
    const previous = board.cells[cursor[side]];
    if (previous && cursor[side] !== index) previous.tabIndex = -1;
    cursor[side] = index;
    const next = board.cells[index];
    if (next) next.tabIndex = 0;
  }

  function focusCell(side: Side, index: number): void {
    setCursor(side, index);
    boards[side].cells[index]?.focus();
  }

  // ---------------------------------------------------------------- setup

  function selectShip(ship: ShipId | null, speak: boolean): void {
    selected = ship;
    render();
    if (speak && ship) announce(m.status.selected(shipName(ship), orientation));
  }

  function placeAt(index: number): void {
    const occupancy = ownOccupancy();
    const occupant = occupancy[index] ?? null;
    // Activating another ship picks it up (selects it) so it can be moved.
    if (occupant && occupant !== selected) {
      selectShip(occupant, true);
      return;
    }
    if (!selected) {
      announce(m.status.noShipSelected);
      return;
    }
    const ship = selected;
    const candidate = candidateAt(ship, index);
    const check = checkPlacement(placements, candidate);
    if (!check.ok) {
      announce(placementMessage(ship, check, index));
      return;
    }
    placements = [...placements.filter((p) => p.ship !== ship), candidate];
    selected = firstUnplaced();
    hover = null;
    render();
    const placed = m.status.placed(
      shipName(ship),
      coordinateLabel(check.cells[0] ?? index),
      coordinateLabel(check.cells[check.cells.length - 1] ?? index),
    );
    const next = selected ? m.status.selected(shipName(selected), orientation) : m.status.allPlaced;
    announce(`${placed} ${next}`);
  }

  function rotate(): void {
    orientation = orientation === 'horizontal' ? 'vertical' : 'horizontal';
    render();
    const preview = currentPreview(ownOccupancy());
    announce(preview?.check ? `${m.status.rotated(orientation)} ${previewText(preview)}` : m.status.rotated(orientation));
  }

  // ---------------------------------------------------------------- battle

  function startBattle(): void {
    if (!isCompleteFleet(placements)) {
      announce(m.status.needFleet);
      return;
    }
    clearTimers();
    playerOcean = createOcean(placements);
    enemyOcean = createOcean(randomFleet(rng));
    knowledge = createKnowledge();
    phase = 'battle';
    turn = 'player';
    lastShot.own = null;
    lastShot.enemy = null;
    hover = null;
    el.log.replaceChildren();
    recent = [];
    setText(el.lastEvent, '');
    render();
    focusCell('enemy', cursor.enemy);
    log(m.battle.started(m.setup.difficulties[difficulty]));
  }

  function shotMessage(outcome: ShotOutcome, byPlayer: boolean): string {
    const coordinate = coordinateLabel(outcome.index);
    const texts = byPlayer ? m.battle.playerShot : m.battle.computerShot;
    switch (outcome.result) {
      case 'miss':
        return texts.miss(coordinate);
      case 'hit':
        return texts.hit(coordinate);
      case 'sunk':
        return texts.sunk(coordinate, byPlayer ? m.ships[outcome.ship].youSankMine : m.ships[outcome.ship].yoursSunk);
      case 'repeat':
        return m.battle.repeat(coordinate);
    }
  }

  function playerFires(index: number): void {
    if (phase !== 'battle' || !enemyOcean) return;
    if (turn !== 'player') {
      announce(m.battle.wait);
      return;
    }
    const outcome = fire(enemyOcean, index);
    if (outcome.result === 'repeat') {
      announce(shotMessage(outcome, true));
      return;
    }
    lastShot.enemy = index;
    log(shotMessage(outcome, true));
    if (allSunk(enemyOcean)) {
      endGame('player');
      return;
    }
    turn = 'computer';
    render();
    computerTimer = window.setTimeout(computerFires, COMPUTER_DELAY_MS);
  }

  function computerFires(): void {
    if (phase !== 'battle' || !playerOcean) return;
    const index = chooseShot(knowledge, difficulty, rng);
    const outcome = fire(playerOcean, index);
    recordShot(knowledge, outcome);
    lastShot.own = index;
    log(shotMessage(outcome, false));
    if (allSunk(playerOcean)) {
      endGame('computer');
      return;
    }
    turn = 'player';
    render();
  }

  function endGame(winner: 'player' | 'computer'): void {
    phase = 'over';
    render();
    resultTimer = window.setTimeout(() => showResult(winner), RESULT_DELAY_MS);
  }

  function showResult(winner: 'player' | 'computer'): void {
    if (phase !== 'over' || !enemyOcean || !playerOcean) return;
    const shots = shotsFired(enemyOcean);
    const hits = hitsTaken(enemyOcean);
    setText(el.resultTitle, winner === 'player' ? m.result.win : m.result.loss);
    setText(
      el.resultSummary,
      winner === 'player' ? m.result.winSummary(shots) : m.result.lossSummary(shotsFired(playerOcean)),
    );
    setText(query(el.dialog, '[data-result-stat="shots"]'), format.number(shots));
    setText(query(el.dialog, '[data-result-stat="hits"]'), format.number(hits));
    setText(query(el.dialog, '[data-result-stat="accuracy"]'), accuracy(hits, shots));
    if (!el.dialog.open) el.dialog.showModal();
  }

  /** Back to setup, keeping the player's fleet where it was. */
  function newGame(): void {
    clearTimers();
    if (el.dialog.open) el.dialog.close();
    phase = 'setup';
    playerOcean = null;
    enemyOcean = null;
    knowledge = createKnowledge();
    turn = 'player';
    lastShot.own = null;
    lastShot.enemy = null;
    hover = null;
    selected = firstUnplaced();
    el.log.replaceChildren();
    recent = [];
    setText(el.lastEvent, '');
    render();
    if (isCompleteFleet(placements)) el.start.focus();
    else focusCell('own', cursor.own);
    announce(m.status.newGame);
  }

  // ---------------------------------------------------------------- events

  function wireGrid(side: Side, activate: (index: number) => void): void {
    const board = boards[side];
    const cellOf = (target: EventTarget | null): number | null => {
      if (!(target instanceof Element)) return null;
      const cell = target.closest<HTMLElement>('[data-cell]');
      return cell && board.grid.contains(cell) ? Number(cell.dataset.cell) : null;
    };

    board.grid.addEventListener('keydown', (event) => {
      // Alt+arrows are browser history shortcuts.
      if (event.altKey) return;
      const index = cellOf(event.target);
      if (index === null) return;
      const next = moveInGrid(index, event, BOARD_SIZE, BOARD_SIZE);
      if (next === null) return;
      event.preventDefault();
      // The keyboard now leads: a pointer resting on the board must not pin the preview.
      hover = null;
      focusCell(side, next);
    });

    board.grid.addEventListener('click', (event) => {
      const index = cellOf(event.target);
      if (index === null) return;
      setCursor(side, index);
      // Safari and Firefox on macOS do not focus a button on click. Focusing the cell here keeps
      // focus in the game in every browser, so R and the arrow keys carry on from the clicked cell.
      // (A no-op where the click already focused it, and for Enter/Space, which click it too.)
      boards[side].cells[index]?.focus({ preventScroll: true });
      activate(index);
    });

    board.grid.addEventListener('focusin', (event) => {
      const index = cellOf(event.target);
      if (index === null) return;
      setCursor(side, index);
      if (side === 'own' && phase === 'setup') {
        ownFocused = true;
        render();
        announce(el.preview.textContent ?? '');
      }
    });

    board.grid.addEventListener('focusout', (event) => {
      if (side !== 'own' || board.grid.contains(event.relatedTarget as Node | null)) return;
      ownFocused = false;
      if (phase === 'setup') render();
    });
  }

  wireGrid('own', (index) => {
    if (phase === 'setup') placeAt(index);
  });
  wireGrid('enemy', playerFires);

  // Placement preview under the pointer.
  boards.own.grid.addEventListener('pointerover', (event) => {
    if (phase !== 'setup' || !(event.target instanceof Element)) return;
    const cell = event.target.closest<HTMLElement>('[data-cell]');
    if (!cell) return;
    const index = Number(cell.dataset.cell);
    if (hover === index) return;
    hover = index;
    render();
  });
  boards.own.grid.addEventListener('pointerleave', () => {
    if (hover === null) return;
    hover = null;
    if (phase === 'setup') render();
  });

  for (const input of el.shipChoices) {
    input.addEventListener('change', () => {
      if (input.checked) selectShip(input.value as ShipId, false);
    });
  }

  for (const input of el.difficulties) {
    input.addEventListener('change', () => {
      if (!input.checked || !isDifficulty(input.value)) return;
      difficulty = input.value;
      render();
    });
  }

  el.rotate.addEventListener('click', rotate);

  function onRotateKey(event: KeyboardEvent): void {
    if (phase !== 'setup' || !isRotateKey(event)) return;
    event.preventDefault();
    rotate();
  }

  // R rotates during setup, wherever focus is inside the game (no text fields here to type into).
  root.addEventListener('keydown', onRotateKey);

  // A mouse user aims with the pointer and may never have put focus inside the game (Safari and
  // Firefox on macOS do not focus a clicked button or radio). So while the pointer rests on the
  // player's board during setup, R rotates from anywhere on the page, except while typing.
  document.addEventListener('keydown', (event) => {
    if (hover === null || event.defaultPrevented) return;
    const target = event.target;
    // Keys from inside the game went through the listener above.
    if (target instanceof Node && root.contains(target)) return;
    if (isTypingTarget(target instanceof HTMLElement ? target : null)) return;
    onRotateKey(event);
  });

  el.randomize.addEventListener('click', () => {
    placements = randomFleet(rng);
    selected = null;
    render();
    announce(`${m.status.randomized} ${m.status.allPlaced}`);
  });

  el.clear.addEventListener('click', () => {
    placements = [];
    selected = firstUnplaced();
    render();
    announce(`${m.status.cleared} ${selected ? m.status.selected(shipName(selected), orientation) : ''}`.trim());
  });

  el.start.addEventListener('click', startBattle);
  el.newGame.addEventListener('click', newGame);

  el.heatToggle.addEventListener('change', () => {
    heatOn = el.heatToggle.checked;
    render();
  });

  // The result buttons act directly (not through a method="dialog" form and the close event),
  // so the outcome never depends on when the browser dispatches that event.
  el.dialog.querySelectorAll<HTMLButtonElement>('[data-result-action]').forEach((button) => {
    button.addEventListener('click', () => {
      el.dialog.close();
      if (button.dataset.resultAction === 'replay') newGame();
      else el.newGame.focus();
    });
  });
  // Escape: stay on the finished game, with focus on a control that leads on.
  el.dialog.addEventListener('close', () => {
    if (phase === 'over' && !root.contains(document.activeElement)) el.newGame.focus();
  });

  // Browsers may restore radio and checkbox state on a history navigation without firing
  // events (Chromium once parsing has finished): take the settings from the controls again.
  window.addEventListener('pageshow', () => {
    window.setTimeout(() => {
      heatOn = el.heatToggle.checked;
      if (phase === 'setup') {
        difficulty = readDifficulty();
        selected = readSelectedShip() ?? selected;
      }
      render();
    }, 0);
  });

  render();
}
