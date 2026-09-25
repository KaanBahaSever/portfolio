/**
 * Text for the /games/ index page and what the game pages share (breadcrumb, figure captions).
 * Game-specific text lives in battleship.ts and tictactoe.ts next to this file.
 */
import type { Localized } from '../config.ts';

const en = {
  meta: {
    title: 'Games',
    description:
      'Battleship and tic-tac-toe in the browser, against computer opponents built on probability density and minimax search.',
  },
  eyebrow: 'Recreational mathematics',
  title: 'Games',
  lead: 'Two classic games I first wrote in C# while learning to program, rebuilt for the browser. Each computer opponent runs a small algorithm, and both pages let you watch it think.',
  /** Caption index for a card's illustration: "Fig. 1". */
  figure: (n: number) => `Fig. ${n}`,
  /** Visible call to action on a card. */
  play: 'Play',
  /** Accessible name prefix for the opponent's algorithm on a card. */
  opponent: 'Opponent:',
  note: 'Both games work with a mouse, a touch screen or the keyboard alone, and announce every move to screen readers. They run entirely in your browser: nothing is stored or sent.',
  /** Breadcrumb link back to the index. */
  backToGames: 'All games',
  noscript: 'This game needs JavaScript. It runs entirely in your browser; nothing is sent anywhere.',
};

export type GamesHubMessages = typeof en;

const tr: GamesHubMessages = {
  meta: {
    title: 'Oyunlar',
    description:
      'Tarayıcıda Amiral Battı ve XOX oynayın. Bilgisayar rakipler hamlelerini olasılık yoğunluğu ve minimax aramasıyla seçer.',
  },
  eyebrow: 'Eğlence matematiği',
  title: 'Oyunlar',
  lead: 'Programlamayı öğrenirken C# ile geliştirdiğim iki klasik oyunu tarayıcı için yeniden yazdım. Her bilgisayar rakibin arkasında küçük bir algoritma var; iki sayfada da onun nasıl düşündüğünü izleyebilirsiniz.',
  figure: (n) => `Şekil ${n}`,
  play: 'Oyna',
  opponent: 'Rakip:',
  note: 'İki oyun da fareyle, dokunmatik ekranla ya da yalnızca klavyeyle oynanabilir ve her hamle ekran okuyuculara bildirilir. Oyunlar tamamen tarayıcınızda çalışır: hiçbir şey kaydedilmez ya da gönderilmez.',
  backToGames: 'Tüm oyunlar',
  noscript: 'Bu oyun JavaScript gerektirir. Tamamen tarayıcınızda çalışır; hiçbir yere veri gönderilmez.',
};

export const gamesHubMessages = { en, tr } as const satisfies Localized<GamesHubMessages>;
