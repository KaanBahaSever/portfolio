/**
 * Résumé data: the single source of truth for experience, education, volunteering,
 * certifications, activities, skills and languages (source: public/cv/kaan-cv.pdf).
 * Used by the home page. Keep it factual and in sync with the CV.
 *
 * Dates are 'YYYY' or 'YYYY-MM' strings (valid <time datetime> values);
 * see src/utils/resume-dates.ts for formatting.
 */

/** 'YYYY' or 'YYYY-MM'. */
export type ResumeDate = `${number}` | `${number}-${number}`;

export interface ResumePeriod {
  start: ResumeDate;
  /** Omitted for a single date (e.g. '2024'); 'present' for ongoing entries. */
  end?: ResumeDate | 'present';
}

export interface ExperienceItem extends ResumePeriod {
  role: string;
  organization: string;
  url?: string;
  location?: string;
  highlights: readonly string[];
}

export interface EducationItem extends ResumePeriod {
  institution: string;
  /** Faculty or department, e.g. "Faculty of Science". */
  department?: string;
  url?: string;
  degree: string;
  field: string;
  highlights?: readonly string[];
}

export type ActivityKind = 'volunteering' | 'certification' | 'activity';

export interface ActivityItem extends ResumePeriod {
  kind: ActivityKind;
  title: string;
  /** Role held, if any (e.g. "Vice President"). */
  role?: string;
  /** Issuer or organiser (e.g. for certifications). */
  organization?: string;
  location?: string;
  highlights: readonly string[];
}

export interface SkillGroup {
  label: string;
  items: readonly string[];
}

export const EXPERIENCE: readonly ExperienceItem[] = [
  {
    role: 'Swift Developer',
    organization: 'Aydos Yazılım',
    url: 'https://antizan.com.tr/en/',
    location: 'Istanbul, Turkey',
    start: '2024',
    highlights: [
      'Developed Antizan, a productivity app for Mac, in Swift.',
      'Used asynchronous programming to make the app faster and more responsive.',
    ],
  },
  {
    role: 'Full Stack Developer',
    organization: 'crowd.inc',
    start: '2021-07',
    end: '2024-03',
    highlights: [
      'Led the development and deployment of dynamic web applications built with Flask, jQuery, HTML, CSS and JavaScript libraries.',
      'Designed the SQLite and PostgreSQL databases behind them and built a Flask API.',
      'Implemented infinite scrolling on crowd.inc, improving the user experience.',
    ],
  },
];

export const EDUCATION: readonly EducationItem[] = [
  {
    institution: 'Istanbul University',
    department: 'Faculty of Science',
    url: 'https://www.istanbul.edu.tr/en/',
    degree: 'Bachelor of Science',
    field: 'Mathematics',
    start: '2019-11',
    end: 'present',
    highlights: [
      'Preparing for graduation, with a background in pure mathematics: real analysis, abstract algebra and topology.',
      "Planning to continue with a Master's degree in Computer Science.",
    ],
  },
];

export const VOLUNTEERING: readonly ActivityItem[] = [
  {
    kind: 'volunteering',
    title: 'Google Developer Student Clubs',
    role: 'Core Team Member',
    start: '2022',
    end: '2023',
    highlights: ['Led the creation and running of two successful YouTube live broadcasts.'],
  },
  {
    kind: 'volunteering',
    title: 'Istanbul University Rocket Club',
    role: 'Vice President',
    start: '2019',
    end: '2022',
    highlights: ['The team built a medium-altitude rocket with custom guidance and control software.'],
  },
];

export const CERTIFICATIONS: readonly ActivityItem[] = [
  {
    kind: 'certification',
    title: '21st Century Competencies',
    organization: 'YetGen',
    start: '2020',
    highlights: [
      'A programme organised by the Mehmet Zorlu Foundation, with seminars and courses on presentation skills, the Excel Solver tool and entrepreneurship.',
    ],
  },
];

export const ACTIVITIES: readonly ActivityItem[] = [
  {
    kind: 'activity',
    title: 'Erasmus+ Youth Exchange',
    location: 'Arrecife, Spain',
    start: '2017-06',
    end: '2018-12',
    highlights: [],
  },
];

/** One-line summary of what the skills below are pointed at. */
export const FOCUS =
  'System-level development in C++23, network backend applications in Go, and server infrastructure management — on top of a pure mathematics background.';

export const SKILLS: readonly SkillGroup[] = [
  { label: 'Programming', items: ['C++23', 'Go', 'Python', 'Swift', 'C', 'C#', 'Objective-C', 'React Native'] },
  { label: 'Systems & networking', items: ['gRPC', 'Protobuf', 'OS hooks', 'Server infrastructure'] },
  { label: 'Scientific computing', items: ['MATLAB', 'Mathematica', 'R'] },
  { label: 'Web', items: ['JavaScript', 'HTML', 'CSS', 'React', 'jQuery', 'Flask'] },
  { label: 'Databases', items: ['PostgreSQL', 'MySQL', 'SQLite', 'SQLCipher', 'MS SQL'] },
  { label: 'Source control', items: ['Git', 'GitHub'] },
];

export const LANGUAGES: readonly string[] = ['Turkish', 'English'];
