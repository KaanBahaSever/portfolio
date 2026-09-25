import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ALIASES,
  COMMANDS,
  closestCommand,
  editDistance,
  execute,
  findProject,
  resolveCommand,
  slugify,
} from '../src/lib/console/commands.ts';
import type { ProjectRef, ShellContext } from '../src/lib/console/commands.ts';
import { text } from '../src/lib/console/rich.ts';
import { dir, file } from '../src/lib/console/vfs.ts';

const aboutLines = [text('about me')];
const projects: ProjectRef[] = [
  { id: 'acik-matematik', title: 'Açık Matematik', page: '/tr/projects/acik-matematik/' },
  { id: 'asion', title: 'Asion', page: '/tr/projects/asion/' },
  { id: 'neosmbios', title: 'NeoSMBIOS', page: '/tr/projects/neosmbios/' },
  { id: 'rocket-up', title: 'Rocket-Up (Rocket Flight Simulation)', page: '/tr/projects/rocket-up/' },
];
const root = dir('', [
  dir(
    'projects',
    projects.map((project) => file(`${project.id}.txt`, [text(project.title)])),
  ),
  dir('skills', [file('math.txt', [text('topology')])]),
  file('about.txt', aboutLines),
  file('contact.txt', []),
  file('secret.txt', []),
]);

const context = (overrides: Partial<ShellContext> = {}): ShellContext => ({
  cwd: [],
  root,
  projects,
  history: [],
  home: '/tr/',
  ...overrides,
});

test('an empty line does nothing', () => {
  assert.deepEqual(execute('   ', context()), { cwd: [], output: [] });
});

test('help lists every command, or explains the ones asked for', () => {
  assert.deepEqual(execute('help', context()).output, [{ kind: 'help', commands: COMMANDS }]);
  assert.deepEqual(execute('help cd ls', context()).output, [{ kind: 'help', commands: ['cd', 'ls'] }]);
  assert.deepEqual(execute('help nope', context()).output, [
    { kind: 'error', error: { code: 'unknown-help-topic', topic: 'nope' } },
  ]);
});

test('commands are case-insensitive and habitual aliases work', () => {
  assert.deepEqual(execute('LS', context()).output[0]?.kind, 'listing');
  assert.equal(resolveCommand('cls'), 'clear');
  assert.equal(resolveCommand('quit'), 'exit');
  assert.equal(resolveCommand('dir'), 'ls');
  // Inherited object keys are not commands.
  assert.equal(resolveCommand('constructor'), undefined);
  assert.equal(resolveCommand('toString'), undefined);
  for (const target of ALIASES.values()) assert.ok(COMMANDS.includes(target));
});

test('ls lists directories, echoes files and ignores short options', () => {
  const rootListing = execute('ls', context()).output[0];
  assert.deepEqual(rootListing, {
    kind: 'listing',
    entries: [
      { name: 'about.txt', dir: false },
      { name: 'contact.txt', dir: false },
      { name: 'projects', dir: true },
      { name: 'secret.txt', dir: false },
      { name: 'skills', dir: true },
    ],
  });
  assert.deepEqual(execute('ls -la skills', context()).output, [
    { kind: 'listing', entries: [{ name: 'math.txt', dir: false }] },
  ]);
  assert.deepEqual(execute('ls ..', context({ cwd: ['skills'] })).output, [rootListing]);
  assert.deepEqual(execute('ls about.txt', context()).output, [
    { kind: 'listing', entries: [{ name: 'about.txt', dir: false }] },
  ]);
  assert.deepEqual(execute('ls nope', context()).output, [
    { kind: 'error', error: { code: 'no-such-path', command: 'ls', path: 'nope' } },
  ]);
  assert.deepEqual(execute('ls a b', context()).output, [
    { kind: 'error', error: { code: 'too-many-arguments', command: 'ls' } },
  ]);
});

test('cd moves between directories and refuses files and unknown paths', () => {
  assert.deepEqual(execute('cd projects', context()), { cwd: ['projects'], output: [] });
  assert.deepEqual(execute('cd ..', context({ cwd: ['projects'] })).cwd, []);
  assert.deepEqual(execute('cd ../skills', context({ cwd: ['projects'] })).cwd, ['skills']);
  assert.deepEqual(execute('cd', context({ cwd: ['projects'] })).cwd, []);
  assert.deepEqual(execute('cd ~', context({ cwd: ['projects'] })).cwd, []);
  assert.deepEqual(execute('cd /skills', context({ cwd: ['projects'] })).cwd, ['skills']);

  const intoFile = execute('cd about.txt', context({ cwd: [] }));
  assert.deepEqual(intoFile.cwd, []);
  assert.deepEqual(intoFile.output, [
    { kind: 'error', error: { code: 'not-a-directory', command: 'cd', path: 'about.txt' } },
  ]);
  const missing = execute('cd nowhere', context({ cwd: ['skills'] }));
  assert.deepEqual(missing.cwd, ['skills'], 'a failed cd stays put');
  assert.deepEqual(missing.output[0], {
    kind: 'error',
    error: { code: 'no-such-path', command: 'cd', path: 'nowhere' },
  });
  assert.deepEqual(execute('cd a b', context()).output[0], {
    kind: 'error',
    error: { code: 'too-many-arguments', command: 'cd' },
  });
});

test('pwd prints the absolute working directory', () => {
  assert.deepEqual(execute('pwd', context()).output, [{ kind: 'text', text: '/' }]);
  assert.deepEqual(execute('pwd', context({ cwd: ['projects'] })).output, [{ kind: 'text', text: '/projects' }]);
});

test('cat prints files, one output per argument, with an error for each bad one', () => {
  assert.deepEqual(execute('cat about.txt', context()).output, [{ kind: 'file', lines: aboutLines }]);
  assert.deepEqual(execute('cat ../about.txt', context({ cwd: ['skills'] })).output, [
    { kind: 'file', lines: aboutLines },
  ]);
  const mixed = execute('cat about.txt projects missing.txt about.txt/x', context()).output;
  assert.deepEqual(mixed, [
    { kind: 'file', lines: aboutLines },
    { kind: 'error', error: { code: 'is-a-directory', command: 'cat', path: 'projects' } },
    { kind: 'error', error: { code: 'no-such-path', command: 'cat', path: 'missing.txt' } },
    { kind: 'error', error: { code: 'not-a-directory', command: 'cat', path: 'about.txt/x' } },
  ]);
  assert.deepEqual(execute('cat', context()).output, [
    { kind: 'error', error: { code: 'missing-operand', command: 'cat' } },
  ]);
});

test('quoted arguments reach commands intact', () => {
  assert.deepEqual(execute('echo "two  spaces" \'and quotes\'', context()).output, [
    { kind: 'text', text: 'two  spaces and quotes' },
  ]);
  assert.deepEqual(execute('echo "open', context()).output, [
    { kind: 'error', error: { code: 'unterminated-quote', quote: '"' } },
  ]);
});

test('projects, whoami and history print documents and data', () => {
  assert.deepEqual(execute('projects', context()).output, [{ kind: 'doc', doc: 'projects' }]);
  assert.deepEqual(execute('whoami', context()).output, [{ kind: 'doc', doc: 'whoami' }]);
  assert.deepEqual(execute('history', context({ history: ['ls', 'history'] })).output, [
    { kind: 'history', entries: ['ls', 'history'] },
  ]);
});

test('open goes to a project page by id, title, file name or unique prefix', () => {
  const result = execute('open asion', context());
  assert.deepEqual(result.output, [{ kind: 'notice', notice: 'opening', title: 'Asion' }]);
  assert.deepEqual(result.effect, { type: 'navigate', href: '/tr/projects/asion/' });
  assert.equal(execute('open projects/neosmbios.txt', context()).effect?.type, 'navigate');
  assert.equal(findProject(projects, 'Açık Matematik')?.id, 'acik-matematik');
  assert.equal(findProject(projects, 'rocket')?.id, 'rocket-up');
  assert.equal(findProject(projects, 'NEO')?.id, 'neosmbios');
  // 'a' matches two projects: ambiguous.
  assert.equal(findProject(projects, 'a'), undefined);
  assert.equal(findProject(projects, '...'), undefined);
  assert.deepEqual(execute('open nope', context()).output, [
    { kind: 'error', error: { code: 'unknown-project', name: 'nope' } },
  ]);
  assert.deepEqual(execute('open', context()).output, [
    { kind: 'error', error: { code: 'missing-operand', command: 'open' } },
  ]);
});

test('clear and exit ask the page to act', () => {
  assert.deepEqual(execute('clear', context()), { cwd: [], output: [], effect: { type: 'clear' } });
  assert.deepEqual(execute('exit', context()), {
    cwd: [],
    output: [{ kind: 'notice', notice: 'logout' }],
    effect: { type: 'navigate', href: '/tr/' },
  });
});

test('unknown commands suggest a near miss, or how to open a file or directory', () => {
  assert.deepEqual(execute('hlep', context()).output, [
    { kind: 'error', error: { code: 'command-not-found', command: 'hlep', suggestion: 'help' } },
  ]);
  assert.deepEqual(execute('sl', context()).output[0], {
    kind: 'error',
    error: { code: 'command-not-found', command: 'sl', suggestion: 'ls' },
  });
  assert.deepEqual(execute('about.txt', context()).output[0], {
    kind: 'error',
    error: { code: 'command-not-found', command: 'about.txt', suggestion: 'cat about.txt' },
  });
  assert.deepEqual(execute('..', context({ cwd: ['skills'] })).output[0], {
    kind: 'error',
    error: { code: 'command-not-found', command: '..', suggestion: 'cd ..' },
  });
  assert.deepEqual(execute('xyzzy', context()).output, [
    { kind: 'error', error: { code: 'command-not-found', command: 'xyzzy' } },
  ]);
});

test('edit distance counts a swap of neighbours as one edit', () => {
  assert.equal(editDistance('ls', 'sl'), 1);
  assert.equal(editDistance('help', 'hlep'), 1);
  assert.equal(editDistance('cat', 'cart'), 1);
  assert.equal(editDistance('', 'abc'), 3);
  assert.equal(editDistance('kitten', 'sitting'), 3);
  assert.equal(closestCommand('pdw'), 'pwd');
  assert.equal(closestCommand('x'), undefined);
  assert.equal(closestCommand('histroy'), 'history');
});

test('slugify folds Turkish letters and punctuation', () => {
  assert.equal(slugify('Açık Matematik'), 'acik-matematik');
  assert.equal(slugify('İŞĞÜÖÇ ışğüöç'), 'isguoc-isguoc');
  assert.equal(slugify('Rocket-Up (Rocket Flight Simulation)'), 'rocket-up-rocket-flight-simulation');
});
