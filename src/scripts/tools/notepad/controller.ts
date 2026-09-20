/**
 * Notepad: DOM wiring and state (browser only).
 *
 * The text only ever lives in the textarea. Nothing is stored (no localStorage, cookies or
 * anything else) and nothing is uploaded, so every visit starts with an empty page.
 */

import { saveBlob } from '../../../lib/download.ts';
import { formatBytes } from '../../../lib/files/filename.ts';
import { mimeTypeForFilename, sanitizeFilename } from '../../../lib/files/save-file.ts';
import { decodeTextFile } from '../../../lib/text/decode.ts';
import { buildReplacementPreview } from '../../../lib/text/preview.ts';
import {
  MATCH_LIMIT,
  advanceIndex,
  compileSearch,
  escapeRegExp,
  expandReplacement,
  findMatchWindow,
  firstMatchAtOrAfter,
  lastMatchBefore,
  offsetAfterReplacement,
  replaceAllInText,
} from '../../../lib/text/search.ts';
import type { CompiledSearch, MatchWindow, SearchOptions, TextMatch, WindowRequest } from '../../../lib/text/search.ts';
import { convertLineEndings, countCharactersBounded, lineColumnAt } from '../../../lib/text/stats.ts';
import type { LineEnding, TextStats } from '../../../lib/text/stats.ts';
import { createHighlighter } from './highlighter.ts';
import { IS_APPLE, ariaShortcut, hasPrimaryModifier, isLetter, shortcutLabel } from './keyboard.ts';
import { createSearchRunner } from './search-runner.ts';
import { createStatsRunner } from './stats-runner.ts';

type PanelMode = 'find' | 'replace';
type OptionKey = 'matchCase' | 'wholeWord' | 'regex' | 'multiline' | 'dotAll';
/** A compiled query, or one whose search didn't finish (took too long or failed). */
type SearchStatus = CompiledSearch | { status: 'unfinished'; message: string };

interface UndoState {
  text: string;
  selectionStart: number;
  selectionEnd: number;
  scrollTop: number;
  scrollLeft: number;
}

const DEFAULT_FILENAME = 'untitled.txt';
const MAX_OPEN_BYTES = 20 * 1024 * 1024;
const PREVIEW_LIMIT = 100;
/** Edits up to this many characters go through the browser's editing commands, so Ctrl+Z still works. */
const UNDOABLE_EDIT_LIMIT = 20_000;
/** Above this length, searching and caret updates wait a little longer. */
const LARGE_TEXT = 500_000;
const COUNT_ANNOUNCE_DELAY = 700;
/** Longer selections are counted without grapheme segmentation, which would stall the page. */
const SELECTION_SEGMENT_LIMIT = 100_000;

const SEARCH_TIMEOUT_MESSAGE =
  'Search took too long. Simplify the pattern: nested quantifiers like (a+)+ can run forever.';
const REPLACE_TIMEOUT_MESSAGE =
  'Replace all took too long, so nothing was replaced. Simplify the pattern: nested quantifiers like (a+)+ can run forever.';
const REPLACE_TOO_LARGE_MESSAGE = 'Replace all failed: the result would be too large.';
const REPLACING_MESSAGE = 'Replacing…';

/** How long a regular-expression search may run in the worker before it is abandoned (ms). */
function searchTimeout(length: number): number {
  return 1500 + Math.round(length / 4000);
}

function replaceTimeout(length: number): number {
  return 3000 + Math.round(length / 2000);
}

/** Identifies a compiled pattern with its flags. */
function searchKey(regex: RegExp): string {
  return `${regex.flags}/${regex.source}`;
}

function emptyWindow(): MatchWindow {
  return { matches: [], start: 0, truncated: false };
}

const NUL = String.fromCharCode(0);
const REPLACEMENT_CHARACTER = String.fromCharCode(0xfffd);

const OPTION_KEYS: readonly OptionKey[] = ['matchCase', 'wholeWord', 'regex', 'multiline', 'dotAll'];
const OPTION_LABELS: Record<OptionKey, string> = {
  matchCase: 'Match case',
  wholeWord: 'Match whole word',
  regex: 'Use regular expression',
  multiline: '^ and $ match each line',
  dotAll: 'Dot matches newline',
};
/** Alt (Option) shortcuts while the find panel has focus. */
const OPTION_SHORTCUTS: ReadonlyArray<[OptionKey, string]> = [
  ['matchCase', 'c'],
  ['wholeWord', 'w'],
  ['regex', 'r'],
];

const numberFormat = new Intl.NumberFormat('en');

function formatNumber(value: number): string {
  return numberFormat.format(value);
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`;
}

/** "Invalid regular expression: Unterminated group" from any engine's wording. */
function describeRegexError(message: string): string {
  const detail = message
    .replace(/^(?:SyntaxError:\s*)?Invalid regular expression:\s*/i, '')
    .replace(/^\/.*\/[a-z]*:\s*/s, '');
  return `Invalid regular expression: ${detail || message}`;
}

function detectLineEnding(text: string): LineEnding {
  let crlf = 0;
  let lf = 0;
  for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1)) {
    if (index > 0 && text.charCodeAt(index - 1) === 13) crlf++;
    else lf++;
  }
  return crlf > lf ? 'crlf' : 'lf';
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

function hasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return !!types && Array.from(types).includes('Files');
}

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Notepad: missing element ${selector}`);
  return element;
}

function getElements(root: HTMLElement) {
  const optionButtons = new Map<OptionKey, HTMLButtonElement>();
  for (const key of OPTION_KEYS) {
    optionButtons.set(key, query<HTMLButtonElement>(root, `[data-search-option="${key}"]`));
  }
  return {
    announcer: query<HTMLElement>(root, '[data-announcer]'),
    message: query<HTMLElement>(root, '[data-message]'),
    newButton: query<HTMLButtonElement>(root, '[data-new]'),
    openButton: query<HTMLButtonElement>(root, '[data-open]'),
    openInput: query<HTMLInputElement>(root, '[data-open-input]'),
    findToggle: query<HTMLButtonElement>(root, '[data-find-toggle]'),
    replaceToggle: query<HTMLButtonElement>(root, '[data-replace-toggle]'),
    wrapToggle: query<HTMLButtonElement>(root, '[data-wrap-toggle]'),
    findPanel: query<HTMLElement>(root, '[data-find-panel]'),
    findInput: query<HTMLInputElement>(root, '[data-find-input]'),
    findCount: query<HTMLElement>(root, '[data-find-count]'),
    findError: query<HTMLElement>(root, '[data-find-error]'),
    findPrev: query<HTMLButtonElement>(root, '[data-find-prev]'),
    findNext: query<HTMLButtonElement>(root, '[data-find-next]'),
    findClose: query<HTMLButtonElement>(root, '[data-find-close]'),
    optionButtons,
    regexOnly: Array.from(root.querySelectorAll<HTMLButtonElement>('[data-regex-only]')),
    replaceRow: query<HTMLElement>(root, '[data-replace-row]'),
    replaceInput: query<HTMLInputElement>(root, '[data-replace-input]'),
    replaceOne: query<HTMLButtonElement>(root, '[data-replace-one]'),
    replaceAll: query<HTMLButtonElement>(root, '[data-replace-all]'),
    replaceResult: query<HTMLElement>(root, '[data-replace-result]'),
    replaceResultText: query<HTMLElement>(root, '[data-replace-result-text]'),
    undoReplace: query<HTMLButtonElement>(root, '[data-undo-replace]'),
    preview: query<HTMLDetailsElement>(root, '[data-preview]'),
    previewTitle: query<HTMLElement>(root, '[data-preview-title]'),
    previewList: query<HTMLOListElement>(root, '[data-preview-list]'),
    previewNote: query<HTMLElement>(root, '[data-preview-note]'),
    previewTemplate: query<HTMLTemplateElement>(root, 'template[data-preview-item-template]'),
    editorWrap: query<HTMLElement>(root, '[data-editor-wrap]'),
    mirror: query<HTMLElement>(root, '[data-mirror]'),
    markTemplate: query<HTMLTemplateElement>(root, 'template[data-mark-template]'),
    editor: query<HTMLTextAreaElement>(root, '[data-editor]'),
    caret: query<HTMLElement>(root, '[data-caret]'),
    selectionCount: query<HTMLElement>(root, '[data-selection-count]'),
    saveState: query<HTMLElement>(root, '[data-save-state]'),
    summaries: Array.from(root.querySelectorAll<HTMLElement>('[data-summary]')),
    details: Array.from(root.querySelectorAll<HTMLElement>('[data-detail]')),
    saveBar: query<HTMLElement>(root, '[data-save-bar]'),
    filename: query<HTMLInputElement>(root, '[data-filename]'),
    lineEnding: query<HTMLSelectElement>(root, '[data-line-ending]'),
    save: query<HTMLButtonElement>(root, '[data-save]'),
  };
}

export function initNotepad(root: HTMLElement): void {
  if (root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const el = getElements(root);
  const editor = el.editor;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const highlighter = createHighlighter({ textarea: editor, mirror: el.mirror, markTemplate: el.markTemplate });

  // ---------------------------------------------------------------- state

  /** Incremented on every change of the text. */
  let textVersion = 0;
  /** Text length as of the last statistics run (avoids reading a huge value on every keystroke). */
  let knownLength = 0;
  /** Changed since the last save, open or new. */
  let dirty = false;
  let savedRecently = false;
  let unloadGuardInstalled = false;
  /** True while this code edits the text through the browser's editing commands. */
  let applyingEdit = false;
  let undoState: UndoState | null = null;
  let wrapLines = true;
  let openGeneration = 0;

  const search = {
    open: false,
    mode: 'find' as PanelMode,
    options: { query: '', matchCase: false, wholeWord: false, regex: false, multiline: true, dotAll: false } as SearchOptions,
    compiled: { status: 'empty' } as SearchStatus,
    /** The listed (drawn and navigable) matches: at most MATCH_LIMIT of them. */
    matches: [] as TextMatch[],
    /** More matches follow the listed ones. */
    truncated: false,
    /** 0, or where the listed matches start when they are a window further down a longer list. */
    start: 0,
    current: -1,
    /** textVersion the matches were found in. */
    version: -1,
    /** Offset a new search starts from (the caret when the search began). */
    anchor: 0,
  };

  const runner = createSearchRunner();
  /** Incremented by every search, so results of an older one are ignored. */
  let searchToken = 0;
  /** A regular-expression search waiting for the worker. */
  let pendingSearch: { token: number; reveal: boolean; promise: Promise<void> } | null = null;
  /** The pattern whose search last took too long, and the textVersion it did. */
  let timedOut: { key: string; version: number } | null = null;
  /** Find and replace actions run one after another, each on up-to-date matches. */
  let actionQueue: Promise<void> = Promise.resolve();

  let searchTimer = 0;
  let searchTimerReveals = false;
  let searchingTimer = 0;
  let previewTimer = 0;
  let announceTimer = 0;
  let countAnnounceTimer = 0;
  let countAnnounceWanted = false;
  let caretFrame = 0;
  let caretTimer = 0;
  let caretCache = { version: -1, start: -1, end: -1, direction: '' };

  // ---------------------------------------------------------------- helpers

  function announce(message: string): void {
    window.clearTimeout(announceTimer);
    el.announcer.textContent = '';
    // Re-setting after a tick makes screen readers repeat identical messages.
    announceTimer = window.setTimeout(() => {
      el.announcer.textContent = message;
    }, 50);
  }

  function setMessage(message: string, tone: 'neutral' | 'error' = 'neutral'): void {
    el.message.textContent = message;
    el.message.dataset.tone = tone;
  }

  function getLineEnding(): LineEnding {
    return el.lineEnding.value === 'crlf' ? 'crlf' : 'lf';
  }

  function countLabel(): string {
    // Only lists of more than MATCH_LIMIT matches are truncated or start further down.
    if (search.truncated || search.start > 0) return `${formatNumber(MATCH_LIMIT)}+`;
    return formatNumber(search.matches.length);
  }

  /** "3 of 120", or "10,000+ matches" for a window further down (its position is unknown). */
  function positionLabel(): string {
    if (search.start > 0) return `${countLabel()} matches`;
    return `${formatNumber(search.current + 1)} of ${countLabel()}`;
  }

  function statusProblem(status: SearchStatus): string {
    if (status.status === 'error') return describeRegexError(status.message);
    if (status.status === 'unfinished') return status.message;
    return '';
  }

  // ---------------------------------------------------------------- saved state

  function onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!dirty || editor.value.length === 0) return;
    event.preventDefault();
    // Older browsers need returnValue set to show the prompt.
    event.returnValue = '';
  }

  function updateSaveState(): void {
    if (dirty && knownLength > 0) {
      el.saveState.textContent = 'Unsaved changes';
      el.saveState.dataset.state = 'dirty';
    } else if (savedRecently) {
      el.saveState.textContent = 'Saved';
      el.saveState.dataset.state = 'saved';
    } else {
      el.saveState.textContent = '';
      delete el.saveState.dataset.state;
    }
  }

  function setDirty(value: boolean): void {
    dirty = value;
    // The listener only exists while there is something to lose (it can disable the back/forward cache).
    if (dirty && !unloadGuardInstalled) {
      window.addEventListener('beforeunload', onBeforeUnload);
      unloadGuardInstalled = true;
    } else if (!dirty && unloadGuardInstalled) {
      window.removeEventListener('beforeunload', onBeforeUnload);
      unloadGuardInstalled = false;
    }
    updateSaveState();
  }

  function confirmDiscard(question: string): boolean {
    if (!dirty || editor.value.length === 0) return true;
    return window.confirm(question);
  }

  // ---------------------------------------------------------------- statistics

  function setAll(elements: HTMLElement[], attribute: 'summary' | 'detail', key: string, text: string): void {
    for (const element of elements) {
      if (element.dataset[attribute] === key) element.textContent = text;
    }
  }

  function renderStats(stats: TextStats, length: number): void {
    knownLength = length;
    const summary = (key: string, text: string) => setAll(el.summaries, 'summary', key, text);
    const detail = (key: string, text: string) => setAll(el.details, 'detail', key, text);

    summary('characters', plural(stats.characters, 'character'));
    summary('words', plural(stats.words, 'word'));
    summary('sentences', plural(stats.sentences, 'sentence'));
    summary('lines', plural(stats.lines, 'line'));
    summary('bytes', formatBytes(stats.bytes));

    detail('characters', formatNumber(stats.characters));
    detail('charactersNoSpaces', formatNumber(stats.charactersNoSpaces));
    detail('words', formatNumber(stats.words));
    detail('sentences', formatNumber(stats.sentences));
    detail('lines', formatNumber(stats.lines));
    detail('paragraphs', formatNumber(stats.paragraphs));
    detail(
      'bytes',
      stats.bytes >= 1024 ? `${formatNumber(stats.bytes)} (${formatBytes(stats.bytes)})` : formatNumber(stats.bytes),
    );
    detail('readingMinutes', `${formatNumber(stats.readingMinutes)} min`);
    updateSaveState();
  }

  const stats = createStatsRunner({ getText: () => editor.value, getLineEnding, onStats: renderStats });

  // ---------------------------------------------------------------- caret and selection

  function updateCaret(): void {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const direction = editor.selectionDirection ?? 'none';
    if (document.activeElement === editor) search.anchor = start;
    if (
      caretCache.version === textVersion &&
      caretCache.start === start &&
      caretCache.end === end &&
      caretCache.direction === direction
    ) {
      return;
    }
    caretCache = { version: textVersion, start, end, direction };

    const text = editor.value;
    const { line, column } = lineColumnAt(text, direction === 'backward' ? start : end);
    el.caret.textContent = `Ln ${formatNumber(line)}, Col ${formatNumber(column)}`;
    if (end > start) {
      const { count, exact } = countCharactersBounded(text.slice(start, end), SELECTION_SEGMENT_LIMIT);
      el.selectionCount.textContent = `${exact ? '' : '≈'}${formatNumber(count)} selected`;
      el.selectionCount.hidden = false;
    } else {
      el.selectionCount.hidden = true;
    }
  }

  function scheduleCaretUpdate(): void {
    if (knownLength >= LARGE_TEXT) {
      if (!caretTimer) {
        caretTimer = window.setTimeout(() => {
          caretTimer = 0;
          updateCaret();
        }, 120);
      }
      return;
    }
    if (!caretFrame) {
      caretFrame = window.requestAnimationFrame(() => {
        caretFrame = 0;
        updateCaret();
      });
    }
  }

  for (const type of ['keyup', 'pointerup', 'select', 'focus', 'selectionchange']) {
    editor.addEventListener(type, scheduleCaretUpdate);
  }
  document.addEventListener('selectionchange', () => {
    if (document.activeElement === editor) scheduleCaretUpdate();
  });

  // ---------------------------------------------------------------- text changes

  function hideReplaceResult(): void {
    if (el.replaceResult.hidden && !undoState) return;
    const hadFocus = el.replaceResult.contains(document.activeElement);
    undoState = null;
    el.replaceResult.hidden = true;
    el.replaceResultText.textContent = '';
    if (hadFocus && search.open) el.replaceAll.focus({ preventScroll: true });
  }

  /** `byUser`: typed, pasted, dropped or undone in the textarea (not an edit made by this code). */
  function handleTextChange(byUser: boolean): void {
    textVersion++;
    if (byUser && !applyingEdit) hideReplaceResult();
    savedRecently = false;
    setDirty(true);
    stats.schedule();
    scheduleCaretUpdate();
    if (search.open && search.options.query !== '') scheduleSearch(false);
  }

  editor.addEventListener('input', () => handleTextChange(true));

  /**
   * Replaces [start, end) with `replacement`. Small edits use the browser's editing command so
   * they join the textarea's own undo history (Ctrl+Z); focus returns to where it was.
   */
  function editRange(start: number, end: number, replacement: string): void {
    const active = document.activeElement;
    const versionBefore = textVersion;
    let done = false;

    // On touch screens moving focus into the textarea would flash the keyboard.
    if (!coarsePointer && end - start + replacement.length <= UNDOABLE_EDIT_LIMIT) {
      applyingEdit = true;
      try {
        editor.focus({ preventScroll: true });
        editor.setSelectionRange(start, end);
        if (replacement === '') {
          done = start === end || document.execCommand('delete');
        } else {
          done = document.execCommand('insertText', false, replacement);
        }
      } catch {
        done = false;
      } finally {
        applyingEdit = false;
      }
    }

    if (!done) {
      editor.setRangeText(replacement, start, end, 'end');
      handleTextChange(false);
    } else if (textVersion === versionBefore && !(start === end && replacement === '')) {
      // The command worked but fired no input event.
      handleTextChange(false);
    }

    if (active instanceof HTMLElement && active !== editor && active !== document.body) {
      active.focus({ preventScroll: true });
    }
  }

  /** Replaces the whole text, editing only the part that changed. */
  function replaceWholeText(previous: string, next: string): void {
    const scrollTop = editor.scrollTop;
    const scrollLeft = editor.scrollLeft;
    const shorter = Math.min(previous.length, next.length);

    let prefix = 0;
    while (prefix < shorter && previous.charCodeAt(prefix) === next.charCodeAt(prefix)) prefix++;
    let suffix = 0;
    while (
      suffix < shorter - prefix &&
      previous.charCodeAt(previous.length - 1 - suffix) === next.charCodeAt(next.length - 1 - suffix)
    ) {
      suffix++;
    }
    // Never split a surrogate pair at either edge.
    if (prefix > 0 && isHighSurrogate(previous.charCodeAt(prefix - 1))) prefix--;
    if (suffix > 0 && isLowSurrogate(previous.charCodeAt(previous.length - suffix))) suffix--;

    const start = prefix;
    const end = previous.length - suffix;
    const insert = next.slice(prefix, next.length - suffix);

    if (!coarsePointer && end - start + insert.length <= UNDOABLE_EDIT_LIMIT) {
      editRange(start, end, insert);
    } else {
      editor.value = next;
      handleTextChange(false);
    }
    editor.scrollTop = scrollTop;
    editor.scrollLeft = scrollLeft;
    highlighter.syncScroll();
  }

  // ---------------------------------------------------------------- search

  function updateFindStatus(): void {
    window.clearTimeout(searchingTimer);
    const status = search.compiled;
    const count = search.matches.length;
    if (status.status === 'ok') {
      el.findCount.textContent = count > 0 ? positionLabel() : 'No results';
      el.findCount.dataset.tone = count > 0 ? 'some' : 'none';
    } else {
      el.findCount.textContent = '';
      delete el.findCount.dataset.tone;
    }
    const problem = statusProblem(status);
    if (problem) {
      el.findError.textContent = problem;
      el.findError.hidden = false;
      el.findInput.setAttribute('aria-invalid', 'true');
    } else {
      el.findError.textContent = '';
      el.findError.hidden = true;
      el.findInput.removeAttribute('aria-invalid');
    }
  }

  /** Shows "Searching…" when the worker is slow to answer (the results replace it). */
  function showSearchingSoon(): void {
    window.clearTimeout(searchingTimer);
    searchingTimer = window.setTimeout(() => {
      el.findCount.textContent = 'Searching…';
      delete el.findCount.dataset.tone;
    }, 250);
  }

  function countAnnouncement(): string {
    const status = search.compiled;
    const problem = statusProblem(status);
    if (problem) return problem;
    if (status.status === 'empty') return '';
    if (search.matches.length === 0) return 'No results';
    return search.start > 0 ? positionLabel() : `${positionLabel()} matches`;
  }

  /** Result counts change on every keystroke in the find field: announce once typing pauses. */
  function announceCountSoon(): void {
    window.clearTimeout(countAnnounceTimer);
    countAnnounceWanted = false;
    countAnnounceTimer = window.setTimeout(() => {
      if (!search.open || searchTimer) return;
      if (pendingSearch) {
        countAnnounceWanted = true; // announced when the worker answers
        return;
      }
      const message = countAnnouncement();
      if (message) announce(message);
    }, COUNT_ANNOUNCE_DELAY);
  }

  function scheduleSearch(reveal: boolean): void {
    searchTimerReveals ||= reveal;
    window.clearTimeout(searchTimer);
    // After edits, longer texts wait longer, so they aren't searched and redrawn between keystrokes.
    let delay: number;
    if (reveal) delay = knownLength >= 200_000 ? 150 : 0;
    else if (knownLength < 50_000) delay = 60;
    else delay = knownLength < LARGE_TEXT ? 250 : 800;
    searchTimer = window.setTimeout(() => {
      const shouldReveal = searchTimerReveals;
      runSearch(shouldReveal);
    }, delay);
  }

  /** Shows the outcome of a search: `found` in `version` of the text, current match at or after `offset`. */
  function applySearch(
    status: SearchStatus,
    version: number,
    found: MatchWindow,
    offset: number,
    reveal: boolean,
    text: string,
  ): void {
    search.compiled = status;
    search.version = version;
    search.matches = found.matches;
    search.truncated = found.truncated;
    search.start = found.start;
    if (found.matches.length === 0) {
      search.current = -1;
    } else {
      const index = firstMatchAtOrAfter(found.matches, offset);
      search.current = index === -1 ? 0 : index;
    }

    if (search.open && found.matches.length > 0) highlighter.render(text, found.matches, search.current);
    else highlighter.clear();

    updateFindStatus();
    updatePreview(text);
    if (reveal && search.current >= 0) revealCurrent();
  }

  function applyTimeout(version: number, text: string): void {
    applySearch({ status: 'unfinished', message: SEARCH_TIMEOUT_MESSAGE }, version, emptyWindow(), 0, false, text);
  }

  /**
   * Finds the matches and redraws the highlights. `reveal` (the query or options changed)
   * selects and scrolls to the first match after the search anchor.
   *
   * Plain text is searched right away. Regular expressions can backtrack for hours, so they run
   * in the worker and their results arrive later (pendingSearch); one that took too long isn't
   * started again after edits, only when the query or options change or, with `explicit` (the
   * user asked for a result), once the text has changed.
   */
  function runSearch(reveal: boolean, explicit = false): void {
    window.clearTimeout(searchTimer);
    searchTimer = 0;
    searchTimerReveals = false;
    const token = ++searchToken;
    pendingSearch = null;

    const text = editor.value;
    const version = textVersion;
    const previous = search.matches[search.current];
    const compiled = compileSearch(search.options);

    if (!search.open || compiled.status !== 'ok') {
      runner.cancelFinds();
      applySearch(compiled, version, emptyWindow(), 0, false, text);
      return;
    }

    let offset: number;
    if (reveal) offset = search.anchor;
    else if (document.activeElement === editor) offset = editor.selectionStart;
    else offset = previous ? previous.start : search.anchor;
    // Beyond MATCH_LIMIT matches, keep listing from the same place if that still reaches the offset.
    const hint = search.start > 0 && search.start <= offset ? search.start : 0;
    const request: WindowRequest = { kind: 'around', offset, hint };

    // Escaped text (with or without whole word) can't backtrack badly.
    if (!search.options.regex) {
      runner.cancelFinds();
      applySearch(compiled, version, findMatchWindow(text, compiled.regex, request), offset, reveal, text);
      return;
    }

    const key = searchKey(compiled.regex);
    if (timedOut && timedOut.key === key && !((reveal || explicit) && timedOut.version !== version)) {
      runner.cancelFinds();
      applyTimeout(version, text);
      return;
    }

    const promise = runner
      .findWindow({ text, version, regex: compiled.regex, timeout: searchTimeout(text.length) }, request)
      .then((outcome) => {
        if (token !== searchToken) return; // a newer search took over
        pendingSearch = null;
        if (outcome.status === 'cancelled') {
          updateFindStatus();
          return;
        }
        if (outcome.status === 'timeout') timedOut = { key, version };
        if (version !== textVersion) {
          // Edited meanwhile: that edit scheduled its own search.
          if (!search.open) return;
          if (searchTimer) searchTimerReveals ||= reveal;
          else scheduleSearch(reveal);
          return;
        }
        if (outcome.status === 'done') {
          if (timedOut?.key === key) timedOut = null;
          applySearch(compiled, version, outcome.result, offset, reveal, text);
        } else if (outcome.status === 'timeout') {
          applyTimeout(version, text);
          countAnnounceWanted = true;
        } else {
          console.error('Notepad: search failed', outcome.message);
          const message = outcome.tooLarge ? 'The text is too large to search with this pattern.' : 'Search failed. Try again.';
          applySearch({ status: 'unfinished', message }, version, emptyWindow(), 0, false, text);
        }
        if (countAnnounceWanted) {
          countAnnounceWanted = false;
          const message = countAnnouncement();
          if (message) announce(message);
        }
      });
    pendingSearch = { token, reveal, promise };
    showSearchingSoon();
  }

  /**
   * Brings the matches up to date with the text and query: runs a scheduled search now and waits
   * for one the worker is busy with. 'revealed': that search selected a match itself.
   * 'unavailable': the panel was closed, or the text kept changing.
   */
  async function ensureFreshSearch(): Promise<'fresh' | 'revealed' | 'unavailable'> {
    let revealed = false;
    let retried = false;
    for (let attempt = 0; attempt < 6; attempt++) {
      if (!search.open) return 'unavailable';
      if (searchTimer) {
        revealed ||= searchTimerReveals;
        runSearch(searchTimerReveals, true);
      } else if (!pendingSearch && search.version !== textVersion) {
        runSearch(false, true);
      } else if (
        !pendingSearch &&
        !retried &&
        search.compiled.status === 'unfinished' &&
        timedOut !== null &&
        timedOut.version !== textVersion
      ) {
        retried = true;
        runSearch(false, true);
      }
      const pending = pendingSearch;
      if (!pending) {
        if (search.open && search.version === textVersion) return revealed ? 'revealed' : 'fresh';
        continue;
      }
      revealed ||= pending.reveal;
      await pending.promise;
    }
    return 'unavailable';
  }

  function queueAction(action: () => Promise<void>): void {
    actionQueue = actionQueue.then(action).catch((error: unknown) => {
      console.error('Notepad: find or replace failed', error);
    });
  }

  /**
   * Lists another window of matches (there are more than MATCH_LIMIT). Returns false when the
   * search didn't finish or the text, query or panel changed meanwhile.
   */
  async function loadWindow(request: WindowRequest): Promise<boolean> {
    const compiled = search.compiled;
    if (compiled.status !== 'ok') return false;
    const text = editor.value;
    const version = textVersion;
    let found: MatchWindow;
    if (!search.options.regex) {
      found = findMatchWindow(text, compiled.regex, request);
    } else {
      const token = searchToken;
      showSearchingSoon();
      const outcome = await runner.findWindow(
        { text, version, regex: compiled.regex, timeout: searchTimeout(text.length) },
        request,
      );
      if (token !== searchToken || version !== textVersion || !search.open) return false;
      if (outcome.status !== 'done') {
        if (outcome.status === 'timeout') {
          timedOut = { key: searchKey(compiled.regex), version };
          applyTimeout(version, text);
          announce(SEARCH_TIMEOUT_MESSAGE);
        } else {
          updateFindStatus();
          if (outcome.status === 'failed') announce('Search failed. Try again.');
        }
        return false;
      }
      found = outcome.result;
    }
    search.matches = found.matches;
    search.truncated = found.truncated;
    search.start = found.start;
    search.current = -1;
    return true;
  }

  function scrollMatchIntoView(index: number): void {
    const box = highlighter.matchBox(index);
    if (!box) return;

    const viewHeight = editor.clientHeight;
    const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 24;
    // Phones keep the match near the top, where it stays visible above the on-screen keyboard.
    const margin = coarsePointer ? Math.min(lineHeight * 2, viewHeight / 4) : Math.min(viewHeight / 3, lineHeight * 6);
    if (box.top < editor.scrollTop + lineHeight / 2 || box.top + box.height > editor.scrollTop + viewHeight - lineHeight / 2) {
      editor.scrollTop = Math.max(0, box.top - margin);
    }
    if (!wrapLines) {
      const viewWidth = editor.clientWidth;
      if (box.left < editor.scrollLeft || box.left + box.width > editor.scrollLeft + viewWidth) {
        editor.scrollLeft = Math.max(0, box.left - viewWidth / 3);
      }
    }
    highlighter.syncScroll();

    // Bring the editor itself into view unless the user is typing in the find panel
    // (scrolling the page then would fight the on-screen keyboard).
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && el.findPanel.contains(active)) return;
    const anchor = highlighter.anchor(index);
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = (viewport?.offsetTop ?? 0) + 80; // below the sticky site header
    let bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
    if (getComputedStyle(el.saveBar).position === 'sticky') bottom = Math.min(bottom, el.saveBar.getBoundingClientRect().top);
    if (rect.top < top) window.scrollBy({ top: rect.top - top - 16 });
    else if (rect.bottom > bottom) window.scrollBy({ top: rect.bottom - bottom + 16 });
  }

  function revealCurrent(): void {
    const match = search.matches[search.current];
    if (!match) return;
    // Selecting does not move focus, so typing in the find field continues undisturbed.
    try {
      editor.setSelectionRange(match.start, match.end, 'forward');
    } catch {
      // A detached or hidden textarea: nothing to select.
    }
    scheduleCaretUpdate();
    scrollMatchIntoView(search.current);
  }

  function announceCurrent(): void {
    const match = search.matches[search.current];
    if (!match) return;
    const { line } = lineColumnAt(editor.value, match.start);
    announce(`${positionLabel()}, line ${formatNumber(line)}`);
  }

  async function navigate(direction: 1 | -1): Promise<void> {
    if (!search.open) {
      openPanel(search.mode, { focus: search.options.query === '', seed: false });
    }
    if (search.options.query === '') {
      el.findInput.focus();
      return;
    }
    const freshness = await ensureFreshSearch();
    if (freshness === 'unavailable') return;
    const problem = statusProblem(search.compiled);
    if (problem) {
      announce(problem);
      return;
    }
    const matches = search.matches;
    const count = matches.length;
    if (count === 0) {
      announce('No results');
      return;
    }
    if (freshness === 'revealed') {
      announceCurrent();
      return;
    }

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const current = matches[search.current];
    const onCurrent = current !== undefined && current.start === start && current.end === end;
    // The listed matches are a window further down a longer list: earlier matches aren't listed.
    const windowed = search.start > 0;
    let next = -1;
    // With more than MATCH_LIMIT matches the next one may not be listed yet.
    let load: WindowRequest | null = null;

    if (direction === 1) {
      if (onCurrent && search.current + 1 < count) {
        next = search.current + 1;
      } else if (onCurrent) {
        if (search.truncated) {
          const after = current.end > current.start ? current.end : advanceIndex(editor.value, current.end);
          load = { kind: 'after', offset: after };
        } else if (windowed) {
          load = { kind: 'after', offset: 0 }; // wrap around to the first match
        } else {
          next = 0;
        }
      } else {
        const index = firstMatchAtOrAfter(matches, start);
        if (index !== -1 && (!windowed || start >= search.start)) next = index;
        else if (index === -1 && !search.truncated && !windowed) next = 0;
        else load = { kind: 'around', offset: start, hint: windowed && search.start <= start ? search.start : 0 };
      }
    } else if (onCurrent && search.current > 0) {
      next = search.current - 1;
    } else if (onCurrent) {
      if (windowed) load = { kind: 'before', offset: current.start };
      else if (search.truncated) load = { kind: 'before', offset: Infinity }; // wrap around to the last match
      else next = count - 1;
    } else {
      const index = lastMatchBefore(matches, start);
      if (index !== -1 && (index < count - 1 || !search.truncated)) next = index;
      else if (index === -1 && !windowed && !search.truncated) next = count - 1;
      else load = { kind: 'before', offset: start };
    }

    if (load) {
      if (!(await loadWindow(load))) return;
      const loaded = search.matches;
      if (load.kind === 'before') {
        next = loaded.length - 1;
      } else if (load.kind === 'after') {
        next = loaded.length > 0 ? 0 : -1;
      } else {
        const index = firstMatchAtOrAfter(loaded, start);
        next = index === -1 ? Math.min(0, loaded.length - 1) : index;
      }
      search.current = next;
      if (next === -1) {
        highlighter.clear();
        updateFindStatus();
        updatePreview();
        announce('No results');
        return;
      }
      highlighter.render(editor.value, loaded, next);
      updatePreview();
    } else {
      search.current = next;
      highlighter.setCurrent(next);
    }
    updateFindStatus();
    revealCurrent();
    announceCurrent();
  }

  // ---------------------------------------------------------------- replace preview

  function updatePreview(text?: string): void {
    window.clearTimeout(previewTimer);
    previewTimer = 0;
    const show =
      search.open && search.mode === 'replace' && search.compiled.status === 'ok' && search.matches.length > 0;
    el.preview.hidden = !show;
    if (!show) {
      if (el.previewList.firstChild) el.previewList.replaceChildren();
      return;
    }
    el.previewTitle.textContent = `Preview changes (${countLabel()})`;
    if (!el.preview.open) return;

    const items = buildReplacementPreview(
      text ?? editor.value,
      search.matches,
      el.replaceInput.value,
      search.options.regex,
      { limit: PREVIEW_LIMIT },
    );
    const fragment = document.createDocumentFragment();
    for (const item of items) {
      const row = el.previewTemplate.content.cloneNode(true) as DocumentFragment;
      query<HTMLElement>(row, '[data-preview-line]').textContent = `Line ${formatNumber(item.line)}`;
      query<HTMLElement>(row, '[data-preview-before]').textContent = `${item.clippedBefore ? '…' : ''}${item.before}`;
      query<HTMLElement>(row, '[data-preview-old]').textContent = item.removed;
      query<HTMLElement>(row, '[data-preview-new]').textContent = item.inserted;
      query<HTMLElement>(row, '[data-preview-after]').textContent = `${item.after}${item.clippedAfter ? '…' : ''}`;
      fragment.append(row);
    }
    el.previewList.replaceChildren(fragment);

    const more = search.truncated || search.start > 0 || search.matches.length > items.length;
    el.previewNote.hidden = !more;
    el.previewNote.textContent = more
      ? `Showing ${search.start > 0 ? '' : 'the first '}${formatNumber(items.length)} of ${countLabel()} changes.`
      : '';
  }

  function schedulePreview(): void {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => updatePreview(), knownLength >= LARGE_TEXT ? 250 : 80);
  }

  el.preview.addEventListener('toggle', () => {
    if (el.preview.open) updatePreview();
  });

  // ---------------------------------------------------------------- panel

  function updatePanelToggles(): void {
    el.findToggle.setAttribute('aria-expanded', String(search.open && search.mode === 'find'));
    el.replaceToggle.setAttribute('aria-expanded', String(search.open && search.mode === 'replace'));
  }

  /** Uses a short single-line selection as the query. Returns true when the query changed. */
  function seedQueryFromSelection(): boolean {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    if (end <= start || end - start > 500) return false;
    // The selection is our own current match: keep the query (it may be a pattern).
    const current = search.matches[search.current];
    if (current && current.start === start && current.end === end && search.version === textVersion) return false;
    const selected = editor.value.slice(start, end);
    if (/[\r\n]/.test(selected)) return false;
    const seeded = search.options.regex ? escapeRegExp(selected) : selected;
    search.anchor = start;
    if (seeded === search.options.query) return false;
    el.findInput.value = seeded;
    search.options.query = seeded;
    return true;
  }

  function openPanel(mode: PanelMode, { focus = true, seed = true }: { focus?: boolean; seed?: boolean } = {}): void {
    const wasOpen = search.open;
    search.open = true;
    search.mode = mode;
    el.findPanel.hidden = false;
    el.replaceRow.hidden = mode !== 'replace';
    highlighter.setReplaceMode(mode === 'replace');
    updatePanelToggles();

    if (!wasOpen) search.anchor = editor.selectionStart;
    const seeded = seed && seedQueryFromSelection();
    if (!wasOpen || seeded) runSearch(seeded);
    else updatePreview();

    if (focus) {
      const target = mode === 'replace' && search.options.query !== '' ? el.replaceInput : el.findInput;
      target.focus();
      target.select();
    }
    if (seeded) announceCountSoon();
  }

  function closePanel(returnFocus: boolean): void {
    if (!search.open) return;
    // Hiding a focused control would drop focus to the page (Safari doesn't focus clicked buttons).
    if (el.findPanel.contains(document.activeElement)) returnFocus = true;
    search.open = false;
    window.clearTimeout(searchTimer);
    searchTimer = 0;
    searchTimerReveals = false;
    // Stops a search or Replace all still running and frees the worker's copy of the text.
    searchToken++;
    pendingSearch = null;
    runner.dispose();
    window.clearTimeout(searchingTimer);
    window.clearTimeout(countAnnounceTimer);
    countAnnounceWanted = false;
    window.clearTimeout(previewTimer);
    el.findPanel.hidden = true;
    highlighter.clear();
    updatePanelToggles();
    if (returnFocus) editor.focus();
  }

  el.findToggle.addEventListener('click', () => {
    if (search.open && search.mode === 'find') closePanel(false);
    else openPanel('find');
  });

  el.replaceToggle.addEventListener('click', () => {
    if (search.open && search.mode === 'replace') closePanel(false);
    else openPanel('replace');
  });

  el.findClose.addEventListener('click', () => closePanel(true));
  el.findPrev.addEventListener('click', () => queueAction(() => navigate(-1)));
  el.findNext.addEventListener('click', () => queueAction(() => navigate(1)));

  el.findInput.addEventListener('input', () => {
    search.options.query = el.findInput.value;
    scheduleSearch(true);
    announceCountSoon();
  });

  el.findInput.addEventListener('keydown', (event) => {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      const direction = event.shiftKey ? -1 : 1;
      queueAction(() => navigate(direction));
    }
  });

  function setOption(key: OptionKey, value: boolean, spoken: boolean): void {
    search.options[key] = value;
    el.optionButtons.get(key)?.setAttribute('aria-pressed', String(value));
    if (key === 'regex') {
      const focusLost = el.regexOnly.some((button) => button === document.activeElement);
      for (const button of el.regexOnly) button.hidden = !value;
      if (focusLost) el.optionButtons.get('regex')?.focus();
    }
    if (spoken) announce(`${OPTION_LABELS[key]} ${value ? 'on' : 'off'}`);
    if (search.open) {
      runSearch(search.options.query !== '');
      announceCountSoon();
    }
  }

  for (const [key, button] of el.optionButtons) {
    button.addEventListener('click', () => setOption(key, !search.options[key], false));
  }

  el.findPanel.addEventListener('keydown', (event) => {
    if (event.isComposing || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    // On Apple keyboards Option+letter types characters (ç, ∑, ®): the fields keep them.
    if (IS_APPLE && event.target instanceof HTMLInputElement) return;
    for (const [key, letter] of OPTION_SHORTCUTS) {
      if (isLetter(event, letter)) {
        event.preventDefault();
        setOption(key, !search.options[key], true);
        return;
      }
    }
  });

  // ---------------------------------------------------------------- replace

  function reportUnusableQuery(): void {
    const problem = statusProblem(search.compiled);
    if (problem) {
      announce(problem);
    } else {
      announce('Type something to find first');
      el.findInput.focus();
    }
  }

  function reportReplaceAllProblem(message: string): void {
    setMessage(message, 'error');
    announce(message);
  }

  async function replaceOne(): Promise<void> {
    if (!search.open) return;
    if ((await ensureFreshSearch()) === 'unavailable') return;
    if (search.compiled.status !== 'ok') {
      reportUnusableQuery();
      return;
    }
    const match = search.matches[search.current] ?? search.matches[0];
    if (!match) {
      announce('No results');
      return;
    }

    hideReplaceResult();
    const replacement = expandReplacement(el.replaceInput.value, match, editor.value, search.options.regex);
    editRange(match.start, match.end, replacement);

    // Continue after the inserted text, and past an empty match (such as $) so it isn't found again.
    search.anchor = offsetAfterReplacement(match, replacement.length);
    runSearch(true);
    if ((await ensureFreshSearch()) === 'unavailable') return;
    const problem = statusProblem(search.compiled);
    if (problem) {
      announce(`Replaced. ${problem}`);
      return;
    }
    const left = search.matches.length;
    announce(left === 0 ? 'Replaced. No more matches.' : `Replaced. ${countLabel()} ${left === 1 ? 'match' : 'matches'} left.`);
  }

  async function replaceAll(): Promise<void> {
    if (!search.open) return;
    if ((await ensureFreshSearch()) === 'unavailable') return;
    const compiled = search.compiled;
    if (compiled.status !== 'ok') {
      reportUnusableQuery();
      return;
    }
    if (search.matches.length === 0) {
      announce('No results');
      return;
    }

    const text = editor.value;
    const version = textVersion;
    const template = el.replaceInput.value;
    let result: { text: string; count: number };
    if (!search.options.regex) {
      try {
        result = replaceAllInText(text, compiled.regex, template, false);
      } catch (error) {
        console.error('Notepad: replace all failed', error);
        reportReplaceAllProblem(REPLACE_TOO_LARGE_MESSAGE);
        return;
      }
    } else {
      // In the worker, like every regular-expression search.
      const busyTimer = window.setTimeout(() => setMessage(REPLACING_MESSAGE), 300);
      const outcome = await runner.replaceAll(
        { text, version, regex: compiled.regex, timeout: replaceTimeout(text.length) },
        template,
        true,
      );
      window.clearTimeout(busyTimer);
      if (el.message.textContent === REPLACING_MESSAGE) setMessage('');
      if (outcome.status === 'cancelled' || !search.open) return;
      if (outcome.status === 'timeout') {
        reportReplaceAllProblem(REPLACE_TIMEOUT_MESSAGE);
        return;
      }
      if (outcome.status === 'failed') {
        console.error('Notepad: replace all failed', outcome.message);
        reportReplaceAllProblem(outcome.tooLarge ? REPLACE_TOO_LARGE_MESSAGE : 'Replace all failed. Try again.');
        return;
      }
      if (version !== textVersion) {
        reportReplaceAllProblem('The text changed during Replace all, so nothing was replaced. Try again.');
        return;
      }
      result = outcome.result;
    }

    const snapshot: UndoState = {
      text,
      selectionStart: editor.selectionStart,
      selectionEnd: editor.selectionEnd,
      scrollTop: editor.scrollTop,
      scrollLeft: editor.scrollLeft,
    };
    if (result.text !== text) replaceWholeText(text, result.text);
    const caret = Math.min(snapshot.selectionStart, result.text.length);
    editor.setSelectionRange(caret, caret);
    editor.scrollTop = snapshot.scrollTop;
    editor.scrollLeft = snapshot.scrollLeft;

    undoState = snapshot;
    const message = `Replaced ${plural(result.count, 'occurrence')}`;
    el.replaceResultText.textContent = message;
    el.replaceResult.hidden = false;
    search.anchor = caret;
    runSearch(false);
    announce(message);
  }

  el.replaceOne.addEventListener('click', () => queueAction(replaceOne));
  el.replaceAll.addEventListener('click', () => queueAction(replaceAll));
  el.replaceInput.addEventListener('input', schedulePreview);
  el.replaceInput.addEventListener('keydown', (event) => {
    if (event.isComposing || event.keyCode === 229 || event.key !== 'Enter' || event.altKey) return;
    event.preventDefault();
    // The on-screen keyboard's "done" key only closes the keyboard: on touch screens a single
    // replacement can't be undone, so it takes the Replace button.
    if (coarsePointer) {
      el.replaceInput.blur();
      return;
    }
    queueAction(hasPrimaryModifier(event) ? replaceAll : replaceOne);
  });

  el.undoReplace.addEventListener('click', () => {
    const state = undoState;
    if (!state) return;
    replaceWholeText(editor.value, state.text);
    editor.setSelectionRange(state.selectionStart, state.selectionEnd);
    editor.scrollTop = state.scrollTop;
    editor.scrollLeft = state.scrollLeft;
    undoState = null;
    el.replaceResult.hidden = true;
    el.replaceResultText.textContent = '';
    el.replaceAll.focus({ preventScroll: true });
    search.anchor = state.selectionStart;
    runSearch(false);
    announce('Replace all undone');
  });

  // ---------------------------------------------------------------- editor surface

  el.editorWrap.dataset.wrap = 'on';
  editor.addEventListener('scroll', () => highlighter.syncScroll(), { passive: true });

  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      if (highlighter.active) highlighter.sync();
    }).observe(editor);
    // Lets focus scrolling keep controls clear of the sticky Save As bar (scroll-padding-bottom).
    new ResizeObserver(() => {
      const height = Math.ceil(el.saveBar.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--np-save-bar-height', `${height}px`);
    }).observe(el.saveBar);
  }

  el.wrapToggle.addEventListener('click', () => {
    wrapLines = !wrapLines;
    el.editorWrap.dataset.wrap = wrapLines ? 'on' : 'off';
    editor.setAttribute('wrap', wrapLines ? 'soft' : 'off');
    el.wrapToggle.setAttribute('aria-pressed', String(wrapLines));
    if (wrapLines) editor.scrollLeft = 0;
    highlighter.sync();
  });

  // ---------------------------------------------------------------- open, new, save

  function loadText(text: string, filename: string): void {
    const lineEnding = detectLineEnding(text);
    editor.value = text;
    editor.setSelectionRange(0, 0);
    editor.scrollTop = 0;
    editor.scrollLeft = 0;
    el.filename.value = filename;
    el.lineEnding.value = lineEnding;
    hideReplaceResult();
    textVersion++;
    savedRecently = false;
    setDirty(false);
    stats.schedule(true);
    scheduleCaretUpdate();
    search.matches = [];
    search.truncated = false;
    search.start = 0;
    search.current = -1;
    search.anchor = 0;
    if (search.open) runSearch(false);
  }

  async function openFile(file: File): Promise<void> {
    const name = file.name || DEFAULT_FILENAME;
    if (file.size > MAX_OPEN_BYTES) {
      const message = `“${name}” is ${formatBytes(file.size)}. Notepad opens files up to 20 MB.`;
      setMessage(message, 'error');
      announce(message);
      return;
    }
    if (!confirmDiscard(`Discard your unsaved changes and open “${name}”?`)) return;

    const generation = ++openGeneration;
    let text: string;
    let utf16: boolean;
    try {
      const decoded = decodeTextFile(new Uint8Array(await file.arrayBuffer()));
      text = decoded.text;
      utf16 = decoded.encoding !== 'utf-8';
    } catch (error) {
      console.error('Notepad: could not read file', error);
      const message = `Couldn’t read “${name}”.`;
      setMessage(message, 'error');
      announce(message);
      return;
    }
    if (generation !== openGeneration) return; // another file was opened meanwhile
    if (text.slice(0, 8000).includes(NUL) && !window.confirm(`“${name}” doesn’t look like a text file. Open it anyway?`)) {
      return;
    }

    loadText(text, name);
    const notes: string[] = [];
    if (utf16) notes.push(`“${name}” is UTF-16 text; Save As writes UTF-8.`);
    if (text.includes(REPLACEMENT_CHARACTER)) {
      notes.push(
        `Some characters in “${name}” couldn’t be read and are shown as ${REPLACEMENT_CHARACTER}. The file may not be ${utf16 ? 'UTF-16' : 'UTF-8'} text.`,
      );
    }
    const note = notes.join(' ');
    setMessage(note);
    announce(note ? `Opened ${name}. ${note}` : `Opened ${name}`);
    if (!coarsePointer) editor.focus();
  }

  el.openButton.addEventListener('click', () => el.openInput.click());

  el.openInput.addEventListener('change', () => {
    const file = el.openInput.files?.[0];
    el.openInput.value = ''; // allow opening the same file again
    if (file) void openFile(file);
  });

  // Android's picker greys out files whose extension it can't map to a type (such as .md).
  if (/Android/i.test(navigator.userAgent)) el.openInput.removeAttribute('accept');

  // Dropping a file anywhere on the tool opens it (instead of the browser leaving the page).
  root.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  });

  root.addEventListener('drop', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) void openFile(file);
  });

  el.newButton.addEventListener('click', () => {
    if (!confirmDiscard('Discard your unsaved changes and start a new file?')) return;
    openGeneration++;
    loadText('', DEFAULT_FILENAME);
    setMessage('');
    editor.focus();
    announce('New file');
  });

  function save(): void {
    const name = sanitizeFilename(el.filename.value);
    el.filename.value = name;
    try {
      const text = convertLineEndings(editor.value, getLineEnding());
      saveBlob(new Blob([text], { type: mimeTypeForFilename(name) }), name);
    } catch (error) {
      console.error('Notepad: save failed', error);
      const message = 'Couldn’t save the file. Try again.';
      setMessage(message, 'error');
      announce(message);
      return;
    }
    savedRecently = true;
    setDirty(false);
    if (el.message.dataset.tone === 'error') setMessage('');
    announce(`Saved ${name}`);
  }

  el.save.addEventListener('click', save);

  el.filename.addEventListener('keydown', (event) => {
    if (event.isComposing || event.keyCode === 229 || event.key !== 'Enter') return;
    event.preventDefault();
    // On touch screens the keyboard's "done" key just closes the keyboard (Save As is right there).
    if (coarsePointer) el.filename.blur();
    else save();
  });

  el.lineEnding.addEventListener('change', () => stats.schedule(true));

  // ---------------------------------------------------------------- keyboard shortcuts

  root.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.isComposing) return;
    const primary = hasPrimaryModifier(event);

    if (primary && !event.altKey && !event.shiftKey && isLetter(event, 'f')) {
      event.preventDefault();
      openPanel('find');
      return;
    }

    const replaceShortcut = IS_APPLE
      ? event.metaKey && event.altKey && !event.ctrlKey && !event.shiftKey && isLetter(event, 'f')
      : event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && isLetter(event, 'h');
    if (replaceShortcut) {
      event.preventDefault();
      openPanel('replace');
      return;
    }

    const f3 = event.key === 'F3' && !event.altKey && !event.ctrlKey && !event.metaKey;
    if (f3 || (primary && !event.altKey && isLetter(event, 'g'))) {
      event.preventDefault();
      const direction = event.shiftKey ? -1 : 1;
      queueAction(() => navigate(direction));
      return;
    }

    if (primary && !event.altKey && !event.shiftKey && isLetter(event, 'o')) {
      event.preventDefault();
      el.openInput.click();
      return;
    }

    if (event.key === 'Escape' && search.open) {
      const target = event.target;
      if (target === editor || (target instanceof Node && el.findPanel.contains(target))) {
        event.preventDefault();
        closePanel(true);
      }
    }
  });

  // Ctrl/Cmd+S saves from anywhere on the page instead of saving the web page.
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.isComposing) return;
    if (hasPrimaryModifier(event) && !event.altKey && isLetter(event, 's')) {
      event.preventDefault();
      save();
    }
  });

  // ---------------------------------------------------------------- labels and start-up

  // On Apple platforms Option+letter types characters in the find fields, so these shortcuts only
  // work while a panel button has focus: not advertised there.
  const optionShortcut = (key: string) => (IS_APPLE ? null : { alt: true, key });
  const titles: Array<[HTMLElement, string, Parameters<typeof shortcutLabel>[0] | null]> = [
    [el.newButton, 'Start a new, empty file', null],
    [el.openButton, 'Open a text file', { primary: true, key: 'O' }],
    [el.findToggle, 'Find', { primary: true, key: 'F' }],
    [el.replaceToggle, 'Replace', IS_APPLE ? { primary: true, alt: true, key: 'F' } : { primary: true, key: 'H' }],
    [el.findPrev, 'Previous match', { shift: true, key: 'F3' }],
    [el.findNext, 'Next match', { key: 'F3' }],
    [el.findClose, 'Close', { key: 'Esc' }],
    [el.optionButtons.get('matchCase')!, 'Match case', optionShortcut('C')],
    [el.optionButtons.get('wholeWord')!, 'Match whole word', optionShortcut('W')],
    [el.optionButtons.get('regex')!, 'Use regular expression', optionShortcut('R')],
    [el.optionButtons.get('multiline')!, '^ and $ match at the start and end of each line', null],
    [el.optionButtons.get('dotAll')!, 'Dot (.) also matches line breaks', null],
    [el.save, 'Save As', { primary: true, key: 'S' }],
  ];
  for (const [element, label, shortcut] of titles) {
    element.title = shortcut ? `${label} (${shortcutLabel(shortcut)})` : label;
    // Only real shortcuts; keys like Esc just act on the focused panel.
    if (shortcut && (shortcut.primary || shortcut.alt)) element.setAttribute('aria-keyshortcuts', ariaShortcut(shortcut));
  }

  // Always start empty, even if the browser tried to restore earlier input.
  if (document.activeElement !== editor) editor.value = '';
  el.filename.value = DEFAULT_FILENAME;
  el.lineEnding.value = 'lf';
  el.findInput.value = '';
  el.replaceInput.value = '';
  if (editor.value !== '') handleTextChange(false);
  stats.schedule(true);
  updateCaret();
}
