// @ts-check
/**
 * Cloudflare Pages answers a missing URL with the nearest 404.html walking up the path, so a
 * missing /tr/... page should get /tr/404.html. Astro only special-cases src/pages/404.astro;
 * src/pages/tr/404.astro builds to /tr/404/index.html, which this hook moves into place.
 */
import { rename, rm, stat } from 'node:fs/promises';

/**
 * @param {string[]} locales Non-default locales that have a src/pages/<locale>/404.astro.
 * @returns {import('astro').AstroIntegration}
 */
export default function localized404(locales) {
  return {
    name: 'localized-404',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        for (const locale of locales) {
          const built = new URL(`${locale}/404/index.html`, dir);
          const exists = await stat(built).then(
            () => true,
            () => false,
          );
          if (!exists) continue;
          await rename(built, new URL(`${locale}/404.html`, dir));
          await rm(new URL(`${locale}/404/`, dir), { recursive: true, force: true });
          logger.info(`Moved /${locale}/404/ to /${locale}/404.html`);
        }
      },
    },
  };
}
