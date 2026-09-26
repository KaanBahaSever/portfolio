/**
 * CV builder: `npm run cv` (node scripts/build-cv.ts) writes the CV in both languages, to the
 * paths the site links (SITE.cvPath):
 *
 *   public/cv/kaan-cv.pdf      English
 *   public/cv/kaan-cv-tr.pdf   Turkish
 *
 * The CVs are generated from the same data as the site — src/data/resume.ts for experience,
 * education, volunteering, activities, skills and languages, src/data/cv.ts for the headline,
 * summary and project lines, src/config/site.ts for contact links — so they cannot drift from
 * the site again. One template serves both languages: every word it adds (section titles, the
 * footer, the metadata) comes from src/i18n/messages/cv.ts. Re-run it after changing any of those
 * files and commit the PDFs.
 *
 * How: the data is rendered into a print-styled HTML page (A4, the site's typefaces read straight
 * from node_modules), which a local headless Chrome or Edge prints to PDF with real, clickable
 * links and a tagged structure. pdf-lib then sets the document metadata (Info + XMP).
 * Needs Chrome, Chromium or Edge; set CHROME_PATH if it is not found. Nothing is fetched.
 *
 * Layout choices that keep the CV readable by applicant-tracking systems: one column, each
 * section heading on its own line before its content, all text as real text (the only graphic is
 * the decorative brand mark), static fonts (Chrome turns variable fonts into Type 3 fonts,
 * which PDF checkers flag), and at most two pages (the build fails otherwise). The Turkish text
 * runs longer than the English: keep it within the limit by tightening the wording in
 * src/data/cv.ts, never by shrinking the type.
 *
 *   --lang en|tr  build only the CV in this language.
 *   --keep-html   also write the intermediate HTML next to each PDF (public/cv/kaan-cv.html,
 *                 public/cv/kaan-cv-tr.html; gitignored) to inspect the layout in a browser.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PDFDocument, PDFName } from 'pdf-lib';

import { SITE } from '../src/config/site.ts';
import { CV } from '../src/data/cv.ts';
import {
  ACTIVITIES,
  CERTIFICATIONS,
  EDUCATION,
  EXPERIENCE,
  LANGUAGES,
  SKILLS,
  VOLUNTEERING,
  resumeText,
  type ActivityItem,
  type ResumePeriod,
  type ResumeText,
} from '../src/data/resume.ts';
import { LOCALES, LOCALE_META, isLocale, type Locale } from '../src/i18n/config.ts';
import { cvMessages } from '../src/i18n/messages/cv.ts';
import { formatPeriod } from '../src/utils/resume-dates.ts';

const MAX_PAGES = 2;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Where the CV in `locale` goes: the public/ file behind the path the site links. */
const outputPath = (locale: Locale) => join(ROOT, 'public', ...SITE.cvPath[locale].split('/').filter(Boolean));

// ---------------------------------------------------------------------------------------------
// Options

interface Options {
  locales: readonly Locale[];
  keepHtml: boolean;
}

function parseOptions(args: readonly string[]): Options {
  const usage = `Options: --lang ${LOCALES.join('|')} (one language; default: all), --keep-html.`;
  let locales: readonly Locale[] = LOCALES;
  let keepHtml = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--keep-html') {
      keepHtml = true;
    } else if (arg === '--lang' || arg?.startsWith('--lang=')) {
      const value = arg === '--lang' ? args[++i] : arg.slice('--lang='.length);
      if (!isLocale(value)) throw new Error(`--lang needs one of ${LOCALES.join(', ')}, not "${value ?? ''}". ${usage}`);
      locales = [value];
    } else {
      throw new Error(`Unknown option "${arg}". ${usage}`);
    }
  }
  return { locales, keepHtml };
}

// ---------------------------------------------------------------------------------------------
// HTML

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** A CSS string literal (for `content:`), escaped for CSS rather than HTML. */
const cssString = (value: string) => `"${value.replace(/[\\"]/g, '\\$&').replace(/</g, '\\3C ')}"`;

const link = (href: string, label: string) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
const withoutScheme = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
/** Joins the parts of a meta line with the same spaced separator as the one before it. */
const joinMeta = (parts: readonly string[]) => parts.join('<span class="sep">·</span>');

/**
 * The site's typefaces as static files (latin + latin-ext: Turkish letters such as ğ, ş and İ
 * are in latin-ext), only in the weights the stylesheet below uses.
 */
function fontFaces(): string {
  const file = (pkg: string, name: string) =>
    pathToFileURL(join(ROOT, 'node_modules', '@fontsource', pkg, 'files', name)).href;
  const faces: [family: string, pkg: string, weight: number][] = [
    ['Plex Sans', 'ibm-plex-sans', 400],
    ['Plex Sans', 'ibm-plex-sans', 600],
    ['Newsreader', 'newsreader', 500],
    ['JetBrains Mono', 'jetbrains-mono', 400],
    ['JetBrains Mono', 'jetbrains-mono', 500],
  ];
  const ranges = {
    // latin-ext first: for overlapping characters the face declared last wins.
    'latin-ext':
      'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
    latin:
      'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  };
  return faces
    .flatMap(([family, pkg, weight]) =>
      Object.entries(ranges).map(
        ([subset, range]) =>
          `@font-face { font-family: "${family}"; font-style: normal; font-weight: ${weight};
  src: url("${file(pkg, `${pkg}-${subset}-${weight}-normal.woff2`)}") format("woff2"); unicode-range: ${range}; }`,
      ),
    )
    .join('\n');
}

const bullets = (items: readonly string[]) =>
  items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '';

function entry(opts: { title: string; meta?: string; period?: string; body?: string }): string {
  return `<article class="entry">
  <div class="entry-head">
    <h3>${opts.title}${opts.meta ? `<span class="meta">${opts.meta}</span>` : ''}</h3>
    ${opts.period ? `<p class="period">${opts.period}</p>` : ''}
  </div>
  ${opts.body ?? ''}
</article>`;
}

function section(id: string, title: string, content: string): string {
  return `<section id="${id}" aria-labelledby="${id}-title">
  <h2 id="${id}-title">${escapeHtml(title)}</h2>
  <div class="section-body">${content}</div>
</section>`;
}

function renderHtml(locale: Locale): string {
  const cv = CV[locale];
  const m = cvMessages[locale];
  const text = (value: ResumeText) => resumeText(value, locale);
  const period = (item: ResumePeriod) => escapeHtml(formatPeriod(item, locale).text);

  const activity = (item: ActivityItem): string => {
    const title = escapeHtml(item.role ? m.role(item.role[locale], text(item.title)) : text(item.title));
    const meta = joinMeta(
      [item.organization && text(item.organization), item.location?.[locale]]
        .filter((part): part is string => Boolean(part))
        .map(escapeHtml),
    );
    return entry({ title, meta: meta || undefined, period: period(item), body: bullets(item.highlights[locale]) });
  };

  // Two fixed lines (reach me / find my work), so a wrap never starts a line with a separator.
  const contactLines = [
    [
      escapeHtml(SITE.location[locale]),
      link(cv.phone.href, cv.phone.label),
      link(`mailto:${SITE.email}`, SITE.email),
      link(SITE.url, withoutScheme(SITE.url)),
    ],
    SITE.socials.map((social) => link(social.href, withoutScheme(social.href))),
  ];

  const experience = EXPERIENCE.map((job) =>
    entry({
      title: escapeHtml(text(job.role)),
      meta: job.url ? link(job.url, text(job.organization)) : escapeHtml(text(job.organization)),
      period: period(job),
      body: `<p>${escapeHtml(job.summary[locale])}</p>${bullets(job.highlights[locale])}<p class="stack">${job.stack.map(escapeHtml).join(' · ')}</p>`,
    }),
  ).join('');

  const projects = cv.projects
    .map((project) =>
      entry({
        title: escapeHtml(project.name),
        meta: project.url && project.linkLabel ? link(project.url, project.linkLabel) : undefined,
        period: escapeHtml(project.period),
        body: `<p>${escapeHtml(project.text)}</p><p class="stack">${project.stack.map(escapeHtml).join(' · ')}</p>`,
      }),
    )
    .join('');

  const education = EDUCATION.map((school) =>
    entry({
      title: escapeHtml(m.degree(school.degree[locale], school.field[locale])),
      meta: joinMeta(
        [school.institution[locale], school.department?.[locale]]
          .filter((part): part is string => Boolean(part))
          .map(escapeHtml),
      ),
      period: period(school),
      body: bullets(school.highlights[locale]),
    }),
  ).join('');

  const research = [
    ...cv.research.map((item) =>
      entry({
        title: escapeHtml(item.title),
        meta: item.url && item.linkLabel ? link(item.url, item.linkLabel) : undefined,
        period: item.period ? escapeHtml(item.period) : undefined,
        body: `<p>${escapeHtml(item.text)}</p>`,
      }),
    ),
    ...ACTIVITIES.filter((item) => item.highlights[locale].length > 0).map(activity),
  ].join('');

  const other = [...CERTIFICATIONS, ...ACTIVITIES.filter((item) => item.highlights[locale].length === 0)]
    .map(activity)
    .join('');

  const skills = `<dl class="skills">${SKILLS.map(
    (group) =>
      `<div><dt>${escapeHtml(group.label[locale])}</dt><dd>${group.items.map((item) => escapeHtml(text(item))).join(' · ')}</dd></div>`,
  ).join('')}</dl>`;

  const languages = `<p>${LANGUAGES.map((language) =>
    escapeHtml(language.level ? m.language(language.name[locale], language.level[locale]) : language.name[locale]),
  ).join(' · ')}</p>`;

  return `<!doctype html>
<html lang="${LOCALE_META[locale].htmlLang}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(m.documentTitle(SITE.name))}</title>
<meta name="author" content="${escapeHtml(SITE.name)}">
<style>
${fontFaces()}
@page {
  size: A4;
  margin: 13mm 14mm 14mm 14mm;
  @bottom-right {
    content: ${cssString(`${SITE.name} · ${m.footer} · `)} counter(page) " / " counter(pages);
    font-family: "JetBrains Mono", monospace; font-size: 7pt; color: #71717a; vertical-align: top; padding-top: 3mm;
  }
}
:root {
  --ink: #18181b; --body: #3f3f46; --muted: #52525b; --faint: #71717a; --rule: #e4e4e7;
  --accent: #00755d; /* accent-700 = oklch(0.5 0.097 172), as on the site; 5.7:1 on white */
}
* { box-sizing: border-box; }
html { font-family: "Plex Sans", system-ui, sans-serif; font-size: 9pt; line-height: 1.4; color: var(--ink);
  -webkit-print-color-adjust: exact; print-color-adjust: exact; font-kerning: normal; }
body { margin: 0; }
a { color: inherit; text-decoration: none; }
p, ul, dl, h1, h2, h3 { margin: 0; }
p, li { text-wrap: pretty; }

header { display: flex; justify-content: space-between; align-items: flex-end; gap: 6mm;
  padding-bottom: 3.2mm; border-bottom: 0.8pt solid var(--ink); }
.mark { width: 11mm; height: 11mm; flex: none; }
h1 { font-family: "Newsreader", Georgia, serif; font-weight: 500; font-size: 23pt; line-height: 1.05; letter-spacing: -0.01em; }
/* Capitals come from CSS, which follows html lang: Turkish "geliştirici" becomes "GELİŞTİRİCİ". */
.headline { margin-top: 1.4mm; font-family: "JetBrains Mono", monospace; font-size: 7.5pt; letter-spacing: 0.05em;
  text-transform: uppercase; color: var(--accent); }
.contact { display: flex; flex-wrap: wrap; column-gap: 3.2mm; row-gap: 0.6mm; color: var(--muted); font-size: 8pt; }
.headline + .contact { margin-top: 2.4mm; }
.contact + .contact { margin-top: 0.7mm; }
.contact > * + *::before { content: "·"; margin-right: 3.2mm; color: var(--faint); }
.summary { margin-top: 3.4mm; font-size: 9.5pt; line-height: 1.45; color: #27272a; }

/* One column: each heading sits on its own line before its content (clean reading order). */
section { padding-top: 2.6mm; margin-top: 2.8mm; border-top: 0.5pt solid var(--rule); break-inside: avoid; }
/* Long sections may continue on the next page (entries themselves never split). */
#projects, #leadership { break-inside: auto; }
h2 { font-family: "JetBrains Mono", monospace; font-size: 7.5pt; font-weight: 500; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--accent); margin-bottom: 1.4mm; break-after: avoid; }
.section-body > * + * { margin-top: 2.2mm; }

.entry { break-inside: avoid; }
.entry-head { display: flex; justify-content: space-between; align-items: baseline; gap: 4mm; }
h3 { font-size: 9.3pt; font-weight: 600; line-height: 1.3; }
.meta { font-weight: 400; color: var(--muted); }
.meta::before, .sep { content: "·"; margin: 0 1.6mm; color: var(--faint); }
.meta a { color: var(--muted); }
.period { flex: none; font-family: "JetBrains Mono", monospace; font-size: 7.5pt; color: var(--muted);
  font-variant-numeric: tabular-nums; white-space: nowrap; }
.entry p, .entry ul { margin-top: 0.6mm; color: var(--body); }
ul { padding-left: 3.4mm; }
li { margin-top: 0.3mm; }
li::marker { content: "– "; color: var(--faint); }
.stack { font-family: "JetBrains Mono", monospace; font-size: 7.5pt; color: var(--faint) !important; letter-spacing: 0.01em; }

.skills { display: grid; grid-template-columns: 36mm 1fr; row-gap: 0.8mm; column-gap: 3mm; }
.skills > div { display: contents; }
dt { font-weight: 600; }
dd { margin: 0; color: var(--body); }
</style>
</head>
<body>
<header>
  <div>
    <h1>${escapeHtml(SITE.name)}</h1>
    <p class="headline">${escapeHtml(cv.headline)}</p>
    ${contactLines.map((line) => `<p class="contact">${line.map((item) => `<span>${item}</span>`).join('')}</p>`).join('\n    ')}
  </div>
  <svg class="mark" viewBox="2 2 28 28" aria-hidden="true">
    <path d="M8 6H12L24 26H20L16 19.333L12 26H8L14 16Z" fill="#18181b"></path>
    <circle cx="16" cy="16" r="3" fill="#009375"></circle>
  </svg>
</header>
<p class="summary">${escapeHtml(cv.summary)}</p>
${section('experience', m.sections.experience, experience)}
${section('projects', m.sections.projects, projects)}
${section('education', m.sections.education, education)}
${section('leadership', m.sections.leadership, VOLUNTEERING.map(activity).join(''))}
${section('research', m.sections.research, research)}
${section('skills', m.sections.skills, skills)}
${section('other', m.sections.other, other)}
${section('languages', m.sections.languages, languages)}
</body>
</html>`;
}

// ---------------------------------------------------------------------------------------------
// PDF

function findBrowser(): string {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter((path): path is string => Boolean(path));
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error('No Chrome, Chromium or Edge found: set CHROME_PATH to the browser executable.');
  return found;
}

/** XMP metadata packet: some indexers and PDF/UA checkers read it instead of the Info dictionary. */
function xmpPacket(meta: { title: string; description: string; language: string }): Uint8Array {
  const esc = (value: string) => escapeHtml(value);
  const xmp = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${esc(meta.title)}</rdf:li></rdf:Alt></dc:title>
   <dc:creator><rdf:Seq><rdf:li>${esc(SITE.name)}</rdf:li></rdf:Seq></dc:creator>
   <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${esc(meta.description)}</rdf:li></rdf:Alt></dc:description>
   <dc:language><rdf:Bag><rdf:li>${esc(meta.language)}</rdf:li></rdf:Bag></dc:language>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
  return new TextEncoder().encode(xmp);
}

/** Prints the CV in `locale` to its public/ path and returns the page count. */
async function buildCv(locale: Locale, work: string, keepHtml: boolean): Promise<number> {
  const output = outputPath(locale);
  const htmlPath = join(work, `cv-${locale}.html`);
  const pdfPath = join(work, `cv-${locale}.pdf`);
  writeFileSync(htmlPath, renderHtml(locale));
  if (keepHtml) copyFileSync(htmlPath, output.replace(/\.pdf$/, '.html'));

  // A throwaway profile keeps the print away from any running browser session.
  execFileSync(
    findBrowser(),
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${join(work, `profile-${locale}`)}`,
      '--allow-file-access-from-files',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=10000',
      '--no-pdf-header-footer',
      '--export-tagged-pdf',
      `--print-to-pdf=${pdfPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { stdio: 'ignore', timeout: 120_000 },
  );
  if (!existsSync(pdfPath)) throw new Error(`The browser did not write the ${locale} PDF.`);

  const raw = readFileSync(pdfPath);
  if (raw.includes('/Subtype /Type3')) throw new Error(`Type 3 fonts in the ${locale} CV: use static font files.`);

  const pdf = await PDFDocument.load(raw, { updateMetadata: false });
  const pages = pdf.getPageCount();
  if (pages > MAX_PAGES) throw new Error(`The ${locale} CV runs to ${pages} pages; trim it to ${MAX_PAGES}.`);

  const m = cvMessages[locale];
  const title = m.documentTitle(SITE.name);
  const language = LOCALE_META[locale].htmlLang;
  pdf.setTitle(title, { showInWindowTitleBar: true });
  pdf.setAuthor(SITE.name);
  pdf.setSubject(CV[locale].headline);
  // One string: pdf-lib joins an array with spaces, which would merge the phrases.
  pdf.setKeywords([m.keywords]);
  pdf.setLanguage(language);
  pdf.setCreator('scripts/build-cv.ts (kaanbahasever.com)');
  pdf.setProducer('Chrome headless + pdf-lib');
  const now = new Date();
  pdf.setCreationDate(now);
  pdf.setModificationDate(now);
  pdf.catalog.set(
    PDFName.of('Metadata'),
    pdf.context.register(
      pdf.context.stream(xmpPacket({ title, description: CV[locale].headline, language }), {
        Type: 'Metadata',
        Subtype: 'XML',
      }),
    ),
  );
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, await pdf.save({ useObjectStreams: false }));
  console.log(`Wrote ${output.replace(ROOT, '.')} (${pages} page${pages === 1 ? '' : 's'}).`);
  return pages;
}

const options = parseOptions(process.argv.slice(2));
const work = mkdtempSync(join(tmpdir(), 'kbs-cv-'));
try {
  for (const locale of options.locales) await buildCv(locale, work, options.keepHtml);
} finally {
  rmSync(work, { recursive: true, force: true });
}
