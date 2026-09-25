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
      tr: 'Fotoğrafları, taramaları ve ekran görüntülerini tek bir PDF dosyasında birleştirin: sayfaları sıralayın, sayfa boyutunu ve kenar boşluğunu seçin; JPEG fotoğraflar orijinal kalitesinde kalır.',
    },
    status: 'ready',
    href: '/tools/images-to-pdf/',
  },
  {
    slug: 'notepad',
    title: { en: 'Notepad', tr: 'Not defteri' },
    description: {
      en: 'A distraction-free plain-text editor with zen mode, autosave in your browser, find & replace with regular expressions, and live line and word counts.',
      tr: 'Dikkat dağıtmayan bir düz metin düzenleyici: odak modu, tarayıcıda otomatik kayıt, düzenli ifadelerle bul ve değiştir, anlık satır ve kelime sayacı.',
    },
    status: 'ready',
    href: '/tools/notepad/',
  },
  {
    slug: 'pdf-split',
    title: { en: 'Split PDF', tr: 'PDF bölme' },
    description: {
      en: 'Preview every page as a thumbnail, pick pages by clicking or typing ranges like 1-3, 5, and download the result. Or split into parts as a ZIP.',
      tr: 'Her sayfayı küçük resim olarak görün, tıklayarak ya da 1-3, 5 gibi aralıklar yazarak seçin ve sonucu indirin. Dilerseniz parçalara ayırıp ZIP olarak alın.',
    },
    status: 'ready',
    href: '/tools/pdf-split/',
  },
  {
    slug: 'image-compressor',
    title: { en: 'Image compressor', tr: 'Görsel sıkıştırıcı' },
    description: {
      en: 'Shrink JPEG, PNG and WebP images with a quality slider and format choice, and compare before and after side by side.',
      tr: 'JPEG, PNG ve WebP görselleri kalite ayarı ve biçim seçimiyle küçültün; öncesini ve sonrasını yan yana karşılaştırın.',
    },
    status: 'ready',
    href: '/tools/image-compressor/',
  },
  {
    slug: 'pdf-compress',
    title: { en: 'Compress PDF', tr: 'PDF sıkıştırma' },
    description: {
      en: 'Shrink a PDF by re-compressing its images and cleaning out unused objects.',
      tr: 'PDF içindeki görselleri yeniden sıkıştırarak ve kullanılmayan nesneleri temizleyerek dosyayı küçültün.',
    },
    status: 'ready',
    href: '/tools/pdf-compress/',
  },
  {
    slug: 'password-generator',
    title: { en: 'Password generator', tr: 'Parola üretici' },
    description: {
      en: 'Cryptographically secure random passwords with length and character-set options and a strength estimate.',
      tr: 'Uzunluk ve karakter seti seçenekleri ile güç tahmini sunan, kriptografik olarak güvenli rastgele parolalar.',
    },
    status: 'ready',
    href: '/tools/password-generator/',
  },
];
