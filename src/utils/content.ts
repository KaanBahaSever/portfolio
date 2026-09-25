import { getCollection, type CollectionEntry } from 'astro:content';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '../i18n/config';

export type BlogPost = CollectionEntry<'blog'>;
export type Project = CollectionEntry<'projects'>;
export type TimelineEntry = CollectionEntry<'timeline'>;

/**
 * Drafts are visible in `astro dev` but excluded from production builds. In production the
 * loaders (src/utils/draft-loader.ts) already reduce drafts to `{ draft: true }` placeholders;
 * this filter keeps those placeholders out of every list.
 */
function isVisible(entry: { data: { draft: boolean } }): boolean {
  return import.meta.env.PROD ? !entry.data.draft : true;
}

/**
 * A translated entry: `data` merges the Turkish overlay onto the English entry, `body` is the
 * entry to pass to render() (the overlay when it exists), and `lang` is the language of the
 * visible text (English when the translation is missing — mark such blocks lang="en").
 */
export interface LocalizedEntry<E extends { data: object }, D = E['data']> {
  id: string;
  data: D;
  body: E | CollectionEntry<'projectsTr'> | CollectionEntry<'timelineTr'>;
  lang: Locale;
  /** The English source entry (for references, images and shared fields). */
  source: E;
}

export type LocalizedProject = LocalizedEntry<Project>;
export type LocalizedTimelineEntry = LocalizedEntry<TimelineEntry>;

/** Projects sorted by `order` (ascending), then by `date` (newest first), in `locale`. */
export async function getProjects(locale: Locale = DEFAULT_LOCALE): Promise<LocalizedProject[]> {
  const projects = (await getCollection('projects', isVisible)).sort(
    (a, b) => a.data.order - b.data.order || b.data.date.valueOf() - a.data.date.valueOf(),
  );
  if (locale === DEFAULT_LOCALE) {
    return projects.map((entry) => ({ id: entry.id, data: entry.data, body: entry, lang: locale, source: entry }));
  }
  const overlays = new Map((await getCollection('projectsTr', isVisible)).map((entry) => [entry.id, entry]));
  assertNoOrphans('projectsTr', overlays, projects);
  return projects.map((entry) => {
    const overlay = overlays.get(entry.id);
    if (!overlay) return { id: entry.id, data: entry.data, body: entry, lang: DEFAULT_LOCALE, source: entry };
    const { title, shortDescription, coverAlt } = overlay.data;
    return {
      id: entry.id,
      data: { ...entry.data, title, shortDescription, coverAlt: coverAlt ?? entry.data.coverAlt },
      body: overlay,
      lang: locale,
      source: entry,
    };
  });
}

/** Timeline entries (drafts only in dev), oldest first, in `locale`. */
export async function getTimeline(locale: Locale = DEFAULT_LOCALE): Promise<LocalizedTimelineEntry[]> {
  const entries = (await getCollection('timeline', isVisible)).sort(
    (a, b) => a.data.date.valueOf() - b.data.date.valueOf(),
  );
  if (locale === DEFAULT_LOCALE) {
    return entries.map((entry) => ({ id: entry.id, data: entry.data, body: entry, lang: locale, source: entry }));
  }
  const overlays = new Map((await getCollection('timelineTr', isVisible)).map((entry) => [entry.id, entry]));
  assertNoOrphans('timelineTr', overlays, entries);
  return entries.map((entry) => {
    const overlay = overlays.get(entry.id);
    if (!overlay) return { id: entry.id, data: entry.data, body: entry, lang: DEFAULT_LOCALE, source: entry };
    const { title, dateLabel, photos } = overlay.data;
    return {
      id: entry.id,
      data: {
        ...entry.data,
        title,
        dateLabel: dateLabel ?? entry.data.dateLabel,
        photos: entry.data.photos.map((photo, index) => ({
          ...photo,
          alt: photos?.[index]?.alt ?? photo.alt,
          caption: photos?.[index]?.caption ?? photo.caption,
        })),
      },
      body: overlay,
      lang: locale,
      source: entry,
    };
  });
}

/** A translation file whose English entry is missing is almost certainly a typo in its file name. */
function assertNoOrphans(collection: string, overlays: Map<string, unknown>, entries: { id: string }[]): void {
  const ids = new Set(entries.map((entry) => entry.id));
  for (const id of overlays.keys()) {
    if (!ids.has(id)) {
      throw new Error(`src/content/tr/${collection.replace('Tr', '')}/${id}: no English entry with this id`);
    }
  }
}

/** All published posts, newest first, in every language. */
export async function getAllPosts(): Promise<BlogPost[]> {
  const posts = await getCollection('blog', isVisible);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/**
 * Posts listed (and given a page) under `locale`, newest first: posts written in that language,
 * plus posts in the other language that have no translation into it. A post that exists in
 * both languages appears once, in the reader's language.
 */
export async function getPublishedPosts(locale: Locale = DEFAULT_LOCALE): Promise<BlogPost[]> {
  const posts = await getAllPosts();
  const translatedKeys = new Set(
    posts.filter((post) => post.data.lang === locale && post.data.translationKey).map((post) => post.data.translationKey),
  );
  return posts.filter(
    (post) =>
      post.data.lang === locale || !post.data.translationKey || !translatedKeys.has(post.data.translationKey),
  );
}

/** The id of `post` as shown under `locale`: its translation when one exists, else the post itself. */
export async function getPostCounterpart(post: BlogPost, locale: Locale): Promise<BlogPost> {
  if (post.data.lang === locale || !post.data.translationKey) return post;
  const posts = await getAllPosts();
  return (
    posts.find((other) => other.data.lang === locale && other.data.translationKey === post.data.translationKey) ??
    post
  );
}

/** For each locale, the posts that get a page there (used by getStaticPaths). */
export async function getPostsByLocale(): Promise<{ locale: Locale; posts: BlogPost[] }[]> {
  return Promise.all(LOCALES.map(async (locale) => ({ locale, posts: await getPublishedPosts(locale) })));
}

/** Published posts whose `relatedProject` points at the given project id, in `locale`. */
export async function getPostsForProject(projectId: string, locale: Locale = DEFAULT_LOCALE): Promise<BlogPost[]> {
  const posts = await getPublishedPosts(locale);
  return posts.filter((post) => post.data.relatedProject?.id === projectId);
}

/** True for site-relative paths ('/tools/...'), false for absolute URLs. */
export function isInternalHref(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//');
}

