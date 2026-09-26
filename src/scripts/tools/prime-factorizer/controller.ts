/**
 * Integer & prime factorizer: DOM wiring (browser only).
 *
 * The number is parsed on every keystroke (live validation), factored in a Web Worker on
 * submit (engine.ts), and the result is rendered from the pure libraries in src/lib/math/.
 * Every run carries a generation number, so a cancelled or superseded search can never
 * overwrite a newer result. Interface text comes from the same catalogue the server-rendered
 * component uses, in the page's language (<html lang>).
 */

import { getPageLocale } from '../../../i18n/client.ts';
import { formatters } from '../../../i18n/format.ts';
import { primeFactorizerMessages } from '../../../i18n/tools/prime-factorizer.ts';
import { analyze, smallestDivisors, type Analysis } from '../../../lib/math/arithmetic.ts';
import { abs, digitCount } from '../../../lib/math/bigint.ts';
import { factorTreeLayout } from '../../../lib/math/factor-tree.ts';
import { mergeFactorizations, type Factorization } from '../../../lib/math/factorize.ts';
import { mayBeIncomplete, parseInteger, type ParseError, type ParseResult } from '../../../lib/math/parse.ts';
import { writeToClipboard } from './clipboard.ts';
import { FactorEngine, isAbortError, type FactorProgressUpdate } from './engine.ts';
import {
  DIVISOR_CAP,
  DIVISOR_PREVIEW,
  EXTRA_TIME_MS,
  MAX_DIGITS,
  PROGRESS_DELAY_MS,
  TIME_LIMIT_MS,
} from './limits.ts';
import {
  renderCanonical,
  renderDivisorList,
  renderFunctions,
  renderNotes,
  renderProperties,
  renderTree,
  type Note,
} from './render.ts';
import {
  copyText,
  divisorsCopyText,
  factorTerms,
  formatBig,
  formatSeconds,
  groupSeparator,
  spokenText,
} from './text.ts';

/** Characters that mean "a formula was typed": they get the "write out the digits" message. */
const FORMULA_CHARS = new Set(['^', '*', '×', '·', '/', '÷', '(', ')', '!', 'e', 'E', '%', '=']);
/** How long a Copy button says "Copied". */
const COPIED_MS = 2000;

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Prime factorizer: missing element ${selector}`);
  return element;
}

function getElements(root: HTMLElement) {
  return {
    announcer: query<HTMLElement>(root, '[data-announcer]'),
    form: query<HTMLFormElement>(root, '[data-form]'),
    input: query<HTMLInputElement>(root, '[data-input]'),
    message: query<HTMLElement>(root, '[data-message]'),
    preview: query<HTMLElement>(root, '[data-preview]'),
    examples: Array.from(root.querySelectorAll<HTMLButtonElement>('[data-example]')),
    progress: query<HTMLElement>(root, '[data-progress]'),
    progressText: query<HTMLElement>(root, '[data-progress-text]'),
    cancel: query<HTMLButtonElement>(root, '[data-cancel]'),
    status: query<HTMLElement>(root, '[data-status]'),
    result: query<HTMLElement>(root, '[data-result]'),
    number: query<HTMLElement>(root, '[data-number]'),
    digits: query<HTMLElement>(root, '[data-digits]'),
    kind: query<HTMLElement>(root, '[data-kind]'),
    canonicalBlock: query<HTMLElement>(root, '[data-canonical-block]'),
    canonical: query<HTMLElement>(root, '[data-canonical]'),
    canonicalSpoken: query<HTMLElement>(root, '[data-canonical-spoken]'),
    copyFactorization: query<HTMLButtonElement>(root, '[data-copy="factorization"]'),
    notes: query<HTMLElement>(root, '[data-notes]'),
    searchLonger: query<HTMLButtonElement>(root, '[data-search-longer]'),
    searchLongerLabel: query<HTMLElement>(root, '[data-search-longer-label]'),
    figure: query<HTMLElement>(root, '[data-figure]'),
    tree: query<SVGSVGElement>(root, '[data-tree]'),
    functions: query<HTMLElement>(root, '[data-functions]'),
    functionList: query<HTMLElement>(root, '[data-function-list]'),
    propertyList: query<HTMLElement>(root, '[data-property-list]'),
    divisors: query<HTMLElement>(root, '[data-divisors]'),
    divisorCount: query<HTMLElement>(root, '[data-divisor-count]'),
    divisorList: query<HTMLElement>(root, '[data-divisor-list]'),
    divisorNote: query<HTMLElement>(root, '[data-divisor-note]'),
    divisorToggle: query<HTMLButtonElement>(root, '[data-divisor-toggle]'),
    divisorToggleLabel: query<HTMLElement>(root, '[data-divisor-toggle-label]'),
    copyDivisors: query<HTMLButtonElement>(root, '[data-copy="divisors"]'),
  };
}

/** What the result area shows. */
interface Shown {
  value: bigint;
  /** null for 0, which has no factorization. */
  result: Factorization | null;
  analysis: Analysis;
  elapsedMs: number;
}

export function initPrimeFactorizer(root: HTMLElement): void {
  if (root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const el = getElements(root);
  const locale = getPageLocale();
  const m = primeFactorizerMessages[locale];
  const parseOptions = { groupSeparator: groupSeparator(locale), maxDigits: MAX_DIGITS };
  const engine = new FactorEngine();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let shown: Shown | null = null;
  /** Generation of the latest run; results of older runs are dropped. */
  let job = 0;
  let running = false;
  /** A fresh number, or "search longer" on the cofactors of the one shown. */
  let runKind: 'fresh' | 'continue' = 'fresh';
  let runStart = 0;
  let lastProgress: FactorProgressUpdate | null = null;
  let progressDelay = 0;
  let ticker = 0;
  let announceTimer = 0;
  let divisorsExpanded = false;
  /** Up to DIVISOR_CAP divisors of the shown number, computed on first need. */
  let allDivisors: bigint[] | null = null;

  const big = (value: bigint) => formatBig(value, locale);

  // ---------------------------------------------------------------- messages

  function announce(message: string): void {
    window.clearTimeout(announceTimer);
    el.announcer.textContent = '';
    // Re-setting after a tick makes screen readers repeat identical messages.
    announceTimer = window.setTimeout(() => {
      el.announcer.textContent = message;
    }, 50);
  }

  function setStatus(message: string, tone: 'neutral' | 'error' = 'neutral'): void {
    el.status.textContent = message;
    el.status.dataset.tone = tone;
  }

  // ---------------------------------------------------------------- validation

  function errorText(error: ParseError): string {
    switch (error.code) {
      case 'empty':
        return m.errors.empty;
      case 'invalid-char':
        return FORMULA_CHARS.has(error.char) ? m.errors.expression : m.errors.invalidChar(error.char);
      case 'decimal':
        return m.errors.decimal;
      case 'grouping':
        return m.errors.grouping;
      case 'sign':
        return m.errors.sign;
      case 'no-digits':
        return m.errors.noDigits;
      case 'too-long':
        return m.errors.tooLong(error.digits, error.max);
    }
  }

  function setError(text: string): void {
    el.message.textContent = text;
    if (text) el.input.setAttribute('aria-invalid', 'true');
    else el.input.removeAttribute('aria-invalid');
  }

  /**
   * Parses the field and updates the preview and the error message. While typing (`eager`
   * false), an empty field and a number that is merely unfinished ("1,", "-") show nothing.
   */
  function validate(eager: boolean): ParseResult {
    const text = el.input.value;
    const parsed = parseInteger(text, parseOptions);
    if (parsed.ok) {
      setError('');
      el.preview.textContent = m.form.preview(big(parsed.value), parsed.digits);
      return parsed;
    }
    el.preview.textContent = '';
    const quiet = !eager && (parsed.error.code === 'empty' || mayBeIncomplete(text, parseOptions));
    setError(quiet ? '' : errorText(parsed.error));
    return parsed;
  }

  // ---------------------------------------------------------------- progress

  function tick(): void {
    const elapsed = formatSeconds(performance.now() - runStart, locale, m.status.seconds);
    el.progressText.textContent =
      lastProgress && lastProgress.digits > 0
        ? m.status.progress(lastProgress.digits, lastProgress.found, elapsed)
        : elapsed;
  }

  function startProgress(kind: 'fresh' | 'continue'): void {
    running = true;
    runKind = kind;
    lastProgress = null;
    runStart = performance.now();
    el.result.setAttribute('aria-busy', 'true');
    el.searchLonger.hidden = true;
    window.clearTimeout(progressDelay);
    window.clearInterval(ticker);
    // Quick results never show the row (nor dim the old result), so nothing flickers.
    progressDelay = window.setTimeout(() => {
      el.progress.hidden = false;
      // The result on screen belongs to the previous number while a new one is searched.
      if (kind === 'fresh') el.result.dataset.stale = 'true';
      tick();
      ticker = window.setInterval(tick, 200);
      announce(m.status.factoring);
    }, PROGRESS_DELAY_MS);
  }

  function stopProgress(): void {
    running = false;
    el.result.removeAttribute('aria-busy');
    delete el.result.dataset.stale;
    window.clearTimeout(progressDelay);
    window.clearInterval(ticker);
    // The Cancel button is about to disappear: keep keyboard focus in the tool.
    const hadFocus = el.progress.contains(document.activeElement);
    el.progress.hidden = true;
    el.progressText.textContent = '';
    if (hadFocus) el.input.focus({ preventScroll: true });
  }

  /**
   * `alreadyFound`: prime factors an earlier search found. A continuation only factors the
   * cofactors left over, so the worker's own count starts again from zero.
   */
  function onProgress(token: number, alreadyFound = 0) {
    return (update: FactorProgressUpdate) => {
      if (token === job) lastProgress = { ...update, found: update.found + alreadyFound };
    };
  }

  /**
   * After a fresh run is cancelled or fails, the result on screen is still the previous
   * number's: it goes, so nothing suggests it answers the number in the field.
   */
  function dropStaleResult(): void {
    if (runKind !== 'fresh') return;
    shown = null;
    allDivisors = null;
    el.result.hidden = true;
  }

  function onFailure(token: number) {
    return (error: unknown) => {
      if (token !== job || isAbortError(error)) return;
      stopProgress();
      dropStaleResult();
      setStatus(m.status.failed, 'error');
      announce(m.status.failed);
    };
  }

  // ---------------------------------------------------------------- runs

  function factor(value: bigint): void {
    const token = ++job;
    setStatus('');
    const magnitude = abs(value);
    if (magnitude < 2n) {
      // 0 and ±1 need no search.
      engine.cancel();
      stopProgress();
      show(value, magnitude === 0n ? null : { factors: [], unfactored: [], probable: [] }, 0);
      return;
    }
    startProgress('fresh');
    engine
      .run([magnitude], TIME_LIMIT_MS, onProgress(token))
      .then(({ result, elapsedMs }) => {
        if (token !== job) return;
        stopProgress();
        show(value, result, elapsedMs);
      })
      .catch(onFailure(token));
  }

  /** Carries on with the cofactors the last search could not split. */
  function searchLonger(): void {
    const previous = shown;
    if (!previous?.result || previous.result.unfactored.length === 0) return;
    const token = ++job;
    const earlier = previous.result;
    const alreadyFound = earlier.factors.reduce((count, [, exponent]) => count + exponent, 0);
    setStatus('');
    startProgress('continue');
    engine
      .run(earlier.unfactored, EXTRA_TIME_MS, onProgress(token, alreadyFound))
      .then(({ result, elapsedMs }) => {
        if (token !== job) return;
        stopProgress();
        show(previous.value, mergeFactorizations(earlier, result), previous.elapsedMs + elapsedMs);
      })
      .catch(onFailure(token));
    el.input.focus({ preventScroll: true });
  }

  function cancel(): void {
    if (!running) return;
    job++;
    engine.cancel();
    stopProgress();
    dropStaleResult();
    setStatus(m.status.cancelled);
    announce(m.status.cancelled);
    // A cancelled continuation leaves the previous result as it was, with its button.
    if (shown?.result && shown.result.unfactored.length > 0) el.searchLonger.hidden = false;
  }

  // ---------------------------------------------------------------- result

  function kindLabel(analysis: Analysis): { text: string; tone: 'accent' | 'muted' } {
    const k = m.result.kind;
    switch (analysis.kind) {
      case 'zero':
        return { text: k.zero, tone: 'muted' };
      case 'unit':
        return { text: k.unit, tone: 'muted' };
      case 'prime':
        return { text: analysis.probable ? k.probablePrime : k.prime, tone: 'accent' };
      case 'composite':
        return { text: k.composite, tone: 'muted' };
    }
  }

  function show(value: bigint, result: Factorization | null, elapsedMs: number): void {
    const analysis = analyze(value, result);
    shown = { value, result, analysis, elapsedMs };
    allDivisors = null;
    divisorsExpanded = false;

    const { negative, magnitude } = analysis;
    const terms = result ? factorTerms(result) : [];
    const unfactoredTerms = terms.filter((term) => term.kind === 'unfactored').length;

    el.result.hidden = false;
    el.number.textContent = `n = ${big(value)}`;
    el.digits.textContent = m.result.digits(digitCount(value));
    const kind = kindLabel(analysis);
    el.kind.textContent = kind.text;
    el.kind.dataset.tone = kind.tone;

    // The product, drawn and spoken.
    let spoken = '';
    el.canonicalBlock.hidden = analysis.kind === 'zero';
    if (analysis.kind === 'unit') {
      el.canonical.textContent = big(value);
      el.canonical.dataset.size = 'short';
      spoken = negative ? m.result.spoken.minusOne : '1';
    } else if (result) {
      renderCanonical(el.canonical, terms, negative, locale);
      spoken = spokenText(terms, negative, locale, m.result.spoken);
    }
    el.canonicalSpoken.textContent = spoken;
    resetCopyButton(el.copyFactorization);

    const notes: Note[] = [];
    if (analysis.kind === 'zero') notes.push({ text: m.result.notes.zero });
    else if (analysis.kind === 'unit') notes.push({ text: negative ? m.result.notes.minusOne : m.result.notes.one });
    else if (negative) notes.push({ text: m.result.notes.negative(big(magnitude)) });
    if (analysis.probable) notes.push({ text: m.result.notes.probable });
    if (!analysis.complete) notes.push({ text: m.result.notes.incomplete(unfactoredTerms), tone: 'warning' });
    renderNotes(el.notes, notes);

    el.searchLonger.hidden = analysis.complete;
    el.searchLongerLabel.textContent = m.result.searchLonger(
      m.status.seconds(formatters(locale).number(EXTRA_TIME_MS / 1000)),
    );

    // Factor tree: only when there is a prime factor to draw.
    const layout = result ? factorTreeLayout(magnitude, result) : null;
    el.figure.hidden = layout === null;
    if (layout) renderTree(el.tree, layout, m);

    const hasFunctions = analysis.kind !== 'zero' && result !== null;
    el.functions.hidden = !hasFunctions;
    el.divisors.hidden = !hasFunctions;
    if (hasFunctions && result) {
      renderFunctions(el.functionList, analysis, result, locale, m);
      renderProperties(el.propertyList, analysis, locale, m);
      renderDivisors();
    }

    announce(summary(analysis, spoken, elapsedMs, unfactoredTerms));
    revealResult();
  }

  function summary(analysis: Analysis, spoken: string, elapsedMs: number, unfactoredTerms: number): string {
    const value = big(analysis.value);
    if (analysis.kind === 'zero') return m.result.notes.zero;
    if (analysis.kind === 'unit') return analysis.negative ? m.result.notes.minusOne : m.result.notes.one;
    if (!analysis.complete) {
      return `${m.status.announceIncomplete(unfactoredTerms, formatSeconds(elapsedMs, locale, m.status.seconds))} ${m.status.announceFactors(value, spoken)}`;
    }
    if (analysis.kind === 'prime' && !analysis.negative) {
      return analysis.probable ? m.status.announceProbablePrime(value) : m.status.announcePrime(value);
    }
    return m.status.announceFactors(value, spoken);
  }

  /** Brings the result into view when it starts near or below the bottom of the screen. */
  function revealResult(): void {
    const top = el.result.getBoundingClientRect().top;
    if (top > window.innerHeight * 0.85) {
      el.result.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    }
  }

  // ---------------------------------------------------------------- divisors

  function divisorsUpToCap(result: Factorization): bigint[] {
    allDivisors ??= smallestDivisors(result.factors, DIVISOR_CAP);
    return allDivisors;
  }

  function renderDivisors(): void {
    const current = shown;
    if (!current?.result) return;
    const { analysis, result } = current;
    const total = analysis.divisorCount;

    if (!analysis.complete || total === null) {
      el.divisorCount.textContent = '';
      el.divisorList.replaceChildren();
      el.divisorList.removeAttribute('tabindex');
      el.divisorNote.textContent = m.divisors.unavailable;
      el.divisorToggle.hidden = true;
      el.copyDivisors.hidden = true;
      return;
    }

    el.divisorCount.textContent = m.divisors.count(big(total), total === 1n);
    // Past the cap, Copy (like the expanded list) takes only the smallest DIVISOR_CAP divisors.
    const capped = total > BigInt(DIVISOR_CAP);
    const cap = big(BigInt(DIVISOR_CAP));
    el.copyDivisors.hidden = false;
    el.copyDivisors.setAttribute('aria-label', capped ? m.result.copySmallestDivisors(cap) : m.result.copyDivisors);
    resetCopyButton(el.copyDivisors);

    const list = divisorsExpanded
      ? divisorsUpToCap(result)
      : allDivisors?.slice(0, DIVISOR_PREVIEW) ?? smallestDivisors(result.factors, DIVISOR_PREVIEW);
    renderDivisorList(el.divisorList, list, locale);
    const more = total > BigInt(list.length);
    if (more && !divisorsExpanded) {
      // An ellipsis closes the preview; the button below says how many there are.
      const ellipsis = document.createElement('li');
      ellipsis.setAttribute('aria-hidden', 'true');
      ellipsis.className = 'px-1 py-0.5 text-zinc-500 dark:text-zinc-400';
      ellipsis.textContent = '…';
      el.divisorList.append(ellipsis);
    }
    // Only an expanded list scrolls inside its box, and only then does it need keyboard focus.
    if (divisorsExpanded) el.divisorList.tabIndex = 0;
    else el.divisorList.removeAttribute('tabindex');

    el.divisorNote.textContent =
      divisorsExpanded && more
        ? m.divisors.truncated(big(BigInt(list.length)), big(total))
        : capped
          ? m.divisors.copyLimit(cap, big(total))
          : '';

    const expandable = total > BigInt(DIVISOR_PREVIEW);
    el.divisorToggle.hidden = !expandable;
    el.divisorToggle.toggleAttribute('data-expanded', divisorsExpanded);
    el.divisorToggleLabel.textContent = divisorsExpanded
      ? m.divisors.showFewer
      : capped
        ? m.divisors.showFirst(cap)
        : m.divisors.showAll(big(total));
  }

  // ---------------------------------------------------------------- copy

  const copiedTimers = new WeakMap<HTMLButtonElement, number>();

  function resetCopyButton(button: HTMLButtonElement): void {
    window.clearTimeout(copiedTimers.get(button));
    delete button.dataset.state;
    query<HTMLElement>(button, '[data-copy-label]').textContent = m.result.copy;
  }

  async function copy(button: HTMLButtonElement, text: string, announcement = m.result.copiedAnnouncement): Promise<void> {
    const copied = await writeToClipboard(text);
    window.clearTimeout(copiedTimers.get(button));
    if (!copied) {
      setStatus(m.result.copyFailed, 'error');
      announce(m.result.copyFailed);
      return;
    }
    setStatus('');
    button.dataset.state = 'copied';
    query<HTMLElement>(button, '[data-copy-label]').textContent = m.result.copied;
    announce(announcement);
    copiedTimers.set(
      button,
      window.setTimeout(() => resetCopyButton(button), COPIED_MS),
    );
  }

  el.copyFactorization.addEventListener('click', () => {
    const current = shown;
    if (!current || current.analysis.kind === 'zero') return;
    const text =
      current.analysis.kind === 'unit'
        ? current.value.toString()
        : copyText(factorTerms(current.result as Factorization), current.analysis.negative);
    void copy(el.copyFactorization, text);
  });

  el.copyDivisors.addEventListener('click', () => {
    const current = shown;
    if (!current?.result || !current.analysis.complete) return;
    const capped = current.analysis.divisorCount !== null && current.analysis.divisorCount > BigInt(DIVISOR_CAP);
    void copy(
      el.copyDivisors,
      divisorsCopyText(divisorsUpToCap(current.result)),
      capped ? m.result.copiedSmallestDivisors(big(BigInt(DIVISOR_CAP))) : m.result.copiedAnnouncement,
    );
  });

  // ---------------------------------------------------------------- events

  el.input.addEventListener('input', () => validate(false));
  el.input.addEventListener('blur', () => {
    if (el.input.value.trim() !== '') validate(true);
  });

  el.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const parsed = validate(true);
    if (!parsed.ok) {
      el.input.focus();
      return;
    }
    factor(parsed.value);
  });

  for (const button of el.examples) {
    button.addEventListener('click', () => {
      const value = button.dataset.example ?? '';
      el.input.value = value;
      const parsed = validate(true);
      if (parsed.ok) factor(parsed.value);
    });
  }

  el.cancel.addEventListener('click', cancel);
  el.searchLonger.addEventListener('click', searchLonger);

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && running && !event.isComposing) {
      event.preventDefault();
      cancel();
    }
  });

  el.divisorToggle.addEventListener('click', () => {
    divisorsExpanded = !divisorsExpanded;
    renderDivisors();
  });

  // A search running when the page is hidden for good (or put in the back/forward cache)
  // is stopped; the worker would otherwise keep a core busy.
  window.addEventListener('pagehide', () => {
    if (running) cancel();
    engine.dispose();
  });

  // The field may hold a value restored by the browser (history navigation): validate it.
  window.addEventListener('pageshow', () => {
    window.setTimeout(() => {
      if (el.input.value.trim() !== '') validate(false);
    }, 0);
  });
}
