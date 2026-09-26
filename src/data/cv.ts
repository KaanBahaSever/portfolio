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
 * written natively and plainly, in short first-person sentences like the Turkish résumé
 * bullets, with ’ before suffixes on names and numbers ("2024’ten", "crowd.inc’te") and the
 * site's Turkish terms (CI/CD süreçleri, GitHub Actions iş akışları, runner, yayıncı/abone (pub/sub),
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
    'Software developer with a mathematics background (Istanbul University). I build systems software in modern C++ and Go: desktop agents, telemetry and messaging platforms, and algorithm-driven applications, together with the CI/CD pipelines that test, package and ship them. From 2021 to 2024 I owned the development lifecycle at crowd.inc, from database schema to Linux servers.',

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
      linkLabel: 'karecik.com',
      url: 'https://karecik.com',
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
    'İstanbul Üniversitesinde matematik okuyan bir yazılım geliştiriciyim. Modern C++ ve Go ile sistem yazılımları geliştiriyorum: masaüstü ajan yazılımları, telemetri ve mesajlaşma platformları, algoritmaya dayalı uygulamalar. Bunları test eden, paketleyen ve yayına alan CI/CD süreçlerini de kuruyorum. 2021–2024 arasında crowd.inc’te geliştirme sürecini baştan sona yürüttüm: veri tabanı şemasından Linux sunucularına kadar.',

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
      stack: ['Go', 'MQTT'],
      // "Yayıncı/abone (pub/sub) modeli", as on the Novacast page and in the About figure.
      text: 'Gerçek zamanlı mesaj yayını ve cihaz yönetimi için bir platform; düşük gecikmeli bir yayıncı/abone (pub/sub) modeli üzerine kurulu. Çalıştığım bir bilgisayar firmasında, yetersiz kalan eski bir yazılımın yerine geçmesi için geliştirdim. Önce Python ile prototipini yazdım, 2025’in sonlarında da Go ve MQTT ile bir mikroservis olarak baştan tasarladım.',
    },
    {
      name: 'Karecik',
      linkLabel: 'karecik.com',
      url: 'https://karecik.com',
      period: '2021’den beri · canlıda · GPL-3.0',
      stack: ['Go', 'PostgreSQL'],
      text: 'Çok kiracılı (multi-tenant) bir QR menü SaaS platformu. Yerel kafe ve restoranlar menülerini ve siparişlerini bu platformla yönetiyor, müşterileriyle de buradan iletişim kuruyor. Kesintisiz ve düşük gecikmeyle çalışacak şekilde tasarladım. İlk prototipler 2021’de, proje henüz başka adlar taşırken yazıldı; platform 2026’da canlıya alındı.',
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
