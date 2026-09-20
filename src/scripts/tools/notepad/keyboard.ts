/**
 * Keyboard shortcut helpers (browser only).
 */

export const IS_APPLE = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

/** Ctrl on Windows/Linux, Cmd on Apple platforms (and not the other one). */
export function hasPrimaryModifier(event: KeyboardEvent): boolean {
  return IS_APPLE ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

/**
 * Whether the event is for a Latin letter key. Uses the layout-aware `key` when it is a
 * Latin letter and falls back to the physical key when it isn't (Option on macOS turns
 * "f" into "ƒ"; Cyrillic or Greek layouts produce other letters).
 */
export function isLetter(event: KeyboardEvent, letter: string): boolean {
  const key = event.key.length === 1 ? event.key.toLowerCase() : '';
  if (/^[a-z]$/.test(key)) return key === letter;
  return event.code === `Key${letter.toUpperCase()}`;
}

/** Human-readable shortcut for titles, e.g. "Ctrl+F" or "⌘F". */
export function shortcutLabel(parts: { primary?: boolean; alt?: boolean; shift?: boolean; key: string }): string {
  if (IS_APPLE) {
    return `${parts.primary ? '⌘' : ''}${parts.alt ? '⌥' : ''}${parts.shift ? '⇧' : ''}${parts.key}`;
  }
  return [parts.primary ? 'Ctrl' : '', parts.alt ? 'Alt' : '', parts.shift ? 'Shift' : '', parts.key]
    .filter(Boolean)
    .join('+');
}

/** Value for aria-keyshortcuts, e.g. "Control+F" or "Meta+F". */
export function ariaShortcut(parts: { primary?: boolean; alt?: boolean; shift?: boolean; key: string }): string {
  return [parts.primary ? (IS_APPLE ? 'Meta' : 'Control') : '', parts.alt ? 'Alt' : '', parts.shift ? 'Shift' : '', parts.key]
    .filter(Boolean)
    .join('+');
}
