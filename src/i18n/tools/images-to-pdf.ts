/**
 * Interface text for the Images to PDF tool: the page, the component (server-rendered) and the
 * controller (client), which reads the same catalogue so the two never drift apart. The page's
 * tips are rich markup and live per locale in src/pages/[...lang]/tools/images-to-pdf.astro.
 *
 * The import step returns rejection codes (RejectReason) and the PDF libraries never return
 * prose; `reasons` and `errors` word them here. Sizes arrive pre-formatted by the caller
 * (formatters(locale).bytes); counts are formatted here.
 *
 * Turkish messages are phrased so that interpolated values stand alone and never need a
 * case suffix ("“a.jpg” işlenemedi", "Kalan görsel sayısı: 3").
 */
import type { Localized } from '../config.ts';
import { formatters } from '../format.ts';
import type { MarginOption, OrientationOption, PageSizeOption } from '../../lib/pdf/page-layout.ts';
import type { Quality, RejectReason } from '../../scripts/tools/images-to-pdf/types.ts';

const fe = formatters('en');
const ft = formatters('tr');

/** "1 image", "1,234 images". */
const imagesEn = (n: number) => `${fe.number(n)} ${n === 1 ? 'image' : 'images'}`;
const filesEn = (n: number) => `${fe.number(n)} ${n === 1 ? 'file' : 'files'}`;
const pagesEn = (n: number) => `${fe.number(n)} ${n === 1 ? 'page' : 'pages'}`;
/** Turkish keeps the noun singular after a number: "1 görsel", "12 görsel". */
const imagesTr = (n: number) => `${ft.number(n)} görsel`;

const en = {
  meta: {
    title: 'Images to PDF',
    description:
      'Combine photos and images into one PDF right in your browser. Reorder pages, pick a page size, download. Nothing is uploaded.',
    eyebrow: 'PDF · runs in your browser',
    lead: 'Turn photos, scans and screenshots into a single PDF. Everything is processed on your device; nothing is uploaded.',
    tips: 'Tips',
  },
  toolLabel: 'Images to PDF converter',
  noscript: 'This tool needs JavaScript. It runs entirely in your browser; nothing is uploaded.',
  dropzone: {
    choose: 'Choose images',
    addMore: 'Add more images',
    drop: 'or drop them here',
    formats: 'JPEG · PNG · WebP · GIF · AVIF · BMP',
    formatsHint: 'and HEIC where your browser supports it',
    privacy: 'Your images never leave your device',
  },
  /** Visual progress while files are read (the announcer says it once instead). */
  importing: (done: number, total: number) => `Adding images… ${fe.number(done)} / ${fe.number(total)}`,
  dismissNotice: 'Dismiss notice',
  toolbar: {
    title: 'Pages',
    count: imagesEn,
    hintPointer: 'Drag to reorder',
    hintTouch: 'Long-press and drag to reorder',
    arrangeLabel: 'Arrange images',
    sort: 'Sort A–Z',
    reverse: 'Reverse',
    clear: 'Clear all',
    skipToOptions: 'Skip to PDF options',
  },
  grid: {
    label: 'Pages in order',
    /** Accessible names of a card's buttons: the position and the file name. */
    moveEarlier: (page: number, name: string) => `Move page ${page} (${name}) earlier`,
    moveLater: (page: number, name: string) => `Move page ${page} (${name}) later`,
    remove: (page: number, name: string) => `Remove page ${page} (${name})`,
    meta: (width: number, height: number, size: string) => `${width} × ${height} · ${size}`,
  },
  options: {
    legend: 'PDF options',
    pageSize: 'Page size',
    pageSizes: { a4: 'A4', letter: 'US Letter', fit: 'Fit to image' } satisfies Record<PageSizeOption, string>,
    orientation: 'Orientation',
    orientations: {
      auto: 'Auto (match each image)',
      portrait: 'Portrait',
      landscape: 'Landscape',
    } satisfies Record<OrientationOption, string>,
    orientationHint: 'Not used with “Fit to image”.',
    margin: 'Margin',
    /** `size` is the margin width, e.g. "10 mm". */
    margins: {
      none: (_size: string) => 'None',
      small: (size: string) => `Small (${size})`,
      large: (size: string) => `Large (${size})`,
    } satisfies Record<MarginOption, (size: string) => string>,
    marginHint: 'Added around each image with “Fit to image”.',
    quality: 'Quality',
    qualities: { original: 'Original quality', compressed: 'Smaller file' } satisfies Record<Quality, string>,
    filename: 'File name',
  },
  actions: {
    generate: 'Generate PDF',
    cancel: 'Cancel',
    progressLabel: 'PDF creation progress',
    downloadAgain: 'Download again',
    share: 'Share',
  },
  progress: {
    processing: (image: number, total: number) => `Processing image ${fe.number(image)} of ${fe.number(total)}…`,
    saving: 'Saving PDF…',
    cancelling: 'Cancelling…',
  },
  /** Screen-reader announcements (the visible text says the same where there is any). */
  announce: {
    adding: (count: number) => `Adding ${imagesEn(count)}…`,
    added: (count: number) => `Added ${imagesEn(count)}`,
    addedSkipped: (added: number, skipped: number, details: string) =>
      `Added ${imagesEn(added)}, skipped ${filesEn(skipped)}: ${details}`,
    creating: 'Creating PDF…',
    saving: 'Saving PDF…',
    cancelled: 'Cancelled',
    moved: (name: string, position: number, total: number) => `Moved ${name} to position ${position} of ${total}`,
    removed: (name: string, left: number) => `Removed ${name}. ${imagesEn(left)} left.`,
    removedAll: 'Removed all images',
    sorted: 'Sorted by file name, A to Z',
    reversed: 'Reversed the order',
  },
  status: {
    cancelled: 'Cancelled.',
  },
  notices: {
    skipped: (count: number) => (count === 1 ? '1 file was skipped:' : `${fe.number(count)} files were skipped:`),
    /** One line of the skipped list. */
    rejection: (name: string, reason: string) => `${name} — ${reason}`,
    more: (count: number) => `and ${fe.number(count)} more`,
    largeSelection: (size: string) =>
      `Large selection (${size}). Creating the PDF needs about 2–3× this much memory; on a phone the page may reload and lose your images. Choose “Smaller file” quality before generating.`,
    inAppBrowser: 'Downloads may not work inside this app. Open the page in your browser for the best results.',
  },
  reasons: {
    unreadable: 'Could not read this file',
    svg: 'SVG isn’t supported',
    unsupported: 'Not a supported image',
    heic: 'HEIC isn’t supported by this browser — convert to JPEG first',
    undecodable: 'Could not read this image',
  } satisfies Record<RejectReason, string>,
  names: {
    unnamedFile: 'Unnamed file',
    untitledImage: 'Untitled image',
    /** The default download name, also used when the typed name is empty after cleaning. */
    fallbackFilename: 'images.pdf',
    /** The PDF's Creator entry (document properties). */
    creator: 'Images to PDF (runs in your browser)',
  },
  confirm: {
    clearImporting: 'Remove all images and stop adding the rest?',
    clearAll: (count: number) => (count === 1 ? 'Remove the image?' : `Remove all ${imagesEn(count)}?`),
  },
  result: {
    ready: (pages: number, size: string) => `Your PDF is ready: ${pagesEn(pages)} · ${size}`,
    /** Appended to `ready` in in-app browsers (social apps), which often ignore downloads. */
    inAppHint: 'If the download doesn’t start, use Share or open this page in Safari or Chrome.',
  },
  errors: {
    engine:
      'Couldn’t load the PDF engine. Check your connection and try again; your images are still here. If it keeps failing, reload the page.',
    memory:
      'This device ran out of memory while creating the PDF. Choose “Smaller file” quality or add fewer images, then try again.',
    item: (name: string) => `Could not process “${name}”. Remove it or try “Smaller file” quality.`,
    generic:
      'Something went wrong while creating the PDF. Choose “Smaller file” quality or add fewer images, then try again.',
    share: 'Sharing failed. Use “Download again” instead.',
  },
};

export type ImagesToPdfMessages = typeof en;

const tr: ImagesToPdfMessages = {
  meta: {
    title: 'Görsellerden PDF',
    description:
      'Fotoğrafları ve görselleri tarayıcınızda tek bir PDF dosyasında birleştirin: sayfaları sıralayın, sayfa boyutunu seçin ve indirin. Hiçbir şey yüklenmez.',
    eyebrow: 'PDF · tarayıcınızda çalışır',
    lead: 'Fotoğrafları, taramaları ve ekran görüntülerini tek bir PDF dosyasında toplayın. Her şey cihazınızda işlenir; hiçbir şey yüklenmez.',
    tips: 'İpuçları',
  },
  toolLabel: 'Görsellerden PDF oluşturma aracı',
  noscript: 'Bu araç JavaScript gerektirir. Tamamen tarayıcınızda çalışır; hiçbir şey yüklenmez.',
  dropzone: {
    choose: 'Görselleri seçin',
    addMore: 'Başka görseller ekleyin',
    drop: 'ya da buraya sürükleyip bırakın',
    formats: 'JPEG · PNG · WebP · GIF · AVIF · BMP',
    formatsHint: 'tarayıcınız destekliyorsa HEIC de',
    privacy: 'Görselleriniz cihazınızdan çıkmaz',
  },
  importing: (done, total) => `Görseller ekleniyor… ${ft.number(done)} / ${ft.number(total)}`,
  dismissNotice: 'Bildirimi kapat',
  toolbar: {
    title: 'Sayfalar',
    count: imagesTr,
    hintPointer: 'Sıralamak için sürükleyin',
    hintTouch: 'Sıralamak için basılı tutup sürükleyin',
    arrangeLabel: 'Görselleri düzenle',
    sort: 'A–Z sırala',
    reverse: 'Ters çevir',
    clear: 'Tümünü kaldır',
    skipToOptions: 'PDF seçeneklerine geç',
  },
  grid: {
    label: 'Sayfa sırası',
    moveEarlier: (page, name) => `${page}. sayfayı öne taşı (${name})`,
    moveLater: (page, name) => `${page}. sayfayı arkaya taşı (${name})`,
    remove: (page, name) => `${page}. sayfayı kaldır (${name})`,
    meta: (width, height, size) => `${width} × ${height} · ${size}`,
  },
  options: {
    legend: 'PDF seçenekleri',
    pageSize: 'Sayfa boyutu',
    pageSizes: { a4: 'A4', letter: 'Letter (ABD)', fit: 'Görsel boyutunda' },
    orientation: 'Yönlendirme',
    orientations: {
      auto: 'Otomatik (her görsele göre)',
      portrait: 'Dikey',
      landscape: 'Yatay',
    },
    orientationHint: '“Görsel boyutunda” seçildiğinde kullanılmaz.',
    margin: 'Kenar boşluğu',
    margins: {
      none: () => 'Yok',
      small: (size) => `Küçük (${size})`,
      large: (size) => `Büyük (${size})`,
    },
    marginHint: '“Görsel boyutunda” seçildiğinde her görselin çevresine eklenir.',
    quality: 'Kalite',
    qualities: { original: 'Orijinal kalite', compressed: 'Daha küçük dosya' },
    filename: 'Dosya adı',
  },
  actions: {
    generate: 'PDF oluştur',
    cancel: 'İptal',
    progressLabel: 'PDF oluşturma ilerlemesi',
    downloadAgain: 'Yeniden indir',
    share: 'Paylaş',
  },
  progress: {
    processing: (image, total) => `Görsel işleniyor: ${ft.number(image)} / ${ft.number(total)}…`,
    saving: 'PDF kaydediliyor…',
    cancelling: 'İptal ediliyor…',
  },
  announce: {
    adding: (count) => `${imagesTr(count)} ekleniyor…`,
    added: (count) => `${imagesTr(count)} eklendi`,
    addedSkipped: (added, skipped, details) => `${imagesTr(added)} eklendi, ${ft.number(skipped)} dosya atlandı: ${details}`,
    creating: 'PDF oluşturuluyor…',
    saving: 'PDF kaydediliyor…',
    cancelled: 'İptal edildi',
    moved: (name, position, total) => `“${name}” ${position}. sıraya taşındı (toplam ${total})`,
    removed: (name, left) => `“${name}” kaldırıldı. Kalan görsel sayısı: ${ft.number(left)}.`,
    removedAll: 'Tüm görseller kaldırıldı',
    sorted: 'Dosya adına göre A’dan Z’ye sıralandı',
    reversed: 'Sıra ters çevrildi',
  },
  status: {
    cancelled: 'İptal edildi.',
  },
  notices: {
    skipped: (count) => `${ft.number(count)} dosya atlandı:`,
    rejection: (name, reason) => `${name} — ${reason}`,
    more: (count) => `ve ${ft.number(count)} dosya daha`,
    largeSelection: (size) =>
      `Seçtiğiniz görseller toplam ${size}. PDF oluşturmak bunun yaklaşık 2–3 katı bellek gerektirir; telefonda sayfa yeniden yüklenebilir ve görselleriniz kaybolabilir. Oluşturmadan önce kalite olarak “Daha küçük dosya” seçin.`,
    inAppBrowser: 'Bu uygulamanın içinde indirme çalışmayabilir. En iyi sonuç için sayfayı tarayıcınızda açın.',
  },
  reasons: {
    unreadable: 'Dosya okunamadı',
    svg: 'SVG desteklenmiyor',
    unsupported: 'Desteklenen bir görsel değil',
    heic: 'Bu tarayıcı HEIC dosyalarını açamıyor; önce JPEG biçimine dönüştürün',
    undecodable: 'Görsel okunamadı',
  },
  names: {
    unnamedFile: 'Adsız dosya',
    untitledImage: 'Adsız görsel',
    fallbackFilename: 'görseller.pdf',
    creator: 'Görsellerden PDF (tarayıcınızda çalışır)',
  },
  confirm: {
    clearImporting: 'Tüm görseller kaldırılsın ve kalanların eklenmesi durdurulsun mu?',
    clearAll: (count) => (count === 1 ? 'Görsel kaldırılsın mı?' : `Görsellerin tümü kaldırılsın mı? (${imagesTr(count)})`),
  },
  result: {
    ready: (pages, size) => `PDF dosyanız hazır: ${ft.number(pages)} sayfa · ${size}`,
    inAppHint: 'İndirme başlamazsa “Paylaş” düğmesini kullanın ya da bu sayfayı Safari veya Chrome’da açın.',
  },
  errors: {
    engine:
      'PDF motoru yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin; görselleriniz yerinde duruyor. Sorun sürerse sayfayı yenileyin.',
    memory:
      'PDF oluşturulurken cihazın belleği yetmedi. Kalite olarak “Daha küçük dosya” seçin ya da daha az görsel ekleyip yeniden deneyin.',
    item: (name) => `“${name}” işlenemedi. Bu görseli kaldırın ya da kalite olarak “Daha küçük dosya” seçin.`,
    generic:
      'PDF oluşturulurken bir sorun oluştu. Kalite olarak “Daha küçük dosya” seçin ya da daha az görsel ekleyip yeniden deneyin.',
    share: 'Paylaşılamadı. Bunun yerine “Yeniden indir” bağlantısını kullanın.',
  },
};

export const imagesToPdfMessages = { en, tr } as const satisfies Localized<ImagesToPdfMessages>;
