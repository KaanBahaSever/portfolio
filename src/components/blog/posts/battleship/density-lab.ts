/**
 * The density lab's behaviour (browser only). One lab's state lives in the closure of
 * initDensityLab(root), so several labs could share a page. The density itself comes straight from
 * the game's library (probabilityDensity, densityPeaks, targetWeight), the same code the Hard
 * computer runs at /games/battleship/.
 *
 * Text follows the article's language (data-lang on the root), like the rest of the post.
 */
import { isLocale } from '../../../../i18n/config.ts';
import { formatters } from '../../../../i18n/format.ts';
import { moveInGrid } from '../../../../lib/games/grid.ts';
import {
  HIT,
  MISS,
  SUNK,
  UNKNOWN,
  createKnowledge,
  densityPeaks,
  probabilityDensity,
  targetWeight,
  type CellKnowledge,
  type Knowledge,
} from '../../../../lib/games/battleship/ai.ts';
import { BOARD_SIZE, FLEET, coordinateLabel } from '../../../../lib/games/battleship/rules.ts';
import { weightDigits, weightFormula } from './format.ts';
import { battleshipPostMessages } from './messages.ts';

type Tool = 'miss' | 'hit' | 'sunk' | 'clear';

const STATE_OF: Record<Tool, CellKnowledge> = { miss: MISS, hit: HIT, sunk: SUNK, clear: UNKNOWN };
const STATE_NAME: Record<CellKnowledge, 'unknown' | 'miss' | 'hit' | 'sunk'> = {
  [UNKNOWN]: 'unknown',
  [MISS]: 'miss',
  [HIT]: 'hit',
  [SUNK]: 'sunk',
};
/** Peaks named in full before the rest are summarised as "n more". */
const PEAKS_LISTED = 3;

function isTool(value: string): value is Tool {
  return value === 'miss' || value === 'hit' || value === 'sunk' || value === 'clear';
}

export function initDensityLab(root: HTMLElement): void {
  const lang = isLocale(root.dataset.lang) ? root.dataset.lang : 'en';
  const m = battleshipPostMessages[lang];
  const f = formatters(lang);

  const grid = root.querySelector<HTMLElement>('[data-grid]');
  const bestOut = root.querySelector<HTMLElement>('[data-best]');
  const inspectOut = root.querySelector<HTMLElement>('[data-inspect]');
  const weightOut = root.querySelector<HTMLElement>('[data-weight]');
  const status = root.querySelector<HTMLElement>('[data-status]');
  const reset = root.querySelector<HTMLButtonElement>('[data-reset]');
  if (!grid || !bestOut || !inspectOut || !weightOut || !status || !reset) return;
  // Narrowed once here, so the helper functions below can use them without null checks.
  const out = { best: bestOut, inspect: inspectOut, weight: weightOut, status };
  const cells = [...grid.querySelectorAll<HTMLButtonElement>('[data-cell]')];
  const tools = [...root.querySelectorAll<HTMLInputElement>('input[data-tool]')];
  const ships = [...root.querySelectorAll<HTMLInputElement>('input[data-ship]')];
  if (cells.length !== BOARD_SIZE * BOARD_SIZE) return;

  const knowledge: Knowledge = createKnowledge();
  let density = probabilityDensity(knowledge);
  let peaks: number[] = [];
  let inspected = 0;

  const currentTool = (): Tool => {
    const value = tools.find((input) => input.checked)?.value ?? 'miss';
    return isTool(value) ? value : 'miss';
  };

  const stateName = (index: number) => m.cellState[STATE_NAME[(knowledge.cells[index] ?? UNKNOWN) as CellKnowledge]];

  const listPeaks = (list: readonly number[]): string => {
    const names = list.map((index) => coordinateLabel(index));
    if (names.length <= PEAKS_LISTED + 1) return f.list(names);
    return f.list([...names.slice(0, PEAKS_LISTED), m.lab.more(names.length - PEAKS_LISTED)]);
  };

  /**
   * The Hard computer's targets and their density, or why there are none: every ship is unticked
   * (`none`), or ships are ticked but the marked board leaves no placement for any of them (`noRoom`).
   */
  const best = (): { cells: string; value: string } | { reason: string } => {
    if (knowledge.remaining.length === 0) return { reason: m.lab.none };
    const max = peaks.length > 0 ? (density[peaks[0] ?? 0] ?? 0) : 0;
    if (max === 0) return { reason: m.lab.noRoom };
    return { cells: listPeaks(peaks), value: f.number(max) };
  };

  const inspectText = (index: number): string => {
    const coordinate = coordinateLabel(index);
    if (knowledge.cells[index] !== UNKNOWN) return m.lab.inspectFired(coordinate, stateName(index));
    const value = density[index] ?? 0;
    const weight = targetWeight(knowledge.remaining);
    const formula = weightFormula(weightDigits(value, weight), weight, f);
    // Show the base-w expansion only when a hit is involved: "442 = 12 · 35 + 22".
    return m.lab.inspectValue(coordinate, value >= weight ? `${formula} = ${f.number(value)}` : f.number(value));
  };

  function render(): void {
    knowledge.remaining = FLEET.filter((ship) => ships.find((input) => input.value === ship.id)?.checked);
    density = probabilityDensity(knowledge);
    const max = Math.max(0, ...density);
    peaks = knowledge.remaining.length > 0 && max > 0 ? densityPeaks(knowledge, density) : [];
    const peakSet = new Set(peaks);

    cells.forEach((button, index) => {
      const state = (knowledge.cells[index] ?? UNKNOWN) as CellKnowledge;
      const value = density[index] ?? 0;
      button.style.setProperty('--heat', max > 0 ? (value / max).toFixed(4) : '0');
      if (state === UNKNOWN) delete button.dataset.state;
      else button.dataset.state = STATE_NAME[state];
      button.toggleAttribute('data-peak', peakSet.has(index));
      button.setAttribute(
        'aria-label',
        m.lab.cell(
          coordinateLabel(index),
          stateName(index),
          state === UNKNOWN && value > 0 ? f.number(value) : '',
          peakSet.has(index),
        ),
      );
    });

    const target = best();
    out.best.textContent = 'reason' in target ? target.reason : m.lab.bestValue(target.cells, target.value);
    out.inspect.textContent = inspectText(inspected);
    out.weight.textContent = `w = ${f.number(targetWeight(knowledge.remaining))}`;
  }

  let pending = 0;
  function announce(text: string): void {
    // Clear first, then write after a short pause, so the same sentence twice in a row is still
    // read out; a newer announcement replaces one that has not been written yet.
    out.status.textContent = '';
    window.clearTimeout(pending);
    pending = window.setTimeout(() => {
      out.status.textContent = text;
    }, 60);
  }

  function mark(index: number): void {
    const tool = currentTool();
    const wanted = STATE_OF[tool];
    // Marking a cell again with the same tool clears it.
    knowledge.cells[index] = knowledge.cells[index] === wanted ? UNKNOWN : wanted;
    inspected = index;
    render();
    const target = best();
    const coordinate = coordinateLabel(index);
    announce(
      'reason' in target
        ? m.lab.announceNone(coordinate, stateName(index), target.reason)
        : m.lab.announce(coordinate, stateName(index), target.cells, target.value),
    );
  }

  function focusCell(index: number): void {
    cells.forEach((button, i) => (button.tabIndex = i === index ? 0 : -1));
    cells[index]?.focus();
  }

  function inspect(index: number): void {
    if (index === inspected) return;
    inspected = index;
    out.inspect.textContent = inspectText(index);
  }

  grid.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-cell]');
    if (!button) return;
    const index = Number(button.dataset.cell);
    cells.forEach((other, i) => (other.tabIndex = i === index ? 0 : -1));
    mark(index);
  });

  grid.addEventListener('keydown', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-cell]');
    if (!button || event.altKey) return;
    const next = moveInGrid(Number(button.dataset.cell), event, BOARD_SIZE, BOARD_SIZE);
    if (next === null) return;
    event.preventDefault();
    focusCell(next);
  });

  grid.addEventListener('focusin', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-cell]');
    if (button) inspect(Number(button.dataset.cell));
  });

  grid.addEventListener('pointerover', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-cell]');
    if (button && event.pointerType === 'mouse') inspect(Number(button.dataset.cell));
  });

  for (const input of ships) {
    input.addEventListener('change', () => {
      render();
      const target = best();
      announce(
        'reason' in target ? m.lab.announceFleetNone(target.reason) : m.lab.announceFleet(target.cells, target.value),
      );
    });
  }

  reset.addEventListener('click', () => {
    knowledge.cells.fill(UNKNOWN);
    for (const input of ships) input.checked = true;
    inspected = 0;
    render();
    announce(m.lab.announceReset);
  });

  render();
}
