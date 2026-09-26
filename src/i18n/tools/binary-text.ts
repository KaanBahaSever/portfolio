/**
 * Interface text of the Binary ↔ text converter (page, component and client controller).
 * Tips, which carry inline markup, are written per locale in the page.
 *
 * The engine (src/lib/text/binary.ts) returns codes with positions; the controller turns them
 * into these messages. Counts arrive as numbers and are formatted here with formatters(locale);
 * code points ("U+00FC"), hex ("0xC3") and bit strings are notation and arrive ready-made.
 * Turkish sentences are built so that no interpolated value needs a case suffix.
 */
import type { Localized } from '../config.ts';
import { formatters } from '../format.ts';
import type { CharKind, Separator, Grouping, Utf8Problem } from '../../lib/text/binary.ts';

const enNumber = (value: number) => formatters('en').number(value);
const trNumber = (value: number) => formatters('tr').number(value);
const plural = (count: number, one: string, many: string) => `${enNumber(count)} ${count === 1 ? one : many}`;

/** What a UTF-8 explanation may mention; `at` and byte numbers count from 1. */
export interface Utf8Detail {
  /** Value of the offending byte, e.g. "0xF8". */
  hex: string;
  /** Length the lead byte announces. */
  expected: number;
  /** The byte that breaks the sequence. */
  at: number;
  /** Bytes of the sequence that are there (for a sequence cut short). */
  present: number;
}

type Kinds = Record<Exclude<CharKind, 'printable'>, string>;

const en = {
  meta: {
    title: 'Binary ↔ text converter',
    description:
      'Convert text to binary and back in your browser: UTF-8 bytes as 8-bit groups, an ASCII check, exact error positions and a per-character breakdown.',
  },
  header: {
    eyebrow: 'UTF-8 · runs in your browser',
    lead: 'Type on either side and the other follows: text turns into the bits of its UTF-8 bytes, and bits turn back into text. Below, every character is taken apart into its code point and bytes.',
  },
  toolLabel: 'Binary and text converter',
  noscript: 'This tool needs JavaScript. It runs entirely in your browser; nothing is uploaded.',
  examples: {
    label: 'Examples',
    emoji: 'Emoji',
  },
  clear: 'Clear',
  text: {
    label: 'Text',
    format: 'UTF-8',
    placeholder: 'Type or paste text',
    hint: 'Changes here update the binary field.',
  },
  binary: {
    label: 'Binary',
    format: '8 bits per byte',
    placeholder: '01001000 01101001',
    hint: 'Changes here update the text field. Separate bytes with spaces, line breaks or commas, or write one run of bits; a 0b before a group is fine.',
  },
  /** Mono tags on the two fields: which one is being edited, which one follows. */
  roles: {
    input: 'Input',
    output: 'Output',
  },
  direction: {
    textToBinary: 'Text to binary',
    binaryToText: 'Binary to text',
  },
  stale: {
    tag: 'Out of date',
    note: 'Out of date: fix the error first.',
  },
  copy: {
    label: 'Copy',
    copied: 'Copied',
    /** Accessible names; they start with the visible label. */
    text: 'Copy text',
    binary: 'Copy binary',
    textDone: 'Text copied to the clipboard.',
    binaryDone: 'Binary copied to the clipboard.',
    failed: 'Couldn’t copy automatically. The field’s content is selected: copy it with your device’s Copy command.',
  },
  counts: {
    characters: (count: number) => plural(count, 'character', 'characters'),
    bytes: (count: number) => plural(count, 'byte', 'bytes'),
    bits: (count: number) => plural(count, 'bit', 'bits'),
  },
  options: {
    heading: 'Options',
    separator: 'Separator',
    separators: {
      space: 'Space',
      none: 'None',
      newline: 'New line',
    } satisfies Record<Separator, string>,
    grouping: 'Groups',
    groupings: {
      byte: 'Per byte',
      character: 'Per character',
    } satisfies Record<Grouping, string>,
    groupingHint: 'Per character keeps the two to four bytes of a non-ASCII character together.',
    groupingDisabled: 'Choose a separator to group the bits.',
    ascii: {
      label: 'ASCII only',
      detail: 'Flag every character above 127, outside 7-bit ASCII.',
    },
  },
  problems: {
    where: (line: number, column: number) => `Line ${enNumber(line)}, column ${enNumber(column)}`,
    show: 'Show in field',
    invalidCharacter: (where: string, char: string, codePoint: string) =>
      `${where}: “${char}” (${codePoint}) is not a binary digit.`,
    invalidCharacterHint: 'Use only 0 and 1, with spaces, line breaks or commas between bytes; a 0b before a group is fine.',
    groupLength: (where: string, group: number, bits: number) =>
      `${where}: group ${enNumber(group)} has ${plural(bits, 'bit', 'bits')}, which is not a multiple of 8.`,
    groupLengthHint: 'A byte has exactly 8 bits. Look for a missing or extra digit, or a space inside a byte.',
    emptyPrefix: (where: string, group: number) => `${where}: group ${enNumber(group)} is a 0b prefix with no bits after it.`,
    emptyPrefixHint: 'Write the byte’s 8 bits right after the 0b, or delete the prefix.',
    nonAsciiText: (where: string, char: string, codePoint: string, count: number) =>
      `${where}: “${char}” (${codePoint}) is outside ASCII, which ends at 127.` +
      (count > 1 ? ` The text has ${enNumber(count)} such characters.` : ''),
    nonAsciiTextHint: 'Turn off “ASCII only” to encode them as UTF-8.',
    nonAsciiByte: (where: string, byte: number, value: number, bits: string, count: number) =>
      `${where}: byte ${enNumber(byte)} is ${enNumber(value)} (${bits}), above 127, so it is not ASCII.` +
      (count > 1 ? ` The binary has ${enNumber(count)} such bytes.` : ''),
    nonAsciiByteHint: 'Turn off “ASCII only” to read them as UTF-8.',
    invalidUtf8: (where: string, byte: number, detail: string) =>
      `${where}: invalid UTF-8 at byte ${enNumber(byte)}. ${detail}`,
    utf8: {
      'unexpected-continuation': (_detail: Utf8Detail) =>
        'This byte starts with 10, the mark of a continuation byte, but no byte before it starts a character.',
      'invalid-byte': (detail: Utf8Detail) => `This byte’s value (${detail.hex}) never occurs in UTF-8.`,
      overlong: (_detail: Utf8Detail) =>
        'The sequence is an overlong form: the character has a shorter encoding, and UTF-8 allows only the shortest.',
      surrogate: (_detail: Utf8Detail) =>
        'The sequence encodes a UTF-16 surrogate (U+D800–U+DFFF), which UTF-8 does not allow.',
      'too-large': (_detail: Utf8Detail) =>
        'The sequence encodes a value above U+10FFFF, the last Unicode code point.',
      'missing-continuation': (detail: Utf8Detail) =>
        `This byte starts a ${enNumber(detail.expected)}-byte character, but byte ${enNumber(detail.at)} does not begin with 10.`,
      truncated: (detail: Utf8Detail) =>
        `This byte starts a ${enNumber(detail.expected)}-byte character, but only ${enNumber(detail.present)} of its bytes are there.`,
    } satisfies Record<Utf8Problem, (detail: Utf8Detail) => string>,
    loneSurrogate: (where: string, codePoint: string) =>
      `${where}: the text contains a broken character (an unpaired UTF-16 surrogate, ${codePoint}) that cannot be encoded.`,
    loneSurrogateHint: 'Delete it and type the character again.',
    tooLong: (limit: number) => `Too long: this tool converts up to ${plural(limit, 'byte', 'bytes')} at a time.`,
    tooLongHint: 'Convert the text in smaller parts.',
  },
  /** Shown under the binary field while its end is unfinished (normal while typing, so no alarm). */
  pending: {
    bits: (bits: number) => `Next byte: ${enNumber(bits)}/8 bits`,
    bytes: (have: number, need: number) => `Unfinished character: ${enNumber(have)}/${enNumber(need)} bytes`,
  },
  announce: {
    cleared: 'Both fields cleared.',
    example: (value: string, bytes: number) => `Example loaded: “${value}”, ${plural(bytes, 'byte', 'bytes')}.`,
    fixed: 'Fixed: the two fields match again.',
    reformatted: 'Binary layout updated.',
    layoutPending: 'The new layout applies once the error is fixed.',
    fixedWithLayout: 'Fixed: the two fields match again, and the new layout is applied.',
  },
  breakdown: {
    heading: 'Character by character',
    caption: 'Code points of the text and their UTF-8 bytes',
    regionLabel: 'Character breakdown table',
    columns: {
      index: '#',
      character: 'Character',
      codePoint: 'Code point',
      hex: 'UTF-8 (hex)',
      binary: 'UTF-8 (binary)',
    },
    empty: 'Type or paste text, or pick an example, to see each character’s bytes here.',
    summary: (codePoints: number, bytes: number) =>
      `${plural(codePoints, 'code point', 'code points')} · ${plural(bytes, 'byte', 'bytes')}`,
    capped: (shown: number, total: number) => `Showing the first ${enNumber(shown)} of ${enNumber(total)} code points.`,
    legend:
      'Bold bits carry the code point. The lighter bits in front are UTF-8’s markers: 0 starts a one-byte character; 110, 1110 and 11110 start characters of two, three and four bytes; 10 marks each byte that continues one.',
    notAscii: 'Not ASCII',
    noBytes: 'none',
    kinds: {
      control: 'control character',
      space: 'space',
      format: 'invisible formatting character',
      combining: 'combining mark',
      surrogate: 'unpaired surrogate',
    } satisfies Kinds,
  },
  privacy: {
    label: 'Privacy',
    title: 'Nothing leaves your device.',
    body: 'The conversion runs in your browser. What you type is never uploaded, and this page stores none of it.',
  },
  tipsTitle: 'Tips',
};

export type BinaryTextMessages = typeof en;

const tr: BinaryTextMessages = {
  meta: {
    title: 'İkili ↔ metin dönüştürücü',
    description:
      'Metni ikili koda, ikili kodu metne tarayıcınızda çevirin. UTF-8 baytlarını 8 bitlik gruplar hâlinde görün, ASCII denetimi yapın, hataların tam yerini bulun ve her karakteri tek tek inceleyin.',
  },
  header: {
    eyebrow: 'UTF-8 · tarayıcınızda çalışır',
    lead: 'İki alandan birine yazın, diğeri anında güncellenir. Metin yazarsanız metnin UTF-8 baytlarını bit olarak, bit yazarsanız metni görürsünüz. Aşağıda da her karakter kod noktasına ve baytlarına ayrılır.',
  },
  toolLabel: 'İkili kod ve metin dönüştürücü',
  noscript: 'Bu araç JavaScript olmadan çalışmaz. Dönüştürme tamamen tarayıcınızda yapılır, hiçbir şey bir sunucuya yüklenmez.',
  examples: {
    label: 'Örnekler',
    emoji: 'Emoji',
  },
  clear: 'Temizle',
  text: {
    label: 'Metin',
    format: 'UTF-8',
    placeholder: 'Metin yazın ya da yapıştırın',
    hint: 'Buradaki değişiklikler ikili kod alanını günceller.',
  },
  binary: {
    label: 'İkili kod',
    format: 'bayt başına 8 bit',
    placeholder: '01001000 01101001',
    hint: 'Buradaki değişiklikler metin alanını günceller. Baytları boşluk, satır sonu ya da virgülle ayırın veya bitleri aralıksız yazın; grupların başında 0b olabilir.',
  },
  roles: {
    input: 'Girdi',
    output: 'Çıktı',
  },
  direction: {
    textToBinary: 'Metinden ikili koda',
    binaryToText: 'İkili koddan metne',
  },
  stale: {
    tag: 'Güncel değil',
    note: 'Güncel değil: önce hatayı düzeltin.',
  },
  copy: {
    label: 'Kopyala',
    copied: 'Kopyalandı',
    text: 'Metni kopyala',
    binary: 'İkili kodu kopyala',
    textDone: 'Metin panoya kopyalandı.',
    binaryDone: 'İkili kod panoya kopyalandı.',
    failed: 'Otomatik olarak kopyalanamadı. Alanın içeriği seçili; cihazınızın Kopyala komutuyla kopyalayın.',
  },
  // Turkish nouns stay singular after a number: "13 karakter", "14 bayt", "112 bit".
  counts: {
    characters: (count) => `${trNumber(count)} karakter`,
    bytes: (count) => `${trNumber(count)} bayt`,
    bits: (count) => `${trNumber(count)} bit`,
  },
  options: {
    heading: 'Seçenekler',
    separator: 'Ayraç',
    separators: {
      space: 'Boşluk',
      none: 'Yok',
      newline: 'Yeni satır',
    },
    grouping: 'Gruplama',
    groupings: {
      byte: 'Bayta göre',
      character: 'Karaktere göre',
    },
    groupingHint: 'Karaktere göre gruplarsanız ASCII dışındaki bir karakterin iki, üç ya da dört baytı bir arada kalır.',
    groupingDisabled: 'Bitleri gruplamak için bir ayraç seçin.',
    ascii: {
      label: 'Yalnızca ASCII',
      detail: '127’den büyük, yani 7 bitlik ASCII dışında kalan her karakteri işaretler.',
    },
  },
  problems: {
    where: (line, column) => `Satır ${trNumber(line)}, sütun ${trNumber(column)}`,
    show: 'Alanda göster',
    invalidCharacter: (where, char, codePoint) => `${where}: “${char}” (${codePoint}) 0 ya da 1 değil.`,
    invalidCharacterHint:
      'Yalnızca 0 ve 1 kullanın; baytları boşluk, satır sonu ya da virgülle ayırın. Grupların başında 0b olabilir.',
    // "3. grupta", "1.501. baytta": ordinals keep Turkish number formatting, and the suffix sits
    // on the noun, never on the number.
    groupLength: (where, group, bits) =>
      `${where}: ${trNumber(group)}. grupta ${trNumber(bits)} bit var; bu sayı 8’in katı değil.`,
    groupLengthHint:
      'Bir bayt tam 8 bittir. Eksik ya da fazla bir rakam var mı, bir baytın ortasına boşluk girmiş mi, kontrol edin.',
    emptyPrefix: (where, group) =>
      `${where}: ${trNumber(group)}. grup yalnızca 0b ön ekinden oluşuyor, arkasında hiç bit yok.`,
    emptyPrefixHint: 'Baytın 8 bitini 0b ön ekinin hemen ardından yazın ya da ön eki silin.',
    nonAsciiText: (where, char, codePoint, count) =>
      `${where}: “${char}” (${codePoint}) ASCII’nin dışında; ASCII 127’de biter.` +
      (count > 1 ? ` Metinde bu türden ${trNumber(count)} karakter var.` : ''),
    nonAsciiTextHint: 'UTF-8 olarak kodlamak için “Yalnızca ASCII” seçeneğini kapatın.',
    nonAsciiByte: (where, byte, value, bits, count) =>
      `${where}: ${trNumber(byte)}. baytın değeri ${trNumber(value)} (${bits}); 127’den büyük olduğu için ASCII değil.` +
      (count > 1 ? ` İkili kodda bu türden ${trNumber(count)} bayt var.` : ''),
    nonAsciiByteHint: 'UTF-8 olarak okumak için “Yalnızca ASCII” seçeneğini kapatın.',
    invalidUtf8: (where, byte, detail) => `${where}: ${trNumber(byte)}. baytta geçersiz bir UTF-8 dizisi var. ${detail}`,
    utf8: {
      'unexpected-continuation': () =>
        'Bu bayt 10 ile başlıyor, yani bir devam baytı; ancak öncesinde bir karakteri başlatan bayt yok.',
      'invalid-byte': (detail) => `Bu baytın değeri (${detail.hex}) UTF-8’de hiçbir zaman kullanılmaz.`,
      overlong: () =>
        'Bu dizi gereğinden uzun bir kodlama: karakterin daha kısa bir kodlaması var ve UTF-8 yalnızca en kısasına izin verir.',
      surrogate: () => 'Bu dizi, bir UTF-16 vekil kod noktasını (U+D800–U+DFFF) kodluyor; UTF-8 buna izin vermez.',
      'too-large': () => 'Bu dizi, Unicode’un son kod noktası olan U+10FFFF’ten büyük bir değer kodluyor.',
      'missing-continuation': (detail) =>
        `Bu bayt ${trNumber(detail.expected)} baytlık bir karakter başlatıyor, ancak ${trNumber(detail.at)}. bayt 10 ile başlamıyor.`,
      truncated: (detail) =>
        `Bu bayt ${trNumber(detail.expected)} baytlık bir karakter başlatıyor, ancak bu karakterin yalnızca ${trNumber(detail.present)} baytı var.`,
    },
    loneSurrogate: (where, codePoint) =>
      `${where}: metinde kodlanamayan bozuk bir karakter var (eşi olmayan bir UTF-16 vekili, ${codePoint}).`,
    loneSurrogateHint: 'Karakteri silip yeniden yazın.',
    tooLong: (limit) => `Çok uzun: bu araç tek seferde en fazla ${trNumber(limit)} bayt dönüştürür.`,
    tooLongHint: 'Metni daha küçük parçalar hâlinde dönüştürün.',
  },
  pending: {
    bits: (bits) => `Sonraki bayt: ${trNumber(bits)}/8 bit`,
    bytes: (have, need) => `Tamamlanmamış karakter: ${trNumber(have)}/${trNumber(need)} bayt`,
  },
  announce: {
    cleared: 'İki alan da temizlendi.',
    example: (value, bytes) => `Örnek yüklendi: “${value}”, ${trNumber(bytes)} bayt.`,
    fixed: 'Düzeltildi: iki alan yeniden eşleşiyor.',
    reformatted: 'İkili kodun düzeni güncellendi.',
    layoutPending: 'Yeni düzen, hata düzeltildiğinde uygulanır.',
    fixedWithLayout: 'Düzeltildi: iki alan yeniden eşleşiyor ve yeni düzen uygulandı.',
  },
  breakdown: {
    heading: 'Karakter karakter',
    caption: 'Metnin kod noktaları ve UTF-8 baytları',
    regionLabel: 'Karakter tablosu',
    columns: {
      index: '#',
      character: 'Karakter',
      codePoint: 'Kod noktası',
      // "16’lık" is the usual short form of onaltılık; it keeps the column narrow on phones.
      hex: 'UTF-8 (16’lık)',
      binary: 'UTF-8 (ikili)',
    },
    empty: 'Her karakterin baytlarını burada görmek için metin yazın, yapıştırın ya da bir örnek seçin.',
    summary: (codePoints, bytes) => `${trNumber(codePoints)} kod noktası · ${trNumber(bytes)} bayt`,
    // "… kod noktasından": the suffix sits on the noun, never on the number.
    capped: (shown, total) => `${trNumber(total)} kod noktasından ilk ${trNumber(shown)} tanesi gösteriliyor.`,
    legend:
      'Kalın bitler kod noktasını taşır. Önlerindeki soluk bitler UTF-8’in işaretleridir: 0 ile başlayan bayt tek başına bir karakterdir; 110, 1110 ve 11110 sırasıyla iki, üç ve dört baytlık bir karakteri başlatır; 10 ile başlayan her bayt ise bir karakterin devamıdır.',
    notAscii: 'ASCII değil',
    noBytes: 'yok',
    kinds: {
      control: 'kontrol karakteri',
      space: 'boşluk',
      format: 'görünmez biçim karakteri',
      combining: 'birleştirici işaret',
      surrogate: 'eşi olmayan vekil',
    },
  },
  privacy: {
    label: 'Gizlilik',
    title: 'Hiçbir şey cihazınızdan çıkmaz.',
    body: 'Dönüştürme tarayıcınızda yapılır. Yazdıklarınız hiçbir yere yüklenmez, bu sayfa da hiçbirini saklamaz.',
  },
  tipsTitle: 'İpuçları',
};

export const binaryTextMessages = { en, tr } as const satisfies Localized<BinaryTextMessages>;
