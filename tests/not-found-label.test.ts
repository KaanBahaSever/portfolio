import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOT_FOUND_LABEL_MAX, notFoundLabel } from '../src/lib/not-found-label.ts';

test('the label is the requested path without its slashes', () => {
  assert.equal(notFoundLabel('/abc'), 'abc');
  assert.equal(notFoundLabel('/abc/'), 'abc');
  assert.equal(notFoundLabel('/blog/old-post/'), 'blog/old-post');
});

test('the Turkish page drops its locale prefix, and only a whole segment', () => {
  assert.equal(notFoundLabel('/tr/abc', 'tr'), 'abc');
  assert.equal(notFoundLabel('/tr/blog/eski-yazi/', 'tr'), 'blog/eski-yazi');
  assert.equal(notFoundLabel('/tree', 'tr'), 'tree');
  assert.equal(notFoundLabel('/tr/', 'tr'), null);
});

test('percent escapes are decoded, malformed ones are kept as typed', () => {
  assert.equal(notFoundLabel('/%C3%A7i%C3%A7ek'), 'çiçek');
  assert.equal(notFoundLabel('/%E0%A4%A'), '%E0%A4%A');
  assert.equal(notFoundLabel('/a%0Ab'), 'ab');
});

test('nothing left means no label', () => {
  assert.equal(notFoundLabel('/'), null);
  assert.equal(notFoundLabel(''), null);
});

test('long paths keep both ends around a middle ellipsis', () => {
  const long = '/projects/a-very-long-project-name-that-goes-on/details';
  const label = notFoundLabel(long);
  assert.ok(label);
  assert.equal(Array.from(label).length, NOT_FOUND_LABEL_MAX);
  assert.ok(label.startsWith('projects/a-'));
  assert.ok(label.endsWith('on/details'));
  assert.ok(label.includes('…'));
  assert.equal(notFoundLabel('/' + 'x'.repeat(NOT_FOUND_LABEL_MAX)), 'x'.repeat(NOT_FOUND_LABEL_MAX));
});

test('the ellipsis never splits a character', () => {
  const label = notFoundLabel('/' + '🚀'.repeat(40));
  assert.ok(label);
  assert.equal(Array.from(label).length, NOT_FOUND_LABEL_MAX);
  assert.equal(label.replace('…', ''), '🚀'.repeat(NOT_FOUND_LABEL_MAX - 1));
});
