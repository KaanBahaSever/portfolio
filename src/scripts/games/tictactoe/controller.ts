/**
 * Tic-tac-toe: DOM wiring (browser only). Rules and search live in src/lib/games/tictactoe/*; this
 * file keeps one game's state in a closure per root element (no module-level state) and renders
 * it through data attributes that src/components/games/TicTacToe.astro styles.
 *
 * Input: click or tap a square; arrow keys move a roving focus inside the board and Enter/Space
 * play; digit keys 1–9 play a square directly anywhere inside the game, in phone or numeric-keypad
 * order. Moves and results are announced through a polite status region.
 */
import { ticTacToeMessages } from '../../../i18n/games/tictactoe.ts';
import { getPageLocale } from '../../../i18n/client.ts';
import { formatters } from '../../../i18n/format.ts';
import { moveInGrid } from '../../../lib/games/grid.ts';
import { mulberry32, randomSeed } from '../../../lib/games/random.ts';
import { DIFFICULTIES, chooseMove, evaluateMoves, readScore, type Difficulty } from '../../../lib/games/tictactoe/ai.ts';
import {
  CELL_COUNT,
  cellForDigit,
  emptyBoard,
  otherMark,
  outcomeOf,
  play,
  type Cell,
  type KeypadLayout,
  type Mark,
  type Outcome,
} from '../../../lib/games/tictactoe/board.ts';

type Mode = 'computer' | 'human';
type Starter = 'human' | 'computer';

/** The computer "thinks" briefly so its move reads as a separate turn. */
const THINKING_MS = 420;
/** How far the win line reaches past the centres of the end squares (fraction of the line). */
const WIN_LINE_OVERSHOOT = 0.14;

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Tic-tac-toe: missing element ${selector}`);
  return element;
}

function checkedValue(inputs: readonly HTMLInputElement[]): string | undefined {
  return inputs.find((input) => input.checked)?.value;
}

function setText(element: Element, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}

function setData(element: HTMLElement, name: string, value: string | null): void {
  if (value === null) {
    if (name in element.dataset) delete element.dataset[name];
  } else if (element.dataset[name] !== value) {
    element.dataset[name] = value;
  }
}

/** A score as shown on the board: "+7", "0", "−8" (with a true minus sign). */
function formatScore(score: number): string {
  if (score > 0) return `+${score}`;
  if (score < 0) return `−${Math.abs(score)}`;
  return '0';
}

export function initTicTacToe(root: HTMLElement): void {
  if (root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const locale = getPageLocale();
  const m = ticTacToeMessages[locale];
  const format = formatters(locale);
  const rng = mulberry32(randomSeed());

  const el = {
    status: query<HTMLElement>(root, '[data-status]'),
    substatus: query<HTMLElement>(root, '[data-substatus]'),
    grid: query<HTMLElement>(root, '[data-grid]'),
    squares: Array.from(root.querySelectorAll<HTMLButtonElement>('[data-square]')),
    winLine: query<HTMLElement>(root, '[data-win-line]'),
    evalCaption: query<HTMLElement>(root, '[data-eval-caption]'),
    scoreA: query<HTMLElement>(root, '[data-score="a"]'),
    scoreDraws: query<HTMLElement>(root, '[data-score="draws"]'),
    scoreB: query<HTMLElement>(root, '[data-score="b"]'),
    scoreLabelA: query<HTMLElement>(root, '[data-score-label="a"]'),
    scoreLabelB: query<HTMLElement>(root, '[data-score-label="b"]'),
    newRound: query<HTMLButtonElement>(root, '[data-new-round]'),
    resetScore: query<HTMLButtonElement>(root, '[data-reset-score]'),
    modes: Array.from(root.querySelectorAll<HTMLInputElement>('[data-mode]')),
    difficulties: Array.from(root.querySelectorAll<HTMLInputElement>('[data-difficulty]')),
    difficultyHint: query<HTMLElement>(root, '[data-difficulty-hint]'),
    marks: Array.from(root.querySelectorAll<HTMLInputElement>('[data-mark-choice]')),
    starters: Array.from(root.querySelectorAll<HTMLInputElement>('[data-starter]')),
    firstMarks: Array.from(root.querySelectorAll<HTMLInputElement>('[data-first-mark]')),
    keypads: Array.from(root.querySelectorAll<HTMLInputElement>('[data-keypad]')),
    keypadHint: query<HTMLElement>(root, '[data-keypad-hint]'),
    evalToggle: query<HTMLInputElement>(root, '[data-eval-toggle]'),
    whenComputer: Array.from(root.querySelectorAll<HTMLElement>('[data-when="computer"]')),
    whenHuman: Array.from(root.querySelectorAll<HTMLElement>('[data-when="human"]')),
    announcer: query<HTMLElement>(root, '[data-announcer]'),
  };
  if (el.squares.length !== CELL_COUNT) throw new Error('Tic-tac-toe: the board needs 9 squares');

  // ---------------------------------------------------------------- state

  let mode: Mode = 'computer';
  let difficulty: Difficulty = 'unbeatable';
  let humanMark: Mark = 'X';
  let starter: Starter = 'human';
  let firstMark: Mark = 'X';
  let keypad: KeypadLayout = 'phone';
  let showEval = false;
  readSettings();

  let board: Cell[] = emptyBoard();
  let toMove: Mark = 'X';
  let outcome: Outcome = { kind: 'ongoing' };
  /** a: you (or X with two players); b: the computer (or O). */
  const score = { a: 0, draws: 0, b: 0 };
  let cursor = 0;
  let thinkingTimer = 0;
  let announceTimer = 0;

  function readSettings(): void {
    mode = checkedValue(el.modes) === 'human' ? 'human' : 'computer';
    const level = checkedValue(el.difficulties) ?? '';
    difficulty = (DIFFICULTIES as readonly string[]).includes(level) ? (level as Difficulty) : 'unbeatable';
    humanMark = checkedValue(el.marks) === 'O' ? 'O' : 'X';
    starter = checkedValue(el.starters) === 'computer' ? 'computer' : 'human';
    firstMark = checkedValue(el.firstMarks) === 'O' ? 'O' : 'X';
    keypad = checkedValue(el.keypads) === 'numpad' ? 'numpad' : 'phone';
    showEval = el.evalToggle.checked;
  }

  // ---------------------------------------------------------------- helpers

  const computerMark = (): Mark => otherMark(humanMark);
  const isComputerTurn = (): boolean => mode === 'computer' && outcome.kind === 'ongoing' && toMove === computerMark();
  /** Whether a person may play right now. */
  const humanMayPlay = (): boolean => outcome.kind === 'ongoing' && !isComputerTurn();

  function announce(message: string): void {
    window.clearTimeout(announceTimer);
    el.announcer.textContent = '';
    // Re-setting after a tick makes screen readers repeat identical messages.
    announceTimer = window.setTimeout(() => {
      el.announcer.textContent = message;
    }, 50);
  }

  function turnMessage(): string {
    if (mode === 'human') return m.announce.toMove(toMove);
    return toMove === humanMark ? m.announce.yourTurn : '';
  }

  function resultMessage(result: Outcome): string {
    if (result.kind === 'draw') return m.announce.draw;
    if (result.kind !== 'win') return '';
    const line = m.lines[result.lineId] ?? '';
    if (mode === 'human') return m.announce.markWins(result.mark, line);
    return result.mark === humanMark ? m.announce.youWin(line) : m.announce.computerWins(line);
  }

  // ---------------------------------------------------------------- rendering

  function statusText(): string {
    if (outcome.kind === 'draw') return m.status.draw;
    if (outcome.kind === 'win') {
      if (mode === 'human') return m.status.markWins(outcome.mark);
      return outcome.mark === humanMark ? m.status.youWin : m.status.computerWins;
    }
    if (mode === 'human') return m.status.toMove(toMove);
    return toMove === humanMark ? m.status.yourTurn : m.status.computerTurn;
  }

  function renderWinLine(): void {
    if (outcome.kind !== 'win') {
      el.winLine.hidden = true;
      return;
    }
    const centre = (index: number) => ({ x: (index % 3) * 100 + 50, y: Math.floor(index / 3) * 100 + 50 });
    const a = centre(outcome.line[0]);
    const b = centre(outcome.line[2]);
    const dx = Math.round((b.x - a.x) * WIN_LINE_OVERSHOOT);
    const dy = Math.round((b.y - a.y) * WIN_LINE_OVERSHOOT);
    const line = query<SVGLineElement>(el.winLine, 'line');
    line.setAttribute('x1', String(a.x - dx));
    line.setAttribute('y1', String(a.y - dy));
    line.setAttribute('x2', String(b.x + dx));
    line.setAttribute('y2', String(b.y + dy));
    // Unhiding restarts the CSS stroke animation.
    el.winLine.hidden = false;
  }

  function render(): void {
    const evaluations =
      showEval && humanMayPlay() ? new Map(evaluateMoves(board, toMove).map((s) => [s.index, s.score])) : null;
    const best = evaluations && evaluations.size > 0 ? Math.max(...evaluations.values()) : null;
    const winning = outcome.kind === 'win' ? new Set<number>(outcome.line) : new Set<number>();

    el.squares.forEach((square, index) => {
      const mark = board[index] ?? null;
      setData(square, 'mark', mark);
      setData(square, 'win', winning.has(index) ? '' : null);
      const evalElement = query<HTMLElement>(square, '[data-eval]');
      const value = evaluations?.get(index);
      setText(evalElement, value === undefined ? '' : formatScore(value));
      setData(evalElement, 'best', value !== undefined && value === best ? '' : null);

      const details: string[] = [mark ?? m.empty];
      if (value !== undefined) details.push(m.evaluation(formatScore(value), readScore(value).result));
      const label = m.squareLabel(m.squares[index] ?? '', ...details);
      if (square.getAttribute('aria-label') !== label) square.setAttribute('aria-label', label);
      if (mark) square.setAttribute('aria-disabled', 'true');
      else square.removeAttribute('aria-disabled');
    });

    setData(el.grid, 'ghost', humanMayPlay() ? toMove : null);
    renderWinLine();

    setText(el.status, statusText());
    setText(
      el.substatus,
      mode === 'computer' ? `${m.status.youAre(humanMark)} · ${m.difficulties[difficulty]}` : m.opponents.human,
    );
    setText(el.evalCaption, evaluations ? m.evaluationFor(toMove) : '');

    setText(el.scoreLabelA, mode === 'computer' ? m.scoreLabels.you : 'X');
    setText(el.scoreLabelB, mode === 'computer' ? m.scoreLabels.computer : 'O');
    setText(el.scoreA, format.number(score.a));
    setText(el.scoreDraws, format.number(score.draws));
    setText(el.scoreB, format.number(score.b));

    for (const element of el.whenComputer) element.hidden = mode !== 'computer';
    for (const element of el.whenHuman) element.hidden = mode !== 'human';
    setText(el.difficultyHint, m.difficultyHints[difficulty]);
    setText(el.keypadHint, m.keypadHints[keypad]);
  }

  // ---------------------------------------------------------------- moves

  function scoreRound(result: Outcome): void {
    if (result.kind === 'draw') score.draws++;
    else if (result.kind === 'win') {
      const first = mode === 'computer' ? result.mark === humanMark : result.mark === 'X';
      if (first) score.a++;
      else score.b++;
    }
  }

  /** Plays `index` for the side to move and reports what happened. */
  function applyMove(index: number, byComputer: boolean): void {
    const mark = toMove;
    board = play(board, index, mark);
    outcome = outcomeOf(board);
    const square = m.squaresInline[index] ?? '';
    const moveText = byComputer ? m.announce.computerMove(mark, square) : m.announce.move(mark, square);
    if (outcome.kind === 'ongoing') {
      toMove = otherMark(mark);
      render();
      // Against the computer, your own move needs no echo: its reply follows in a moment.
      if (byComputer || mode === 'human') announce(`${moveText} ${turnMessage()}`.trim());
      scheduleComputer();
      return;
    }
    scoreRound(outcome);
    render();
    announce(`${moveText} ${resultMessage(outcome)}`);
  }

  function scheduleComputer(): void {
    window.clearTimeout(thinkingTimer);
    if (!isComputerTurn()) return;
    thinkingTimer = window.setTimeout(() => {
      if (!isComputerTurn()) return;
      applyMove(chooseMove(board, toMove, difficulty, rng), true);
    }, THINKING_MS);
  }

  function humanPlays(index: number): void {
    if (outcome.kind !== 'ongoing') {
      announce(m.announce.roundOver);
      return;
    }
    if (isComputerTurn()) {
      announce(m.announce.wait);
      return;
    }
    if (board[index] !== null) {
      announce(m.announce.taken(m.squares[index] ?? ''));
      return;
    }
    applyMove(index, false);
  }

  function newRound(speak: boolean): void {
    window.clearTimeout(thinkingTimer);
    board = emptyBoard();
    outcome = { kind: 'ongoing' };
    toMove = mode === 'computer' ? (starter === 'human' ? humanMark : computerMark()) : firstMark;
    render();
    if (speak) {
      const next = isComputerTurn() ? m.announce.computerFirst : turnMessage();
      announce(`${m.announce.newRound} ${next}`.trim());
    }
    scheduleComputer();
  }

  function resetScore(): void {
    score.a = 0;
    score.draws = 0;
    score.b = 0;
  }

  // ---------------------------------------------------------------- focus

  function setCursor(index: number): void {
    el.squares[cursor]?.setAttribute('tabindex', '-1');
    cursor = index;
    el.squares[index]?.setAttribute('tabindex', '0');
  }

  // ---------------------------------------------------------------- events

  const squareOf = (target: EventTarget | null): number | null => {
    if (!(target instanceof Element)) return null;
    const square = target.closest<HTMLElement>('[data-square]');
    return square && el.grid.contains(square) ? Number(square.dataset.square) : null;
  };

  el.grid.addEventListener('click', (event) => {
    const index = squareOf(event.target);
    if (index === null) return;
    setCursor(index);
    humanPlays(index);
  });

  el.grid.addEventListener('keydown', (event) => {
    if (event.altKey) return;
    const index = squareOf(event.target);
    if (index === null) return;
    const next = moveInGrid(index, event, 3, 3);
    if (next === null) return;
    event.preventDefault();
    setCursor(next);
    el.squares[next]?.focus();
  });

  el.grid.addEventListener('focusin', (event) => {
    const index = squareOf(event.target);
    if (index !== null) setCursor(index);
  });

  // Digit keys anywhere in the game (there are no text fields here to type into).
  root.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const index = cellForDigit(event.key, keypad);
    if (index === null) return;
    event.preventDefault();
    const focusInBoard = el.grid.contains(document.activeElement);
    setCursor(index);
    if (focusInBoard) el.squares[index]?.focus();
    humanPlays(index);
  });

  /** A settings change starts a new round; changing who plays whom also clears the score. */
  function onSettingsChange(clearScore: boolean): void {
    readSettings();
    if (clearScore) resetScore();
    newRound(true);
  }

  for (const input of el.modes) input.addEventListener('change', () => onSettingsChange(true));
  for (const input of el.difficulties) input.addEventListener('change', () => onSettingsChange(true));
  for (const input of [...el.marks, ...el.starters, ...el.firstMarks]) {
    input.addEventListener('change', () => onSettingsChange(false));
  }
  for (const input of el.keypads) {
    input.addEventListener('change', () => {
      readSettings();
      render();
    });
  }
  el.evalToggle.addEventListener('change', () => {
    readSettings();
    render();
  });

  el.newRound.addEventListener('click', () => newRound(true));
  el.resetScore.addEventListener('click', () => {
    resetScore();
    render();
    announce(m.announce.scoreReset);
  });

  // Browsers may restore radio and checkbox state on a history navigation without firing events:
  // take the settings from the controls again (the board itself is never restored).
  window.addEventListener('pageshow', (event) => {
    window.setTimeout(() => {
      const before = [mode, difficulty, humanMark, starter, firstMark].join();
      readSettings();
      const after = [mode, difficulty, humanMark, starter, firstMark].join();
      if (before !== after && !event.persisted) newRound(false);
      else render();
    }, 0);
  });

  newRound(false);
}
