/**
 * Browser download helper (no server involved).
 */

/** How long the object URL stays valid. iOS Safari reads it asynchronously after click(). */
const REVOKE_DELAY_MS = 60_000;

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking immediately breaks downloads on iOS Safari; give it time.
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
