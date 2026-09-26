/**
 * KaTeX in MDX (src/lib/markdown/katex.ts): the plugin hands Sätteri the rendered HTML as a raw
 * string, which MDX re-parses as Markdown. Nothing in the TeX source may be read as Markdown on
 * the way: the MathML annotation (what copy and paste yields) must be the TeX exactly as written.
 * These run formulas through the Sätteri features the site uses for MDX (GFM, smart punctuation,
 * math) and compare every annotation with its source.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { evaluate } from 'satteri';

import { escapeForMdx, katexPlugin } from '../src/lib/markdown/katex.ts';

interface Element {
  type: unknown;
  props: { children?: unknown; [key: string]: unknown };
}

const Fragment = Symbol('Fragment');
const jsx = (type: unknown, props: Element['props']): Element => ({ type, props });

function isElement(node: unknown): node is Element {
  return typeof node === 'object' && node !== null && 'props' in node;
}

function children(node: Element): unknown[] {
  const value = node.props.children;
  return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

/** Resolves function components (the MDX content itself) into element trees. */
function expand(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(expand);
  if (!isElement(node)) return node;
  if (typeof node.type === 'function') return expand((node.type as (props: unknown) => unknown)(node.props));
  return { type: node.type, props: { ...node.props, children: children(node).map(expand) } };
}

function text(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  return isElement(node) ? children(node).map(text).join('') : '';
}

function findAll(node: unknown, match: (element: Element) => boolean): Element[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, match));
  if (!isElement(node)) return [];
  return [...(match(node) ? [node] : []), ...children(node).flatMap((child) => findAll(child, match))];
}

/** The element tree of an MDX document, compiled with the site's MDX features and the plugin. */
function render(source: string): unknown {
  const module = evaluate(source, {
    Fragment,
    jsx,
    jsxs: jsx,
    features: { gfm: true, smartPunctuation: true, math: true },
    mdastPlugins: [katexPlugin],
  }) as { default: (props: unknown) => unknown };
  return expand(module.default({}));
}

const annotations = (tree: unknown) =>
  findAll(tree, (element) => element.type === 'annotation' && element.props.encoding === 'application/x-tex');

/** TeX that contains Markdown syntax: emphasis, strikethrough, links, math, smart punctuation. */
const FORMULAS = [
  // The collision posts' formula: `}_j … \min_` became <em>.
  String.raw`h_j = \max_{\mathbf{a} \in A} \mathbf{n}_j \cdot \mathbf{a} - \min_{\mathbf{b} \in B} \mathbf{n}_j \cdot \mathbf{b}`,
  String.raw`x_1 + x_2 + \cdots + x_n = \sum_{i = 1}^{n} x_i`,
  String.raw`a^* * b^* = (ab)^*`,
  String.raw`a~b~~c~~d`,
  String.raw`[0, 1](x) + \lbrack a \rbrack(b)`,
  String.raw`\text{cost: \$5} -- x... y`,
  String.raw`\{ x : x_1 \le x \le x_2 \}\, \text{and} \; y`,
];

test('display math keeps its TeX annotation exactly as written', () => {
  const found = annotations(render(FORMULAS.map((tex) => `$$\n${tex}\n$$`).join('\n\n')));
  assert.equal(found.length, FORMULAS.length);
  found.forEach((annotation, i) => {
    assert.deepEqual(children(annotation).filter(isElement), [], `markup inside annotation ${i}`);
    assert.equal(text(annotation), FORMULAS[i]);
  });
});

test('inline math keeps its TeX annotation exactly as written', () => {
  const inline = [String.raw`\mathbf{n}_j \cdot \mathbf{a} - \min_{b} \mathbf{n}_j`, String.raw`a_1 * b_2 * c_3`];
  const tree = render(`Before ${inline.map((tex) => `$${tex}$`).join(' and ')} after.`);
  assert.deepEqual(annotations(tree).map(text), inline);
});

test('Markdown around the math still works, and none leaks out of it', () => {
  const tree = render(`$$\n${FORMULAS[0]}\n$$\n\nText with _real emphasis_ and a [link](https://example.com).`);
  assert.deepEqual(findAll(tree, (element) => element.type === 'em').map(text), ['real emphasis']);
  assert.deepEqual(findAll(tree, (element) => element.type === 'a').map(text), ['link']);
  assert.deepEqual(findAll(tree, (element) => element.type === 'code' || element.type === 'del'), []);
});

test('escapeForMdx touches text only, never tags, attributes or entities', () => {
  assert.equal(
    escapeForMdx('<span class="a-b" style="top:-0.5em">x_1 &amp; y</span>'),
    '<span class="a-b" style="top:-0.5em">x&#95;1 &amp; y</span>',
  );
  assert.equal(escapeForMdx(String.raw`<b>\{ a*b \}</b>`), '<b>&#92;{ a&#42;b &#92;}</b>');
});
