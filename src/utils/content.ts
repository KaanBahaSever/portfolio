import { getCollection, type CollectionEntry } from 'astro:content';

export type BlogPost = CollectionEntry<'blog'>;
export type Project = CollectionEntry<'projects'>;
export type TimelineEntry = CollectionEntry<'timeline'>;

/** Drafts are visible in `astro dev` but excluded from production builds. */
function isVisible(entry: { data: { draft: boolean } }): boolean {
  return import.meta.env.PROD ? !entry.data.draft : true;
}

/** Published blog posts, newest first. */
export async function getPublishedPosts(): Promise<BlogPost[]> {
  const posts = await getCollection('blog', isVisible);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** Projects sorted by `order` (ascending), then by `date` (newest first). */
export async function getProjects(): Promise<Project[]> {
  const projects = await getCollection('projects', isVisible);
  return projects.sort(
    (a, b) => a.data.order - b.data.order || b.data.date.valueOf() - a.data.date.valueOf(),
  );
}

/** Timeline entries, oldest first. */
export async function getTimeline(): Promise<TimelineEntry[]> {
  const entries = await getCollection('timeline');
  return entries.sort((a, b) => a.data.date.valueOf() - b.data.date.valueOf());
}

/** Published posts whose `relatedProject` points at the given project id, newest first. */
export async function getPostsForProject(projectId: string): Promise<BlogPost[]> {
  const posts = await getPublishedPosts();
  return posts.filter((post) => post.data.relatedProject?.id === projectId);
}

/** True for site-relative paths ('/tools/...'), false for absolute URLs. */
export function isInternalHref(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//');
}
