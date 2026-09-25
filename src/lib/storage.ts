/**
 * Web Storage (localStorage) that never throws.
 *
 * Every access can fail: reading `window.localStorage` itself throws a SecurityError when the
 * visitor blocks site data (or in a sandboxed frame), `setItem` throws a QuotaExceededError
 * when the origin's quota is used up (Safari's old private mode had a quota of zero), and a
 * browser may drop the storage between two calls. Callers get plain results instead of
 * exceptions and decide what to tell the visitor.
 *
 * Pure: the storage is resolved lazily through the function passed to createSafeStorage, so
 * importing this module touches nothing and tests can pass an in-memory fake.
 */

/** Why a write failed. `quota`: the value doesn't fit; `unavailable`: no storage at all. */
export type StorageFailure = 'unavailable' | 'quota' | 'error';

export type StorageWriteResult = { ok: true } | { ok: false; reason: StorageFailure };

/** The part of the Web Storage interface this module uses. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SafeStorage {
  /** Whether the storage exists and can be read (writes may still hit the quota). */
  available(): boolean;
  /** The stored value, or null when it is missing or the storage can't be read. */
  get(key: string): string | null;
  set(key: string, value: string): StorageWriteResult;
  /** Returns false when the storage is unavailable or refused. */
  remove(key: string): boolean;
}

/**
 * Recognises "storage full" across engines: the standard QuotaExceededError (legacy code 22),
 * Firefox's NS_ERROR_DOM_QUOTA_REACHED (code 1014) and Node's or other hosts' plain errors
 * with the same name.
 */
export function isQuotaError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014;
}

/** A SecurityError (blocked site data) means there is no usable storage rather than a one-off failure. */
function isSecurityError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'SecurityError';
}

export function createSafeStorage(resolve: () => StorageLike | null | undefined): SafeStorage {
  /** undefined: not looked up yet; null: there is none. */
  let backend: StorageLike | null | undefined;

  function storage(): StorageLike | null {
    if (backend === undefined) {
      try {
        backend = resolve() ?? null;
      } catch {
        backend = null;
      }
    }
    return backend;
  }

  return {
    available() {
      const target = storage();
      if (!target) return false;
      try {
        target.getItem('');
        return true;
      } catch {
        return false;
      }
    },

    get(key) {
      const target = storage();
      if (!target) return null;
      try {
        return target.getItem(key);
      } catch {
        return null;
      }
    },

    set(key, value) {
      const target = storage();
      if (!target) return { ok: false, reason: 'unavailable' };
      try {
        target.setItem(key, value);
        return { ok: true };
      } catch (error) {
        if (isQuotaError(error)) return { ok: false, reason: 'quota' };
        if (isSecurityError(error)) return { ok: false, reason: 'unavailable' };
        return { ok: false, reason: 'error' };
      }
    },

    remove(key) {
      const target = storage();
      if (!target) return false;
      try {
        target.removeItem(key);
        return true;
      } catch {
        return false;
      }
    },
  };
}

/**
 * The page's localStorage. Resolved on first use, never at import time: some hosts (Node,
 * sandboxed frames) have none or throw when it is touched.
 */
export const localStore: SafeStorage = createSafeStorage(() =>
  typeof window === 'undefined' ? null : window.localStorage,
);
