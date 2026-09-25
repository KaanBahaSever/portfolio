/**
 * The console's virtual file system: a small read-only tree built at build time.
 *
 * Paths are arrays of names from the root ([] is the root, ['projects'] is /projects). The
 * visitor's home directory is the root, so `~`, `/` and a bare `cd` all lead there and the
 * prompt shows the working directory relative to it ('~/projects'), as a shell does for $HOME.
 *
 * Pure module: no DOM, erasable TypeScript only.
 */
import type { Line } from './rich.ts';

export interface FileNode {
  kind: 'file';
  name: string;
  lines: readonly Line[];
}

export interface DirNode {
  kind: 'dir';
  name: string;
  children: readonly FsNode[];
}

export type FsNode = FileNode | DirNode;
export type FsPath = readonly string[];

export type LookupResult =
  | { ok: true; node: FsNode }
  /** 'not-a-directory': a file was used as a directory on the way (about.txt/x). */
  | { ok: false; code: 'not-found' | 'not-a-directory' };

export function dir(name: string, children: readonly FsNode[]): DirNode {
  return { kind: 'dir', name, children };
}

export function file(name: string, lines: readonly Line[]): FileNode {
  return { kind: 'file', name, lines };
}

/**
 * Resolves a path typed by the visitor against the working directory, lexically:
 *   resolvePath(['projects'], '..')         → []
 *   resolvePath([], 'projects//asion.txt')  → ['projects', 'asion.txt']
 *   resolvePath(['skills'], '~/projects')   → ['projects']
 *   resolvePath(['skills'], '/')            → []
 * `..` at the root stays at the root. An empty string resolves to the working directory.
 */
export function resolvePath(cwd: FsPath, input: string): FsPath {
  let parts: string[];
  let rest = input;
  if (input === '~' || input.startsWith('~/')) {
    parts = [];
    rest = input.slice(1);
  } else if (input.startsWith('/')) {
    parts = [];
  } else {
    parts = [...cwd];
  }
  for (const part of rest.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts;
}

export function lookup(root: DirNode, path: FsPath): LookupResult {
  let node: FsNode = root;
  for (const name of path) {
    if (node.kind !== 'dir') return { ok: false, code: 'not-a-directory' };
    const child: FsNode | undefined = node.children.find((entry) => entry.name === name);
    if (!child) return { ok: false, code: 'not-found' };
    node = child;
  }
  return { ok: true, node };
}

/** Absolute form, as `pwd` prints it: '/' or '/projects'. */
export function formatPath(path: FsPath): string {
  return `/${path.join('/')}`;
}

/** Home-relative form for the prompt: '~' or '~/projects'. */
export function promptPath(path: FsPath): string {
  return path.length === 0 ? '~' : `~/${path.join('/')}`;
}

export interface Entry {
  name: string;
  dir: boolean;
}

/** A directory's entries in `ls` order (by name, as the C locale sorts ASCII names). */
export function listEntries(directory: DirNode): Entry[] {
  return directory.children
    .map((child) => ({ name: child.name, dir: child.kind === 'dir' }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
