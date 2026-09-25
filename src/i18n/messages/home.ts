/**
 * Home page text (hero, section titles, the journey teaser, the playground and the résumé
 * summary). Résumé facts themselves live in src/data/resume.ts; shared labels (nav, badges,
 * "Download CV", "Present", "(opens in a new tab)") come from common.ts.
 *
 * Pure module: `node --test` imports it (tests/resume-copy.test.ts checks both languages).
 */
import type { Localized } from '../config.ts';

/** The four chapters of the engineering-journey teaser, in reading order. */
export const JOURNEY_CHAPTERS = ['avionics', 'guidance', 'simulation', 'foundations'] as const;
export type JourneyChapter = (typeof JOURNEY_CHAPTERS)[number];

interface Chapter {
  title: string;
  text: string;
}

const en = {
  hero: {
    /** Plain text: the intro has no inline links, so one string per language is enough. */
    intro:
      "I'm finishing a mathematics degree at Istanbul University, and most of what I build puts that mathematics to work: rocket avionics and trajectory simulation, messaging platforms, game-playing algorithms. Day to day I write modern C++ and Go. Before that I spent nearly three years at crowd.inc owning a production web platform end to end, from the PostgreSQL schema to the Linux servers.",
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
    title: 'Engineering journey',
    lead: 'How the mathematics turned into engineering, in four chapters.',
    all: 'The full story',
    /** Visible chapter index, e.g. "Ch. 1". */
    chapter: (n: number) => `Ch. ${n}`,
    chapters: {
      avionics: {
        title: 'Rocket avionics',
        text: 'Three high-power rocket launches with the Istanbul University Rocket Club. I was the sole author of the flight avionics firmware and the parachute deployment control, driven by onboard sensor fusion, and designed the SD-card telemetry logging.',
      },
      guidance: {
        title: 'Autonomous parachute guidance',
        text: 'A steering algorithm that uses linear algebra and atmospheric descent dynamics to guide a payload to a designated landing coordinate.',
      },
      simulation: {
        title: 'Flight-physics simulation',
        text: 'A 3D numerical rocket trajectory simulation, first written in Python and now being re-architected in modern C++23 for high-frequency physics modelling.',
      },
      foundations: {
        title: 'Algorithmic foundations',
        text: 'Where it started: mathematical calculation engines in C# and SQL, a Battleship game with probability-density targeting, and tic-tac-toe driven by recursive minimax.',
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
      'Software engineering',
      'Mathematics',
      'Algorithms',
      'C++',
      'Go',
      'Systems programming',
      'gRPC',
      'MQTT',
      'PostgreSQL',
      'Flight avionics',
      'Numerical simulation',
    ] as readonly string[],
  },
};

export type HomeMessages = typeof en;

const tr: HomeMessages = {
  hero: {
    intro:
      'İstanbul Üniversitesinde matematik lisansımı tamamlıyorum ve geliştirdiğim projelerin çoğunda bu matematiği uygulamaya döküyorum: roket aviyoniği ve yörünge simülasyonu, mesajlaşma platformları, oyun algoritmaları. Günlük işimde modern C++ ve Go kullanıyorum. Öncesinde yaklaşık üç yıl boyunca crowd.inc bünyesinde, canlıda çalışan bir web platformunun sorumluluğunu uçtan uca üstlendim: PostgreSQL şemasından Linux sunucularına kadar.',
    selectedWork: 'Seçili işler',
    // The CV exists in English only; say so on the button.
    cvFormat: 'PDF · İngilizce',
    contactLabel: 'İletişim ve profiller',
    locationLabel: 'Konum',
    coordinates: (lat, lon) => `${lat}° K, ${lon}° D`,
  },
  figure: {
    label: 'Şekil 1',
    caption: 'Birim çember üzerinde dönen bir nokta. Yüksekliği zaman içinde izlendiğinde bir sinüs dalgası çizer.',
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
    title: 'Mühendislik yolculuğu',
    lead: 'Matematiğin mühendisliğe dönüşümü, dört bölümde.',
    all: 'Hikâyenin tamamı',
    chapter: (n) => `Bölüm ${n}`,
    chapters: {
      avionics: {
        title: 'Roket aviyoniği',
        text: 'İstanbul Üniversitesi Roket Kulübü ile üç yüksek güçlü roket fırlatması. Sensör füzyonuna dayanan uçuş aviyoniği yazılımını ve paraşüt açma kontrolünü tek başıma geliştirdim; SD kartlı telemetri kaydını da ben tasarladım.',
      },
      guidance: {
        title: 'Otonom paraşüt güdümü',
        // "Lineer cebir", as on the About page and in the console: one term for one subject.
        text: 'Lineer cebir ve atmosferik iniş dinamiğiyle faydalı yükü belirlenen bir iniş koordinatına yönlendiren bir güdüm algoritması.',
      },
      simulation: {
        title: 'Uçuş fiziği simülasyonu',
        text: 'Önce Python ile yazdığım, şimdi yüksek frekanslı fizik modellemesi için modern C++23 ile yeniden tasarladığım üç boyutlu sayısal roket yörünge simülasyonu.',
      },
      foundations: {
        title: 'Algoritmik temeller',
        text: 'Her şeyin başladığı yer: C# ve SQL ile matematiksel hesaplama motorları, olasılık yoğunluğuyla hedef seçen bir Amiral Battı oyunu ve özyinelemeli minimax ile oynayan bir XOX.',
      },
    },
  },
  playground: {
    title: 'Oyun alanı',
    lead: 'Hemen burada kullanabileceğiniz küçük şeyler: algoritmik rakiplere karşı oyunlar, bir terminal ve dosyalarınızı cihazınızdan çıkarmayan tarayıcı araçları.',
    kinds: { game: 'Oyun', tool: 'Araç', terminal: 'Terminal' },
    consoleText: 'Bu siteyi bir terminalden, komut komut keşfedin.',
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
      'Yazılım mühendisliği',
      'Matematik',
      'Algoritmalar',
      'C++',
      'Go',
      'Sistem programlama',
      'gRPC',
      'MQTT',
      'PostgreSQL',
      'Uçuş aviyoniği',
      'Sayısal simülasyon',
    ],
  },
};

export const homeMessages = { en, tr } as const satisfies Localized<HomeMessages>;
