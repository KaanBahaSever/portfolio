/**
 * Binary ↔ text converter: DOM wiring and state (browser only). Nothing is stored or sent.
 *
 * Direction: the field edited last is the input and the other one follows. Script only ever
 * writes to the following field, and assigning .value fires no input event, so an update can
 * never echo back. When the input has an error, the following field keeps its last value and
 * is marked out of date rather than being emptied while someone is typing.
 *
 * The engine (src/lib/text/binary.ts) returns codes with positions; this file turns them into
 * the page language's messages and points at the spot in the field.
 */

import { getPageLocale } from '../../../i18n/client.ts';
import { formatters } from '../../../i18n/format.ts';
import { binaryTextMessages, type Utf8Detail } from '../../../i18n/tools/binary-text.ts';
import {
  DEFAULT_FORMAT,
  byteToBits,
  byteToHex,
  decodeBinary,
  encodeText,
  excerpt,
  formatBinary,
  formatCodePoint,
  invisibleName,
  isGrouping,
  isSeparator,
  reformatBinary,
  type DecodeError,
  type EncodeError,
  type FormatOptions,
  type Span,
} from '../../../lib/text/binary.ts';
import { countCharactersBounded, utf8ByteLength } from '../../../lib/text/stats.ts';
import { createBreakdown } from './breakdown.ts';
import { writeToClipboard } from './clipboard.ts';

type Side = 'text' | 'binary';
type Direction = 'text-to-binary' | 'binary-to-text';

interface Problem {
  /** The field the problem is in (always the input side). */
  side: Side;
  message: string;
  hint: string;
  span: Span | null;
}

const SIDES: readonly Side[] = ['text', 'binary'];
/** Problems are read out once typing pauses, not at every keystroke. */
const ANNOUNCE_DELAY_MS = 900;
/** How long a Copy button says "Copied". */
const COPIED_MS = 2000;
/** Longer texts (already over the size limit) are counted in code points instead of graphemes. */
const GRAPHEME_LIMIT = 50_000;

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Binary converter: missing element ${selector}`);
  return element;
}

function getElements(root: HTMLElement) {
  const bySide = <T extends Element>(selector: (side: Side) => string) =>
    ({ text: query<T>(root, selector('text')), binary: query<T>(root, selector('binary')) }) as Record<Side, T>;
  return {
    announcer: query<HTMLElement>(root, '[data-announcer]'),
    panes: query<HTMLElement>(root, '[data-panes]'),
    pane: bySide<HTMLElement>((side) => `[data-pane="${side}"]`),
    field: bySide<HTMLTextAreaElement>((side) => `[data-field="${side}"]`),
    roleTag: bySide<HTMLElement>((side) => `[data-pane="${side}"] [data-role-tag]`),
    roleWord: bySide<HTMLElement>((side) => `[data-pane="${side}"] [data-role-word]`),
    count: bySide<HTMLElement>((side) => `[data-count="${side}"]`),
    copy: bySide<HTMLButtonElement>((side) => `[data-copy="${side}"]`),
    copyLabel: bySide<HTMLElement>((side) => `[data-copy="${side}"] [data-copy-label]`),
    pending: query<HTMLElement>(root, '[data-pending]'),
    copyStatus: query<HTMLElement>(root, '[data-copy-status]'),
    problem: query<HTMLElement>(root, '[data-problem]'),
    problemMessage: query<HTMLElement>(root, '[data-problem-message]'),
    problemExcerpt: query<HTMLElement>(root, '[data-problem-excerpt]'),
    problemHint: query<HTMLElement>(root, '[data-problem-hint]'),
    problemShow: query<HTMLButtonElement>(root, '[data-problem-show]'),
    separators: Array.from(root.querySelectorAll<HTMLInputElement>('[data-separator]')),
    groupings: Array.from(root.querySelectorAll<HTMLInputElement>('[data-grouping]')),
    groupingFieldset: query<HTMLFieldSetElement>(root, '[data-grouping-fieldset]'),
    groupingHint: query<HTMLElement>(root, '[data-grouping-hint]'),
    ascii: query<HTMLInputElement>(root, '[data-ascii]'),
    examples: Array.from(root.querySelectorAll<HTMLButtonElement>('[data-example]')),
    clear: query<HTMLButtonElement>(root, '[data-clear]'),
  };
}

/** Bits typed in binary input that does not parse, for the counter (0b prefixes left out). */
function roughBitCount(input: string): number {
  let bits = 0;
  for (const match of input.matchAll(/0[bB]|[01]/g)) if (match[0].length === 1) bits++;
  return bits;
}

export function initBinaryText(root: HTMLElement): void {
  if (root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const el = getElements(root);
  const locale = getPageLocale();
  const m = binaryTextMessages[locale];
  const table = createBreakdown(root, m, formatters(locale));

  let direction: Direction = 'text-to-binary';
  let problem: Problem | null = null;
  const stale: Record<Side, boolean> = { text: false, binary: false };
  /** Counter values for the binary field. */
  let binaryBits = 0;
  let binaryBytes = 0;
  let pendingNote = '';
  /** The problem message last read out (null: none), so a problem is not repeated and a fix is noticed. */
  let announcedProblem: string | null = null;
  let problemTimer = 0;
  let speakTimer = 0;
  const copiedTimer: Record<Side, number> = { text: 0, binary: 0 };

  // ---------------------------------------------------------------- announcements

  function speak(message: string): void {
    window.clearTimeout(speakTimer);
    el.announcer.textContent = '';
    // Re-setting after a tick makes screen readers repeat identical messages.
    speakTimer = window.setTimeout(() => {
      el.announcer.textContent = message;
    }, 50);
  }

  /** After typing pauses: read out a new problem, or that the last one is fixed. */
  function scheduleProblemAnnouncement(): void {
    window.clearTimeout(problemTimer);
    problemTimer = window.setTimeout(() => {
      const message = problem?.message ?? null;
      if (message === announcedProblem) return;
      if (message) speak(message);
      else speak(m.announce.fixed);
      announcedProblem = message;
    }, ANNOUNCE_DELAY_MS);
  }

  /** Reads out `message` now (the result of a click); the current problem counts as heard. */
  function announceNow(message: string): void {
    window.clearTimeout(problemTimer);
    announcedProblem = problem?.message ?? null;
    if (message) speak(message);
  }

  // ---------------------------------------------------------------- reading the options

  function readFormat(): FormatOptions {
    const separator = el.separators.find((input) => input.checked)?.value;
    const grouping = el.groupings.find((input) => input.checked)?.value;
    return {
      separator: isSeparator(separator) ? separator : DEFAULT_FORMAT.separator,
      grouping: isGrouping(grouping) ? grouping : DEFAULT_FORMAT.grouping,
    };
  }

  /** Grouping means nothing without a separator: disable it and say why. */
  function renderGroupingState(): void {
    const none = readFormat().separator === 'none';
    el.groupingFieldset.disabled = none;
    el.groupingHint.textContent = none ? m.options.groupingDisabled : m.options.groupingHint;
  }

  // ---------------------------------------------------------------- problems in words

  function where(span: Span): string {
    return m.problems.where(span.line, span.column);
  }

  /** An invisible character is named (LF, NBSP, ZWJ…), so the quotes never look empty. */
  function visibleChar(char: string, codePoint: number): string {
    return invisibleName(codePoint) ?? char;
  }

  function describeEncodeError(error: EncodeError, text: string): Problem {
    switch (error.code) {
      case 'too-long':
        return { side: 'text', message: m.problems.tooLong(error.limit), hint: m.problems.tooLongHint, span: null };
      case 'lone-surrogate':
        return {
          side: 'text',
          message: m.problems.loneSurrogate(where(error.span), formatCodePoint(error.unit)),
          hint: m.problems.loneSurrogateHint,
          span: error.span,
        };
      case 'non-ascii': {
        const char = text.slice(error.span.start, error.span.end);
        return {
          side: 'text',
          message: m.problems.nonAsciiText(
            where(error.span),
            visibleChar(char, error.codePoint),
            formatCodePoint(error.codePoint),
            error.count,
          ),
          hint: m.problems.nonAsciiTextHint,
          span: error.span,
        };
      }
    }
  }

  function describeDecodeError(error: DecodeError): Problem {
    switch (error.code) {
      case 'too-long':
        return { side: 'binary', message: m.problems.tooLong(error.limit), hint: m.problems.tooLongHint, span: null };
      case 'invalid-character':
        return {
          side: 'binary',
          message: m.problems.invalidCharacter(
            where(error.span),
            visibleChar(error.char, error.codePoint),
            formatCodePoint(error.codePoint),
          ),
          hint: m.problems.invalidCharacterHint,
          span: error.span,
        };
      case 'group-length':
        return {
          side: 'binary',
          message: m.problems.groupLength(where(error.span), error.group, error.bits),
          hint: m.problems.groupLengthHint,
          span: error.span,
        };
      case 'non-ascii':
        return {
          side: 'binary',
          message: m.problems.nonAsciiByte(where(error.span), error.byte + 1, error.value, byteToBits(error.value), error.count),
          hint: m.problems.nonAsciiByteHint,
          span: error.span,
        };
      case 'invalid-utf8': {
        const { issue } = error;
        const detail: Utf8Detail = {
          hex: `0x${byteToHex(error.value)}`,
          expected: issue.expected,
          at: issue.at + 1,
          present: issue.end - issue.start,
        };
        return {
          side: 'binary',
          message: m.problems.invalidUtf8(where(error.span), error.byte + 1, m.problems.utf8[issue.problem](detail)),
          hint: '',
          span: error.span,
        };
      }
    }
  }

  // ---------------------------------------------------------------- rendering

  function renderDirection(): void {
    el.panes.dataset.direction = direction;
    const input: Side = direction === 'text-to-binary' ? 'text' : 'binary';
    for (const side of SIDES) {
      const isInput = side === input;
      el.roleTag[side].dataset.role = isInput ? 'input' : 'output';
      el.roleWord[side].textContent = isInput ? m.roles.input : m.roles.output;
      el.field[side].toggleAttribute('data-output', !isInput);
    }
  }

  function setDirection(next: Direction): void {
    if (next === direction) return;
    direction = next;
    renderDirection();
  }

  /** Descriptions and validity of both fields: hint, then "out of date", then the problem. */
  function renderFieldStates(): void {
    for (const side of SIDES) {
      const field = el.field[side];
      const ids = [`bt-${side}-hint`];
      if (stale[side]) ids.push(`bt-${side}-stale`);
      if (problem?.side === side) ids.push('bt-problem-message');
      field.setAttribute('aria-describedby', ids.join(' '));
      if (problem?.side === side) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
      field.toggleAttribute('data-stale', stale[side]);
      el.pane[side].toggleAttribute('data-stale', stale[side]);
    }
  }

  function renderExcerpt(current: Problem): void {
    const span = current.span;
    if (!span) {
      el.problemExcerpt.replaceChildren();
      return;
    }
    const view = excerpt(el.field[current.side].value, span.start, span.end);
    const mark = document.createElement('mark');
    mark.className =
      'rounded-sm bg-rose-200 px-0.5 font-semibold text-rose-950 underline decoration-rose-700 decoration-wavy underline-offset-4 dark:bg-rose-400/30 dark:text-rose-50 dark:decoration-rose-300';
    mark.textContent = view.focus;
    el.problemExcerpt.replaceChildren(
      `${view.clippedStart ? '…' : ''}${view.before}`,
      mark,
      `${view.after}${view.clippedEnd ? '…' : ''}`,
    );
  }

  function renderProblem(): void {
    el.problem.hidden = problem === null;
    if (problem) {
      el.problemMessage.textContent = problem.message;
      el.problemHint.textContent = problem.hint;
      renderExcerpt(problem);
      el.problemShow.hidden = problem.span === null;
    } else {
      el.problemMessage.textContent = '';
      el.problemHint.textContent = '';
      el.problemExcerpt.replaceChildren();
    }
  }

  function renderCounts(): void {
    const text = el.field.text.value;
    const characters = countCharactersBounded(text, GRAPHEME_LIMIT).count;
    el.count.text.textContent = `${m.counts.characters(characters)} · ${m.counts.bytes(utf8ByteLength(text))}`;
    el.count.binary.textContent = `${m.counts.bits(binaryBits)} · ${m.counts.bytes(binaryBytes)}`;
    el.pending.textContent = pendingNote;
  }

  function resetCopy(side: Side): void {
    window.clearTimeout(copiedTimer[side]);
    el.copy[side].dataset.state = 'idle';
    el.copyLabel[side].textContent = m.copy.label;
  }

  function renderButtons(): void {
    for (const side of SIDES) {
      el.copy[side].disabled = el.field[side].value === '' || stale[side];
      resetCopy(side);
    }
    el.clear.disabled = el.field.text.value === '' && el.field.binary.value === '';
    el.copyStatus.textContent = '';
  }

  /** Cheap enough to run on every keystroke: the table only rebuilds rows that changed. */
  function renderBreakdown(): void {
    table.render(el.field.text.value, { ascii: el.ascii.checked, stale: stale.text });
  }

  function afterConversion(): void {
    renderFieldStates();
    renderProblem();
    renderCounts();
    renderButtons();
    renderBreakdown();
  }

  // ---------------------------------------------------------------- conversion

  function convertFromText(): void {
    const text = el.field.text.value;
    const result = encodeText(text, { ascii: el.ascii.checked });
    pendingNote = '';
    stale.text = false;
    if (result.ok) {
      el.field.binary.value = formatBinary(result.bytes, readFormat());
      binaryBytes = result.bytes.length;
      binaryBits = binaryBytes * 8;
      problem = null;
      stale.binary = false;
    } else {
      problem = describeEncodeError(result.error, text);
      stale.binary = true;
    }
    afterConversion();
  }

  function convertFromBinary(): void {
    const input = el.field.binary.value;
    const result = decodeBinary(input, { ascii: el.ascii.checked, partial: true });
    stale.binary = false;
    if (result.ok) {
      el.field.text.value = result.text;
      const pending = result.pending;
      binaryBytes = result.bytes.length;
      binaryBits = binaryBytes * 8 + (pending?.bits ?? 0);
      pendingNote = !pending
        ? ''
        : pending.bytes > 0
          ? m.pending.bytes(pending.bytes, pending.expected)
          : m.pending.bits(pending.bits);
      problem = null;
      stale.text = false;
    } else {
      binaryBits = roughBitCount(input);
      binaryBytes = Math.floor(binaryBits / 8);
      pendingNote = '';
      problem = describeDecodeError(result.error);
      stale.text = true;
    }
    afterConversion();
  }

  function convert(): void {
    if (direction === 'text-to-binary') convertFromText();
    else convertFromBinary();
  }

  // ---------------------------------------------------------------- editing

  el.field.text.addEventListener('input', () => {
    setDirection('text-to-binary');
    convertFromText();
    scheduleProblemAnnouncement();
  });

  el.field.binary.addEventListener('input', () => {
    setDirection('binary-to-text');
    convertFromBinary();
    scheduleProblemAnnouncement();
  });

  el.problemShow.addEventListener('click', () => {
    const current = problem;
    if (!current?.span) return;
    const field = el.field[current.side];
    field.focus();
    field.setSelectionRange(current.span.start, current.span.end);
  });

  // ---------------------------------------------------------------- options

  function onLayoutChange(): void {
    renderGroupingState();
    if (direction === 'text-to-binary') {
      convertFromText();
      announceNow(problem ? m.announce.layoutPending : m.announce.reformatted);
      return;
    }
    // Binary typed by hand is rewritten only when it decodes; an unfinished last byte is kept.
    const next = reformatBinary(el.field.binary.value, readFormat(), { ascii: el.ascii.checked });
    if (next === null) {
      announceNow(m.announce.layoutPending);
      return;
    }
    el.field.binary.value = next;
    convertFromBinary();
    announceNow(m.announce.reformatted);
  }

  for (const input of [...el.separators, ...el.groupings]) input.addEventListener('change', onLayoutChange);

  el.ascii.addEventListener('change', () => {
    const before = problem?.message ?? null;
    convert();
    const after = problem?.message ?? null;
    // The checkbox announces its own state; add only what changed because of it.
    announceNow(after && after !== before ? after : !after && before ? m.announce.fixed : '');
  });

  // ---------------------------------------------------------------- actions

  for (const button of el.examples) {
    button.addEventListener('click', () => {
      const value = button.dataset.example ?? '';
      el.field.text.value = value;
      setDirection('text-to-binary');
      convertFromText();
      announceNow(problem ? problem.message : m.announce.example(value, utf8ByteLength(value)));
    });
  }

  el.clear.addEventListener('click', () => {
    el.field.text.value = '';
    el.field.binary.value = '';
    setDirection('text-to-binary');
    convertFromText();
    announceNow(m.announce.cleared);
    // The button just disabled itself; the text field is where to go next.
    el.field.text.focus();
  });

  for (const side of SIDES) {
    el.copy[side].addEventListener('click', async () => {
      const field = el.field[side];
      const value = field.value;
      if (!value || stale[side]) return;
      const copied = await writeToClipboard(value);
      // The field changed while copying: its button no longer describes what was copied.
      if (field.value !== value) return;
      el.copyStatus.textContent = copied ? '' : m.copy.failed;
      if (copied) {
        window.clearTimeout(copiedTimer[side]);
        el.copy[side].dataset.state = 'copied';
        el.copyLabel[side].textContent = m.copy.copied;
        copiedTimer[side] = window.setTimeout(() => resetCopy(side), COPIED_MS);
        announceNow(side === 'text' ? m.copy.textDone : m.copy.binaryDone);
      } else {
        // Select the content so the device's own Copy command is one step away.
        field.focus();
        field.select();
        announceNow(m.copy.failed);
      }
    });
  }

  // ---------------------------------------------------------------- start and page restores

  /** Converts whatever the fields and options show now (restored form state included). */
  function sync(): void {
    renderGroupingState();
    // A restored page may bring back only the binary; convert from the side that has content.
    if (direction === 'text-to-binary' && el.field.text.value === '' && el.field.binary.value !== '') {
      direction = 'binary-to-text';
    }
    renderDirection();
    convert();
    announcedProblem = problem?.message ?? null;
  }

  // Browsers may restore form controls without firing events (history navigation, back/forward
  // cache); convert again once the page is shown, a tick later so that restoring has finished.
  window.addEventListener('pageshow', () => {
    window.setTimeout(sync, 0);
  });

  sync();
}
