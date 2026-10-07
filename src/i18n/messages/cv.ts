/**
 * The words around the CV content in the printed CVs (scripts/build-cv.ts, `npm run cv`):
 * section titles, how a title line is composed, the running footer and the PDF metadata. The
 * content itself is in src/data/cv.ts and src/data/resume.ts.
 *
 * Section titles are written in sentence case; the CV sets them in capitals with CSS, which
 * follows the document language (html lang="tr" gives "EĞİTİM", not "EĞITIM").
 *
 * Pure module: `node --test` imports it (tests/i18n-catalogues.test.ts checks both shapes).
 */
import type { Localized } from '../config.ts';

const en = {
  /** Document title: <title>, the PDF title and XMP dc:title. */
  documentTitle: (name: string) => `${name} — CV`,
  /** The running footer before the page counter: "Kaan Baha Sever · CV · 1 / 2". */
  footer: 'CV',
  /** PDF keywords, one comma-separated string. */
  keywords: 'CV, software developer, C++, Go, mathematics, systems software',
  /**
   * In the order the CV prints them. No volunteering section: the student communities are listed
   * under the university in Education.
   */
  sections: {
    experience: 'Experience',
    education: 'Education',
    projects: 'Selected projects',
    skills: 'Skills',
    research: 'Research',
    other: 'Certificates & activities',
    languages: 'Languages',
  },
  /** "Bachelor of Science in Mathematics". */
  degree: (degree: string, field: string) => `${degree} in ${field}`,
  /**
   * The semibold start of a student-community bullet under the university, the community first:
   * "Rocket and Space Club, Vice President (2019–2022):", "Mathematics Club (later university years):".
   */
  community: (name: string, role: string | undefined, period: string) =>
    `${role ? `${name}, ${role}` : name} (${period}):`,
  /** A role held in an organisation: "Vice President, Istanbul University Rocket and Space Club". */
  role: (role: string, organization: string) => `${role}, ${organization}`,
  /** A spoken language with its level: "Turkish (native)". */
  language: (name: string, level: string) => `${name} (${level.toLocaleLowerCase('en-US')})`,
};

export type CvMessages = typeof en;

const tr: CvMessages = {
  documentTitle: (name) => `${name} — Özgeçmiş`,
  footer: 'Özgeçmiş',
  keywords: 'özgeçmiş, yazılım geliştirici, C++, Go, matematik, sistem yazılımı',
  sections: {
    experience: 'Deneyim',
    education: 'Eğitim',
    projects: 'Seçilmiş projeler',
    skills: 'Yetkinlikler',
    research: 'Araştırma',
    other: 'Sertifikalar ve etkinlikler',
    languages: 'Diller',
  },
  // As on the home page: "Matematik (Lisans)".
  degree: (degree, field) => `${field} (${degree})`,
  // As in role(): the post after the organisation, no comma ("Roket ve Uzay Kulübü Başkan Yardımcısı (2019–2022):").
  community: (name, role, period) => `${role ? `${name} ${role}` : name} (${period}):`,
  // The organisation first and no comma, as Turkish names a post ("Roket ve Uzay Kulübü Başkan Yardımcısı").
  role: (role, organization) => `${organization} ${role}`,
  language: (name, level) => `${name} (${level.toLocaleLowerCase('tr-TR')})`,
};

export const cvMessages = { en, tr } as const satisfies Localized<CvMessages>;
