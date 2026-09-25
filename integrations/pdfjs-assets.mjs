// @ts-check
/**
 * Serves PDF.js's runtime data files (wasm decoders, CMaps, standard fonts, ICC profiles)
 * from our own origin at /vendor/pdfjs/<version>/. PDF.js builds these URLs by string
 * concatenation (`${wasmUrl}jbig2.wasm`), so they cannot go through Vite's hashed imports.
 * Without them, scanned black-and-white PDFs (JBIG2/CCITT) render as blank thumbnails.
 *
 * The files are copied into public/vendor/pdfjs/ (gitignored) whenever `astro dev` or
 * `astro build` starts, so both serve them; the versioned folder is cached as immutable
 * (public/_headers). Client code reads the same version from `pdfjs.version`.
 */
import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FOLDERS = ['wasm', 'cmaps', 'standard_fonts', 'iccs'];
/** PDF.js scripting (JavaScript inside PDFs) is disabled, so its engine is not shipped. */
const SKIP = /^quickjs-eval\./;

/** @returns {import('astro').AstroIntegration} */
export default function pdfjsAssets() {
  return {
    name: 'pdfjs-assets',
    hooks: {
      'astro:config:setup': async ({ config, logger }) => {
        const require = createRequire(import.meta.url);
        const pkgPath = require.resolve('pdfjs-dist/package.json');
        const { version } = JSON.parse(await readFile(pkgPath, 'utf8'));
        const source = dirname(pkgPath);
        const vendorRoot = join(fileURLToPath(config.publicDir), 'vendor', 'pdfjs');
        const target = join(vendorRoot, version);

        const exists = await stat(join(target, 'wasm', 'jbig2.wasm')).then(
          () => true,
          () => false,
        );
        if (exists) return;

        // Drop folders of older PDF.js versions, then copy the current one.
        await rm(vendorRoot, { recursive: true, force: true });
        await mkdir(target, { recursive: true });
        for (const folder of FOLDERS) {
          await cp(join(source, folder), join(target, folder), {
            recursive: true,
            filter: (path) => !SKIP.test(path.split(/[\\/]/).pop() ?? ''),
          });
        }
        logger.info(`Copied PDF.js ${version} data files to public/vendor/pdfjs/${version}/`);
      },
    },
  };
}
