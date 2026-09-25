/**
 * Résumé data: the single source of truth for experience, education, volunteering,
 * certifications, activities, skills and languages. Used by the home page (and anything else
 * that summarises the CV). Keep it factual and in sync with public/cv/kaan-cv.pdf.
 *
 * Prose is Localized (read it with pick(value, locale)); dates, URLs and technology names are
 * shared by both languages. Dates are 'YYYY' or 'YYYY-MM' strings (valid <time datetime>
 * values); src/utils/resume-dates.ts formats them per locale.
 *
 * Pure module (types only from config.ts), so tests can import it with `node --test`.
 */
import type { Locale, Localized } from '../i18n/config.ts';

/** 'YYYY' or 'YYYY-MM'. */
export type ResumeDate = `${number}` | `${number}-${number}`;

export interface ResumePeriod {
  start: ResumeDate;
  /** Omitted for a single date (e.g. '2020'); 'present' for ongoing entries. */
  end?: ResumeDate | 'present';
}

/** A proper noun that is written the same in both languages, or a translated one. */
export type ResumeText = string | Localized<string>;

export interface ExperienceItem extends ResumePeriod {
  role: Localized<string>;
  organization: ResumeText;
  url?: string;
  location?: Localized<string>;
  /** One sentence on the scope of the role, shown before the highlights. */
  summary: Localized<string>;
  highlights: Localized<readonly string[]>;
  /** Technologies used in the role (proper nouns, not translated). */
  stack: readonly string[];
}

export interface EducationItem extends ResumePeriod {
  institution: Localized<string>;
  /** Faculty or department, e.g. "Faculty of Science". */
  department?: Localized<string>;
  url?: string;
  degree: Localized<string>;
  field: Localized<string>;
  highlights: Localized<readonly string[]>;
}

export type ActivityKind = 'volunteering' | 'certification' | 'activity';

export interface ActivityItem extends ResumePeriod {
  kind: ActivityKind;
  title: ResumeText;
  /** Role held, if any (e.g. "Vice President"). */
  role?: Localized<string>;
  /** Issuer or organiser (e.g. for certifications). */
  organization?: ResumeText;
  location?: Localized<string>;
  highlights: Localized<readonly string[]>;
}

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
    role: {
      en: 'Full-Stack Software Engineer / Systems Contributor',
      tr: 'Full-Stack Yazılım Mühendisi / Sistem Katkıcısı',
    },
    organization: 'crowd.inc',
    start: '2021-07',
    end: '2024-03',
    summary: {
      en: 'Owned the end-to-end software development lifecycle, from relational schema design in PostgreSQL to RESTful APIs in Python and Flask with a jQuery front end.',
      tr: "Yazılım geliştirme yaşam döngüsünü uçtan uca üstlendim: PostgreSQL ile ilişkisel şema tasarımından Python ve Flask ile yazılan RESTful API'lere ve jQuery tabanlı ön yüze kadar.",
    },
    highlights: {
      en: [
        'Architected granular role-based access control (RBAC) with strict permission boundaries between public and private data.',
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
    url: 'https://www.istanbul.edu.tr/en/',
    degree: { en: 'Bachelor of Science', tr: 'Lisans' },
    field: { en: 'Mathematics', tr: 'Matematik' },
    start: '2019-11',
    end: 'present',
    highlights: {
      en: [
        'Preparing to graduate, with a grounding in pure mathematics: real analysis, abstract algebra and topology.',
        "Planning a Master's degree in Computer Science next.",
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
        'Contributed to the design and successful high-power launches of three rockets.',
        'Sole author of the flight avionics firmware and the parachute deployment control system, driven by onboard sensor fusion of orientation, gyroscope and altimeter data.',
        'Designed the SD-card telemetry logging protocol and built a desktop dashboard that parses flight data and plots post-flight trajectories.',
      ],
      tr: [
        'Üç roketin tasarımına ve başarıyla gerçekleştirilen yüksek güçlü fırlatmalarına katkıda bulundum.',
        'Uçuş aviyoniği gömülü yazılımını ve paraşüt açma kontrol sistemini tek başıma geliştirdim; ikisi de yönelim, jiroskop ve altimetre verilerini birleştiren sensör füzyonuna dayanıyordu.',
        'SD kartlı telemetri kayıt protokolünü tasarladım; uçuş verisini ayrıştırıp uçuş sonrası yörünge grafiklerini çizen bir masaüstü paneli geliştirdim.',
      ],
    },
  },
  {
    kind: 'volunteering',
    title: 'Google Developer Student Clubs',
    role: { en: 'Core Team Member', tr: 'Çekirdek Ekip Üyesi' },
    start: '2022',
    end: '2023',
    highlights: {
      en: ['Led the preparation and running of two YouTube live broadcasts.'],
      tr: ['İki YouTube canlı yayınının hazırlanmasına ve yürütülmesine öncülük ettim.'],
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
    title: { en: 'Erasmus+ Youth Exchange', tr: 'Erasmus+ Gençlik Değişimi' },
    location: { en: 'Arrecife, Spain', tr: 'Arrecife, İspanya' },
    start: '2017-06',
    end: '2018-12',
    highlights: { en: [], tr: [] },
  },
];

/** One-line summary of what the skills below are pointed at. */
export const FOCUS: Localized<string> = {
  en: 'Modern C++ and Go day to day, for system tools, telemetry and messaging platforms and algorithm-driven applications, on a foundation of pure mathematics.',
  tr: 'Günlük işimde modern C++ ve Go kullanıyorum: sistem araçları, telemetri ve mesajlaşma platformları, algoritma odaklı uygulamalar. Hepsinin temelinde saf matematik var.',
};

/** Curated for the current focus: systems languages first. */
export const SKILLS: readonly SkillGroup[] = [
  {
    label: { en: 'Programming', tr: 'Programlama' },
    items: ['C++ (C++23)', 'Go', 'C', 'Python', 'C#', 'Objective-C', 'TypeScript / JavaScript', 'SQL'],
  },
  {
    label: { en: 'Systems & networking', tr: 'Sistemler ve ağ' },
    items: [
      'gRPC',
      'Protobuf',
      'MQTT',
      { en: 'OS event hooks', tr: 'İşletim sistemi olay kancaları' },
      { en: 'Linux servers', tr: 'Linux sunucuları' },
    ],
  },
  {
    label: { en: 'Databases', tr: 'Veritabanları' },
    items: ['PostgreSQL', 'SQLite / SQLCipher', 'MySQL', 'MS SQL'],
  },
  {
    label: { en: 'Web', tr: 'Web' },
    items: ['Flask', 'jQuery', { en: 'REST APIs', tr: 'REST API' }],
  },
  {
    label: { en: 'Scientific computing', tr: 'Bilimsel hesaplama' },
    items: ['MATLAB', 'Mathematica', 'R'],
  },
  {
    label: { en: 'Version control', tr: 'Sürüm kontrolü' },
    items: ['Git', 'GitHub'],
  },
];

export const LANGUAGES: readonly SpokenLanguage[] = [
  { name: { en: 'Turkish', tr: 'Türkçe' }, level: { en: 'Native', tr: 'Ana dil' } },
  { name: { en: 'English', tr: 'İngilizce' } },
];
