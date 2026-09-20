import type { Loader } from 'astro/loaders';

/**
 * Wraps a collection loader so that production builds keep nothing of a draft
 * (`draft: true`) except a `{ draft: true }` placeholder under the same id.
 *
 * Why: Astro bundles the images of every entry in the content store (its generated
 * asset-import module is rebuilt from all stored entries), so filtering drafts later
 * with getCollection() still published their photos, covers and hero images under
 * /_astro/. The placeholder has no file path, body, rendered HTML or images, so none
 * of that reaches the build, but its id stays resolvable: a reference to a draft (e.g.
 * a post's `relatedProject`) still passes Astro's reference check, and pages skip it
 * because `data.draft` is true. It also has no digest, so the next sync re-reads the file.
 *
 * Pages must still filter drafts (see src/utils/content.ts); in production their
 * entries only carry `data.draft`.
 */
export function withoutDraftsInProduction(inner: Loader, production: boolean): Loader {
  if (!production) return inner;
  return {
    ...inner,
    load: async (context) => {
      await inner.load(context);
      const { store } = context;
      // values() returns a snapshot, so replacing entries while looping is safe.
      for (const entry of store.values()) {
        if (entry.data.draft !== true) continue;
        // delete() marks Astro's asset and module import lists dirty, so they are
        // regenerated without this draft's images and content module.
        store.delete(entry.id);
        store.set({ id: entry.id, data: { draft: true } });
      }
    },
  };
}
