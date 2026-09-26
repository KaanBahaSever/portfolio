/**
 * Text for the tools hub (/tools/). Tool names and descriptions live with the tool list in
 * src/data/tools.ts; the privacy note, which contains a link, is per-locale markup in
 * src/components/tools-index/PrivacyNote.astro.
 */
import type { Localized } from '../config.ts';
import { formatters } from '../format.ts';

const en = {
  title: 'Tools',
  description: 'Small, privacy-friendly utilities that run entirely in your browser. Nothing you open in them is uploaded.',
  /** Mono label above the title. */
  eyebrow: (count: number) => `${formatters('en').number(count)} ${count === 1 ? 'tool' : 'tools'} · in your browser`,
  lead: 'Small utilities for everyday tasks. No sign-up, no ads, no tracking.',
  privacyTitle: 'Privacy',
  /** Accessible name of the list of tool cards. */
  listLabel: 'All tools',
};

export type ToolsIndexMessages = typeof en;

const tr: ToolsIndexMessages = {
  title: 'Araçlar',
  description: 'Tamamen tarayıcınızda çalışan, gizliliğinize saygılı küçük araçlar. Bu araçlarda açtığınız hiçbir şey bir sunucuya yüklenmez.',
  eyebrow: (count) => `${formatters('tr').number(count)} araç · tarayıcınızda`,
  lead: 'Günlük işler için küçük araçlar. Üyelik yok, reklam yok, takip yok.',
  privacyTitle: 'Gizlilik',
  listLabel: 'Tüm araçlar',
};

export const toolsIndexMessages = { en, tr } as const satisfies Localized<ToolsIndexMessages>;
