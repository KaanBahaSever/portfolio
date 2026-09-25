// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import { satteri } from '@astrojs/markdown-satteri';
import { katexPlugin } from './src/lib/markdown/katex';
import localized404 from './integrations/localized-404.mjs';
import pdfjsAssets from './integrations/pdfjs-assets.mjs';

// https://astro.build/config
export default defineConfig({
  // Production URL: required for canonical URLs, hreflang alternates and og:url tags
  // (BaseLayout only emits them when `site` is set) and for a future sitemap/RSS feed.
  // Keep it in sync with SITE.url in src/config/site.ts.
  site: 'https://kaanbahasever.com',

  // English at the root, Turkish under /tr/. Every page lives in src/pages/[...lang]/ and
  // builds once per locale (see localeStaticPaths() in src/i18n/server.ts). No `fallback`:
  // in a static build it would emit redirect pages. Keep in sync with src/i18n/config.ts.
  i18n: {
    locales: ['en', 'tr'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },

  markdown: {
    // Astro 7's Rust Markdown engine (Sätteri). `math` parses $…$, $$…$$ and ```math, and the
    // KaTeX plugin renders it to HTML + MathML at build time. MDX inherits all of this.
    processor: satteri({ features: { math: true }, mdastPlugins: [katexPlugin] }),
    // Dual themes: colours are CSS variables, switched by prefers-color-scheme in global.css.
    // The high-contrast GitHub themes keep every token at WCAG AA (≥ 4.5:1) on our code
    // backgrounds; the regular ones drop to about 3.5:1 for some tokens.
    shikiConfig: {
      themes: { light: 'github-light-high-contrast', dark: 'github-dark-high-contrast' },
      defaultColor: false,
    },
  },

  // Pure static output (no adapter): `astro build` writes everything to dist/.
  vite: {
    plugins: [tailwindcss()],
    // Dev only: pdf-lib is imported solely by the lazily created Split/Compress PDF workers and
    // PDF.js by the lazily loaded Split PDF thumbnails, so Vite would discover them on first use
    // and reload the page (losing the chosen file).
    optimizeDeps: { include: ['pdf-lib', 'pdfjs-dist/legacy/build/pdf.mjs'] },
    build: {
      // pdf-lib (~515 kB minified) ships in each PDF worker and PDF.js (~520 kB) in the lazily
      // loaded thumbnail chunk, so those bundles may exceed Vite's 500 kB default.
      chunkSizeWarningLimit: 1400,
      // Never inline fonts as data: URLs (some small subsets would be); keep them cacheable files.
      assetsInlineLimit: (filePath) => (/\.(woff2?|ttf)$/.test(filePath) ? false : undefined),
      rolldownOptions: {
        onwarn(warning, defaultHandler) {
          // Astro 7 marks every MDX content entry with a "use astro:head-inject"
          // directive that Astro never reads back after bundling, so Vite 8's
          // MODULE_LEVEL_DIRECTIVE warning about it is noise. Everything else is reported.
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('astro:head-inject')) {
            return;
          }
          defaultHandler(warning);
        },
      },
    },
  },

  integrations: [mdx(), pdfjsAssets(), localized404(['tr'])],
});
