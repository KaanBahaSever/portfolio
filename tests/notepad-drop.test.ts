import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasFiles, installPageDropGuard } from '../src/scripts/tools/notepad/drop.ts';

/** A stand-in for DragEvent (Node has Event and EventTarget, but no DragEvent). */
class FakeDragEvent extends Event {
  dataTransfer: { types: string[]; dropEffect: string } | null;

  constructor(type: string, types: string[] | null) {
    super(type, { bubbles: true, cancelable: true });
    this.dataTransfer = types ? { types, dropEffect: 'copy' } : null;
  }
}

function drag(type: string, types: string[] | null): DragEvent {
  return new FakeDragEvent(type, types) as unknown as DragEvent;
}

test('hasFiles is true only when the drag carries files', () => {
  assert.equal(hasFiles(drag('dragover', ['Files'])), true);
  assert.equal(hasFiles(drag('dragover', ['text/plain', 'Files'])), true);
  assert.equal(hasFiles(drag('dragover', ['text/plain', 'text/html'])), false);
  assert.equal(hasFiles(drag('dragover', [])), false);
  assert.equal(hasFiles(drag('dragover', null)), false);
});

test('the page guard refuses a file dragged over the page outside the tool', () => {
  const page = new EventTarget();
  installPageDropGuard(page);
  const over = drag('dragover', ['Files']);
  page.dispatchEvent(over);
  assert.equal(over.defaultPrevented, true);
  assert.equal(over.dataTransfer?.dropEffect, 'none');

  const drop = drag('drop', ['Files']);
  page.dispatchEvent(drop);
  assert.equal(drop.defaultPrevented, true);
});

test('the page guard leaves a drag the tool already accepted alone', () => {
  const page = new EventTarget();
  // The tool's own handler runs first as the event bubbles up to the window.
  page.addEventListener('dragover', (event) => {
    event.preventDefault();
    (event as DragEvent).dataTransfer!.dropEffect = 'copy';
  });
  installPageDropGuard(page);
  const over = drag('dragover', ['Files']);
  page.dispatchEvent(over);
  assert.equal(over.defaultPrevented, true);
  assert.equal(over.dataTransfer?.dropEffect, 'copy');
});

test('the page guard ignores drags without files, such as selected text', () => {
  const page = new EventTarget();
  installPageDropGuard(page);
  const over = drag('dragover', ['text/plain']);
  page.dispatchEvent(over);
  assert.equal(over.defaultPrevented, false);
  assert.equal(over.dataTransfer?.dropEffect, 'copy');

  const drop = drag('drop', ['text/plain']);
  page.dispatchEvent(drop);
  assert.equal(drop.defaultPrevented, false);
});

test('installing the page guard twice adds its listeners once', () => {
  const page = new EventTarget();
  let listeners = 0;
  const add = page.addEventListener.bind(page);
  page.addEventListener = (...args: Parameters<EventTarget['addEventListener']>) => {
    listeners++;
    add(...args);
  };
  installPageDropGuard(page);
  installPageDropGuard(page);
  assert.equal(listeners, 2);
});
