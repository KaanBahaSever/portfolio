/**
 * Sätteri (Astro 7's Markdown engine) plugin that renders LaTeX with KaTeX at build time,
 * so pages ship plain HTML + MathML and no math JavaScript. Registered in astro.config.mjs
 * together with `features.math`, which parses `$inline$`, `$$display$$` and ```math fences.
 *
 * - `.md` output takes an mdast `html` node.
 * - `.mdx` cannot hold raw HTML, so it gets `{ raw, mdxExpressions: false }`, which Sätteri
 *   re-parses into JSX elements.
 * Display math runs in the mdast phase, before Shiki, so it is never highlighted as code.
 *
 * Note: editing this file does not invalidate Astro's cached `.md` renders
 * (node_modules/.astro/data-store.json); run `astro build --force` after changing it.
 * Write a literal dollar sign in prose as `\$`.
 */
import katex from 'katex';
import { defineMdastPlugin, type SourceFormat } from 'satteri';

function render(tex: string, displayMode: boolean): string {
  const html = katex.renderToString(tex, {
    displayMode,
    throwOnError: false,
    output: 'htmlAndMathml',
    strict: 'ignore',
  });
  // A block wrapper lets long equations scroll sideways instead of widening the page.
  return displayMode ? `<div class="math-display">${html}</div>` : html;
}

/**
 * Characters that the Markdown re-parse of MDX raw content would read as syntax: backslash
 * escapes, emphasis (`_`, `*`), code spans, GFM strikethrough (`~`), links and footnotes (`[ ]`),
 * math (`$`), and the dashes and ellipses of smart punctuation (`-`, `.`). KaTeX already writes
 * `& < > " '` as entities, and entities never contain any of these.
 */
const MARKDOWN_SYNTAX = /[\\_*`~[\]$.-]/g;

/**
 * MDX re-parses a raw string as Markdown, text inside the HTML included. So the TeX in the MathML
 * annotation would lose the backslash before punctuation (`\,`, `\;`, and `\{ … \}` would stop
 * compiling) and pick up Markdown: `\mathbf{n}_j … \min_{…}` became `<em>`. In the text between
 * tags, each such character becomes a character reference, which the re-parse turns back into
 * that character and nothing else. Tags and attributes are left alone.
 */
export function escapeForMdx(html: string): string {
  return html.replace(/(^|>)([^<]+)/g, (_match, open: string, text: string) =>
    open + text.replace(MARKDOWN_SYNTAX, (char) => `&#${char.charCodeAt(0)};`),
  );
}

function emit(html: string, sourceFormat: SourceFormat) {
  return sourceFormat === 'mdx'
    ? { raw: escapeForMdx(html), mdxExpressions: false }
    : { type: 'html' as const, value: html };
}

export const katexPlugin = defineMdastPlugin({
  name: 'katex',
  math(node, ctx) {
    return emit(render(node.value, true), ctx.sourceFormat);
  },
  inlineMath(node, ctx) {
    return emit(render(node.value, false), ctx.sourceFormat);
  },
  code(node, ctx) {
    if (node.lang === 'math') return emit(render(node.value, true), ctx.sourceFormat);
    return undefined;
  },
});
