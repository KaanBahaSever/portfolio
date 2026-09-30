/**
 * The README is kept short: purpose, stack, setup, scripts, structure and one line on deployment.
 * These checks keep what it does say true: the npm scripts it names exist (and every script that
 * matters is listed), the Node version matches `.node-version`, every folder and file in the
 * project tree exists, and it follows the site's rules about the owner (a developer, never an
 * engineer; no Swift-era details).
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

const readme = read('README.md').replaceAll('\r\n', '\n');
const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string>; engines: { node: string } };

/** The body of the `## <title>` section, up to the next second-level heading. */
function section(title: string): string {
  const start = readme.indexOf(`\n## ${title}\n`);
  assert.notEqual(start, -1, `README has no "## ${title}" section`);
  const next = readme.indexOf('\n## ', start + 1);
  return readme.slice(start, next === -1 ? undefined : next);
}

test('the README keeps to the sections the owner chose', () => {
  const headings = [...readme.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(headings, ['Tech stack', 'Getting started', 'Scripts', 'Project structure', 'Deployment']);
});

test('every npm command in the README is a script in package.json', () => {
  const named = [...readme.matchAll(/\bnpm (?:run ([\w:-]+)|(test)\b)/g)].map((m) => m[1] ?? m[2]);
  assert.ok(named.length > 0);
  for (const script of named) assert.ok(script in pkg.scripts, `README runs "${script}", which package.json does not define`);
});

test('the Scripts table lists every npm script except the raw astro passthrough', () => {
  const listed = new Set(
    [...section('Scripts').matchAll(/^\| `npm (?:run ([\w:-]+)|(test))`/gm)].map((m) => m[1] ?? m[2]),
  );
  for (const script of Object.keys(pkg.scripts).filter((name) => name !== 'astro')) {
    assert.ok(listed.has(script), `npm script "${script}" is missing from the README's Scripts table`);
  }
});

test('the README names the Node version the site builds with', () => {
  const pinned = read('.node-version').trim(); // e.g. 22.18.0
  const [major, minor] = pinned.split('.');
  assert.match(readme, new RegExp(`Node(?:\\.js)? ${major}\\.${minor} or later`));
  assert.equal(pkg.engines.node, `>=${pinned}`, 'package.json engines and .node-version disagree');
});

test('every entry in the project tree exists', () => {
  const tree = section('Project structure').match(/```text\n([\s\S]*?)```/)?.[1];
  assert.ok(tree, 'the Project structure section has no text block');
  const parents: string[] = [];
  let entries = 0;
  for (const line of tree.split('\n')) {
    const match = line.match(/^((?:│   |    )*)[├└]── (\S+)/);
    if (!match) continue; // the "." root, blank lines and wrapped comments
    const depth = match[1].length / 4;
    const path = [...parents.slice(0, depth), match[2]].join('');
    parents.length = depth;
    parents.push(match[2]);
    entries += 1;
    assert.ok(existsSync(new URL(path, root)), `README lists ${path}, which is not in the repository`);
  }
  assert.ok(entries >= 10, `only ${entries} tree entries were read; did the tree format change?`);
});

test('the README follows the site rules about the owner', () => {
  assert.doesNotMatch(readme, /engineer|mühendis/i, 'the owner is a software developer, never an engineer');
  assert.doesNotMatch(readme, /\b(Swift|Antizan|Aydos)\b/i, 'the Swift role was removed from the portfolio');
});
