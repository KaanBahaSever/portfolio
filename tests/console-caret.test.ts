import assert from 'node:assert/strict';
import { test } from 'node:test';

import { caretAt, characterAt, wordAt } from '../src/lib/console/caret.ts';
import type { CharBox } from '../src/lib/console/caret.ts';

/**
 * Boxes for text laid out like the mirror: monospace cells `width` wide and `height` tall, the
 * first line starting after a prompt of `indent` cells, wrapping after `columns` cells.
 */
function layout(text: string, { indent = 0, columns = 80, width = 10, height = 20 } = {}): CharBox[] {
  const boxes: CharBox[] = [];
  let cell = indent;
  for (let i = 0; i < text.length; i += 1) {
    const row = Math.floor(cell / columns);
    const column = cell % columns;
    boxes.push({
      start: i,
      end: i + 1,
      left: column * width,
      right: (column + 1) * width,
      top: row * 30,
      bottom: row * 30 + height,
    });
    cell += 1;
  }
  return boxes;
}

test('caretAt puts the caret in the gap nearest to the click, not under the prompt', () => {
  // 'misafir@kbs-os:~$ ' is 18 cells, then the command: 'h' of 'hello' is text index 5, cell 23.
  const boxes = layout('echo hello world there', { indent: 18 });
  assert.equal(caretAt(boxes, 232, 10), 5, 'left half of h: before it');
  assert.equal(caretAt(boxes, 237, 10), 6, 'right half of h: after it');
  assert.equal(caretAt(boxes, 20, 10), 0, 'over the prompt: the start of the line');
  assert.equal(caretAt(boxes, 900, 10), 22, 'right of the text: the end');
});

test('caretAt picks the visual line first when a long command wraps', () => {
  // 12 columns, no prompt: 'cat projects' on row 0, '/asion.txt' on row 1.
  const boxes = layout('cat projects/asion.txt', { columns: 12 });
  assert.equal(caretAt(boxes, 12, 35), 13, 'second line, left half of its second cell');
  assert.equal(caretAt(boxes, 500, 40), 22, 'right of the second line: the end of the text');
  assert.equal(caretAt(boxes, 500, 10), 12, 'right of the first line: where the second begins');
  assert.equal(caretAt(boxes, 12, -50), 1, 'above the text: the first line');
  assert.equal(caretAt(boxes, 12, 500), 13, 'below the text: the last line');
  assert.equal(caretAt(boxes, 12, 25), 1, 'in the gap between lines: the nearer one (ties go up)');
});

test('caretAt and characterAt tolerate a glyph from a taller fallback font', () => {
  const boxes = layout('ab c', { width: 10 });
  boxes[1] = { ...boxes[1]!, top: -2, bottom: 23 };
  assert.equal(caretAt(boxes, 36, 10), 4);
  assert.equal(characterAt(boxes, 12, 10), 1);
});

test('caretAt and characterAt return null without text', () => {
  assert.equal(caretAt([], 10, 10), null);
  assert.equal(characterAt([], 10, 10), null);
});

test('characterAt names the character under the point, whichever half is clicked', () => {
  const boxes = layout('echo hi', { indent: 3 });
  assert.equal(characterAt(boxes, 31, 5), 0);
  assert.equal(characterAt(boxes, 39, 5), 0);
  assert.equal(characterAt(boxes, 40, 5), 1);
  assert.equal(characterAt(boxes, 5, 5), 0, 'over the prompt: the first character');
  assert.equal(characterAt(boxes, 999, 5), 6, 'right of the text: the last character');
});

test('wordAt selects runs of non-spaces, like a terminal, or the run of spaces clicked', () => {
  const line = 'cat  projects/karecik.txt about.txt';
  assert.deepEqual(wordAt(line, 0), { start: 0, end: 3 });
  assert.deepEqual(wordAt(line, 2), { start: 0, end: 3 });
  assert.deepEqual(wordAt(line, 3), { start: 3, end: 5 }, 'the two spaces');
  assert.deepEqual(wordAt(line, 12), { start: 5, end: 25 }, 'a path is one word');
  assert.deepEqual(wordAt(line, 99), { start: 26, end: 35 }, 'past the end: the last word');
  assert.deepEqual(wordAt(line, -4), { start: 0, end: 3 });
  assert.deepEqual(wordAt('', 0), { start: 0, end: 0 });
});
