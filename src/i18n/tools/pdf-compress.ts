/**
 * Compress PDF text: the page, the component and the browser controller all read it, so text
 * rendered on the server and text written later by the script cannot drift apart. The
 * controller picks its locale with getPageLocale(); both locales ship to the browser.
 *
 * Sizes and percentages arrive already formatted (formatters(locale).bytes / .percent); counts
 * arrive as numbers, so each language can choose its plural form. The worker and the libraries
 * return codes (FailureCode, OutcomeKind, OutcomeHint), and the controller picks messages here.
 */
import type { Localized } from '../config.ts';
import { formatters } from '../format.ts';
import type { CompressionLevel } from '../../lib/pdf/compress/plan.ts';

const enNumber = (value: number) => formatters('en').number(value);
const trNumber = (value: number) => formatters('tr').number(value);
const enPlural = (count: number, one: string, other: string) => `${enNumber(count)} ${count === 1 ? one : other}`;

const enLevels = {
  light: 'Light',
  balanced: 'Balanced',
  strong: 'Strong',
} satisfies Record<CompressionLevel, string>;

const en = {
  // ------------------------------------------------------------ page
  title: 'Compress PDF',
  description:
    'Make a PDF smaller right in your browser by recompressing its images. Best for scans and photo-heavy files. Nothing is uploaded.',
  lead: 'Make a PDF smaller by recompressing its images. Everything is processed on your device; nothing is uploaded. Scans and photo-heavy PDFs shrink the most, while text-only documents usually shrink very little.',
  tipsTitle: 'Tips',

  // ------------------------------------------------------------ component
  regionLabel: 'PDF compressor',
  noscript: 'This tool needs JavaScript. It runs entirely in your browser; nothing is uploaded.',
  chooseFile: 'Choose a PDF',
  chooseAnother: 'Choose a different PDF',
  dropHint: 'or drop it here',
  dropNote: 'Your file never leaves your device. Works best on scans and PDFs full of photos.',
  dismissNotice: 'Dismiss notice',
  removeFile: 'Remove PDF',
  optionsLegend: 'Compression',
  levelLegend: 'Level',
  levelNames: enLevels,
  levelHints: {
    light: (px: number) => `Best quality. Recompresses photos gently; images stay up to ${enNumber(px)} px.`,
    balanced: (px: number) => `Much smaller, still sharp. Images up to ${enNumber(px)} px.`,
    strong: (px: number) => `Smallest file. Images up to ${enNumber(px)} px; fine detail softens.`,
  } satisfies Record<CompressionLevel, (px: number) => string>,
  recommended: 'Recommended',
  stripMetadata: 'Remove document metadata',
  stripMetadataHint:
    'Title, author, the app that created the file, dates, XMP data, and camera and location details in photos.',
  compress: 'Compress PDF',
  cancel: 'Cancel',
  progressLabel: 'Compression progress',
  original: 'Original',
  compressed: 'Compressed',
  downloadAgain: 'Download again',
  downloadAnyway: 'Download anyway',

  // ------------------------------------------------------------ controller: loaded file
  /** Shown when a picked file has no name (some Android file providers). */
  untitled: 'Untitled.pdf',
  pages: (count: number) => enPlural(count, 'page', 'pages'),
  readingPdf: 'Reading PDF…',
  reading: (name: string) => `Reading “${name}”…`,
  loaded: (name: string, pages: string, outlook: string) => `“${name}”: ${pages}. ${outlook}.`,
  outlook: {
    recompressible: (count: number, level: CompressionLevel) =>
      `${enPlural(count, 'image', 'images')} can be recompressed at ${enLevels[level]}`,
    losslessOnly: (count: number) =>
      `No JPEG photos to recompress at ${enLevels.light}; ${enLevels.balanced} can convert ${enPlural(count, 'image', 'images')}`,
    none: 'No large images found, so expect only a small reduction',
  },
  removed: 'Removed the PDF',
  oneFileAtATime: (name: string) => `One PDF at a time: using “${name}”.`,
  notPdf: (name: string) => `“${name}” isn’t a PDF. Choose a PDF file.`,
  notPdfUnnamed: 'This file isn’t a PDF. Choose a PDF file.',
  largeFile: (size: string) =>
    `Large file (${size}). Compressing it needs several times this much memory, so on a phone or tablet the page may reload. Close other tabs and apps first, or use a computer.`,

  // ------------------------------------------------------------ controller: run
  progress: {
    starting: 'Starting…',
    reading: 'Reading PDF…',
    cleanup: 'Removing unused data…',
    /** `index` counts from 1. */
    image: (index: number, total: number) => `Optimizing image ${enNumber(index)} of ${enNumber(total)}…`,
    saving: 'Saving…',
    cancelling: 'Cancelling…',
  },
  compressing: 'Compressing PDF…',
  cancelledStatus: 'Cancelled.',
  cancelled: 'Cancelled',
  canvasBlocked:
    'Your browser’s privacy settings block reading image data from a canvas, so images can’t be recompressed here. Other clean-up still runs; for smaller images, try another browser.',
  inAppBrowser: 'Downloads may not work inside this app. Open the page in your browser for the best results.',

  // ------------------------------------------------------------ controller: result
  /** Visible summary of the sizes, e.g. "Original 2.4 MB → 1.1 MB". */
  sizes: (original: string, result: string) => `Original ${original} → ${result}`,
  /** Spoken form of `sizes` (no arrow), for the live region. */
  sizesSpoken: (original: string, result: string) => `Original size ${original}, now ${result}.`,
  /** Percentage change after `sizes`: "(−54%)" or "(larger)". */
  changeSmaller: (percent: string) => `(−${percent})`,
  changeLarger: '(larger)',
  details: {
    level: (level: CompressionLevel) => `${enLevels[level]} level`,
    noJpegPhotos: 'no JPEG photos to recompress',
    noLargeImages: 'no large images to recompress',
    recompressed: (replaced: number, considered: number) =>
      `${enNumber(replaced)} of ${enPlural(considered, 'image', 'images')} recompressed`,
    duplicatesMerged: (count: number) => `${enPlural(count, 'duplicate', 'duplicates')} merged`,
    metadataRemoved: 'metadata removed',
  },
  downloadStarted: 'The download has started.',
  inAppDownloadHint: 'If it doesn’t, open this page in Safari or Chrome.',
  smallerAnnouncement: (original: string, result: string, percent: string) =>
    `Compressed from ${original} to ${result}, ${percent} smaller. The download has started.`,
  notSmaller: {
    'light-skipped': {
      title: `${enLevels.light} can’t shrink this PDF — try ${enLevels.balanced}`,
      announcement: `${enLevels.light} can’t shrink this PDF. Try ${enLevels.balanced}.`,
    },
    optimized: {
      title: 'This PDF is already well optimized — nothing to gain',
      announcement: 'This PDF is already well optimized. There is nothing to gain.',
    },
  },
  hints: {
    'convert-lossless': (count: number) =>
      `${enLevels.balanced} can convert ${enPlural(count, 'losslessly stored image', 'losslessly stored images')} to JPEG for a smaller file.`,
    'stronger-level': 'A stronger level may still help, at lower image quality.',
    'text-only': 'Text and vector graphics are already stored compactly.',
  },

  // ------------------------------------------------------------ controller: errors
  errors: {
    engine: 'Couldn’t load the PDF engine. Check your connection and reload the page.',
    encrypted: (name: string) =>
      `“${name}” is password-protected or encrypted, which isn’t supported. Remove the protection in a PDF app, then try again.`,
    invalid: (name: string) => `“${name}” couldn’t be read. The file may be damaged.`,
    unreadable: (name: string) => `Couldn’t read “${name}”. Choose the file again.`,
    unreadableAgain: (name: string) => `Couldn’t read “${name}” again. Choose the file again.`,
    memoryOpening: (name: string) =>
      `This device ran out of memory while reading “${name}”. Close other tabs or apps, or try a smaller file.`,
    memoryCompressing:
      'This device ran out of memory while compressing. Close other tabs or apps, or try a smaller file, then try again.',
    unknownOpening: (name: string) => `Something went wrong while reading “${name}”. Reload the page and try again.`,
    unknownCompressing:
      'Something went wrong while compressing the PDF. Try another level, or reload the page and try again.',
  },
};

export type PdfCompressMessages = typeof en;

const trLevels = {
  light: 'Hafif',
  balanced: 'Dengeli',
  strong: 'Güçlü',
} satisfies Record<CompressionLevel, string>;

// Turkish nouns stay singular after a number ("12 sayfa"), and interpolated names are quoted or
// followed by a separate word, so no case suffix has to agree with a value.
const tr: PdfCompressMessages = {
  title: 'PDF sıkıştırma',
  description:
    'PDF dosyalarını içindeki görselleri yeniden sıkıştırarak doğrudan tarayıcınızda küçültün. Taranmış belgeler ve fotoğraf ağırlıklı dosyalar için idealdir. Hiçbir şey yüklenmez.',
  lead: 'PDF dosyanızı içindeki görselleri yeniden sıkıştırarak küçültün. Her şey cihazınızda işlenir; hiçbir şey yüklenmez. En çok taranmış belgeler ve fotoğraf ağırlıklı PDF’ler küçülür; yalnızca metin içeren belgeler genellikle çok az küçülür.',
  tipsTitle: 'İpuçları',

  regionLabel: 'PDF sıkıştırıcı',
  noscript: 'Bu araç JavaScript gerektirir. Tamamen tarayıcınızda çalışır; hiçbir şey yüklenmez.',
  chooseFile: 'PDF seçin',
  chooseAnother: 'Başka bir PDF seçin',
  dropHint: 'ya da buraya bırakın',
  dropNote: 'Dosyanız cihazınızdan hiç çıkmaz. En iyi sonucu taranmış belgelerde ve fotoğraf dolu PDF’lerde verir.',
  dismissNotice: 'Bildirimi kapat',
  removeFile: 'Dosyayı kaldır',
  optionsLegend: 'Sıkıştırma',
  levelLegend: 'Düzey',
  levelNames: trLevels,
  levelHints: {
    light: (px) => `En iyi kalite. Fotoğraflar hafifçe yeniden sıkıştırılır; görseller en fazla ${trNumber(px)} px olur.`,
    balanced: (px) => `Çok daha küçük, hâlâ net. Görseller en fazla ${trNumber(px)} px olur.`,
    strong: (px) => `En küçük dosya. Görseller en fazla ${trNumber(px)} px olur; ince ayrıntılar yumuşar.`,
  },
  recommended: 'Önerilen',
  stripMetadata: 'Belge meta verilerini kaldır',
  stripMetadataHint:
    'Başlık, yazar, dosyayı oluşturan uygulama, tarihler, XMP verileri ve fotoğraflardaki kamera ve konum bilgileri.',
  compress: 'PDF’yi sıkıştır',
  cancel: 'İptal',
  progressLabel: 'Sıkıştırma ilerlemesi',
  original: 'Orijinal',
  compressed: 'Sıkıştırılmış',
  downloadAgain: 'Yeniden indir',
  downloadAnyway: 'Yine de indir',

  untitled: 'Adsız.pdf',
  pages: (count) => `${trNumber(count)} sayfa`,
  readingPdf: 'PDF okunuyor…',
  reading: (name) => `“${name}” okunuyor…`,
  loaded: (name, pages, outlook) => `“${name}”: ${pages}. ${outlook}.`,
  outlook: {
    recompressible: (count, level) => `${trLevels[level]} düzeyde ${trNumber(count)} görsel yeniden sıkıştırılabilir`,
    losslessOnly: (count) =>
      `${trLevels.light} düzeyde yeniden sıkıştırılacak JPEG fotoğraf yok; ${trLevels.balanced} düzey ${trNumber(count)} görseli dönüştürebilir`,
    none: 'Büyük görsel bulunamadı; dosya yalnızca biraz küçülebilir',
  },
  removed: 'PDF kaldırıldı',
  oneFileAtATime: (name) => `Tek seferde bir PDF işlenir; “${name}” kullanılıyor.`,
  notPdf: (name) => `“${name}” bir PDF değil. Bir PDF dosyası seçin.`,
  notPdfUnnamed: 'Bu dosya bir PDF değil. Bir PDF dosyası seçin.',
  largeFile: (size) =>
    `Büyük dosya (${size}). Sıkıştırma bunun birkaç katı bellek gerektirir; telefon ya da tablette sayfa yeniden yüklenebilir. Önce diğer sekmeleri ve uygulamaları kapatın ya da bir bilgisayar kullanın.`,

  progress: {
    starting: 'Başlatılıyor…',
    reading: 'PDF okunuyor…',
    cleanup: 'Kullanılmayan veriler kaldırılıyor…',
    image: (index, total) => `Görseller optimize ediliyor: ${trNumber(index)}/${trNumber(total)}…`,
    saving: 'Kaydediliyor…',
    cancelling: 'İptal ediliyor…',
  },
  compressing: 'PDF sıkıştırılıyor…',
  cancelledStatus: 'İptal edildi.',
  cancelled: 'İptal edildi',
  canvasBlocked:
    'Tarayıcınızın gizlilik ayarları canvas öğesinden görüntü verisi okunmasını engellediği için görseller burada yeniden sıkıştırılamıyor. Diğer temizlik adımları yine de uygulanır; daha küçük görseller için başka bir tarayıcı deneyin.',
  inAppBrowser: 'İndirmeler bu uygulamanın içinde çalışmayabilir. En iyi sonuç için sayfayı tarayıcınızda açın.',

  sizes: (original, result) => `Orijinal ${original} → ${result}`,
  sizesSpoken: (original, result) => `Orijinal boyut ${original}, yeni boyut ${result}.`,
  changeSmaller: (percent) => `(−${percent})`,
  changeLarger: '(daha büyük)',
  details: {
    level: (level) => `${trLevels[level]} düzey`,
    noJpegPhotos: 'yeniden sıkıştırılacak JPEG fotoğraf yok',
    noLargeImages: 'yeniden sıkıştırılacak büyük görsel yok',
    recompressed: (replaced, considered) =>
      `${trNumber(considered)} görselden ${trNumber(replaced)} tanesi yeniden sıkıştırıldı`,
    duplicatesMerged: (count) => `${trNumber(count)} kopya birleştirildi`,
    metadataRemoved: 'meta veriler kaldırıldı',
  },
  downloadStarted: 'İndirme başladı.',
  inAppDownloadHint: 'Başlamazsa bu sayfayı Safari ya da Chrome tarayıcısında açın.',
  smallerAnnouncement: (original, result, percent) =>
    `Sıkıştırma tamamlandı: dosya ${original} boyutundan ${result} boyutuna indi, ${percent} daha küçük. İndirme başladı.`,
  notSmaller: {
    'light-skipped': {
      title: `${trLevels.light} düzey bu PDF’yi küçültemiyor — ${trLevels.balanced} düzeyi deneyin`,
      announcement: `${trLevels.light} düzey bu PDF’yi küçültemiyor. ${trLevels.balanced} düzeyi deneyin.`,
    },
    optimized: {
      title: 'Bu PDF zaten iyi optimize edilmiş — daha fazla küçülmüyor',
      announcement: 'Bu PDF zaten iyi optimize edilmiş. Daha fazla küçülmüyor.',
    },
  },
  hints: {
    'convert-lossless': (count) =>
      `${trLevels.balanced} düzey, kayıpsız saklanan ${trNumber(count)} görseli JPEG biçimine dönüştürerek dosyayı küçültebilir.`,
    'stronger-level': 'Daha güçlü bir düzey, görsel kalitesinden ödün vererek yine de işe yarayabilir.',
    'text-only': 'Metin ve vektör grafikler zaten az yer kaplayacak biçimde saklanır.',
  },

  errors: {
    engine: 'PDF motoru yüklenemedi. Bağlantınızı kontrol edip sayfayı yenileyin.',
    encrypted: (name) =>
      `“${name}” parola korumalı ya da şifreli; bu tür dosyalar desteklenmiyor. Korumayı bir PDF uygulamasında kaldırıp yeniden deneyin.`,
    invalid: (name) => `“${name}” okunamadı. Dosya bozuk olabilir.`,
    unreadable: (name) => `“${name}” okunamadı. Dosyayı yeniden seçin.`,
    unreadableAgain: (name) => `“${name}” yeniden okunamadı. Dosyayı yeniden seçin.`,
    memoryOpening: (name) =>
      `“${name}” okunurken cihazın belleği yetmedi. Diğer sekmeleri ya da uygulamaları kapatın veya daha küçük bir dosya deneyin.`,
    memoryCompressing:
      'Sıkıştırma sırasında cihazın belleği yetmedi. Diğer sekmeleri ya da uygulamaları kapatın veya daha küçük bir dosyayla yeniden deneyin.',
    unknownOpening: (name) => `“${name}” okunurken bir sorun oluştu. Sayfayı yenileyip yeniden deneyin.`,
    unknownCompressing: 'PDF sıkıştırılırken bir sorun oluştu. Başka bir düzey deneyin ya da sayfayı yenileyip yeniden deneyin.',
  },
};

export const pdfCompressMessages = { en, tr } as const satisfies Localized<PdfCompressMessages>;
