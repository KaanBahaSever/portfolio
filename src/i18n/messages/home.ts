/**
 * Home page text (hero, section titles, the journey teaser, the playground and the résumé
 * summary). Résumé facts themselves live in src/data/resume.ts; shared labels (nav, badges,
 * "Download CV", "Present", "(opens in a new tab)") come from common.ts.
 *
 * The owner is a software developer, never "an engineer" (nor "mühendis"), and his story is
 * not an "engineering journey": the copy describes the work instead. tests/resume-copy.test.ts
 * enforces it.
 *
 * Pure module: `node --test` imports it (tests/resume-copy.test.ts checks both languages).
 */
import type { Localized } from '../config.ts';

/**
 * The four chapters of the journey teaser, in reading order: the order of the About page's
 * journey, so "Ch. 1" here is chapter 01 there.
 */
export const JOURNEY_CHAPTERS = ['foundations', 'avionics', 'guidance', 'simulation'] as const;
export type JourneyChapter = (typeof JOURNEY_CHAPTERS)[number];

interface Chapter {
  title: string;
  /** Mono line under the title: when and with what ("2019 – 2022 · Rocket Club"). */
  meta: string;
  text: string;
}

const en = {
  hero: {
    /** Plain text: the intro has no inline links, so one string per language is enough. */
    intro:
      "I'm finishing a mathematics degree at Istanbul University, and most of what I build puts that mathematics to work: rocket avionics and flight simulation, messaging platforms, game-playing algorithms. Day to day I write modern C++ and Go. Before that I spent nearly three years as a software developer at crowd.inc, owning a production web platform end to end, from the PostgreSQL schema to the Linux servers.",
    selectedWork: 'Selected work',
    /** Shown inside the CV button, after "Download CV". */
    cvFormat: 'PDF',
    contactLabel: 'Contact and profiles',
    locationLabel: 'Location',
    /** Latitude and longitude, already formatted as numbers. */
    coordinates: (lat: string, lon: string) => `${lat}° N, ${lon}° E`,
  },
  figure: {
    label: 'Fig. 1',
    caption: 'A point turns on the unit circle. Traced over time, its height draws a sine wave.',
    /** Accessible names of the figure's pause/play button (its visible face is an icon). */
    pause: 'Pause the animation',
    play: 'Play the animation',
  },
  experience: {
    title: 'Experience',
  },
  work: {
    title: 'Selected work',
    all: 'All projects',
  },
  journey: {
    title: 'From mathematics to systems',
    lead: 'How the mathematics turned into software, in four chapters.',
    all: 'The full story',
    /** Visible chapter index, e.g. "Ch. 1". */
    chapter: (n: number) => `Ch. ${n}`,
    chapters: {
      foundations: {
        title: 'Algorithmic foundations',
        meta: '2016 – 2019 · C# · MS SQL',
        // The early Battleship was a plain desktop game: its Hunt & Target opponent came later.
        // Battleship was the game the owner played with his father as a child; add no details.
        text: 'It began in 2016 with C# at a vocational high school: data structures and algorithmic problem-solving, then database applications on MS SQL. The graduation projects were desktop Tic-Tac-Toe and Battleship, the game I played with my father as a child; the Hunt & Target algorithm came later.',
      },
      avionics: {
        title: 'Rocket avionics',
        meta: '2019 – 2022 · Rocket Club',
        text: 'At the Istanbul University Rocket Club, our team designed and built one low-altitude (5,000 ft) and two high-altitude (10,000 ft) rockets. I was the sole author of the flight avionics firmware and the parachute deployment control, and designed the telemetry logging.',
      },
      guidance: {
        title: 'Autonomous parachute guidance',
        meta: 'Research · Python',
        text: 'A steering algorithm that uses linear algebra and atmospheric descent dynamics to guide a payload to a designated landing coordinate.',
      },
      simulation: {
        title: 'Flight-physics simulation',
        meta: '2020 prototype · C++ rewrite',
        // One project that evolved, not two: the prototype is being rewritten as Rocket-Up.
        text: 'One project that keeps evolving: a narrow Python prototype from 2020, now being rewritten from scratch as Rocket-Up, an open-source aerodynamic simulation engine in modern C++.',
      },
    } satisfies Record<JourneyChapter, Chapter>,
  },
  playground: {
    title: 'Playground',
    lead: 'Small things to use right here: games against algorithmic opponents, a terminal, and browser tools that keep your files on your device.',
    kinds: { game: 'Game', tool: 'Tool', terminal: 'Terminal' },
    consoleText: 'Explore this site from a terminal, one command at a time.',
    allGames: 'All games',
    allTools: 'All tools',
    moreLabel: 'More in the playground',
  },
  writing: {
    title: 'Writing',
    all: 'All posts',
  },
  background: {
    title: 'Background',
    education: 'Education',
    activities: 'Volunteering & activities',
    skills: 'Skills',
    languages: 'Languages',
    certificate: 'Certificate',
    /** "Bachelor of Science in Mathematics". */
    degree: (degree: string, field: string) => `${degree} in ${field}`,
  },
  /** schema.org Person (JSON-LD) fields. */
  person: {
    jobTitle: 'Software Developer',
    knowsAbout: [
      'Software development',
      'Mathematics',
      'Algorithms',
      'C++',
      'Go',
      'Systems programming',
      'gRPC',
      'MQTT',
      'PostgreSQL',
      'CI/CD',
      'GitHub Actions',
      'Flight avionics',
      'Numerical simulation',
    ] as readonly string[],
  },
};

export type HomeMessages = typeof en;

const tr: HomeMessages = {
  hero: {
    // Short sentences, one idea each. "crowd.inc’te": the name is read "kraud ink", so -te.
    intro:
      'İstanbul Üniversitesinde matematik bölümünü bitirmek üzereyim. Geliştirdiğim şeylerin çoğunda da bu matematiği kullanıyorum: roket aviyoniği ve uçuş simülasyonu, mesajlaşma platformları, oyun oynayan algoritmalar. Her gün modern C++ ve Go ile kod yazıyorum. Daha önce crowd.inc’te üç yıla yakın yazılım geliştirici olarak çalıştım. Canlıda çalışan bir web platformunun her şeyinden ben sorumluydum: PostgreSQL şemasından Linux sunucularına kadar.',
    selectedWork: 'Seçili işler',
    // The button downloads the Turkish CV; the English one is a small link beside it.
    cvFormat: 'PDF',
    contactLabel: 'İletişim ve profiller',
    locationLabel: 'Konum',
    coordinates: (lat, lon) => `${lat}° K, ${lon}° D`,
  },
  figure: {
    label: 'Şekil 1',
    caption: 'Birim çember üzerinde bir nokta dönüyor. Noktanın yüksekliğini zamana göre çizince bir sinüs dalgası çıkıyor.',
    pause: 'Animasyonu duraklat',
    play: 'Animasyonu oynat',
  },
  experience: {
    title: 'Deneyim',
  },
  work: {
    title: 'Seçili işler',
    all: 'Tüm projeler',
  },
  journey: {
    title: 'Matematikten sistem yazılımına',
    lead: 'Matematiğin nasıl yazılıma dönüştüğünü dört bölümde anlatıyorum.',
    all: 'Hikâyenin tamamı',
    chapter: (n) => `Bölüm ${n}`,
    chapters: {
      foundations: {
        title: 'Algoritma temelleri',
        meta: '2016 – 2019 · C# · MS SQL',
        // The site's name for the algorithm, with the English one a reader can search for.
        text: 'Her şey 2016’da meslek lisesinde C# ile başladı. Önce veri yapıları ve algoritmik problem çözme üzerinde çalıştım, ardından MS SQL ile veritabanı uygulamaları geliştirdim. Bitirme projelerim masaüstü XOX ile çocukken babamla oynadığım Amiral Battı oldu. Amiral Battı’nın av ve hedef (hunt & target) algoritmasını ise sonradan yazdım.',
      },
      avionics: {
        title: 'Roket aviyoniği',
        meta: '2019 – 2022 · Roket Kulübü',
        text: 'İstanbul Üniversitesi Roket Kulübünde ekip olarak bir alçak irtifa (5.000 ft) ve iki yüksek irtifa (10.000 ft) roketi tasarlayıp ürettik. Uçuş aviyoniğinin gömülü yazılımını ve paraşüt açma kontrolünü tek başıma yazdım. Telemetri kaydını da ben tasarladım.',
      },
      guidance: {
        title: 'Otonom paraşüt güdümü',
        meta: 'Araştırma · Python',
        // "Lineer cebir", as on the About page and in the console: one term for one subject.
        text: 'Paraşütle inen bir yükü belirlenen iniş koordinatına yönlendiren bir algoritma. Lineer cebirden ve atmosferdeki iniş dinamiğinden yararlanıyor.',
      },
      simulation: {
        title: 'Uçuş fiziği simülasyonu',
        meta: '2020 prototipi · şimdi C++',
        text: 'Bu, gelişmeye devam eden tek bir proje. 2020’de Python ile dar kapsamlı bir prototip yazmıştım. Şimdi onu modern C++ ile baştan yazıyorum. Yeni adı Rocket-Up: açık kaynaklı bir aerodinamik simülasyon motoru.',
      },
    },
  },
  playground: {
    title: 'Oyun alanı',
    lead: 'Burada hemen kullanabileceğiniz küçük şeyler var: algoritmik rakiplere karşı oyunlar, bir terminal ve dosyalarınızı cihazınızdan çıkarmayan tarayıcı araçları.',
    kinds: { game: 'Oyun', tool: 'Araç', terminal: 'Terminal' },
    consoleText: 'Siteyi terminalde, komut yazarak gezin.',
    allGames: 'Tüm oyunlar',
    allTools: 'Tüm araçlar',
    moreLabel: 'Oyun alanında daha fazlası',
  },
  writing: {
    title: 'Yazılar',
    all: 'Tüm yazılar',
  },
  background: {
    title: 'Özgeçmiş',
    education: 'Eğitim',
    activities: 'Gönüllülük ve etkinlikler',
    skills: 'Beceriler',
    languages: 'Diller',
    certificate: 'Sertifika',
    degree: (degree, field) => `${field} (${degree})`,
  },
  person: {
    jobTitle: 'Yazılım Geliştirici',
    knowsAbout: [
      'Yazılım geliştirme',
      'Matematik',
      'Algoritmalar',
      'C++',
      'Go',
      'Sistem programlama',
      'gRPC',
      'MQTT',
      'PostgreSQL',
      'CI/CD',
      'GitHub Actions',
      'Uçuş aviyoniği',
      'Sayısal simülasyon',
    ],
  },
};

export const homeMessages = { en, tr } as const satisfies Localized<HomeMessages>;
