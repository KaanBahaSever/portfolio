/**
 * Command history: what is remembered, and ↑/↓ recall.
 *
 * Pure module: no DOM, erasable TypeScript only.
 */

/** Commands kept (in memory and in localStorage). */
export const HISTORY_LIMIT = 50;
/** Longer lines are not remembered (a paste accident, not a command). */
export const MAX_REMEMBERED_LENGTH = 500;

/**
 * Appends a command (trimmed), bash style: blank lines and an immediate repeat of the previous
 * command are not recorded (HISTCONTROL=ignoredups), and only the newest `limit` are kept.
 */
export function addToHistory(entries: readonly string[], line: string, limit = HISTORY_LIMIT): string[] {
  const entry = line.trim();
  if (entry === '' || entry.length > MAX_REMEMBERED_LENGTH) return [...entries];
  if (entries[entries.length - 1] === entry) return [...entries];
  return [...entries, entry].slice(-limit);
}

/** Reads history saved by an earlier visit; anything malformed is dropped rather than trusted. */
export function parseStoredHistory(raw: string | null, limit = HISTORY_LIMIT): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
      .filter((entry) => entry.length <= MAX_REMEMBERED_LENGTH)
      .slice(-limit);
  } catch {
    return [];
  }
}

/**
 * Where ↑/↓ recall stands: `index` is a position in the history, and `entries.length` means
 * "below the newest entry", the line being typed, which is kept as `draft` while browsing.
 */
export interface RecallState {
  index: number;
  draft: string;
}

export const freshRecall = (entries: readonly string[]): RecallState => ({ index: entries.length, draft: '' });

/**
 * One step through the history. `current` is what the input holds now. Returns the new state and
 * the text to show, or null when there is nowhere to go (top of the history, or already on the draft).
 */
export function recall(
  entries: readonly string[],
  state: RecallState,
  direction: 'older' | 'newer',
  current: string,
): { state: RecallState; value: string } | null {
  const index = Math.min(Math.max(state.index, 0), entries.length);
  if (direction === 'older') {
    if (index === 0) return null;
    const draft = index === entries.length ? current : state.draft;
    return { state: { index: index - 1, draft }, value: entries[index - 1]! };
  }
  if (index >= entries.length) return null;
  const next = index + 1;
  return { state: { index: next, draft: state.draft }, value: next === entries.length ? state.draft : entries[next]! };
}
