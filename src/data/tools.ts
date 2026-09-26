import type { Localized } from '../i18n/config.ts';

export type ToolStatus = 'ready' | 'planned';

export interface ToolInfo {
  slug: string;
  title: Localized<string>;
  description: Localized<string>;
  /** 'ready' tools are linked from /tools/; 'planned' ones show a muted "Coming soon" card. */
  status: ToolStatus;
  /** Locale-free path; localize it with localizePath(). */
  href: string;
}

export const TOOLS: readonly ToolInfo[] = [
  {
    slug: 'images-to-pdf',
    title: { en: 'Images to PDF', tr: 'Görsellerden PDF' },
    description: {
      en: 'Combine photos, scans and screenshots into one PDF: reorder the pages, pick a page size and margins, and keep JPEGs at their original quality.',
      tr: 'Fotoğrafları, taramaları ve ekran görüntülerini tek bir PDF’te birleştirin. Sayfaları sıralayın, sayfa boyutunu ve kenar boşluklarını seçin. JPEG’ler orijinal kalitesinde kalır.',
    },
    status: 'ready',
    href: '/tools/images-to-pdf/',
  },
  {
    slug: 'notepad',
    title: { en: 'Notepad', tr: 'Not defteri' },
    description: {
      en: 'A distraction-free plain-text editor with zen mode, autosave in your browser, find & replace with regular expressions, and live line and word counts.',
      tr: 'Dikkatinizi dağıtmayan sade bir metin düzenleyici. Odak modu, tarayıcıda otomatik kayıt, düzenli ifadelerle bul ve değiştir, anlık satır ve kelime sayacı var.',
    },
    status: 'ready',
    href: '/tools/notepad/',
  },
  {
    slug: 'pdf-split',
    title: { en: 'Split PDF', tr: 'PDF bölme' },
    description: {
      en: 'Preview every page as a thumbnail, pick pages by clicking or typing ranges like 1-3, 5, and download the result. Or split into parts as a ZIP.',
      tr: 'Her sayfayı küçük resim olarak görün. Sayfaları tıklayarak ya da 1-3, 5 gibi aralıklar yazarak seçin ve sonucu indirin. İsterseniz dosyayı parçalara bölüp ZIP olarak alın.',
    },
    status: 'ready',
    href: '/tools/pdf-split/',
  },
  {
    slug: 'image-compressor',
    title: { en: 'Image compressor', tr: 'Görsel sıkıştırıcı' },
    description: {
      en: 'Shrink JPEG, PNG and WebP images with a quality slider and format choice, and compare before and after side by side.',
      tr: 'JPEG, PNG ve WebP görsellerini kalite ayarı ve biçim seçimiyle küçültün. Öncesini ve sonrasını yan yana karşılaştırın.',
    },
    status: 'ready',
    href: '/tools/image-compressor/',
  },
  {
    slug: 'pdf-compress',
    title: { en: 'Compress PDF', tr: 'PDF sıkıştırma' },
    description: {
      en: 'Shrink a PDF by re-compressing its images and cleaning out unused objects.',
      tr: 'PDF’teki görselleri yeniden sıkıştırıp kullanılmayan nesneleri temizleyerek dosyayı küçültün.',
    },
    status: 'ready',
    href: '/tools/pdf-compress/',
  },
  {
    slug: 'password-generator',
    title: { en: 'Password generator', tr: 'Parola üretici' },
    description: {
      en: 'Cryptographically secure random passwords with length and character-set options and a strength estimate.',
      tr: 'Kriptografik olarak güvenli, rastgele parolalar üretin. Uzunluğu ve karakter türlerini seçin; araç parolanın ne kadar güçlü olduğunu da tahmin eder.',
    },
    status: 'ready',
    href: '/tools/password-generator/',
  },
  {
    slug: 'prime-factorizer',
    title: { en: 'Integer & prime factorizer', tr: 'Asal çarpanlara ayırma' },
    description: {
      en: 'Factor whole numbers of up to 40 digits: the canonical prime factorization, every divisor, and τ(n), σ(n) and φ(n), computed in a background thread.',
      tr: '40 basamağa kadar tam sayıları asal çarpanlarına ayırın. Tüm bölenleri ve τ(n), σ(n), φ(n) değerlerini de görün. Hesaplama arka planda ayrı bir iş parçacığında yapılır.',
    },
    status: 'ready',
    href: '/tools/prime-factorizer/',
  },
  {
    slug: 'binary-text',
    title: { en: 'Binary ↔ text converter', tr: 'İkili ↔ metin dönüştürücü' },
    description: {
      en: 'Turn text into the bits of its UTF-8 bytes and binary back into text, live in both directions. Check for ASCII and see every character byte by byte.',
      tr: 'Metni UTF-8 baytlarının bitlerine, ikili kodu da metne çevirin. Hangi alana yazarsanız yazın, öbürü anında güncellenir. Metnin ASCII olup olmadığını denetleyin, her karakteri bayt bayt görün.',
    },
    status: 'ready',
    href: '/tools/binary-text/',
  },
  {
    slug: 'geo-distance',
    title: { en: 'Great-circle distance', tr: 'Büyük daire mesafesi' },
    description: {
      en: 'Distance, bearings and midpoint between two latitude/longitude points, in decimal degrees or DMS, with the route drawn on a globe.',
      tr: 'Enlem ve boylamını girdiğiniz iki nokta arasındaki mesafeyi, yönleri ve orta noktayı bulun. Koordinatları ondalık derece ya da derece, dakika, saniye olarak yazın; rotayı bir küre üzerinde görün.',
    },
    status: 'ready',
    href: '/tools/geo-distance/',
  },
];
