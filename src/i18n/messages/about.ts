/**
 * About page text: headings, labels and figure captions. Paragraphs with inline links live in
 * per-locale Astro markup (src/components/about/prose/*), next to each other for translators.
 */
import type { Localized } from '../config.ts';

const en = {
  meta: {
    title: 'About',
    description:
      'About Kaan Baha Sever, a software developer and mathematics student in Istanbul: from game algorithms and rocket avionics to systems software in C++ and Go.',
  },
  header: {
    eyebrow: 'About',
    title: 'Mathematical intuition, applied to systems engineering',
  },
  glance: {
    heading: 'At a glance',
    location: 'Based in',
    study: 'Studying',
    studyValue: 'BSc Mathematics, Istanbul University',
    languages: 'Day to day',
    languagesValue: 'Modern C++ and Go',
    building: 'Currently building',
  },
  journey: {
    title: 'Engineering journey',
    intro:
      'Five chapters, roughly in chronological order. The figures sketch the idea behind each one; most are computed from a small model of that idea rather than drawn by hand.',
    /** Figure number shown above each caption ("Fig. 2"). */
    figure: (n: number) => `Fig. ${n}`,
    chapters: {
      algorithms: {
        label: 'C# · SQL',
        title: 'Algorithmic foundations',
        caption:
          'Left: how many ship placements cover each cell after five misses; the next shot takes the densest cell. Right: minimax picks the move whose worst case is best.',
      },
      avionics: {
        /** Follows the period (2019 – 2022), which the page renders from the chapter's dates. */
        label: 'Rocket Club',
        title: 'Aerospace and rocket avionics',
        caption:
          'An idealised flight: powered ascent, a coast to apogee where dh/dt = 0, then a slow descent under the parachute. Dots mark logged samples.',
      },
      guidance: {
        label: 'Research',
        title: 'Autonomous parachute guidance and precision landing',
        caption: 'A steering field around the landing target, seen from above. The highlighted path is one guided descent.',
      },
      simulation: {
        label: 'Python · C++23',
        title: 'Rocket flight-physics simulation',
        caption:
          'A trajectory integrated step by step in three dimensions, with its ground track and the velocity vector at one state.',
      },
      core: {
        label: 'Today',
        title: 'Current core: modern C++ and Go',
        caption: 'Publish/subscribe: messages fan out from one broker to many subscribers.',
        /** The figure's own labels, set in small mono capitals under its three columns. */
        figureLabels: { publisher: 'PUB', broker: 'BROKER', subscriber: 'SUB' },
      },
    },
  },
  milestones: {
    title: 'Milestones',
    intro: 'The dated record, oldest first.',
  },
  resume: {
    title: 'Résumé',
    text: 'Experience, education and skills are summarised on the home page.',
    experienceLink: 'Experience on the home page',
    /** Shown after "Download CV"; the CV is only available in English. */
    cvFormat: '(PDF)',
  },
};

export type AboutMessages = typeof en;

const tr: AboutMessages = {
  meta: {
    title: 'Hakkımda',
    description:
      'Kaan Baha Sever hakkında: İstanbul’da yazılım geliştirici ve matematik öğrencisi. Oyun algoritmalarından roket aviyoniğine, oradan C++ ve Go ile sistem yazılımına uzanan bir yol.',
  },
  header: {
    eyebrow: 'Hakkımda',
    title: 'Sistem mühendisliğinde matematiksel sezgi',
  },
  glance: {
    heading: 'Kısaca',
    location: 'Konum',
    study: 'Eğitim',
    studyValue: 'Matematik lisansı, İstanbul Üniversitesi',
    languages: 'Günlük işlerde',
    languagesValue: 'Modern C++ ve Go',
    building: 'Şu an geliştirdiğim',
  },
  journey: {
    title: 'Mühendislik yolculuğu',
    intro:
      'Kabaca kronolojik sırayla beş bölüm. Şekiller her bölümün ardındaki fikri özetliyor; çoğu elle çizilmedi, o fikrin küçük bir modelinden hesaplandı.',
    figure: (n) => `Şekil ${n}`,
    chapters: {
      algorithms: {
        label: 'C# · SQL',
        title: 'Algoritmik temeller',
        caption:
          'Solda: beş ıskadan sonra her hücreyi kaç farklı gemi yerleşiminin kapsadığı; sıradaki atış en yoğun hücreye yapılır. Sağda: minimax, en kötü sonucu en iyi olan hamleyi seçer.',
      },
      avionics: {
        label: 'Roket Kulübü',
        // "Havacılık" alone means aviation; "havacılık ve uzay" is the usual rendering of aerospace.
        title: 'Havacılık ve uzay: roket aviyoniği',
        caption:
          'İdealleştirilmiş bir uçuş: motorlu tırmanış, dh/dt = 0 olan tepe noktasına kadar süzülme, ardından paraşütle yavaş iniş. Noktalar kaydedilen ölçümleri gösterir.',
      },
      guidance: {
        label: 'Araştırma',
        title: 'Otonom paraşüt güdümü ve hassas iniş',
        caption: 'İniş hedefinin çevresindeki yönlendirme alanı (üstten görünüm). Vurgulu yol, güdümlü bir inişi gösterir.',
      },
      simulation: {
        label: 'Python · C++23',
        title: 'Roket uçuş fiziği simülasyonu',
        caption: 'Üç boyutta adım adım integre edilen bir yörünge, yerdeki izdüşümü ve bir andaki hız vektörü.',
      },
      core: {
        label: 'Bugün',
        title: 'Bugünkü odak: modern C++ ve Go',
        caption: 'Yayınla/abone ol (pub/sub): mesajlar tek bir aracıdan (broker) birçok aboneye dağılır.',
        figureLabels: { publisher: 'YAYINCI', broker: 'ARACI', subscriber: 'ABONE' },
      },
    },
  },
  milestones: {
    title: 'Kilometre taşları',
    intro: 'Tarihli kayıtlar, en eskiden en yeniye.',
  },
  resume: {
    title: 'Özgeçmiş',
    text: 'Deneyim, eğitim ve yetkinlikler ana sayfada özetleniyor.',
    experienceLink: 'Ana sayfadaki deneyim bölümü',
    cvFormat: '(İngilizce, PDF)',
  },
};

export const aboutMessages = { en, tr } as const satisfies Localized<AboutMessages>;
