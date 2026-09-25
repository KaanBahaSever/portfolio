import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isLocale, localizePath, otherLocale, stripLocale, switchLocalePath } from '../src/i18n/config.ts';
import { formatters } from '../src/i18n/format.ts';
import { common } from '../src/i18n/messages/common.ts';

test('stripLocale splits the Turkish prefix off and leaves English paths alone', () => {
  assert.deepEqual(stripLocale('/tr/about/'), { locale: 'tr', path: '/about/' });
  assert.deepEqual(stripLocale('/tr/'), { locale: 'tr', path: '/' });
  assert.deepEqual(stripLocale('/tr'), { locale: 'tr', path: '/' });
  assert.deepEqual(stripLocale('/about/'), { locale: 'en', path: '/about/' });
  assert.deepEqual(stripLocale('/'), { locale: 'en', path: '/' });
  // Only a whole first segment counts: /trees/ is an English path.
  assert.deepEqual(stripLocale('/trees/'), { locale: 'en', path: '/trees/' });
  // The default locale is never a prefix.
  assert.deepEqual(stripLocale('/en/about/'), { locale: 'en', path: '/en/about/' });
});

test('localizePath adds the prefix for Turkish only and is idempotent', () => {
  assert.equal(localizePath('/about/', 'tr'), '/tr/about/');
  assert.equal(localizePath('/', 'tr'), '/tr/');
  assert.equal(localizePath('/#projects', 'tr'), '/tr/#projects');
  assert.equal(localizePath('/about/', 'en'), '/about/');
  assert.equal(localizePath('/tr/about/', 'tr'), '/tr/about/');
  assert.equal(localizePath('/tr/about/', 'en'), '/about/');
});

test('localizePath leaves external and protocol-relative URLs unchanged', () => {
  assert.equal(localizePath('https://example.com/a/', 'tr'), 'https://example.com/a/');
  assert.equal(localizePath('mailto:a@b.c', 'tr'), 'mailto:a@b.c');
  assert.equal(localizePath('//cdn.example.com/x', 'tr'), '//cdn.example.com/x');
});

test('switchLocalePath maps a page to its counterpart', () => {
  assert.equal(switchLocalePath('/tr/blog/post/', 'en'), '/blog/post/');
  assert.equal(switchLocalePath('/blog/post/', 'tr'), '/tr/blog/post/');
  assert.equal(otherLocale('en'), 'tr');
  assert.equal(otherLocale('tr'), 'en');
  assert.equal(isLocale('tr'), true);
  assert.equal(isLocale('de'), false);
});

test('bytes keeps the English format and uses a decimal comma in Turkish', () => {
  const en = formatters('en');
  const tr = formatters('tr');
  assert.equal(en.bytes(1023), '1023 B');
  assert.equal(en.bytes(1024), '1.0 KB');
  assert.equal(en.bytes(2.4 * 1024 * 1024), '2.4 MB');
  assert.equal(tr.bytes(1023), '1023 B');
  assert.equal(tr.bytes(3.4 * 1024), '3,4 KB');
  assert.equal(en.bytes(-1), '0 B');
  // 1023.95 KB would print as "1024.0 KB": it switches to MB instead.
  assert.equal(en.bytes(1023.95 * 1024), '1.0 MB');
});

test('percent puts the sign where each language expects it', () => {
  assert.equal(formatters('en').percent(0.64), '64%');
  assert.equal(formatters('tr').percent(0.64), '%64');
  assert.equal(formatters('en').percent(0.004), '<1%');
  assert.equal(formatters('tr').percent(0.004), '<%1');
});

test('dates are formatted in UTC in each language', () => {
  const date = new Date('2021-07-01T00:00:00Z');
  assert.equal(formatters('en').date(date, 'monthYear'), 'Jul 2021');
  assert.equal(formatters('tr').date(date, 'monthYear'), 'Tem 2021');
  assert.equal(formatters('tr').date(new Date('2026-08-28T00:00:00Z'), 'long'), '28 Ağustos 2026');
});

test('both locales define the same common message keys', () => {
  const keys = (value: unknown, prefix = ''): string[] =>
    value && typeof value === 'object'
      ? Object.entries(value).flatMap(([key, child]) => keys(child, `${prefix}${key}.`))
      : [prefix];
  assert.deepEqual(keys(common.tr).sort(), keys(common.en).sort());
});
