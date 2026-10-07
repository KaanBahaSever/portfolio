/**
 * The fusion post (src/content/blog/fuzyon-reaktoru.mdx and fusion-reactor.mdx) and its figures
 * (src/components/blog/posts/fusion/): the physics model against reference values, the formulas
 * written in KaTeX against the model, the two languages against each other, the tokamak drawing's
 * promises, and the house rules for Turkish typography and the English voice.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { fusionPostMessages } from '../src/components/blog/posts/fusion/messages.ts';
import {
  NUCLIDES,
  bindingPerNucleon,
  coulombBarrierKev,
  deuteriumPerLitreMg,
  dtReaction,
  ignitionMinimum,
  ignitionTripleProduct,
  kevToKelvin,
  reactivity,
  reactivityPeak,
} from '../src/components/blog/posts/fusion/model.ts';
import { postNumbers } from '../src/components/blog/posts/fusion/numbers.ts';
import { VIEW, WINDOW, paintRuns, tokamakDrawing } from '../src/components/blog/posts/fusion/tokamak.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TR_POST = 'src/content/blog/fuzyon-reaktoru.mdx';
const EN_POST = 'src/content/blog/fusion-reactor.mdx';

const source = (file: string) => readFile(path.join(ROOT, file), 'utf8');

/** The prose of an MDX post: no frontmatter, imports, exports, MDX comments, code or URLs. */
async function prose(file: string): Promise<string> {
  return (await source(file))
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
    .replace(/^(import|export) .*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '')
    .replace(/\]\([^)]*\)/g, ']');
}

function frontmatter(text: string): Record<string, string> {
  const block = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  return Object.fromEntries(
    block.split(/\r?\n/).map((line) => {
      const at = line.indexOf(':');
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    }),
  );
}

/** Every string in a message catalogue, functions called with placeholders. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') return [String((value as (...args: string[]) => string)('X', 'Y', 'Z', 'W'))];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

/** A structural fingerprint: keys, value kinds and function arity, but not the text. */
function shape(value: unknown): unknown {
  if (typeof value === 'function') return `function/${value.length}`;
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, shape(v)]));
  }
  return typeof value;
}

test('binding energies per nucleon match the AME2020 values the post plots', () => {
  // MeV per nucleon, AME2020 (rounded to the third decimal).
  const reference: Record<string, number> = {
    'H-2': 1.112,
    'H-3': 2.827,
    'He-3': 2.573,
    'He-4': 7.074,
    'Li-6': 5.332,
    'Li-7': 5.606,
    'Be-9': 6.463,
    'C-12': 7.68,
    'O-16': 7.976,
    'Ne-20': 8.032,
    'Si-28': 8.448,
    'Ca-40': 8.551,
    'Fe-56': 8.79,
    'Ni-62': 8.795,
    'Kr-84': 8.717,
    'Sn-120': 8.504,
    'Ba-138': 8.393,
    'Pb-208': 7.867,
    'U-235': 7.591,
    'U-238': 7.57,
  };
  assert.deepEqual(NUCLIDES.map((n) => n.id).sort(), Object.keys(reference).sort());
  for (const n of NUCLIDES) {
    assert.ok(Math.abs(bindingPerNucleon(n) - (reference[n.id] ?? 0)) < 0.001, `${n.id}: ${bindingPerNucleon(n)}`);
  }
  // Nickel-62 is the most tightly bound of all, iron-56 a hair below.
  const top = [...NUCLIDES].sort((a, b) => bindingPerNucleon(b) - bindingPerNucleon(a));
  assert.deepEqual(top.slice(0, 2).map((n) => n.id), ['Ni-62', 'Fe-56']);
});

test('D–T: 17.6 MeV from 0.4% of the mass, split 3.5 + 14.1, ten million times coal', () => {
  const dt = dtReaction();
  assert.ok(Math.abs(dt.q - 17.589) < 0.001, `Q = ${dt.q}`);
  assert.deepEqual(dt.rounded, { q: 17.6, alpha: 3.5, neutron: 14.1 });
  // Momentum: the neutron takes m_α / (m_α + m_n) of the energy, about four fifths.
  assert.ok(Math.abs(dt.neutron / dt.q - 0.799) < 0.001);
  assert.ok(Math.abs(dt.defectShare - 0.00375) < 0.00001);
  // 17.6 MeV per 5 u ≈ 3.4 × 10¹⁴ J/kg; coal gives 24–30 MJ/kg.
  assert.ok(Math.abs(dt.perKg / 3.374e14 - 1) < 0.001, `${dt.perKg} J/kg`);
  assert.ok(dt.perKg / 30e6 > 1e7 && dt.perKg / 24e6 < 1.5e7);
});

test('Bosch–Hale reactivities match the published table and put D–T first', () => {
  // Bosch & Hale (1992), Table VIII, in m³/s: D–T at 1 and 10 keV.
  assert.ok(Math.abs(reactivity('dt', 1) / 6.857e-27 - 1) < 0.002);
  assert.ok(Math.abs(reactivity('dt', 10) / 1.136e-22 - 1) < 0.002);
  const peak = reactivityPeak('dt');
  assert.ok(peak.kev > 60 && peak.kev < 70, `peak at ${peak.kev} keV`);
  assert.ok(peak.value > 8.4e-22 && peak.value < 9.2e-22, `peak ${peak.value}`);
  for (const kev of [1, 2, 5, 10, 20, 50, 100]) {
    assert.ok(reactivity('dt', kev) > reactivity('dd', kev) && reactivity('dt', kev) > reactivity('dhe3', kev), `${kev} keV`);
  }
  // D–³He overtakes D–D at high temperature, as the chart shows.
  assert.ok(reactivity('dhe3', 10) < reactivity('dd', 10));
  assert.ok(reactivity('dhe3', 100) > reactivity('dd', 100));
});

test('the ignition curve bottoms out near 14 keV at about 3 × 10²¹ keV·s/m³', () => {
  const minimum = ignitionMinimum();
  assert.ok(minimum.kev > 12 && minimum.kev < 16, `${minimum.kev} keV`);
  assert.ok(minimum.value > 2.5e21 && minimum.value < 3.2e21, `${minimum.value}`);
  assert.ok(ignitionTripleProduct(5) > minimum.value && ignitionTripleProduct(50) > minimum.value);
});

test('unit conversions and the smaller facts the prose states', () => {
  assert.ok(Math.abs(kevToKelvin(1) / 1.1605e7 - 1) < 0.001);
  assert.ok(Math.abs(coulombBarrierKev() - 444) < 1);
  assert.ok(Math.abs(deuteriumPerLitreMg() - 34.8) < 0.1);
  const tr = postNumbers('tr');
  const en = postNumbers('en');
  assert.equal(tr.q, '17,6');
  assert.equal(en.q, '17.6');
  assert.equal(en.neutronShare, '80%');
  assert.equal(tr.neutronShare, '%80');
  assert.equal(en.ignitionKev, '14');
  assert.equal(en.ignitionMillionC, '160');
  assert.equal(en.barrierKev, '440');
  assert.equal(en.dtPeakKev, '67');
  assert.deepEqual([en.coalRatioLow, en.coalRatioHigh], ['11', '14']);
});

test('the formulas written in KaTeX agree with the model', async () => {
  const { rounded } = dtReaction();
  const tr = await source(TR_POST);
  const en = await source(EN_POST);
  const reaction = (decimal: string) =>
    String.raw`\mathrm{D} + \mathrm{T} \longrightarrow {}^{4}\mathrm{He}\ (` +
    `${String(rounded.alpha).replace('.', decimal)}` +
    String.raw`\ \mathrm{MeV}) + \mathrm{n}\ (` +
    `${String(rounded.neutron).replace('.', decimal)}` +
    String.raw`\ \mathrm{MeV})`;
  assert.ok(tr.includes(reaction('{,}')), 'Turkish reaction formula');
  assert.ok(en.includes(reaction('.')), 'English reaction formula');
  for (const text of [tr, en]) {
    assert.ok(text.includes(String.raw`n\, T\, \tau_E \gtrsim 3 \times 10^{21}\ \mathrm{keV \cdot s / m^3}`));
    assert.ok(text.includes(String.raw`10^{20} \cdot 15 \cdot 2 = 3 \times 10^{21}`));
  }
});

test('the two posts translate each other', async () => {
  const tr = await source(TR_POST);
  const en = await source(EN_POST);
  const ftr = frontmatter(tr);
  const fen = frontmatter(en);
  assert.equal(ftr.translationKey, 'fusion-reactor');
  assert.equal(fen.translationKey, 'fusion-reactor');
  assert.equal(ftr.lang, 'tr');
  assert.equal(fen.lang, 'en');
  assert.equal(ftr.pubDate, '2026-10-07');
  assert.equal(fen.pubDate, '2026-10-07');
  const figures = (text: string) => [...text.matchAll(/^<(\w+) lang="(tr|en)"/gm)].map((m) => m[1]);
  assert.deepEqual(figures(tr), figures(en));
  assert.deepEqual(figures(en), ['Tokamak', 'BindingCurve', 'ReactionFigure', 'ReactivityChart', 'LawsonChart']);
  assert.ok([...tr.matchAll(/^<\w+ lang="tr"/gm)].length === 5 && !/lang="en"/.test(tr));
  const headings = (text: string) => [...text.matchAll(/^(#{2,3}) /gm)].map((m) => m[1]);
  assert.deepEqual(headings(tr), headings(en));
  const links = (text: string) => [...text.matchAll(/\]\((https?:[^)]+)\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(links(tr), links(en));
  assert.ok(links(en).length >= 15);
  const formulas = (text: string) => (text.match(/\$\$/g) ?? []).length;
  assert.equal(formulas(tr), formulas(en));
});

test('the status section is dated and the personal hook stays as the owner wrote it', async () => {
  const tr = await prose(TR_POST);
  const en = await prose(EN_POST);
  assert.match(tr, /^## Bugün nerede\? \(Ekim 2026\)$/m);
  assert.match(en, /^## Where does it stand today\? \(October 2026\)$/m);
  assert.match(tr.trim(), /^Füzyonu okumaya 2015’te başladım\. O günden bu yana çok şey değişti\./);
  assert.match(en.trim(), /^I started reading about fusion in 2015, and a lot has changed since then\./);
});

test('the figure catalogues have the same shape in both languages', () => {
  assert.deepEqual(shape(fusionPostMessages.tr), shape(fusionPostMessages.en));
  for (const locale of ['en', 'tr'] as const) {
    for (const text of strings(fusionPostMessages[locale])) assert.ok(text.trim().length > 0, `${locale}: empty text`);
  }
});

/** A straight apostrophe glued to a Turkish suffix: ITER'in, 2015'te, $Q$'nun. */
const STRAIGHT_SUFFIX = /[\p{L}\p{N}$)}]'\p{Ll}/u;

test('Turkish uses the typographic apostrophe and quotes', async () => {
  const text = await prose(TR_POST);
  assert.doesNotMatch(text, STRAIGHT_SUFFIX);
  assert.ok(!/"[^"\n]*"/.test(text.replace(/<[^>]*>/g, '')), 'straight double quotes in the Turkish prose');
  assert.match(text, /2015’te/);
  assert.match(text, /ITER’in/);
  for (const line of strings(fusionPostMessages.tr)) {
    assert.doesNotMatch(line, STRAIGHT_SUFFIX, line);
    assert.ok(!line.includes("'"), line);
  }
});

test('English keeps the house voice: no hype words, no exclamation marks', async () => {
  const banned =
    /\b(passionate|rockstar|ninja|cutting-edge|revolutionary|seamless(ly)?|leverag(e|es|ed|ing)|unlock|empower|delve|game-changer|groundbreaking|breakthrough)\b/i;
  const text = await prose(EN_POST);
  assert.doesNotMatch(text, banned);
  assert.ok(!text.includes('!'), 'exclamation mark in the English post');
  for (const line of strings(fusionPostMessages.en)) {
    assert.doesNotMatch(line, banned, line);
    assert.ok(!line.includes('!'), line);
  }
});

test('the tokamak drawing: a closed, labelled machine that fits the phone crop', () => {
  const drawing = tokamakDrawing();
  // 18 toroidal field coils, 6 of them removed with the slice.
  assert.equal(drawing.coils, 12);
  assert.ok(drawing.fieldLines.length >= 2);
  // Painting order: outside the slice, then the cut faces, then the slice; farthest first within.
  for (let i = 1; i < drawing.faces.length; i++) {
    const a = drawing.faces[i - 1];
    const b = drawing.faces[i];
    assert.ok(a && b);
    assert.ok(a.layer < b.layer || (a.layer === b.layer && a.depth >= b.depth), `face ${i} out of order`);
  }
  assert.ok(drawing.faces.some((face) => face.material === 'cut-plasma'));
  for (const [x, y] of [...drawing.faces.flatMap((face) => face.points), ...drawing.fieldLines.flat()]) {
    assert.ok(x >= 0 && x <= VIEW.width && y >= 0 && y <= VIEW.height);
  }
  for (const [part, [x, y]] of Object.entries(drawing.anchors)) {
    assert.ok(x > 150 && x < 610 && y > 60 && y < 430, part);
  }
  assert.ok(WINDOW.from < -90 && WINDOW.to > 0);
  // The faces become a few hundred paths, not thousands.
  const runs = paintRuns(drawing.faces);
  assert.ok(runs.length < 800, `${runs.length} paths`);
  assert.ok(runs.reduce((sum, run) => sum + run.d.length, 0) < 60_000);
  // Every light level is a tenth between 0 and 1.
  for (const run of runs) assert.ok(run.light >= 0 && run.light <= 1 && Number.isInteger(Math.round(run.light * 10)));
});
