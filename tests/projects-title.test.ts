import assert from 'node:assert/strict';
import { test } from 'node:test';
import { titleRuns } from '../src/components/projects/title.ts';

const NBSP = ' ';
const joined = (title: string) => titleRuns(title).map((run) => run.text).join('');

test('titleRuns keeps compound words whole and the dash with the word before it', () => {
  assert.deepEqual(titleRuns('Rocket-Up — High-Power Rocket Simulation'), [
    { text: `Rocket-Up${NBSP}—`, keep: true },
    { text: ' ', keep: false },
    { text: 'High-Power', keep: true },
    { text: ' Rocket Simulation', keep: false },
  ]);
  assert.deepEqual(titleRuns('Rocket-Up — Yüksek Güçlü Roket Simülasyonu'), [
    { text: `Rocket-Up${NBSP}—`, keep: true },
    { text: ' Yüksek Güçlü Roket Simülasyonu', keep: false },
  ]);
});

test('titleRuns leaves plain titles as one breakable run', () => {
  assert.deepEqual(titleRuns('Açık Matematik'), [{ text: 'Açık Matematik', keep: false }]);
  assert.deepEqual(titleRuns('i18n-cpp'), [{ text: 'i18n-cpp', keep: true }]);
  assert.deepEqual(titleRuns(''), []);
  // A dash without a hyphenated word still gets the no-break space, nothing is kept.
  assert.deepEqual(titleRuns('Karecik – QR menus'), [{ text: `Karecik${NBSP}– QR menus`, keep: false }]);
});

test('titleRuns never keeps a word long enough to overflow a phone screen', () => {
  const long = 'an-extremely-long-hyphenated-project-name';
  assert.deepEqual(titleRuns(`The ${long}`), [{ text: `The ${long}`, keep: false }]);
});

test('titleRuns changes no visible character except spaces before dashes', () => {
  for (const title of ['Rocket-Up — High-Power Rocket Simulation', 'NeoSMBIOS', 'a - b', 'x  y-z  w']) {
    assert.equal(joined(title).replaceAll(NBSP, ' '), title);
  }
});
