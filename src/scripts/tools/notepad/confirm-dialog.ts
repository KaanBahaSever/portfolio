/**
 * The notepad's confirmation dialog (browser only): a styled, translated <dialog> whose focus
 * handling (trapping, Esc, returning focus) comes from the browser. Falls back to
 * window.confirm where <dialog> is missing.
 */

export interface ConfirmRequest {
  title: string;
  body: string;
  /** Label of the confirming button. */
  confirm: string;
  /** Destructive: the confirming button turns red. */
  danger?: boolean;
  /** Gets focus afterwards when nothing had focus before (Safari doesn't focus clicked buttons). */
  returnFocus: HTMLElement;
}

export interface ConfirmDialog {
  readonly open: boolean;
  /** Resolves once the dialog has closed: true when the visitor confirmed. */
  ask(request: ConfirmRequest): Promise<boolean>;
}

function part<T extends Element>(dialog: HTMLDialogElement, selector: string): T {
  const element = dialog.querySelector<T>(selector);
  if (!element) throw new Error(`Notepad: missing element ${selector}`);
  return element;
}

export function createConfirmDialog(dialog: HTMLDialogElement): ConfirmDialog {
  const form = part<HTMLFormElement>(dialog, 'form');
  const title = part<HTMLElement>(dialog, '[data-confirm-title]');
  const body = part<HTMLElement>(dialog, '[data-confirm-body]');
  const ok = part<HTMLButtonElement>(dialog, '[data-confirm-ok]');

  function ask(request: ConfirmRequest): Promise<boolean> {
    const fallback = () => window.confirm(`${request.title}\n\n${request.body}`);
    if (typeof dialog.showModal !== 'function') return Promise.resolve(fallback());
    if (dialog.open) return Promise.resolve(false);

    title.textContent = request.title;
    body.textContent = request.body;
    ok.textContent = request.confirm;
    if (request.danger) ok.dataset.tone = 'danger';
    else delete ok.dataset.tone;
    dialog.returnValue = '';
    const previousFocus = document.activeElement;

    return new Promise((resolve) => {
      let settled = false;

      function detach(): void {
        form.removeEventListener('submit', onSubmit);
        dialog.removeEventListener('cancel', onCancel);
        dialog.removeEventListener('close', onClose);
      }

      // The answer is only passed on once the dialog has closed, so the caller's next steps
      // (such as focusing the text) aren't blocked by the modal or undone by its focus return.
      function finish(confirmed: boolean): void {
        if (settled) return;
        settled = true;
        detach();
        if (dialog.open) dialog.close();
        // Browsers return focus themselves, but not always: with nothing focused before, some
        // leave it on the body or on the hidden Cancel button.
        const active = document.activeElement;
        if (!active || active === document.body || dialog.contains(active)) {
          const target =
            previousFocus instanceof HTMLElement && previousFocus !== document.body && previousFocus.isConnected
              ? previousFocus
              : request.returnFocus;
          target.focus({ preventScroll: true });
        }
        resolve(confirmed);
      }

      // Closed here rather than by the form: the 'close' event is queued, and some browsers
      // only deliver it with the next rendered frame.
      function onSubmit(event: SubmitEvent): void {
        event.preventDefault();
        const submitter = event.submitter;
        finish(submitter instanceof HTMLButtonElement && submitter.value === 'confirm');
      }

      function onCancel(event: Event): void {
        event.preventDefault(); // Esc: close right away
        finish(false);
      }

      function onClose(): void {
        finish(dialog.returnValue === 'confirm');
      }

      form.addEventListener('submit', onSubmit);
      dialog.addEventListener('cancel', onCancel);
      dialog.addEventListener('close', onClose);
      try {
        dialog.showModal();
      } catch {
        settled = true;
        detach();
        resolve(fallback());
      }
    });
  }

  return {
    get open() {
      return dialog.open;
    },
    ask,
  };
}
