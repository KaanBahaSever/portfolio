/**
 * Résumé data: the single source of truth for experience, education, volunteering,
 * certifications, activities, skills and languages. Used by the home page (and anything else
 * that summarises the CV) and by `npm run cv`, which builds the English and Turkish CVs from it
 * (public/cv/kaan-cv.pdf, kaan-cv-tr.pdf). Keep it factual; re-run `npm run cv` after changing it.
 *
 * Prose is Localized (read it with pick(value, locale)); dates and technology names are shared
 * by both languages. Fields typed ResumeText (names, titles kept in the original, URLs) may be
 * either, so read them with resumeText(). Dates are 'YYYY' or 'YYYY-MM' strings (valid
 * <time datetime> values); src/utils/resume-dates.ts formats them per locale. An entry whose
 * dates are not on record gets a period in words instead (UndatedPeriod): never make a date up.
 *
 * The owner is a software developer: no job title or description here calls him an engineer
 * (tests/resume-copy.test.ts enforces it). Other people keep their own titles.
 *
 * Pure module (types only from config.ts), so tests can import it with `node --test`.
 */
import type { Locale, Localized } from '../i18n/config.ts';

/** 'YYYY' or 'YYYY-MM'. */
export type ResumeDate = `${number}` | `${number}-${number}`;

export interface DatedPeriod {
  start: ResumeDate;
  /** Omitted for a single date (e.g. '2020'); 'present' for ongoing entries. */
  end?: ResumeDate | 'present';
  periodLabel?: never;
}

/**
 * A period known only in words, e.g. "Later university years" for something done in the last years of a
 * degree whose exact dates are not on record. Shown where the dates would be; sorted before the
 * dated entries (see sortNewestFirst), so use it only for the recent past.
 */
export interface UndatedPeriod {
  periodLabel: Localized<string>;
  start?: never;
  end?: never;
}

export type ResumePeriod = DatedPeriod | UndatedPeriod;

/** A proper noun that is written the same in both languages, or a translated one. */
export type ResumeText = string | Localized<string>;

export interface ExperienceItem extends DatedPeriod {
  /** The job title; a plain string when the original title is kept in every language. */
  role: ResumeText;
  /**
   * The language `role` is written in when it is not translated (e.g. 'en' for an English job
   * title), so pages in other languages can mark it with lang="…" for screen readers.
   */
  roleLang?: Locale;
  organization: ResumeText;
  url?: string;
  location?: Localized<string>;
  /** One sentence on the scope of the role, shown before the highlights. */
  summary: Localized<string>;
  highlights: Localized<readonly string[]>;
  /** Technologies used in the role (proper nouns, not translated). */
  stack: readonly string[];
}

export interface EducationItem extends DatedPeriod {
  institution: Localized<string>;
  /** Faculty or department, e.g. "Faculty of Science". */
  department?: Localized<string>;
  /** The institution's site; per language when it has a page in each language. */
  url?: ResumeText;
  degree: Localized<string>;
  field: Localized<string>;
  highlights: Localized<readonly string[]>;
}

export type ActivityKind = 'volunteering' | 'certification' | 'activity';

interface ActivityDetails {
  kind: ActivityKind;
  title: ResumeText;
  /** Role held, if any (e.g. "Vice President"). */
  role?: Localized<string>;
  /** Issuer or organiser (e.g. for certifications). */
  organization?: ResumeText;
  location?: Localized<string>;
  highlights: Localized<readonly string[]>;
}

/** Volunteering, certificates and other activities: dated, or described in words. */
export type ActivityItem = ActivityDetails & ResumePeriod;

export interface SkillGroup {
  label: Localized<string>;
  items: readonly ResumeText[];
}

export interface SpokenLanguage {
  name: Localized<string>;
  /** Proficiency, only where the CV states one. */
  level?: Localized<string>;
}

/** Resolves a shared or translated value. */
export function resumeText(value: ResumeText, locale: Locale): string {
  return typeof value === 'string' ? value : value[locale];
}

export const EXPERIENCE: readonly ExperienceItem[] = [
  {
    // The owner's chosen title, translated like any other: "Software Developer" is a plain
    // description, and Turkish has the established "Yazılım Geliştirici" for it.
    role: { en: 'Software Developer', tr: 'Yazılım Geliştirici' },
    organization: 'crowd.inc',
    start: '2021-07',
    end: '2024-03',
    summary: {
      en: 'Owned the software development lifecycle end to end, from relational schema design in PostgreSQL to RESTful APIs in Python and Flask with a jQuery front end.',
      tr: 'Yazılım geliştirme yaşam döngüsünü uçtan uca üstlendim: PostgreSQL ile ilişkisel şema tasarımından Python ve Flask ile yazılan RESTful API’lere ve jQuery tabanlı ön yüze kadar.',
    },
    highlights: {
      en: [
        'Designed granular role-based access control (RBAC) with strict permission boundaries between public and private data.',
        'Built scalable feed pagination and dynamic data loading across the API and the front end.',
        'Provisioned and configured the Linux servers the platform ran on.',
        'Kept the system reliable through rigorous unit and integration testing.',
      ],
      tr: [
        'Herkese açık ve özel veriler arasında katı yetki sınırları çizen, ayrıntılı bir rol tabanlı erişim denetimi (RBAC) tasarladım.',
        'API ve ön yüz genelinde ölçeklenebilir akış sayfalaması ve dinamik veri yükleme geliştirdim.',
        'Platformun çalıştığı Linux sunucularını kurup yapılandırdım.',
        'Kapsamlı birim ve entegrasyon testleriyle sistemin güvenilirliğini sağladım.',
      ],
    },
    stack: ['Python', 'Flask', 'PostgreSQL', 'jQuery', 'Linux'],
  },
];

export const EDUCATION: readonly EducationItem[] = [
  {
    institution: { en: 'Istanbul University', tr: 'İstanbul Üniversitesi' },
    department: { en: 'Faculty of Science', tr: 'Fen Fakültesi' },
    url: { en: 'https://www.istanbul.edu.tr/en/', tr: 'https://www.istanbul.edu.tr/tr/' },
    degree: { en: 'Bachelor of Science', tr: 'Lisans' },
    field: { en: 'Mathematics', tr: 'Matematik' },
    start: '2019-11',
    end: 'present',
    highlights: {
      en: [
        'Preparing to graduate, with a grounding in pure mathematics: real analysis, abstract algebra and topology.',
        'Planning a Master’s degree in Computer Science next.',
      ],
      tr: [
        'Mezuniyete hazırlanıyorum; reel analiz, soyut cebir ve topoloji ağırlıklı bir saf matematik altyapım var.',
        'Ardından bilgisayar bilimleri alanında yüksek lisans yapmayı planlıyorum.',
      ],
    },
  },
];

export const VOLUNTEERING: readonly ActivityItem[] = [
  {
    kind: 'volunteering',
    title: { en: 'Istanbul University Rocket Club', tr: 'İstanbul Üniversitesi Roket Kulübü' },
    role: { en: 'Vice President', tr: 'Başkan Yardımcısı' },
    start: '2019',
    end: '2022',
    highlights: {
      en: [
        'With the club’s team, designed and built one low-altitude rocket (5,000 ft) and two high-altitude rockets (10,000 ft).',
        'Solely developed the flight avionics firmware and the parachute deployment control system, both driven by onboard sensor fusion of orientation, gyroscope and altimeter data.',
        'Designed the SD-card telemetry logging protocol that worked alongside the RF telemetry modules, and built a desktop dashboard that parses flight data and plots post-flight trajectories.',
      ],
      tr: [
        // Turkish groups thousands with a dot: 5.000 ft.
        'Kulüp ekibiyle bir alçak irtifa (5.000 ft) ve iki yüksek irtifa (10.000 ft) roketinin tasarımında ve üretiminde yer aldım.',
        // "(firmware)", as on the Rocket-Up page and in the console.
        'Uçuş aviyoniğinin gömülü yazılımını (firmware) ve paraşüt açma kontrol sistemini tek başıma geliştirdim; ikisi de yönelim, jiroskop ve altimetre verilerini birleştiren sensör füzyonuna dayanıyordu.',
        'RF telemetri modülleriyle birlikte çalışan SD kart telemetri kayıt protokolünü tasarladım; uçuş verisini ayrıştırıp uçuş sonrası yörünge grafiklerini çizen bir masaüstü paneli geliştirdim.',
      ],
    },
  },
  {
    kind: 'volunteering',
    title: 'Google Developer Student Clubs',
    role: { en: 'Core Team Member', tr: 'Çekirdek Ekip Üyesi' },
    start: '2023',
    highlights: {
      en: [
        'Hosted technical workshops and live streams on Flask, HTML and Git/GitHub.',
        // The guest keeps their own title: only the owner is never called an engineer.
        'Organised Cyber Security Week, including a live-streamed technical interview with a CCIE-certified network security engineer.',
      ],
      tr: [
        'Flask, HTML ve Git/GitHub üzerine teknik atölyeler ve canlı yayınlar sundum.',
        'Siber Güvenlik Haftası etkinliğini düzenledim; programda CCIE sertifikalı bir ağ güvenliği mühendisiyle canlı yayında teknik bir söyleşi de vardı.',
      ],
    },
  },
  {
    kind: 'volunteering',
    title: { en: 'Mathematics Club', tr: 'Matematik Kulübü' },
    // No dates on record, only "during my upperclassman years": said in words, not guessed.
    periodLabel: { en: 'Later university years', tr: 'Son sınıflar' },
    highlights: {
      en: ['Organised and ran academic events, including seminars and logic and mathematics competitions.'],
      tr: ['Seminerler, mantık ve matematik yarışmaları gibi akademik etkinlikler düzenleyip yürüttüm.'],
    },
  },
];

export const CERTIFICATIONS: readonly ActivityItem[] = [
  {
    kind: 'certification',
    title: { en: '21st Century Competencies', tr: '21. Yüzyıl Yetkinlikleri' },
    organization: { en: 'YetGen · Mehmet Zorlu Foundation', tr: 'YetGen · Mehmet Zorlu Vakfı' },
    start: '2020',
    highlights: { en: [], tr: [] },
  },
];

export const ACTIVITIES: readonly ActivityItem[] = [
  {
    kind: 'activity',
    title: { en: 'High school research project', tr: 'Lise araştırma projesi' },
    // Glossed in English for readers outside Türkiye.
    organization: { en: 'TÜBİTAK (Scientific and Technological Research Council of Türkiye)', tr: 'TÜBİTAK' },
    start: '2019',
    highlights: {
      en: [
        'Researched cryptography and visual programming logic, including an early prototype of a flowchart-based visual coding tool.',
      ],
      tr: [
        'Kriptografi ve görsel programlama mantığı üzerine araştırma yaptım; çalışma, akış şemalarıyla kod yazmayı sağlayan görsel bir aracın erken bir prototipini de içeriyordu.',
      ],
    },
  },
  {
    kind: 'activity',
    title: { en: 'Erasmus+ Youth Exchange', tr: 'Erasmus+ Gençlik Değişimi' },
    location: { en: 'Arrecife, Spain', tr: 'Arrecife, İspanya' },
    start: '2017-06',
    end: '2018-12',
    highlights: { en: [], tr: [] },
  },
];

/** One-line summary of what the skills below are pointed at. */
export const FOCUS: Localized<string> = {
  en: 'Modern C++ and Go day to day, for system tools, telemetry and messaging platforms and algorithm-driven applications, on a foundation of pure mathematics. Around the code: GitHub Actions pipelines that test, package, produce multi-platform builds and deploy in one click, notably for the Asion ecosystem.',
  tr: 'Günlük işimde modern C++ ve Go kullanıyorum: sistem araçları, telemetri ve mesajlaşma platformları, algoritma odaklı uygulamalar. Hepsinin temelinde saf matematik var. Bunun yanında, özellikle Asion ekosistemi için, GitHub Actions ile tek tıkla test eden, paketleyen, çok platformlu derleme çıktıları üreten ve dağıtım yapan pipeline’lar kuruyorum.',
};

/**
 * The owner's own list (2026-09-26): systems languages first, tools rather than task
 * descriptions, no duplicates. Shared by the home page and both CVs.
 */
export const SKILLS: readonly SkillGroup[] = [
  {
    label: { en: 'Programming languages', tr: 'Programlama Dilleri' },
    items: ['C++ (C++23)', 'Go', 'C', 'Python', 'C#', 'TypeScript / JavaScript'],
  },
  {
    label: { en: 'Systems & network programming', tr: 'Sistem & Ağ Programlama' },
    items: [
      'gRPC',
      'Protobuf',
      'MQTT',
      { en: 'OS event hooks', tr: 'OS Event Hooks' },
      { en: 'Linux systems', tr: 'Linux Sistemleri' },
    ],
  },
  {
    label: { en: 'DevOps & tools', tr: 'DevOps & Araçlar' },
    items: [
      'Git',
      'GitHub',
      'GitHub Actions',
      { en: 'CI/CD pipelines', tr: 'CI/CD Süreçleri' },
      'Cross-compilation',
      'Bash',
      'Batch',
    ],
  },
  {
    label: { en: 'Databases', tr: 'Veri Tabanları' },
    items: ['PostgreSQL', 'SQLite (SQLCipher)', 'MySQL', 'MS SQL'],
  },
  {
    label: { en: 'Web technologies', tr: 'Web Teknolojileri' },
    items: ['React', 'Astro', 'Flask', { en: 'REST APIs', tr: 'REST API' }, 'HTML/CSS'],
  },
  {
    label: { en: 'Scientific computing', tr: 'Bilimsel Hesaplama' },
    items: ['MATLAB', 'Mathematica', 'R'],
  },
];

export const LANGUAGES: readonly SpokenLanguage[] = [
  // "Ana dili" (mother tongue), not "ana dil" (a parent language that others descend from; TDK).
  { name: { en: 'Turkish', tr: 'Türkçe' }, level: { en: 'Native', tr: 'Ana dili' } },
  { name: { en: 'English', tr: 'İngilizce' } },
];
