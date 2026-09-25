/**
 * Keyboard movement on a rectangular board of cells numbered row by row (index = row * cols + col).
 * Shared by both games' roving-focus grids. Pure: no DOM.
 *
 * Follows the ARIA grid pattern: arrows move one cell and stop at the edges (no wrapping, so a
 * screen-reader user always knows where the edge is), Home/End go to the start/end of the row,
 * Ctrl+Home/Ctrl+End to the first/last cell, PageUp/PageDown to the top/bottom of the column.
 */

export interface GridKey {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

/**
 * The cell a key press moves to from `index`, or null when the key is not a movement key.
 * A movement key at an edge returns `index` itself, so callers still swallow the key press
 * instead of letting it scroll the page.
 */
export function moveInGrid(index: number, event: GridKey, cols: number, rows: number): number | null {
  const row = Math.floor(index / cols);
  const col = index % cols;
  const modifier = Boolean(event.ctrlKey || event.metaKey);
  switch (event.key) {
    case 'ArrowUp':
      return row > 0 ? index - cols : index;
    case 'ArrowDown':
      return row < rows - 1 ? index + cols : index;
    case 'ArrowLeft':
      return col > 0 ? index - 1 : index;
    case 'ArrowRight':
      return col < cols - 1 ? index + 1 : index;
    case 'Home':
      return modifier ? 0 : row * cols;
    case 'End':
      return modifier ? rows * cols - 1 : row * cols + cols - 1;
    case 'PageUp':
      return col;
    case 'PageDown':
      return (rows - 1) * cols + col;
    default:
      return null;
  }
}
