/**
 * Interface text of the Image compressor (page, component and client controller).
 * Rich text with inline markup (tips, the paste hint) is written per locale in the .astro files.
 *
 * Interpolated values are pre-formatted by the caller (formatters(locale)): sizes such as
 * "2.4 MB" / "2,4 MB", percentages such as "64%" / "%64", and format names ("WebP").
 * Turkish sentences are built so that no value needs a case suffix.
 */
import type { Localized } from '../config.ts';
import type { OutputNames } from '../../lib/image/compress/filename.ts';

const en = {
  meta: {
    title: 'Image compressor',
    description:
      'Compress JPEG, PNG and WebP images in your browser: set the quality and format, compare before and after, and download a smaller file. Nothing is uploaded.',
  },
  header: {
    eyebrow: 'Browser tool',
    lead: 'Make images smaller for the web, email or chat. Set the quality and format, compare the result with the original, and download it. Everything runs on your device.',
  },
  toolLabel: 'Image compressor',
  noscript: 'This tool needs JavaScript. It runs entirely in your browser; nothing is uploaded.',
  dropzone: {
    title: 'Choose an image',
    titleLoaded: 'Choose another image',
    drop: 'or drop it here',
    formats: 'JPEG · PNG · WebP · GIF · AVIF',
    formatsHint: 'and other formats your browser can open',
  },
  file: {
    remove: 'Remove image',
  },
  errors: {
    empty: (name: string) => `“${name}” is empty.`,
    notImage: (name: string) => `“${name}” is not an image. Choose a JPEG, PNG, WebP or other image file.`,
    svg: (name: string) =>
      `“${name}” is an SVG, a vector drawing. This tool compresses photos and other pixel-based images.`,
    undecodable: (name: string, format: string) => `This browser cannot open “${name}” (${format}).`,
    heicHint: 'HEIC photos open in Safari. In other browsers, convert them to JPEG first.',
    unreadable: (name: string) => `“${name}” could not be read. It may have been moved or deleted.`,
    /** Refused before decoding: the stored size is over this device's decode limit. */
    tooManyPixels: (name: string, megapixels: string, limit: string) =>
      `“${name}” has too many pixels to open on this device (${megapixels}; the limit is ${limit}). Resize it in another app first.`,
    /** Decoded, but the browser ran out of memory while taking the image in. */
    openMemory: (name: string) =>
      `“${name}” could not be opened: the browser ran out of memory. Close other tabs and try again, or resize the image in another app first.`,
    /** Encoding ran out of memory on a phone or tablet. */
    memory:
      'This image is too large for the memory available on this device. Choose a smaller maximum size, or use a computer.',
    /** Encoding ran out of memory on a computer. */
    memoryDesktop: 'This image is too large for the memory available to the browser. Choose a smaller maximum size.',
    encodeFailed: 'The image could not be compressed. Try another format or a smaller maximum size.',
    pasteEmpty: 'The clipboard has no image. Copy an image, then paste again.',
    dismiss: 'Dismiss',
  },
  notices: {
    multiple: (name: string) => `One image at a time: “${name}” is open.`,
  },
  status: {
    opening: (name: string) => `Opening “${name}”…`,
    opened: (name: string, dimensions: string, size: string) => `“${name}” is open: ${dimensions}, ${size}.`,
    compressing: 'Compressing…',
    removed: 'Image removed.',
  },
  settings: {
    heading: 'Settings',
    quality: 'Quality',
    qualityHint: 'Lower values give smaller files with more visible artifacts. Around 70–80 is a good start for photos.',
    qualityMin: 'Smaller file',
    qualityMax: 'Higher quality',
    format: 'Format',
    formatOriginal: 'Original',
    formatWebp: 'WebP',
    formatJpeg: 'JPEG',
    size: 'Maximum size',
    sizeHint: 'Longest side. Smaller images are never enlarged.',
    sizeOriginal: 'Original size',
    sizeOption: (pixels: number) => `${pixels} px`,
  },
  notes: {
    pngLossless: 'PNG is lossless, so quality has no effect here. For a smaller file, choose WebP or JPEG.',
    alphaFlattened: 'JPEG cannot store transparency: transparent areas become white. WebP keeps them.',
    alphaFlattenedNoWebp: 'JPEG cannot store transparency: transparent areas become white. Choose “Original” to keep them.',
    webpUnsupported: (fallback: string) =>
      `This browser cannot create WebP files, so the image is saved as ${fallback}.`,
    webpOptionUnavailable: 'WebP is not available: this browser cannot create WebP files.',
    originalNotWritable: (source: string, output: string) =>
      `Browsers can open ${source} files but cannot create them, so “Original” saves as ${output}.`,
    canvasLimit: (dimensions: string) =>
      `Scaled down to ${dimensions}, the largest image this device can process.`,
    encoderLimit: (limit: string, dimensions: string) =>
      `WebP images can be at most ${limit} px on a side, so this one is scaled down to ${dimensions}.`,
    animation: 'Only the first frame of the animation is kept.',
    animationMaybe: 'If the image is animated, only its first frame is kept.',
  },
  compare: {
    heading: 'Comparison',
    /** Mono index above the comparison, as in a paper's figures. */
    figure: 'Fig. 1',
    view: 'View',
    viewSplit: 'Slider',
    viewSide: 'Side by side',
    zoom: 'Zoom',
    zoomFit: 'Fit',
    zoomActual: '1:1',
    zoomActualLabel: 'Actual size (1:1)',
    divider: 'Divider position',
    dividerValue: (original: string, compressed: string) => `Original ${original}, compressed ${compressed}`,
    before: 'Original',
    after: 'Compressed',
    altBefore: (name: string) => `Original: ${name}`,
    altAfter: (name: string) => `Compressed: ${name}`,
    /** Names of the image areas at 1:1, where they scroll and take keyboard focus. */
    scrollSplit: 'Comparison at actual size, scrollable',
    scrollBefore: 'Original at actual size, scrollable',
    scrollAfter: 'Compressed at actual size, scrollable',
  },
  result: {
    heading: 'Result',
    reduced: (percent: string) => `Reduced by ${percent}`,
    larger: (percent: string) => `${percent} larger than the original`,
    same: 'Same size as the original',
    sizes: (original: string, compressed: string) => `${original} → ${compressed}`,
    summary: (headline: string, original: string, compressed: string) => `${headline} — ${original} → ${compressed}`,
    /** Shown when the output is not smaller (the same size or larger). */
    notSmallerAdvice:
      'Re-encoding did not make this image smaller: it was already compressed efficiently. Try WebP or a lower quality, or keep the original.',
    quality: (percent: string) => `quality ${percent}`,
    lossless: 'lossless',
    download: 'Download',
    downloadAnyway: 'Download compressed anyway',
    downloadOriginal: 'Download original',
    originalKeepsMetadata: 'The original still contains its metadata.',
    metadata: 'Camera details, GPS location and other metadata are removed from the compressed copy.',
    fileSize: 'File size',
  },
  /**
   * Words in the download name (see OutputNames in filename.ts): "photo-compressed.webp";
   * the base also names a file that arrives without a name.
   */
  outputNames: {
    suffix: '-compressed',
    fallbackBase: 'image',
  } satisfies OutputNames,
  privacy: {
    label: 'Privacy',
    title: 'Nothing leaves your device.',
    body: 'Your browser decodes and re-encodes the image itself; it is never uploaded. Re-encoding also removes metadata such as camera details and GPS location, so the compressed copy is safer to share.',
  },
  tips: 'Tips',
};

export type ImageCompressorMessages = typeof en;

const tr: ImageCompressorMessages = {
  meta: {
    title: 'Görsel sıkıştırıcı',
    description:
      'JPEG, PNG ve WebP görselleri tarayıcınızda sıkıştırın. Kaliteyi ve biçimi seçin, öncesiyle sonrasını karşılaştırın, küçülen dosyayı indirin. Hiçbir şey yüklenmez.',
  },
  header: {
    eyebrow: 'Tarayıcı aracı',
    lead: 'Görselleri web, e-posta ya da mesajlaşma için küçültün. Kaliteyi ve biçimi ayarlayın, sonucu orijinalle karşılaştırın ve indirin. Her şey cihazınızda olur.',
  },
  toolLabel: 'Görsel sıkıştırıcı',
  noscript: 'Bu araç için JavaScript gerekli. Araç tamamen tarayıcınızda çalışır, hiçbir şey yüklenmez.',
  dropzone: {
    title: 'Bir görsel seçin',
    titleLoaded: 'Başka bir görsel seçin',
    drop: 'ya da buraya sürükleyip bırakın',
    formats: 'JPEG · PNG · WebP · GIF · AVIF',
    formatsHint: 've tarayıcınızın açabildiği diğer biçimler',
  },
  file: {
    remove: 'Görseli kaldır',
  },
  errors: {
    empty: (name) => `“${name}” boş bir dosya.`,
    notImage: (name) => `“${name}” bir görsel değil. JPEG, PNG, WebP ya da başka bir görsel dosyası seçin.`,
    svg: (name) =>
      `“${name}” bir SVG, yani vektörel bir çizim. Bu araç fotoğrafları ve piksel tabanlı diğer görselleri sıkıştırır.`,
    undecodable: (name, format) => `“${name}” bu tarayıcıda açılamıyor (${format}).`,
    heicHint: 'HEIC fotoğraflar Safari’de açılır. Diğer tarayıcılarda önce fotoğrafı JPEG biçimine dönüştürün.',
    unreadable: (name) => `“${name}” okunamadı. Taşınmış ya da silinmiş olabilir.`,
    tooManyPixels: (name, megapixels, limit) =>
      `“${name}” bu cihazda açılamayacak kadar çok piksel içeriyor (${megapixels}; sınır: ${limit}). Görseli önce başka bir uygulamada küçültün.`,
    openMemory: (name) =>
      `“${name}” açılamadı: tarayıcının belleği yetmedi. Diğer sekmeleri kapatıp yeniden deneyin ya da görseli önce başka bir uygulamada küçültün.`,
    memory:
      'Bu görsel, cihazınızın belleğine sığmayacak kadar büyük. “En büyük boyut” için daha küçük bir değer seçin ya da bilgisayar kullanın.',
    memoryDesktop:
      'Bu görsel, tarayıcının kullanabildiği belleğe sığmayacak kadar büyük. “En büyük boyut” için daha küçük bir değer seçin.',
    encodeFailed: 'Görsel sıkıştırılamadı. Başka bir biçim deneyin ya da “En büyük boyut” değerini düşürün.',
    pasteEmpty: 'Panoda görsel yok. Bir görsel kopyalayıp yeniden yapıştırın.',
    dismiss: 'Kapat',
  },
  notices: {
    multiple: (name) => `Tek seferde yalnızca bir görsel açılabilir: “${name}” açıldı.`,
  },
  status: {
    opening: (name) => `“${name}” açılıyor…`,
    opened: (name, dimensions, size) => `“${name}” açıldı: ${dimensions}, ${size}.`,
    compressing: 'Sıkıştırılıyor…',
    removed: 'Görsel kaldırıldı.',
  },
  settings: {
    heading: 'Ayarlar',
    quality: 'Kalite',
    qualityHint:
      'Düşük değerler daha küçük dosya verir, ancak bozulmalar daha çok göze çarpar. Fotoğraflar için 70–80 arası iyi bir başlangıçtır.',
    qualityMin: 'Daha küçük dosya',
    qualityMax: 'Daha yüksek kalite',
    format: 'Biçim',
    formatOriginal: 'Orijinal',
    formatWebp: 'WebP',
    formatJpeg: 'JPEG',
    size: 'En büyük boyut',
    sizeHint: 'Uzun kenar için geçerlidir. Daha küçük görseller büyütülmez.',
    sizeOriginal: 'Orijinal boyut',
    sizeOption: (pixels) => `${pixels} px`,
  },
  notes: {
    pngLossless: 'PNG kayıpsız bir biçim, bu yüzden kalite ayarı burada işe yaramaz. Daha küçük bir dosya için WebP ya da JPEG seçin.',
    alphaFlattened: 'JPEG saydamlığı saklayamaz: saydam alanlar beyaz olur. WebP saydamlığı korur.',
    alphaFlattenedNoWebp: 'JPEG saydamlığı saklayamaz: saydam alanlar beyaz olur. Saydamlığı korumak için “Orijinal” seçeneğini kullanın.',
    webpUnsupported: (fallback) => `Bu tarayıcı WebP dosyası oluşturamıyor; görsel ${fallback} olarak kaydediliyor.`,
    webpOptionUnavailable: 'WebP kullanılamıyor: bu tarayıcı WebP dosyası oluşturamıyor.',
    originalNotWritable: (source, output) =>
      `Tarayıcılar ${source} dosyalarını açabilir ama oluşturamaz. Bu yüzden “Orijinal” seçildiğinde görsel ${output} olarak kaydedilir.`,
    canvasLimit: (dimensions) => `Görsel, bu cihazın işleyebileceği en büyük boyuta küçültüldü: ${dimensions}.`,
    encoderLimit: (limit, dimensions) =>
      `WebP görsellerin bir kenarı en fazla ${limit} piksel olabilir; bu yüzden görsel küçültüldü: ${dimensions}.`,
    animation: 'Animasyonun yalnızca ilk karesi korunur.',
    animationMaybe: 'Görsel hareketliyse yalnızca ilk karesi korunur.',
  },
  compare: {
    heading: 'Karşılaştırma',
    figure: 'Şekil 1',
    view: 'Görünüm',
    viewSplit: 'Kaydırıcı',
    viewSide: 'Yan yana',
    zoom: 'Yakınlaştırma',
    zoomFit: 'Sığdır',
    zoomActual: '1:1',
    zoomActualLabel: 'Gerçek boyut (1:1)',
    divider: 'Ayırıcı konumu',
    dividerValue: (original, compressed) => `Orijinal ${original}, sıkıştırılmış ${compressed}`,
    before: 'Orijinal',
    after: 'Sıkıştırılmış',
    altBefore: (name) => `Orijinal: ${name}`,
    altAfter: (name) => `Sıkıştırılmış: ${name}`,
    scrollSplit: 'Gerçek boyutta karşılaştırma, kaydırılabilir',
    scrollBefore: 'Gerçek boyutta orijinal görsel, kaydırılabilir',
    scrollAfter: 'Gerçek boyutta sıkıştırılmış görsel, kaydırılabilir',
  },
  result: {
    heading: 'Sonuç',
    reduced: (percent) => `${percent} küçüldü`,
    larger: (percent) => `Orijinalden ${percent} büyük`,
    same: 'Orijinalle aynı boyutta',
    sizes: (original, compressed) => `${original} → ${compressed}`,
    summary: (headline, original, compressed) => `${headline} — ${original} → ${compressed}`,
    notSmallerAdvice:
      'Yeniden kodlanınca görsel küçülmedi, çünkü zaten iyi sıkıştırılmış. WebP biçimini ya da daha düşük bir kaliteyi deneyin. İsterseniz orijinal dosyayı olduğu gibi kullanın.',
    quality: (percent) => `kalite ${percent}`,
    lossless: 'kayıpsız',
    download: 'İndir',
    downloadAnyway: 'Sıkıştırılmış dosyayı yine de indir',
    downloadOriginal: 'Orijinali indir',
    originalKeepsMetadata: 'Orijinal dosyadaki meta veriler olduğu gibi durur.',
    metadata: 'Sıkıştırılmış kopyada kamera bilgileri, GPS konumu ve diğer meta veriler yer almaz.',
    fileSize: 'Dosya boyutu',
  },
  outputNames: {
    suffix: '-sıkıştırılmış',
    fallbackBase: 'görsel',
  },
  privacy: {
    label: 'Gizlilik',
    title: 'Hiçbir şey cihazınızdan çıkmaz.',
    body: 'Görseli doğrudan tarayıcınız açar ve yeniden kodlar; görsel hiçbir yere yüklenmez. Yeniden kodlama sırasında kamera bilgileri ve GPS konumu gibi meta veriler de silinir. Bu yüzden sıkıştırılmış kopyayı paylaşmak daha güvenlidir.',
  },
  tips: 'İpuçları',
};

export const imageCompressorMessages = { en, tr } as const satisfies Localized<ImageCompressorMessages>;
