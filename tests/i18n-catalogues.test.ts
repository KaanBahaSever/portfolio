/**
 * Every message catalogue under src/i18n/ exports `{ en, tr }` records. TypeScript already makes
 * the Turkish object match `typeof en`, but only where a catalogue is typed that way; this test
 * checks all of them at runtime: same keys, same nesting, same array lengths, and a function
 * wherever the other language has one (so interpolated messages keep their parameters).
 */
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

const ROOT = join(import.meta.dirname, '..', 'src', 'i18n');
// Helpers, not catalogues.
const SKIP = new Set(['config.ts', 'format.ts', 'server.ts', 'client.ts']);

function catalogueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return catalogueFiles(path);
    return name.endsWith('.ts') && !SKIP.has(name) ? [path] : [];
  });
}

/** Leaf paths with a type tag: 'nav.home:string', 'pages:function', 'tips.2:string'. */
function shape(value: unknown, prefix = ''): string[] {
  if (typeof value === 'function') return [`${prefix}:function`];
  if (Array.isArray(value)) return value.flatMap((item, index) => shape(item, `${prefix}${index}.`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => shape(child, `${prefix}${key}.`));
  }
  return [`${prefix}:${typeof value}`];
}

function isLocalized(value: unknown): value is { en: unknown; tr: unknown } {
  return Boolean(value && typeof value === 'object' && 'en' in value && 'tr' in value);
}

const files = catalogueFiles(ROOT);

test('there are catalogues to check', () => {
  assert.ok(files.length >= 5, `found only ${files.length} catalogue files`);
});

for (const file of files) {
  test(`${relative(ROOT, file).replaceAll('\\', '/')}: English and Turkish have the same shape`, async () => {
    const module: Record<string, unknown> = await import(pathToFileURL(file).href);
    for (const [name, value] of Object.entries(module)) {
      if (!isLocalized(value)) continue;
      assert.deepEqual(shape(value.tr).sort(), shape(value.en).sort(), `${name}: tr differs from en`);
    }
  });
}
