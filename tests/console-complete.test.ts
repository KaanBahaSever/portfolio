import assert from 'node:assert/strict';
import { test } from 'node:test';

import { commonPrefix, complete } from '../src/lib/console/complete.ts';
import type { CompletionContext } from '../src/lib/console/complete.ts';
import { dir, file } from '../src/lib/console/vfs.ts';

const root = dir('', [
  dir('projects', [file('asion.txt', []), file('acik-matematik.txt', []), file('karecik.txt', [])]),
  dir('skills', [file('math.txt', [])]),
  file('about.txt', []),
  file('contact.txt', []),
  file('secret.txt', []),
]);

const ctx = (cwd: string[] = []): CompletionContext => ({
  cwd,
  root,
  projects: [{ id: 'asion' }, { id: 'acik-matematik' }, { id: 'karecik' }],
});

test('commonPrefix', () => {
  assert.equal(commonPrefix([]), '');
  assert.equal(commonPrefix(['help']), 'help');
  assert.equal(commonPrefix(['history', 'help']), 'h');
  assert.equal(commonPrefix(['cat', 'dog']), '');
});

test('the first word completes to a command, with a trailing space', () => {
  assert.deepEqual(complete('wh', ctx()), { text: 'whoami ', candidates: ['whoami'] });
  assert.deepEqual(complete('pro', ctx()), { text: 'projects ', candidates: ['projects'] });
  assert.deepEqual(complete('WH', ctx()), { text: 'whoami ', candidates: ['whoami'] });
  assert.deepEqual(complete('  cl', ctx()), { text: '  clear ', candidates: ['clear'] });
});

test('ambiguous commands are returned for listing, the line unchanged', () => {
  assert.deepEqual(complete('c', ctx()), { text: 'c', candidates: ['cat', 'cd', 'clear'] });
  assert.deepEqual(complete('h', ctx()), { text: 'h', candidates: ['help', 'history'] });
  assert.deepEqual(complete('zzz', ctx()), { text: 'zzz', candidates: [] });
});

test('file arguments complete in the working directory; directories keep the word open', () => {
  assert.deepEqual(complete('cat ab', ctx()), { text: 'cat about.txt ', candidates: ['about.txt'] });
  assert.deepEqual(complete('cat pro', ctx()), { text: 'cat projects/', candidates: ['projects/'] });
  assert.deepEqual(complete('cat projects/k', ctx()), {
    text: 'cat projects/karecik.txt ',
    candidates: ['karecik.txt'],
  });
  assert.deepEqual(complete('cat ', ctx(['skills'])), { text: 'cat math.txt ', candidates: ['math.txt'] });
  assert.deepEqual(complete('ls ../sk', ctx(['projects'])), { text: 'ls ../skills/', candidates: ['skills/'] });
  assert.deepEqual(complete('cd ~/sk', ctx(['projects'])), { text: 'cd ~/skills/', candidates: ['skills/'] });
});

test('a shared prefix is filled in first, then the matches are listed', () => {
  assert.deepEqual(complete('cat projects/a', ctx()), {
    text: 'cat projects/a',
    candidates: ['acik-matematik.txt', 'asion.txt'],
  });
  assert.deepEqual(complete('cat c', ctx()), { text: 'cat contact.txt ', candidates: ['contact.txt'] });
  assert.deepEqual(complete('cat s', ctx()), { text: 'cat s', candidates: ['secret.txt', 'skills/'] });
  assert.deepEqual(complete('cat se', ctx()), { text: 'cat secret.txt ', candidates: ['secret.txt'] });
  assert.deepEqual(complete('ls projects/', ctx()), {
    text: 'ls projects/',
    candidates: ['acik-matematik.txt', 'asion.txt', 'karecik.txt'],
  });
});

test('cd completes directories only', () => {
  assert.deepEqual(complete('cd s', ctx()), { text: 'cd skills/', candidates: ['skills/'] });
  assert.deepEqual(complete('cd a', ctx()), { text: 'cd a', candidates: [] });
});

test('open completes project ids, help completes commands, other commands complete nothing', () => {
  assert.deepEqual(complete('open k', ctx()), { text: 'open karecik ', candidates: ['karecik'] });
  assert.deepEqual(complete('open a', ctx()), { text: 'open a', candidates: ['acik-matematik', 'asion'] });
  assert.deepEqual(complete('help hi', ctx()), { text: 'help history ', candidates: ['history'] });
  assert.deepEqual(complete('echo ab', ctx()), { text: 'echo ab', candidates: [] });
  assert.deepEqual(complete('nope ab', ctx()), { text: 'nope ab', candidates: [] });
});

test('paths through files or unknown directories complete nothing', () => {
  assert.deepEqual(complete('cat about.txt/', ctx()), { text: 'cat about.txt/', candidates: [] });
  assert.deepEqual(complete('cat nowhere/a', ctx()), { text: 'cat nowhere/a', candidates: [] });
});

test('a word opened with a quote is completed without it', () => {
  assert.deepEqual(complete('cat "ab', ctx()), { text: 'cat about.txt ', candidates: ['about.txt'] });
});

test('aliases complete their arguments like the command they stand for', () => {
  assert.deepEqual(complete('type ab', ctx()), { text: 'type about.txt ', candidates: ['about.txt'] });
});
