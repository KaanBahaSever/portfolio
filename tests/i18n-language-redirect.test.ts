/**
 * The language-preference script in BaseLayout.astro runs inline before first paint, so it
 * cannot import a tested module. These tests take the script's source from the layout itself
 * and run it against stubbed browser globals (storage, languages, referrer, location).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { LOCALE_STORAGE_KEY, type Locale } from '../src/i18n/config.ts';

const LAYOUT = join(import.meta.dirname, '..', 'src', 'layouts', 'BaseLayout.astro');
const ORIGIN = 'https://kaanbahasever.com';

const script = (() => {
  const source = readFileSync(LAYOUT, 'utf8');
  const match = /<script is:inline define:vars=\{\{([^}]*)\}\}>([\s\S]*?)<\/script>/.exec(source);
  assert.ok(match, 'BaseLayout.astro has an inline define:vars script');
  const vars = match[1]!.split(',').map((entry) => entry.split(':')[0]!.trim());
  assert.deepEqual(vars, ['pageLocale', 'alternates', 'storageKey'], 'the variables these tests pass');
  return match[2]!;
})();

interface Visit {
  /** Path of the page being loaded. */
  pathname: string;
  pageLocale: Locale;
  alternates: Partial<Record<Locale, string>>;
  /** What localStorage holds under the locale key; 'blocked' makes every access throw. */
  stored?: string | null | 'blocked';
  languages?: readonly string[];
  referrer?: string;
  search?: string;
  hash?: string;
}

/** Runs the script for one page load and returns the URLs it passed to location.replace. */
function visit({
  pathname,
  pageLocale,
  alternates,
  stored = null,
  languages = ['en-US', 'en'],
  referrer = '',
  search = '',
  hash = '',
}: Visit): string[] {
  const replaced: string[] = [];
  const localStorage = {
    getItem(key: string) {
      if (stored === 'blocked') throw new DOMException('The operation is insecure.', 'SecurityError');
      return key === LOCALE_STORAGE_KEY ? stored : null;
    },
  };
  const navigator = { languages, language: languages[0] };
  const location = { origin: ORIGIN, pathname, search, hash, replace: (url: string) => replaced.push(url) };
  const document = { referrer };
  const run = new Function(
    'pageLocale',
    'alternates',
    'storageKey',
    'localStorage',
    'navigator',
    'location',
    'document',
    script,
  );
  run(pageLocale, alternates, LOCALE_STORAGE_KEY, localStorage, navigator, location, document);
  return replaced;
}

const home = { pathname: '/', pageLocale: 'en', alternates: { en: '/', tr: '/tr/' } } as const;
const trHome = { pathname: '/tr/', pageLocale: 'tr', alternates: { en: '/', tr: '/tr/' } } as const;
const turkishBrowser = ['tr-TR', 'tr', 'en-US'] as const;

test('a stored choice sends every page to that language', () => {
  assert.deepEqual(visit({ ...home, stored: 'tr' }), ['/tr/']);
  assert.deepEqual(visit({ ...trHome, stored: 'en' }), ['/']);
  const about = { pathname: '/about/', pageLocale: 'en', alternates: { en: '/about/', tr: '/tr/about/' } } as const;
  assert.deepEqual(visit({ ...about, stored: 'tr', search: '?x=1', hash: '#journey' }), ['/tr/about/?x=1#journey']);
  // Already in the stored language, or an unknown value: stay.
  assert.deepEqual(visit({ ...home, stored: 'en', languages: turkishBrowser }), []);
  assert.deepEqual(visit({ ...home, stored: 'de' }), []);
});

test('without a stored choice, the English home page reached from outside follows the browser', () => {
  assert.deepEqual(visit({ ...home, languages: turkishBrowser }), ['/tr/']);
  assert.deepEqual(visit({ ...home, languages: turkishBrowser, referrer: 'https://www.google.com/' }), ['/tr/']);
  assert.deepEqual(visit({ ...home, languages: ['de-DE', 'tr', 'en'] }), ['/tr/']);
  assert.deepEqual(visit({ ...home, languages: ['en-GB', 'tr'] }), []);
  // Only the home page: a deep link is the language its URL says.
  const about = { pathname: '/about/', pageLocale: 'en', alternates: { en: '/about/', tr: '/tr/about/' } } as const;
  assert.deepEqual(visit({ ...about, languages: turkishBrowser }), []);
});

test('reaching the English home page from this site is a choice, even with storage blocked', () => {
  // The EN toggle on /tr/ links to '/'; with storage blocked it could not save 'en'.
  assert.deepEqual(visit({ ...home, stored: 'blocked', languages: turkishBrowser, referrer: `${ORIGIN}/tr/` }), []);
  assert.deepEqual(visit({ ...home, languages: turkishBrowser, referrer: `${ORIGIN}/about/` }), []);
  // Blocked storage on an entry from outside still follows the browser.
  assert.deepEqual(visit({ ...home, stored: 'blocked', languages: turkishBrowser }), ['/tr/']);
  // A look-alike host or an unparsable referrer is not this site.
  assert.deepEqual(visit({ ...home, languages: turkishBrowser, referrer: 'https://kaanbahasever.com.example/' }), ['/tr/']);
  assert.deepEqual(visit({ ...home, languages: turkishBrowser, referrer: 'not a url' }), ['/tr/']);
});

test('the script never redirects to a version that does not exist', () => {
  const englishOnly = { pathname: '/blog/x/', pageLocale: 'en', alternates: { en: '/blog/x/' } } as const;
  assert.deepEqual(visit({ ...englishOnly, stored: 'tr' }), []);
});
