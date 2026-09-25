/**
 * Rich text for the console, as plain JSON-safe data.
 *
 * The page builds every file and document at build time (src/lib/console/data.ts), serialises
 * it into a <script type="application/json">, and the client renders it with DOM APIs
 * (textContent and createElement only, never innerHTML). Keeping the text as data rather than
 * HTML means translated strings can carry links and emphasis without any markup injection.
 *
 * Pure module: no DOM, no `astro:*`, erasable TypeScript only (node --test imports it).
 */

/** Monochrome phosphor has no hues, only intensities: headings are bright, asides dim. */
export type Tone = 'bright' | 'dim';

export interface StyledSpan {
  text: string;
  tone?: Tone;
  /** A site path ('/projects/asion/'), an http(s) URL or a mailto: link. Rendered as <a>. */
  href?: string;
  /** A command to run when the span is activated (rendered as a <button>), e.g. 'whoami'. */
  run?: string;
}

export type Span = string | StyledSpan;

export type Line =
  /** A paragraph that wraps. `indent` is a hanging indent in character cells. */
  | { type: 'text'; spans: readonly Span[]; indent?: number; lang?: string }
  /** A term and its description: two columns when they fit, stacked on narrow screens. */
  | { type: 'pair'; term: readonly Span[]; desc: readonly Span[] }
  /** Preformatted ASCII art that never wraps; `highlight` characters are drawn bright. */
  | { type: 'art'; rows: readonly string[]; label: string; highlight?: string }
  | { type: 'blank' };

export const bright = (text: string): StyledSpan => ({ text, tone: 'bright' });
export const dim = (text: string): StyledSpan => ({ text, tone: 'dim' });
export const link = (text: string, href: string): StyledSpan => ({ text, href });
export const run = (command: string): StyledSpan => ({ text: command, run: command });

export const text = (...spans: Span[]): Line => ({ type: 'text', spans });
export const indented = (indent: number, ...spans: Span[]): Line => ({ type: 'text', spans, indent });
export const blank = (): Line => ({ type: 'blank' });
export const heading = (title: string): Line => text(bright(title));

export function pair(term: Span | readonly Span[], ...desc: Span[]): Line {
  return { type: 'pair', term: Array.isArray(term) ? term : [term as Span], desc };
}

export function spanText(span: Span): string {
  return typeof span === 'string' ? span : span.text;
}

/** The text of a line as it reads on screen (tests, measuring column widths). */
export function plainText(line: Line): string {
  switch (line.type) {
    case 'text':
      return line.spans.map(spanText).join('');
    case 'pair':
      return `${line.term.map(spanText).join('')} ${line.desc.map(spanText).join('')}`.trimEnd();
    case 'art':
      return line.rows.join('\n');
    case 'blank':
      return '';
  }
}

/**
 * Links the renderer may create: site paths, http(s) URLs and mailto: addresses. Anything else
 * (javascript:, data:, protocol-relative '//host') is rendered as plain text.
 */
export function isSafeHref(href: string): boolean {
  if (href.startsWith('/')) return !href.startsWith('//') && !href.startsWith('/\\');
  return /^(https?:\/\/|mailto:)[^\s]+$/i.test(href);
}

/** A URL as a person would type it: 'https://www.asion.app/' → 'asion.app'. */
export function displayUrl(url: string): string {
  if (/^mailto:/i.test(url)) return url.slice('mailto:'.length);
  return url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}

/** Returns the lines with every link passed through `map` (used to localize site paths). */
export function mapHrefs(lines: readonly Line[], map: (href: string) => string): Line[] {
  const mapSpans = (spans: readonly Span[]): Span[] =>
    spans.map((span) => (typeof span !== 'string' && span.href ? { ...span, href: map(span.href) } : span));
  return lines.map((line) => {
    switch (line.type) {
      case 'text':
        return { ...line, spans: mapSpans(line.spans) };
      case 'pair':
        return { ...line, term: mapSpans(line.term), desc: mapSpans(line.desc) };
      default:
        return line;
    }
  });
}
