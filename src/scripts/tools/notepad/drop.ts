/**
 * File drag-and-drop helpers. Nothing here touches browser globals when the module loads, so
 * the tests can import it.
 */

/** Whether a drag carries files (rather than selected text or a link). */
export function hasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return !!types && Array.from(types).includes('Files');
}

const guarded = new WeakSet<EventTarget>();

/**
 * Keeps a file dropped outside the tool (on the page heading, the site header or the footer)
 * from opening in the tab, which would leave the page. It listens on `target`, the window, as
 * the event bubbles, so the tool's own handlers run first: they call preventDefault() and take
 * the drops meant for them, and this guard leaves those alone. Installing it twice on the same
 * target does nothing.
 */
export function installPageDropGuard(target: EventTarget): void {
  if (guarded.has(target)) return;
  guarded.add(target);
  target.addEventListener('dragover', (event) => {
    const drag = event as DragEvent;
    if (!hasFiles(drag) || drag.defaultPrevented) return;
    drag.preventDefault();
    if (drag.dataTransfer) drag.dataTransfer.dropEffect = 'none';
  });
  target.addEventListener('drop', (event) => {
    if (hasFiles(event as DragEvent)) event.preventDefault();
  });
}
