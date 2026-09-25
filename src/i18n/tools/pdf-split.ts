/**
 * Interface text for the Split PDF tool: the component (server-rendered), the controller
 * (client) and the words that go into generated file names. The page's tips are rich
 * markup and live per locale in src/pages/[...lang]/tools/pdf-split.astro.
 *
 * The libraries (src/lib/pdf/page-ranges.ts, split-pdf.ts, zip-store.ts) return codes and
 * structured data; `rangeError`, `plan.summary` and `errors.*` word them here.
 *
 * Turkish messages are phrased so that interpolated values stand alone and never need a
 * case suffix ("Sayfa 12 yok", "“a.pdf” okunamadı").
 */
import type { Localized } from '../config.ts';
import { formatters } from '../format.ts';
import type { OutputNames, PlanError, PlanSummary, SplitMode } from '../../lib/pdf/page-ranges.ts';
import type { ZipLimitCode } from '../../lib/zip/zip-store.ts';

type ModeText = { title: string; description: string };

const fe = formatters('en');
const ft = formatters('tr');

/** "1 page", "1,234 pages". */
const pagesEn = (n: number) => `${fe.number(n)} ${n === 1 ? 'page' : 'pages'}`;
const filesEn = (n: number) => `${fe.number(n)} ${n === 1 ? 'file' : 'files'}`;
/** Turkish keeps the noun singular after a number: "1 sayfa", "1.234 sayfa". */
const pagesTr = (n: number) => `${ft.number(n)} sayfa`;

const en = {
  meta: {
    title: 'Split PDF',
    description:
      'Preview every page of a PDF, pick pages by clicking or by typing ranges like 1-3, 5, and save them as a new PDF, or split the file into parts. Runs in your browser; nothing is uploaded.',
    eyebrow: 'PDF · runs in your browser',
    lead: 'Pull out the pages you need or split a PDF into several files. Everything happens on your device; the file is never uploaded.',
    tips: 'Tips',
  },
  toolLabel: 'PDF splitter',
  noscript: 'This tool needs JavaScript. It runs entirely in your browser; nothing is uploaded.',
  dropzone: {
    choose: 'Choose a PDF',
    drop: 'or drop it here',
    note: 'Stays on your device · one PDF at a time',
  },
  file: {
    unnamed: 'Unnamed file',
    chooseAnother: 'Choose another file',
    reading: (size: string) => `${size} · Reading PDF…`,
    summary: (pages: number, size: string) => `${pagesEn(pages)} · ${size}`,
  },
  dismissNotice: 'Dismiss notice',
  options: {
    legend: 'Split options',
    mode: 'Mode',
  },
  modes: {
    extract: { title: 'Extract pages', description: 'The pages you select become one new PDF.' },
    ranges: { title: 'Split by ranges', description: 'Each range becomes its own PDF. Several files are saved as one ZIP.' },
    every: { title: 'Every N pages', description: 'Equal parts, such as every 2 pages, saved as one ZIP.' },
    single: { title: 'One file per page', description: 'Every page becomes its own PDF, saved as one ZIP.' },
  } satisfies Record<SplitMode, ModeText>,
  pages: {
    labelExtract: 'Pages to extract',
    labelRanges: 'Page ranges',
    hintExtract: 'In the order you want them, e.g. 1-3, 5, 8- (8- means page 8 to the end).',
    hintRanges: 'Each range becomes its own PDF, e.g. 1-4, 5-8, 9-end.',
    placeholder: 'e.g. 1-3, 5, 8-',
    prompt: 'Select pages or type them in the field above.',
  },
  every: {
    label: 'Pages per file',
    prompt: 'Enter how many pages each file should have.',
  },
  name: {
    label: 'File name',
    savesAs: (filename: string) => `Saves as ${filename}`,
    savesZip: (zip: string, files: number) => `Saves as ${zip}, with ${fe.number(files)} ${files === 1 ? 'PDF' : 'PDFs'} inside`,
    example: (example: string) => `New files are named like ${example}`,
  },
  /** Words in generated file names (see OutputNames in page-ranges.ts). */
  outputNames: {
    fallbackBase: 'document',
    page: 'page',
    pages: 'pages',
    selected: 'selected-pages',
    part: 'part',
    zip: 'split',
  } satisfies OutputNames,
  grid: {
    title: 'Pages',
    selectAll: 'Select all',
    clear: 'Clear',
    clearLabel: 'Clear selection',
    invert: 'Invert',
    invertLabel: 'Invert selection',
    hintPointer: 'Click pages to select them; Shift-click selects everything in between.',
    hintTouch: 'Tap pages to select them.',
    hintKeyboard: 'With the keyboard: arrow keys move, Space selects, Shift+Space selects a range.',
    hintRanges: 'Consecutive selected pages form one file.',
    hintReadOnly: 'The labels show which file each page goes into.',
    customOrder: 'Custom order: pages are saved in the order typed above, and newly selected pages go at the end.',
    countNone: 'No pages selected',
    countSome: (selected: number, total: number) => `${fe.number(selected)} of ${pagesEn(total)} selected`,
    countAll: (total: number) => (total === 1 ? 'The only page is selected' : `All ${fe.number(total)} pages selected`),
    countFiles: (pages: number, files: number) => `${pagesEn(pages)} in ${filesEn(files)}`,
    /** Accessible name of a page tile; `file` is 0 when no file label is shown. */
    tile: (page: number, file: number, uses: number) =>
      `Page ${page}${file > 0 ? `, file ${file}` : ''}${uses > 1 ? `, used ${uses} times` : ''}`,
    fileTag: (file: number) => `File ${file}`,
    previewUnavailable: 'Preview unavailable',
    previewsFailed: 'Previews aren’t available for this PDF. You can still select pages and split it.',
    previewsOffPages: (pages: number) => `This PDF has ${pagesEn(pages)}. Previews use extra memory, so they are off for now.`,
    previewsOffSize: (size: string) =>
      `Large file (${size}). Previews use extra memory on phones and tablets, so they are off for now.`,
    showPreviews: 'Show previews',
    tooManyPages: (pages: number, limit: number) =>
      `This PDF has ${pagesEn(pages)}, more than the page view can show (${fe.number(limit)}). Type the pages you need in the field above.`,
  },
  plan: {
    summary: ({ files, pages, items, more }: PlanSummary) => {
      const list = `${items.join(', ')}${more > 0 ? ` and ${fe.number(more)} more` : ''}`;
      if (files === 1) return pages === 1 ? `Will create 1 file: page ${items[0]}` : `Will create 1 file with ${pagesEn(pages)}: ${list}`;
      return `Will create ${filesEn(files)}: pages ${list}`;
    },
  },
  actions: {
    extract: 'Extract pages',
    split: 'Split PDF',
    cancel: 'Cancel',
    cancelling: 'Cancelling…',
    cancelled: 'Cancelled.',
    progressLabel: 'Split progress',
    downloadAgain: 'Download again',
    zipFiles: (files: number) => `Files in the ZIP (${fe.number(files)})`,
  },
  progress: {
    reading: 'Reading PDF…',
    zipping: 'Packing ZIP…',
    creatingOne: 'Creating PDF…',
    creatingMany: (done: number, total: number) => `Creating file ${fe.number(done)} of ${fe.number(total)}…`,
    starting: (files: number) => (files > 1 ? `Creating ${filesEn(files)}…` : 'Creating PDF…'),
  },
  result: {
    pdf: (pages: number, size: string) => `Your PDF is ready: ${pagesEn(pages)} · ${size}`,
    zip: (files: number, size: string) => `Your ZIP is ready: ${fe.number(files)} PDFs · ${size}`,
    fileMeta: (pages: number, size: string) => `${pagesEn(pages)} · ${size}`,
    moreFiles: (files: number) => `and ${filesEn(files)} more in the ZIP`,
  },
  status: {
    reading: (name: string) => `Reading “${name}”…`,
    loaded: (name: string, pages: number) => `Loaded “${name}”: ${pagesEn(pages)}.`,
    oneAtATime: (name: string) => `One PDF at a time: using “${name}”.`,
    chooseFirst: 'Choose a PDF first',
    largeFile: (size: string) =>
      `Large file (${size}). Splitting it needs a lot of memory, so on a phone or tablet the page may reload. If that happens, use a computer.`,
  },
  errors: {
    engine: 'Couldn’t load the PDF engine. Check your connection and reload the page.',
    memory: 'This device ran out of memory. Try creating fewer files at once, or use a computer for very large PDFs.',
    memoryReading: (name: string) => `This device ran out of memory while reading “${name}”. Try on a computer.`,
    read: (name: string) => `Couldn’t read “${name}”. It may have been moved or changed; choose it again.`,
    readAgain: (name: string) => `Couldn’t read “${name}” again. It may have been moved or changed; choose it again.`,
    damaged: (name: string) => `Couldn’t open “${name}”. The file may be damaged or incomplete.`,
    notPdf: (name: string) => `“${name}” isn’t a PDF. Choose a PDF file.`,
    noPages: (name: string) => `“${name}” has no pages.`,
    password:
      'This PDF is password-protected or has editing restrictions, so it can’t be split here. Save an unprotected copy first (for example with Print → Save as PDF), then try again.',
    splitFailed: 'Something went wrong while splitting the PDF. The file may be damaged.',
    zip: (code: ZipLimitCode, count: number, limit: number) =>
      code === 'too-many-entries'
        ? `Too many files for one ZIP (${fe.number(count)}; the limit is ${fe.number(limit)}). Create fewer files at once.`
        : code === 'too-large'
          ? 'The files are too large for one ZIP (the limit is 4 GB). Create fewer files at once.'
          : 'A file name is too long for a ZIP. Choose a shorter file name.',
  },
  rangeError: (error: PlanError): string => {
    switch (error.code) {
      case 'no-pages':
        return 'This PDF has no pages';
      case 'empty':
        return 'Select at least one page, or type pages such as 1-3, 5';
      case 'page-zero':
        return 'Page numbers start at 1';
      case 'page-out-of-range':
        return `Page ${error.page} doesn’t exist — this PDF has ${pagesEn(error.pageCount)}`;
      case 'unexpected':
        return `Unexpected “${error.text}” near position ${error.position}`;
      case 'missing-page':
        return `Add a page number before or after “${error.dash}” near position ${error.position}`;
      case 'invalid-every':
        return 'Enter a whole number of pages (1 or more)';
      case 'invalid-mode':
        return 'Choose how to split the PDF';
      case 'too-many-pages':
        return `That adds up to ${pagesEn(error.total)} — the limit is ${fe.number(error.limit)} at a time`;
    }
  },
};

export type PdfSplitMessages = typeof en;

const tr: PdfSplitMessages = {
  meta: {
    title: 'PDF bölme',
    description:
      'Bir PDF dosyasının her sayfasını önizleyin; sayfaları tıklayarak ya da 1-3, 5 gibi aralıklar yazarak seçip yeni bir PDF olarak kaydedin veya dosyayı parçalara ayırın. Tarayıcınızda çalışır, hiçbir şey yüklenmez.',
    eyebrow: 'PDF · tarayıcınızda çalışır',
    lead: 'İhtiyacınız olan sayfaları ayırın ya da bir PDF dosyasını birkaç parçaya bölün. Her şey cihazınızda gerçekleşir; dosya hiçbir yere yüklenmez.',
    tips: 'İpuçları',
  },
  toolLabel: 'PDF bölme aracı',
  noscript: 'Bu araç JavaScript gerektirir. Tamamen tarayıcınızda çalışır; hiçbir şey yüklenmez.',
  dropzone: {
    choose: 'PDF seçin',
    drop: 'ya da buraya sürükleyip bırakın',
    note: 'Cihazınızdan çıkmaz · tek seferde bir PDF',
  },
  file: {
    unnamed: 'Adsız dosya',
    chooseAnother: 'Başka dosya seçin',
    reading: (size) => `${size} · PDF okunuyor…`,
    summary: (pages, size) => `${pagesTr(pages)} · ${size}`,
  },
  dismissNotice: 'Bildirimi kapat',
  options: {
    legend: 'Bölme seçenekleri',
    mode: 'Yöntem',
  },
  modes: {
    extract: { title: 'Sayfaları çıkar', description: 'Seçtiğiniz sayfalar tek bir yeni PDF olur.' },
    ranges: { title: 'Aralıklara böl', description: 'Her aralık ayrı bir PDF olur. Birden çok dosya tek bir ZIP olarak kaydedilir.' },
    every: { title: 'N sayfalık parçalar', description: 'Eşit parçalar (ör. 2’şer sayfa), tek bir ZIP olarak kaydedilir.' },
    single: { title: 'Her sayfa ayrı dosya', description: 'Her sayfa ayrı bir PDF olur ve hepsi tek bir ZIP olarak kaydedilir.' },
  },
  pages: {
    labelExtract: 'Çıkarılacak sayfalar',
    labelRanges: 'Sayfa aralıkları',
    hintExtract: 'İstediğiniz sırayla yazın, ör. 1-3, 5, 8- (8- yazarsanız 8. sayfadan sona kadar alınır).',
    hintRanges: 'Her aralık ayrı bir PDF olur, ör. 1-4, 5-8, 9-son.',
    placeholder: 'ör. 1-3, 5, 8-',
    prompt: 'Sayfaları seçin ya da yukarıdaki alana yazın.',
  },
  every: {
    label: 'Dosya başına sayfa',
    prompt: 'Her dosyada kaç sayfa olacağını girin.',
  },
  name: {
    label: 'Dosya adı',
    savesAs: (filename) => `Kaydedilecek dosya: ${filename}`,
    savesZip: (zip, files) => `Kaydedilecek dosya: ${zip} (içinde ${ft.number(files)} PDF)`,
    example: (example) => `Dosya adları şöyle olur: ${example}`,
  },
  outputNames: {
    fallbackBase: 'belge',
    page: 'sayfa',
    pages: 'sayfa',
    selected: 'seçili-sayfalar',
    part: 'parça',
    zip: 'bölünmüş',
  },
  grid: {
    title: 'Sayfalar',
    selectAll: 'Tümünü seç',
    clear: 'Temizle',
    clearLabel: 'Seçimi temizle',
    invert: 'Tersine çevir',
    invertLabel: 'Seçimi tersine çevir',
    hintPointer: 'Seçmek için sayfalara tıklayın; Shift tuşuyla tıklarsanız aradaki tüm sayfalar seçilir.',
    hintTouch: 'Seçmek için sayfalara dokunun.',
    hintKeyboard: 'Klavyeyle: ok tuşlarıyla gezinin, Boşluk ile seçin, Shift+Boşluk ile aralık seçin.',
    hintRanges: 'Art arda seçilen sayfalar tek bir dosya olur.',
    hintReadOnly: 'Etiketler, her sayfanın hangi dosyaya gireceğini gösterir.',
    customOrder: 'Özel sıra: sayfalar yukarıda yazdığınız sırayla kaydedilir; yeni seçtiğiniz sayfalar sona eklenir.',
    countNone: 'Seçili sayfa yok',
    countSome: (selected, total) => `${ft.number(selected)} / ${pagesTr(total)} seçildi`,
    countAll: (total) => (total === 1 ? 'Tek sayfa seçildi' : `Tüm sayfalar seçildi (${ft.number(total)})`),
    countFiles: (pages, files) => `${ft.number(files)} dosyada ${pagesTr(pages)}`,
    tile: (page, file, uses) => `Sayfa ${page}${file > 0 ? `, dosya ${file}` : ''}${uses > 1 ? `, ${uses} kez` : ''}`,
    fileTag: (file) => `Dosya ${file}`,
    previewUnavailable: 'Önizleme yok',
    previewsFailed: 'Bu PDF için önizleme gösterilemiyor. Yine de sayfa seçip dosyayı bölebilirsiniz.',
    previewsOffPages: (pages) => `Bu belge ${pagesTr(pages)}. Önizlemeler ek bellek kullandığından şimdilik kapalı.`,
    previewsOffSize: (size) =>
      `Büyük dosya (${size}). Önizlemeler telefon ve tabletlerde ek bellek kullandığından şimdilik kapalı.`,
    showPreviews: 'Önizlemeleri göster',
    tooManyPages: (pages, limit) =>
      `Bu belge ${pagesTr(pages)}; sayfa görünümü en fazla ${ft.number(limit)} sayfa gösterebilir. İhtiyacınız olan sayfaları yukarıdaki alana yazın.`,
  },
  plan: {
    summary: ({ files, pages, items, more }) => {
      const list = items.join(', ');
      if (files === 1) {
        if (pages === 1) return `1 dosya oluşturulacak: ${items[0]}. sayfa`;
        return `${pagesTr(pages)}lık 1 dosya oluşturulacak: ${list}${more > 0 ? ` ve ${ft.number(more)} aralık daha` : ''}`;
      }
      return `${ft.number(files)} dosya oluşturulacak. Sayfalar: ${list}${more > 0 ? ` ve ${ft.number(more)} dosya daha` : ''}`;
    },
  },
  actions: {
    extract: 'Sayfaları çıkar',
    split: 'Böl ve indir',
    cancel: 'İptal',
    cancelling: 'İptal ediliyor…',
    cancelled: 'İptal edildi.',
    progressLabel: 'Bölme ilerlemesi',
    downloadAgain: 'Yeniden indir',
    zipFiles: (files) => `ZIP içindeki dosyalar (${ft.number(files)})`,
  },
  progress: {
    reading: 'PDF okunuyor…',
    zipping: 'ZIP hazırlanıyor…',
    creatingOne: 'PDF oluşturuluyor…',
    creatingMany: (done, total) => `Dosya oluşturuluyor: ${ft.number(done)} / ${ft.number(total)}…`,
    starting: (files) => (files > 1 ? `${ft.number(files)} dosya oluşturuluyor…` : 'PDF oluşturuluyor…'),
  },
  result: {
    pdf: (pages, size) => `Dosyanız hazır: ${pagesTr(pages)} · ${size}`,
    zip: (files, size) => `ZIP dosyanız hazır: ${ft.number(files)} PDF · ${size}`,
    fileMeta: (pages, size) => `${pagesTr(pages)} · ${size}`,
    moreFiles: (files) => `ve ZIP içinde ${ft.number(files)} dosya daha`,
  },
  status: {
    reading: (name) => `“${name}” okunuyor…`,
    loaded: (name, pages) => `“${name}” yüklendi: ${pagesTr(pages)}.`,
    oneAtATime: (name) => `Tek seferde bir PDF işlenir: “${name}” kullanılıyor.`,
    chooseFirst: 'Önce bir PDF seçin',
    largeFile: (size) =>
      `Büyük dosya (${size}). Bölme işlemi çok bellek gerektirir; telefon ya da tablette sayfa yeniden yüklenebilir. Böyle olursa bir bilgisayar kullanın.`,
  },
  errors: {
    engine: 'PDF motoru yüklenemedi. Bağlantınızı kontrol edip sayfayı yenileyin.',
    memory: 'Cihazın belleği yetmedi. Tek seferde daha az dosya oluşturmayı deneyin; çok büyük PDF’ler için bir bilgisayar kullanın.',
    memoryReading: (name) => `“${name}” okunurken cihazın belleği yetmedi. Bir bilgisayarda deneyin.`,
    read: (name) => `“${name}” okunamadı. Dosya taşınmış ya da değiştirilmiş olabilir; lütfen yeniden seçin.`,
    readAgain: (name) => `“${name}” yeniden okunamadı. Dosya taşınmış ya da değiştirilmiş olabilir; lütfen yeniden seçin.`,
    damaged: (name) => `“${name}” açılamadı. Dosya bozuk ya da eksik olabilir.`,
    notPdf: (name) => `“${name}” bir PDF dosyası değil. Lütfen bir PDF seçin.`,
    noPages: (name) => `“${name}” içinde hiç sayfa yok.`,
    password:
      'Bu PDF parola korumalı ya da düzenleme kısıtlamalı olduğundan burada bölünemiyor. Önce korumasız bir kopyasını kaydedin (ör. Yazdır → PDF olarak kaydet), ardından tekrar deneyin.',
    splitFailed: 'PDF bölünürken bir sorun oluştu. Dosya bozuk olabilir.',
    zip: (code, count, limit) =>
      code === 'too-many-entries'
        ? `Tek bir ZIP için çok fazla dosya var (${ft.number(count)}; üst sınır ${ft.number(limit)}). Tek seferde daha az dosya oluşturun.`
        : code === 'too-large'
          ? 'Dosyalar tek bir ZIP için fazla büyük (üst sınır 4 GB). Tek seferde daha az dosya oluşturun.'
          : 'Bir dosya adı ZIP için fazla uzun. Daha kısa bir dosya adı seçin.',
  },
  rangeError: (error) => {
    switch (error.code) {
      case 'no-pages':
        return 'Bu belgede hiç sayfa yok';
      case 'empty':
        return 'En az bir sayfa seçin ya da 1-3, 5 gibi sayfa numaraları yazın';
      case 'page-zero':
        return 'Sayfa numaraları 1’den başlar';
      case 'page-out-of-range':
        return `Sayfa ${error.page} yok: bu belgede ${pagesTr(error.pageCount)} var`;
      case 'unexpected':
        return `Anlaşılamayan ifade: “${error.text}” (${error.position}. karakter)`;
      case 'missing-page':
        return `“${error.dash}” işaretinin önüne ya da arkasına bir sayfa numarası yazın (${error.position}. karakter)`;
      case 'invalid-every':
        return 'Dosya başına sayfa sayısı olarak 1 ya da daha büyük bir tam sayı girin';
      case 'invalid-mode':
        return 'Bölme yöntemini seçin';
      case 'too-many-pages':
        return `Toplam sayfa sayısı ${ft.number(error.total)}; tek seferde en fazla ${ft.number(error.limit)} sayfa oluşturulabilir`;
    }
  },
};

export const pdfSplitMessages = { en, tr } as const satisfies Localized<PdfSplitMessages>;
