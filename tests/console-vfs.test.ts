import assert from 'node:assert/strict';
import { test } from 'node:test';

import { text } from '../src/lib/console/rich.ts';
import { dir, file, formatPath, listEntries, lookup, promptPath, resolvePath } from '../src/lib/console/vfs.ts';

const root = dir('', [
  dir('skills', [file('math.txt', [text('analysis')])]),
  dir('projects', [file('karecik.txt', []), file('asion.txt', [])]),
  file('about.txt', [text('hello')]),
]);

test('resolvePath handles relative paths, ., .. and repeated slashes', () => {
  assert.deepEqual(resolvePath([], 'projects'), ['projects']);
  assert.deepEqual(resolvePath(['projects'], 'asion.txt'), ['projects', 'asion.txt']);
  assert.deepEqual(resolvePath([], 'projects//asion.txt'), ['projects', 'asion.txt']);
  assert.deepEqual(resolvePath(['projects'], '..'), []);
  assert.deepEqual(resolvePath(['projects'], '../skills/./math.txt'), ['skills', 'math.txt']);
  assert.deepEqual(resolvePath(['projects'], ''), ['projects']);
  assert.deepEqual(resolvePath(['projects'], '.'), ['projects']);
  assert.deepEqual(resolvePath(['projects'], 'projects/'), ['projects', 'projects']);
});

test('resolvePath: ~ and / lead to the root, and .. never climbs above it', () => {
  assert.deepEqual(resolvePath(['skills'], '~'), []);
  assert.deepEqual(resolvePath(['skills'], '~/projects'), ['projects']);
  assert.deepEqual(resolvePath(['skills'], '/'), []);
  assert.deepEqual(resolvePath(['skills'], '/projects/asion.txt'), ['projects', 'asion.txt']);
  assert.deepEqual(resolvePath([], '../../..'), []);
  assert.deepEqual(resolvePath([], '../projects'), ['projects']);
  // Only a leading ~ means home.
  assert.deepEqual(resolvePath([], 'a~'), ['a~']);
  assert.deepEqual(resolvePath([], '~x'), ['~x']);
});

test('lookup finds files and directories and explains failures', () => {
  const about = lookup(root, ['about.txt']);
  assert.ok(about.ok && about.node.kind === 'file');
  const projects = lookup(root, ['projects']);
  assert.ok(projects.ok && projects.node.kind === 'dir');
  assert.deepEqual(lookup(root, []), { ok: true, node: root });
  assert.deepEqual(lookup(root, ['nope']), { ok: false, code: 'not-found' });
  assert.deepEqual(lookup(root, ['about.txt', 'x']), { ok: false, code: 'not-a-directory' });
});

test('paths print absolute for pwd and home-relative for the prompt', () => {
  assert.equal(formatPath([]), '/');
  assert.equal(formatPath(['projects']), '/projects');
  assert.equal(promptPath([]), '~');
  assert.equal(promptPath(['skills']), '~/skills');
});

test('listEntries sorts by name and marks directories', () => {
  assert.deepEqual(listEntries(root), [
    { name: 'about.txt', dir: false },
    { name: 'projects', dir: true },
    { name: 'skills', dir: true },
  ]);
});
