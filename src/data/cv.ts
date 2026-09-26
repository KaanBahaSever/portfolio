/**
 * CV-only content for the two CVs built by `npm run cv` (scripts/build-cv.ts): the English
 * public/cv/kaan-cv.pdf and the Turkish public/cv/kaan-cv-tr.pdf (SITE.cvPath). Experience,
 * education, volunteering, activities, skills and languages come from src/data/resume.ts, so the
 * CVs and the site cannot drift apart; this module adds what only the printed CV needs: a
 * headline, contact details, a short summary and compact project lines. The words around them
 * (section titles, the footer, PDF metadata) are in src/i18n/messages/cv.ts.
 *
 * Same facts and voice as the site: the owner is a software developer — never an engineer (nor
 * "mühendis") — and nothing here may go beyond what the site states. Both languages carry the
 * same facts: the same projects in the same order, with the same links, stacks and years
 * (tests/cv-data.test.ts checks it). English uses British spelling, like the site. Turkish is
 * written natively, in the first person like the Turkish résumé bullets, with ’ before suffixes
 * on names and numbers ("2024’ten") and the site's Turkish terms (boru hattı, canlıda, av ve
 * hedef, Amiral Battı, XOX, büyük daire mesafesi).
 *
 * Pure module (types only from config.ts), so the build script and tests import it with plain Node.
 */
import type { Localized } from '../i18n/config.ts';

export interface CvProject {
  name: string;
  /** Shown after the name, e.g. "asion.app"; linked to `url`. */
  linkLabel?: string;
  url?: string;
  /** Period and status in words, e.g. "Since 2024 · in development, early access". */
  period: string;
  stack: readonly string[];
  /** One or two sentences. */
  text: string;
}

export interface CvResearch {
  title: string;
  period?: string;
  linkLabel?: string;
  url?: string;
  text: string;
}

export interface CvContent {
  /** Printed under the name: the site's headline (SITE.role) in this language. */
  headline: string;
  phone: { label: string; href: string };
  summary: string;
  projects: readonly CvProject[];
  research: readonly CvResearch[];
}

/** Carried over from the previous CV; the same number in both languages. */
const PHONE = { label: '+90 536 560 78 29', href: 'tel:+905365607829' } as const;

const en: CvContent = {
  headline: 'Software Developer | Math-Driven Solutions & Algorithms',
  phone: PHONE,
  summary:
    'Software developer with a mathematics background (Istanbul University). I build systems software in modern C++ and Go: desktop agents, telemetry and messaging platforms, and algorithm-driven applications, together with the CI/CD pipelines that test, package and ship them. From 2021 to 2024 I owned the development lifecycle of a web platform at crowd.inc, from database schema to Linux servers.',

  projects: [
    {
      name: 'Asion',
      linkLabel: 'asion.app',
      url: 'https://asion.app',
      period: 'Since 2024 · in development, early access',
      stack: ['C/C++', 'Objective-C', 'Go', 'gRPC'],
      text: 'A privacy-first, cross-platform productivity and workstation activity tracker for individuals and teams, and for academic time tracking, built with self-hosting in mind. It runs on native OS event hooks on macOS, Linux and Windows, with a lightweight daemon architecture, gRPC/Protobuf IPC and an encrypted SQLCipher store. I built its multi-platform GitHub Actions pipelines, with cross-compilation runners, for one-click testing, packaging, artefact generation and deployment.',
    },
    {
      name: 'Novacast',
      linkLabel: 'novacast.app',
      url: 'https://novacast.app',
      period: 'Since 2025 · in production',
      stack: ['Go', 'MQTT'],
      text: 'Real-time message broadcasting and device orchestration built around low-latency pub/sub pipelines. Built to replace inadequate legacy software at a computer firm where I worked: prototyped in Python, then re-architected in late 2025 as a Go and MQTT microservice.',
    },
    {
      name: 'Karecik',
      linkLabel: 'github.com/KaanBahaSever/karecik',
      url: 'https://github.com/KaanBahaSever/karecik',
      period: 'Since 2021 · in production · GPL-3.0',
      stack: ['Go', 'PostgreSQL'],
      text: 'A multi-tenant QR-menu SaaS that local cafés and restaurants use to manage menus and orders and to interact with customers, built for zero downtime and low latency. Early prototypes date from 2021 under earlier working titles; it shipped to production in 2026.',
    },
    {
      name: 'Açık Matematik',
      linkLabel: 'acik-matematik.com',
      url: 'https://acik-matematik.com',
      period: 'Since 2023 · in production · open source',
      stack: ['Quarto', 'Markdown', 'Python'],
      text: 'An academic publishing platform and modern textbook initiative for undergraduate mathematics in Turkish, with reproducible numerical computing. Conceived in 2023 and launched in June 2026; the open-source release was announced in September 2026.',
    },
    {
      name: 'Rocket-Up',
      linkLabel: 'github.com/KaanBahaSever/Rocket-Up',
      url: 'https://github.com/KaanBahaSever/Rocket-Up',
      period: 'Since 2020 · in development · MIT',
      stack: ['C++'],
      text: 'High-power rocket flight simulation: a narrow, purpose-built 2020 Python prototype, now being rewritten as a modular, open-source aerodynamic simulation engine in modern C++.',
    },
    {
      name: 'NeoSMBIOS',
      linkLabel: 'github.com/KaanBahaSever/NeoSMBIOS',
      url: 'https://github.com/KaanBahaSever/NeoSMBIOS',
      period: 'Open source · MIT',
      stack: ['C++'],
      text: 'A header-only, zero-copy, bounds-checked SMBIOS/DMI firmware-table parser for C++23.',
    },
    {
      name: 'i18n-cpp',
      linkLabel: 'github.com/KaanBahaSever/i18n-cpp',
      url: 'https://github.com/KaanBahaSever/i18n-cpp',
      period: 'Open source · MIT',
      stack: ['C++'],
      text: 'A lightweight, header-only C++ internationalisation library: translations kept in language files and looked up by key, with dynamic string interpolation.',
    },
    {
      name: 'Personal website',
      linkLabel: 'kaanbahasever.com',
      url: 'https://kaanbahasever.com',
      period: '2026',
      stack: ['TypeScript', 'Astro'],
      text: 'A bilingual (English/Turkish) static site with privacy-first browser tools that run entirely on the device (PDF, images, prime factorisation, great-circle distance), algorithmic games (a Battleship AI with hunt-and-target and probability-density modes, minimax tic-tac-toe) and technical writing.',
    },
    {
      name: 'Early work',
      linkLabel: 'github.com/KaanBahaSever/BattleShips',
      url: 'https://github.com/KaanBahaSever/BattleShips',
      period: '2016 – 2019',
      stack: ['C#', 'SQL'],
      text: 'Learned programming in C# at a vocational high school from 2016, moving on to data structures and algorithms; by 2019 built database applications on Microsoft SQL Server, and desktop tic-tac-toe and Battleship games as graduation projects.',
    },
  ],

  research: [
    {
      title: 'Autonomous parachute guidance',
      linkLabel: 'github.com/KaanBahaSever/AutonomousParachute',
      url: 'https://github.com/KaanBahaSever/AutonomousParachute',
      text: 'A trajectory-steering algorithm in Python that uses linear algebra and atmospheric descent dynamics to guide a payload to a designated landing coordinate.',
    },
  ],
};

const tr: CvContent = {
  headline: 'Yazılım Geliştirici | Matematik Odaklı Çözümler ve Algoritmalar',
  phone: PHONE,
  // "crowd.inc bünyesinde", as on the home page: a suffix on "crowd.inc" would depend on how
  // the name is read aloud.
  summary:
    'Matematik altyapısına sahip bir yazılım geliştiriciyim (İstanbul Üniversitesi). Modern C++ ve Go ile sistem yazılımları geliştiriyorum: masaüstü ajanları, telemetri ve mesajlaşma platformları, algoritma odaklı uygulamalar. Bunları test eden, paketleyen ve yayına alan CI/CD boru hatlarını da kuruyorum. 2021–2024 yılları arasında crowd.inc bünyesinde bir web platformunun geliştirme yaşam döngüsünü, veritabanı şemasından Linux sunucularına kadar üstlendim.',

  projects: [
    {
      name: 'Asion',
      linkLabel: 'asion.app',
      url: 'https://asion.app',
      period: '2024’ten beri · geliştiriliyor, erken erişim',
      stack: ['C/C++', 'Objective-C', 'Go', 'gRPC'],
      text: 'Bireyler, ekipler ve akademik zaman takibi için gizliliği önceleyen, platformlar arası bir üretkenlik ve iş istasyonu etkinlik takip sistemi; self-hosting düşünülerek tasarlandı. macOS, Linux ve Windows’ta yerel işletim sistemi olay kancaları, hafif bir daemon mimarisi, gRPC/Protobuf ile süreçler arası iletişim ve şifreli SQLCipher veritabanıyla çalışıyor. Tek tıkla test, paketleme, derleme çıktısı üretimi ve dağıtım yapan, çapraz derleme runner’lı çok platformlu GitHub Actions boru hatlarını kurdum.',
    },
    {
      name: 'Novacast',
      linkLabel: 'novacast.app',
      url: 'https://novacast.app',
      period: '2025’ten beri · canlıda',
      stack: ['Go', 'MQTT'],
      text: 'Düşük gecikmeli pub/sub boru hatları üzerine kurulu, gerçek zamanlı bir mesaj yayını ve cihaz orkestrasyonu platformu. Çalıştığım bir bilgisayar firmasında ihtiyacı karşılamayan eski bir yazılımın yerini alması için geliştirdim: önce Python ile prototipini yazdım, 2025’in sonlarında da Go ve MQTT tabanlı bir mikroservis olarak baştan tasarladım.',
    },
    {
      name: 'Karecik',
      linkLabel: 'github.com/KaanBahaSever/karecik',
      url: 'https://github.com/KaanBahaSever/karecik',
      period: '2021’den beri · canlıda · GPL-3.0',
      stack: ['Go', 'PostgreSQL'],
      text: 'Yerel kafe ve restoranların menü ve sipariş yönetimi ile müşteri etkileşimi için kullandığı, çok kiracılı (multi-tenant) bir QR menü SaaS platformu; kesintisiz ve düşük gecikmeyle çalışacak şekilde tasarlandı. İlk prototiplerini 2021’de önceki çalışma adlarıyla geliştirdim; 2026’da canlıya aldım.',
    },
    {
      name: 'Açık Matematik',
      linkLabel: 'acik-matematik.com',
      url: 'https://acik-matematik.com',
      period: '2023’ten beri · canlıda · açık kaynak',
      stack: ['Quarto', 'Markdown', 'Python'],
      text: 'Türkçe lisans matematiği için yeniden üretilebilir sayısal hesaplamayla desteklenen bir akademik yayın platformu ve modern ders kitabı girişimi. Fikri 2023’te doğdu; platform Haziran 2026’da yayına girdi, açık kaynak sürüm Eylül 2026’da duyuruldu.',
    },
    {
      name: 'Rocket-Up',
      linkLabel: 'github.com/KaanBahaSever/Rocket-Up',
      url: 'https://github.com/KaanBahaSever/Rocket-Up',
      period: '2020’den beri · geliştiriliyor · MIT',
      stack: ['C++'],
      text: 'Yüksek güçlü roket uçuş simülasyonu. 2020’de tek bir amaca yönelik, dar kapsamlı bir Python prototipi olarak başladı; şimdi onu modern C++ ile modüler, açık kaynak bir aerodinamik simülasyon motoru olarak baştan yazıyorum.',
    },
    {
      name: 'NeoSMBIOS',
      linkLabel: 'github.com/KaanBahaSever/NeoSMBIOS',
      url: 'https://github.com/KaanBahaSever/NeoSMBIOS',
      period: 'Açık kaynak · MIT',
      stack: ['C++'],
      text: 'C++23 için tek başlık dosyalı (header-only), sıfır kopyalı ve sınır denetimli bir SMBIOS/DMI firmware tablosu ayrıştırıcısı.',
    },
    {
      name: 'i18n-cpp',
      linkLabel: 'github.com/KaanBahaSever/i18n-cpp',
      url: 'https://github.com/KaanBahaSever/i18n-cpp',
      period: 'Açık kaynak · MIT',
      stack: ['C++'],
      text: 'C++ için hafif, tek başlık dosyalı bir uluslararasılaştırma (i18n) kütüphanesi: çeviriler dil dosyalarında durur ve anahtarla bulunur; metindeki yer tutucular çalışma zamanında doldurulur.',
    },
    {
      name: 'Kişisel web sitesi',
      linkLabel: 'kaanbahasever.com',
      url: 'https://kaanbahasever.com',
      period: '2026',
      stack: ['TypeScript', 'Astro'],
      text: 'Tamamen cihazda çalışan, gizliliği önceleyen tarayıcı araçları (PDF, görseller, asal çarpanlara ayırma, büyük daire mesafesi), algoritmik oyunlar (av ve hedef ile olasılık yoğunluğu modları olan bir Amiral Battı yapay zekâsı, minimax ile XOX) ve teknik yazılar içeren iki dilli (Türkçe/İngilizce) statik bir site.',
    },
    {
      name: 'İlk çalışmalar',
      linkLabel: 'github.com/KaanBahaSever/BattleShips',
      url: 'https://github.com/KaanBahaSever/BattleShips',
      period: '2016 – 2019',
      stack: ['C#', 'SQL'],
      // "MS SQL", as in the home page's journey teaser.
      text: '2016’da meslek lisesinde C# ile programlamaya başladım, sonra veri yapıları ve algoritmalara geçtim; 2019’a kadar MS SQL tabanlı veritabanı uygulamaları, bitirme projesi olarak da masaüstü XOX ve Amiral Battı oyunları geliştirdim.',
    },
  ],

  research: [
    {
      title: 'Otonom paraşüt güdümü',
      linkLabel: 'github.com/KaanBahaSever/AutonomousParachute',
      url: 'https://github.com/KaanBahaSever/AutonomousParachute',
      // "Lineer cebir", as on the home page, the About page and in the console.
      text: 'Lineer cebir ve atmosferik iniş dinamiğiyle faydalı yükü belirlenen bir iniş koordinatına yönlendiren, Python ile yazılmış bir yörünge güdüm algoritması.',
    },
  ],
};

export const CV = { en, tr } as const satisfies Localized<CvContent>;
