# kaanbahasever.com

The source of [kaanbahasever.com](https://kaanbahasever.com), the personal site of Kaan Baha
Sever, a software developer in Istanbul with a mathematics background who works on systems in
C++ and Go. It has a résumé-style home page, an About page with his story, projects, a blog,
two algorithmic games, an interactive terminal and a set of browser tools, in English and
Turkish.

- **Static.** Astro builds plain HTML, CSS and JavaScript into `dist/`. There is no backend.
- **Bilingual.** English at `/`, Turkish under `/tr/`, with the same slugs.
- **Self-contained.** Fonts, KaTeX and PDF.js are self-hosted: no CDNs, analytics or cookies.
  The tools run entirely in the browser, and nothing is uploaded.
- **Light and dark.** The theme follows the operating system until the visitor picks one.

## Tech stack

| Area          | Choice                                                                            |
| ------------- | --------------------------------------------------------------------------------- |
| Framework     | [Astro](https://astro.build) 7: static output, content collections, i18n routing  |
| Language      | TypeScript; client scripts are vanilla, with no UI framework                      |
| Styling       | Tailwind CSS 4 and `@tailwindcss/typography`                                      |
| Content       | Markdown and MDX (Astro's Sätteri engine), frontmatter validated with Zod         |
| Math and code | KaTeX rendered at build time, Shiki for code highlighting                         |
| Browser tools | `pdf-lib` in Web Workers, PDF.js (`pdfjs-dist`), `sortablejs`                     |
| Fonts         | IBM Plex Sans, Newsreader and JetBrains Mono from Fontsource                      |
| Tests         | Node's built-in test runner on the TypeScript sources                             |
| Hosting       | Cloudflare Pages                                                                  |

## Getting started

You need Node.js 22.18 or later (pinned in `.node-version`): the tests and scripts run
TypeScript files directly through Node's type stripping.

```sh
git clone https://github.com/KaanBahaSever/portfolio.git
cd portfolio
npm ci
npm run dev        # http://localhost:4321
```

Before pushing, run the tests, the type check and a production build:

```sh
npm test && npm run check && npm run build
```

## Scripts

| Command               | What it does                                                                  |
| --------------------- | ----------------------------------------------------------------------------- |
| `npm run dev`         | Start the dev server                                                          |
| `npm run build`       | Build the production site into `dist/`                                        |
| `npm run preview`     | Serve the production build locally                                            |
| `npm run check`       | Type-check `.astro` and `.ts` files and validate content                      |
| `npm test`            | Run the unit tests in `tests/`                                                |
| `npm run cv`          | Rebuild the English and Turkish CV PDFs in `public/cv/` from the résumé data  |
| `npm run sync:medium` | Import Medium stories into `src/content/blog/`                                |
| `npm run favicons`    | Regenerate the favicon and app icons in `public/`                             |

`npm run cv` prints the PDFs with a local Chrome, Chromium or Edge (set `CHROME_PATH` if none
is found); `npm run cv -- --lang tr` builds one language. `npm run sync:medium -- --dry-run`
shows what an import would change. Commit what these scripts write: the build itself never
touches the network.

## Project structure

```text
.
├── astro.config.mjs        # Site URL, i18n routing, Markdown (KaTeX, Shiki), Vite settings
├── integrations/           # Build hooks: the Turkish 404 page, PDF.js data files
├── public/                 # Static files: headers, redirects, icons, cv/
├── scripts/                # The cv, sync:medium and favicons scripts
├── src/
│   ├── assets/             # Blog images, optimized at build time
│   ├── components/         # Astro components, grouped by page and feature
│   ├── config/site.ts      # Name, contact links, navigation
│   ├── content/            # Blog posts, projects and timeline; Turkish project and timeline text in tr/
│   ├── content.config.ts   # Collection loaders and Zod schemas
│   ├── data/               # Résumé, CV, tools and games data
│   ├── i18n/               # Locale helpers and typed English and Turkish messages
│   ├── layouts/            # BaseLayout: head, SEO, language and theme scripts
│   ├── lib/                # Framework-free logic without the DOM, unit-tested
│   ├── pages/              # Routes: [...lang]/ builds each page once per language
│   ├── scripts/            # Client-side code for the tools, games, console and theme
│   ├── styles/global.css   # Tailwind entry, fonts and design tokens
│   └── utils/              # Content queries and date helpers
└── tests/                  # Unit tests for node --test
```

## Deployment

Cloudflare Pages builds every push to `main` with `npm run build` (Node from `.node-version`)
and serves `dist/`; other branches get preview deployments.
