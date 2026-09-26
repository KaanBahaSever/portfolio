/**
 * Projects index, project cards and project pages.
 *
 * Shared words come from common.ts and are not repeated here: the "Open source" / "Private"
 * and "Early access" / "In development" badges, "Tech stack", "(opens in a new tab)" and the
 * breadcrumb label. Only the "In production" stage badge is new.
 *
 * Link names are whole phrases per language (WCAG 2.5.3: each starts with the visible label),
 * instead of a visible word followed by a visually hidden fragment in English word order.
 */
import type { Localized } from '../config.ts';

const en = {
  index: {
    title: 'Projects',
    description:
      'Projects by Kaan Baha Sever: Asion, Novacast, Karecik, Açık Matematik, a high-power rocket simulation and open-source C++ libraries, with notes on how each one is built.',
    eyebrow: 'Selected work',
    lead: 'Things I build, from native daemons in C++ and Go services to open-source mathematics. Each page explains what a project does and how it is put together.',
    /** Fact line under the lead: "6 projects · 4 open source". */
    summary: (total: number, openSource: number) =>
      `${total} ${total === 1 ? 'project' : 'projects'} · ${openSource} open source`,
    featured: 'Featured',
    more: 'More projects',
    empty: 'No projects published yet.',
  },
  stage: {
    production: 'In production',
  },
  /** Small mono label on cards: the year work started. */
  since: (year: string) => `Since ${year}`,
  card: {
    live: 'Live site',
    liveName: (title: string) => `Live site of ${title} (opens in a new tab)`,
    /** The external site of a project in early access (stage: 'early-access'): not a finished product. */
    earlyAccess: 'Early-access site',
    earlyAccessName: (title: string) => `Early-access site of ${title} (opens in a new tab)`,
    /** A project whose live version is a page on this site (e.g. a browser tool). */
    open: 'Open',
    openName: (title: string) => `Open ${title}`,
    source: 'Source code',
    sourceName: (title: string) => `Source code of ${title} (opens in a new tab)`,
  },
  detail: {
    back: 'All projects',
    backToAll: 'Back to all projects',
    /** Primary button to an external site, labelled with its host: "Visit asion.app". */
    visit: (host: string) => `Visit ${host}`,
    visitName: (host: string) => `Visit ${host} (opens in a new tab)`,
    open: 'Open project',
    source: 'Source code',
    /** `where` is the code host's name, e.g. "GitHub". */
    sourceName: (where: string) => `Source code on ${where} (opens in a new tab)`,
    facts: 'Project facts',
    started: 'Started',
    related: 'Related posts',
    /** Figure number in the caption: "Fig. 1". */
    figure: (n: number) => `Fig. ${n}`,
  },
  /** Captions for the line drawings in src/components/projects/ProjectFigure.astro. */
  figures: {
    asion: 'Focus sessions on a time axis: which window was active, and for how long.',
    novacast: 'Publish/subscribe fan-out: one published message reaches every subscribed device through the broker.',
    karecik: 'From QR code to menu: scanning opens the business’s menu on the customer’s phone.',
    'acik-matematik': 'A page from first-year analysis: a Riemann sum under a curve and a tangent line.',
    neosmbios: 'An SMBIOS record: no field is read before it is checked against the record’s own length byte.',
    'rocket-up': 'A flight profile: powered ascent, apogee, then descent under a parachute.',
    'i18n-cpp':
      'A translation lookup: a key is read from the active language’s .properties file, then a named placeholder is filled in at run time.',
  },
};

export type ProjectsMessages = typeof en;

const tr: ProjectsMessages = {
  index: {
    title: 'Projeler',
    description:
      'Kaan Baha Sever’in projeleri: Asion, Novacast, Karecik, Açık Matematik, yüksek güçlü roketler için bir uçuş simülasyonu ve açık kaynak C++ kütüphaneleri. Her projenin ne yaptığı ve nasıl yapıldığı kendi sayfasında anlatılıyor.',
    // Same wording as the home page's "Selected work" link and section that lead here.
    eyebrow: 'Seçili işler',
    // Everyday words for the English "native daemons" and "Go services".
    lead: 'Bilgisayarın arka planında çalışan C++ programlarından Go ile yazdığım sunucu yazılımlarına ve açık kaynak matematik notlarına kadar, yaptığım işler burada. Her sayfada bir projenin ne işe yaradığını ve nasıl yapıldığını anlatıyorum.',
    summary: (total, openSource) => `${total} proje · ${openSource} açık kaynak`,
    featured: 'Öne çıkanlar',
    more: 'Diğer projeler',
    empty: 'Henüz yayımlanmış bir proje yok.',
  },
  stage: {
    production: 'Canlıda',
  },
  // "2024’ten beri" would need a suffix that depends on how the year is read aloud.
  since: (year) => `Başlangıç: ${year}`,
  card: {
    live: 'Canlı site',
    liveName: (title) => `Canlı site: ${title} (yeni sekmede açılır)`,
    earlyAccess: 'Erken erişim sitesi',
    earlyAccessName: (title) => `Erken erişim sitesi: ${title} (yeni sekmede açılır)`,
    open: 'Aç',
    openName: (title) => `Aç: ${title}`,
    source: 'Kaynak kodu',
    sourceName: (title) => `Kaynak kodu: ${title} (yeni sekmede açılır)`,
  },
  detail: {
    back: 'Tüm projeler',
    backToAll: 'Tüm projelere dön',
    visit: (host) => `${host} sitesine git`,
    visitName: (host) => `${host} sitesine git (yeni sekmede açılır)`,
    open: 'Projeyi aç',
    source: 'Kaynak kodu',
    sourceName: (where) => `Kaynak kodu (${where}, yeni sekmede açılır)`,
    facts: 'Proje bilgileri',
    started: 'Başlangıç',
    related: 'İlgili yazılar',
    figure: (n) => `Şekil ${n}`,
  },
  // Plain words for the English terms: "focus" is the window in front, the broker is the server
  // in the middle, a placeholder is a gap in the text.
  figures: {
    asion: 'Bir zaman çizgisi: Hangi pencere ne kadar süre ön plandaydı?',
    novacast: 'Tek mesaj, birçok cihaz: Gönderilen mesaj, aradaki sunucu üzerinden abone olan her cihaza ulaşıyor.',
    karecik: 'QR koddan menüye: Müşteri kodu okutunca işletmenin menüsü telefonunda açılıyor.',
    'acik-matematik':
      'Birinci sınıf analiz dersinden bir sayfa: eğrinin altındaki alanı dikdörtgenlerle yaklaşık olarak hesaplayan bir Riemann toplamı ve bir teğet doğrusu.',
    neosmbios: 'Bir SMBIOS kaydı: Hiçbir alan, kaydın uzunluğunu söyleyen bayta bakılmadan okunmuyor.',
    'rocket-up': 'Bir roket uçuşu: motor çalışırken yükseliş, en yüksek nokta, ardından paraşütle iniş.',
    'i18n-cpp':
      'Bir çeviriyi bulmak: Anahtar seçili dilin .properties dosyasından okunuyor. Sonra metindeki süslü parantezli boşluk program çalışırken dolduruluyor.',
  },
};

export const projectsMessages = { en, tr } as const satisfies Localized<ProjectsMessages>;
