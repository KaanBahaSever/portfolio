/**
 * Hygiene rules for the projects collection, checked on the Markdown sources so they hold
 * before any build: every English project has a Turkish overlay (and no overlay is orphaned),
 * tag lists stay short and free of hosting providers, every project has a line drawing with a
 * caption in both languages, the dates the owner gave are kept, and no copy calls the owner an
 * engineer.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { hasFigure } from '../src/components/projects/figures.ts';
import { LOCALES } from '../src/i18n/config.ts';
import { projectsMessages } from '../src/i18n/messages/projects.ts';

const EN_DIR = new URL('../src/content/projects/', import.meta.url);
const TR_DIR = new URL('../src/content/tr/projects/', import.meta.url);

const markdownFiles = (dir: URL) => readdirSync(dir).filter((name) => /\.mdx?$/.test(name)).sort();
const read = (dir: URL, name: string) => readFileSync(new URL(name, dir), 'utf8');
const idOf = (name: string) => name.replace(/\.mdx?$/, '');

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

/** Top-level `key: value` pairs of a frontmatter block (enough for the flat fields used here). */
function frontmatter(source: string): Map<string, string> {
  const block = FRONTMATTER.exec(source);
  assert.ok(block, 'missing frontmatter');
  const fields = new Map<string, string>();
  for (const line of block[1].split(/\r?\n/)) {
    const field = /^([A-Za-z]+):\s*(.*)$/.exec(line);
    if (field) fields.set(field[1], field[2].trim());
  }
  return fields;
}

const unquote = (value: string) => value.replace(/^(['"])(.*)\1$/, '$2');

/** A YAML flow sequence such as `[Go, PostgreSQL]` or `['C++']`. */
function flowList(value: string | undefined): string[] {
  const inner = /^\[(.*)\]$/.exec(value ?? '');
  assert.ok(inner, `expected a [flow, list], got ${value}`);
  return inner[1]
    .split(',')
    .map((item) => unquote(item.trim()))
    .filter(Boolean);
}

const enFiles = markdownFiles(EN_DIR);
const projects = enFiles.map((name) => ({ id: idOf(name), name, source: read(EN_DIR, name) }));

test('every project has a Turkish overlay, and every overlay a project', () => {
  assert.ok(enFiles.length > 0);
  assert.deepEqual(markdownFiles(TR_DIR), enFiles);
});

test('tech stacks: 1 to 5 distinct tags, no hosting providers', () => {
  for (const { id, source } of projects) {
    const tags = flowList(frontmatter(source).get('techStack'));
    assert.ok(tags.length >= 1 && tags.length <= 5, `${id}: ${tags.length} tags`);
    assert.equal(new Set(tags).size, tags.length, `${id}: duplicate tags`);
    // The owner asked for Cloudflare to go: where a project is hosted is not what it is built with.
    for (const tag of tags) assert.doesNotMatch(tag, /cloudflare|vercel|netlify/i, `${id}: ${tag}`);
  }
});

test('every project has a line drawing with a caption in both languages', () => {
  for (const { id } of projects) {
    assert.ok(hasFigure(id), `${id}: no drawing in ProjectFigure.astro / no caption in projects.ts`);
    for (const locale of LOCALES) {
      const caption = projectsMessages[locale].figures[id as keyof typeof projectsMessages.en.figures];
      assert.ok(caption.trim().length > 0, `${id}: empty ${locale} caption`);
    }
  }
  // …and no caption is left over for a project that does not exist.
  const ids = new Set(projects.map((project) => project.id));
  for (const id of Object.keys(projectsMessages.en.figures)) assert.ok(ids.has(id), `caption without project: ${id}`);
});

test('stages and start years match what the owner stated', () => {
  const expected: Record<string, { since: string; stage?: string; featured?: string }> = {
    'rocket-up': { since: '2020', featured: 'false' },
    karecik: { since: '2021', stage: 'production', featured: 'true' },
    'acik-matematik': { since: '2023', stage: 'production', featured: 'true' },
    asion: { since: '2024', stage: 'early-access', featured: 'true' },
    novacast: { since: '2025', stage: 'production', featured: 'true' },
  };
  for (const [id, facts] of Object.entries(expected)) {
    const project = projects.find((entry) => entry.id === id);
    assert.ok(project, `missing project ${id}`);
    const fields = frontmatter(project.source);
    assert.equal(fields.get('since'), facts.since, `${id}: since`);
    if (facts.stage) assert.equal(fields.get('stage'), facts.stage, `${id}: stage`);
    if (facts.featured) assert.equal(fields.get('featured'), facts.featured, `${id}: featured`);
  }
  const i18n = projects.find((entry) => entry.id === 'i18n-cpp');
  assert.ok(i18n, 'missing project i18n-cpp');
  assert.equal(frontmatter(i18n.source).get('featured'), 'false');
  assert.equal(frontmatter(i18n.source).get('isOpenSource'), 'true');
});

/** Every string of a catalogue, including the templates inside message functions. */
function catalogueText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'function') return value.toString();
  if (value && typeof value === 'object') return Object.values(value).map(catalogueText).join('\n');
  return '';
}

test('no copy calls the owner an engineer', () => {
  // The word does not appear at all in project copy: his work says developer / built / designed,
  // and Asion's audience is "software teams". (Other people keep their titles elsewhere, e.g. the
  // CCIE guest on the About page.)
  const allowed: RegExp[] = [];
  const scrub = (text: string) => allowed.reduce((rest, pattern) => rest.replace(pattern, ''), text);
  const check = (where: string, text: string, banned: RegExp) => {
    const hit = banned.exec(scrub(text));
    assert.equal(hit, null, `${where}: “…${hit?.input.slice(Math.max(0, hit.index - 40), hit.index + 40)}…”`);
  };

  for (const { name, source } of projects) check(`projects/${name}`, source, /engineer/i);
  check('projects.ts (en)', catalogueText(projectsMessages.en), /engineer/i);
  const turkish = [
    ...enFiles.map((name) => ({ where: `tr/projects/${name}`, text: read(TR_DIR, name) })),
    { where: 'projects.ts (tr)', text: catalogueText(projectsMessages.tr) },
  ];
  for (const { where, text } of turkish) {
    check(where, text, /mühendis/i);
    check(where, text, /engineer/i);
  }
});
