/**
 * Console: DOM wiring (browser only).
 *
 * The command line is a real <input>, made transparent and laid over a "mirror" that draws the
 * typed text with a block cursor (a native caret can be neither a block nor glow). The input
 * keeps focus, selection, IME and on-screen keyboards working; the mirror only follows it.
 * Clicks and taps are the exception: they are placed by the mirror's layout (see "Pointer").
 * Commands run through the pure shell in src/lib/console/, and their structured output is
 * rendered by ./render.ts in the page language.
 *
 * Stored in localStorage (when allowed): font size, phosphor colour, the last commands, and the
 * language when the visitor switches it here (the key the site header uses).
 */
import { getPageLocale } from '../../i18n/client.ts';
import { isLocale, LOCALE_STORAGE_KEY } from '../../i18n/config.ts';
import { consoleMessages } from '../../i18n/console/messages.ts';
import { common } from '../../i18n/messages/common.ts';
import { caretAt, characterAt, wordAt } from '../../lib/console/caret.ts';
import type { CharBox } from '../../lib/console/caret.ts';
import { execute } from '../../lib/console/commands.ts';
import { complete } from '../../lib/console/complete.ts';
import type { ConsoleData } from '../../lib/console/data.ts';
import { addToHistory, freshRecall, parseStoredHistory, recall } from '../../lib/console/history.ts';
import type { RecallState } from '../../lib/console/history.ts';
import { FONT_SIZES, parseFontSize, parsePhosphor, PHOSPHORS, stepFontSize, STORAGE_KEYS } from '../../lib/console/prefs.ts';
import type { Phosphor } from '../../lib/console/prefs.ts';
import { promptPath } from '../../lib/console/vfs.ts';
import type { FsPath } from '../../lib/console/vfs.ts';
import { renderCandidates, renderDocument, renderEcho, renderOutputs } from './render.ts';
import type { RenderContext } from './render.ts';
import { readStorage, writeStorage } from './storage.ts';
import { Typewriter } from './typewriter.ts';

/** Transcript entries kept; older ones are dropped so a long session stays light. */
const MAX_ENTRIES = 400;
/** Pause between "Opening …" / "logout" and leaving, so the line can be read. */
const NAVIGATE_DELAY_MS = 450;

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Console: missing element ${selector}`);
  return element;
}

function getElements(root: HTMLElement) {
  return {
    log: query<HTMLElement>(root, '[data-log]'),
    typing: query<HTMLElement>(root, '[data-typing]'),
    form: query<HTMLFormElement>(root, '[data-form]'),
    input: query<HTMLInputElement>(root, '[data-input]'),
    mirror: query<HTMLElement>(root, '[data-mirror]'),
    prompt: query<HTMLElement>(root, '[data-prompt]'),
    fontDown: query<HTMLButtonElement>(root, '[data-font-down]'),
    fontUp: query<HTMLButtonElement>(root, '[data-font-up]'),
    fontValue: query<HTMLOutputElement>(root, '[data-font-value]'),
    phosphorButtons: Array.from(root.querySelectorAll<HTMLButtonElement>('[data-phosphor-choice]')),
    data: query<HTMLScriptElement>(root, 'script[data-console-data]'),
  };
}

export function initConsole(root: HTMLElement): void {
  const els = getElements(root);
  const locale = getPageLocale();
  const m = consoleMessages[locale];
  const data = JSON.parse(els.data.textContent ?? '') as ConsoleData;
  const ctx: RenderContext = { m, newTab: common[locale].newTab, docs: data.docs };
  const html = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)');

  let cwd: FsPath = [];
  let history = parseStoredHistory(readStorage(STORAGE_KEYS.history));
  let recallState: RecallState = freshRecall(history);
  let fontSize = parseFontSize(readStorage(STORAGE_KEYS.fontSize));
  let phosphor: Phosphor = parsePhosphor(readStorage(STORAGE_KEYS.phosphor));
  let leaving = false;
  /** The line whose completion matches were last listed (cleared when the line changes). */
  let listedFor: string | null = null;

  const typewriter = new Typewriter(els.typing, {
    onFrame: keepInputInView,
    // While output is being typed there is no prompt, as in a real terminal.
    onBusyChange: (busy) => root.toggleAttribute('data-busy', busy),
  });

  // ---- The command line -------------------------------------------------------------------

  const cursor = document.createElement('span');
  cursor.className = 'console-cursor';

  const promptText = () => `${data.user}@${data.host}:${promptPath(cwd)}$`;

  /** Redraws the mirror: the text with the block cursor on the caret (or the selection highlighted). */
  function renderMirror(): void {
    const { value } = els.input;
    const start = els.input.selectionStart ?? value.length;
    const end = els.input.selectionEnd ?? start;
    if (start !== end) {
      const selection = document.createElement('span');
      selection.className = 'console-selection';
      selection.textContent = value.slice(start, end);
      els.mirror.replaceChildren(value.slice(0, start), selection, value.slice(end));
      return;
    }
    // The cursor covers the character under the caret, or a space at the end of the line.
    const codePoint = value.codePointAt(start);
    const under = codePoint === undefined ? ' ' : String.fromCodePoint(codePoint);
    cursor.textContent = under;
    els.mirror.replaceChildren(value.slice(0, start), cursor, value.slice(start + (codePoint === undefined ? 0 : under.length)));
  }

  function setInput(value: string): void {
    els.input.value = value;
    els.input.setSelectionRange(value.length, value.length);
    listedFor = null;
    renderMirror();
  }

  function updatePrompt(): void {
    els.prompt.textContent = promptText();
  }

  function keepInputInView(): void {
    els.form.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }

  // ---- Pointer ----------------------------------------------------------------------------
  // The input covers the whole command line, prompt included, in a fixed 16px font that never
  // wraps, so its own hit testing would put the caret under a different character from the one
  // drawn there. Clicks and taps are placed by the mirror's characters instead.

  /** Where the mirror drew each character, with its offset in the command line. */
  function mirrorBoxes(): CharBox[] {
    const boxes: CharBox[] = [];
    const range = document.createRange();
    const walker = document.createTreeWalker(els.mirror, NodeFilter.SHOW_TEXT);
    // The mirror's text is the value in order (the cursor block holds the character under the
    // caret), plus one space for the cursor at the end of the line.
    let offset = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node as Text).data;
      for (let i = 0; i < text.length; ) {
        const size = (text.codePointAt(i) ?? 0) > 0xffff ? 2 : 1;
        range.setStart(node, i);
        range.setEnd(node, i + size);
        const { left, right, top, bottom } = range.getBoundingClientRect();
        boxes.push({ start: offset + i, end: offset + i + size, left, right, top, bottom });
        i += size;
      }
      offset += text.length;
    }
    return boxes;
  }

  /** The caret offset for a point (never past the end: the cursor's own space is not text). */
  function caretFromPoint(x: number, y: number): number {
    return Math.min(caretAt(mirrorBoxes(), x, y) ?? 0, els.input.value.length);
  }

  function select(anchor: number, focus: number): void {
    const direction = focus < anchor ? 'backward' : 'forward';
    els.input.setSelectionRange(Math.min(anchor, focus), Math.max(anchor, focus), direction);
    renderMirror();
  }

  /** The kind of pointer behind the next mousedown/click on the input ('mouse', 'touch', 'pen'). */
  let pointerType = '';

  /**
   * Mouse: the whole gesture is handled here (the native one would follow the input's layout):
   * click places the caret, drag or Shift+click selects, double-click selects a word (a run of
   * non-spaces, like a terminal) and triple-click the line.
   */
  function onMouseDown(event: MouseEvent): void {
    if (pointerType !== 'mouse' || event.button !== 0) return;
    event.preventDefault();
    const hadFocus = document.activeElement === els.input;
    const previousAnchor = els.input.selectionDirection === 'backward' ? els.input.selectionEnd : els.input.selectionStart;
    els.input.focus({ preventScroll: true });
    const { value } = els.input;

    if (event.detail >= 3) {
      select(0, value.length);
      return;
    }
    if (event.detail === 2) {
      const word = wordAt(value, characterAt(mirrorBoxes(), event.clientX, event.clientY) ?? value.length);
      select(word.start, word.end);
      return;
    }

    const at = caretFromPoint(event.clientX, event.clientY);
    const anchor = event.shiftKey && hadFocus && previousAnchor !== null ? previousAnchor : at;
    select(anchor, at);
    const move = (moved: MouseEvent) => select(anchor, caretFromPoint(moved.clientX, moved.clientY));
    const release = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', release);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', release);
  }

  /**
   * Touch and pen: the tap itself stays native (focusing the input is what opens the on-screen
   * keyboard, and long-press paste keeps working); the caret is then moved to the character
   * that was tapped. A selection made with the system handles is left alone.
   */
  function onTap(event: MouseEvent): void {
    if ((pointerType !== 'touch' && pointerType !== 'pen') || els.input.selectionStart !== els.input.selectionEnd) return;
    const at = caretFromPoint(event.clientX, event.clientY);
    select(at, at);
  }

  // ---- The transcript ---------------------------------------------------------------------

  function commit(entry: HTMLElement): void {
    els.log.append(entry);
    while (els.log.childElementCount > MAX_ENTRIES) els.log.firstElementChild?.remove();
    keepInputInView();
  }

  /** Appends output, typed out unless the visitor prefers reduced motion. */
  function print(entry: HTMLElement): void {
    if (reducedMotion.matches) commit(entry);
    else typewriter.play(entry, () => commit(entry));
  }

  /** Appends a line the visitor typed; anything still being typed out is completed first. */
  function echo(line: string, suffix = ''): void {
    typewriter.finish();
    commit(renderEcho(promptText(), line, ctx, suffix));
  }

  function clearScreen(): void {
    typewriter.cancel();
    els.log.replaceChildren();
    keepInputInView();
  }

  function leave(href: string): void {
    leaving = true;
    window.setTimeout(() => {
      typewriter.finish();
      window.location.assign(href);
    }, reducedMotion.matches ? 0 : NAVIGATE_DELAY_MS);
  }

  function run(line: string): void {
    if (leaving) return;
    echo(line);
    history = addToHistory(history, line);
    writeStorage(STORAGE_KEYS.history, JSON.stringify(history));
    recallState = freshRecall(history);

    const result = execute(line, { cwd, root: data.root, projects: data.projects, history, home: data.home });
    cwd = result.cwd;
    updatePrompt();
    if (result.effect?.type === 'clear') clearScreen();
    if (result.output.length > 0) print(renderOutputs(result.output, ctx));
    if (result.effect?.type === 'navigate') leave(result.effect.href);
  }

  function completeInput(): void {
    const caret = els.input.selectionStart ?? els.input.value.length;
    const before = els.input.value.slice(0, caret);
    const after = els.input.value.slice(els.input.selectionEnd ?? caret);
    const result = complete(before, { cwd, root: data.root, projects: data.projects });
    if (result.text !== before) {
      els.input.value = result.text + after;
      els.input.setSelectionRange(result.text.length, result.text.length);
      renderMirror();
    } else if (result.candidates.length > 1 && listedFor !== els.input.value) {
      // Nothing more to add: list the matches under the line (once; more Tabs add nothing new).
      listedFor = els.input.value;
      echo(els.input.value);
      commit(renderCandidates(result.candidates));
    }
  }

  // ---- Preferences ------------------------------------------------------------------------

  function applyFontSize(): void {
    html.style.setProperty('--console-font-size', `${fontSize}px`);
    els.fontValue.textContent = m.toolbar.fontSizeValue(fontSize);
    // aria-disabled rather than disabled: a disabled button would drop keyboard focus.
    els.fontDown.setAttribute('aria-disabled', String(fontSize <= FONT_SIZES[0]));
    els.fontUp.setAttribute('aria-disabled', String(fontSize >= FONT_SIZES[FONT_SIZES.length - 1]!));
  }

  function changeFontSize(step: 1 | -1): void {
    const next = stepFontSize(fontSize, step);
    if (next === fontSize) return;
    fontSize = next;
    applyFontSize();
    writeStorage(STORAGE_KEYS.fontSize, String(fontSize));
  }

  function applyPhosphor(): void {
    html.dataset.consolePhosphor = phosphor;
    for (const button of els.phosphorButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.phosphorChoice === phosphor));
    }
  }

  // ---- Events -----------------------------------------------------------------------------

  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const line = els.input.value;
    setInput('');
    run(line);
  });

  els.input.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    const plain = !event.ctrlKey && !event.metaKey && !event.altKey;

    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && plain && !event.shiftKey) {
      event.preventDefault();
      const step = recall(history, recallState, event.key === 'ArrowUp' ? 'older' : 'newer', els.input.value);
      if (step) {
        recallState = step.state;
        setInput(step.value);
      }
      return;
    }

    // Tab completes only when there is something to complete; on an empty line it moves focus
    // on as usual, and Shift+Tab always does, so the input never traps the keyboard.
    if (event.key === 'Tab' && plain && !event.shiftKey && els.input.value.trim() !== '') {
      event.preventDefault();
      completeInput();
      return;
    }

    if (event.ctrlKey && !event.metaKey && !event.altKey) {
      const key = event.key.toLowerCase();
      if (key === 'l') {
        event.preventDefault();
        clearScreen();
      } else if (key === 'c' && els.input.selectionStart === els.input.selectionEnd) {
        // Ctrl+C with nothing selected cancels the line; with a selection it still copies.
        event.preventDefault();
        echo(els.input.value, '^C');
        setInput('');
        recallState = freshRecall(history);
      }
    }
  });

  els.input.addEventListener('input', () => {
    listedFor = null;
    renderMirror();
  });
  for (const type of ['keyup', 'select', 'pointerup'] as const) {
    els.input.addEventListener(type, renderMirror);
  }
  // pointerdown always comes before the mousedown and click it causes, and says which device.
  els.input.addEventListener('pointerdown', (event) => {
    pointerType = event.pointerType;
  });
  els.input.addEventListener('mousedown', onMouseDown);
  els.input.addEventListener('click', onTap);
  document.addEventListener('selectionchange', () => {
    if (document.activeElement === els.input) renderMirror();
  });
  els.input.addEventListener('focus', () => {
    root.toggleAttribute('data-focused', true);
    renderMirror();
  });
  els.input.addEventListener('blur', () => root.toggleAttribute('data-focused', false));

  // Any key or tap shows output that is still being typed in full.
  document.addEventListener('keydown', () => typewriter.finish(), { capture: true });
  root.addEventListener('pointerdown', () => typewriter.finish());

  // Typing a character while focus is elsewhere in the console (or nowhere) goes to the command
  // line, e.g. after clicking A+. Space still activates a focused button or link.
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
    const active = document.activeElement;
    if (active === els.input) return;
    const nowhere = !active || active === document.body || active === html;
    if (!nowhere && !root.contains(active)) return;
    if (event.key === ' ' && active instanceof HTMLElement && active.matches('a, button')) return;
    els.input.focus();
  });

  // Tapping anywhere in the terminal focuses the command line, unless it lands on a control
  // or ends a text selection (so output can still be selected and copied).
  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest('a, button, input, output, [data-console-bar], .console-art')) return;
    if (!window.getSelection()?.isCollapsed) return;
    els.input.focus();
  });

  els.log.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-run]') : null;
    if (!button?.dataset.run) return;
    run(button.dataset.run);
    // A mouse click focuses the chip in Chromium, which would leave ↑/↓, Tab, Ctrl+L and Enter
    // acting on the chip instead of the command line; send mouse users back to it. Keyboard
    // activation (detail 0) keeps focus on the chip, and touch is left alone so the on-screen
    // keyboard does not open unasked (the same policy as the initial focus below).
    if (event.detail > 0 && finePointer.matches) els.input.focus({ preventScroll: true });
  });

  els.fontDown.addEventListener('click', () => changeFontSize(-1));
  els.fontUp.addEventListener('click', () => changeFontSize(1));
  for (const button of els.phosphorButtons) {
    button.addEventListener('click', () => {
      const choice = button.dataset.phosphorChoice;
      if (!(PHOSPHORS as readonly string[]).includes(choice ?? '') || choice === phosphor) return;
      phosphor = choice as Phosphor;
      applyPhosphor();
      writeStorage(STORAGE_KEYS.phosphor, phosphor);
    });
  }

  // The language link in the toolbar: remember the choice, as the site header does (the header
  // is not on this page). Otherwise a language stored earlier would send the visitor straight
  // back. Middle-click counts too: the new tab opens in the chosen language.
  function rememberLocale(event: MouseEvent): void {
    if (event.type === 'auxclick' && event.button !== 1) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[data-set-locale]') : null;
    const choice = link?.dataset.setLocale;
    if (isLocale(choice)) writeStorage(LOCALE_STORAGE_KEY, choice);
  }
  root.addEventListener('click', rememberLocale);
  root.addEventListener('auxclick', rememberLocale);

  // Coming back with the Back button restores this page from the back/forward cache.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) leaving = false;
  });

  // ---- Start ------------------------------------------------------------------------------

  applyFontSize();
  applyPhosphor();
  updatePrompt();
  renderMirror();
  print(renderDocument(data.docs.banner, ctx));
  // Focus only with a mouse or trackpad: on touch screens it would open the keyboard unasked.
  if (finePointer.matches) els.input.focus({ preventScroll: true });
}
