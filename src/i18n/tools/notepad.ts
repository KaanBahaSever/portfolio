/**
 * Notepad interface text: the page, the component (server-rendered) and the controller
 * (client). Both locales ship to the browser on purpose; see src/i18n/client.ts.
 *
 * Messages that include numbers receive the count (for the plural) and the number already
 * formatted for the locale ("12,345" / "12.345"). Turkish nouns stay singular after a number,
 * and Turkish messages are phrased so that numbers and file names need no case suffix.
 *
 * Pure: no `astro:*` imports, so node:test and the controller can import it.
 */
import type { RegexErrorCode } from '../../lib/text/regex-error.ts';
import type { Localized } from '../config.ts';

const en = {
  page: {
    title: 'Notepad',
    description:
      'A distraction-free plain-text editor in your browser: zen mode, autosave in this browser, find and replace with regular expressions, and live line and word counts. Your text is never uploaded.',
    /** One line on wide screens: the tool window should fit the first screen. */
    lead: 'Plain-text notes, kept in this browser and never uploaded.',
    tips: 'Tips',
  },

  label: 'Notepad',
  noscript: 'This tool needs JavaScript. It runs entirely in your browser; nothing is uploaded.',
  defaultFilename: 'untitled.txt',

  toolbar: {
    file: 'File',
    view: 'Search and view',
    fileName: 'File name',
    open: 'Open',
    clear: 'Clear',
    find: 'Find',
    replace: 'Replace',
    wrap: 'Wrap lines',
    zen: 'Zen mode',
    download: 'Download',
  },

  /** Tooltips; a keyboard shortcut is appended with `withShortcut`. */
  titles: {
    fileName: 'File name, with any extension',
    open: 'Open a text file',
    clear: 'Clear the text and start over',
    find: 'Find',
    replace: 'Find and replace',
    wrap: 'Wrap long lines',
    zen: 'Zen mode: full screen, just the text',
    zenExit: 'Exit zen mode',
    download: 'Download as a file',
    previous: 'Previous match',
    next: 'Next match',
    close: 'Close',
    lineEnding: 'Line endings',
    autosave: 'Keep the text in this browser between visits',
  },
  withShortcut: (label: string, shortcut: string) => `${label} (${shortcut})`,

  find: {
    label: 'Find and replace',
    find: 'Find',
    replaceWith: 'Replace with',
    previous: 'Previous match',
    next: 'Next match',
    options: 'Search options',
    close: 'Close find and replace',
    replaceOne: 'Replace',
    replaceAll: 'Replace all',
    undo: 'Undo',
    /** Visible text of the whole-word toggle. */
    word: 'Word',
    preview: 'Preview changes',
    previewCount: (count: string) => `Preview changes (${count})`,
    previewLine: (line: string) => `Line ${line}`,
    /** Read (not shown) between the parts of a preview row: "…, replace old with new…". */
    srBeforeOld: ', replace ',
    srBeforeNew: ' with ',
    previewFirst: (shown: string, total: string) => `Showing the first ${shown} of ${total} changes.`,
    previewWindow: (shown: string, total: string) => `Showing ${shown} of ${total} changes.`,
  },

  options: {
    matchCase: 'Match case',
    wholeWord: 'Match whole word',
    regex: 'Use regular expression',
    multiline: '^ and $ match each line',
    dotAll: 'Dot matches newline',
  },
  optionTitles: {
    multiline: '^ and $ match at the start and end of each line',
    dotAll: 'Dot (.) also matches line breaks',
  },
  optionState: (label: string, on: boolean) => `${label} ${on ? 'on' : 'off'}`,

  search: {
    noResults: 'No results',
    searching: 'Searching…',
    /** Find field badge: "3 of 120". */
    position: (index: string, total: string) => `${index} of ${total}`,
    /** Announced: "3 of 120 matches". */
    positionSpoken: (index: string, total: string) => `${index} of ${total} matches`,
    /** When the position in a very long list is unknown: "10,000+ matches". */
    matches: (total: string) => `${total} matches`,
    atLine: (position: string, line: string) => `${position}, line ${line}`,
    /** `reason`: one of `regexErrors`. */
    invalidRegex: (reason: string) => `Invalid regular expression: ${reason}.`,
    /**
     * A mistake the notepad doesn't recognise, with the browser's own explanation, which is
     * always in English: shown in English only.
     */
    invalidRegexOther: (detail: string) => `Invalid regular expression: ${detail}`,
    /** See src/lib/text/regex-error.ts. */
    regexErrors: {
      unterminatedGroup: 'a group opened with ( is never closed',
      unmatchedParen: 'a ) has no matching (',
      nothingToRepeat: '*, +, ? or {…} has nothing before it to repeat',
      loneBracket: 'a lone ] or } needs a backslash in front: \\] or \\}',
      incompleteQuantifier: 'a count in { is never finished; to find the character itself, write \\{',
      quantifierOrder: 'the numbers in {…} are in the wrong order',
      unterminatedClass: 'a character class opened with [ is never closed',
      classRange: 'a range in […] runs backwards or contains a class such as \\d',
      trailingBackslash: 'the pattern ends with a lone \\',
      invalidEscape: 'an escape sequence (\\ and the character after it) is not valid here',
      duplicateGroupName: 'two groups have the same name',
      groupName: 'a group name is not valid, or \\k<…> refers to a name that doesn’t exist',
      invalidGroup: '(? must be followed by :, =, !, <=, <! or <name>',
      propertyName: '\\p{…} names an unknown Unicode property',
    } satisfies Record<Exclude<RegexErrorCode, 'unknown'>, string>,
    timeout: 'Search took too long. Simplify the pattern: nested quantifiers like (a+)+ can run forever.',
    tooLarge: 'The text is too large to search with this pattern.',
    failed: 'Search failed. Try again.',
    typeFirst: 'Type something to find first',
  },

  replace: {
    replacing: 'Replacing…',
    timeout:
      'Replace all took too long, so nothing was replaced. Simplify the pattern: nested quantifiers like (a+)+ can run forever.',
    tooLarge: 'Replace all failed: the result would be too large.',
    failed: 'Replace all failed. Try again.',
    textChanged: 'The text changed during Replace all, so nothing was replaced. Try again.',
    replacedProblem: (problem: string) => `Replaced. ${problem}`,
    replacedNoMore: 'Replaced. No more matches.',
    replacedLeft: (count: number, text: string) => `Replaced. ${text} ${count === 1 ? 'match' : 'matches'} left.`,
    replacedAll: (count: number, text: string) => `Replaced ${text} ${count === 1 ? 'occurrence' : 'occurrences'}`,
    undone: 'Replace all undone',
  },

  editor: {
    label: 'Text',
    placeholder: 'Start typing, or open a text file…',
  },

  status: {
    caret: (line: string, column: string) => `Ln ${line}, Col ${column}`,
    selected: (text: string, approximate: boolean) => `${approximate ? '≈' : ''}${text} selected`,
    lines: (count: number, text: string) => `${text} ${count === 1 ? 'line' : 'lines'}`,
    words: (count: number, text: string) => `${text} ${count === 1 ? 'word' : 'words'}`,
    lineEnding: 'Line endings',
    lf: 'LF',
    crlf: 'CRLF (Windows)',
    autosave: 'Autosave',
    saved: (time: string) => `Saved in this browser · ${time}`,
    /** The same on narrow screens. */
    savedShort: (time: string) => `Saved · ${time}`,
    unsaved: 'Unsaved changes',
    full: 'The text is too long to keep in this browser. Download it to save a copy.',
    unavailable: 'This browser blocks storage, so the text isn’t kept here. Download it to save a copy.',
    error: 'Couldn’t save in this browser. Download the text to save a copy.',
    autosaveOn: 'Autosave on. The text is kept in this browser.',
    autosaveOff: 'Autosave off. The copy in this browser was removed.',
    fromOtherTab: 'Updated with changes made in another tab.',
    /** The stored draft came back after the visitor had already typed into the empty editor. */
    earlyTextKept: 'Your saved text is back. What you typed while the page was loading is at the end.',
  },

  stats: {
    summary: 'More stats',
    characters: 'Characters',
    charactersNoSpaces: 'Characters without spaces',
    words: 'Words',
    sentences: 'Sentences',
    lines: 'Lines',
    paragraphs: 'Paragraphs',
    bytes: 'Bytes (UTF-8, as downloaded)',
    readingTime: 'Reading time',
    minutes: (text: string) => `${text} min`,
    bytesDetail: (bytes: string, size: string) => `${bytes} (${size})`,
  },

  files: {
    tooLarge: (name: string, size: string, limit: string) =>
      `“${name}” is ${size}. Notepad opens files up to ${limit}.`,
    replaceTitle: (name: string) => `Open “${name}”?`,
    replaceBody: 'It replaces the current text. Download the current text first if you want to keep it.',
    replaceConfirm: 'Open',
    notTextTitle: (name: string) => `“${name}” doesn’t look like a text file`,
    notTextBody: 'It may show up as unreadable characters. Open it anyway?',
    notTextConfirm: 'Open anyway',
    readError: (name: string) => `Couldn’t read “${name}”.`,
    utf16: (name: string) => `“${name}” is UTF-16 text; Download saves UTF-8.`,
    badCharacters: (name: string, encoding: string) =>
      `Some characters in “${name}” couldn’t be read and are shown as �. The file may not be ${encoding} text.`,
    opened: (name: string) => `Opened “${name}”`,
    openedWithNote: (name: string, note: string) => `Opened “${name}”. ${note}`,
    downloaded: (name: string) => `Downloaded “${name}”`,
    downloadFailed: 'Couldn’t create the file. Try again.',
  },

  clear: {
    title: 'Clear the text?',
    body: 'The text, its file name and the copy kept in this browser are removed. You can undo this right afterwards.',
    confirm: 'Clear',
    cancel: 'Cancel',
    done: 'Text cleared.',
    undo: 'Undo',
    undone: 'Clear undone',
  },

  zen: {
    exit: 'Exit zen mode',
    on: 'Zen mode on. Press Escape to exit.',
    off: 'Zen mode off',
  },
};

export type NotepadMessages = typeof en;

const tr: NotepadMessages = {
  page: {
    title: 'Not defteri',
    description:
      'Tarayıcınızda çalışan, dikkat dağıtmayan bir düz metin düzenleyici. İçinde odak modu, bu tarayıcıya otomatik kayıt, düzenli ifadelerle bulup değiştirme, anlık satır ve kelime sayacı var. Metniniz hiçbir yere yüklenmez.',
    lead: 'Düz metin notlarınız bu tarayıcıda kalır, hiçbir yere yüklenmez.',
    tips: 'İpuçları',
  },

  label: 'Not defteri',
  noscript: 'Bu araç için JavaScript gerekli. Araç tamamen tarayıcınızda çalışır, hiçbir şey yüklenmez.',
  defaultFilename: 'adsız.txt',

  toolbar: {
    file: 'Dosya',
    view: 'Arama ve görünüm',
    fileName: 'Dosya adı',
    open: 'Aç',
    clear: 'Temizle',
    find: 'Bul',
    replace: 'Değiştir',
    wrap: 'Satır kaydırma',
    zen: 'Odak modu',
    download: 'İndir',
  },

  titles: {
    fileName: 'Dosya adı (istediğiniz uzantıyla)',
    open: 'Metin dosyası aç',
    clear: 'Metni temizle, baştan başla',
    find: 'Bul',
    replace: 'Bul ve değiştir',
    wrap: 'Uzun satırları alt satıra geçir',
    zen: 'Odak modu: tam ekran, yalnızca metin',
    zenExit: 'Odak modundan çık',
    download: 'Dosya olarak indir',
    previous: 'Önceki eşleşme',
    next: 'Sonraki eşleşme',
    close: 'Kapat',
    lineEnding: 'Satır sonları',
    autosave: 'Metni sonraki ziyaretleriniz için bu tarayıcıda sakla',
  },
  withShortcut: (label, shortcut) => `${label} (${shortcut})`,

  find: {
    label: 'Bul ve değiştir',
    find: 'Bul',
    replaceWith: 'Yeni metin',
    previous: 'Önceki eşleşme',
    next: 'Sonraki eşleşme',
    options: 'Arama seçenekleri',
    close: 'Bul ve değiştir panelini kapat',
    replaceOne: 'Değiştir',
    replaceAll: 'Tümünü değiştir',
    undo: 'Geri al',
    word: 'Kelime',
    preview: 'Değişiklikleri önizle',
    previewCount: (count) => `Değişiklikleri önizle (${count})`,
    previewLine: (line) => `Satır ${line}`,
    // Turkish order: "…, eski yerine yeni…" (the new text in place of the old one).
    srBeforeOld: ', ',
    srBeforeNew: ' yerine ',
    previewFirst: (shown, total) => `Toplam ${total} değişikliğin ilk ${shown} tanesi gösteriliyor.`,
    previewWindow: (shown, total) => `Toplam ${total} değişiklikten ${shown} tanesi gösteriliyor.`,
  },

  options: {
    matchCase: 'Büyük/küçük harfe duyarlı',
    wholeWord: 'Yalnızca tam kelime',
    regex: 'Düzenli ifade kullan',
    multiline: '^ ve $ her satırda eşleşir',
    dotAll: 'Nokta satır sonuyla da eşleşir',
  },
  optionTitles: {
    multiline: '^ ve $ her satırın başında ve sonunda eşleşir',
    dotAll: 'Nokta (.) satır sonlarıyla da eşleşir',
  },
  optionState: (label, on) => `${label}: ${on ? 'açık' : 'kapalı'}`,

  search: {
    noResults: 'Sonuç yok',
    searching: 'Aranıyor…',
    position: (index, total) => `${index}/${total}`,
    positionSpoken: (index, total) => `Eşleşme ${index}, toplam ${total}`,
    matches: (total) => `${total} eşleşme`,
    atLine: (position, line) => `${position}, satır ${line}`,
    invalidRegex: (reason) => `Geçersiz düzenli ifade: ${reason}.`,
    invalidRegexOther: () => 'Geçersiz düzenli ifade.',
    regexErrors: {
      unterminatedGroup: '( ile açılan bir grup kapatılmamış',
      unmatchedParen: 'eşi olmayan bir ) var',
      nothingToRepeat: '*, +, ? ya da {…} işaretinin önünde tekrarlanacak bir şey yok',
      loneBracket: 'tek başına bir ] ya da } kullanılamaz; önüne ters eğik çizgi koyun: \\] ya da \\}',
      incompleteQuantifier: '{ ile başlayan tekrar sayısı tamamlanmamış; { işaretini aramak için \\{ yazın',
      quantifierOrder: '{…} içindeki sayıların sırası ters',
      unterminatedClass: '[ ile açılan karakter sınıfı kapatılmamış',
      classRange: '[…] içindeki bir aralık ters sırada ya da \\d gibi bir sınıf içeriyor',
      trailingBackslash: 'desen tek başına bir \\ ile bitiyor',
      invalidEscape: 'bir kaçış dizisi (\\ ve ardından gelen karakter) burada geçersiz',
      duplicateGroupName: 'iki grubun adı aynı',
      groupName: 'bir grup adı geçersiz ya da \\k<…> olmayan bir grup adını gösteriyor',
      invalidGroup: '(? işaretinden sonra :, =, !, <=, <! ya da <ad> gelmeli',
      propertyName: '\\p{…} içinde bilinmeyen bir Unicode özelliği var',
    },
    timeout: 'Arama çok uzun sürdü. Deseni sadeleştirin: (a+)+ gibi iç içe tekrarlar aramanın hiç bitmemesine yol açabilir.',
    tooLarge: 'Metin bu desenle aranamayacak kadar büyük.',
    failed: 'Arama yapılamadı. Tekrar deneyin.',
    typeFirst: 'Önce aranacak metni yazın',
  },

  replace: {
    replacing: 'Değiştiriliyor…',
    timeout:
      'Değiştirme çok uzun sürdü, bu yüzden hiçbir şey değiştirilmedi. Deseni sadeleştirin: (a+)+ gibi iç içe tekrarlar işlemin hiç bitmemesine yol açabilir.',
    tooLarge: 'Tümü değiştirilemedi: ortaya çıkacak metin çok büyük olurdu.',
    failed: 'Tümü değiştirilemedi. Tekrar deneyin.',
    textChanged: 'Değiştirme sürerken metin değişti, bu yüzden hiçbir şey değiştirilmedi. Tekrar deneyin.',
    replacedProblem: (problem) => `Değiştirildi. ${problem}`,
    replacedNoMore: 'Değiştirildi. Başka eşleşme yok.',
    replacedLeft: (_count, text) => `Değiştirildi. Kalan eşleşme: ${text}.`,
    replacedAll: (_count, text) => `${text} eşleşme değiştirildi`,
    undone: 'Değiştirmeler geri alındı',
  },

  editor: {
    label: 'Metin',
    placeholder: 'Yazmaya başlayın ya da bir metin dosyası açın…',
  },

  status: {
    caret: (line, column) => `Satır ${line}, Sütun ${column}`,
    selected: (text, approximate) => `${approximate ? '≈' : ''}${text} seçili`,
    lines: (_count, text) => `${text} satır`,
    words: (_count, text) => `${text} kelime`,
    lineEnding: 'Satır sonları',
    lf: 'LF',
    crlf: 'CRLF (Windows)',
    autosave: 'Otomatik kayıt',
    saved: (time) => `Bu tarayıcıya kaydedildi · ${time}`,
    savedShort: (time) => `Kaydedildi · ${time}`,
    unsaved: 'Kaydedilmemiş değişiklikler',
    full: 'Metin bu tarayıcıda saklanamayacak kadar uzun. Bir kopyasını saklamak için metni indirin.',
    unavailable: 'Bu tarayıcı veri saklamaya izin vermiyor, bu yüzden metin burada tutulmuyor. Bir kopyasını saklamak için metni indirin.',
    error: 'Metin bu tarayıcıya kaydedilemedi. Bir kopyasını saklamak için metni indirin.',
    autosaveOn: 'Otomatik kayıt açık. Metin bu tarayıcıda saklanıyor.',
    autosaveOff: 'Otomatik kayıt kapalı. Bu tarayıcıdaki kopya silindi.',
    fromOtherTab: 'Metin, başka bir sekmede yaptığınız değişikliklerle güncellendi.',
    earlyTextKept: 'Kayıtlı metniniz geri geldi. Sayfa yüklenirken yazdıklarınız sona eklendi.',
  },

  stats: {
    summary: 'Diğer istatistikler',
    characters: 'Karakter',
    charactersNoSpaces: 'Boşluksuz karakter',
    words: 'Kelime',
    sentences: 'Cümle',
    lines: 'Satır',
    paragraphs: 'Paragraf',
    bytes: 'Bayt (UTF-8, indirilen dosyada)',
    readingTime: 'Okuma süresi',
    minutes: (text) => `${text} dk`,
    bytesDetail: (bytes, size) => `${bytes} (${size})`,
  },

  files: {
    tooLarge: (name, size, limit) =>
      `“${name}” çok büyük (${size}). Not defteri en fazla ${limit} boyutundaki dosyaları açabilir.`,
    replaceTitle: (name) => `“${name}” açılsın mı?`,
    replaceBody: 'Dosya şu anki metnin yerine geçer. Metni saklamak istiyorsanız önce indirin.',
    replaceConfirm: 'Aç',
    notTextTitle: (name) => `“${name}” bir metin dosyasına benzemiyor`,
    notTextBody: 'İçeriği anlamsız karakterler olarak görünebilir. Yine de açılsın mı?',
    notTextConfirm: 'Yine de aç',
    readError: (name) => `“${name}” okunamadı.`,
    utf16: (name) => `“${name}” UTF-16 kodlamalı. İndirdiğinizde UTF-8 olarak kaydedilir.`,
    badCharacters: (name, encoding) =>
      `“${name}” içindeki bazı karakterler okunamadı ve � olarak gösteriliyor. Dosyanın kodlaması ${encoding} olmayabilir.`,
    opened: (name) => `“${name}” açıldı`,
    openedWithNote: (name, note) => `“${name}” açıldı. ${note}`,
    downloaded: (name) => `“${name}” indirildi`,
    downloadFailed: 'Dosya oluşturulamadı. Tekrar deneyin.',
  },

  clear: {
    title: 'Metin temizlensin mi?',
    body: 'Metin, dosya adı ve bu tarayıcıdaki kopya silinir. Hemen ardından geri alabilirsiniz.',
    confirm: 'Temizle',
    cancel: 'Vazgeç',
    done: 'Metin temizlendi.',
    undo: 'Geri al',
    undone: 'Temizleme geri alındı',
  },

  zen: {
    exit: 'Odak modundan çık',
    on: 'Odak modu açık. Çıkmak için Escape tuşuna basın.',
    off: 'Odak modu kapalı',
  },
};

export const notepadMessages = { en, tr } as const satisfies Localized<NotepadMessages>;
