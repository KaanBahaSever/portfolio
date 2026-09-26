/**
 * About page text: headings, labels and figure captions. Paragraphs with inline links live in
 * per-locale Astro markup (src/components/about/prose/*), next to each other for translators.
 *
 * Voice: the owner is a software developer. Never call him an engineer (EN or TR) or label his
 * story as "engineering"; describe the work instead. Other people keep their own titles.
 */
import type { Localized } from '../config.ts';

/**
 * The chapters of the journey (section #journey), in reading order. Each chapter's fragment id
 * is `journey-<key>`; the home page and the timeline link to some of them, so keep the keys.
 */
export const JOURNEY_CHAPTERS = [
  'space',
  'algorithms',
  'research',
  'avionics',
  'guidance',
  'simulation',
  'work',
  'community',
  'core',
  'automation',
] as const;
export type JourneyChapter = (typeof JOURNEY_CHAPTERS)[number];

interface ChapterText {
  /** Name in the chapter list at the top of the section. */
  short: string;
  /** Mono label after the chapter number (and the period, where the chapter has one). */
  label: string;
  title: string;
  /** Chapters with a figure add its `caption` (and any `figureLabels`) next to these. */
  [extra: string]: unknown;
}

const en = {
  meta: {
    title: 'About',
    description:
      'About Kaan Baha Sever, a software developer and mathematics student in Istanbul: from C# at a vocational high school and rocket avionics to systems software in C++ and Go.',
  },
  header: {
    eyebrow: 'About',
    title: 'Mathematical intuition, applied to systems software',
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
    title: 'The journey so far',
    intro:
      'Roughly in chronological order, from an early fascination with spaceflight to the software I build today. The figures sketch the idea behind each chapter; most are computed from a small model of that idea rather than drawn by hand.',
    /** Accessible name of the chapter list. */
    contents: 'Chapters',
    /** Figure number shown above each caption ("Fig. 2"). */
    figure: (n: number) => `Fig. ${n}`,
    chapters: {
      space: {
        short: 'Space',
        label: 'Before 2016',
        title: 'Looking up: space exploration',
        /** Δv of the departure burn in km/s and the flight time in days, already formatted. */
        caption: (dv: string, days: string) =>
          `A Hohmann transfer, the classic first sketch of a lunar mission. A single engine burn at perigee (Δv ≈ ${dv} km/s) stretches a 300 km parking orbit (radius r₁) into an ellipse whose far end reaches the Moon’s orbit (radius r₂) about ${days} days later. Not to scale.`,
      },
      algorithms: {
        short: 'Foundations',
        /** Follows the period (2016 – 2019), which the page renders from the chapter's dates. */
        label: 'C# · MSSQL',
        title: 'Programming foundations',
        caption:
          'The algorithms behind the browser versions. Left: the Battleship opponent in hunt mode. Each cell is shaded by how many placements of the remaining fleet cover it after five misses; the next shot takes the densest cell. Right: minimax picks the move whose worst case is best.',
      },
      research: {
        short: 'TÜBİTAK research',
        label: '2019 · TÜBİTAK',
        title: 'Research: cryptography and visual programming',
        caption:
          'Programming by drawing: a Caesar cipher as a flowchart. Each letter cᵢ of the message moves k places along the alphabet (mod 26) until i reaches the message length n. On the right, the same program run with k = 3.',
        /** The flowchart's branch labels. */
        figureLabels: { yes: 'yes', no: 'no' },
      },
      avionics: {
        short: 'Rocketry',
        /** Follows the period (2019 – 2022). */
        label: 'Rocket Club',
        title: 'Rocketry and flight avionics',
        caption:
          'The two altitude classes on one scale, as idealised flights: one low-altitude rocket with a 5,000 ft target altitude and two high-altitude rockets with a 10,000 ft target. Apogee is where dh/dt = 0; the dots stand for logged telemetry samples.',
        figureLabels: {
          /** Altitude tick label; the number is already formatted ("10,000"). */
          feet: (value: string) => `${value} ft`,
          /** How many of the club's rockets were built for that altitude. */
          rockets: (n: number) => (n === 1 ? '1 rocket' : `${n} rockets`),
        },
      },
      guidance: {
        short: 'Parachute guidance',
        label: 'Research',
        title: 'Autonomous parachute guidance and precision landing',
        caption: 'A steering field around the landing target, seen from above. The highlighted path is one guided descent.',
      },
      simulation: {
        short: 'Flight simulation',
        label: 'Python (2020) → C++ (today)',
        title: 'Flight simulation: from prototype to Rocket-Up',
        caption:
          'A trajectory integrated step by step in three dimensions, with its ground track and the velocity vector at one state.',
      },
      work: {
        short: 'crowd.inc',
        /** Follows the period (2021 – 2024). */
        label: 'crowd.inc',
        title: 'Software Developer at crowd.inc',
      },
      community: {
        short: 'Community',
        label: 'GDSC · Mathematics Club',
        title: 'Community: workshops, live streams and competitions',
      },
      core: {
        short: 'C++ and Go',
        label: 'Today',
        title: 'Current core: modern C++ and Go',
        caption: 'Publish/subscribe: messages fan out from one broker to many subscribers.',
        /** The figure's own labels, set in small mono capitals under its three columns. */
        figureLabels: { publisher: 'PUB', broker: 'BROKER', subscriber: 'SUB' },
      },
      automation: {
        short: 'Automation',
        label: 'Today · CI/CD',
        title: 'Automation: one-click test, package and deploy',
        caption:
          'One trigger runs the tests, fans out into a build for each platform, then fans back in to package the artifacts and deploy them.',
        /** Column labels under the pipeline, in small mono capitals. */
        figureLabels: { trigger: 'TRIGGER', test: 'TEST', build: 'BUILD', package: 'PACKAGE', deploy: 'DEPLOY' },
      },
    } satisfies Record<JourneyChapter, ChapterText>,
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
      'Kaan Baha Sever hakkında: İstanbul’da yazılım geliştirici ve matematik öğrencisi. Meslek lisesinde C# ile başlayıp roket aviyoniğinden C++ ve Go ile sistem yazılımına uzanan bir yol.',
  },
  header: {
    eyebrow: 'Hakkımda',
    title: 'Sistem yazılımında matematiksel sezgi',
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
    title: 'Bugüne kadarki yolculuk',
    intro:
      'Kabaca kronolojik sırayla: uzay uçuşlarına duyduğum erken ilgiden bugün geliştirdiğim yazılımlara. Şekiller her bölümün ardındaki fikri özetliyor; çoğu elle çizilmedi, o fikrin küçük bir modelinden hesaplandı.',
    contents: 'Bölümler',
    figure: (n) => `Şekil ${n}`,
    chapters: {
      space: {
        short: 'Uzay',
        label: '2016 öncesi',
        title: 'Göğe bakmak: uzay araştırmaları',
        // "Yerberi" is the TDK term for perigee. The values sit in parentheses or before a
        // fixed noun ("gün"), so no case suffix depends on how a number is read.
        caption: (dv, days) =>
          `Hohmann transferi, bir Ay görevinin klasik ilk taslağı. Yerberide yapılan tek bir motor ateşlemesi (Δv ≈ ${dv} km/s), 300 km yükseklikteki park yörüngesini (yarıçap r₁), uzak ucu yaklaşık ${days} gün sonra Ay’ın yörüngesine (yarıçap r₂) ulaşan bir elipse dönüştürür. Ölçekli değildir.`,
      },
      algorithms: {
        short: 'Temeller',
        label: 'C# · MSSQL',
        title: 'Programlamanın temelleri',
        caption:
          'Tarayıcı sürümlerinin ardındaki algoritmalar. Solda: Amiral Battı’daki bilgisayar rakibin av modu. Her hücrenin tonu, beş ıskadan sonra kalan filonun o hücreyi kapsayan kaç farklı yerleşimi olduğunu gösterir; sıradaki atış en yoğun hücreye yapılır. Sağda: minimax, en kötü sonucu en iyi olan hamleyi seçer.',
      },
      research: {
        short: 'TÜBİTAK araştırması',
        label: '2019 · TÜBİTAK',
        title: 'Araştırma: kriptografi ve görsel programlama',
        caption:
          'Çizerek programlama: akış şeması olarak bir Sezar şifresi. Mesajın her cᵢ harfi, i sayacı mesajın uzunluğu olan n değerine ulaşana kadar alfabede k adım kaydırılır (mod 26). Sağda aynı program k = 3 ile çalıştırılmış.',
        figureLabels: { yes: 'evet', no: 'hayır' },
      },
      avionics: {
        short: 'Roketçilik',
        label: 'Roket Kulübü',
        title: 'Roketçilik ve uçuş aviyoniği',
        caption:
          'İki irtifa sınıfı aynı ölçekte, idealleştirilmiş uçuşlar olarak: hedef irtifası 5.000 ft olan bir alçak irtifa roketi ve hedef irtifası 10.000 ft olan iki yüksek irtifa roketi. Tepe noktası dh/dt = 0 olan yerdir; noktalar kaydedilen telemetri ölçümlerini gösterir.',
        figureLabels: {
          feet: (value) => `${value} ft`,
          rockets: (n) => `${n} roket`,
        },
      },
      guidance: {
        short: 'Paraşüt güdümü',
        label: 'Araştırma',
        title: 'Otonom paraşüt güdümü ve hassas iniş',
        caption: 'İniş hedefinin çevresindeki yönlendirme alanı (üstten görünüm). Vurgulu yol, güdümlü bir inişi gösterir.',
      },
      simulation: {
        short: 'Uçuş simülasyonu',
        label: 'Python (2020) → C++ (bugün)',
        title: 'Uçuş simülasyonu: prototipten Rocket-Up’a',
        caption: 'Üç boyutta adım adım integre edilen bir yörünge, yerdeki izdüşümü ve bir andaki hız vektörü.',
      },
      work: {
        short: 'crowd.inc',
        label: 'crowd.inc',
        // "bünyesinde" keeps the suffix off the dotted company name, as on the home page.
        title: 'crowd.inc bünyesinde yazılım geliştirici',
      },
      community: {
        short: 'Topluluk',
        label: 'GDSC · Matematik Kulübü',
        title: 'Topluluk: atölyeler, canlı yayınlar ve yarışmalar',
      },
      core: {
        short: 'C++ ve Go',
        label: 'Bugün',
        title: 'Bugünkü odak: modern C++ ve Go',
        caption: 'Yayınla/abone ol (pub/sub): mesajlar tek bir aracıdan (broker) birçok aboneye dağılır.',
        figureLabels: { publisher: 'YAYINCI', broker: 'ARACI', subscriber: 'ABONE' },
      },
      automation: {
        short: 'Otomasyon',
        label: 'Bugün · CI/CD',
        title: 'Otomasyon: tek tıkla test, paketleme ve dağıtım',
        caption:
          'Tek bir tetikleme testleri çalıştırır, her platform için ayrı bir derlemeye dallanır; ardından çıktılar paketlenip dağıtılmak üzere yeniden birleşir.',
        figureLabels: { trigger: 'TETİK', test: 'TEST', build: 'DERLEME', package: 'PAKET', deploy: 'DAĞITIM' },
      },
    },
  },
  milestones: {
    title: 'Kilometre taşları',
    intro: 'Tarihli kayıtlar, en eskiden en yeniye.',
  },
  resume: {
    title: 'Özgeçmiş',
    // "beceriler" matches the home page's skills heading ("Beceriler") this sentence points to.
    text: 'Deneyim, eğitim ve beceriler ana sayfada özetleniyor.',
    experienceLink: 'Ana sayfadaki deneyim bölümü',
    cvFormat: '(İngilizce, PDF)',
  },
};

export const aboutMessages = { en, tr } as const satisfies Localized<AboutMessages>;
