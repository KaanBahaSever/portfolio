/**
 * Blog interface text: the index, post lists and the post page. Rich sentences that contain
 * links (the index lead, the Medium note) are written as per-locale markup in the pages.
 * Shared labels ("Tags", "(opens in a new tab)") come from common.ts.
 */
import type { Localized, Locale } from '../config.ts';

const en = {
  index: {
    /** <title> and the nav label stay "Blog"; the page heading is more specific. */
    metaTitle: 'Blog',
    description:
      'Articles by Kaan Baha Sever on mathematics, software and the history of science, in English and Turkish.',
    eyebrow: 'Blog',
    title: 'Writing',
    empty: 'Nothing is published here yet.',
  },
  list: {
    readingTime: (minutes: number) => `${minutes} min read`,
    /** Screen-reader text after the short language badge ("TR"). */
    writtenIn: (language: string) => `(written in ${language})`,
  },
  post: {
    allPosts: 'All posts',
    published: 'Published',
    updated: 'Updated',
    readingTimeLabel: 'Reading time',
    readingTime: (minutes: number) => `${minutes} min`,
    contents: 'Contents',
    /**
     * Next to "Contents": how many headings the list holds, sections and subsections together.
     * "Headings", not "sections": the list numbers only its sections (1, 2, 3; subsections are
     * 1.1, 1.2), so "17 sections" over a list whose last number is 9 would not add up.
     */
    contentsCount: (entries: number) => `${entries} ${entries === 1 ? 'heading' : 'headings'}`,
    /** Shown when the article is in the other language and has no translation. */
    onlyIn: (language: string) => `This article is only available in ${language}.`,
    relatedProject: 'Related project',
    morePosts: 'More posts',
    older: 'Older',
    newer: 'Newer',
    readOnMedium: 'Read on Medium',
  },
  /** Language names as written in this interface language. */
  languageName: { en: 'English', tr: 'Turkish' } satisfies Record<Locale, string>,
};

export type BlogMessages = typeof en;

const tr: BlogMessages = {
  index: {
    metaTitle: 'Blog',
    description:
      'Kaan Baha Sever’in matematik, yazılım ve bilim tarihi üzerine Türkçe ve İngilizce yazıları.',
    eyebrow: 'Blog',
    title: 'Yazılar',
    empty: 'Henüz yayımlanmış bir yazı yok.',
  },
  list: {
    readingTime: (minutes) => `${minutes} dk okuma`,
    writtenIn: (language) => `(${language} yazılmış)`,
  },
  post: {
    allPosts: 'Tüm yazılar',
    published: 'Yayımlandı',
    updated: 'Güncellendi',
    readingTimeLabel: 'Okuma süresi',
    readingTime: (minutes) => `${minutes} dk`,
    contents: 'İçindekiler',
    contentsCount: (entries) => `${entries} başlık`,
    onlyIn: (language) => `Bu yazının yalnızca ${language} sürümü var.`,
    relatedProject: 'İlgili proje',
    morePosts: 'Diğer yazılar',
    older: 'Daha eski',
    newer: 'Daha yeni',
    readOnMedium: 'Medium’da okuyun',
  },
  languageName: { en: 'İngilizce', tr: 'Türkçe' },
};

export const blogMessages = { en, tr } as const satisfies Localized<BlogMessages>;
