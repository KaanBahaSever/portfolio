/**
 * Clipboard writing with a fallback (browser only): the async Clipboard API where the page is
 * a secure context and the browser allows it, otherwise a hidden textarea and
 * document.execCommand('copy').
 */

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

export async function writeToClipboard(text: string): Promise<boolean> {
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
