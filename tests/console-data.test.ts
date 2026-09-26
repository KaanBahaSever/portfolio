import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LOCALES } from '../src/i18n/config.ts';
import { consoleContent } from '../src/i18n/console/content.ts';
import { consoleMessages } from '../src/i18n/console/messages.ts';
import { common } from '../src/i18n/messages/common.ts';
import { projectsMessages } from '../src/i18n/messages/projects.ts';
import { COMMANDS, execute } from '../src/lib/console/commands.ts';
import type { ShellError } from '../src/lib/console/commands.ts';
import { buildConsoleData, serializeJson } from '../src/lib/console/data.ts';
import type { ConsoleProjectInput } from '../src/lib/console/data.ts';
import { displayUrl, isSafeHref, plainText } from '../src/lib/console/rich.ts';
import type { Line, Span } from '../src/lib/console/rich.ts';
import { lookup } from '../src/lib/console/vfs.ts';
import type { FsNode } from '../src/lib/console/vfs.ts';
import { describeError, describeNotice } from '../src/scripts/console/describe.ts';

const projects: ConsoleProjectInput[] = [
  {
    id: 'karecik',
    title: 'Karecik',
    summary: 'Kafe ve restoranlar için QR menü platformu.',
    lang: 'tr',
    stack: ['Go', 'PostgreSQL'],
    isOpenSource: true,
    stage: 'production',
    repositoryUrl: 'https://github.com/KaanBahaSever/karecik',
  },
  {
    id: 'asion',
    title: 'Asion',
    summary: 'A cross-platform productivity and active window tracking system.',
    lang: 'en',
    stack: ['C++', 'Go'],
    isOpenSource: false,
    stage: 'early-access',
    since: 2024,
    liveUrl: 'https://asion.app',
  },
  {
    id: 'pdf-tool',
    title: 'PDF tool',
    summary: 'A tool on this site.',
    lang: 'tr',
    stack: ['TypeScript'],
    isOpenSource: false,
    liveUrl: '/tools/pdf-split/',
  },
];

const build = (locale: 'en' | 'tr') =>
  buildConsoleData({
    locale,
    copy: consoleContent[locale],
    projects,
    games: [{ title: 'XOX', algorithm: 'Minimax', href: '/games/tic-tac-toe/' }],
    contact: {
      email: 'someone@example.com',
      socials: [{ label: 'GitHub', href: 'https://github.com/KaanBahaSever' }],
      location: 'İstanbul, Türkiye',
      cvPath: '/cv/kaan-cv.pdf',
    },
  });

function spansOf(line: Line): readonly Span[] {
  if (line.type === 'text') return line.spans;
  if (line.type === 'pair') return [...line.term, ...line.desc];
  return [];
}

function allLines(node: FsNode): Line[] {
  return node.kind === 'file' ? [...node.lines] : node.children.flatMap(allLines);
}

function hrefs(lines: readonly Line[]): string[] {
  return lines.flatMap(spansOf).flatMap((span) => (typeof span !== 'string' && span.href ? [span.href] : []));
}

const fileLines = (data: ReturnType<typeof build>, path: string[]) => {
  const found = lookup(data.root, path);
  assert.ok(found.ok && found.node.kind === 'file', path.join('/'));
  return found.node.lines;
};

test('the file system has the promised layout, one file per project', () => {
  const data = build('en');
  assert.deepEqual(
    data.root.children.map((child) => child.name),
    ['projects', 'skills', 'about.txt', 'contact.txt', 'secret.txt'],
  );
  const listing = execute('ls projects', {
    cwd: [],
    root: data.root,
    projects: data.projects,
    history: [],
    home: data.home,
  }).output[0];
  assert.deepEqual(listing, {
    kind: 'listing',
    entries: [
      { name: 'asion.txt', dir: false },
      { name: 'karecik.txt', dir: false },
      { name: 'pdf-tool.txt', dir: false },
    ],
  });
  const skills = lookup(data.root, ['skills']);
  assert.ok(skills.ok && skills.node.kind === 'dir');
  assert.ok(skills.node.children.length >= 5);
  assert.ok(skills.node.children.every((child) => child.kind === 'file' && child.name.endsWith('.txt')));
});

test('site links are localized for Turkish; files and external links are not', () => {
  const tr = build('tr');
  assert.equal(tr.home, '/tr/');
  assert.deepEqual(
    tr.projects.map((project) => project.page),
    ['/tr/projects/karecik/', '/tr/projects/asion/', '/tr/projects/pdf-tool/'],
  );
  assert.ok(hrefs(fileLines(tr, ['about.txt'])).includes('/tr/games/'));
  assert.ok(hrefs(fileLines(tr, ['secret.txt'])).includes('/tr/games/tic-tac-toe/'));
  assert.ok(hrefs(fileLines(tr, ['projects', 'pdf-tool.txt'])).includes('/tr/tools/pdf-split/'));
  const contact = hrefs(fileLines(tr, ['contact.txt']));
  assert.ok(contact.includes('/cv/kaan-cv.pdf'), 'the CV is one file for every language');
  assert.ok(contact.includes('mailto:someone@example.com'));
  assert.ok(contact.includes('https://github.com/KaanBahaSever'));

  const en = build('en');
  assert.equal(en.home, '/');
  assert.ok(hrefs(fileLines(en, ['about.txt'])).includes('/games/'));
  assert.ok(hrefs(en.docs.projects).includes('/projects/asion/'));
});

test('every link in the data is one the renderer will create', () => {
  for (const locale of LOCALES) {
    const data = build(locale);
    const lines = [...allLines(data.root), ...data.docs.banner, ...data.docs.whoami, ...data.docs.projects];
    const links = hrefs(lines);
    assert.ok(links.length > 5);
    for (const href of links) assert.ok(isSafeHref(href), `${locale}: ${href}`);
  }
});

test('project files show the stack, status, page and links in the page language', () => {
  const tr = build('tr');
  const karecik = fileLines(tr, ['projects', 'karecik.txt']).map(plainText).join('\n');
  assert.match(karecik, /teknolojiler Go · PostgreSQL/);
  assert.match(karecik, /durum Açık kaynak · Canlıda/);
  assert.match(karecik, /sayfa \/tr\/projects\/karecik\//);
  assert.match(karecik, /kaynak kodu github\.com\/KaanBahaSever\/karecik/);

  const asion = fileLines(build('en'), ['projects', 'asion.txt']).map(plainText).join('\n');
  assert.match(asion, /status Private · In development · Early access/);
  assert.match(asion, /since 2024/);
  assert.match(asion, /site asion\.app/);
});

test('project stages use the same names as the project cards and pages', () => {
  for (const locale of LOCALES) {
    const { stages, openSource, private: closed } = consoleContent[locale].project;
    assert.equal(stages.production, projectsMessages[locale].stage.production, locale);
    // Early access shows as two badges on the cards ("In development", "Early access").
    assert.equal(stages['early-access'], `${common[locale].badges.inDevelopment} · ${common[locale].badges.earlyAccess}`, locale);
    assert.equal(stages['in-development'], common[locale].badges.inDevelopment, locale);
    assert.equal(openSource, common[locale].badges.openSource, locale);
    assert.equal(closed, common[locale].badges.private, locale);
  }
});

test('an untranslated project summary is marked as English on the Turkish page', () => {
  const data = build('tr');
  const lines = fileLines(data, ['projects', 'asion.txt']);
  const summary = lines.find((line) => line.type === 'text' && plainText(line).startsWith('A cross-platform'));
  assert.ok(summary && summary.type === 'text');
  assert.equal(summary.lang, 'en');
  // Titles are proper names ('Açık Matematik'): never read with another language's voice.
  const titles = [lines[0], ...data.docs.projects.filter((line) => plainText(line) === 'Asion')];
  assert.equal(titles.length, 2);
  for (const title of titles) {
    assert.ok(title?.type === 'text' && plainText(title) === 'Asion');
    assert.equal(title.lang, undefined);
  }
  const translated = fileLines(build('tr'), ['projects', 'karecik.txt'])[1];
  assert.ok(translated?.type === 'text');
  assert.equal(translated.lang, undefined);
});

test('duplicate or unusable project ids fail the build', () => {
  const base = { copy: consoleContent.en, games: [], contact: { email: 'a@b.c', socials: [], location: '', cvPath: '/cv.pdf' } };
  assert.throws(() => buildConsoleData({ ...base, locale: 'en', projects: [projects[0]!, projects[0]!] }), /duplicate/);
  assert.throws(
    () => buildConsoleData({ ...base, locale: 'en', projects: [{ ...projects[0]!, id: 'a/b' }] }),
    /unusable/,
  );
});

test('serializeJson cannot close its script element and round-trips', () => {
  const tricky = { text: '</script><!-- &    “ok”', n: 1 };
  const json = serializeJson(tricky);
  assert.ok(!json.includes('<') && !json.includes('>') && !json.includes('&'));
  assert.ok(!json.includes(' ') && !json.includes(' '));
  assert.deepEqual(JSON.parse(json), tricky);
  const data = build('tr');
  assert.deepEqual(JSON.parse(serializeJson(data)), JSON.parse(JSON.stringify(data)));
});

test('isSafeHref and displayUrl', () => {
  assert.ok(isSafeHref('/projects/asion/'));
  assert.ok(isSafeHref('https://asion.app'));
  assert.ok(isSafeHref('mailto:a@b.c'));
  assert.ok(!isSafeHref('javascript:alert(1)'));
  assert.ok(!isSafeHref('//evil.example'));
  assert.ok(!isSafeHref('/\\evil.example'));
  assert.ok(!isSafeHref('data:text/html,x'));
  assert.equal(displayUrl('https://www.asion.app/'), 'asion.app');
  assert.equal(displayUrl('https://github.com/KaanBahaSever/karecik'), 'github.com/KaanBahaSever/karecik');
  assert.equal(displayUrl('mailto:a@b.c'), 'a@b.c');
});

/** Every line the console can show for a locale: files, whoami, projects and the banner. */
function everyText(locale: 'en' | 'tr'): string {
  const data = build(locale);
  return [...allLines(data.root), ...data.docs.banner, ...data.docs.whoami, ...data.docs.projects]
    .map(plainText)
    .join('\n');
}

test('the console never calls the owner an engineer, in either language', () => {
  // Other people keep their titles: the GDSC guest is a network security engineer.
  const guest = /network security engineer|ağ güvenliği mühendis\p{L}*/giu;
  for (const locale of LOCALES) {
    const all = everyText(locale);
    assert.doesNotMatch(all.replace(guest, ''), /engineer|mühendis/i, locale);
  }
  assert.match(everyText('en'), /crowd\.inc — Software Developer, July 2021 – March 2024/);
  assert.match(everyText('tr'), /crowd\.inc — Yazılım Geliştirici, Temmuz 2021 – Mart 2024/);
});

test('skills/devops.txt covers the CI/CD work, and every run link finds its file from anywhere', () => {
  for (const locale of LOCALES) {
    const data = build(locale);
    const devops = fileLines(data, ['skills', 'devops.txt']).map(plainText).join('\n');
    for (const fact of [/GitHub Actions/, /Bash, Batch/, /Asion/]) assert.match(devops, fact, locale);

    // `run` spans are commands; the ones that cat a file must resolve from any directory.
    const lines = [...allLines(data.root), ...data.docs.whoami, ...data.docs.banner];
    const commands = lines.flatMap(spansOf).flatMap((span) => (typeof span !== 'string' && span.run ? [span.run] : []));
    const cats = commands.filter((command) => command.startsWith('cat ~/'));
    assert.ok(cats.length >= 2, locale);
    for (const command of cats) {
      for (const cwd of [[], ['projects'], ['skills']]) {
        const result = execute(command, { cwd, root: data.root, projects: data.projects, history: [], home: data.home });
        assert.equal(result.output[0]?.kind, 'file', `${locale}: ${command} from /${cwd.join('/')}`);
      }
    }
  }
});

test('about.txt tells the current story in both languages', () => {
  const en = fileLines(build('en'), ['about.txt']).map(plainText).join('\n');
  assert.match(en, /one low-altitude \(5,000 ft\) and two high-altitude \(10,000 ft\)/);
  assert.doesNotMatch(en, /launched successfully|high-power/);
  assert.match(en, /2016: programming fundamentals in C# at a vocational high school/);
  assert.match(en, /Hunt & Target algorithm came later/);
  assert.doesNotMatch(en, /aims with probability densities/);
  assert.match(en, /rewritten from scratch as Rocket-Up/);
  assert.match(en, /Google Developer Student Clubs core team, 2023/);
  assert.match(en, /Mathematics Club/);

  const trData = build('tr');
  const tr = fileLines(trData, ['about.txt']).map(plainText).join('\n');
  assert.match(tr, /bir alçak irtifa \(5\.000 ft\) ve iki yüksek irtifa \(10\.000 ft\)/);
  assert.match(tr, /Rocket-Up/);
  assert.match(tr, /Matematik Kulübü/);
  // The Rocket-Up page and the research repository are linked, localized where they are site pages.
  const links = hrefs(fileLines(trData, ['about.txt']));
  assert.ok(links.includes('/tr/projects/rocket-up/'));
  assert.ok(links.includes('https://github.com/KaanBahaSever/AutonomousParachute'));
});

test('both catalogues describe every command, and Turkish is not left in English', () => {
  for (const command of COMMANDS) {
    const en = consoleMessages.en.help.describe[command];
    const tr = consoleMessages.tr.help.describe[command];
    assert.ok(en && tr, command);
    assert.notEqual(en, tr, `${command} is translated`);
    // Command names stay English in both languages.
    assert.ok(consoleMessages.tr.help.usage[command].startsWith(command));
  }
  assert.notDeepEqual(consoleContent.tr.about, consoleContent.en.about);
  assert.notDeepEqual(consoleContent.tr.whoami, consoleContent.en.whoami);
  assert.deepEqual(Object.keys(consoleContent.tr.skills), Object.keys(consoleContent.en.skills));
});

test('every error code has a message in both languages that keeps the values', () => {
  const errors: ShellError[] = [
    { code: 'command-not-found', command: 'foo' },
    { code: 'command-not-found', command: 'hlep', suggestion: 'help' },
    { code: 'no-such-path', command: 'cat', path: 'x.txt' },
    { code: 'not-a-directory', command: 'cd', path: 'about.txt' },
    { code: 'is-a-directory', command: 'cat', path: 'projects' },
    { code: 'missing-operand', command: 'cat' },
    { code: 'missing-operand', command: 'open' },
    { code: 'too-many-arguments', command: 'cd' },
    { code: 'unterminated-quote', quote: '"' },
    { code: 'unknown-project', name: 'zeta' },
    { code: 'ambiguous-project', name: 'a', candidates: ['acik-matematik', 'asion'] },
    { code: 'unknown-help-topic', topic: 'zeta' },
  ];
  for (const locale of LOCALES) {
    const m = consoleMessages[locale];
    for (const error of errors) {
      const message = describeError(error, m);
      assert.ok(message.length > 0);
      for (const value of Object.values(error).flat()) {
        if (value !== error.code) assert.ok(message.includes(String(value)), `${locale} ${error.code}: ${message}`);
      }
    }
    assert.match(describeNotice({ kind: 'notice', notice: 'opening', title: 'Asion' }, m), /Asion/);
    assert.ok(describeNotice({ kind: 'notice', notice: 'logout' }, m).length > 0);
  }
  assert.notEqual(
    describeError({ code: 'no-such-path', command: 'cat', path: 'x' }, consoleMessages.tr),
    describeError({ code: 'no-such-path', command: 'cat', path: 'x' }, consoleMessages.en),
  );
});
