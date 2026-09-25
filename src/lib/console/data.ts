/**
 * Builds everything the console shows, at build time, for one locale: the virtual file system
 * (projects/, skills/, about.txt, contact.txt, secret.txt), the documents printed by `whoami`
 * and `projects`, and the boot banner. The page serialises the result into a
 * <script type="application/json"> (see serializeJson), so each page ships only its own language.
 *
 * Pure module: no DOM, no `astro:*`, erasable TypeScript only. The page maps content-collection
 * entries and site settings to the plain inputs below.
 */
import { localizePath } from '../../i18n/config.ts';
import type { Locale } from '../../i18n/config.ts';
import { EULER_ART, EULER_ART_HIGHLIGHT } from './art.ts';
import type { ProjectRef } from './commands.ts';
import { blank, bright, dim, displayUrl, heading, indented, link, mapHrefs, pair, text } from './rich.ts';
import type { Line, Span } from './rich.ts';
import { dir, file } from './vfs.ts';
import type { DirNode } from './vfs.ts';

export const HOST = 'kbs-os';

export type ProjectStage = 'production' | 'early-access' | 'in-development';

export interface ConsoleProjectInput {
  id: string;
  title: string;
  summary: string;
  /**
   * Language of the project text (English when a Turkish translation is missing). Only the
   * summary is marked with it; see inLanguage().
   */
  lang: Locale;
  stack: readonly string[];
  isOpenSource: boolean;
  stage?: ProjectStage;
  since?: number;
  /** http(s) URL or a locale-free site path. */
  liveUrl?: string;
  repositoryUrl?: string;
}

export interface ConsoleGameInput {
  title: string;
  algorithm: string;
  /** Locale-free site path. */
  href: string;
}

export interface ConsoleContactInput {
  email: string;
  socials: readonly { label: string; href: string }[];
  location: string;
  /** Site path of the CV file (not localized: there is one PDF). */
  cvPath: string;
}

/**
 * Localized copy (src/i18n/console/content.ts). Links inside these lines use locale-free page
 * paths ('/games/'); the builder localizes them.
 */
export interface ConsoleCopy {
  /** The visitor's user name in the prompt. */
  user: string;
  banner: readonly Line[];
  whoami: readonly Line[];
  about: readonly Line[];
  /** skills/<key>.txt */
  skills: Readonly<Record<string, readonly Line[]>>;
  secret: { artLabel: string; caption: readonly Line[]; gamesIntro: string };
  contact: { heading: string; email: string; location: string; cv: string; cvNote: string };
  project: {
    stack: string;
    status: string;
    since: string;
    page: string;
    site: string;
    source: string;
    openSource: string;
    private: string;
    stages: Readonly<Record<ProjectStage, string>>;
  };
  projects: { heading: string; footer: readonly Line[] };
}

export interface ConsoleData {
  user: string;
  host: string;
  /** Localized home page ('/' or '/tr/'): where Exit and `exit` go. */
  home: string;
  root: DirNode;
  docs: { banner: readonly Line[]; whoami: readonly Line[]; projects: readonly Line[] };
  projects: readonly ProjectRef[];
}

export interface BuildInput {
  locale: Locale;
  copy: ConsoleCopy;
  projects: readonly ConsoleProjectInput[];
  games: readonly ConsoleGameInput[];
  contact: ConsoleContactInput;
}

const isSitePath = (href: string) => href.startsWith('/') && !href.startsWith('//');

/**
 * Marks a line as written in `lang` when that differs from the page (an untranslated summary).
 * Only summaries are marked: titles are proper names ('Açık Matematik', 'Karecik'), and reading
 * them with the voice of the source text would mispronounce the Turkish ones on /tr/.
 */
function inLanguage(line: Line, lang: Locale, locale: Locale): Line {
  return line.type === 'text' && lang !== locale ? { ...line, lang } : line;
}

export function buildConsoleData({ locale, copy, projects, games, contact }: BuildInput): ConsoleData {
  const localize = (href: string) => (isSitePath(href) ? localizePath(href, locale) : href);
  const localizeLines = (lines: readonly Line[]) => mapHrefs(lines, localize);
  const pageOf = (id: string) => localizePath(`/projects/${id}/`, locale);

  const ids = new Set<string>();
  for (const project of projects) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(project.id)) throw new Error(`Console: unusable project id "${project.id}"`);
    if (ids.has(project.id)) throw new Error(`Console: duplicate project id "${project.id}"`);
    ids.add(project.id);
  }

  const status = (project: ConsoleProjectInput) =>
    [
      project.isOpenSource ? copy.project.openSource : copy.project.private,
      project.stage ? copy.project.stages[project.stage] : undefined,
    ]
      .filter((part): part is string => Boolean(part))
      .join(' · ');

  const liveLink = (url: string): Span => link(isSitePath(url) ? localize(url) : displayUrl(url), localize(url));
  const externalLink = (url: string): Span => link(displayUrl(url), url);

  const projectFile = (project: ConsoleProjectInput): Line[] => {
    const page = pageOf(project.id);
    const lines: Line[] = [
      heading(project.title),
      inLanguage(text(project.summary), project.lang, locale),
      blank(),
      pair(copy.project.stack, project.stack.join(' · ')),
      pair(copy.project.status, status(project)),
    ];
    if (project.since) lines.push(pair(copy.project.since, String(project.since)));
    lines.push(pair(copy.project.page, link(page, page)));
    if (project.liveUrl) lines.push(pair(copy.project.site, liveLink(project.liveUrl)));
    if (project.repositoryUrl) lines.push(pair(copy.project.source, externalLink(project.repositoryUrl)));
    return lines;
  };

  const projectsDoc: Line[] = [heading(copy.projects.heading), blank()];
  for (const project of projects) {
    const page = pageOf(project.id);
    const links: Span[] = [dim('-> '), link(page, page)];
    if (project.liveUrl) links.push('   ', liveLink(project.liveUrl));
    if (project.repositoryUrl) links.push('   ', externalLink(project.repositoryUrl));
    const meta = [project.stack.join(' · '), status(project)].filter(Boolean).join(' — ');
    projectsDoc.push(
      text(bright(project.title)),
      inLanguage(indented(2, project.summary), project.lang, locale),
      indented(2, dim(meta)),
      indented(2, ...links),
      blank(),
    );
  }
  projectsDoc.push(...localizeLines(copy.projects.footer));

  const contactFile: Line[] = [
    heading(copy.contact.heading),
    blank(),
    pair(copy.contact.email, link(contact.email, `mailto:${contact.email}`)),
    ...contact.socials.map((social) => pair(social.label.toLowerCase(), externalLink(social.href))),
    pair(copy.contact.location, contact.location),
    pair(copy.contact.cv, link(contact.cvPath, contact.cvPath), dim(` ${copy.contact.cvNote}`)),
  ];

  const secretFile: Line[] = [
    { type: 'art', rows: EULER_ART, label: copy.secret.artLabel, highlight: EULER_ART_HIGHLIGHT },
    blank(),
    ...localizeLines(copy.secret.caption),
    blank(),
    text(copy.secret.gamesIntro),
    ...games.map((game) => pair(link(game.title, localize(game.href)), dim(game.algorithm))),
  ];

  const root = dir('', [
    dir(
      'projects',
      projects.map((project) => file(`${project.id}.txt`, projectFile(project))),
    ),
    dir(
      'skills',
      Object.entries(copy.skills).map(([name, lines]) => file(`${name}.txt`, localizeLines(lines))),
    ),
    file('about.txt', localizeLines(copy.about)),
    file('contact.txt', contactFile),
    file('secret.txt', secretFile),
  ]);

  return {
    user: copy.user,
    host: HOST,
    home: localizePath('/', locale),
    root,
    docs: {
      banner: localizeLines(copy.banner),
      whoami: localizeLines(copy.whoami),
      projects: projectsDoc,
    },
    projects: projects.map((project) => ({ id: project.id, title: project.title, page: pageOf(project.id) })),
  };
}

/**
 * JSON for a <script type="application/json"> element. `<`, `>` and `&` are escaped so no
 * string can close the element ("</script>") or open a comment, and U+2028/U+2029 so the text
 * is also a valid JavaScript literal. JSON.parse reads the escapes back unchanged.
 */
/** Built from char codes, so the source never holds a raw line separator. */
const UNSAFE_IN_SCRIPT = new RegExp(`[<>&${String.fromCharCode(0x2028, 0x2029)}]`, 'g');

export function serializeJson(value: unknown): string {
  return JSON.stringify(value).replace(
    UNSAFE_IN_SCRIPT,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}
