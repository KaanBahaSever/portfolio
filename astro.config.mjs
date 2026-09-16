// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  // TODO: set your production URL. It is required for canonical URLs and
  // og:url tags (BaseLayout only emits them when `site` is set) and for a
  // future sitemap/RSS feed. Keep it in sync with SITE.url in src/config/site.ts.
  // site: 'https://example.com',

  // Pure static output (no adapter): `astro build` writes everything to dist/.
  vite: {
    plugins: [tailwindcss()],
    // Dev only: pdf-lib is imported solely by the lazily created PDF worker, so Vite would
    // discover it on the first "Generate PDF" and reload the page (losing the chosen images).
    optimizeDeps: { include: ['pdf-lib'] },
    build: {
      // pdf-lib (~515 kB minified, ~205 kB gzip) only ships in the PDF Web Worker,
      // which /tools/images-to-pdf/ creates when the user clicks "Generate PDF",
      // so that lazily loaded bundle may exceed Vite's 500 kB default.
      chunkSizeWarningLimit: 600,
      rolldownOptions: {
        onwarn(warning, defaultHandler) {
          // Astro 7 marks every MDX content entry with a "use astro:head-inject"
          // directive that Astro never reads back after bundling, so Vite 8's
          // MODULE_LEVEL_DIRECTIVE warning about it is noise. Everything else is reported.
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('astro:head-inject')) {
            return;
          }
          defaultHandler(warning);
        }
      }
    }
  },

  integrations: [mdx()]
});
