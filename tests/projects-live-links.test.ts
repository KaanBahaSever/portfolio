/**
 * The products that are live link their public sites (liveUrl in the project frontmatter), which
 * the project page, the project cards and the console all show. Karecik also keeps its
 * repository link: it is open source.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const field = (id: string, key: string) => {
  const source = readFileSync(new URL(`../src/content/projects/${id}.md`, import.meta.url), 'utf8');
  return new RegExp(`^${key}:\\s*(\\S+)\\s*$`, 'm').exec(source)?.[1];
};

test('live products link their public sites', () => {
  assert.equal(field('karecik', 'liveUrl'), 'https://karecik.com');
  assert.equal(field('karecik', 'repositoryUrl'), 'https://github.com/KaanBahaSever/karecik');
  assert.equal(field('novacast', 'liveUrl'), 'https://novacast.app');
  assert.equal(field('acik-matematik', 'liveUrl'), 'https://acik-matematik.com');
  assert.equal(field('asion', 'liveUrl'), 'https://asion.app');
});
