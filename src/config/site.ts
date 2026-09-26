/**
 * Site-wide settings: identity, contact links, the CV files and navigation.
 * Résumé details (experience, education, skills…) live in src/data/resume.ts.
 * Translatable values are Localized records; read them with pick(value, locale).
 */
import type { Localized } from '../i18n/config.ts';
import type { CommonMessages } from '../i18n/messages/common.ts';

export interface NavItem {
  /** Key into common.nav for the label. */
  key: keyof Pick<CommonMessages['nav'], 'about' | 'projects' | 'blog' | 'tools' | 'games'>;
  /** Locale-free path; localize it with localizePath(). */
  href: string;
}

export const SITE = {
  name: 'Kaan Baha Sever',
  role: {
    en: 'Software Developer | Math-Driven Solutions & Algorithms',
    tr: 'Yazılım Geliştirici | Matematik Odaklı Çözümler ve Algoritmalar',
  } satisfies Localized<string>,
  description: {
    en: 'Kaan Baha Sever is a software developer in Istanbul who brings a mathematics background to systems work in C++ and Go: projects, writing, games and privacy-friendly browser tools.',
    tr: 'Kaan Baha Sever, matematik altyapısını C++ ve Go ile sistem yazılımına taşıyan İstanbullu bir yazılım geliştirici. Projeler, yazılar, oyunlar ve gizliliğe saygılı tarayıcı araçları.',
  } satisfies Localized<string>,
  // Keep in sync with `site` in astro.config.mjs.
  url: 'https://kaanbahasever.com',
  email: 'kaanbahasever@gmail.com',
  location: { en: 'Istanbul, Turkey', tr: 'İstanbul, Türkiye' } satisfies Localized<string>,
  // The CV in each language (files in public/), generated from the résumé data by `npm run cv`,
  // which writes them to these paths. Each page links the CV in its own language.
  cvPath: { en: '/cv/kaan-cv.pdf', tr: '/cv/kaan-cv-tr.pdf' } satisfies Localized<string>,
  // The name a downloaded CV is saved under: ASCII only, so every system keeps it as written.
  cvFileName: { en: 'Kaan-Baha-Sever-CV.pdf', tr: 'Kaan-Baha-Sever-Ozgecmis.pdf' } satisfies Localized<string>,
  repositoryUrl: 'https://github.com/KaanBahaSever/portfolio',
  socials: [
    { label: 'GitHub', href: 'https://github.com/KaanBahaSever' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/kaan-baha-sever/' },
    { label: 'Medium', href: 'https://medium.com/@KaanBahaSever' },
  ],
  // The brand link goes home; /console/ is reached from the header's terminal button.
  nav: [
    { key: 'about', href: '/about/' },
    { key: 'projects', href: '/projects/' },
    { key: 'blog', href: '/blog/' },
    { key: 'tools', href: '/tools/' },
    { key: 'games', href: '/games/' },
  ] satisfies readonly NavItem[],
} as const;
