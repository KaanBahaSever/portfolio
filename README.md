# Portfolio

A personal portfolio, blog and a set of small, privacy-friendly utilities.

- **Strictly static**: built with Astro (SSG) into plain HTML, CSS and JS in `dist/`.
- **No backend, no third-party requests**: no web fonts, CDNs or analytics. Tools
  process files entirely in the browser; nothing is uploaded.
- **Mobile-first**: base styles target phones (320–430 px), with `sm:`/`md:`/`lg:`
  enhancements for larger screens. Touch targets are at least 44×44 px.
- **Light and dark** themes follow the operating system (`prefers-color-scheme`).

## Tech stack

| Area               | Choice                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| Framework          | [Astro](https://astro.build) 7 (static output, Content Layer API)      |
| Styling            | Tailwind CSS 4 (CSS-first config) + `@tailwindcss/typography`          |
| Content            | Markdown and MDX (`@astrojs/mdx`), validated with Zod schemas          |
| Images             | `astro:assets` (optimized to WebP with responsive `srcset` at build)   |
| Client code        | Vanilla TypeScript (no UI framework)                                   |
| Images → PDF tool  | `pdf-lib`, `sortablejs`                                                |
| Tests              | Node's built-in test runner (`node --test`) on TypeScript sources      |
| Hosting            | Cloudflare Pages (static)                                              |

## Commands

Run from the project root (Node 22.18+, see `.node-version`; the tests run TypeScript directly):

| Command           | Action                                                        |
| ----------------- | ------------------------------------------------------------- |
| `npm install`     | Install dependencies                                          |
| `npm run dev`     | Start the dev server at `http://localhost:4321`               |
| `npm run build`   | Build the production site into `dist/`                        |
| `npm run preview` | Serve the production build locally                            |
| `npm run check`   | Type-check `.astro`/`.ts` files and validate content (`astro check`) |
| `npm test`        | Run unit tests in `tests/` with `node --test`                 |

## Project structure

```text
/
├── public/
│   ├── _headers                      # Cloudflare Pages security + cache headers
│   ├── cv/kaan-cv.pdf                # CV served by the "Download CV" button
│   ├── favicon.ico
│   └── favicon.svg
├── src/
│   ├── assets/                       # Images optimized at build time
│   │   ├── blog/
│   │   └── timeline/
│   ├── components/
│   │   ├── layout/                   # Header (nav), Footer
│   │   ├── tools/
│   │   │   └── ImagesToPdf.astro     # Images-to-PDF tool UI
│   │   └── ui/                       # Badge, Tag, TagList, FormattedDate, Icon, PostList, ProjectCard
│   ├── config/site.ts                # Name, role, links, navigation (edit me)
│   ├── content/
│   │   ├── blog/                     # *.md / *.mdx posts
│   │   ├── projects/                 # *.md / *.mdx projects
│   │   └── timeline/                 # *.md entries for the About page
│   ├── content.config.ts             # Collection loaders + Zod schemas
│   ├── data/tools.ts                 # Tool catalog (ready / planned)
│   ├── layouts/BaseLayout.astro      # <html> shell, SEO meta, header/main/footer
│   ├── lib/                          # Framework-free, unit-tested modules
│   │   ├── download.ts
│   │   ├── files/
│   │   ├── image/
│   │   └── pdf/
│   ├── pages/
│   │   ├── index.astro               # Home (resume-style)
│   │   ├── about.astro               # Intro + timeline
│   │   ├── blog/                     # index + [id]
│   │   ├── projects/                 # index + [id]
│   │   ├── tools/
│   │   │   ├── index.astro           # Tool catalog
│   │   │   └── images-to-pdf.astro   # Images-to-PDF tool page
│   │   ├── console.astro             # Placeholder
│   │   └── 404.astro
│   ├── scripts/tools/images-to-pdf/  # Client-side TypeScript for the tool
│   ├── styles/global.css             # Tailwind entry + base styles
│   └── utils/content.ts              # Collection query helpers
├── tests/                            # node --test unit tests
├── astro.config.mjs
├── .node-version
└── package.json
```

## Personalizing

1. Edit `src/config/site.ts` (every placeholder is marked `TODO`).
2. To update the CV, replace `public/cv/kaan-cv.pdf` (or change `cvPath` in `src/config/site.ts`).
3. Set `site` in `astro.config.mjs` to your production URL (enables canonical and `og:url` tags).
4. Replace the sample content in `src/content/` and the placeholder images in `src/assets/`.

## Writing content

All content lives in `src/content/` and is validated at build time by the schemas in
`src/content.config.ts`. Invalid frontmatter fails `npm run build` / `npm run check`
with a message pointing at the file and field.

The file name (without extension) is the entry **id** and becomes the URL, for
example `src/content/blog/my-post.md` → `/blog/my-post/`. Keep entries directly in
their collection folder (no sub-folders), because the routes are single-segment `[id]`.

Drafts (`draft: true`) are shown by `npm run dev` but excluded from production builds.

### Blog posts: `src/content/blog/*.md` or `*.mdx`

```yaml
---
title: Building an images-to-PDF tool # required
description: One or two sentences for lists and SEO. # required
pubDate: 2026-09-10 # required
updatedDate: 2026-09-12 # optional
tags: [astro, typescript] # optional, default []
draft: false # optional, default false
heroImage: ../../assets/blog/my-hero.png # optional, relative to this file
heroImageAlt: Describe the image # optional (recommended with heroImage)
relatedProject: images-to-pdf # optional, id of a file in src/content/projects/
---
```

Use `.mdx` when you want to import components or use JSX expressions
(see `hello-world.mdx`).

### Projects: `src/content/projects/*.md` or `*.mdx`

```yaml
---
title: Images to PDF # required
shortDescription: Up to 200 characters, shown on cards. # required
isOpenSource: true # required
repositoryUrl: https://github.com/your-username/portfolio # required when isOpenSource is true
liveUrl: /tools/images-to-pdf/ # optional: https://… URL or a site path starting with /
techStack: [Astro, TypeScript] # required, at least one item
cover: ../../assets/projects/cover.png # optional
coverAlt: Describe the image # optional
featured: true # optional, default false (featured projects appear on the home page)
order: 1 # optional, default 0 (lower first, then newest date)
date: 2026-09-01 # required
draft: false # optional, default false
---
```

**`isOpenSource` ⇒ `repositoryUrl`**: when `isOpenSource: true`, `repositoryUrl` is
mandatory and the build fails without it:

```text
repositoryUrl: Open-source projects need a repositoryUrl (set isOpenSource: false for private projects).
```

Private projects (`isOpenSource: false`) show a "Private" badge. They may still set a
`repositoryUrl`, for example a public showcase repository.

### Timeline (About page): `src/content/timeline/*.md`

Entries are sorted by `date` (oldest first). A numeric file-name prefix
(`01-…`, `02-…`) is optional and only keeps the folder tidy.

```yaml
---
title: My first website # required
date: 2011-03-01 # required, used for ordering
dateLabel: Teenage years # optional, shown instead of the year
photos: # optional, default []
  - src: ../../assets/timeline/first-website-1.png # relative to this file
    alt: Screenshot of my first website # required
    caption: A very colorful homepage # optional
---

A short Markdown story for this moment.
```

## Deploying to Cloudflare Pages

Create a Pages project connected to the repository with:

| Setting                | Value                                            |
| ---------------------- | ------------------------------------------------ |
| Framework preset       | Astro                                            |
| Build command          | `npm run build`                                  |
| Build output directory | `dist`                                           |
| Node.js version        | Read from `.node-version` (22.18.0)              |

No adapter or environment variables are required. `public/_headers` adds security
headers to every response and long-lived caching for fingerprinted files in `/_astro/`.
Unknown URLs are served `dist/404.html`.
