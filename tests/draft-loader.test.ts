import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Loader, LoaderContext } from 'astro/loaders';
import { withoutDraftsInProduction } from '../src/utils/draft-loader.ts';

type Entry = {
  id: string;
  data: Record<string, unknown>;
  filePath?: string;
  body?: string;
  digest?: string;
  rendered?: { html: string };
  assetImports?: string[];
};

/** A minimal stand-in for Astro's scoped data store (values() returns a snapshot). */
function fakeStore() {
  const map = new Map<string, Entry>();
  const calls: string[] = [];
  const store = {
    values: () => [...map.values()],
    get: (id: string) => map.get(id),
    keys: () => [...map.keys()],
    has: (id: string) => map.has(id),
    delete: (id: string) => {
      calls.push(`delete:${id}`);
      map.delete(id);
    },
    set: (entry: Entry) => {
      calls.push(`set:${entry.id}`);
      map.set(entry.id, entry);
      return true;
    },
  };
  return { map, calls, store };
}

function innerLoader(entries: Entry[]) {
  let loads = 0;
  const loader: Loader = {
    name: 'glob-loader',
    load: async (context) => {
      loads += 1;
      for (const entry of entries) context.store.set(entry as never);
    },
  };
  return { loader, loadCount: () => loads };
}

const published: Entry = {
  id: '01-published',
  data: { title: 'Published', draft: false, photos: ['src/assets/timeline/a.png'] },
  filePath: 'src/content/timeline/01-published.md',
  body: 'Hello',
  digest: 'abc',
  rendered: { html: '<p>Hello</p>' },
  assetImports: ['../../assets/timeline/a.png'],
};

const draft: Entry = {
  id: '00-draft',
  data: { title: 'Draft', draft: true, photos: ['src/assets/timeline/secret.png'] },
  filePath: 'src/content/timeline/00-draft.md',
  body: 'Private',
  digest: 'def',
  rendered: { html: '<p>Private</p>' },
  assetImports: ['../../assets/timeline/secret.png'],
};

const noDraftField: Entry = { id: '02-plain', data: { title: 'Plain' } };

test('outside production the loader is returned unchanged', () => {
  const { loader } = innerLoader([draft]);
  assert.equal(withoutDraftsInProduction(loader, false), loader);
});

test('in production drafts become id-only placeholders and published entries stay intact', async () => {
  const { loader, loadCount } = innerLoader([published, draft, noDraftField]);
  const wrapped = withoutDraftsInProduction(loader, true);
  assert.equal(wrapped.name, 'glob-loader');

  const { map, calls, store } = fakeStore();
  await wrapped.load({ store } as unknown as LoaderContext);

  assert.equal(loadCount(), 1);
  assert.deepEqual([...map.keys()].sort(), ['00-draft', '01-published', '02-plain']);
  assert.deepEqual(map.get('01-published'), published);
  assert.deepEqual(map.get('02-plain'), noDraftField);
  // No file path, body, rendered HTML, digest or asset imports survive for the draft.
  assert.deepEqual(map.get('00-draft'), { id: '00-draft', data: { draft: true } });
  // delete() runs first, so Astro marks its import lists dirty and regenerates them.
  assert.deepEqual(calls.slice(-2), ['delete:00-draft', 'set:00-draft']);
});

test('in production a collection without drafts is left untouched', async () => {
  const { loader } = innerLoader([published, noDraftField]);
  const { map, calls, store } = fakeStore();
  await withoutDraftsInProduction(loader, true).load({ store } as unknown as LoaderContext);

  assert.deepEqual(calls, ['set:01-published', 'set:02-plain']);
  assert.deepEqual(map.get('01-published'), published);
});

test('errors from the wrapped loader propagate', async () => {
  const failing: Loader = {
    name: 'glob-loader',
    load: async () => {
      throw new Error('invalid frontmatter');
    },
  };
  const { store } = fakeStore();
  await assert.rejects(
    withoutDraftsInProduction(failing, true).load({ store } as unknown as LoaderContext),
    /invalid frontmatter/,
  );
});
