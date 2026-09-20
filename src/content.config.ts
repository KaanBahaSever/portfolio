import { defineCollection, reference } from 'astro:content';
import { glob, type Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { withoutDraftsInProduction } from './utils/draft-loader';

/**
 * Drafts (draft: true) are shown by `astro dev` but excluded from production builds.
 * Filtering them in getCollection() alone is not enough: Astro would still bundle a
 * draft's images, so production builds also reduce drafts to placeholders here.
 */
const drafts = (loader: Loader): Loader => withoutDraftsInProduction(loader, import.meta.env.PROD);

/**
 * Blog posts: src/content/blog/*.md|mdx
 * The entry id (file name without extension) becomes the URL: /blog/<id>/
 */
const blog = defineCollection({
  loader: drafts(glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' })),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
      heroImage: image().optional(),
      heroImageAlt: z.string().optional(),
      relatedProject: reference('projects').optional(),
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
        shortDescription: z.string().min(1).max(200),
        isOpenSource: z.boolean(),
        // http(s) only, so frontmatter cannot inject e.g. `javascript:` links.
        repositoryUrl: z.httpUrl().optional(),
        techStack: z.array(z.string().min(1)).min(1),
        // Absolute http(s) URL, or a site-relative path such as '/tools/images-to-pdf/'
        // (protocol-relative '//host' is rejected).
        liveUrl: z
          .union([
            z.httpUrl(),
            z.string().regex(/^\/(?!\/)/, "Use an absolute http(s) URL or a site path starting with '/'"),
          ])
          .optional(),
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

export const collections = { blog, projects, timeline };
