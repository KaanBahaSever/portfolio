/**
 * Pointer positions on the command line, mapped to offsets in the typed text.
 *
 * The console draws the command line itself (a "mirror" in the console font, wrapping after the
 * prompt) over an invisible <input> whose own text layout is different: it starts under the
 * prompt, uses a fixed 16px font and never wraps. A click must therefore be placed by where the
 * mirror drew each character, not by the input's hit testing. The controller measures the
 * mirror's characters (CharBox) and these functions do the rest.
 *
 * Pure module: no DOM, erasable TypeScript only.
 */

/** One character of the mirror: its offsets in the text and its box on screen (client pixels). */
export interface CharBox {
  /** Offset of the character in the text (UTF-16 code units); `end` is just past it. */
  start: number;
  end: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * The characters on the visual line nearest to `y`, in text order. A long command wraps, so the
 * line is chosen first; the vertical middle decides which boxes share it (glyphs from a fallback
 * font can be a pixel taller or shorter than their neighbours).
 */
function lineAt(boxes: readonly CharBox[], y: number): CharBox[] {
  let nearest = boxes[0]!;
  let best = Number.POSITIVE_INFINITY;
  for (const box of boxes) {
    const distance = y < box.top ? box.top - y : y > box.bottom ? y - box.bottom : 0;
    if (distance < best) {
      best = distance;
      nearest = box;
    }
  }
  const middle = (nearest.top + nearest.bottom) / 2;
  const half = Math.max((nearest.bottom - nearest.top) / 2, 1);
  return boxes.filter((box) => Math.abs((box.top + box.bottom) / 2 - middle) < half);
}

/**
 * Where a text field would put the caret for a click at (x, y): on the nearest line, before the
 * first character whose middle is right of the point, else after the line's last character.
 * Left of the text (over the prompt) gives the line's start. Null when there are no characters.
 */
export function caretAt(boxes: readonly CharBox[], x: number, y: number): number | null {
  if (boxes.length === 0) return null;
  const line = lineAt(boxes, y);
  for (const box of line) {
    if (x < (box.left + box.right) / 2) return box.start;
  }
  return line[line.length - 1]!.end;
}

/**
 * The character under (x, y), as its start offset: the one whose box reaches past the point on
 * the nearest line, else the line's last one. Used for double-click word selection, which is
 * about the character clicked, not the gap nearest to it. Null when there are no characters.
 */
export function characterAt(boxes: readonly CharBox[], x: number, y: number): number | null {
  if (boxes.length === 0) return null;
  const line = lineAt(boxes, y);
  for (const box of line) {
    if (x < box.right) return box.start;
  }
  return line[line.length - 1]!.start;
}

const SPACE = /\s/u;

/**
 * The word containing the character at `index`, terminal style: a run of non-space characters
 * (so a path such as projects/karecik.txt is one word), or the run of spaces when a space was
 * clicked. An index past the end means the last character. Empty text gives an empty range.
 */
export function wordAt(text: string, index: number): { start: number; end: number } {
  if (text === '') return { start: 0, end: 0 };
  const at = Math.min(Math.max(index, 0), text.length - 1);
  const space = SPACE.test(text[at]!);
  let start = at;
  while (start > 0 && SPACE.test(text[start - 1]!) === space) start -= 1;
  let end = at + 1;
  while (end < text.length && SPACE.test(text[end]!) === space) end += 1;
  return { start, end };
}
