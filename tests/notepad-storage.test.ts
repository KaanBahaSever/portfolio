import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSafeStorage, isQuotaError, localStore } from '../src/lib/storage.ts';
import type { StorageLike } from '../src/lib/storage.ts';

function namedError(name: string, code?: number): Error {
  const error = new Error(name);
  error.name = name;
  if (code !== undefined) Object.defineProperty(error, 'code', { value: code });
  return error;
}

/** In-memory Web Storage with an optional quota (total UTF-16 units of keys and values). */
function memoryStorage(quota = Infinity): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  const used = () => [...map].reduce((sum, [key, value]) => sum + key.length + value.length, 0);
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem(key, value) {
      const previous = map.get(key);
      const next = used() - (previous === undefined ? 0 : key.length + previous.length) + key.length + value.length;
      if (next > quota) throw namedError('QuotaExceededError', 22);
      map.set(key, value);
    },
    removeItem: (key) => void map.delete(key),
  };
}

test('isQuotaError recognises every engine’s “storage full” error', () => {
  assert.equal(isQuotaError(namedError('QuotaExceededError')), true);
  assert.equal(isQuotaError(namedError('NS_ERROR_DOM_QUOTA_REACHED')), true);
  assert.equal(isQuotaError(namedError('Error', 22)), true);
  assert.equal(isQuotaError(namedError('Error', 1014)), true);
  assert.equal(isQuotaError(namedError('SecurityError', 18)), false);
  assert.equal(isQuotaError(new TypeError('x')), false);
  assert.equal(isQuotaError(null), false);
  assert.equal(isQuotaError('QuotaExceededError'), false);
});

test('reads, writes and removes values', () => {
  const backend = memoryStorage();
  const storage = createSafeStorage(() => backend);
  assert.equal(storage.available(), true);
  assert.equal(storage.get('a'), null);
  assert.deepEqual(storage.set('a', 'one'), { ok: true });
  assert.equal(storage.get('a'), 'one');
  assert.equal(storage.remove('a'), true);
  assert.equal(storage.get('a'), null);
});

test('reports a full quota without throwing, and keeps the previous value', () => {
  const backend = memoryStorage(10);
  const storage = createSafeStorage(() => backend);
  assert.deepEqual(storage.set('k', 'short'), { ok: true });
  assert.deepEqual(storage.set('k', 'much too long'), { ok: false, reason: 'quota' });
  assert.equal(storage.get('k'), 'short');
});

test('treats a storage that throws on access as unavailable', () => {
  let lookups = 0;
  const storage = createSafeStorage(() => {
    lookups++;
    throw namedError('SecurityError', 18);
  });
  assert.equal(storage.available(), false);
  assert.equal(storage.get('a'), null);
  assert.deepEqual(storage.set('a', 'b'), { ok: false, reason: 'unavailable' });
  assert.equal(storage.remove('a'), false);
  assert.equal(lookups, 1, 'the storage is looked up once');
});

test('treats a missing storage as unavailable', () => {
  const storage = createSafeStorage(() => null);
  assert.equal(storage.available(), false);
  assert.deepEqual(storage.set('a', 'b'), { ok: false, reason: 'unavailable' });
});

test('survives methods that throw after the storage was found', () => {
  const broken: StorageLike = {
    getItem() {
      throw namedError('SecurityError');
    },
    setItem() {
      throw namedError('SecurityError');
    },
    removeItem() {
      throw new Error('gone');
    },
  };
  const storage = createSafeStorage(() => broken);
  assert.equal(storage.available(), false);
  assert.equal(storage.get('a'), null);
  assert.deepEqual(storage.set('a', 'b'), { ok: false, reason: 'unavailable' });
  assert.equal(storage.remove('a'), false);

  const flaky = createSafeStorage(() => ({
    getItem: () => null,
    setItem() {
      throw new Error('disk error');
    },
    removeItem() {},
  }));
  assert.deepEqual(flaky.set('a', 'b'), { ok: false, reason: 'error' });
});

test('the shared localStore is safe outside a browser', () => {
  // Node has no window: nothing is touched and nothing throws.
  assert.equal(localStore.available(), false);
  assert.equal(localStore.get('x'), null);
  assert.deepEqual(localStore.set('x', 'y'), { ok: false, reason: 'unavailable' });
});
