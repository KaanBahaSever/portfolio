/**
 * The CV-only content (src/data/cv.ts) follows the same rules as the site: the owner is a
 * software developer, never an engineer; links are https (or tel:/mailto:); project tag lists
 * stay short; and none of the removed Swift-era details come back.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CV } from '../src/data/cv.ts';

const text = JSON.stringify(CV);

test('the CV never calls the owner an engineer', () => {
  assert.doesNotMatch(text, /engineer/i);
  assert.doesNotMatch(text, /mühendis/i);
});

test('the removed role stays removed', () => {
  assert.doesNotMatch(text, /Swift|Antizan|Aydos/i);
});

test('the headline matches the site', () => {
  assert.equal(CV.headline, 'Software Developer | Math-Driven Solutions & Algorithms');
});

test('project and research links are https and every project has a short stack', () => {
  for (const item of [...CV.projects, ...CV.research]) {
    if (item.url) assert.match(item.url, /^https:\/\//, item.url);
  }
  for (const project of CV.projects) {
    assert.ok(project.stack.length >= 1 && project.stack.length <= 5, project.name);
    assert.ok(project.text.length > 40, project.name);
  }
  assert.match(CV.phone.href, /^tel:\+\d+$/);
});
