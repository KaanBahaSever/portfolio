/**
 * Password Generator: DOM wiring (browser only).
 * Passwords are generated on the device with the Web Crypto API. Nothing is stored, logged or sent.
 * Interface text comes from the same catalogue the server-rendered component uses, in the
 * page's language (<html lang>).
 */

import { getPageLocale } from '../../../i18n/client.ts';
import { passwordMessages } from '../../../i18n/tools/password-generator.ts';
import {
  CHARSET_NAMES,
  DEFAULT_LENGTH,
  MAX_LENGTH,
  MIN_LENGTH,
  characterKind,
  entropyBits,
  generatePassword,
  strength,
} from '../../../lib/password/generate.ts';
import type { CharsetName, PasswordOptions, StrengthScore } from '../../../lib/password/generate.ts';

type CopyPhase = 'idle' | 'copying' | 'copied';
type Tone = 'weak' | 'fair' | 'strong';

/** How long the Copy button says "Copied". */
const COPIED_MS = 2000;
/** Longer passwords use a smaller font so they stay compact on phones. */
const LONG_PASSWORD = 32;
/** Strength changes are announced once the user pauses (a slider fires many input events). */
const STRENGTH_ANNOUNCE_DELAY_MS = 700;

function toneOf(score: StrengthScore): Tone {
  if (score <= 1) return 'weak';
  return score === 2 ? 'fair' : 'strong';
}

function clampLength(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LENGTH;
  return Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.round(value)));
}

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Password Generator: missing element ${selector}`);
  return element;
}

function getElements(root: HTMLElement) {
  const types = {} as Record<CharsetName, HTMLInputElement>;
  for (const name of CHARSET_NAMES) types[name] = query<HTMLInputElement>(root, `[data-type="${name}"]`);
  return {
    announcer: query<HTMLElement>(root, '[data-announcer]'),
    visual: query<HTMLElement>(root, '[data-password-visual]'),
    plain: query<HTMLElement>(root, '[data-password-text]'),
    segments: Array.from(root.querySelectorAll<HTMLElement>('[data-strength-segment]')),
    strengthLabel: query<HTMLElement>(root, '[data-strength-label]'),
    strengthBits: query<HTMLElement>(root, '[data-strength-bits]'),
    copy: query<HTMLButtonElement>(root, '[data-copy]'),
    copyLabel: query<HTMLElement>(root, '[data-copy-label]'),
    generate: query<HTMLButtonElement>(root, '[data-generate]'),
    status: query<HTMLElement>(root, '[data-status]'),
    lengthRange: query<HTMLInputElement>(root, '[data-length-range]'),
    lengthNumber: query<HTMLInputElement>(root, '[data-length-number]'),
    types,
    typesHint: query<HTMLElement>(root, '[data-types-hint]'),
    lookAlikes: query<HTMLInputElement>(root, '[data-option="excludeLookAlikes"]'),
    eachType: query<HTMLInputElement>(root, '[data-option="requireEachType"]'),
  };
}

/** Copies with a temporary textarea, for browsers without the async Clipboard API (or when it is refused). */
function legacyCopy(text: string): boolean {
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  // readonly keeps the on-screen keyboard closed; 16px stops iOS from zooming in.
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.tabIndex = -1;
  textarea.style.cssText = 'position:fixed;top:0;left:-9999px;width:1px;height:1px;opacity:0;font-size:16px;';
  document.body.append(textarea);
  let copied = false;
  try {
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    textarea.remove();
    previousFocus?.focus({ preventScroll: true });
  }
  return copied;
}

async function writeToClipboard(text: string): Promise<boolean> {
  if (window.isSecureContext && typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission refused or the document lost focus: try the older way.
    }
  }
  return legacyCopy(text);
}

export function initPasswordGenerator(root: HTMLElement): void {
  if (root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const el = getElements(root);
  const m = passwordMessages[getPageLocale()];

  let length = clampLength(Number(el.lengthRange.value));
  let password = '';
  /** Increases with every new password, so a slow copy never marks a newer password as copied. */
  let passwordVersion = 0;
  let copyPhase: CopyPhase = 'idle';
  let copiedTimer = 0;
  let announceTimer = 0;
  let strengthTimer = 0;
  /** The score last read out, so an unchanged rating is not announced again (-1: none yet). */
  let announcedScore: StrengthScore | -1 = -1;
  /** The options the current password was made with. */
  let generatedWith: PasswordOptions | undefined;
  /** Said with the next strength announcement when a type change has just locked the last type. */
  let lockNotice = '';

  // ---------------------------------------------------------------- helpers

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

  function readOptions(): PasswordOptions {
    return {
      length,
      lowercase: el.types.lowercase.checked,
      uppercase: el.types.uppercase.checked,
      numbers: el.types.numbers.checked,
      symbols: el.types.symbols.checked,
      excludeLookAlikes: el.lookAlikes.checked,
      requireEachType: el.eachType.checked,
    };
  }

  // ---------------------------------------------------------------- rendering

  function renderPassword(): void {
    const fragment = document.createDocumentFragment();
    for (const char of password) {
      const span = document.createElement('span');
      span.dataset.kind = characterKind(char);
      span.textContent = char;
      fragment.append(span);
    }
    el.visual.replaceChildren(fragment);
    el.visual.dataset.size = password.length > LONG_PASSWORD ? 'long' : 'short';
    el.plain.textContent = password;
  }

  function currentStrength(options: PasswordOptions) {
    const bits = entropyBits(options);
    return { bits, ...strength(bits) };
  }

  function renderStrength(options: PasswordOptions): void {
    const { bits, level, score } = currentStrength(options);
    const tone = toneOf(score);
    el.segments.forEach((segment, index) => {
      segment.dataset.tone = index <= score ? tone : 'off';
    });
    el.strengthLabel.textContent = m.strength[level];
    el.strengthLabel.dataset.tone = tone;
    // Rounded down: the thresholds are whole numbers, so the figure never sits on a threshold the label has not reached.
    el.strengthBits.textContent = m.bits(Math.floor(bits));
  }

  function renderLength(): void {
    el.lengthRange.value = String(length);
    el.lengthRange.setAttribute('aria-valuetext', m.characters(length));
  }

  /** The type that is locked on because it is the only one checked, if any. */
  function lockedType(): CharsetName | undefined {
    return CHARSET_NAMES.find((name) => el.types[name].disabled);
  }

  /** The last checked type cannot be unchecked: disable it and show the hint. */
  function renderTypeLocks(): void {
    const checked = CHARSET_NAMES.filter((name) => el.types[name].checked);
    const locked = checked.length === 1 ? checked[0] : undefined;
    for (const name of CHARSET_NAMES) {
      const input = el.types[name];
      input.disabled = name === locked;
      if (name === locked) input.setAttribute('aria-describedby', el.typesHint.id);
      else input.removeAttribute('aria-describedby');
    }
    el.typesHint.hidden = locked === undefined;
  }

  function renderCopyButton(): void {
    el.copy.dataset.state = copyPhase;
    el.copyLabel.textContent = copyPhase === 'copied' ? m.copied : m.copy;
  }

  function resetCopyState(): void {
    window.clearTimeout(copiedTimer);
    copyPhase = 'idle';
    renderCopyButton();
  }

  // ---------------------------------------------------------------- generation

  function regenerate(): void {
    const options = readOptions();
    password = generatePassword(options);
    generatedWith = options;
    passwordVersion++;
    renderPassword();
    renderStrength(options);
    renderTypeLocks();
    resetCopyState();
    setStatus('');
  }

  /**
   * Regenerates after an option change and, once the user pauses, announces a new strength rating
   * together with a pending lock notice (one message, so neither replaces the other in the live region).
   */
  function onOptionsChanged(): void {
    regenerate();
    window.clearTimeout(strengthTimer);
    strengthTimer = window.setTimeout(() => {
      const { bits, level, score } = currentStrength(readOptions());
      const messages = [lockNotice];
      if (score !== announcedScore) messages.push(m.strengthAnnouncement(level, Math.floor(bits)));
      announcedScore = score;
      lockNotice = '';
      const message = messages.filter(Boolean).join(' ');
      if (message) announce(message);
    }, STRENGTH_ANNOUNCE_DELAY_MS);
  }

  function setLength(next: number): void {
    if (next === length) return;
    length = next;
    renderLength();
    onOptionsChanged();
  }

  // ---------------------------------------------------------------- length

  el.lengthRange.addEventListener('input', () => {
    const next = clampLength(Number(el.lengthRange.value));
    el.lengthNumber.value = String(next);
    setLength(next);
  });

  // Typing: apply complete values right away, but let partial ones ("1" on the way to "16") be.
  el.lengthNumber.addEventListener('input', () => {
    const value = el.lengthNumber.valueAsNumber;
    if (Number.isInteger(value) && value >= MIN_LENGTH && value <= MAX_LENGTH) setLength(value);
  });

  /** On change or blur: clamp what was typed, or restore the current length if it was not a number. */
  function commitLengthNumber(): void {
    const value = el.lengthNumber.valueAsNumber;
    const next = Number.isFinite(value) ? clampLength(value) : length;
    if (el.lengthNumber.value !== String(next)) el.lengthNumber.value = String(next);
    setLength(next);
  }

  el.lengthNumber.addEventListener('change', commitLengthNumber);
  el.lengthNumber.addEventListener('blur', commitLengthNumber);

  // ---------------------------------------------------------------- types and advanced options

  for (const name of CHARSET_NAMES) {
    const input = el.types[name];
    input.addEventListener('change', () => {
      // The last checked type is disabled, so this is only a safety net: never allow zero types.
      if (!CHARSET_NAMES.some((other) => el.types[other].checked)) input.checked = true;
      const wasLocked = lockedType() !== undefined;
      onOptionsChanged();
      // A disabled checkbox leaves the Tab order silently, so say when the lock engages.
      const locked = lockedType();
      lockNotice = locked && !wasLocked ? m.lockNotice(locked) : '';
    });
  }
  el.lookAlikes.addEventListener('change', onOptionsChanged);
  el.eachType.addEventListener('change', onOptionsChanged);

  // ---------------------------------------------------------------- actions

  el.generate.addEventListener('click', () => {
    regenerate();
    announce(m.generated);
  });

  el.copy.addEventListener('click', async () => {
    if (copyPhase === 'copying' || !password) return;
    const version = passwordVersion;
    copyPhase = 'copying';
    const copied = await writeToClipboard(password);
    // A new password replaced this one while copying: never label the new one as copied.
    if (version !== passwordVersion) return;
    window.clearTimeout(copiedTimer);
    if (copied) {
      copyPhase = 'copied';
      setStatus('');
      announce(m.copiedAnnouncement);
      copiedTimer = window.setTimeout(() => {
        copyPhase = 'idle';
        renderCopyButton();
      }, COPIED_MS);
    } else {
      copyPhase = 'idle';
      // Select the password so the device's own Copy command is one step away.
      window.getSelection()?.selectAllChildren(el.visual);
      setStatus(m.copyFailed, 'error');
      announce(m.copyFailed);
    }
    renderCopyButton();
  });

  // ---------------------------------------------------------------- start and page restores

  /** Takes the settings from what the controls show (never no character type) and makes a new password. */
  function syncWithControls(): void {
    if (!CHARSET_NAMES.some((name) => el.types[name].checked)) {
      for (const name of CHARSET_NAMES) el.types[name].checked = true;
    }
    window.clearTimeout(strengthTimer);
    lockNotice = '';
    length = clampLength(Number(el.lengthRange.value));
    el.lengthNumber.value = String(length);
    renderLength();
    regenerate();
    announcedScore = currentStrength(readOptions()).score;
  }

  /** False when the controls changed without events since the current password was made. */
  function controlsMatchPassword(): boolean {
    const made = generatedWith;
    if (!made || el.lengthRange.value !== String(length)) return false;
    const shown = readOptions();
    return (Object.keys(shown) as Array<keyof PasswordOptions>).every((key) => shown[key] === made[key]);
  }

  // Browsers can change the controls without firing events: form state restored on a history
  // navigation may land after this script has run (Chromium restores once parsing has finished),
  // and WebKit resets some inputs when a page returns from the back/forward cache. Check again
  // once the page is shown, a tick later so such queued work has run. A page back from the
  // back/forward cache always gets a new password: the one on screen was left behind.
  window.addEventListener('pageshow', (event) => {
    window.setTimeout(() => {
      if (event.persisted || !controlsMatchPassword()) syncWithControls();
    }, 0);
  });

  syncWithControls();
}
