/**
 * Medium RSS feed parsing and the identity of an imported post (slug, id, language).
 *
 * Pure module (no I/O, erasable TypeScript only) so `node --test` can import it.
 *
 * Medium's feed (https://medium.com/feed/@user) is RSS 2.0 whose text fields are CDATA. It
 * lists at most the ten latest posts and carries no subtitle, so a description has to be
 * derived (see deriveDescription) and reviewed by hand.
 */

export interface FeedItem {
  title: string;
  /** Canonical post URL, without Medium's `?source=rss-…` tracking query. */
  url: string;
  /** Medium's post id: the hex suffix of the URL, also the tail of the guid ("/p/<id>"). */
  mediumId: string;
  /** Medium tags (lowercase slugs such as "apollo-11"). */
  categories: string[];
  pubDate: Date;
  /** `atom:updated`: changes whenever the author edits the story. */
  updated: Date;
  /** The full story as HTML (`content:encoded`). */
  html: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Decodes the five XML entities and numeric character references. */
export function decodeXmlText(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[name.toLowerCase()] ?? match;
  });
}

/** The text of every `<tag>` element in `xml`: CDATA sections verbatim, other text decoded. */
function readAll(xml: string, tag: string): string[] {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</${escaped}>`, 'g');
  return [...xml.matchAll(pattern)].map((match) => {
    const body = match[1] ?? '';
    // A field may mix CDATA sections and plain text; decode only the plain parts.
    return body
      .split(/(<!\[CDATA\[[\s\S]*?\]\]>)/)
      .map((part) => (part.startsWith('<![CDATA[') ? part.slice(9, -3) : decodeXmlText(part)))
      .join('')
      .trim();
  });
}

function readOne(xml: string, tag: string): string | undefined {
  return readAll(xml, tag)[0];
}

/** Drops the query string and fragment (Medium appends `?source=rss-<author>------2`). */
export function stripTracking(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.href;
  } catch {
    return url.replace(/[?#].*$/, '');
  }
}

/** Medium's post id: "…/p/2ddb23d72623" (guid) or the "-2ddb23d72623" suffix of the URL. */
export function mediumIdFrom(guid: string | undefined, url: string): string | undefined {
  const fromGuid = guid ? /\/p\/([0-9a-f]+)\/?$/i.exec(guid)?.[1] : undefined;
  if (fromGuid) return fromGuid.toLowerCase();
  return /-([0-9a-f]{8,16})\/?$/i.exec(new URL(url).pathname)?.[1]?.toLowerCase();
}

/**
 * Parses the feed's `<item>` elements. A regular expression is enough: Medium's feed is
 * machine-generated and flat, and every free-text field is CDATA. Items that lack a title,
 * link, id or date are skipped (with the reason) instead of failing the whole sync.
 */
export function parseFeed(xml: string): { items: FeedItem[]; skipped: string[] } {
  const items: FeedItem[] = [];
  const skipped: string[] = [];
  for (const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g)) {
    const itemXml = match[1] ?? '';
    const title = readOne(itemXml, 'title') ?? '';
    const link = readOne(itemXml, 'link') ?? '';
    const pubDate = new Date(readOne(itemXml, 'pubDate') ?? '');
    const updatedText = readOne(itemXml, 'atom:updated');
    const updated = updatedText ? new Date(updatedText) : pubDate;
    const html = readOne(itemXml, 'content:encoded') ?? '';
    if (!title || !link || Number.isNaN(pubDate.valueOf())) {
      skipped.push(title || link || '(untitled item)');
      continue;
    }
    const url = stripTracking(link);
    let mediumId: string | undefined;
    try {
      mediumId = mediumIdFrom(readOne(itemXml, 'guid'), url);
    } catch {
      mediumId = undefined;
    }
    if (!mediumId) {
      skipped.push(title);
      continue;
    }
    items.push({
      title,
      url,
      mediumId,
      categories: readAll(itemXml, 'category').filter(Boolean),
      pubDate,
      updated: Number.isNaN(updated.valueOf()) ? pubDate : updated,
      html,
    });
  }
  return { items, skipped };
}

const TURKISH_ASCII: Record<string, string> = {
  ı: 'i',
  İ: 'i',
  ş: 's',
  Ş: 's',
  ğ: 'g',
  Ğ: 'g',
  ü: 'u',
  Ü: 'u',
  ö: 'o',
  Ö: 'o',
  ç: 'c',
  Ç: 'c',
};

/** Words that are locale prefixes: a post slug must never equal one (they would clash with /tr/). */
const RESERVED_SLUGS = new Set(['en', 'tr']);

/**
 * URL-safe ASCII slug. Turkish letters are transliterated first ("ı" has no decomposition and
 * "İ".toLowerCase() yields "i" + a combining dot), then any remaining diacritics are removed.
 */
export function slugify(text: string): string {
  return text
    .replace(/[ıİşŞğĞüÜöÖçÇ]/g, (char) => TURKISH_ASCII[char] ?? char)
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

/**
 * The post's file name (and URL slug) from its Medium URL:
 *   /@user/aydan-an%C4%B1tkabir-e-yolculuk-2ddb23d72623 → aydan-anitkabir-e-yolculuk
 * The id suffix is dropped. Falls back to the title, then to `medium-<id>`.
 */
export function slugFromMedium(url: string, title: string, mediumId: string): string {
  let segment = '';
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    segment = decodeURIComponent(parts.at(-1) ?? '');
  } catch {
    segment = '';
  }
  segment = segment.replace(new RegExp(`-?${mediumId}$`, 'i'), '');
  for (const candidate of [slugify(segment), slugify(title)]) {
    if (candidate && !RESERVED_SLUGS.has(candidate)) return candidate;
  }
  return `medium-${mediumId}`;
}

/**
 * Reserves the file name of a new story. `taken` holds the lower-cased names of the posts on
 * disk and grows with every story created in the same run, so two stories that share a title
 * (their URLs differ only in the id suffix) never overwrite each other's file or images: the
 * later one gets `<slug>-<mediumId>`.
 */
export function claimSlug(slug: string, mediumId: string, taken: Set<string>): string {
  const name = taken.has(slug.toLowerCase()) ? `${slug}-${mediumId}` : slug;
  taken.add(name.toLowerCase());
  return name;
}

const TURKISH_WORDS = new Set(['ve', 'bir', 'bu', 'da', 'de', 'ile', 'için', 'çok', 'daha', 'gibi', 'olarak', 'ama', 'ne', 'mi', 'en', 'her', 'kadar', 'sonra', 'ise', 'veya']);
const ENGLISH_WORDS = new Set(['the', 'and', 'of', 'to', 'in', 'is', 'was', 'that', 'for', 'with', 'on', 'as', 'it', 'this', 'are', 'by', 'from', 'be', 'an', 'or']);

/**
 * Guesses the language of a post (feed items carry none; a `lang` already in the file wins).
 * Turkish evidence: words containing ç, ğ, ı, ö, ş, ü or İ, plus common Turkish function words;
 * English evidence: common English function words. Turkish prose has several such words per
 * sentence, while English text that merely quotes a name ("Atatürk") has one now and then.
 */
export function detectLang(text: string): 'en' | 'tr' {
  let turkish = 0;
  let english = 0;
  for (const word of text.match(/[\p{L}\p{M}]+/gu) ?? []) {
    const lower = word.toLowerCase();
    if (/[çğıöşüÇĞİÖŞÜ]/.test(word) || TURKISH_WORDS.has(lower)) turkish += 1;
    if (ENGLISH_WORDS.has(lower)) english += 1;
  }
  return turkish > english ? 'tr' : 'en';
}

/**
 * A first-draft description: the opening text cut at a word boundary to at most `max`
 * characters, with an ellipsis when shortened. The sync flags it for a hand-written rewrite.
 */
export function deriveDescription(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.–—-]+$/, '');
  return `${base}…`;
}
