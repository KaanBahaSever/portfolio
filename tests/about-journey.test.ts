/**
 * The journey section writes its chapters out by hand (each has its own prose partial and
 * figure), while the chapter numbers, the list at the top and the figure numbers come from
 * JOURNEY_CHAPTERS and the catalogue. These checks keep the two in step: the markup follows
 * JOURNEY_CHAPTERS, every chapter uses its own number and figure, and a chapter shows a figure
 * exactly when its catalogue entry has a caption.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { LOCALES } from '../src/i18n/config.ts';
import { JOURNEY_CHAPTERS, aboutMessages, type JourneyChapter } from '../src/i18n/messages/about.ts';

const source = readFileSync(new URL('../src/components/about/Journey.astro', import.meta.url), 'utf8');

interface ChapterMarkup {
  id: string;
  numbers: string[];
  figures: string[];
  hasFigure: boolean;
  /** The drawing components inside the chapter's figure, e.g. ['AccessMatrix']. */
  drawings: string[];
}

/** The rendered chapters, in source order: one `<li class={item}>` each. */
function chapters(): ChapterMarkup[] {
  const list = source.slice(source.indexOf('<ol class="divide-y'));
  assert.ok(list.length < source.length, 'the list of chapters was found');
  return list
    .split('<li class={item}>')
    .slice(1)
    .map((block) => ({
      id: /id="journey-([a-z]+)"/.exec(block)?.[1] ?? '',
      numbers: [...block.matchAll(/number\('([a-z]+)'\)/g)].map((match) => match[1] ?? ''),
      figures: [...block.matchAll(/figure\('([a-z]+)'\)/g)].map((match) => match[1] ?? ''),
      hasFigure: /<Figure\b/.test(block),
      // Components imported from ./figures/ and used in this chapter.
      drawings: [...block.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)]
        .map((match) => match[1] ?? '')
        .filter((name) => source.includes(`import ${name} from './figures/`)),
    }));
}

const hasCaption = (key: JourneyChapter) => 'caption' in aboutMessages.en.journey.chapters[key];

test('the chapters are rendered in the order JOURNEY_CHAPTERS gives', () => {
  assert.deepEqual(
    chapters().map((chapter) => chapter.id),
    [...JOURNEY_CHAPTERS],
  );
});

test('every chapter uses its own number and figure number', () => {
  for (const { id, numbers, figures } of chapters()) {
    assert.deepEqual(numbers, [id], `#journey-${id}: chapter number`);
    for (const key of figures) assert.equal(key, id, `#journey-${id}: figure number of "${key}"`);
  }
});

test('crowd.inc shows the access matrix and the community chapter the odd-number square', () => {
  const byId = new Map(chapters().map((chapter) => [chapter.id, chapter.drawings]));
  assert.deepEqual(byId.get('work'), ['AccessMatrix']);
  assert.deepEqual(byId.get('community'), ['OddSquares']);
});

test('figures are numbered in reading order, one number per captioned chapter', () => {
  // Journey.astro numbers the figures by filtering JOURNEY_CHAPTERS on the caption; the same
  // filter here gives each chapter's expected number, so adding a figure renumbers the rest.
  assert.match(source, /JOURNEY_CHAPTERS\.filter\(\(key\) => 'caption' in c\[key\]\)/);
  const numbered = JOURNEY_CHAPTERS.filter(hasCaption);
  const rendered = chapters()
    .filter((chapter) => chapter.hasFigure)
    .map((chapter) => chapter.id);
  assert.deepEqual(rendered, numbered);
  // The two newest figures take their place in the sequence rather than going at the end.
  assert.ok(numbered.indexOf('work') < numbered.indexOf('core'));
  assert.equal(numbered.indexOf('community'), numbered.indexOf('work') + 1);
});

test('a chapter has a figure exactly when its catalogue entry has a caption', () => {
  for (const { id, figures, hasFigure } of chapters()) {
    const key = id as JourneyChapter;
    assert.equal(hasFigure, hasCaption(key), `#journey-${id}: figure and caption`);
    assert.equal(figures.length, hasFigure ? 1 : 0, `#journey-${id}: one figure number per figure`);
  }
  // A figure holds a drawing, and a drawing sits in a figure.
  for (const { id, hasFigure, drawings } of chapters()) {
    assert.equal(drawings.length > 0, hasFigure, `#journey-${id}: drawing and figure`);
  }
  // Both catalogues agree on which chapters have a caption, so the figure numbers do too.
  for (const locale of LOCALES) {
    for (const key of JOURNEY_CHAPTERS) {
      assert.equal('caption' in aboutMessages[locale].journey.chapters[key], hasCaption(key), `${locale}.${key}`);
    }
  }
});
