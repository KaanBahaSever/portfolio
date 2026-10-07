/**
 * CV-only content for the two CVs built by `npm run cv` (scripts/build-cv.ts): the English
 * public/cv/kaan-cv.pdf and the Turkish public/cv/kaan-cv-tr.pdf (SITE.cvPath). Experience,
 * education, activities, skills and languages come from src/data/resume.ts, so the CVs and the
 * site cannot drift apart; this module adds what only the printed CV needs: a headline, contact
 * details, a short summary, the student communities listed under the university and compact
 * project lines. The words around them (section titles, the footer, PDF metadata) are in
 * src/i18n/messages/cv.ts.
 *
 * Same facts and voice as the site: the owner is a software developer — never an engineer (nor
 * "mühendis") — and nothing here may go beyond what the site states. Both languages carry the
 * same facts: the same projects in the same order, with the same links, stacks and years
 * (tests/cv-data.test.ts checks it). English uses British spelling, like the site. Turkish is
 * written natively and plainly, in short first-person sentences like the Turkish résumé
 * bullets, with ’ before suffixes on names and numbers ("2024’ten", "crowd.inc’te") and the
 * site's Turkish terms (CI/CD süreçleri, GitHub Actions iş akışları, runner, MQTT aracısı (broker),
 * gömülü yazılım, veri tabanı, canlıda, lineer cebir, Amiral Battı, XOX).
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

/**
 * A student community he was active in at university: one bullet under the university in
 * Education. The facts are those of resume.ts VOLUNTEERING (the home page's list), with the same
 * roles and years (tests/cv-data.test.ts checks them); the CV has no separate volunteering section.
 */
export interface CvCommunity {
  name: string;
  /** The role he held, where one is on record. */
  role?: string;
  /** The years, or the period in words where no dates are on record, in lower case. */
  period: string;
  /**
   * What he did there, one or two printed lines after the semibold lead (cvMessages.community,
   * which ends in a colon): English goes on in lower case, Turkish starts a sentence with a capital.
   */
  text: string;
}

export interface CvContent {
  /** Printed under the name: the site's headline (SITE.role) in this language. */
  headline: string;
  phone: { label: string; href: string };
  summary: string;
  /**
   * Under Istanbul University in Education, in place of the home page's highlights for it, in the
   * owner's order: Rocket and Space Club, Mathematics Club, Google Developer Student Clubs.
   */
  communities: readonly CvCommunity[];
  projects: readonly CvProject[];
  research: readonly CvResearch[];
}

/** Carried over from the previous CV; the same number in both languages. */
const PHONE = { label: '+90 536 560 78 29', href: 'tel:+905365607829' } as const;

const en: CvContent = {
  headline: 'Software Developer | Math-Driven Solutions & Algorithms',
  phone: PHONE,
  summary:
    'Software developer with a mathematics background (Istanbul University). I build systems software in modern C++ and Go: desktop agents, telemetry and device-management software, and algorithm-driven applications, together with the CI/CD pipelines that test, package and ship them. From 2021 to 2024 I owned the development lifecycle at crowd.inc, from database schema to Linux servers.',

  communities: [
    {
      // The owner's four kinds of software (2026-09-30), ground control among them; the rockets
      // as in resume.ts; Kalman filtering and PID control (2026-10-07), as on the About page.
      name: 'Rocket and Space Club',
      role: 'Vice President',
      period: '2019–2022',
      text: 'developed avionics, telemetry, ground-control and flight-simulation software for the team’s three rockets, one low-altitude (5,000 ft) and two high-altitude (10,000 ft); wrote and tested Kalman filters for the sensor data and used PID controllers in vertical-landing experiments.',
    },
    {
      // A community for theoretical discussion: the owner's description (2026-09-30).
      name: 'Mathematics Club',
      period: 'later university years',
      text: 'organised and ran academic events, such as seminars and logic and mathematics competitions, for a community built around theoretical discussion.',
    },
    {
      name: 'Google Developer Student Clubs (GDSC)',
      role: 'Core Team Member',
      period: '2023',
      text: 'hosted technical workshops and live streams on Flask, HTML and Git/GitHub for the community, and organised Cyber Security Week.',
    },
  ],

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
      stack: ['Rust', 'Go', 'MQTT'],
      text: 'Software that manages many screens of different makes from one web panel, on Windows, macOS, Linux, Samsung TV, LG TV and Android TV. We built it at a computer firm where I worked to replace bloated, inadequate software: a Rust player on each screen, reached by a Go server through an MQTT broker.',
    },
    {
      name: 'Karecik',
      linkLabel: 'karecik.com',
      url: 'https://karecik.com',
      period: 'Since 2021 · in production · GPL-3.0',
      stack: ['Go', 'PostgreSQL'],
      text: 'A multi-tenant QR-menu SaaS used by local cafés and restaurants. It began as a QR menu for a friend’s café, and he now uses it in all three of his branches. Built for zero downtime and low latency. Early prototypes date from 2021 under earlier working titles; it shipped to production in 2026.',
    },
    {
      name: 'Açık Matematik',
      linkLabel: 'acik-matematik.com',
      url: 'https://acik-matematik.com',
      period: 'Since 2023 · in production · open source',
      stack: ['Quarto', 'Markdown', 'Python'],
      text: 'An academic publishing platform and modern textbook initiative for undergraduate mathematics in Turkish, with reproducible numerical computing. Conceived in 2023 and launched in June 2026; the open-source release was announced in September 2026.',
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
  // "İstanbul Üniversitesinde" without an apostrophe: suffixes on institution names are not set
  // off (TDK), as on the home page and in the console. "crowd.inc’te", as on the home page: the
  // name is read "kraud ink". "CI/CD süreçleri", the owner's own term in the skills list.
  summary:
    'İstanbul Üniversitesinde matematik okuyan bir yazılım geliştiriciyim. Modern C++ ve Go ile sistem yazılımları geliştiriyorum: masaüstü ajan yazılımları, telemetri ve cihaz yönetimi yazılımları, algoritmaya dayalı uygulamalar. Bunları test eden, paketleyen ve yayına alan CI/CD süreçlerini de kuruyorum. 2021–2024 arasında crowd.inc’te geliştirme sürecini baştan sona yürüttüm: veri tabanı şemasından Linux sunucularına kadar.',

  // Each text is a full sentence after the lead's colon, so it starts with a capital (TDK).
  communities: [
    {
      // The owner's own terms: "aviyonik, telemetri, yer kontrol ve uçuş simülasyonu yazılımları".
      // Turkish groups thousands with a dot, as in resume.ts: 5.000 ft. Kalman and PID as on the About
      // page; with them this line takes three printed lines, the only community line that does.
      name: 'Roket ve Uzay Kulübü',
      role: 'Başkan Yardımcısı',
      period: '2019–2022',
      text: 'Ekibimizin ürettiği bir alçak irtifa (5.000 ft) ve iki yüksek irtifa (10.000 ft) roketi için aviyonik, telemetri, yer kontrol ve uçuş simülasyonu yazılımları geliştirdim. Sensör verisi için Kalman filtreleri yazıp defalarca test ettik; dikey iniş deneylerinde PID kontrolcüleri kullandık.',
    },
    {
      name: 'Matematik Kulübü',
      period: 'üniversitenin son yılları',
      text: 'Teorik tartışmaların yapıldığı bu toplulukta seminerler, mantık ve matematik yarışmaları gibi akademik etkinlikler düzenleyip yürüttüm.',
    },
    {
      // The club's own name, as on the home page; "etkinliğini" keeps the suffix off the event's name.
      name: 'Google Developer Student Clubs (GDSC)',
      role: 'Çekirdek Ekip Üyesi',
      period: '2023',
      text: 'Topluluk için Flask, HTML ve Git/GitHub üzerine teknik atölyeler ve canlı yayınlar yaptım; Siber Güvenlik Haftası etkinliğini de düzenledim.',
    },
  ],

  projects: [
    {
      name: 'Asion',
      linkLabel: 'asion.app',
      url: 'https://asion.app',
      period: '2024’ten beri · geliştiriliyor, erken erişimde',
      stack: ['C/C++', 'Objective-C', 'Go', 'gRPC'],
      // The site's description of Asion ("gizliliği ön planda tutan bir üretkenlik ve bilgisayar
      // etkinliği takip aracı"). "Tasarlanıyor" (ongoing): "built with self-hosting in mind" is a
      // design goal of a product in early access, not a finished feature; "kullanıcıların" rather
      // than "sizin", since a CV does not address its reader. "GitHub Actions iş akışları" for the
      // pipelines, as on the Asion page: "süreçler" here are the processes that talk over gRPC.
      text: 'Bireyler ve ekipler için, gizliliği ön planda tutan bir üretkenlik ve bilgisayar etkinliği takip aracı; akademik zaman takibine de uygun. Farklı platformlarda çalışıyor ve kullanıcıların kendi sunucularına kurabileceği şekilde tasarlanıyor. macOS, Linux ve Windows’ta işletim sisteminin yerel olay kancalarını (OS event hooks) kullanıyor. Mimarisi hafif bir daemon’a dayanıyor; süreçler gRPC/Protobuf ile haberleşiyor, veriler şifreli bir SQLCipher veri tabanında tutuluyor. Çapraz derleme yapan runner’larla çalışan çok platformlu GitHub Actions iş akışlarını da ben kurdum: test, paketleme, derleme çıktısı üretme ve dağıtım tek tıkla yapılıyor.',
    },
    {
      name: 'Novacast',
      linkLabel: 'novacast.app',
      url: 'https://novacast.app',
      period: '2025’ten beri · canlıda',
      stack: ['Rust', 'Go', 'MQTT'],
      // "Geliştirdik": the owner tells Novacast as team work, as on the Novacast page.
      text: 'Farklı modellerdeki birçok ekranı tek bir web panelinden yöneten bir yazılım; Windows, macOS, Linux, Samsung TV, LG TV ve Android TV’de çalışıyor. Çalıştığım bir bilgisayar firmasında, hantal ve yetersiz kalan eski bir yazılımın yerine geçmesi için geliştirdik. Her ekranda Rust ile yazılmış bir oynatıcı var; Go ile yazılmış sunucu bu ekranlara bir MQTT aracısı (broker) üzerinden ulaşıyor.',
    },
    {
      name: 'Karecik',
      linkLabel: 'karecik.com',
      url: 'https://karecik.com',
      period: '2021’den beri · canlıda · GPL-3.0',
      stack: ['Go', 'PostgreSQL'],
      text: 'Yerel kafe ve restoranların kullandığı, çok kiracılı (multi-tenant) bir QR menü SaaS platformu. Bir arkadaşımın kafesi için yaptığım bir QR menüyle başladı; o arkadaşım bugün üç şubesinde de kullanıyor. Kesintisiz ve düşük gecikmeyle çalışacak şekilde tasarladım. İlk prototipler 2021’de, proje henüz başka adlar taşırken yazıldı; platform 2026’da canlıya alındı.',
    },
    {
      name: 'Açık Matematik',
      linkLabel: 'acik-matematik.com',
      url: 'https://acik-matematik.com',
      period: '2023’ten beri · canlıda · açık kaynak',
      stack: ['Quarto', 'Markdown', 'Python'],
      // Passive, as in the English: "launched", "was announced".
      text: 'Lisans düzeyindeki matematik için Türkçe bir akademik yayın platformu ve modern bir ders kitabı girişimi; yeniden üretilebilir sayısal hesaplamalar da içeriyor. Proje fikri 2023’te doğdu. Platform Haziran 2026’da yayına girdi, açık kaynak sürümü de Eylül 2026’da duyuruldu.',
    },
  ],

  research: [
    {
      title: 'Otonom paraşüt güdümü',
      linkLabel: 'github.com/KaanBahaSever/AutonomousParachute',
      url: 'https://github.com/KaanBahaSever/AutonomousParachute',
      // "Lineer cebir", as on the home page, the About page and in the console.
      text: 'Paraşütle inen bir yükü belirlenen iniş koordinatına yönlendiren, Python ile yazılmış bir yörünge güdüm algoritması. Lineer cebirden ve atmosferdeki iniş dinamiğinden yararlanıyor.',
    },
  ],
};

export const CV = { en, tr } as const satisfies Localized<CvContent>;
