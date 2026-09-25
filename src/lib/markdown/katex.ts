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

function emit(html: string, sourceFormat: SourceFormat) {
  return sourceFormat === 'mdx' ? { raw: html, mdxExpressions: false } : { type: 'html' as const, value: html };
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
