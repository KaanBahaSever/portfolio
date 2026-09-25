/**
 * Imports Medium stories into the blog: `npm run sync:medium [-- options]`.
 *
 *   --feed <file>  read a saved RSS file instead of fetching the live feed
 *   --dry-run      show what would change; write and download nothing
 *   --force        re-import stories that are already up to date (never those with
 *                  `mediumSync: false`)
 *
 * For each feed item it writes src/content/blog/<slug>.md and downloads the story's images to
 * src/assets/blog/<slug>/NN.<ext> (full-size originals; nothing is hot-linked). Run it by hand
 * and commit the result: the site build never touches the network.
 *
 * Idempotent: a story is rewritten only when the feed's `atom:updated` is newer than the file's
 * `mediumUpdated` (or with --force), and unchanged files and images are not rewritten. Files
 * marked `mediumSync: false` are never touched. On an update the existing description,
 * language, hero alt text, image alt text and every key the sync does not manage
 * (relatedProject, translationKey, draft…) are kept; the body text follows the feed.
 * See scripts/medium/*.ts for the conversion rules.
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { SITE } from '../src/config/site.ts';
import {
  convertArticle,
  inspectArticle,
  readImageAlts,
  type ConvertWarning,
  type MediumImage,
} from './medium/convert.ts';
import { deriveDescription, detectLang, parseFeed, slugFromMedium, type FeedItem } from './medium/feed.ts';
import { planSync, readFrontmatter, renderFrontmatter, type Frontmatter } from './medium/frontmatter.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BLOG_DIR = path.join(ROOT, 'src', 'content', 'blog');
const ASSETS_DIR = path.join(ROOT, 'src', 'assets', 'blog');

/** https://medium.com/@user → https://medium.com/feed/@user (the profile link in src/config/site.ts). */
function feedUrl(): string {
  const profile = SITE.socials.find((social) => social.label === 'Medium')?.href;
  const handle = profile ? /medium\.com\/(@[^/?#]+)/.exec(profile)?.[1] : undefined;
  if (!handle) throw new Error('No Medium profile (https://medium.com/@user) in SITE.socials');
  return `https://medium.com/feed/${handle}`;
}

const CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

function extensionFor(contentType: string | null, image: MediumImage): string {
  const fromType = contentType ? CONTENT_TYPES[contentType.split(';')[0]?.trim().toLowerCase() ?? ''] : undefined;
  if (fromType) return fromType;
  const guess = image.extension === 'jpeg' ? 'jpg' : image.extension;
  return guess && Object.values(CONTENT_TYPES).includes(guess) ? guess : 'jpg';
}

/** Forward slashes for Markdown paths, whatever the OS. */
const posix = (value: string): string => value.split(path.sep).join('/');

interface ExistingPost {
  file: string;
  frontmatter: Frontmatter;
  source: string;
}

/** Existing posts by Medium id: a renamed file keeps receiving updates for its story. */
async function indexExistingPosts(): Promise<{ byId: Map<string, ExistingPost>; files: Set<string> }> {
  const byId = new Map<string, ExistingPost>();
  const files = new Set<string>();
  const names = await readdir(BLOG_DIR).catch(() => [] as string[]);
  for (const name of names) {
    if (!/\.mdx?$/.test(name)) continue;
    const file = path.join(BLOG_DIR, name);
    files.add(path.basename(name).replace(/\.mdx?$/, ''));
    const source = await readFile(file, 'utf8');
    const frontmatter = readFrontmatter(source);
    const id = frontmatter?.values.mediumId;
    if (frontmatter && typeof id === 'string') byId.set(id, { file, frontmatter, source });
  }
  return { byId, files };
}

async function fetchChecked(url: string): Promise<Response> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: 'follow' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response;
}

/** Writes `data` unless the file already holds exactly these bytes (keeps mtimes and git quiet). */
async function writeIfChanged(file: string, data: Uint8Array | string): Promise<boolean> {
  const next = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);
  const current = await readFile(file).catch(() => undefined);
  if (current?.equals(next)) return false;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, next);
  return true;
}

interface Options {
  dryRun: boolean;
  force: boolean;
}

function printWarnings(warnings: readonly ConvertWarning[]): void {
  const labels: Record<ConvertWarning['code'], string> = {
    'empty-alt': 'image without alt text',
    'code-without-language': 'code block without a language (add one after the opening fence)',
    embed: 'embed',
    'unsupported-element': 'unsupported HTML',
    'unsafe-link': 'link dropped (not http, https or mailto)',
    'image-not-downloadable': 'image skipped (no downloadable URL)',
  };
  for (const warning of warnings) console.warn(`    ! ${labels[warning.code]}: ${warning.detail}`);
}

async function syncItem(item: FeedItem, existing: ExistingPost | undefined, taken: Set<string>, options: Options) {
  const action = planSync(existing?.frontmatter.values, item.updated, options.force);
  const label = `“${item.title}” (${item.mediumId})`;
  if (action === 'skip-locked') {
    console.log(`= ${label}: mediumSync is false in ${path.relative(ROOT, existing?.file ?? '')}, left alone`);
    return;
  }
  if (action === 'skip-up-to-date') {
    console.log(`= ${label}: up to date`);
    return;
  }

  let slug = existing ? path.basename(existing.file).replace(/\.mdx?$/, '') : slugFromMedium(item.url, item.title, item.mediumId);
  if (!existing && taken.has(slug)) {
    // A hand-written post already uses this name; keep both.
    slug = `${slug}-${item.mediumId}`;
  }
  const postFile = existing?.file ?? path.join(BLOG_DIR, `${slug}.md`);
  if (existing && !postFile.endsWith('.md')) {
    console.warn(`! ${label}: ${path.relative(ROOT, postFile)} is MDX; the sync only writes .md files. Skipped.`);
    return;
  }
  const assetDir = path.join(ASSETS_DIR, slug);
  const info = inspectArticle(item.html, item.title);
  const existingLang = existing?.frontmatter.values.lang;
  const lang = existingLang === 'en' || existingLang === 'tr' ? existingLang : detectLang(info.text);

  // Download every image first, so the Markdown can point at real files with real extensions.
  const localNames: string[] = [];
  for (const [index, image] of info.images.entries()) {
    const number = String(index + 1).padStart(2, '0');
    if (!image.downloadUrl) {
      localNames.push(`${number}.${extensionFor(null, image)}`);
      continue;
    }
    if (options.dryRun) {
      localNames.push(`${number}.${extensionFor(null, image)}`);
      continue;
    }
    const response = await fetchChecked(image.downloadUrl);
    const name = `${number}.${extensionFor(response.headers.get('content-type'), image)}`;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const written = await writeIfChanged(path.join(assetDir, name), bytes);
    console.log(`    ${written ? 'saved' : 'unchanged'} ${posix(path.relative(ROOT, path.join(assetDir, name)))} (${bytes.length} B)`);
    localNames.push(name);
  }
  const relative = (name: string) => posix(path.relative(path.dirname(postFile), path.join(assetDir, name)));

  const knownAlts = readImageAlts(existing?.frontmatter.body ?? '');
  const result = convertArticle(item.html, {
    title: item.title,
    lang,
    imagePath: (_image, index) => relative(localNames[index] ?? ''),
    knownAlt: (imagePath) => knownAlts.get(imagePath),
  });

  const description = deriveDescription(info.firstParagraph || item.title);
  // Medium bumps atom:updated for any edit; show "Updated" only when it is a later day.
  const updatedDate =
    item.updated.toISOString().slice(0, 10) !== item.pubDate.toISOString().slice(0, 10) ? item.updated : undefined;
  const frontmatter = renderFrontmatter(
    [
      ['title', item.title],
      ['description', description],
      ['pubDate', item.pubDate],
      ['updatedDate', updatedDate],
      ['lang', lang],
      ['tags', item.categories],
      ['heroImage', result.hero ? relative(localNames[0] ?? '') : undefined],
      ['heroImageAlt', result.hero?.alt || undefined],
      ['source', 'medium'],
      ['mediumId', item.mediumId],
      ['mediumUrl', item.url],
      ['canonicalUrl', item.url],
      ['mediumUpdated', item.updated],
    ],
    existing?.frontmatter,
  );
  const file = `${frontmatter}\n${result.markdown}`;
  const target = posix(path.relative(ROOT, postFile));

  if (options.dryRun) {
    console.log(`~ ${label}: would ${action} ${target} (${info.images.length} image(s), lang ${lang})`);
  } else {
    const written = await writeIfChanged(postFile, file);
    console.log(`${action === 'create' ? '+' : '~'} ${label}: ${written ? `${action}d` : 'unchanged'} ${target}`);
    // Images the story no longer uses are reported, not deleted.
    const current = new Set(localNames);
    const stale = (await readdir(assetDir).catch(() => [] as string[])).filter(
      (name) => /^\d{2}\.\w+$/.test(name) && !current.has(name),
    );
    for (const name of stale) console.warn(`    ! no longer used: ${posix(path.relative(ROOT, path.join(assetDir, name)))}`);
  }
  printWarnings(result.warnings);
  if (!existing?.frontmatter.values.description) {
    console.warn(`    ! description drafted from the first paragraph; rewrite it by hand (≤ 160 characters)`);
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      feed: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log('Usage: npm run sync:medium -- [--feed <file>] [--dry-run] [--force]');
    return;
  }
  const options: Options = { dryRun: values['dry-run'] ?? false, force: values.force ?? false };

  const source = values.feed ?? feedUrl();
  const xml = values.feed ? await readFile(path.resolve(values.feed), 'utf8') : await (await fetchChecked(source)).text();
  const { items, skipped } = parseFeed(xml);
  console.log(`${items.length} stor${items.length === 1 ? 'y' : 'ies'} in ${source}${options.dryRun ? ' (dry run)' : ''}`);
  for (const title of skipped) console.warn(`! skipped a feed item without title, link, date or id: ${title}`);

  const { byId, files } = await indexExistingPosts();
  for (const item of items) {
    await syncItem(item, byId.get(item.mediumId), files, options);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
