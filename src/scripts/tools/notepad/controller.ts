/**
 * Notepad: DOM wiring and state (browser only).
 *
 * The text lives in the textarea and, while autosave is on, in this browser's localStorage
 * (autosave.ts): it survives a reload or a closed tab on this device and is never sent
 * anywhere. Download saves it as a file. Interface text comes from src/i18n/tools/notepad.ts,
 * in the language of the page.
 */

import { getPageLocale } from '../../../i18n/client.ts';
import { LOCALES, LOCALE_META } from '../../../i18n/config.ts';
import { formatters } from '../../../i18n/format.ts';
import { notepadMessages } from '../../../i18n/tools/notepad.ts';
import { saveBlob } from '../../../lib/download.ts';
import { mimeTypeForFilename, sanitizeFilename } from '../../../lib/files/save-file.ts';
import { localStore } from '../../../lib/storage.ts';
import { decodeTextFile } from '../../../lib/text/decode.ts';
import { DRAFT_KEYS, combineDraftWithEarlyText } from '../../../lib/text/draft.ts';
import type { RestoredDraft } from '../../../lib/text/draft.ts';
import { buildReplacementPreview } from '../../../lib/text/preview.ts';
import { classifyRegexError, regexErrorDetail } from '../../../lib/text/regex-error.ts';
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
import { createAutosave } from './autosave.ts';
import { createConfirmDialog } from './confirm-dialog.ts';
import { createHighlighter } from './highlighter.ts';
import { IS_APPLE, ariaShortcut, hasPrimaryModifier, isLetter, shortcutLabel } from './keyboard.ts';
import { createSearchRunner } from './search-runner.ts';
import { createStatsRunner } from './stats-runner.ts';
import { createZenMode } from './zen.ts';

type PanelMode = 'find' | 'replace';
type OptionKey = 'matchCase' | 'wholeWord' | 'regex' | 'multiline' | 'dotAll';
/** A compiled query, or one whose search didn't finish (took too long or failed). */
type SearchStatus = CompiledSearch | { status: 'unfinished'; message: string };
type Shortcut = Parameters<typeof shortcutLabel>[0];

interface UndoState {
  text: string;
  selectionStart: number;
  selectionEnd: number;
  scrollTop: number;
  scrollLeft: number;
}

/** Everything Clear resets, so Undo can bring it back. */
interface ClearedState extends UndoState {
  filename: string;
  lineEnding: LineEnding;
  /** The text was unchanged since it was opened or downloaded. */
  wasClean: boolean;
}

const MAX_OPEN_BYTES = 20 * 1024 * 1024;
const MAX_OPEN_MEGABYTES = 20;
const PREVIEW_LIMIT = 100;
/** Edits up to this many characters go through the browser's editing commands, so Ctrl+Z still works. */
const UNDOABLE_EDIT_LIMIT = 20_000;
/** Above this length, searching and caret updates wait a little longer. */
const LARGE_TEXT = 500_000;
const COUNT_ANNOUNCE_DELAY = 700;
/** Longer selections are counted without grapheme segmentation, which would stall the page. */
const SELECTION_SEGMENT_LIMIT = 100_000;

/**
 * Zen mode: Ctrl+Shift+Enter (⌘⇧↩ on Apple keyboards). Browsers and screen readers leave this
 * combination to the page, it types nothing on any keyboard layout (unlike Alt or Option
 * letters), and F11 stays the browser's own full screen.
 */
const ZEN_SHORTCUT: Shortcut = { primary: true, shift: true, key: IS_APPLE ? '↩' : 'Enter' };

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
/** Alt (Option) shortcuts while the find panel has focus. */
const OPTION_SHORTCUTS: ReadonlyArray<[OptionKey, string]> = [
  ['matchCase', 'c'],
  ['wholeWord', 'w'],
  ['regex', 'r'],
];

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

function isComposing(event: KeyboardEvent): boolean {
  // keyCode 229: some IMEs (and Safari) report composition keys this way instead of isComposing.
  return event.isComposing || event.keyCode === 229;
}

function isZenShortcut(event: KeyboardEvent): boolean {
  return event.key === 'Enter' && event.shiftKey && !event.altKey && hasPrimaryModifier(event);
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
    card: query<HTMLElement>(root, '[data-card]'),
    notice: query<HTMLElement>(root, '[data-notice]'),
    message: query<HTMLElement>(root, '[data-message]'),
    noticeUndo: query<HTMLButtonElement>(root, '[data-notice-undo]'),
    openButton: query<HTMLButtonElement>(root, '[data-open]'),
    openInput: query<HTMLInputElement>(root, '[data-open-input]'),
    clearButton: query<HTMLButtonElement>(root, '[data-clear]'),
    findToggle: query<HTMLButtonElement>(root, '[data-find-toggle]'),
    replaceToggle: query<HTMLButtonElement>(root, '[data-replace-toggle]'),
    wrapToggle: query<HTMLButtonElement>(root, '[data-wrap-toggle]'),
    zenToggle: query<HTMLButtonElement>(root, '[data-zen-toggle]'),
    zenExit: query<HTMLButtonElement>(root, '[data-zen-exit]'),
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
    status: query<HTMLElement>(root, '[data-status]'),
    caret: query<HTMLElement>(root, '[data-caret]'),
    selectionCount: query<HTMLElement>(root, '[data-selection-count]'),
    saveState: query<HTMLElement>(root, '[data-save-state]'),
    autosaveToggle: query<HTMLButtonElement>(root, '[data-autosave-toggle]'),
    summaries: Array.from(root.querySelectorAll<HTMLElement>('[data-summary]')),
    details: Array.from(root.querySelectorAll<HTMLElement>('[data-detail]')),
    filename: query<HTMLInputElement>(root, '[data-filename]'),
    lineEnding: query<HTMLSelectElement>(root, '[data-line-ending]'),
    save: query<HTMLButtonElement>(root, '[data-save]'),
    confirm: query<HTMLDialogElement>(root, 'dialog[data-confirm]'),
  };
}

export function initNotepad(root: HTMLElement): void {
  if (root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const locale = getPageLocale();
  const m = notepadMessages[locale];
  const f = formatters(locale);
  const intl = LOCALE_META[locale].intl;
  // Local time (the shared date formatter is UTC, for build-time dates).
  const timeFormat = new Intl.DateTimeFormat(intl, { hour: 'numeric', minute: '2-digit' });
  const dayTimeFormat = new Intl.DateTimeFormat(intl, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const formatNumber = (value: number) => f.number(value);

  const el = getElements(root);
  const editor = el.editor;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const highlighter = createHighlighter({ textarea: editor, mirror: el.mirror, markTemplate: el.markTemplate });

  // ---------------------------------------------------------------- state

  /** Incremented on every change of the text. */
  let textVersion = 0;
  /** Text length as of the last statistics run (avoids reading a huge value on every keystroke). */
  let knownLength = 0;
  /** textVersion when the text last matched a file (opened or downloaded) or was a new, empty page. */
  let cleanVersion = 0;
  let unloadGuardInstalled = false;
  /** True while this code edits the text through the browser's editing commands. */
  let applyingEdit = false;
  /** Replace all can be undone until the text is edited. */
  let undoState: UndoState | null = null;
  /** Clear can be undone until the text is edited or another notice replaces it. */
  let clearedState: ClearedState | null = null;
  /**
   * The browser's own undo (Ctrl+Z) can also bring back a text Clear removed through its editing
   * commands, even after more typing and undoing. What Clear reset besides the text is kept for
   * that, until the text is replaced some other way.
   */
  let clearedForNativeUndo: ClearedState | null = null;
  let wrapLines = true;
  let openGeneration = 0;
  /** Changes whenever the notice line changes, so a delayed "Replacing…" only clears itself. */
  let messageToken = 0;
  let renderedSaveState = '';
  /** The autosave problem (full, error, unavailable) last announced; null while there is none. */
  let announcedProblem: string | null = null;

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

  const confirmDialog = createConfirmDialog(el.confirm);

  const autosave = createAutosave({
    storage: localStore,
    snapshot: () => ({
      version: textVersion,
      length: editor.value.length,
      filename: el.filename.value,
      lineEnding: getLineEnding(),
      selectionStart: editor.selectionStart,
      selectionEnd: editor.selectionEnd,
      scrollTop: editor.scrollTop,
      wrap: wrapLines,
    }),
    readText: () => editor.value,
    onChange: () => {
      renderSaveState();
      renderAutosaveToggle();
      updateUnloadGuard();
    },
    timers: {
      set: (callback, ms) => window.setTimeout(callback, ms),
      clear: (id) => window.clearTimeout(id as number),
    },
  });

  // ---------------------------------------------------------------- helpers

  function announce(message: string): void {
    window.clearTimeout(announceTimer);
    el.announcer.textContent = '';
    // Re-setting after a tick makes screen readers repeat identical messages.
    announceTimer = window.setTimeout(() => {
      el.announcer.textContent = message;
    }, 50);
  }

  /** The notice line above the editor; `undo` offers to undo the last Clear. */
  function setMessage(message: string, tone: 'neutral' | 'error' = 'neutral', { undo = false } = {}): void {
    messageToken++;
    if (!undo) clearedState = null;
    el.message.textContent = message;
    el.message.dataset.tone = tone;
    el.noticeUndo.hidden = !undo;
    el.notice.hidden = message === '';
  }

  function getLineEnding(): LineEnding {
    return el.lineEnding.value === 'crlf' ? 'crlf' : 'lf';
  }

  function isModified(): boolean {
    return textVersion !== cleanVersion;
  }

  function countLabel(): string {
    // Only lists of more than MATCH_LIMIT matches are truncated or start further down.
    if (search.truncated || search.start > 0) return `${formatNumber(MATCH_LIMIT)}+`;
    return formatNumber(search.matches.length);
  }

  /** "3 of 120" for the find field, or "10,000+ matches" for a window further down (its position is unknown). */
  function positionLabel(): string {
    if (search.start > 0) return m.search.matches(countLabel());
    return m.search.position(formatNumber(search.current + 1), countLabel());
  }

  /** The same, phrased to be read aloud. */
  function spokenPosition(): string {
    if (search.start > 0) return m.search.matches(countLabel());
    return m.search.positionSpoken(formatNumber(search.current + 1), countLabel());
  }

  /**
   * Engines explain a bad pattern in English only, so the common mistakes are explained from
   * the catalogue; for the rest the catalogue decides whether the engine's words are shown.
   */
  function regexProblem(message: string): string {
    const code = classifyRegexError(message);
    if (code === 'unknown') return m.search.invalidRegexOther(regexErrorDetail(message));
    return m.search.invalidRegex(m.search.regexErrors[code]);
  }

  function statusProblem(status: SearchStatus): string {
    if (status.status === 'error') return regexProblem(status.message);
    if (status.status === 'unfinished') return status.message;
    return '';
  }

  // ---------------------------------------------------------------- saved state

  /**
   * The file name to show for a stored draft. Both language versions of the page share one
   * draft, so a default name saved on the other one ("adsız.txt" on the English page) becomes
   * this page's default: the visitor never typed it.
   */
  function storedFilename(name: string | null): string {
    if (name === null) return m.defaultFilename;
    return LOCALES.some((other) => notepadMessages[other].defaultFilename === name) ? m.defaultFilename : name;
  }

  function formatSavedAt(time: number): string {
    const date = new Date(time);
    const today = new Date().toDateString() === date.toDateString();
    return (today ? timeFormat : dayTimeFormat).format(date);
  }

  /** The status bar's save state: when the text was stored, or why it isn't. */
  function renderSaveState(): void {
    const state = autosave.state;
    let long = '';
    let short = '';
    let warning = false;
    if (state === 'saved' && autosave.savedAt !== null) {
      const time = formatSavedAt(autosave.savedAt);
      long = m.status.saved(time);
      short = m.status.savedShort(time);
    } else if (state === 'off') {
      if (isModified() && knownLength > 0) {
        long = short = m.status.unsaved;
        warning = true;
      }
    } else if (state === 'full' || state === 'error' || (state === 'unavailable' && knownLength > 0)) {
      long = short = m.status[state];
      warning = true;
    }

    // The status bar isn't a live region (it changes on every save). Screen readers hear once
    // when the text stops being kept here; turning autosave off is the visitor's own choice.
    const problem = warning && state !== 'off' ? state : null;
    if (problem !== announcedProblem) {
      announcedProblem = problem;
      if (problem) announce(long);
    }

    const key = `${long}\n${short}\n${warning}`;
    if (key === renderedSaveState) return;
    renderedSaveState = key;
    el.saveState.title = long;
    if (warning) el.saveState.dataset.tone = 'warning';
    else delete el.saveState.dataset.tone;
    if (long === short) {
      el.saveState.textContent = long;
      return;
    }
    const wide = document.createElement('span');
    wide.className = 'max-sm:hidden';
    wide.textContent = long;
    const narrow = document.createElement('span');
    narrow.className = 'sm:hidden';
    narrow.textContent = short;
    el.saveState.replaceChildren(wide, narrow);
  }

  function renderAutosaveToggle(): void {
    el.autosaveToggle.setAttribute('aria-checked', String(autosave.enabled));
    el.autosaveToggle.disabled = autosave.state === 'unavailable';
  }

  /** Text that exists nowhere else: not stored by autosave, and changed since it was opened or downloaded. */
  function hasUnprotectedText(length: number): boolean {
    return !autosave.protects && isModified() && length > 0;
  }

  function onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!hasUnprotectedText(editor.value.length)) return;
    event.preventDefault();
    // Older browsers need returnValue set to show the prompt.
    event.returnValue = '';
  }

  /**
   * The "leave page?" prompt is only armed while text would be lost: with autosave working,
   * pagehide stores the last change instead. (The listener also keeps the page out of the
   * back/forward cache, another reason to add it only when needed.)
   */
  function updateUnloadGuard(): void {
    const needed = hasUnprotectedText(knownLength);
    if (needed && !unloadGuardInstalled) {
      window.addEventListener('beforeunload', onBeforeUnload);
      unloadGuardInstalled = true;
    } else if (!needed && unloadGuardInstalled) {
      window.removeEventListener('beforeunload', onBeforeUnload);
      unloadGuardInstalled = false;
    }
  }

  // Store the last change before the page goes away or into the background (phones may
  // discard a background tab without another event).
  window.addEventListener('pagehide', () => autosave.flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') autosave.flush();
  });

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

    summary('lines', m.status.lines(stats.lines, formatNumber(stats.lines)));
    summary('words', m.status.words(stats.words, formatNumber(stats.words)));

    detail('characters', formatNumber(stats.characters));
    detail('charactersNoSpaces', formatNumber(stats.charactersNoSpaces));
    detail('words', formatNumber(stats.words));
    detail('sentences', formatNumber(stats.sentences));
    detail('lines', formatNumber(stats.lines));
    detail('paragraphs', formatNumber(stats.paragraphs));
    detail(
      'bytes',
      stats.bytes >= 1024 ? m.stats.bytesDetail(formatNumber(stats.bytes), f.bytes(stats.bytes)) : formatNumber(stats.bytes),
    );
    detail('readingMinutes', m.stats.minutes(formatNumber(stats.readingMinutes)));
    renderSaveState();
    updateUnloadGuard();
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
    el.caret.textContent = m.status.caret(formatNumber(line), formatNumber(column));
    if (end > start) {
      const { count, exact } = countCharactersBounded(text.slice(start, end), SELECTION_SEGMENT_LIMIT);
      el.selectionCount.textContent = m.status.selected(formatNumber(count), !exact);
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

  /** Withdraws the offer to undo Clear (the text was edited since). */
  function dismissClearUndo(): void {
    if (!clearedState) return;
    const hadFocus = el.notice.contains(document.activeElement);
    setMessage('');
    if (hadFocus) editor.focus({ preventScroll: true });
  }

  /**
   * The browser's undo brought back the text Clear removed: the file name and line endings come
   * back with it, unless they were changed since. Returns false for any other undo.
   */
  function undoClearSettings(): boolean {
    const state = clearedForNativeUndo;
    if (!state || editor.value !== state.text) return false;
    clearedForNativeUndo = null;
    if (el.filename.value === m.defaultFilename) el.filename.value = state.filename;
    if (getLineEnding() === 'lf') el.lineEnding.value = state.lineEnding;
    if (state.wasClean) cleanVersion = textVersion;
    setMessage('');
    announce(m.clear.undone);
    return true;
  }

  /**
   * `byUser`: typed, pasted, dropped or undone in the textarea (not an edit made by this code);
   * `inputType` comes from its input event.
   */
  function handleTextChange(byUser: boolean, inputType = ''): void {
    textVersion++;
    if (byUser && !applyingEdit) {
      hideReplaceResult();
      if (!(inputType === 'historyUndo' && undoClearSettings())) dismissClearUndo();
    }
    stats.schedule();
    scheduleCaretUpdate();
    autosave.schedule(knownLength);
    updateUnloadGuard();
    if (search.open && search.options.query !== '') scheduleSearch(false);
  }

  editor.addEventListener('input', (event) => handleTextChange(true, (event as InputEvent).inputType ?? ''));

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
      el.findCount.textContent = count > 0 ? positionLabel() : m.search.noResults;
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
      el.findCount.textContent = m.search.searching;
      delete el.findCount.dataset.tone;
    }, 250);
  }

  function countAnnouncement(): string {
    const status = search.compiled;
    const problem = statusProblem(status);
    if (problem) return problem;
    if (status.status === 'empty') return '';
    if (search.matches.length === 0) return m.search.noResults;
    return spokenPosition();
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
    applySearch({ status: 'unfinished', message: m.search.timeout }, version, emptyWindow(), 0, false, text);
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
          const message = outcome.tooLarge ? m.search.tooLarge : m.search.failed;
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
          announce(m.search.timeout);
        } else {
          updateFindStatus();
          if (outcome.status === 'failed') announce(m.search.failed);
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

    // In zen mode the editor fills the screen: the page itself never scrolls.
    if (zenMode.active) return;
    // Bring the editor itself into view unless the user is typing in the find panel
    // (scrolling the page then would fight the on-screen keyboard).
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && el.findPanel.contains(active)) return;
    const anchor = highlighter.anchor(index);
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const viewport = window.visualViewport;
    // Below the sticky site header, however tall it is.
    const header = document.querySelector('body > header');
    const headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
    const top = Math.max(viewport?.offsetTop ?? 0, headerBottom) + 8;
    // Above the status bar, which sticks to the bottom of the viewport while the window is taller.
    const bottom = Math.min(
      viewport ? viewport.offsetTop + viewport.height : window.innerHeight,
      el.status.getBoundingClientRect().top,
    );
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
    announce(m.search.atLine(spokenPosition(), formatNumber(line)));
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
      announce(m.search.noResults);
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
        announce(m.search.noResults);
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
    el.previewTitle.textContent = m.find.previewCount(countLabel());
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
      query<HTMLElement>(row, '[data-preview-line]').textContent = m.find.previewLine(formatNumber(item.line));
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
      ? (search.start > 0 ? m.find.previewWindow : m.find.previewFirst)(formatNumber(items.length), countLabel())
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
    if (isComposing(event)) return;
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
    if (spoken) announce(m.optionState(m.options[key], value));
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
      announce(m.search.typeFirst);
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
      announce(m.search.noResults);
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
      announce(m.replace.replacedProblem(problem));
      return;
    }
    const left = search.matches.length;
    announce(left === 0 ? m.replace.replacedNoMore : m.replace.replacedLeft(left, countLabel()));
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
      announce(m.search.noResults);
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
        reportReplaceAllProblem(m.replace.tooLarge);
        return;
      }
    } else {
      // In the worker, like every regular-expression search.
      let busyToken = -1;
      const busyTimer = window.setTimeout(() => {
        setMessage(m.replace.replacing);
        busyToken = messageToken;
      }, 300);
      const outcome = await runner.replaceAll(
        { text, version, regex: compiled.regex, timeout: replaceTimeout(text.length) },
        template,
        true,
      );
      window.clearTimeout(busyTimer);
      // Clear "Replacing…" unless another notice has replaced it meanwhile.
      if (busyToken === messageToken) setMessage('');
      if (outcome.status === 'cancelled' || !search.open) return;
      if (outcome.status === 'timeout') {
        reportReplaceAllProblem(m.replace.timeout);
        return;
      }
      if (outcome.status === 'failed') {
        console.error('Notepad: replace all failed', outcome.message);
        reportReplaceAllProblem(outcome.tooLarge ? m.replace.tooLarge : m.replace.failed);
        return;
      }
      if (version !== textVersion) {
        reportReplaceAllProblem(m.replace.textChanged);
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
    const message = m.replace.replacedAll(result.count, formatNumber(result.count));
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
    // Ctrl+Shift+Enter is the zen shortcut (handled on the document), not Replace all.
    if (isComposing(event) || event.key !== 'Enter' || event.altKey || isZenShortcut(event)) return;
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
    announce(m.replace.undone);
  });

  // ---------------------------------------------------------------- editor surface

  editor.addEventListener('scroll', () => highlighter.syncScroll(), { passive: true });

  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      if (highlighter.active) highlighter.sync();
    }).observe(editor);
  }

  function setWrap(on: boolean): void {
    wrapLines = on;
    el.editorWrap.dataset.wrap = on ? 'on' : 'off';
    editor.setAttribute('wrap', on ? 'soft' : 'off');
    el.wrapToggle.setAttribute('aria-pressed', String(on));
    if (on) editor.scrollLeft = 0;
    highlighter.sync();
  }

  el.wrapToggle.addEventListener('click', () => {
    setWrap(!wrapLines);
    autosave.schedule(knownLength);
  });

  // ---------------------------------------------------------------- zen mode

  const zenMode = createZenMode({
    root,
    card: el.card,
    editor,
    toggle: el.zenToggle,
    exit: el.zenExit,
    coarsePointer,
    onChange: (on) => {
      highlighter.sync();
      announce(on ? m.zen.on : m.zen.off);
    },
    onFullscreenExit: () => {
      if (!search.open) return false;
      closePanel(true);
      return true;
    },
  });

  // ---------------------------------------------------------------- open, clear, download

  function loadText(text: string, filename: string): void {
    const lineEnding = detectLineEnding(text);
    clearedForNativeUndo = null;
    editor.value = text;
    editor.setSelectionRange(0, 0);
    editor.scrollTop = 0;
    editor.scrollLeft = 0;
    el.filename.value = filename;
    el.lineEnding.value = lineEnding;
    hideReplaceResult();
    textVersion++;
    cleanVersion = textVersion;
    stats.schedule(true);
    scheduleCaretUpdate();
    autosave.schedule(text.length);
    updateUnloadGuard();
    search.matches = [];
    search.truncated = false;
    search.start = 0;
    search.current = -1;
    search.anchor = 0;
    if (search.open) runSearch(false);
  }

  async function openFile(file: File): Promise<void> {
    if (confirmDialog.open) return;
    const name = file.name || m.defaultFilename;
    if (file.size > MAX_OPEN_BYTES) {
      const message = m.files.tooLarge(name, f.bytes(file.size), `${formatNumber(MAX_OPEN_MEGABYTES)} MB`);
      setMessage(message, 'error');
      announce(message);
      return;
    }
    if (
      isModified() &&
      editor.value.length > 0 &&
      !(await confirmDialog.ask({
        title: m.files.replaceTitle(name),
        body: m.files.replaceBody,
        confirm: m.files.replaceConfirm,
        returnFocus: el.openButton,
      }))
    ) {
      return;
    }

    const generation = ++openGeneration;
    let text: string;
    let utf16: boolean;
    try {
      const decoded = decodeTextFile(new Uint8Array(await file.arrayBuffer()));
      text = decoded.text;
      utf16 = decoded.encoding !== 'utf-8';
    } catch (error) {
      console.error('Notepad: could not read file', error);
      const message = m.files.readError(name);
      setMessage(message, 'error');
      announce(message);
      return;
    }
    if (generation !== openGeneration) return; // another file was opened meanwhile
    if (
      text.slice(0, 8000).includes(NUL) &&
      !(await confirmDialog.ask({
        title: m.files.notTextTitle(name),
        body: m.files.notTextBody,
        confirm: m.files.notTextConfirm,
        returnFocus: el.openButton,
      }))
    ) {
      return;
    }
    if (generation !== openGeneration) return;

    loadText(text, name);
    const notes: string[] = [];
    if (utf16) notes.push(m.files.utf16(name));
    if (text.includes(REPLACEMENT_CHARACTER)) notes.push(m.files.badCharacters(name, utf16 ? 'UTF-16' : 'UTF-8'));
    const note = notes.join(' ');
    setMessage(note);
    announce(note ? m.files.openedWithNote(name, note) : m.files.opened(name));
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

  /**
   * Clear: starts over with an empty, untitled page and removes the stored draft. It asks first,
   * and can be undone right afterwards with the Undo button, and with Ctrl+Z for texts the
   * browser's own undo can take (undoClearSettings restores the name and line endings then).
   */
  async function clearText(): Promise<void> {
    if (confirmDialog.open) return;
    const text = editor.value;
    const filename = el.filename.value;
    const lineEnding = getLineEnding();
    if (text === '') {
      // Nothing to lose: reset the name and line endings without asking.
      el.filename.value = m.defaultFilename;
      el.lineEnding.value = 'lf';
      if (lineEnding !== 'lf') stats.schedule(true);
      autosave.clear();
      setMessage('');
      if (!coarsePointer) editor.focus();
      return;
    }
    const confirmed = await confirmDialog.ask({
      title: m.clear.title,
      body: m.clear.body,
      confirm: m.clear.confirm,
      danger: true,
      returnFocus: el.clearButton,
    });
    if (!confirmed) {
      return;
    }
    if (editor.value !== text) return; // edited in another tab meanwhile: ask again

    const cleared: ClearedState = {
      text,
      filename,
      lineEnding,
      selectionStart: editor.selectionStart,
      selectionEnd: editor.selectionEnd,
      scrollTop: editor.scrollTop,
      scrollLeft: editor.scrollLeft,
      wasClean: !isModified(),
    };
    openGeneration++; // a file still being read won't fill the cleared page
    hideReplaceResult();
    replaceWholeText(text, '');
    // replaceWholeText used the browser's editing commands, which Ctrl+Z can undo.
    clearedForNativeUndo = !coarsePointer && text.length <= UNDOABLE_EDIT_LIMIT ? cleared : null;
    el.filename.value = m.defaultFilename;
    el.lineEnding.value = 'lf';
    stats.schedule(true);
    autosave.clear();
    cleanVersion = textVersion;
    updateUnloadGuard();
    setMessage(m.clear.done, 'neutral', { undo: true });
    clearedState = cleared;
    announce(m.clear.done);
    if (!coarsePointer) editor.focus();
  }

  el.clearButton.addEventListener('click', () => void clearText());

  el.noticeUndo.addEventListener('click', () => {
    const state = clearedState;
    if (!state) return;
    clearedState = null;
    clearedForNativeUndo = null;
    replaceWholeText(editor.value, state.text);
    el.filename.value = state.filename;
    el.lineEnding.value = state.lineEnding;
    editor.setSelectionRange(state.selectionStart, state.selectionEnd);
    editor.scrollTop = state.scrollTop;
    editor.scrollLeft = state.scrollLeft;
    highlighter.syncScroll();
    if (state.wasClean) cleanVersion = textVersion;
    stats.schedule(true);
    autosave.schedule(state.text.length);
    updateUnloadGuard();
    setMessage('');
    announce(m.clear.undone);
    // The Undo button just disappeared: continue in the text (or at Clear on touch screens,
    // where focusing the text would open the keyboard).
    if (coarsePointer) el.clearButton.focus();
    else editor.focus();
  });

  function download(): void {
    const name = sanitizeFilename(el.filename.value, m.defaultFilename);
    el.filename.value = name;
    try {
      const text = convertLineEndings(editor.value, getLineEnding());
      saveBlob(new Blob([text], { type: mimeTypeForFilename(name) }), name);
    } catch (error) {
      console.error('Notepad: download failed', error);
      const message = m.files.downloadFailed;
      setMessage(message, 'error');
      announce(message);
      return;
    }
    cleanVersion = textVersion;
    autosave.schedule(knownLength); // the name may have been tidied up
    updateUnloadGuard();
    renderSaveState();
    if (el.message.dataset.tone === 'error') setMessage('');
    announce(m.files.downloaded(name));
  }

  el.save.addEventListener('click', download);

  el.filename.addEventListener('input', () => autosave.schedule(knownLength));
  el.filename.addEventListener('keydown', (event) => {
    if (isComposing(event) || event.key !== 'Enter' || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    // On touch screens the keyboard's "done" key just closes the keyboard (Download is right there).
    if (coarsePointer) el.filename.blur();
    else download();
  });

  el.lineEnding.addEventListener('change', () => {
    stats.schedule(true);
    autosave.schedule(knownLength);
  });

  el.autosaveToggle.addEventListener('click', () => {
    const on = !autosave.enabled;
    autosave.setEnabled(on);
    if (autosave.enabled === on) announce(on ? m.status.autosaveOn : m.status.autosaveOff);
  });

  // ---------------------------------------------------------------- other tabs

  /**
   * Shows what storage now holds: another tab saved or cleared the draft. Only called while
   * this tab's own text is stored and unchanged since, so nothing of this tab is lost. The
   * value is set directly: the browser's editing commands would move focus into the text (and
   * open the keyboard on phones) while the visitor may be reading.
   */
  function adoptStoredDraft(draft: RestoredDraft | null): void {
    const text = draft?.text ?? '';
    const changed = text !== editor.value;
    if (changed) {
      const { selectionStart, selectionEnd, scrollTop, scrollLeft } = editor;
      clearedForNativeUndo = null;
      editor.value = text;
      const length = editor.value.length;
      editor.setSelectionRange(Math.min(selectionStart, length), Math.min(selectionEnd, length));
      editor.scrollTop = scrollTop;
      editor.scrollLeft = scrollLeft;
      hideReplaceResult();
      if (clearedState) setMessage('');
      textVersion++;
      if (text === '') cleanVersion = textVersion;
      scheduleCaretUpdate();
      if (search.open && search.options.query !== '') scheduleSearch(false);
    }
    el.filename.value = storedFilename(draft?.filename ?? null);
    el.lineEnding.value = draft?.lineEnding ?? 'lf';
    if (draft?.wrap != null && draft.wrap !== wrapLines) setWrap(draft.wrap);
    stats.schedule(true);
    if (draft && draft.savedAt !== null) {
      autosave.markStored({ version: textVersion, filename: el.filename.value, lineEnding: getLineEnding() }, draft.savedAt);
    } else {
      autosave.clear();
    }
    updateUnloadGuard();
    if (changed) {
      setMessage(m.status.fromOtherTab);
      if (document.visibilityState === 'visible') announce(m.status.fromOtherTab);
    }
  }

  function syncFromStorage(): void {
    // A change waiting here wins (it is written over the other tab's save); text that isn't
    // stored (autosave off or failing) is never replaced.
    if (!autosave.enabled || autosave.pending || confirmDialog.open) return;
    if (autosave.state !== 'saved' && autosave.state !== 'idle') return;
    const meta = autosave.storedMeta();
    if (!meta) {
      if (autosave.state === 'saved') adoptStoredDraft(null); // cleared in another tab
      return;
    }
    if (meta.savedAt === autosave.savedAt) return; // this tab's own save, or only a caret move
    const draft = autosave.load();
    // Incomplete: the other tab is between its two writes; its metadata write follows.
    if (!draft || !draft.complete) return;
    adoptStoredDraft(draft);
  }

  /**
   * Autosave was turned off in another tab: stop storing here too, so this tab doesn't put the
   * text back. (Turned on elsewhere, this tab stays as it is: storing its text now would
   * overwrite the draft the other tab just saved.)
   */
  function followStoredPreference(): void {
    if (autosave.enabled && !autosave.storedPreference()) autosave.setEnabled(false, { persist: false });
  }

  window.addEventListener('storage', (event) => {
    if (event.key === DRAFT_KEYS.autosave) followStoredPreference();
    // The metadata is written after the text, so its change means a complete save.
    else if (event.key === DRAFT_KEYS.meta || event.key === null) syncFromStorage();
  });

  // Back from the back/forward cache: storage events were missed meanwhile.
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    followStoredPreference();
    syncFromStorage();
  });

  // ---------------------------------------------------------------- keyboard shortcuts

  root.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || isComposing(event) || confirmDialog.open) return;
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

    // Esc, innermost first: an IME composition (ignored above), then the find panel, then zen
    // mode (the document listener below). In zen mode the panel closes from anywhere in the tool.
    if (event.key === 'Escape' && search.open) {
      const target = event.target;
      if (zenMode.active || target === editor || (target instanceof Node && el.findPanel.contains(target))) {
        event.preventDefault();
        closePanel(true);
      }
    }
  });

  // Shortcuts that work anywhere on the page. The root's listener runs first, so an Esc that
  // closed the find panel arrives here already handled (defaultPrevented).
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || isComposing(event) || confirmDialog.open) return;

    if (isZenShortcut(event)) {
      event.preventDefault();
      zenMode.set(!zenMode.active);
      return;
    }

    if (event.key === 'Escape' && zenMode.active) {
      event.preventDefault();
      zenMode.set(false);
      return;
    }

    // Ctrl/Cmd+S downloads the text instead of saving the web page.
    if (hasPrimaryModifier(event) && !event.altKey && isLetter(event, 's')) {
      event.preventDefault();
      download();
    }
  });

  // ---------------------------------------------------------------- labels and start-up

  // On Apple platforms Option+letter types characters in the find fields, so these shortcuts only
  // work while a panel button has focus: not advertised there.
  const optionShortcut = (key: string): Shortcut | null => (IS_APPLE ? null : { alt: true, key });
  const titles: Array<[HTMLElement, string, Shortcut | null]> = [
    [el.save, m.titles.download, { primary: true, key: 'S' }],
    [el.openButton, m.titles.open, { primary: true, key: 'O' }],
    [el.clearButton, m.titles.clear, null],
    [el.findToggle, m.titles.find, { primary: true, key: 'F' }],
    [el.replaceToggle, m.titles.replace, IS_APPLE ? { primary: true, alt: true, key: 'F' } : { primary: true, key: 'H' }],
    [el.wrapToggle, m.titles.wrap, null],
    [el.zenToggle, m.titles.zen, ZEN_SHORTCUT],
    [el.zenExit, m.titles.zenExit, { key: 'Esc' }],
    [el.findPrev, m.titles.previous, { shift: true, key: 'F3' }],
    [el.findNext, m.titles.next, { key: 'F3' }],
    [el.findClose, m.titles.close, { key: 'Esc' }],
    [el.optionButtons.get('matchCase')!, m.options.matchCase, optionShortcut('C')],
    [el.optionButtons.get('wholeWord')!, m.options.wholeWord, optionShortcut('W')],
    [el.optionButtons.get('regex')!, m.options.regex, optionShortcut('R')],
    [el.optionButtons.get('multiline')!, m.optionTitles.multiline, null],
    [el.optionButtons.get('dotAll')!, m.optionTitles.dotAll, null],
    [el.autosaveToggle, m.titles.autosave, null],
    [el.lineEnding, m.titles.lineEnding, null],
  ];
  for (const [element, label, shortcut] of titles) {
    element.title = shortcut ? m.withShortcut(label, shortcutLabel(shortcut)) : label;
    // Only real shortcuts; keys like Esc just act on the focused panel.
    if (shortcut && (shortcut.primary || shortcut.alt)) element.setAttribute('aria-keyshortcuts', ariaShortcut(shortcut));
  }
  // aria-keyshortcuts names the key, not the symbol shown on Apple keyboards.
  el.zenToggle.setAttribute('aria-keyshortcuts', ariaShortcut({ ...ZEN_SHORTCUT, key: 'Enter' }));

  /**
   * Brings back the draft an earlier visit left in this browser. `early` is text typed into the
   * editor before this script ran: it never replaces the draft (the first save would overwrite
   * a draft the visitor hasn't seen), and goes after it instead.
   */
  function restoreStoredDraft(early: string): void {
    const draft = autosave.load();
    if (!draft) {
      if (early !== '') handleTextChange(false);
      return;
    }
    const { text, kept } = combineDraftWithEarlyText(draft.text, early);
    if (text !== editor.value) editor.value = text;
    el.filename.value = storedFilename(draft.filename);
    // A textarea turns CRLF into LF, so the choice comes from the metadata, not the text.
    el.lineEnding.value = draft.lineEnding ?? 'lf';
    if (draft.wrap !== null && draft.wrap !== wrapLines) setWrap(draft.wrap);

    if (kept !== 'draft') {
      // Continue where the typing was: at the end. The combined text is saved like any edit.
      if (kept === 'both') {
        const end = editor.value.length;
        editor.setSelectionRange(end, end);
        editor.scrollTop = editor.scrollHeight;
        setMessage(m.status.earlyTextKept);
        announce(m.status.earlyTextKept);
      }
      handleTextChange(false);
      return;
    }

    // Restored text counts as changed: opening a file over it asks first.
    textVersion++;
    if (draft.selection) editor.setSelectionRange(draft.selection.start, draft.selection.end);
    editor.scrollTop = draft.scrollTop;
    if (draft.complete && draft.savedAt !== null) {
      autosave.markStored({ version: textVersion, filename: el.filename.value, lineEnding: getLineEnding() }, draft.savedAt);
    } else {
      // Interrupted or damaged: write a consistent draft.
      autosave.schedule(draft.text.length);
    }
  }

  // Browsers may restore earlier form input on reload: start from the stored draft (or an empty
  // page) instead. Only text typed before this script ran is kept.
  const typedEarly = document.activeElement === editor && editor.value !== '';
  const early = typedEarly ? editor.value : '';
  if (!typedEarly) editor.value = '';
  el.filename.value = m.defaultFilename;
  el.lineEnding.value = 'lf';
  el.findInput.value = '';
  el.replaceInput.value = '';
  el.editorWrap.dataset.wrap = 'on';
  restoreStoredDraft(early);
  stats.schedule(true);
  updateCaret();
  renderAutosaveToggle();
  renderSaveState();
  updateUnloadGuard();
}
