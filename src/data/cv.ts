/**
 * CV-only content for public/cv/kaan-cv.pdf, built by `npm run cv` (scripts/build-cv.ts).
 * Experience, education, volunteering, activities, skills and languages come from
 * src/data/resume.ts, so the CV and the site cannot drift apart; this module adds what only
 * the printed CV needs: contact details, a short summary and compact project lines.
 *
 * Same facts and voice as the site: the owner is a software developer — never an engineer —
 * and nothing here may go beyond what the site states. The CV is in English (the site labels
 * the download "PDF · English") and, like the site, uses British spelling.
 *
 * Pure module, so the build script can import it with plain Node.
 */

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

export const CV = {
  /** Printed under the name. */
  headline: 'Software Developer | Math-Driven Solutions & Algorithms',
  /** Carried over from the previous CV. */
  phone: { label: '+90 536 560 78 29', href: 'tel:+905365607829' },
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
  ] satisfies readonly CvProject[],

  research: [
    {
      title: 'Autonomous parachute guidance',
      linkLabel: 'github.com/KaanBahaSever/AutonomousParachute',
      url: 'https://github.com/KaanBahaSever/AutonomousParachute',
      text: 'A trajectory-steering algorithm in Python that uses linear algebra and atmospheric descent dynamics to guide a payload to a designated landing coordinate.',
    },
  ] satisfies readonly CvResearch[],
} as const;
