/**
 * Site-wide interface text: layout, navigation, shared labels and accessibility phrases.
 * Page- and tool-specific text lives in its own module (src/i18n/messages/*, src/i18n/tools/*).
 *
 * Pattern for every catalogue: write `en` first; `typeof en` becomes the contract, so a
 * missing or misspelled Turkish key is a type error. Messages that interpolate values are
 * functions, which keeps parameters type-checked. Phrase Turkish messages so interpolated
 * values stand alone (Turkish case suffixes depend on how a value is pronounced).
 */
import type { Localized } from '../config.ts';

const en = {
  skipToContent: 'Skip to content',
  /** Appended (visually hidden) to links that open in a new tab. */
  newTab: '(opens in a new tab)',
  nav: {
    label: 'Main',
    menu: 'Menu',
    home: 'Home',
    about: 'About',
    projects: 'Projects',
    blog: 'Blog',
    tools: 'Tools',
    games: 'Games',
    console: 'Console',
    consoleHint: 'Open the interactive terminal',
  },
  language: {
    /** Accessible name of the language switch group. */
    label: 'Language',
    /**
     * Label of the link that switches TO this language. It is rendered in this language
     * (with lang="en"), so a Turkish page offers "Read in English".
     */
    switchTo: 'Read in English',
  },
  /** The header's theme button: a toggle (aria-pressed) whose tooltip says what a press does. */
  theme: {
    /** Accessible name; fixed, the pressed state says whether the dark theme is on. */
    toggle: 'Dark theme',
    toDark: 'Switch to dark theme',
    toLight: 'Switch to light theme',
  },
  footer: {
    tagline: 'Static site · the tools run entirely in your browser',
    socialLinks: 'Social links',
    email: 'Email',
    source: 'Source code',
  },
  badges: {
    openSource: 'Open source',
    private: 'Private',
    inDevelopment: 'In development',
    earlyAccess: 'Early access',
    comingSoon: 'Coming soon',
  },
  labels: {
    techStack: 'Tech stack',
    tags: 'Tags',
    downloadCv: 'Download CV',
    pdf: '(PDF)',
    present: 'Present',
    readMore: 'Read more',
    breadcrumb: 'Breadcrumb',
  },
  /** Accessible reading of a period such as "Jul 2021 – Mar 2024". */
  periodSr: (start: string, end: string) => `${start} to ${end}`,
};

export type CommonMessages = typeof en;

const tr: CommonMessages = {
  skipToContent: 'İçeriğe geç',
  newTab: '(yeni sekmede açılır)',
  nav: {
    label: 'Ana menü',
    menu: 'Menü',
    home: 'Ana sayfa',
    about: 'Hakkımda',
    projects: 'Projeler',
    blog: 'Blog',
    tools: 'Araçlar',
    games: 'Oyunlar',
    console: 'Konsol',
    consoleHint: 'Etkileşimli terminali aç',
  },
  language: {
    label: 'Dil',
    switchTo: 'Türkçe oku',
  },
  theme: {
    toggle: 'Koyu tema',
    toDark: 'Koyu temaya geç',
    toLight: 'Açık temaya geç',
  },
  footer: {
    tagline: 'Statik site · araçlar tamamen tarayıcınızda çalışır',
    socialLinks: 'Sosyal bağlantılar',
    email: 'E-posta',
    source: 'Kaynak kodu',
  },
  badges: {
    openSource: 'Açık kaynak',
    private: 'Kapalı kaynak',
    inDevelopment: 'Geliştiriliyor',
    earlyAccess: 'Erken erişim',
    comingSoon: 'Yakında',
  },
  labels: {
    techStack: 'Teknolojiler',
    tags: 'Etiketler',
    downloadCv: 'Özgeçmişi indir',
    pdf: '(PDF)',
    present: 'Günümüz',
    readMore: 'Devamını oku',
    breadcrumb: 'Sayfa yolu',
  },
  periodSr: (start, end) => `${start} – ${end}`,
};

export const common = { en, tr } as const satisfies Localized<CommonMessages>;
