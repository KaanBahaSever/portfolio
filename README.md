# kaanbahasever.com

Source of the personal site of **Kaan Baha Sever**, a software developer with a mathematics
background (Istanbul University) who works on systems in C++ and Go. The site has a résumé-style
home page, an About page telling the engineering story, projects, a blog with KaTeX math, two
algorithmic games, an interactive terminal and a set of privacy-friendly browser tools, in
**English and Turkish**.

Live at [kaanbahasever.com](https://kaanbahasever.com).

- **Strictly static**: built with Astro (SSG) into plain HTML, CSS and JS in `dist/`.
- **Bilingual**: English at `/`, Turkish under `/tr/`, with the same slugs. A switch in the
  header moves between the two versions of a page and remembers the choice.
- **No backend, no third-party requests**: fonts, KaTeX and PDF.js are self-hosted; no CDNs,
  analytics or cookies. Tools process files and text entirely in the browser; nothing is
  uploaded. `localStorage` holds only the language choice, the Notepad draft and the console's
  preferences (see [Browser storage](#browser-storage)).
- **Mobile-first**: base styles target phones (320–430 px), with `sm:`/`md:`/`lg:`
  enhancements for larger screens. Touch targets are at least 44×44 px.
- **Light and dark** themes follow the operating system (`prefers-color-scheme`).

## Pages

| Route (EN / TR)                                  | What it is                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| `/` · `/tr/`                                     | Hero, experience, selected work, engineering journey, playground, writing  |
| `/about/` · `/tr/about/`                         | The engineering journey (`#journey`) and a timeline of milestones          |
| `/projects/`, `/projects/<id>/`                  | Curated projects; each has a detail page                                   |
| `/blog/`, `/blog/<id>/`                          | Posts written here or imported from Medium; KaTeX math, Shiki code blocks  |
| `/tools/…`                                       | The tools below                                                            |
| `/games/`, `/games/battleship/`, `/games/tic-tac-toe/` | Battleship and tic-tac-toe against algorithmic opponents             |
| `/console/` · `/tr/console/`                     | A retro terminal for exploring the site (noindex)                          |

## Tools

| Tool               | Route                        | What it does                                                                                   |
| ------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| Images to PDF      | `/tools/images-to-pdf/`      | Photos and scans into one PDF: drag to reorder, page size, orientation and margins; JPEGs kept at original quality, or a smaller file |
| Notepad            | `/tools/notepad/`            | Full-width plain-text editor: zen mode, autosave in this browser, find & replace with regex, live line/word counts, clear and download |
| Split PDF          | `/tools/pdf-split/`          | Page thumbnails (PDF.js); pick pages by clicking or typing ranges like `1-3, 5`; download one PDF, or split into parts as a ZIP |
| Image compressor   | `/tools/image-compressor/`   | JPEG/PNG/WebP re-encoding with a quality slider and format choice, before/after comparison and size statistics |
| Compress PDF       | `/tools/pdf-compress/`       | Re-compresses a PDF's images and cleans out unused objects                                     |
| Password generator | `/tools/password-generator/` | Cryptographically secure passwords with options and a strength estimate                        |

The catalog on `/tools/` is generated from `src/data/tools.ts`; the games index from
`src/data/games.ts`.

## Tech stack

| Area          | Choice                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------- |
| Framework     | [Astro](https://astro.build) 7 (static output, Content Layer API, i18n routing)          |
| Styling       | Tailwind CSS 4 (CSS-first config) + `@tailwindcss/typography`                            |
| Fonts         | IBM Plex Sans, Newsreader, JetBrains Mono (`@fontsource-variable/*`, latin + latin-ext) |
| Content       | Markdown and MDX through Astro's Sätteri engine, validated with Zod schemas              |
| Math and code | KaTeX rendered at build time (a Sätteri plugin), Shiki with dual high-contrast themes    |
| Images        | `astro:assets` (optimized to WebP with responsive `srcset` at build)                     |
| Client code   | Vanilla TypeScript (no UI framework)                                                     |
| PDF tools     | `pdf-lib` in Web Workers; PDF.js (`pdfjs-dist`) for thumbnails, loaded on demand         |
| Reordering    | `sortablejs` (drag and long-press reordering in Images to PDF)                           |
| Tests         | Node's built-in test runner (`node --test`) on TypeScript sources                        |
| Hosting       | Cloudflare Pages (static), built from GitHub on every push to `main`                     |

## Commands

Run from the project root (Node 22.18+, see `.node-version`; the tests run TypeScript directly):

| Command               | Action                                                               |
| --------------------- | -------------------------------------------------------------------- |
| `npm install`         | Install dependencies                                                 |
| `npm run dev`         | Start the dev server at `http://localhost:4321`                      |
| `npm run build`       | Build the production site into `dist/`                               |
| `npm run preview`     | Serve the production build locally                                   |
| `npm run check`       | Type-check `.astro`/`.ts` files and validate content (`astro check`) |
| `npm test`            | Run unit tests in `tests/` with `node --test`                        |
| `npm run sync:medium` | Import Medium stories into the blog (see [Medium](#medium-posts))    |
| `npm run favicons`    | Rebuild the favicon and app icons from `scripts/build-favicons.mjs`  |

## Project structure

```text
/
├── integrations/
│   ├── localized-404.mjs               # Moves /tr/404/ to /tr/404.html after the build
│   └── pdfjs-assets.mjs                # Copies PDF.js wasm/cmaps/fonts to public/vendor/pdfjs/<version>/
├── public/
│   ├── _headers                        # Security + cache headers, noindex for /console/
│   ├── _redirects                      # 301s for retired URLs
│   ├── cv/kaan-cv.pdf                  # CV served by the "Download CV" buttons (English)
│   ├── favicon.svg / favicon.ico / *.png / site.webmanifest   # Generated by npm run favicons
│   └── vendor/                         # Generated, gitignored (PDF.js data files)
├── scripts/
│   ├── build-favicons.mjs              # The brand mark's construction + icon renderer
│   ├── sync-medium.ts                  # Medium RSS → src/content/blog/*.md
│   └── medium/                         # HTML → Markdown conversion used by the sync
├── src/
│   ├── assets/                         # Images optimized at build time (blog, timeline)
│   ├── components/
│   │   ├── layout/                     # Header (nav, language switch, console button), Footer
│   │   ├── ui/                         # Shared kit: styles.ts, Icon, PageHeader, Section, BrandMark,
│   │   │                               # Badge, Tag(List), ProjectCard, PostList, ResumeEntry…
│   │   ├── home/ about/ projects/ blog/ # Page sections and their line-art figures
│   │   ├── tools/ tools-index/         # Tool UIs and the /tools/ hub
│   │   ├── games/                      # Battleship and tic-tac-toe
│   │   └── console/                    # The terminal
│   ├── config/site.ts                  # Name, headline, contact links, navigation
│   ├── content/                        # blog/, projects/, timeline/ (English) and tr/ (Turkish)
│   ├── content.config.ts               # Collection loaders + Zod schemas
│   ├── data/                           # resume.ts, tools.ts, games.ts
│   ├── i18n/
│   │   ├── config.ts                   # Locales, localizePath(), stripLocale(), pick()
│   │   ├── format.ts                   # Locale-aware numbers, bytes, percent, dates, lists
│   │   ├── server.ts / client.ts       # getLocale(Astro), localeStaticPaths(), getPageLocale()
│   │   └── messages/ tools/ games/ console/   # Typed EN/TR message catalogues
│   ├── layouts/BaseLayout.astro        # <html lang>, SEO + hreflang, language script, header/footer
│   ├── lib/                            # Framework-free, unit-tested modules (no DOM):
│   │                                   # console, games, image, markdown (KaTeX), password, pdf,
│   │                                   # text, zip, files, storage
│   ├── pages/
│   │   ├── [...lang]/                  # Every route, built once per locale
│   │   ├── 404.astro                   # English 404
│   │   └── tr/404.astro                # Turkish 404
│   ├── scripts/                        # Client-side controllers: tools/*, games/*, console/
│   ├── styles/global.css               # Tailwind entry, fonts, design tokens, prose/code/math
│   └── utils/                          # Content queries (with Turkish overlays), résumé dates
├── tests/                              # node --test unit tests
└── astro.config.mjs                    # i18n, Markdown (KaTeX, Shiki), Vite settings
```

## Internationalization

- **Routing.** Astro's i18n routing with `prefixDefaultLocale: false`. Every page lives in
  `src/pages/[...lang]/` and exports `getStaticPaths` built with `localeStaticPaths()` (or, for
  `[id]` routes, one path per locale with `langParam(locale)`), so each file builds `/x/` and
  `/tr/x/`. Components read the locale with `getLocale(Astro)`; internal links go through
  `localizePath(path, locale)`. Never hard-code `/tr/`, and never use `en` or `tr` as a slug.
- **Language switch.** The header links to the same page in the other language
  (`BaseLayout`'s `alternates`) and stores an explicit choice in `localStorage`. An inline script
  in `<head>` sends later visits to the stored language before the first paint; without a stored
  choice, a first visit to `/` follows the browser language once. Redirects always target a page
  that exists, so they cannot loop.
- **Messages.** Interface text lives in typed catalogues under `src/i18n/`: write the `en`
  object, type `tr` as `typeof en`, export `{ en, tr }`. Messages with values are functions, so
  plurals and interpolation stay type-checked. Client scripts pick their catalogue with
  `getPageLocale()`. Libraries in `src/lib/` return codes, never prose.
  `tests/i18n-catalogues.test.ts` checks that every catalogue has the same shape in both languages.
- **Formatting.** Use `formatters(locale)` (`src/i18n/format.ts`) for numbers, file sizes
  (`3.4 KB` / `3,4 KB`), percentages (`64%` / `%64`), dates and lists.
- **Turkish style.** Written natively rather than translated word for word; the interface uses
  the polite imperative ("Dosyayı seçin"). Phrase messages so interpolated values need no case
  suffix ("12 sayfa", "“a.pdf” okunamadı").

## Design system

- **Type**: IBM Plex Sans for interface and body (`font-sans`), Newsreader for page and section
  titles (`font-serif`), JetBrains Mono for labels, counters, figures and code (`font-mono`).
- **Colour**: zinc neutrals and one viridian `accent-50…950` scale (defined in `global.css`);
  accent text is `text-accent-700` / `dark:text-accent-400`. Amber for warnings, rose for errors.
- **Geometry**: `bg-graph` / `bg-graph-fine` graph paper with `mask-fade-*`, thin-stroke SVG
  figures in `currentColor` with a single accent node, `label-mono` indices such as "§ 02".
- **Shared classes** for buttons, cards, fields and links live in `src/components/ui/styles.ts`.
- The brand mark (a λ whose strokes meet at an accent node) is constructed in
  `scripts/build-favicons.mjs`; `src/components/ui/BrandMark.astro` must match it.

## Updating personal details

- **Identity, headline, contact links and navigation**: `src/config/site.ts`.
- **Résumé** (experience, education, volunteering, certifications, activities, skills,
  languages): `src/data/resume.ts`, with English and Turkish text side by side. Dates are
  `'YYYY'` or `'YYYY-MM'` strings, or `'present'` as an end date.
- **CV**: replace `public/cv/kaan-cv.pdf` (or change `cvPath` in `src/config/site.ts`).
- **Site URL**: `site` in `astro.config.mjs` and `url` in `src/config/site.ts` (used for
  canonical, hreflang and `og:url` tags).

## Writing content

All content lives in `src/content/` and is validated at build time by the schemas in
`src/content.config.ts`. Invalid frontmatter fails `npm run build` / `npm run check`
with a message pointing at the file and field.

The file name (without extension) is the entry **id** and becomes the URL, for
example `src/content/projects/asion.md` → `/projects/asion/` and `/tr/projects/asion/`.

**Drafts**: every collection accepts `draft: true`. Drafts are shown by `npm run dev` but
excluded from production builds, including the images they reference (see
`src/utils/draft-loader.ts`).

### Projects and timeline: English entry + Turkish overlay

Projects (`src/content/projects/*.md`) and timeline entries (`src/content/timeline/*.md`) are
written in English and own every shared field. Their Turkish translation is a file with the
**same name** in `src/content/tr/projects/` or `src/content/tr/timeline/`, holding only the
translatable fields and the Turkish body:

```yaml
# src/content/projects/asion.md
---
title: Asion
shortDescription: Up to 220 characters, shown on cards. # required
isOpenSource: false # required; true requires repositoryUrl
liveUrl: https://asion.app # optional: https://… URL or a site path such as /tools/pdf-split/
techStack: ['C++', 'Objective-C', 'Go', 'gRPC'] # 1–5 tags: primary languages, plus a protocol or framework only when pivotal
stage: early-access # optional: production | early-access | in-development
since: 2024 # optional, shown as "since 2024"
featured: true # optional: featured projects appear on the home page
order: 1 # optional, lower first
date: 2024-01-01 # required, used for ordering
---

# src/content/tr/projects/asion.md
---
title: Asion
shortDescription: Kartlarda görünen Türkçe özet.
---

Türkçe gövde…
```

Timeline overlays take `title`, an optional `dateLabel` and, if the English entry has photos,
`photos` with the Turkish `alt` and `caption` in the same order. A missing overlay falls back to
English (marked `lang="en"`); an overlay without an English entry fails the build.

### Blog posts: `src/content/blog/*.md` or `*.mdx`

Posts are single-language. Two posts that translate each other share a `translationKey`; a post
without a translation is also listed in the other language's blog (with a language badge) and
points search engines at its own-language page.

```yaml
---
title: An Intuitive Guide to the Abel–Ruffini Theorem # required
description: One or two sentences for lists and SEO. # required
pubDate: 2026-09-25 # required
lang: en # required: en | tr
translationKey: abel-ruffini # optional, shared with the translation
tags: [mathematics, algebra] # optional
heroImage: ../../assets/blog/my-post/01.jpg # optional, relative to this file
heroImageAlt: Describe the image # optional (recommended with heroImage)
relatedProject: acik-matematik # optional, id of a file in src/content/projects/
---
```

**Math**: write `$…$` inline and `$$…$$` (or a ```` ```math ```` fence) for display math; KaTeX
renders it at build time. Write a literal dollar sign as `\$`. After changing
`src/lib/markdown/katex.ts`, run `astro build --force` (Astro caches rendered Markdown).

### Medium posts

`npm run sync:medium` reads the Medium RSS feed (`-- --feed <file>` for a saved copy,
`-- --dry-run` to preview, `-- --force` to re-import) and writes
`src/content/blog/<slug>.md` plus the images in `src/assets/blog/<slug>/`, so nothing is
hot-linked. Imported posts set `source: medium` and a `canonicalUrl` pointing at Medium. Re-runs
keep hand-edited descriptions, alt text and keys the sync does not manage; `mediumSync: false`
freezes a post. Commit the result: the build itself never touches the network. Medium's feed
only lists the latest ten stories.

## Browser storage

Nothing is sent anywhere. `localStorage` holds:

| Key                                                 | Written by                                          |
| --------------------------------------------------- | --------------------------------------------------- |
| `locale`                                            | The header language switch (explicit choices only)  |
| `notepad:v1:text`, `notepad:v1:meta`, `notepad:v1:autosave` | The Notepad's autosave (can be switched off) |
| `kbs-console:font-size`, `kbs-console:phosphor`, `kbs-console:history` | The console's preferences and history |

Every access is wrapped so the site keeps working when storage is blocked or full.

## The console: `/console/`

An interactive terminal (commands in `src/lib/console/`, text in `src/i18n/console/`) with
`help`, `whoami`, `ls`, `cd`, `pwd`, `cat`, `projects`, `clear` and `exit`, history, Tab
completion, adjustable font size and a green or amber phosphor. It is reached from the header's
terminal button, built for both languages, and kept out of search engines by
`<meta name="robots" content="noindex, nofollow">` and an `X-Robots-Tag` header in
`public/_headers`.

## Deployment

The GitHub repository is connected to **Cloudflare Pages** through the Cloudflare GitHub
App, so Cloudflare builds and deploys the site itself — there is no GitHub Actions workflow
and there are no deployment secrets in the repository.

- A push to `main` creates a **production** deployment.
- Pushes to any other branch (and pull requests) create **preview** deployments.

### Cloudflare Pages build settings

| Setting                | Value                                        |
| ---------------------- | -------------------------------------------- |
| Framework preset       | Astro                                        |
| Build command          | `npm run build`                              |
| Build output directory | `dist`                                       |
| Node.js version        | From `.node-version` (22.18.0)               |

Nothing else is required: the site is fully static, and there are no environment variables
or adapters. Missing `/tr/…` URLs get `/tr/404.html` (Cloudflare serves the nearest 404 page).
Before pushing, it is worth running the same checks locally:

```sh
npm test && npm run check && npm run build
```

### Custom domain

`kaanbahasever.com` is attached in the Cloudflare dashboard: **Workers & Pages → the Pages
project → Custom domains**. Keep `site` in `astro.config.mjs` in sync with it.
