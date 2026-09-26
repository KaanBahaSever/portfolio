/**
 * Light/dark themes: the pure rules (src/lib/theme.ts), the pre-paint script in BaseLayout.astro
 * (run from the layout's own source against stubbed browser globals, like the language script in
 * i18n-language-redirect.test.ts), and a guard that every hand-written dark rule in the styles
 * also works with an explicit data-theme.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';

import {
  SYSTEM_DARK_QUERY,
  THEMES,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  isTheme,
  oppositeTheme,
  parseTheme,
  resolveTheme,
} from '../src/lib/theme.ts';

const ROOT = join(import.meta.dirname, '..');
const LAYOUT = join(ROOT, 'src', 'layouts', 'BaseLayout.astro');

test('only light and dark are themes', () => {
  assert.deepEqual([...THEMES], ['light', 'dark']);
  assert.equal(isTheme('light'), true);
  assert.equal(isTheme('dark'), true);
  for (const value of ['', 'system', 'auto', 'Dark', ' dark', null, undefined, 1, {}]) {
    assert.equal(isTheme(value), false, String(value));
    assert.equal(parseTheme(value), null, String(value));
  }
  assert.equal(parseTheme('dark'), 'dark');
});

test('a stored choice wins over the operating system', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});

test('without a valid stored choice the operating system decides', () => {
  for (const stored of [null, undefined, '', 'system', 'DARK', '{"theme":"dark"}']) {
    assert.equal(resolveTheme(stored, true), 'dark', String(stored));
    assert.equal(resolveTheme(stored, false), 'light', String(stored));
  }
});

test('the toggle switches to the other theme', () => {
  assert.equal(oppositeTheme('light'), 'dark');
  assert.equal(oppositeTheme('dark'), 'light');
});

test('theme colours are the page backgrounds (zinc-50 / zinc-950)', () => {
  assert.deepEqual(THEME_COLORS, { light: '#fafafa', dark: '#09090b' });
});

// --- The pre-paint script ------------------------------------------------------------------------

const themeScript = (() => {
  const source = readFileSync(LAYOUT, 'utf8');
  const match = /<script\s+is:inline\s+define:vars=\{\{([^}]*themeStorageKey[^}]*)\}\}\s*>([\s\S]*?)<\/script>/.exec(source);
  assert.ok(match, 'BaseLayout.astro has the inline theme script');
  const vars = match[1]!.split(',').map((entry) => entry.split(':')[0]!.trim());
  assert.deepEqual(vars, ['themes', 'themeStorageKey', 'themeColors', 'systemDarkQuery'], 'the variables these tests pass');
  return { source, body: match[2]!, index: match.index };
})();

interface Meta {
  media: string;
  content: string;
}

interface PageLoad {
  /** What localStorage holds under the theme key; 'blocked' makes every access throw. */
  stored?: string | null | 'blocked';
  systemDark?: boolean;
  /** matchMedia is missing or throws. */
  noMatchMedia?: boolean;
}

/** Runs the script for one page load and returns what it did to the document. */
function load({ stored = null, systemDark = false, noMatchMedia = false }: PageLoad) {
  const metas: Meta[] = [
    { media: '(prefers-color-scheme: light)', content: THEME_COLORS.light },
    { media: '(prefers-color-scheme: dark)', content: THEME_COLORS.dark },
  ];
  const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
  const queries: string[] = [];
  const localStorage = {
    getItem(key: string) {
      if (stored === 'blocked') throw new DOMException('The operation is insecure.', 'SecurityError');
      return key === THEME_STORAGE_KEY ? stored : null;
    },
  };
  const matchMedia = (query: string) => {
    if (noMatchMedia) throw new TypeError('matchMedia is not a function');
    queries.push(query);
    return { matches: query === SYSTEM_DARK_QUERY && systemDark };
  };
  const document = {
    documentElement: root,
    querySelectorAll(selector: string) {
      assert.equal(selector, 'meta[name="theme-color"][media]');
      return metas;
    },
  };
  const run = new Function(
    'themes',
    'themeStorageKey',
    'themeColors',
    'systemDarkQuery',
    'localStorage',
    'matchMedia',
    'document',
    themeScript.body,
  );
  run(THEMES, THEME_STORAGE_KEY, THEME_COLORS, SYSTEM_DARK_QUERY, localStorage, matchMedia, document);
  return { theme: root.dataset.theme, colorScheme: root.style.colorScheme, metas: metas.map((m) => m.content), queries };
}

test('pre-paint: no stored choice follows the operating system', () => {
  assert.deepEqual(load({ systemDark: false }), {
    theme: 'light',
    colorScheme: 'light',
    metas: [THEME_COLORS.light, THEME_COLORS.light],
    queries: [SYSTEM_DARK_QUERY],
  });
  assert.deepEqual(load({ systemDark: true }), {
    theme: 'dark',
    colorScheme: 'dark',
    metas: [THEME_COLORS.dark, THEME_COLORS.dark],
    queries: [SYSTEM_DARK_QUERY],
  });
});

test('pre-paint: a stored choice wins, and both theme-color metas get its colour', () => {
  const dark = load({ stored: 'dark', systemDark: false });
  assert.equal(dark.theme, 'dark');
  assert.equal(dark.colorScheme, 'dark');
  assert.deepEqual(dark.metas, [THEME_COLORS.dark, THEME_COLORS.dark]);
  assert.deepEqual(dark.queries, [], 'no need to ask the operating system');

  const light = load({ stored: 'light', systemDark: true });
  assert.equal(light.theme, 'light');
  assert.deepEqual(light.metas, [THEME_COLORS.light, THEME_COLORS.light]);
});

test('pre-paint: an unknown stored value is ignored', () => {
  assert.equal(load({ stored: 'system', systemDark: true }).theme, 'dark');
  assert.equal(load({ stored: '', systemDark: false }).theme, 'light');
});

test('pre-paint: blocked storage falls back to the operating system without throwing', () => {
  assert.equal(load({ stored: 'blocked', systemDark: true }).theme, 'dark');
  assert.equal(load({ stored: 'blocked', systemDark: false }).theme, 'light');
});

test('pre-paint: a missing matchMedia leaves the page to the CSS fallback without throwing', () => {
  const result = load({ noMatchMedia: true });
  assert.equal(result.theme, undefined, 'no data-theme: the stylesheet follows prefers-color-scheme');
  assert.deepEqual(result.metas, [THEME_COLORS.light, THEME_COLORS.dark], 'the metas keep their own colours');
});

test('pre-paint: the script runs before any stylesheet or body content, after the theme-color metas', () => {
  const { source, index } = themeScript;
  const head = source.slice(source.indexOf('<head>'), source.indexOf('</head>'));
  const scriptAt = index - source.indexOf('<head>');
  assert.ok(scriptAt > 0 && scriptAt < head.length, 'the script is inside <head>');
  const before = head.slice(0, scriptAt);
  assert.ok(!/<link\b[^>]*stylesheet/.test(before), 'no stylesheet link before it');
  assert.ok(before.includes('name="theme-color"'), 'the theme-color metas precede it, so it can update them');
  assert.ok(!before.includes('<slot'), 'no page-provided head content before it');
});

// --- Hand-written dark rules -----------------------------------------------------------------------

function styleFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return styleFiles(path);
    return /\.(css|astro)$/.test(name) ? [path] : [];
  });
}

test('every prefers-color-scheme block also has an explicit data-theme rule and is guarded', () => {
  const files = styleFiles(join(ROOT, 'src'));
  let blocks = 0;
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const name = relative(ROOT, file).replaceAll('\\', '/');
    for (const match of source.matchAll(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{/g)) {
      blocks++;
      // The selectors up to the first rule's opening brace.
      const rest = source.slice(match.index + match[0].length);
      const selector = rest.slice(0, rest.indexOf('{'));
      assert.match(
        selector,
        /:root:not\(\[data-theme\]\)/,
        `${name}: a prefers-color-scheme block must only apply when no theme is set (:root:not([data-theme]))`,
      );
      assert.match(source, /\[data-theme=['"]?dark['"]?\]/, `${name}: the same colours need an explicit [data-theme='dark'] rule`);
    }
  }
  assert.ok(blocks >= 10, `found only ${blocks} blocks: did the pattern change?`);
});

test('the Tailwind dark variant matches an explicit dark theme and the no-JavaScript fallback', () => {
  const css = readFileSync(join(ROOT, 'src', 'styles', 'global.css'), 'utf8');
  const variant = /@custom-variant dark \{([\s\S]*?)\n\}/.exec(css);
  assert.ok(variant, 'global.css defines the dark variant');
  assert.match(variant[1]!, /&:where\(\[data-theme="dark"\], \[data-theme="dark"\] \*\)/);
  assert.match(variant[1]!, /@media \(prefers-color-scheme: dark\)\s*\{\s*&:where\(:root:not\(\[data-theme\]\), :root:not\(\[data-theme\]\) \*\)/);
});
