import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatters } from '../src/i18n/format.ts';
import { notepadMessages } from '../src/i18n/tools/notepad.ts';
import type { NotepadMessages } from '../src/i18n/tools/notepad.ts';
import { sanitizeFilename } from '../src/lib/files/save-file.ts';

const { en, tr } = notepadMessages;

/** Every leaf of a catalogue as [path, value]. */
function leaves(value: unknown, path = ''): Array<[string, unknown]> {
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
  }
  return [[path, value]];
}

test('both locales have the same keys, and no string is empty', () => {
  const enLeaves = leaves(en);
  const trLeaves = leaves(tr);
  assert.deepEqual(
    trLeaves.map(([path]) => path),
    enLeaves.map(([path]) => path),
  );
  for (const [path, value] of [...enLeaves, ...trLeaves]) {
    assert.ok(typeof value === 'function' || (typeof value === 'string' && value.trim() !== ''), path);
  }
});

test('interface labels are translated, not copied', () => {
  // Strings that are the same in both languages on purpose.
  const shared = new Set(['status.lf', 'status.crlf']);
  const trByPath = new Map(leaves(tr));
  for (const [path, value] of leaves(en)) {
    if (typeof value !== 'string' || shared.has(path)) continue;
    assert.notEqual(trByPath.get(path), value, `${path} is not translated`);
  }
});

test('English counts use the singular for one', () => {
  const f = formatters('en');
  assert.equal(en.status.lines(1, f.number(1)), '1 line');
  assert.equal(en.status.lines(0, f.number(0)), '0 lines');
  assert.equal(en.status.words(12_345, f.number(12_345)), '12,345 words');
  assert.equal(en.replace.replacedAll(1, '1'), 'Replaced 1 occurrence');
  assert.equal(en.replace.replacedAll(3, '3'), 'Replaced 3 occurrences');
  assert.equal(en.replace.replacedLeft(1, '1'), 'Replaced. 1 match left.');
  assert.equal(en.search.position('3', '120'), '3 of 120');
});

test('Turkish nouns stay singular after numbers, formatted the Turkish way', () => {
  const f = formatters('tr');
  assert.equal(tr.status.lines(1, f.number(1)), '1 satır');
  assert.equal(tr.status.lines(2, f.number(2)), '2 satır');
  assert.equal(tr.status.words(12_345, f.number(12_345)), '12.345 kelime');
  assert.equal(tr.replace.replacedAll(3, '3'), '3 eşleşme değiştirildi');
  assert.equal(tr.stats.minutes(f.number(4)), '4 dk');
});

test('interpolated names and numbers need no Turkish case suffix', () => {
  // A value followed directly by an apostrophe or letters would need a suffix chosen by its
  // pronunciation ("12'den", "“a.txt”yi"); every placeholder must end at a space or punctuation.
  const samples: Array<[string, string]> = [
    [tr.files.readError('a.txt'), '“a.txt” okunamadı.'],
    [tr.files.opened('notlar.md'), '“notlar.md” açıldı'],
    [tr.files.downloaded('x.json'), '“x.json” indirildi'],
    [tr.files.tooLarge('büyük.log', '25,0 MB', '20 MB'), '“büyük.log” çok büyük (25,0 MB). Açılabilecek en büyük boyut: 20 MB.'],
    [tr.replace.replacedLeft(2, '2'), 'Değiştirildi. Kalan eşleşme: 2.'],
    [tr.search.positionSpoken('3', '12'), 'Eşleşme 3, toplam 12'],
  ];
  for (const [actual, expected] of samples) assert.equal(actual, expected);
});

test('shortcut hints and saved times read naturally', () => {
  assert.equal(en.withShortcut(en.titles.download, 'Ctrl+S'), 'Download as a file (Ctrl+S)');
  assert.equal(tr.withShortcut(tr.titles.zen, 'Ctrl+Shift+Enter'), 'Odak modu: tam ekran, yalnızca metin (Ctrl+Shift+Enter)');
  assert.equal(en.status.saved('2:05 PM'), 'Saved in this browser · 2:05 PM');
  assert.equal(tr.status.saved('14:05'), 'Bu tarayıcıya kaydedildi · 14:05');
});

test('the default file names survive sanitizing unchanged', () => {
  for (const messages of [en, tr] satisfies NotepadMessages[]) {
    assert.equal(sanitizeFilename(messages.defaultFilename), messages.defaultFilename);
    assert.equal(sanitizeFilename('', messages.defaultFilename), messages.defaultFilename);
  }
});
