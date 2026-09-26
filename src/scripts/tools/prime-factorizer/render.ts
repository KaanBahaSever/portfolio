/**
 * DOM builders for the factorizer's result (browser only). Everything is created with
 * textContent, never innerHTML: numbers come from the person's input.
 */
import type { Locale } from '../../../i18n/config.ts';
import { formatters } from '../../../i18n/format.ts';
import type { PrimeFactorizerMessages } from '../../../i18n/tools/prime-factorizer.ts';
import type { Analysis } from '../../../lib/math/arithmetic.ts';
import { MINUS } from '../../../lib/math/digits.ts';
import type { TreeLayout } from '../../../lib/math/factor-tree.ts';
import type { Factorization } from '../../../lib/math/factorize.ts';
import { formatBig, tauFormula, type Term } from './text.ts';

type Messages = PrimeFactorizerMessages;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

// ---------------------------------------------------------------- canonical form

/** Terms up to this many characters never break inside; longer numbers may, anywhere. */
const UNBREAKABLE_TERM = 14;
/** Characters above which the product is set a size smaller. */
const LONG_PRODUCT = 28;

/**
 * The product with real superscripts: 2³ × 3² × 5. Probable primes carry a dagger, and
 * cofactors that could not be split stand in brackets with a dashed underline. Lines break
 * after a ×, between terms.
 */
export function renderCanonical(container: HTMLElement, terms: readonly Term[], negative: boolean, locale: Locale): void {
  const fragment = document.createDocumentFragment();
  // A no-break space keeps the × with the term before it; the space after is where lines break.
  const times = () => [' ', h('span', 'text-zinc-400 dark:text-zinc-500', '×'), ' '];
  if (negative) {
    fragment.append(h('span', 'whitespace-nowrap', `${MINUS}1`), ...times());
  }
  terms.forEach((term, index) => {
    if (index > 0) fragment.append(...times());
    const base = formatBig(term.base, locale);
    const span = h(
      'span',
      [
        term.kind === 'unfactored' ? 'text-zinc-600 dark:text-zinc-400' : '',
        base.length <= UNBREAKABLE_TERM ? 'whitespace-nowrap' : '',
      ]
        .filter(Boolean)
        .join(' ') || undefined,
    );
    if (term.kind === 'unfactored') {
      span.append('[', h('span', 'underline decoration-dashed decoration-1 underline-offset-[0.2em]', base), ']');
    } else {
      span.append(base);
    }
    if (term.kind === 'probable') span.append(h('sup', 'text-accent-700 dark:text-accent-400', '†'));
    if (term.exponent > 1) span.append(h('sup', undefined, formatters(locale).number(term.exponent)));
    fragment.append(span);
  });
  container.replaceChildren(fragment);
  // Long products (big factors, many terms) are set a size smaller.
  container.dataset.size = (container.textContent ?? '').length > LONG_PRODUCT ? 'long' : 'short';
}

// ---------------------------------------------------------------- notes

export interface Note {
  text: string;
  tone?: 'neutral' | 'warning';
}

const noteClass =
  'border-l-2 border-zinc-300 pl-3 text-sm leading-relaxed text-zinc-700 data-[tone=warning]:border-amber-500 dark:border-zinc-600 dark:text-zinc-300 dark:data-[tone=warning]:border-amber-400';

export function renderNotes(list: HTMLElement, notes: readonly Note[]): void {
  list.replaceChildren(
    ...notes.map((note) => {
      const item = h('li', noteClass, note.text);
      item.dataset.tone = note.tone ?? 'neutral';
      return item;
    }),
  );
}

// ---------------------------------------------------------------- functions and properties

interface Row {
  symbol?: string;
  name: string;
  /** The value, or null when it needs the complete factorization. */
  value: string | null;
  /** The value is words, not one number: set in the text face so it wraps between words. */
  words?: boolean;
  note?: string;
  formula?: string | null;
}

function renderRows(list: HTMLElement, rows: readonly Row[], unknown: string): void {
  list.replaceChildren(
    ...rows.map((row) => {
      const group = h('div', 'py-3');
      const term = h('dt', 'flex flex-wrap items-baseline gap-x-2 text-sm');
      if (row.symbol) term.append(h('span', 'font-mono text-zinc-600 dark:text-zinc-400', row.symbol));
      term.append(h('span', 'font-medium text-zinc-900 dark:text-zinc-100', row.name));
      const value =
        row.value === null
          ? h('dd', 'mt-1 text-sm text-zinc-600 italic dark:text-zinc-400', unknown)
          : row.words
            ? h('dd', 'mt-1 text-base text-zinc-900 tabular-nums dark:text-zinc-100', row.value)
            : h('dd', 'mt-1 font-mono text-lg break-all text-zinc-900 tabular-nums dark:text-zinc-100', row.value);
      group.append(term, value);
      if (row.note || row.formula) {
        const note = h('dd', 'mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400', row.note);
        if (row.formula) {
          if (row.note) note.append(' ');
          note.append(h('span', 'font-mono text-xs whitespace-nowrap text-zinc-700 dark:text-zinc-300', row.formula));
        }
        group.append(note);
      }
      return group;
    }),
  );
}

export function renderFunctions(
  list: HTMLElement,
  analysis: Analysis,
  result: Factorization,
  locale: Locale,
  m: Messages,
): void {
  const big = (value: bigint | null) => (value === null ? null : formatBig(value, locale));
  const f = m.functions;
  const rows: Row[] = [
    {
      symbol: 'τ(n)',
      name: f.tau.name,
      value: big(analysis.divisorCount),
      note: analysis.complete ? f.tau.note : undefined,
      formula: analysis.complete ? tauFormula(result) : null,
    },
    {
      symbol: 'σ(n)',
      name: f.sigma.name,
      value: big(analysis.divisorSum),
      note: analysis.aliquotSum === null ? undefined : f.sigma.note(formatBig(analysis.aliquotSum, locale)),
    },
    { symbol: 'φ(n)', name: f.phi.name, value: big(analysis.totient), note: f.phi.note },
    {
      symbol: 'ω(n), Ω(n)',
      name: f.omega.name,
      words: true,
      value:
        analysis.distinctPrimes === null || analysis.primeFactors === null
          ? null
          : f.omega.value(analysis.distinctPrimes, analysis.primeFactors),
    },
  ];
  renderRows(list, rows, f.unknown);
}

/** Yes / No with a mark, so the answer never rests on colour alone. */
function answer(value: boolean | null, m: Messages): { text: string | null; yes: boolean } {
  if (value === null) return { text: null, yes: false };
  return { text: value ? m.properties.yes : m.properties.no, yes: value };
}

export function renderProperties(list: HTMLElement, analysis: Analysis, locale: Locale, m: Messages): void {
  const p = m.properties;
  const prime = analysis.kind === 'prime';
  const items: Array<{ name: string; value: boolean | null; detail?: string }> = [
    { name: p.prime, value: prime, detail: prime && analysis.probable ? p.probableNote : undefined },
    {
      name: p.perfectSquare,
      value: analysis.squareRoot !== null,
      detail: analysis.squareRoot !== null && analysis.magnitude > 1n ? p.squareOf(formatBig(analysis.squareRoot, locale)) : undefined,
    },
    { name: p.squarefree, value: analysis.squarefree, detail: analysis.squarefree ? p.squarefreeNote : undefined },
    {
      name: p.perfect,
      value: analysis.abundance === null ? null : analysis.abundance === 'perfect',
      detail: analysis.abundance === null ? undefined : p.abundance[analysis.abundance],
    },
  ];
  if (analysis.carmichael) items.push({ name: p.carmichael, value: true, detail: p.carmichaelNote });

  list.replaceChildren(
    ...items.map((item) => {
      const group = h('div', 'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 py-3');
      group.append(h('dt', 'text-sm font-medium text-zinc-900 dark:text-zinc-100', item.name));
      const { text, yes } = answer(item.value, m);
      const value = h(
        'dd',
        yes
          ? 'flex items-center gap-1.5 text-sm font-semibold text-accent-700 dark:text-accent-400'
          : 'flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400',
      );
      if (text === null) {
        value.classList.add('italic');
        value.textContent = p.unknown;
      } else {
        value.append(mark(yes), text);
      }
      group.append(value);
      if (item.detail) group.append(h('dd', 'col-span-2 mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400', item.detail));
      return group;
    }),
  );
}

const SVG = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

/** A check for yes, a dash for no (decorative: the word is next to it). */
function mark(yes: boolean): SVGSVGElement {
  const icon = svg('svg', {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
    class: 'size-4 shrink-0',
  });
  icon.append(svg('path', { d: yes ? 'm5 12.5 4.5 4.5L19 7.5' : 'M7 12h10' }));
  return icon;
}

// ---------------------------------------------------------------- divisors

export function renderDivisorList(list: HTMLElement, divisors: readonly bigint[], locale: Locale): void {
  const fragment = document.createDocumentFragment();
  for (const d of divisors) {
    // Long divisors (up to 40 digits) wrap inside their chip rather than widen the list.
    fragment.append(h('li', 'max-w-full rounded-md bg-zinc-100 px-1.5 py-0.5 break-all dark:bg-zinc-800', formatBig(d, locale)));
  }
  list.replaceChildren(fragment);
}

// ---------------------------------------------------------------- factor tree

/**
 * Draws the factor tree: hairline edges, hollow dots for the numbers that still split,
 * accent dots and labels for the primes, dashed squares for cofactors not split in time.
 */
export function renderTree(target: SVGSVGElement, layout: TreeLayout, m: Messages): void {
  target.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
  target.setAttribute('width', String(layout.width));
  target.setAttribute('height', String(layout.height));

  const edges = svg('g', { class: 'text-zinc-400 dark:text-zinc-600', stroke: 'currentColor', 'stroke-width': 1 });
  for (const edge of layout.edges) {
    // Stop short of the dots so the lines meet them cleanly.
    const dx = edge.x2 - edge.x1;
    const dy = edge.y2 - edge.y1;
    const length = Math.hypot(dx, dy) || 1;
    const trim = 5 / length;
    const line = svg('line', {
      x1: edge.x1 + dx * trim,
      y1: edge.y1 + dy * trim,
      x2: edge.more ? edge.x2 : edge.x2 - dx * trim,
      y2: edge.more ? edge.y2 : edge.y2 - dy * trim,
    });
    if (edge.more) line.setAttribute('stroke-dasharray', '2 3');
    edges.append(line);
  }

  const nodes = svg('g', {});
  const labels = svg('g', { class: 'font-mono', 'font-size': 11, fill: 'currentColor' });
  for (const node of layout.nodes) {
    if (node.kind === 'prime') {
      nodes.append(svg('circle', { cx: node.x, cy: node.y, r: 3.5, class: 'fill-accent-600 dark:fill-accent-400' }));
    } else if (node.kind === 'unfactored') {
      nodes.append(
        svg('rect', {
          x: node.x - 3.5,
          y: node.y - 3.5,
          width: 7,
          height: 7,
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': 1,
          'stroke-dasharray': '2 1.5',
          class: 'text-zinc-700 dark:text-zinc-300',
        }),
      );
    } else {
      nodes.append(
        svg('circle', {
          cx: node.x,
          cy: node.y,
          r: 3,
          stroke: 'currentColor',
          'stroke-width': 1.25,
          class: 'fill-white text-zinc-700 dark:fill-zinc-900 dark:text-zinc-300',
        }),
      );
    }
    const text = svg('text', {
      x: node.labelSide === 'left' ? node.x - 7 : node.x + 7,
      y: node.y + 3.5,
      'text-anchor': node.labelSide === 'left' ? 'end' : 'start',
      class:
        node.kind === 'prime'
          ? 'text-accent-700 dark:text-accent-400'
          : node.kind === 'unfactored'
            ? 'text-zinc-600 dark:text-zinc-400'
            : 'text-zinc-800 dark:text-zinc-200',
    });
    text.textContent = node.label;
    labels.append(text);
  }

  target.replaceChildren(edges, nodes, labels);
  if (layout.more) {
    const more = svg('text', {
      x: layout.more.x,
      y: layout.more.y,
      class: 'font-mono text-zinc-600 dark:text-zinc-400',
      'font-size': 10,
      fill: 'currentColor',
    });
    more.textContent = m.figure.more(layout.hiddenSplits);
    target.append(more);
  }
}
