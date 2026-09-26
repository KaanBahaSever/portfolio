/**
 * Text for the 404 pages (src/pages/404.astro and src/pages/tr/404.astro, both rendered by
 * src/components/home/NotFound.astro). Navigation labels come from common.nav; the lead
 * paragraph and the email line carry inline markup, so they are written per language in the
 * component itself.
 *
 * Pure module: `node --test` imports it (tests/resume-copy.test.ts checks both languages).
 */
import type { Localized } from '../config.ts';

/** The pages suggested on the 404 page, in display order (keys into common.nav). */
export const NOT_FOUND_LINKS = ['projects', 'blog', 'tools', 'games', 'about'] as const;
export type NotFoundLink = (typeof NOT_FOUND_LINKS)[number];

const en = {
  /** <title> and meta description. */
  title: 'Page not found',
  description: 'The page you were looking for could not be found.',
  eyebrow: 'Error 404',
  heading: 'Page not found',
  home: 'Go to the home page',
  popular: 'Popular pages',
  figure: {
    label: 'Fig. 404',
    caption: 'f is defined everywhere except at one point.',
  },
  links: {
    projects: 'Systems, platforms and open-source work',
    blog: 'Notes on mathematics and the things I build',
    tools: 'Private utilities that run in your browser',
    games: 'Battleship and tic-tac-toe against algorithmic opponents',
    about: 'Background and the road from mathematics to systems software',
  } satisfies Record<NotFoundLink, string>,
};

export type NotFoundMessages = typeof en;

const tr: NotFoundMessages = {
  title: 'Sayfa bulunamadı',
  description: 'Aradığınız sayfa bulunamadı.',
  eyebrow: 'Hata 404',
  heading: 'Sayfa bulunamadı',
  home: 'Ana sayfaya gidin',
  popular: 'Sık ziyaret edilen sayfalar',
  figure: {
    label: 'Şekil 404',
    caption: 'f, tek bir nokta dışında her yerde tanımlı.',
  },
  links: {
    projects: 'Sistemler, platformlar ve açık kaynak çalışmalar',
    blog: 'Matematik ve geliştirdiğim şeyler üzerine notlar',
    tools: 'Tarayıcınızda çalışan, gizliliğe saygılı araçlar',
    games: 'Algoritmik rakiplere karşı Amiral Battı ve XOX',
    about: 'Geçmişim ve matematikten sistem yazılımına uzanan yolum',
  },
};

export const notFoundMessages = { en, tr } as const satisfies Localized<NotFoundMessages>;
