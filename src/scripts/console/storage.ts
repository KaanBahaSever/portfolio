/**
 * localStorage access that never throws. Storage can be missing or refused (private windows,
 * blocked site data, quota): the console then simply forgets preferences and history between
 * visits, and everything else keeps working.
 */

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not remembered this time; nothing else depends on it.
  }
}
