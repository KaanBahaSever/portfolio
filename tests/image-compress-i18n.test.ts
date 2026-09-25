import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageCompressorMessages } from '../src/i18n/tools/image-compressor.ts';

type Tree = { [key: string]: unknown };

/** Every leaf as [path, value]. */
function leaves(tree: Tree, prefix = ''): Array<[string, unknown]> {
  return Object.entries(tree).flatMap(([key, value]) =>
    value && typeof value === 'object' ? leaves(value as Tree, `${prefix}${key}.`) : [[`${prefix}${key}`, value] as [string, unknown]],
  );
}

/** Leaves that are the same in both languages on purpose: proper names and notation. */
const SAME_IN_BOTH = new Set(['dropzone.formats', 'settings.formatWebp', 'settings.formatJpeg', 'compare.zoomActual']);

test('Turkish defines exactly the English keys, with the same parameters', () => {
  const en = new Map(leaves(imageCompressorMessages.en));
  const tr = new Map(leaves(imageCompressorMessages.tr));
  assert.deepEqual([...tr.keys()].sort(), [...en.keys()].sort());
  for (const [key, value] of en) {
    const other = tr.get(key);
    assert.equal(typeof other, typeof value, key);
    if (typeof value === 'function') assert.equal((other as () => string).length, value.length, `${key} arity`);
  }
});

test('every message is translated and non-empty', () => {
  const en = new Map(leaves(imageCompressorMessages.en));
  for (const [key, value] of leaves(imageCompressorMessages.tr)) {
    const sample = (fn: unknown) =>
      typeof fn === 'function' ? String((fn as (...args: string[]) => string)('A', 'B', 'C')) : String(fn);
    const text = sample(value);
    assert.ok(text.trim().length > 0, key);
    if (!SAME_IN_BOTH.has(key) && key !== 'settings.sizeOption' && key !== 'result.sizes' && key !== 'result.summary') {
      assert.notEqual(text, sample(en.get(key)), `${key} is still English`);
    }
  }
});

test('interpolated values stand alone in Turkish (no apostrophe case suffix after a value)', () => {
  for (const [key, value] of leaves(imageCompressorMessages.tr)) {
    if (typeof value !== 'function') continue;
    const text = String((value as (...args: string[]) => string)('«X»', '«Y»', '«Z»'));
    assert.doesNotMatch(text, /»['’]/u, key);
  }
});

test('English prose avoids exclamation marks', () => {
  for (const [key, value] of leaves(imageCompressorMessages.en)) {
    const text = typeof value === 'function' ? String((value as (...args: string[]) => string)('a', 'b', 'c')) : String(value);
    assert.doesNotMatch(text, /!/, key);
  }
});
