/**
 * Single-key game shortcuts (R rotates a ship, digits play a square). Pure: no DOM. The functions
 * read only the few event and element fields they need, so tests pass plain objects.
 */

/** The fields of a keydown event that decide whether it is a shortcut press. */
export interface ShortcutKey {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
}

/**
 * A plain press: no Ctrl, Cmd or Alt (those combinations belong to the browser and the system) and
 * not an auto-repeat from a held key. Shift is allowed, so "R" with Caps Lock or Shift still counts.
 */
export function isPlainKey(event: ShortcutKey): boolean {
  return !event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat;
}

/** The Battleship rotate shortcut: a plain R, either case. */
export function isRotateKey(event: ShortcutKey): boolean {
  return isPlainKey(event) && (event.key === 'r' || event.key === 'R');
}

/** The fields of an event target that tell whether keys typed there are text. */
export interface KeyTarget {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
}

/** Input types that take no typed text: a letter pressed there is free for a shortcut. */
const NON_TEXT_INPUTS: ReadonlySet<string> = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/**
 * Whether key presses aimed at `target` are typing (a text field, a select, editable content). A
 * shortcut that listens beyond its own widget must leave those alone.
 */
export function isTypingTarget(target: KeyTarget | null | undefined): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName ?? '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  return !NON_TEXT_INPUTS.has((target.type || 'text').toLowerCase());
}
