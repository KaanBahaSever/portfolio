import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { markdownToHtml } from 'satteri';

import {
  cleanHref,
  convertArticle,
  escapeMarkdownText,
  inspectArticle,
  readImageAlts,
  type ConvertOptions,
} from '../scripts/medium/convert.ts';
import { deriveDescription, detectLang, parseFeed, slugFromMedium } from '../scripts/medium/feed.ts';

const fixture = readFileSync(new URL('./fixtures/medium-feed.xml', import.meta.url), 'utf8');
const [story] = parseFeed(fixture).items;

const options = (overrides: Partial<ConvertOptions> = {}): ConvertOptions => ({
  title: 'A story',
  lang: 'en',
  imagePath: (_image, index) => `../../assets/blog/a-story/${String(index + 1).padStart(2, '0')}.jpg`,
  ...overrides,
});

/** Renders Markdown the way the site does (math on), to check what readers would see. */
const render = (markdown: string): string => markdownToHtml(markdown, { features: { math: true } }).html;

test('the fixture story is parsed with its identity, dates and tags', () => {
  assert.ok(story);
  assert.equal(story.title, 'Ay’dan Anıtkabir’e Yolculuk');
  assert.equal(story.mediumId, '2ddb23d72623');
  assert.equal(story.url, 'https://medium.com/@KaanBahaSever/aydan-an%C4%B1tkabir-e-yolculuk-2ddb23d72623');
  assert.deepEqual(story.categories, ['apollo-11', 'atatürk']);
  assert.equal(story.pubDate.toISOString(), '2020-03-01T00:36:58.000Z');
  assert.equal(story.updated.toISOString(), '2020-03-02T21:24:27.779Z');
  assert.match(story.html, /^<figure>/);
});

test('slug, language and description draft come from the story', () => {
  assert.ok(story);
  assert.equal(slugFromMedium(story.url, story.title, story.mediumId), 'aydan-anitkabir-e-yolculuk');
  const info = inspectArticle(story.html, story.title);
  assert.equal(detectLang(info.text), 'tr');
  assert.match(info.firstParagraph, /^Tarih: 21 Temmuz 1969\./);
  const description = deriveDescription(info.firstParagraph);
  assert.ok(description.length <= 155);
  assert.ok(description.endsWith('…'));
});

test('the opening figure becomes the hero; the tracking pixel is dropped', () => {
  assert.ok(story);
  const info = inspectArticle(story.html, story.title);
  assert.equal(info.images.length, 3);
  assert.equal(info.hasHero, true);
  assert.equal(info.images[0]?.downloadUrl, 'https://miro.medium.com/v2/1*QYhZARZSqWoj8F1c9UM7Kg.jpeg');

  const result = convertArticle(story.html, options({ title: story.title, lang: 'tr' }));
  assert.equal(result.hero?.alt, 'Mozoleye çelenk bırakırken, soldan sağa; Buzz Aldrin, Neil Armstrong, Michael Collins');
  assert.doesNotMatch(result.markdown, /01\.jpg/, 'the hero is not repeated in the body');
  assert.doesNotMatch(result.markdown, /_\/stat|medium\.com/);
  assert.match(
    result.markdown,
    /<figure>\n\n!\[Ankara halkını selamlarken\]\(\.\.\/\.\.\/assets\/blog\/a-story\/02\.jpg\)\n\n<figcaption>Ankara halkını selamlarken<\/figcaption>\n<\/figure>/,
  );
  // The uncaptioned third image has no alt text: kept, and reported.
  assert.match(result.markdown, /^!\[\]\(\.\.\/\.\.\/assets\/blog\/a-story\/03\.jpg\)$/m);
  assert.deepEqual(
    result.warnings.map((warning) => warning.code),
    ['empty-alt'],
  );

  const html = render(result.markdown);
  assert.equal((html.match(/<p>/g) ?? []).length, 5, 'three paragraphs and two image paragraphs');
  assert.match(html, /<figure>\n<p><img src="\.\.\/\.\.\/assets\/blog\/a-story\/02\.jpg" alt="Ankara halkını selamlarken"><\/p>/);
  assert.match(html, /“one small step for a man, one giant leap for mankind\.“/, 'typographic quotes survive');
  assert.doesNotMatch(html, /math/);
});

test('alt text written by hand survives a re-sync', () => {
  assert.ok(story);
  const first = convertArticle(story.html, options({ title: story.title, lang: 'tr' }));
  const edited = first.markdown.replace('![](../../assets/blog/a-story/03.jpg)', '![Gazete \\[1969\\] manşeti](../../assets/blog/a-story/03.jpg)');
  const alts = readImageAlts(edited);
  assert.equal(alts.get('../../assets/blog/a-story/03.jpg'), 'Gazete [1969] manşeti');
  assert.equal(alts.get('../../assets/blog/a-story/02.jpg'), 'Ankara halkını selamlarken');

  const again = convertArticle(story.html, options({ title: story.title, lang: 'tr', knownAlt: (path) => alts.get(path) }));
  assert.equal(again.markdown, edited);
  assert.deepEqual(again.warnings, []);
});

test('text is escaped for Markdown with math enabled', () => {
  assert.equal(escapeMarkdownText('$5 or $10'), '\\$5 or \\$10');
  assert.equal(escapeMarkdownText('snake_case and _x_'), 'snake_case and \\_x\\_');
  assert.equal(escapeMarkdownText('a*b* [c] <d> `e` ~f~ \\'), 'a\\*b\\* \\[c\\] \\<d> \\`e\\` \\~f\\~ \\\\');
  assert.equal(escapeMarkdownText('&amp; & AT&T'), '&amp;amp; & AT&T');

  const { markdown } = convertArticle('<p>It costs $5 or $10 &lt;b&gt; *not bold*</p><p>1969. yılında</p><p># no heading</p>', options());
  const html = render(markdown);
  assert.match(html, /<p>It costs \$5 or \$10 &lt;b&gt; \*not bold\*<\/p>/);
  assert.match(html, /<p>1969\. yılında<\/p>/);
  assert.match(html, /<p># no heading<\/p>/);
});

test('inline formatting, links and line breaks', () => {
  const { markdown } = convertArticle(
    '<p><strong>Bold</strong> and <em>italic</em>, <code>x = `y`</code>, a<br>b, ' +
      '<a href="https://medium.com/@a/b-123?source=post_page">link</a>, <a href="javascript:alert(1)">bad</a>, ' +
      'x<strong>“quoted”</strong>y</p>',
    options(),
  );
  assert.match(markdown, /^\*\*Bold\*\* and \*italic\*, `` x = `y` ``, a\\\nb, /);
  assert.match(markdown, /\[link\]\(https:\/\/medium\.com\/@a\/b-123\)/);
  assert.match(markdown, /, bad, /);
  assert.match(markdown, /x<strong>“quoted”<\/strong>y/, 'falls back to HTML where ** would not close');
  const html = render(markdown);
  assert.match(html, /<strong>Bold<\/strong> and <em>italic<\/em>/);
  assert.match(html, /a<br>\nb/);
  assert.equal(cleanHref('data:text/html,x'), undefined);
});

test('code blocks keep their text and get a safe fence; missing languages are reported', () => {
  const { markdown, warnings } = convertArticle(
    '<pre>const a = 1;<br>if (a &lt; 2) {<br>  log("```");<br>}</pre>' +
      '<pre data-code-block-lang="go">fmt.Println($x)</pre>',
    options(),
  );
  assert.equal(
    markdown,
    '````\nconst a = 1;\nif (a < 2) {\n  log("```");\n}\n````\n\n```go\nfmt.Println($x)\n```\n',
  );
  assert.deepEqual(
    warnings.map((warning) => warning.code),
    ['code-without-language'],
  );
});

test('headings, lists, quotes and rules', () => {
  const { markdown } = convertArticle(
    '<h3>A story</h3><p>Intro</p><h3>Section</h3><h4>Detail</h4>' +
      '<ul><li>one</li><li>two <em>2</em></li></ul><ol start="3"><li>three</li></ol>' +
      '<blockquote class="graf--pullquote">Quoted<br>twice</blockquote><hr>',
    options(),
  );
  assert.equal(
    markdown,
    'Intro\n\n## Section\n\n### Detail\n\n- one\n- two *2*\n\n3. three\n\n> Quoted\\\n> twice\n\n---\n',
  );
});

test('embeds become links with a warning; a late first figure is not a hero', () => {
  const result = convertArticle(
    '<p>Before</p><figure><iframe src="https://medium.com/media/abc123/href"></iframe></figure>' +
      '<figure><a href="https://example.com/"><img alt="A chart" src="https://miro.medium.com/v2/resize:fit:800/1*x.png"></a></figure>',
    options({ lang: 'tr' }),
  );
  assert.equal(result.hero, undefined);
  assert.match(result.markdown, /\[Medium’daki gömülü içerik\]\(https:\/\/medium\.com\/media\/abc123\/href\)/);
  assert.match(result.markdown, /\[!\[A chart\]\(\.\.\/\.\.\/assets\/blog\/a-story\/01\.jpg\)\]\(https:\/\/example\.com\/\)/);
  assert.deepEqual(
    result.warnings.map((warning) => warning.code),
    ['embed'],
  );
  const info = inspectArticle('<p>Before</p><figure><img src="https://cdn-images-1.medium.com/max/1024/1*y.gif"></figure>', 'T');
  assert.equal(info.hasHero, false);
  assert.equal(info.images[0]?.downloadUrl, 'https://miro.medium.com/v2/1*y.gif');
  assert.equal(info.images[0]?.extension, 'gif');
});

test('language detection and slugs', () => {
  assert.equal(detectLang('The Apollo 11 crew visited Atatürk’s mausoleum in Ankara in October 1969.'), 'en');
  assert.equal(detectLang('Ay’a iniş sadece bir ırkın değil tüm Dünya’nın başarısıdır.'), 'tr');
  assert.equal(slugFromMedium('https://medium.com/@a/%C3%87ok-g%C3%BCzel-%C4%B0stanbul-0123456789ab', 'x', '0123456789ab'), 'cok-guzel-istanbul');
  // A slug may never be a locale prefix.
  assert.equal(slugFromMedium('https://medium.com/@a/tr-0123456789ab', 'TR', '0123456789ab'), 'medium-0123456789ab');
});
