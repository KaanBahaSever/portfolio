import { defineCollection, reference } from 'astro:content';
import { glob, type Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { LOCALES } from './i18n/config';
import { withoutDraftsInProduction } from './utils/draft-loader';

/**
 * Drafts (draft: true) are shown by `astro dev` but excluded from production builds.
 * Filtering them in getCollection() alone is not enough: Astro would still bundle a
 * draft's images, so production builds also reduce drafts to placeholders here.
 */
const drafts = (loader: Loader): Loader => withoutDraftsInProduction(loader, import.meta.env.PROD);

/**
 * Bilingual content model
 * - Projects and timeline entries are written in English in src/content/{projects,timeline}/.
 *   Those files own every shared field (dates, links, tech stack, images).
 * - Turkish translations live in src/content/tr/{projects,timeline}/ under the SAME file name
 *   and only carry translatable fields plus the Markdown body. src/utils/content.ts merges
 *   them; an entry without a translation falls back to English (marked lang="en").
 * - Blog posts are single-language: each post declares `lang`. Two posts that translate each
 *   other share a `translationKey`.
 */

/**
 * Blog posts: src/content/blog/*.md|mdx
 * The entry id (file name without extension) becomes the URL: /blog/<id>/ (and /tr/blog/<id>/).
 */
const blog = defineCollection({
  loader: drafts(glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' })),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      /** Language the post is written in. */
      lang: z.enum(LOCALES),
      /** Shared by the English and Turkish versions of the same article. */
      translationKey: z.string().min(1).optional(),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
      heroImage: image().optional(),
      heroImageAlt: z.string().optional(),
      /** Visible caption under the hero image (the Medium sync fills it from the opening figure). */
      heroImageCaption: z.string().optional(),
      relatedProject: reference('projects').optional(),
      /** Where the post was first published. Medium posts are imported by `npm run sync:medium`. */
      source: z.enum(['site', 'medium']).default('site'),
      /** Canonical URL when the original lives elsewhere (e.g. the Medium post). */
      canonicalUrl: z.httpUrl().optional(),
      mediumUrl: z.httpUrl().optional(),
      mediumId: z.string().optional(),
      mediumUpdated: z.coerce.date().optional(),
      /** Set to false to stop `npm run sync:medium` from overwriting hand edits. */
      mediumSync: z.boolean().optional(),
    }),
});

/**
 * Projects: src/content/projects/*.md|mdx -> /projects/<id>/
 *
 * Rule: an open-source project must link its repository.
 * Zod 4 keeps `.superRefine()` on the same ZodObject (refinements are stored as
 * checks instead of wrapping the schema in ZodEffects as Zod 3 did), so Astro
 * accepts the refined schema, and `image()` still works inside it. The issue is
 * attached to `repositoryUrl`, so `astro sync` / `astro build` fail with:
 *   repositoryUrl: Open-source projects need a repositoryUrl ...
 * Closed-source projects may still set repositoryUrl (e.g. a public showcase repo).
 */
const projects = defineCollection({
  loader: drafts(glob({ base: './src/content/projects', pattern: '**/*.{md,mdx}' })),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(1),
        shortDescription: z.string().min(1).max(220),
        isOpenSource: z.boolean(),
        // http(s) only, so frontmatter cannot inject e.g. `javascript:` links.
        repositoryUrl: z.httpUrl().optional(),
        /**
         * Primary languages first; add a protocol or framework only when it is architecturally
         * pivotal (gRPC, MQTT). Keep it to about four tags.
         */
        techStack: z.array(z.string().min(1)).min(1).max(5),
        // Absolute http(s) URL, or a site-relative path such as '/tools/pdf-split/'
        // (protocol-relative '//host' is rejected).
        liveUrl: z
          .union([
            z.httpUrl(),
            z.string().regex(/^\/(?!\/)/, "Use an absolute http(s) URL or a site path starting with '/'"),
          ])
          .optional(),
        /** Lifecycle shown as a badge: in production use, or still being built (early access). */
        stage: z.enum(['production', 'early-access', 'in-development']).optional(),
        /** Year work started, shown as "since 2024". */
        since: z.number().int().min(2000).max(2100).optional(),
        cover: image().optional(),
        coverAlt: z.string().optional(),
        featured: z.boolean().default(false),
        order: z.number().int().default(0),
        date: z.coerce.date(),
        draft: z.boolean().default(false),
      })
      .superRefine((data, ctx) => {
        if (data.isOpenSource && !data.repositoryUrl) {
          ctx.addIssue({
            code: 'custom',
            path: ['repositoryUrl'],
            message:
              'Open-source projects need a repositoryUrl (set isOpenSource: false for private projects).',
          });
        }
      }),
});

/** Turkish overlay for projects: src/content/tr/projects/<same id>.md */
const projectsTr = defineCollection({
  loader: drafts(glob({ base: './src/content/tr/projects', pattern: '**/*.{md,mdx}' })),
  schema: z.object({
    title: z.string().min(1),
    shortDescription: z.string().min(1).max(220),
    coverAlt: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

/**
 * Timeline (About page): src/content/timeline/*.md
 * Photos are local images relative to the entry file, optimized at build time.
 * Drafts (draft: true) are shown by `astro dev` but excluded from production builds,
 * photos included.
 */
const timeline = defineCollection({
  loader: drafts(glob({ base: './src/content/timeline', pattern: '**/*.{md,mdx}' })),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1),
      /** Orders the entries (oldest first); shown as the year unless dateLabel is set. */
      date: z.coerce.date(),
      dateLabel: z.string().optional(),
      photos: z
        .array(
          z.object({
            src: image(),
            alt: z.string().min(1),
            caption: z.string().optional(),
          }),
        )
        .default([]),
      draft: z.boolean().default(false),
    }),
});

/** Turkish overlay for timeline entries: src/content/tr/timeline/<same id>.md */
const timelineTr = defineCollection({
  loader: drafts(glob({ base: './src/content/tr/timeline', pattern: '**/*.{md,mdx}' })),
  schema: z.object({
    title: z.string().min(1),
    dateLabel: z.string().optional(),
    /** Same order and length as the English entry's photos. */
    photos: z.array(z.object({ alt: z.string().min(1), caption: z.string().optional() })).optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, projects, projectsTr, timeline, timelineTr };
