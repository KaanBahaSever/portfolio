import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decodeXmlText, parseFeed } from '../scripts/medium/feed.ts';
import { planSync, readFrontmatter, renderFrontmatter } from '../scripts/medium/frontmatter.ts';

const fields = (title: string, description: string) =>
  [
    ['title', title],
    ['description', description],
    ['pubDate', new Date('2020-03-01T00:36:58.000Z')],
    ['updatedDate', undefined],
    ['lang', 'tr'],
    ['tags', ['apollo-11', 'atatürk']],
    ['source', 'medium'],
    ['mediumId', '2ddb23d72623'],
    ['mediumUpdated', new Date('2020-03-02T21:24:27.779Z')],
  ] as const;

test('frontmatter values are written as JSON and read back', () => {
  const block = renderFrontmatter(fields('Ay’dan Anıtkabir’e: "yolculuk" # 1', 'Kısa açıklama'));
  assert.match(block, /^---\n# Imported from Medium/);
  assert.match(block, /\ntitle: "Ay’dan Anıtkabir’e: \\"yolculuk\\" # 1"\n/);
  assert.match(block, /\npubDate: "2020-03-01T00:36:58.000Z"\n/);
  assert.match(block, /\ntags: \["apollo-11","atatürk"\]\n/);
  assert.doesNotMatch(block, /updatedDate/, 'undefined values are left out');

  const parsed = readFrontmatter(`${block}\nBody text\n`);
  assert.ok(parsed);
  assert.equal(parsed.values.title, 'Ay’dan Anıtkabir’e: "yolculuk" # 1');
  assert.deepEqual(parsed.values.tags, ['apollo-11', 'atatürk']);
  assert.equal(parsed.values.mediumId, '2ddb23d72623');
  assert.equal(parsed.body, '\nBody text\n');
});

test('an update keeps the curated description and language and every unmanaged key', () => {
  const existing = readFrontmatter(
    [
      '---',
      'title: Old title',
      'description: >-',
      '  Written by hand,',
      '  over two lines.',
      'lang: en',
      "heroImageAlt: 'Written alt'",
      '# Linked by hand',
      'relatedProject: rocket-up',
      'tags:',
      '  - old',
      'mediumSync: true',
      '---',
      '',
      'Old body',
    ].join('\r\n'),
  );
  assert.ok(existing);
  assert.equal(existing.values.description, 'Written by hand, over two lines.');
  assert.deepEqual(existing.values.tags, ['old']);
  assert.equal(existing.values.mediumSync, true);

  const block = renderFrontmatter(
    [...fields('New title', 'Generated'), ['heroImageAlt', 'Caption from the feed'] as const],
    existing,
  );
  assert.match(block, /\ntitle: "New title"\n/);
  assert.match(block, /\nheroImageAlt: 'Written alt'\n/);
  assert.doesNotMatch(block, /Caption from the feed/);
  assert.match(block, /\ndescription: >-\n {2}Written by hand,\n {2}over two lines\.\n/);
  assert.doesNotMatch(block, /Generated/);
  assert.match(block, /\nlang: en\n/);
  assert.match(block, /\n# Linked by hand\nrelatedProject: rocket-up\n/);
  assert.match(block, /\ntags: \["apollo-11","atatürk"\]\n/);
  assert.doesNotMatch(block, /- old/);
  assert.match(block, /\nmediumSync: true\n---\n$/);
});

test('files without frontmatter, and a fence inside a value, are handled', () => {
  assert.equal(readFrontmatter('# Just Markdown'), undefined);
  const parsed = readFrontmatter('---\ntitle: "wait---"\ndraft: false\n---\nx');
  assert.equal(parsed?.values.title, 'wait---');
  assert.equal(parsed?.values.draft, false);
  assert.equal(parsed?.body, 'x');
});

test('planSync skips locked and up-to-date posts', () => {
  const updated = new Date('2020-03-02T21:24:27.779Z');
  assert.equal(planSync(undefined, updated), 'create');
  assert.equal(planSync({ mediumSync: false, mediumUpdated: '2019-01-01T00:00:00Z' }, updated), 'skip-locked');
  assert.equal(planSync({ mediumSync: false }, updated, true), 'skip-locked', '--force never overrides mediumSync: false');
  assert.equal(planSync({ mediumUpdated: '2020-03-02T21:24:27.779Z' }, updated), 'skip-up-to-date');
  assert.equal(planSync({ mediumUpdated: '2020-03-02T21:24:27.779Z' }, updated, true), 'update');
  assert.equal(planSync({ mediumUpdated: '2020-03-01T00:00:00Z' }, updated), 'update');
  assert.equal(planSync({}, updated), 'update');
});

test('feed parsing decodes plain text, skips incomplete items and strips tracking', () => {
  assert.equal(decodeXmlText('a &amp; b &#x131; &#305; &lt;'), 'a & b ı ı <');
  const { items, skipped } = parseFeed(`<rss><channel>
    <item><title>Plain &amp; simple</title><link>https://medium.com/@a/plain-simple-0123456789ab?source=rss-x</link>
      <guid isPermaLink="false">https://medium.com/p/0123456789ab</guid><pubDate>Mon, 02 Mar 2020 10:00:00 GMT</pubDate>
      <content:encoded><![CDATA[<p>Hi</p>]]></content:encoded></item>
    <item><title><![CDATA[No date]]></title><link>https://medium.com/@a/x-0123456789ac</link></item>
  </channel></rss>`);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.title, 'Plain & simple');
  assert.equal(items[0]?.url, 'https://medium.com/@a/plain-simple-0123456789ab');
  assert.equal(items[0]?.updated.toISOString(), '2020-03-02T10:00:00.000Z', 'falls back to pubDate');
  assert.deepEqual(items[0]?.categories, []);
  assert.deepEqual(skipped, ['No date']);
});
