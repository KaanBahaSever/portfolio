/**
 * The "character by character" table (browser only). Rows come from breakdown() in
 * src/lib/text/binary.ts; the table shows at most MAX_BREAKDOWN_ROWS of them.
 *
 * Rendering is incremental: rows are keyed by code point (and the ASCII flag), and only rows
 * from the first difference on are rebuilt, so typing at the end of a long text touches one
 * row instead of hundreds. Everything is built with DOM calls; no text is parsed as HTML.
 */
import type { BinaryTextMessages } from '../../../i18n/tools/binary-text.ts';
import type { Formatters } from '../../../i18n/format.ts';
import {
  ASCII_MAX,
  MAX_BREAKDOWN_ROWS,
  breakdown,
  byteToBits,
  byteToHex,
  formatCodePoint,
  utf8MarkerBits,
  type CharInfo,
} from '../../../lib/text/binary.ts';

export interface BreakdownState {
  ascii: boolean;
  /** The text field did not follow the last edit (the binary has an error). */
  stale: boolean;
}

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Binary converter: missing element ${selector}`);
  return element;
}

function span(className: string, text?: string): HTMLSpanElement {
  const element = document.createElement('span');
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function cell(className: string): HTMLTableCellElement {
  const element = document.createElement('td');
  element.className = className;
  return element;
}

/** Tighter on phones, so four columns fit 288 px without scrolling. */
const CELL = 'px-2 py-2 align-top sm:px-3';
/** Marker bits: lighter ink and regular weight, still 4.5:1 on the page and on a flagged row in both themes. */
const MARKER = 'text-zinc-600 dark:text-zinc-400';
const PAYLOAD = 'font-semibold text-zinc-900 dark:text-zinc-100';

export function createBreakdown(root: HTMLElement, m: BinaryTextMessages, f: Formatters) {
  const el = {
    empty: query<HTMLElement>(root, '[data-breakdown-empty]'),
    table: query<HTMLElement>(root, '[data-breakdown-table]'),
    body: query<HTMLTableSectionElement>(root, '[data-breakdown-body]'),
    summary: query<HTMLElement>(root, '[data-breakdown-summary]'),
    stale: query<HTMLElement>(root, '[data-breakdown-stale]'),
    capped: query<HTMLElement>(root, '[data-breakdown-capped]'),
    legend: query<HTMLElement>(root, '[data-breakdown-legend]'),
  };
  /** Key of each rendered row, in order. */
  let keys: string[] = [];

  function characterCell(row: CharInfo): HTMLTableCellElement {
    const td = cell(`${CELL} text-base text-zinc-900 dark:text-zinc-100`);
    if (row.name) {
      // Invisible characters show their standard abbreviation in a dashed box.
      td.append(
        span(
          'inline-block rounded border border-dashed border-zinc-400 px-1 font-mono text-[0.6875rem] leading-5 text-zinc-700 dark:border-zinc-500 dark:text-zinc-300',
          row.name,
        ),
      );
    } else if (row.kind === 'combining') {
      // A combining mark sits on a dotted circle, the convention in character charts.
      const base = span('text-zinc-400 dark:text-zinc-500', '◌');
      base.setAttribute('aria-hidden', 'true');
      td.append(base, document.createTextNode(row.char));
    } else if (row.kind === 'surrogate') {
      td.append(span('font-mono text-xs text-zinc-600 dark:text-zinc-400', '?'));
    } else {
      td.append(span('', row.char));
    }
    if (row.kind !== 'printable') td.append(span('sr-only', ` (${m.breakdown.kinds[row.kind]})`));
    return td;
  }

  function buildRow(row: CharInfo, flagged: boolean): HTMLTableRowElement {
    const tr = document.createElement('tr');
    tr.className =
      'border-b border-zinc-100 last:border-b-0 data-[flagged]:bg-rose-50/70 data-[flagged]:shadow-[inset_2px_0_0_var(--color-rose-600)] dark:border-zinc-800/70 dark:data-[flagged]:bg-rose-500/10 dark:data-[flagged]:shadow-[inset_2px_0_0_var(--color-rose-400)]';
    if (flagged) tr.dataset.flagged = '';

    const index = cell(`${CELL} hidden font-mono text-xs text-zinc-600 tabular-nums sm:table-cell dark:text-zinc-400`);
    index.textContent = f.number(row.index + 1);

    const codePoint = cell(`${CELL} font-mono text-xs whitespace-nowrap text-zinc-800 dark:text-zinc-200`);
    codePoint.append(span('', formatCodePoint(row.codePoint)));
    if (flagged) {
      codePoint.append(
        span('label-mono mt-1 block text-[0.625rem] text-rose-800 dark:text-rose-300', m.breakdown.notAscii),
      );
    }

    const hex = cell(`${CELL} font-mono text-xs text-zinc-800 dark:text-zinc-200`);
    const bits = cell(`${CELL} font-mono text-xs`);
    if (row.bytes.length === 0) {
      hex.append(span('text-zinc-600 dark:text-zinc-400', m.breakdown.noBytes));
      bits.append(span('text-zinc-600 dark:text-zinc-400', m.breakdown.noBytes));
    } else {
      const hexList = span('flex flex-wrap gap-x-1.5');
      const bitList = span('flex flex-wrap gap-x-2 gap-y-0.5');
      for (const value of row.bytes) {
        hexList.append(span('', byteToHex(value)));
        const text = byteToBits(value);
        const marker = utf8MarkerBits(value);
        const byte = span('whitespace-nowrap');
        byte.append(span(MARKER, text.slice(0, marker)), span(PAYLOAD, text.slice(marker)));
        bitList.append(byte);
      }
      hex.append(hexList);
      bits.append(bitList);
    }

    tr.append(index, characterCell(row), codePoint, hex, bits);
    return tr;
  }

  function render(text: string, state: BreakdownState): void {
    const result = breakdown(text, MAX_BREAKDOWN_ROWS);
    const empty = result.total === 0;
    el.empty.hidden = !empty;
    el.table.hidden = empty;
    el.legend.hidden = empty;
    el.stale.hidden = !state.stale || empty;
    el.summary.textContent = empty ? '' : m.breakdown.summary(result.total, result.bytes);

    const shown = result.rows.length;
    el.capped.hidden = result.total <= shown;
    el.capped.textContent = result.total > shown ? m.breakdown.capped(shown, result.total) : '';

    const nextKeys = result.rows.map((row) => {
      const flagged = state.ascii && row.codePoint > ASCII_MAX;
      return `${row.codePoint}${flagged ? '!' : ''}`;
    });
    let same = 0;
    while (same < keys.length && same < nextKeys.length && keys[same] === nextKeys[same]) same++;
    while (el.body.rows.length > same) el.body.lastElementChild?.remove();
    const fragment = document.createDocumentFragment();
    for (let index = same; index < result.rows.length; index++) {
      const row = result.rows[index];
      if (row) fragment.append(buildRow(row, nextKeys[index]?.endsWith('!') ?? false));
    }
    el.body.append(fragment);
    keys = nextKeys;
  }

  return { render };
}
