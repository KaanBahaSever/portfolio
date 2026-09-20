# kaanbahasever.com

Source of the personal site of **Kaan Baha Sever**, a software developer and mathematics
student at Istanbul University: a résumé-style home page, an About timeline, projects, a
blog and a set of small, privacy-friendly tools.

Live at [kaanbahasever.com](https://kaanbahasever.com).

- **Strictly static**: built with Astro (SSG) into plain HTML, CSS and JS in `dist/`.
- **No backend, no third-party requests**: no web fonts, CDNs, analytics, cookies or
  browser storage. Tools process files and text entirely in the browser; nothing is uploaded.
- **Mobile-first**: base styles target phones (320–430 px), with `sm:`/`md:`/`lg:`
  enhancements for larger screens. Touch targets are at least 44×44 px.
- **Light and dark** themes follow the operating system (`prefers-color-scheme`).

## Tools

| Tool               | Route                         | What it does                                                                   |
| ------------------ | ----------------------------- | ------------------------------------------------------------------------------ |
| Images to PDF      | `/tools/images-to-pdf/`       | Combine images into one PDF; reorder pages, page size, margins, quality modes  |
| Notepad            | `/tools/notepad/`             | Plain-text editor with find & replace, live counts and Save As any extension   |
| Password generator | `/tools/password-generator/`  | Cryptographically secure passwords with options and a strength estimate        |
| Split PDF          | `/tools/pdf-split/`           | Extract pages or split into ranges / every N pages; ZIP for multiple files     |
| Compress PDF       | `/tools/pdf-compress/`        | Re-compress images and clean out unused objects                                |
| Rich text editor   | `/tools/rich-text-editor/`    | Planned (shown as "Coming soon")                                               |

The catalog on `/tools/` is generated from `src/data/tools.ts`.

## Tech stack

| Area          | Choice                                                                          |
| ------------- | ------------------------------------------------------------------------------- |
| Framework     | [Astro](https://astro.build) 7 (static output, Content Layer API)               |
| Styling       | Tailwind CSS 4 (CSS-first config) + `@tailwindcss/typography`                   |
| Content       | Markdown and MDX (`@astrojs/mdx`), validated with Zod schemas                   |
| Images        | `astro:assets` (optimized to WebP with responsive `srcset` at build)            |
| Client code   | Vanilla TypeScript (no UI framework)                                            |
| PDF tools     | `pdf-lib`, loaded only when a tool starts working (Web Workers)                 |
| Reordering    | `sortablejs`                                                                    |
| Tests         | Node's built-in test runner (`node --test`) on TypeScript sources               |
| Hosting       | Cloudflare Pages (static), built from GitHub on every push to `main`            |

## Commands

Run from the project root (Node 22.18+, see `.node-version`; the tests run TypeScript directly):

| Command           | Action                                                               |
| ----------------- | -------------------------------------------------------------------- |
| `npm install`     | Install dependencies                                                 |
| `npm run dev`     | Start the dev server at `http://localhost:4321`                      |
| `npm run build`   | Build the production site into `dist/`                               |
| `npm run preview` | Serve the production build locally                                   |
| `npm run check`   | Type-check `.astro`/`.ts` files and validate content (`astro check`) |
| `npm test`        | Run unit tests in `tests/` with `node --test`                        |

## Project structure

```text
/
├── public/
│   ├── _headers                        # Security + cache headers, noindex for /console/
│   ├── cv/kaan-cv.pdf                  # CV served by the "Download CV" buttons
│   ├── favicon.ico
│   └── favicon.svg
├── src/
│   ├── assets/timeline/                # Images optimized at build time
│   ├── components/
│   │   ├── layout/                     # Header (nav), Footer
│   │   ├── tools/                      # ImagesToPdf, Notepad, PasswordGenerator, PdfSplit, PdfCompress
│   │   └── ui/                         # Badge, Tag, TagList, Icon, FormattedDate, PostList,
│   │                                   # ProjectCard, ResumeEntry, Section
│   ├── config/site.ts                  # Name, role, contact links, navigation
│   ├── content/
│   │   ├── blog/                       # *.md / *.mdx posts
│   │   ├── projects/                   # *.md / *.mdx projects
│   │   └── timeline/                   # *.md entries for the About page
│   ├── content.config.ts               # Collection loaders + Zod schemas
│   ├── data/
│   │   ├── resume.ts                   # Experience, education, volunteering, skills, languages
│   │   └── tools.ts                    # Tool catalog (ready / planned)
│   ├── layouts/BaseLayout.astro        # <html> shell, SEO meta, header/main/footer
│   ├── lib/                            # Framework-free, unit-tested modules (no DOM)
│   │   ├── download.ts                 # saveBlob()
│   │   ├── files/                      # File names, sizes, Save As helpers
│   │   ├── image/                      # Format sniffing, JPEG/EXIF parsing, ICC profiles
│   │   ├── password/                   # Password generation + strength estimate
│   │   ├── pdf/
│   │   │   ├── page-layout.ts          # Images to PDF: page size / placement maths
│   │   │   ├── build-images-pdf.ts     # Images to PDF: PDF builder
│   │   │   ├── page-ranges.ts          # Split PDF: page range parsing
│   │   │   ├── xref-trailer.ts         # Split/Compress PDF: pdf-lib xref-stream trailer fix
│   │   │   ├── split-pdf.ts            # Split PDF: splitting
│   │   │   └── compress/               # Compress PDF: image re-compression and clean-up
│   │   ├── text/                       # Notepad: search/replace and text statistics
│   │   └── zip/                        # ZIP writer for multi-file downloads
│   ├── pages/
│   │   ├── index.astro                 # Home (résumé-style)
│   │   ├── about.astro                 # Intro + timeline
│   │   ├── blog/                       # index + [id]
│   │   ├── projects/                   # index + [id]
│   │   ├── tools/
│   │   │   ├── index.astro             # Tool catalog
│   │   │   ├── images-to-pdf.astro
│   │   │   ├── notepad.astro
│   │   │   ├── password-generator.astro
│   │   │   ├── pdf-split.astro
│   │   │   └── pdf-compress.astro
│   │   ├── console.astro               # Hidden route (not linked, noindex)
│   │   └── 404.astro
│   ├── scripts/tools/                  # Client-side TypeScript, one folder per tool:
│   │                                   # images-to-pdf, notepad, password-generator, pdf-split, pdf-compress
│   ├── styles/global.css               # Tailwind entry + base styles
│   └── utils/
│       ├── content.ts                  # Collection query helpers (draft filtering, sorting)
│       ├── draft-loader.ts             # Strips drafts (and their images) from production builds
│       └── resume-dates.ts             # Résumé date formatting and sorting
├── tests/                              # node --test unit tests
├── astro.config.mjs                    # site: https://kaanbahasever.com
├── .node-version
└── package.json
```

## Updating personal details

- **Identity, contact links and navigation**: `src/config/site.ts`.
- **Résumé** (experience, education, volunteering, certifications, activities, skills,
  languages): `src/data/resume.ts`. Dates are `'YYYY'` or `'YYYY-MM'` strings, or
  `'present'` as an end date. The home page renders everything from this file.
- **CV**: replace `public/cv/kaan-cv.pdf` (or change `cvPath` in `src/config/site.ts`).
- **Site URL**: `site` in `astro.config.mjs` and `url` in `src/config/site.ts` (used for
  canonical and `og:url` tags).

## Writing content

All content lives in `src/content/` and is validated at build time by the schemas in
`src/content.config.ts`. Invalid frontmatter fails `npm run build` / `npm run check`
with a message pointing at the file and field.

The file name (without extension) is the entry **id** and becomes the URL, for
example `src/content/blog/my-post.md` → `/blog/my-post/`. Keep entries directly in
their collection folder (no sub-folders), because the routes are single-segment `[id]`.

**Drafts**: every collection (blog, projects, timeline) accepts `draft: true`. Drafts are
shown by `npm run dev` but excluded from production builds, so work in progress (for
example `projects/asion.md`, `timeline/00-childhood.md` or the MDX example
`blog/hello-world.mdx`) never reaches the live site. That includes the images a draft
references: in production the loaders in `src/content.config.ts` reduce each draft to a
`{ draft: true }` placeholder (see `src/utils/draft-loader.ts`), so its photos, cover or
hero image are not bundled. An image that a published entry also uses is still shipped.

### Blog posts: `src/content/blog/*.md` or `*.mdx`

```yaml
---
title: Building an images-to-PDF tool # required
description: One or two sentences for lists and SEO. # required
pubDate: 2026-09-10 # required
updatedDate: 2026-09-12 # optional
tags: [typescript, pdf] # optional, default []
draft: false # optional, default false
heroImage: ../../assets/blog/my-hero.png # optional, relative to this file
heroImageAlt: Describe the image # optional (recommended with heroImage)
relatedProject: images-to-pdf # optional, id of a file in src/content/projects/
---
```

Use `.mdx` when you want to import components or use JSX expressions
(see the draft `hello-world.mdx`). The blog index and the home page handle having no
published posts.

### Projects: `src/content/projects/*.md` or `*.mdx`

```yaml
---
title: Açık Matematik # required
shortDescription: Up to 200 characters, shown on cards. # required
isOpenSource: true # required
repositoryUrl: https://github.com/KaanBahaSever/acik-matematik # required when isOpenSource is true
liveUrl: https://acik-matematik.com # optional: https://… URL or a site path such as /tools/images-to-pdf/
techStack: [Quarto, Python] # required, at least one item
cover: ../../assets/projects/cover.png # optional
coverAlt: Describe the image # optional
featured: true # optional, default false (the first 4 featured projects appear on the home page)
order: 1 # optional, default 0 (lower first, then newest date)
date: 2026-06-02 # required
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
(`01-…`, `02-…`) is optional and only keeps the folder tidy. When only a year or a range
is known, set `dateLabel` for display and pick a `date` that sorts the entry correctly.

```yaml
---
title: Mathematics at Istanbul University # required
date: 2019-11-01 # required, used for ordering
dateLabel: November 2019 # optional, shown instead of the year
draft: false # optional, default false
photos: # optional, default []
  - src: ../../assets/timeline/my-photo.jpg # relative to this file
    alt: Describe what the photo shows # required
    caption: Optional caption # optional
---

A short Markdown story for this moment.
```

`timeline/00-childhood.md` is a draft with instructions for adding the childhood story and
old photos.

## Hidden route: `/console/`

`src/pages/console.astro` is built at `/console/` but is intentionally **not linked**
anywhere (it is not in the navigation, footer or 404 page). It is kept out of search
engines by `<meta name="robots" content="noindex, nofollow">` (the `noindex` prop of
`BaseLayout`) and an `X-Robots-Tag: noindex, nofollow` header in `public/_headers`.
There is deliberately no `robots.txt` entry for it, because that would advertise the URL.

## Deployment

The GitHub repository is connected to **Cloudflare Pages** through the Cloudflare GitHub
App, so Cloudflare builds and deploys the site itself — there is no GitHub Actions workflow
and there are no deployment secrets in the repository.

- A push to `main` creates a **production** deployment.
- Pushes to any other branch (and pull requests) create **preview** deployments.

### Cloudflare Pages build settings

| Setting              | Value                                        |
| -------------------- | -------------------------------------------- |
| Framework preset     | Astro                                        |
| Build command        | `npm run build`                              |
| Build output directory | `dist`                                     |
| Node.js version      | From `.node-version` (22.18.0)               |

Nothing else is required: the site is fully static, and there are no environment variables
or adapters. Before pushing, it is worth running the same checks locally:

```sh
npm test && npm run check && npm run build
```

### Custom domain

`kaanbahasever.com` is attached in the Cloudflare dashboard: **Workers & Pages → the Pages
project → Custom domains**. Keep `site` in `astro.config.mjs` in sync with it.

No adapter or build-time environment variables are required. `public/_headers` adds
security headers to every response, long-lived caching for fingerprinted files in
`/_astro/` and `noindex` for `/console/`. Unknown URLs are served `dist/404.html`.
