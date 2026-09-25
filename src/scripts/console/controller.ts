/**
 * Console: DOM wiring (browser only).
 *
 * The command line is a real <input>, made transparent and laid over a "mirror" that draws the
 * typed text with a block cursor (a native caret can be neither a block nor glow). The input
 * keeps focus, selection, IME and on-screen keyboards working; the mirror only follows it.
 * Commands run through the pure shell in src/lib/console/, and their structured output is
 * rendered by ./render.ts in the page language.
 *
 * Stored in localStorage (when allowed): font size, phosphor colour and the last commands.
 */
import { getPageLocale } from '../../i18n/client.ts';
import { consoleMessages } from '../../i18n/console/messages.ts';
import { common } from '../../i18n/messages/common.ts';
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
    if (button?.dataset.run) run(button.dataset.run);
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
