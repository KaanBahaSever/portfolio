/**
 * The console's commands. execute() parses one line, runs it against the virtual file system
 * and returns structured output: what to print (as codes and data, never prose) and any side
 * effect for the page to perform (clearing the screen, navigating). The browser controller
 * turns that into localized text, so this module stays pure and testable.
 *
 * Pure module: no DOM, erasable TypeScript only.
 */
import type { Line } from './rich.ts';
import { quoteWord, tokenize } from './tokenize.ts';
import type { Quote } from './tokenize.ts';
import { formatPath, listEntries, lookup, resolvePath } from './vfs.ts';
import type { DirNode, Entry, FsPath } from './vfs.ts';

/** In the order `help` lists them. Command names are English in every language, like a real shell. */
export const COMMANDS = [
  'help',
  'whoami',
  'ls',
  'cd',
  'pwd',
  'cat',
  'projects',
  'open',
  'echo',
  'history',
  'clear',
  'exit',
] as const;

export type CommandName = (typeof COMMANDS)[number];

/**
 * Names people type out of habit from other shells. They work but are not listed by `help` or
 * offered by completion. A Map, so inherited object keys such as 'constructor' never match.
 */
export const ALIASES: ReadonlyMap<string, CommandName> = new Map<string, CommandName>([
  ['?', 'help'],
  ['man', 'help'],
  ['dir', 'ls'],
  ['ll', 'ls'],
  ['type', 'cat'],
  ['cls', 'clear'],
  ['quit', 'exit'],
  ['logout', 'exit'],
]);

/** What a command's arguments name, for Tab completion. */
export type ArgumentKind = 'directories' | 'paths' | 'projects' | 'commands';

export const ARGUMENT_KINDS: Readonly<Partial<Record<CommandName, ArgumentKind>>> = {
  cd: 'directories',
  ls: 'paths',
  cat: 'paths',
  open: 'projects',
  help: 'commands',
};

export interface ProjectRef {
  id: string;
  title: string;
  /** Localized project page, e.g. '/tr/projects/asion/'. */
  page: string;
}

export interface ShellContext {
  cwd: FsPath;
  root: DirNode;
  projects: readonly ProjectRef[];
  /** Earlier commands, oldest first, including the one being run. */
  history: readonly string[];
  /** Localized home page, where `exit` goes. */
  home: string;
}

export type ShellError =
  /** `suggestion` is a full command line to try instead ('help', 'cat about.txt'). */
  | { code: 'command-not-found'; command: string; suggestion?: string }
  | { code: 'no-such-path'; command: CommandName; path: string }
  | { code: 'not-a-directory'; command: CommandName; path: string }
  | { code: 'is-a-directory'; command: CommandName; path: string }
  | { code: 'missing-operand'; command: 'cat' | 'open' }
  | { code: 'too-many-arguments'; command: CommandName }
  | { code: 'unterminated-quote'; quote: Quote }
  | { code: 'unknown-project'; name: string }
  | { code: 'unknown-help-topic'; topic: string };

export type Output =
  | { kind: 'help'; commands: readonly CommandName[] }
  /** A document prepared at build time (ConsoleData.docs). */
  | { kind: 'doc'; doc: 'whoami' | 'projects' }
  | { kind: 'listing'; entries: readonly Entry[] }
  | { kind: 'file'; lines: readonly Line[] }
  /** Verbatim text that needs no translation (pwd, echo). */
  | { kind: 'text'; text: string }
  | { kind: 'history'; entries: readonly string[] }
  | { kind: 'notice'; notice: 'logout' }
  | { kind: 'notice'; notice: 'opening'; title: string }
  | { kind: 'error'; error: ShellError };

export type Effect = { type: 'clear' } | { type: 'navigate'; href: string };

export interface ShellResult {
  /** The working directory after the command. */
  cwd: FsPath;
  output: Output[];
  effect?: Effect;
}

export function resolveCommand(name: string): CommandName | undefined {
  const key = name.toLowerCase();
  return (COMMANDS as readonly string[]).includes(key) ? (key as CommandName) : ALIASES.get(key);
}

const fail = (error: ShellError): Output => ({ kind: 'error', error });

/** ls options such as -l, -a, -la are accepted and ignored: the listing is always short. */
const isOption = (word: string) => /^-[a-zA-Z]+$/.test(word);

type Handler = (args: readonly string[], ctx: ShellContext) => ShellResult;

const HANDLERS: Record<CommandName, Handler> = {
  help(args, ctx) {
    if (args.length === 0) return { cwd: ctx.cwd, output: [{ kind: 'help', commands: COMMANDS }] };
    const commands: CommandName[] = [];
    const output: Output[] = [];
    for (const topic of args) {
      const command = resolveCommand(topic);
      if (command) commands.push(command);
      else output.push(fail({ code: 'unknown-help-topic', topic }));
    }
    if (commands.length > 0) output.unshift({ kind: 'help', commands });
    return { cwd: ctx.cwd, output };
  },

  whoami: (_args, ctx) => ({ cwd: ctx.cwd, output: [{ kind: 'doc', doc: 'whoami' }] }),

  ls(args, ctx) {
    const paths = args.filter((word) => !isOption(word));
    if (paths.length > 1) return { cwd: ctx.cwd, output: [fail({ code: 'too-many-arguments', command: 'ls' })] };
    const target = paths[0] ?? '';
    const found = lookup(ctx.root, resolvePath(ctx.cwd, target));
    if (!found.ok) {
      const code = found.code === 'not-found' ? 'no-such-path' : 'not-a-directory';
      return { cwd: ctx.cwd, output: [fail({ code, command: 'ls', path: target })] };
    }
    const entries = found.node.kind === 'dir' ? listEntries(found.node) : [{ name: target, dir: false }];
    return { cwd: ctx.cwd, output: [{ kind: 'listing', entries }] };
  },

  cd(args, ctx) {
    if (args.length > 1) return { cwd: ctx.cwd, output: [fail({ code: 'too-many-arguments', command: 'cd' })] };
    const target = args[0] ?? '~';
    const path = resolvePath(ctx.cwd, target);
    const found = lookup(ctx.root, path);
    if (!found.ok) {
      const code = found.code === 'not-found' ? 'no-such-path' : 'not-a-directory';
      return { cwd: ctx.cwd, output: [fail({ code, command: 'cd', path: target })] };
    }
    if (found.node.kind !== 'dir') {
      return { cwd: ctx.cwd, output: [fail({ code: 'not-a-directory', command: 'cd', path: target })] };
    }
    return { cwd: path, output: [] };
  },

  pwd: (_args, ctx) => ({ cwd: ctx.cwd, output: [{ kind: 'text', text: formatPath(ctx.cwd) }] }),

  cat(args, ctx) {
    if (args.length === 0) return { cwd: ctx.cwd, output: [fail({ code: 'missing-operand', command: 'cat' })] };
    const output = args.map((target): Output => {
      const found = lookup(ctx.root, resolvePath(ctx.cwd, target));
      if (!found.ok) {
        const code = found.code === 'not-found' ? 'no-such-path' : 'not-a-directory';
        return fail({ code, command: 'cat', path: target });
      }
      if (found.node.kind === 'dir') return fail({ code: 'is-a-directory', command: 'cat', path: target });
      return { kind: 'file', lines: found.node.lines };
    });
    return { cwd: ctx.cwd, output };
  },

  projects: (_args, ctx) => ({ cwd: ctx.cwd, output: [{ kind: 'doc', doc: 'projects' }] }),

  open(args, ctx) {
    if (args.length === 0) return { cwd: ctx.cwd, output: [fail({ code: 'missing-operand', command: 'open' })] };
    if (args.length > 1) return { cwd: ctx.cwd, output: [fail({ code: 'too-many-arguments', command: 'open' })] };
    const project = findProject(ctx.projects, args[0]!);
    if (!project) return { cwd: ctx.cwd, output: [fail({ code: 'unknown-project', name: args[0]! })] };
    return {
      cwd: ctx.cwd,
      output: [{ kind: 'notice', notice: 'opening', title: project.title }],
      effect: { type: 'navigate', href: project.page },
    };
  },

  echo: (args, ctx) => ({ cwd: ctx.cwd, output: [{ kind: 'text', text: args.join(' ') }] }),

  history: (_args, ctx) => ({ cwd: ctx.cwd, output: [{ kind: 'history', entries: ctx.history }] }),

  clear: (_args, ctx) => ({ cwd: ctx.cwd, output: [], effect: { type: 'clear' } }),

  exit: (_args, ctx) => ({
    cwd: ctx.cwd,
    output: [{ kind: 'notice', notice: 'logout' }],
    effect: { type: 'navigate', href: ctx.home },
  }),
};

export function execute(line: string, ctx: ShellContext): ShellResult {
  const parsed = tokenize(line);
  if (!parsed.ok) return { cwd: ctx.cwd, output: [fail({ code: 'unterminated-quote', quote: parsed.quote })] };
  const [name, ...args] = parsed.words;
  if (name === undefined) return { cwd: ctx.cwd, output: [] };
  const command = resolveCommand(name);
  if (!command) {
    const suggestion = suggestFor(name, ctx);
    return {
      cwd: ctx.cwd,
      output: [fail(suggestion ? { code: 'command-not-found', command: name, suggestion } : { code: 'command-not-found', command: name })],
    };
  }
  return HANDLERS[command](args, ctx);
}

/**
 * A helpful alternative for an unknown command: a file or directory typed on its own becomes
 * `cat file` / `cd dir`, and a near-miss becomes the command it was probably meant to be.
 */
export function suggestFor(name: string, ctx: Pick<ShellContext, 'cwd' | 'root'>): string | undefined {
  if (name.trim() !== '') {
    const found = lookup(ctx.root, resolvePath(ctx.cwd, name));
    if (found.ok) return `${found.node.kind === 'dir' ? 'cd' : 'cat'} ${quoteWord(name)}`;
  }
  return closestCommand(name);
}

/** The command within a small edit distance of `name` (one edit for short names, two otherwise). */
export function closestCommand(name: string): CommandName | undefined {
  const word = name.toLowerCase();
  if (word === '') return undefined;
  const limit = word.length <= 3 ? 1 : 2;
  let best: CommandName | undefined;
  let bestDistance = limit + 1;
  for (const command of COMMANDS) {
    const distance = editDistance(word, command);
    if (distance < bestDistance) {
      best = command;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Optimal string alignment distance: insertions, deletions, substitutions and swaps of two
 * neighbouring characters each cost one, so 'sl' is one edit from 'ls'.
 */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[] = new Array<number>(rows * cols).fill(0);
  const at = (i: number, j: number) => d[i * cols + j]!;
  for (let i = 0; i < rows; i++) d[i * cols] = i;
  for (let j = 0; j < cols; j++) d[j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, at(i - 2, j - 2) + 1);
      }
      d[i * cols + j] = value;
    }
  }
  return at(a.length, b.length);
}

/** 'Açık Matematik' → 'acik-matematik', so names can be typed on any keyboard. */
export function slugify(value: string): string {
  return value
    .replace(/ı/g, 'i') // dotless i has no decomposition
    .replace(/İ/g, 'I')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * The project `query` names: its id, its title, its file ('projects/asion.txt') or an
 * unambiguous prefix of any of these ('neo' → NeoSMBIOS).
 */
export function findProject(projects: readonly ProjectRef[], query: string): ProjectRef | undefined {
  const base = query.replace(/\/+$/, '').split('/').pop() ?? '';
  const key = slugify(base.replace(/\.txt$/i, ''));
  if (key === '') return undefined;
  const exact = projects.find((project) => project.id === key || slugify(project.title) === key);
  if (exact) return exact;
  const candidates = projects.filter((project) => project.id.startsWith(key) || slugify(project.title).startsWith(key));
  return candidates.length === 1 ? candidates[0] : undefined;
}
