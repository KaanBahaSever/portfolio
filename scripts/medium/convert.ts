/**
 * Converts a Medium story (the `content:encoded` HTML of its RSS item) into Markdown for
 * src/content/blog/*.md.
 *
 * Medium's RSS uses a small, stable set of tags (p, h3/h4, figure/img/figcaption, a, strong,
 * em, code, pre, blockquote, ul/ol/li, hr, br, iframe), so a hand-written converter over
 * Sätteri's HTML parser is shorter and more predictable than a general HTML-to-Markdown
 * library with a pile of custom rules. Anything unexpected is kept as text and reported.
 *
 * Output rules that matter for this site:
 * - Text is escaped for Markdown, including `$` → `\$`: math is enabled (astro.config.mjs),
 *   so "$5 or $10" would otherwise render as inline math.
 * - Images stay Markdown images (`![alt](../../assets/…)`), so Astro optimizes them; a
 *   caption wraps the image in <figure> with blank lines around it (HTML block, then Markdown).
 * - The figure that opens the story becomes the post's hero image and is left out of the body;
 *   its caption stays visible as `heroImageCaption` (the post page renders it under the hero).
 * - Medium's tracking pixel is dropped; embeds (gists, videos) become links plus a warning.
 *
 * Pure module (no I/O): the sync script downloads the images first (see inspectArticle) and
 * passes their local paths in. Warnings are structured; the script prints them.
 */
import { htmlToHast } from 'satteri';

/** The subset of hast this converter reads. */
interface HNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HNode[];
  value?: string;
}

export interface MediumImage {
  /** `src` as written in the feed (usually a resized cdn-images-1.medium.com URL). */
  src: string;
  /** Where to download the original: https://miro.medium.com/v2/<id> for Medium-hosted images. */
  downloadUrl: string;
  /** File extension suggested by the URL ("jpeg", "png"…), used until the download says better. */
  extension: string | undefined;
  /** The `alt` attribute (Medium's feed usually leaves it empty). */
  alt: string;
  /** Plain text of the figure's caption, or ''. */
  caption: string;
}

export type ConvertWarningCode =
  | 'empty-alt'
  | 'code-without-language'
  | 'embed'
  | 'unsupported-element'
  | 'unsafe-link'
  | 'image-not-downloadable';

export interface ConvertWarning {
  code: ConvertWarningCode;
  detail: string;
}

export interface ArticleInfo {
  /** Images in document order (tracking pixels excluded). Index 0 is the hero when `hasHero`. */
  images: MediumImage[];
  /** True when the story opens with an image figure: it becomes `heroImage`. */
  hasHero: boolean;
  /** Plain text of the whole story (for language detection). */
  text: string;
  /** Plain text of the first non-empty paragraph (a description draft). */
  firstParagraph: string;
}

export interface ConvertOptions {
  /** The story title; a leading heading that repeats it is dropped. */
  title: string;
  /** Language of the story, for the few words the converter writes itself (embed links). */
  lang: 'en' | 'tr';
  /**
   * The Markdown path of an image, relative to the post file. Called with the image's index
   * in `inspectArticle().images`.
   */
  imagePath(image: MediumImage, index: number): string;
  /**
   * Alt text already written for an image path (by hand, in the file being updated). It wins
   * over Medium's alt attribute and the caption, so a re-sync keeps hand-written alt text.
   */
  knownAlt?(path: string): string | undefined;
}

export interface ConvertResult {
  markdown: string;
  /**
   * The hero image (index 0), the alt text for `heroImageAlt` (Medium's alt, else the caption)
   * and the caption for `heroImageCaption` ('' when the figure has none).
   */
  hero?: { image: MediumImage; alt: string; caption: string };
  warnings: ConvertWarning[];
}

const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'div', 'dl', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'header', 'hr', 'iframe', 'main', 'ol', 'p', 'pre', 'section', 'table', 'ul', 'video',
]);
const DROPPED_TAGS = new Set(['script', 'style', 'noscript', 'template', 'svg', 'link', 'meta']);
const TRANSPARENT_INLINE = new Set(['span', 'mark', 'u', 'small', 'abbr', 'cite', 'time', 'font', 'q', 'ins', 'label']);

const EMBED_LABEL = { en: 'Embedded content on Medium', tr: 'Medium’daki gömülü içerik' } as const;

// ---------------------------------------------------------------------------------------------
// Tree helpers

function parse(html: string): HNode[] {
  const root = htmlToHast(html, { fragment: true }) as unknown as HNode;
  return root.children ?? [];
}

const isElement = (node: HNode, ...tags: string[]): boolean =>
  node.type === 'element' && (tags.length === 0 || tags.includes(node.tagName ?? ''));

function prop(node: HNode, name: string): string {
  const value = node.properties?.[name];
  if (value === undefined || value === null || value === false) return '';
  return Array.isArray(value) ? value.join(' ') : String(value);
}

function classes(node: HNode): string[] {
  const value = node.properties?.className;
  return Array.isArray(value) ? value.map(String) : typeof value === 'string' ? value.split(/\s+/) : [];
}

/** Text content; `<br>` becomes a newline only when `breaks` is set (code blocks). */
function textOf(node: HNode, breaks = false): string {
  if (node.type === 'text') return node.value ?? '';
  if (isElement(node, 'br')) return breaks ? '\n' : ' ';
  if (node.type !== 'element' && node.type !== 'root') return '';
  if (DROPPED_TAGS.has(node.tagName ?? '')) return '';
  return (node.children ?? []).map((child) => textOf(child, breaks)).join('');
}

const collapse = (text: string): string => text.replace(/\s+/g, ' ').trim();

function find(node: HNode, tag: string): HNode | undefined {
  for (const child of node.children ?? []) {
    if (isElement(child, tag)) return child;
    const nested = find(child, tag);
    if (nested) return nested;
  }
  return undefined;
}

function isTrackingPixel(img: HNode): boolean {
  const src = prop(img, 'src');
  if (prop(img, 'width') === '1' && prop(img, 'height') === '1') return true;
  try {
    const url = new URL(src);
    return url.hostname === 'medium.com' && url.pathname.startsWith('/_/stat');
  } catch {
    return false;
  }
}

/** Resized Medium URLs (cdn-images-1…/max/1024/<id>, miro…/v2/resize:fit:800/<id>) → the original. */
function describeImage(img: HNode, caption: string): MediumImage {
  const src = prop(img, 'src');
  let downloadUrl = '';
  let extension: string | undefined;
  try {
    const url = new URL(src);
    const id = url.pathname.split('/').filter(Boolean).at(-1) ?? '';
    extension = /\.([a-z0-9]{2,5})$/i.exec(id)?.[1]?.toLowerCase();
    if (/(^|\.)medium\.com$/.test(url.hostname) && id) {
      downloadUrl = `https://miro.medium.com/v2/${id}`;
    } else if (url.protocol === 'https:' || url.protocol === 'http:') {
      downloadUrl = url.href;
    }
  } catch {
    downloadUrl = '';
  }
  return { src, downloadUrl, extension, alt: collapse(prop(img, 'alt')), caption };
}

function isTitleHeading(node: HNode, title: string): boolean {
  return (
    isElement(node, 'h1', 'h2', 'h3', 'h4') && collapse(textOf(node)).toLowerCase() === collapse(title).toLowerCase()
  );
}

/** Top-level nodes that carry content (whitespace-only text and comments are skipped). */
function contentNodes(nodes: HNode[]): HNode[] {
  return nodes.filter((node) => (node.type === 'text' ? /\S/.test(node.value ?? '') : node.type === 'element'));
}

/** The figure that opens the story (after an optional heading that repeats the title). */
function leadingFigure(nodes: HNode[], title: string): HNode | undefined {
  const content = contentNodes(nodes);
  const first = content[0] && isTitleHeading(content[0], title) ? content[1] : content[0];
  if (!first || !isElement(first, 'figure')) return undefined;
  const img = find(first, 'img');
  return img && !isTrackingPixel(img) ? first : undefined;
}

/** Every content image in document order, each with its figure caption. */
function collectImages(nodes: HNode[]): { img: HNode; figure?: HNode }[] {
  const found: { img: HNode; figure?: HNode }[] = [];
  const walk = (node: HNode, figure: HNode | undefined) => {
    if (isElement(node, 'img')) {
      if (!isTrackingPixel(node)) found.push({ img: node, figure });
      return;
    }
    const inFigure = isElement(node, 'figure') ? node : figure;
    for (const child of node.children ?? []) walk(child, inFigure);
  };
  for (const node of nodes) walk(node, undefined);
  return found;
}

function captionText(figure: HNode | undefined): string {
  const caption = figure ? find(figure, 'figcaption') : undefined;
  return caption ? collapse(textOf(caption)) : '';
}

/**
 * First pass: what the sync script needs before converting (images to download, text for
 * language detection and a description draft).
 */
export function inspectArticle(html: string, title: string): ArticleInfo {
  const nodes = parse(html);
  const images = collectImages(nodes).map(({ img, figure }) => describeImage(img, captionText(figure)));
  const paragraphs: string[] = [];
  const walk = (node: HNode) => {
    if (isElement(node, 'p', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6')) {
      const text = collapse(textOf(node));
      if (text) paragraphs.push(text);
      return;
    }
    if (isElement(node, 'figcaption', 'pre', 'code')) return;
    for (const child of node.children ?? []) walk(child);
  };
  for (const node of nodes) walk(node);
  const firstParagraph =
    paragraphs.find((text, index) => !(index === 0 && collapse(text).toLowerCase() === collapse(title).toLowerCase())) ??
    '';
  return {
    images,
    hasHero: leadingFigure(nodes, title) !== undefined,
    text: [title, ...paragraphs].join('\n'),
    firstParagraph,
  };
}

// ---------------------------------------------------------------------------------------------
// Escaping

const isWordChar = (char: string | undefined): boolean => !!char && /[\p{L}\p{N}]/u.test(char);
const isPunctuation = (char: string | undefined): boolean => !!char && /[\p{P}\p{S}]/u.test(char);

/**
 * Escapes Markdown syntax inside running text. `$` is escaped because math is enabled; `_` only
 * at word edges (snake_case stays readable); `&` only where it would start an entity.
 */
export function escapeMarkdownText(text: string): string {
  return text
    .replace(/[\\`*[\]<~$]/g, '\\$&')
    .replace(/_/g, (match, offset: number, whole: string) =>
      isWordChar(whole[offset - 1]) && isWordChar(whole[offset + 1]) ? match : '\\_',
    )
    .replace(/&(?=#?[a-z0-9]+;)/gi, '&amp;');
}

/** Escapes what would turn the start of a line into a heading, quote, list or rule. */
function escapeLineStarts(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) =>
      line
        .replace(/^(#{1,6})(?=\s|$)/, '\\$1')
        .replace(/^>/, '\\>')
        .replace(/^([-+])(?=\s|$)/, '\\$1')
        .replace(/^(\d{1,9})([.)])(?=\s|$)/, '$1\\$2')
        .replace(/^(=+|-+)\s*$/, '\\$1'),
    )
    .join('\n');
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** A link destination Markdown accepts as-is (spaces and parentheses percent-encoded). */
function markdownUrl(url: string): string {
  return url.replace(/[ ()<>]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);
}

/**
 * An image description is parsed as inline Markdown and rendered as plain text, so syntax in
 * it is not shown but consumed: "$5 to $10" would become inline math and "*a*" would lose its
 * asterisks. Everything that can start inline syntax is backslash-escaped, and readImageAlts
 * undoes exactly this set, so alt text round-trips through a re-sync. `&` is left alone: a
 * hand-written entity such as `&copy;` must survive that round trip unchanged.
 */
const ALT_SYNTAX = /[\\`*_[\]<~$]/g;
const ALT_UNESCAPE = /\\([\\`*_[\]<~$])/g;

export const escapeAlt = (text: string): string => collapse(text).replace(ALT_SYNTAX, '\\$&');

/**
 * The alt text of every Markdown image in `markdown`, by path (unescaped). The sync reads the
 * file it is about to update, so alt text added there by hand survives (see `knownAlt`).
 */
export function readImageAlts(markdown: string): Map<string, string> {
  const alts = new Map<string, string>();
  for (const match of markdown.matchAll(/!\[((?:\\.|[^\\\]])*)\]\(<?([^)\s>]+)>?\)/g)) {
    const alt = (match[1] ?? '').replace(ALT_UNESCAPE, '$1').trim();
    if (alt && match[2]) alts.set(match[2], alt);
  }
  return alts;
}

/** Backtick fence (or code-span delimiter) longer than any backtick run inside `code`. */
function fenceFor(code: string, minimum: number): string {
  const longest = Math.max(0, ...[...code.matchAll(/`+/g)].map((match) => match[0].length));
  return '`'.repeat(Math.max(minimum, longest + 1));
}

/**
 * Only http(s) and mailto links survive; Medium's `?source=` tracking parameter is removed.
 * Returns undefined for anything else (javascript:, data:, relative links).
 */
export function cleanHref(href: string): string | undefined {
  try {
    const url = new URL(href);
    if (url.protocol === 'mailto:') return url.href;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    if (/(^|\.)medium\.com$/.test(url.hostname)) url.searchParams.delete('source');
    return url.href;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------------------------
// Conversion

interface Context {
  options: ConvertOptions;
  warnings: ConvertWarning[];
  imageIndex: Map<HNode, number>;
  images: MediumImage[];
  heroFigure: HNode | undefined;
  titleHeading: HNode | undefined;
}

function warn(ctx: Context, code: ConvertWarningCode, detail: string): void {
  ctx.warnings.push({ code, detail });
}

function imageMarkdown(img: HNode, ctx: Context, fallbackAlt: string): string {
  const index = ctx.imageIndex.get(img);
  const image = index === undefined ? undefined : ctx.images[index];
  if (index === undefined || !image) return '';
  if (!image.downloadUrl) {
    warn(ctx, 'image-not-downloadable', image.src || '(no src)');
    return '';
  }
  const path = ctx.options.imagePath(image, index);
  const alt = ctx.options.knownAlt?.(path) || image.alt || fallbackAlt;
  if (!alt) warn(ctx, 'empty-alt', `image ${index + 1} (${image.src}) has neither alt text nor a caption`);
  const destination = /[\s()<>]/.test(path) ? `<${path}>` : path;
  return `![${escapeAlt(alt)}](${destination})`;
}

/** Inline HTML for a figcaption (inside an HTML block, where Markdown is not parsed). */
function captionHtml(nodes: HNode[]): string {
  return nodes
    .map((node): string => {
      if (node.type === 'text') return escapeHtml(node.value ?? '');
      if (node.type !== 'element' || DROPPED_TAGS.has(node.tagName ?? '')) return '';
      const inner = captionHtml(node.children ?? []);
      switch (node.tagName) {
        case 'br':
          return '<br>';
        case 'a': {
          const href = cleanHref(prop(node, 'href'));
          return href ? `<a href="${escapeHtml(href)}">${inner}</a>` : inner;
        }
        case 'strong':
        case 'b':
          return `<strong>${inner}</strong>`;
        case 'em':
        case 'i':
          return `<em>${inner}</em>`;
        case 'code':
          return `<code>${inner}</code>`;
        default:
          return inner;
      }
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** `**text**`, or `<strong>text</strong>` where the delimiters would not be recognised. */
function emphasis(marker: string, tag: string, inner: string, before: string | undefined, after: string | undefined) {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner);
  const [lead = '', core = '', trail = ''] = match ? match.slice(1) : [];
  if (!core) return inner;
  // CommonMark flanking rules: a delimiter next to punctuation on the inside must have
  // whitespace or punctuation on the outside ("a**“b”**c" is not emphasis).
  const opens = !(isPunctuation(core[0]) && isWordChar(lead ? ' ' : before));
  const closes = !(isPunctuation(core.at(-1)) && isWordChar(trail ? ' ' : after));
  return opens && closes ? `${lead}${marker}${core}${marker}${trail}` : `${lead}<${tag}>${core}</${tag}>${trail}`;
}

function inline(nodes: HNode[], ctx: Context): string {
  let out = '';
  nodes.forEach((node, index) => {
    if (node.type === 'text') {
      out += escapeMarkdownText((node.value ?? '').replace(/\s+/g, ' '));
      return;
    }
    if (node.type !== 'element') return;
    const tag = node.tagName ?? '';
    if (DROPPED_TAGS.has(tag)) return;
    const before = index > 0 ? textOf(nodes[index - 1] as HNode).at(-1) : undefined;
    const after = index < nodes.length - 1 ? textOf(nodes[index + 1] as HNode)[0] : undefined;
    const children = node.children ?? [];
    switch (tag) {
      case 'br':
        // Backslash hard break; the next line is trimmed so it cannot become indented code.
        out = `${out.replace(/ +$/, '')}\\\n`;
        return;
      case 'strong':
      case 'b':
        out += emphasis('**', 'strong', inline(children, ctx), before, after);
        return;
      case 'em':
      case 'i':
        out += emphasis('*', 'em', inline(children, ctx), before, after);
        return;
      case 's':
      case 'strike':
      case 'del':
        out += emphasis('~~', 'del', inline(children, ctx), before, after);
        return;
      case 'sup':
      case 'sub':
        out += `<${tag}>${escapeHtml(collapse(textOf(node)))}</${tag}>`;
        return;
      case 'code': {
        const code = textOf(node).replace(/\s+/g, ' ');
        if (!code.trim()) return;
        const fence = fenceFor(code, 1);
        const pad = code.startsWith('`') || code.endsWith('`') || (code.startsWith(' ') && code.endsWith(' ')) ? ' ' : '';
        out += `${fence}${pad}${code}${pad}${fence}`;
        return;
      }
      case 'a': {
        const text = inline(children, ctx).trim();
        const rawHref = prop(node, 'href');
        const href = cleanHref(rawHref);
        if (!href) {
          if (rawHref) warn(ctx, 'unsafe-link', rawHref);
          out += text;
          return;
        }
        if (!text) return;
        out += `[${text}](${markdownUrl(href)})`;
        return;
      }
      case 'img':
        out += imageMarkdown(node, ctx, '');
        return;
      default:
        if (!TRANSPARENT_INLINE.has(tag) && !BLOCK_TAGS.has(tag) && tag !== 'li' && tag !== 'figcaption') {
          warn(ctx, 'unsupported-element', `<${tag}> kept as text`);
        }
        out += inline(children, ctx);
    }
  });
  // A line that follows a hard break starts at the margin.
  return out.replace(/\\\n +/g, '\\\n');
}

function paragraph(nodes: HNode[], ctx: Context): string[] {
  // Hard breaks at the very start or end of a paragraph have nothing to separate.
  const text = inline(nodes, ctx)
    .replace(/^(?:\s*\\\n)+/, '')
    .replace(/(?:\\\n\s*)+$/, '')
    .trim();
  return text ? [escapeLineStarts(text)] : [];
}

function embed(node: HNode, caption: string, ctx: Context): string[] {
  const src = cleanHref(prop(node, 'src'));
  warn(ctx, 'embed', `${src ?? prop(node, 'src')}: replace the link with the embedded content (e.g. inline the gist)`);
  if (!src) return [];
  const label = EMBED_LABEL[ctx.options.lang];
  const lines = [`<!-- sync-medium: embedded content, replace this link by hand -->`, `[${label}](${markdownUrl(src)})`];
  return [lines.join('\n'), ...(caption ? [escapeLineStarts(`*${escapeMarkdownText(caption)}*`)] : [])];
}

function figure(node: HNode, ctx: Context): string[] {
  if (node === ctx.heroFigure) return [];
  const caption = find(node, 'figcaption');
  const iframe = find(node, 'iframe');
  if (iframe) return embed(iframe, caption ? collapse(textOf(caption)) : '', ctx);
  const img = find(node, 'img');
  if (!img || isTrackingPixel(img)) return blocks(node.children ?? [], ctx);

  const captionPlain = caption ? collapse(textOf(caption)) : '';
  let image = imageMarkdown(img, ctx, captionPlain);
  if (!image) return caption ? paragraph(caption.children ?? [], ctx) : [];
  const link = find(node, 'a');
  const linkHref = link && find(link, 'img') ? cleanHref(prop(link, 'href')) : undefined;
  if (linkHref) image = `[${image}](${markdownUrl(linkHref)})`;
  const captionMarkup = caption ? captionHtml(caption.children ?? []) : '';
  if (!captionMarkup) return [image];
  // <figure> and <figcaption> start HTML blocks; the blank lines let the image in between be
  // parsed as Markdown, so Astro still optimizes it.
  return [`<figure>\n\n${image}\n\n<figcaption>${captionMarkup}</figcaption>\n</figure>`];
}

const listStart = (node: HNode): number =>
  isElement(node, 'ol') ? Number.parseInt(prop(node, 'start') || '1', 10) || 1 : 1;

/**
 * A list item's blocks, joined. In CommonMark a blank line between two blocks of an item makes
 * the whole list loose (every item is wrapped in <p>), so blocks are separated by one newline
 * where that is enough: before a nested list that may interrupt a paragraph (a bullet list, or
 * an ordered list starting at 1). Other blocks need the blank line, and `loose` reports it.
 */
function listItem(item: HNode, ctx: Context): { text: string; loose: boolean } {
  const parts: { text: string; tight: boolean }[] = [];
  let run: HNode[] = [];
  const flush = () => {
    for (const text of blocks(run, ctx)) parts.push({ text, tight: false });
    run = [];
  };
  for (const child of item.children ?? []) {
    if (!isElement(child, 'ul', 'ol')) {
      run.push(child);
      continue;
    }
    flush();
    const tight = isElement(child, 'ul') || listStart(child) === 1;
    for (const text of list(child, ctx)) parts.push({ text, tight });
  }
  flush();

  let loose = false;
  const text = parts
    .map((part, index) => {
      if (index === 0) return part.text;
      if (!part.tight) loose = true;
      return `${part.tight ? '\n' : '\n\n'}${part.text}`;
    })
    .join('');
  return { text, loose };
}

function list(node: HNode, ctx: Context): string[] {
  const ordered = isElement(node, 'ol');
  const start = listStart(node);
  const items = (node.children ?? []).filter((child) => isElement(child, 'li'));
  let loose = false;
  const rendered = items.map((item, index) => {
    const marker = ordered ? `${start + index}. ` : '- ';
    const content = listItem(item, ctx);
    if (content.loose) loose = true;
    const indent = ' '.repeat(marker.length);
    return marker + content.text.split('\n').map((line, i) => (i === 0 || line === '' ? line : indent + line)).join('\n');
  });
  return rendered.length ? [rendered.join(loose ? '\n\n' : '\n')] : [];
}

function codeLanguage(pre: HNode): string {
  const code = find(pre, 'code');
  for (const node of [pre, code]) {
    if (!node) continue;
    const explicit = prop(node, 'dataCodeBlockLang') || prop(node, 'dataLang') || prop(node, 'dataLanguage');
    if (explicit) return explicit.toLowerCase();
    const fromClass = classes(node)
      .map((name) => /^(?:language|lang)-(.+)$/.exec(name)?.[1])
      .find(Boolean);
    if (fromClass) return fromClass.toLowerCase();
  }
  return '';
}

function codeBlock(node: HNode, ctx: Context): string[] {
  const code = textOf(node, true).replace(/ /g, ' ').replace(/\n+$/, '');
  if (!code.trim()) return [];
  const lang = codeLanguage(node).replace(/[^a-z0-9+#.-]/g, '');
  if (!lang) {
    const firstLine = code.split('\n')[0]?.slice(0, 40) ?? '';
    warn(ctx, 'code-without-language', `code block starting "${firstLine}"`);
  }
  const fence = fenceFor(code, 3);
  return [`${fence}${lang}\n${code}\n${fence}`];
}

function heading(node: HNode, ctx: Context): string[] {
  if (node === ctx.titleHeading) return [];
  const level = isElement(node, 'h1', 'h2', 'h3') ? 2 : 3;
  const text = inline(node.children ?? [], ctx)
    .replace(/\\\n/g, ' ')
    .trim()
    // A trailing " #" would be read as the closing sequence of an ATX heading.
    .replace(/(\s)(#+)$/, '$1\\$2');
  return text ? [`${'#'.repeat(level)} ${text}`] : [];
}

function blockquote(node: HNode, ctx: Context): string[] {
  const inner = blocks(node.children ?? [], ctx).join('\n\n');
  if (!inner) return [];
  return [
    inner
      .split('\n')
      .map((line) => (line ? `> ${line}` : '>'))
      .join('\n'),
  ];
}

function block(node: HNode, ctx: Context): string[] {
  const tag = node.tagName ?? '';
  switch (tag) {
    case 'p':
      return paragraph(node.children ?? [], ctx);
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return heading(node, ctx);
    case 'figure':
      return figure(node, ctx);
    case 'blockquote':
      return blockquote(node, ctx);
    case 'ul':
    case 'ol':
      return list(node, ctx);
    case 'pre':
      return codeBlock(node, ctx);
    case 'hr':
      return ['---'];
    case 'iframe':
      return embed(node, '', ctx);
    case 'video':
      warn(ctx, 'embed', '<video> element: add the video by hand');
      return [];
    case 'table':
    case 'dl':
      warn(ctx, 'unsupported-element', `<${tag}> converted to plain paragraphs`);
      return blocks(node.children ?? [], ctx);
    default:
      return blocks(node.children ?? [], ctx);
  }
}

/** Block-level conversion; runs of inline nodes between blocks become paragraphs. */
function blocks(nodes: HNode[], ctx: Context): string[] {
  const out: string[] = [];
  let run: HNode[] = [];
  const flush = () => {
    if (run.length) out.push(...paragraph(run, ctx));
    run = [];
  };
  for (const node of nodes) {
    if (node.type === 'element' && DROPPED_TAGS.has(node.tagName ?? '')) continue;
    if (isElement(node, 'img')) {
      // A top-level <img> (Medium's tracking pixel, or a bare image) is its own block.
      flush();
      if (!isTrackingPixel(node)) {
        const image = imageMarkdown(node, ctx, '');
        if (image) out.push(image);
      }
      continue;
    }
    if (node.type === 'element' && (BLOCK_TAGS.has(node.tagName ?? '') || isElement(node, 'li', 'tr', 'td', 'th', 'thead', 'tbody', 'dt', 'dd'))) {
      flush();
      out.push(...block(node, ctx));
      continue;
    }
    if (node.type === 'text' || node.type === 'element') run.push(node);
  }
  flush();
  return out;
}

/** Second pass: the Markdown body, the hero image and the warnings. */
export function convertArticle(html: string, options: ConvertOptions): ConvertResult {
  const nodes = parse(html);
  const found = collectImages(nodes);
  const images = found.map(({ img, figure: parent }) => describeImage(img, captionText(parent)));
  const content = contentNodes(nodes);
  const titleHeading = content[0] && isTitleHeading(content[0], options.title) ? content[0] : undefined;
  const heroFigure = leadingFigure(nodes, options.title);

  const ctx: Context = {
    options,
    warnings: [],
    imageIndex: new Map(found.map(({ img }, index) => [img, index])),
    images,
    heroFigure,
    titleHeading,
  };

  const body = blocks(nodes, ctx).join('\n\n');
  const heroImage = heroFigure ? images[0] : undefined;
  let hero: ConvertResult['hero'];
  if (heroImage) {
    const alt = heroImage.alt || heroImage.caption;
    if (!alt) warn(ctx, 'empty-alt', `hero image (${heroImage.src}) has neither alt text nor a caption`);
    if (!heroImage.downloadUrl) warn(ctx, 'image-not-downloadable', heroImage.src || '(no src)');
    else hero = { image: heroImage, alt, caption: heroImage.caption };
  }
  return { markdown: body ? `${body}\n` : '', hero, warnings: ctx.warnings };
}
