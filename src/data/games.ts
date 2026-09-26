import type { Localized } from '../i18n/config.ts';

export interface GameInfo {
  slug: string;
  title: Localized<string>;
  description: Localized<string>;
  /** The algorithm behind the computer opponent, shown as a label on the card. */
  algorithm: Localized<string>;
  /** Locale-free path; localize it with localizePath(). */
  href: string;
}

export const GAMES: readonly GameInfo[] = [
  {
    slug: 'battleship',
    title: { en: 'Battleship', tr: 'Amiral Battı' },
    description: {
      en: 'Place your fleet and duel a computer admiral that hunts with a probability density map, then closes in on every hit.',
      tr: 'Filonuzu yerleştirin ve bilgisayar amirale karşı savaşın. Amiral gemilerinizi bir olasılık yoğunluğu haritasıyla arar, her isabetten sonra da atışlarını o bölgeye toplar.',
    },
    algorithm: { en: 'Hunt & target · probability density', tr: 'Av ve hedef · olasılık yoğunluğu' },
    href: '/games/battleship/',
  },
  {
    slug: 'tic-tac-toe',
    title: { en: 'Tic-tac-toe', tr: 'XOX' },
    description: {
      en: 'The classic 3×3 game against an opponent that searches the whole game tree. On the hardest level, a draw is the best you can do.',
      tr: 'Klasik 3×3 oyunu, tüm oyun ağacını tarayan bir rakibe karşı oynayın. En zor seviyede en iyi ihtimalle berabere kalırsınız.',
    },
    algorithm: { en: 'Minimax · alpha–beta pruning', tr: 'Minimax · alfa–beta budama' },
    href: '/games/tic-tac-toe/',
  },
];
