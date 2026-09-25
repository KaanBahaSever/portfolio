/**
 * Tic-tac-toe (XOX) interface text, used by the page, the component and the controller.
 *
 * Squares are named by position ("top left"), in two forms: capitalised to start a button label,
 * lower case inside a sentence. Marks (X, O) are interpolated as standalone words.
 */
import type { Localized } from '../config.ts';
import type { Difficulty } from '../../lib/games/tictactoe/ai.ts';
import type { KeypadLayout } from '../../lib/games/tictactoe/board.ts';

type Nine = readonly [string, string, string, string, string, string, string, string, string];
type Eight = readonly [string, string, string, string, string, string, string, string];

const en = {
  meta: {
    title: 'Tic-tac-toe',
    description:
      'Tic-tac-toe against a minimax opponent with alpha–beta pruning, or against a friend on the same device. Turn on the evaluation to see the score of every square.',
  },
  lead: 'Three in a row wins. The computer searches the game tree with minimax and alpha–beta pruning; on Unbeatable, a draw is the best you can do. Turn on the evaluation to see how it scores every square.',
  region: 'Tic-tac-toe game',
  board: 'Tic-tac-toe board',
  boardHelp: 'Arrow keys move, Enter or Space plays. Number keys 1 to 9 play a square directly.',
  squares: ['Top left', 'Top middle', 'Top right', 'Middle left', 'Centre', 'Middle right', 'Bottom left', 'Bottom middle', 'Bottom right'] as Nine,
  squaresInline: ['top left', 'top middle', 'top right', 'middle left', 'centre', 'middle right', 'bottom left', 'bottom middle', 'bottom right'] as Nine,
  lines: ['top row', 'middle row', 'bottom row', 'left column', 'middle column', 'right column', 'diagonal from top left', 'diagonal from top right'] as Eight,
  empty: 'empty',
  squareLabel: (square: string, ...details: string[]) => [square, ...details].join(', '),
  settings: 'Settings',
  opponent: 'Opponent',
  opponents: { computer: 'Computer', human: 'Two players' },
  difficulty: 'Difficulty',
  difficulties: { easy: 'Easy', medium: 'Medium', unbeatable: 'Unbeatable' } satisfies Record<Difficulty, string>,
  difficultyHints: {
    easy: 'Plays any free square.',
    medium: 'Looks two moves ahead: it takes a win and blocks yours, but walks into forks.',
    unbeatable: 'Searches every line of play to the end. It never loses.',
  } satisfies Record<Difficulty, string>,
  yourMark: 'You play',
  firstMove: 'First move',
  starters: { human: 'You', computer: 'Computer' },
  keypad: 'Number keys',
  keypads: { phone: '1 is top left', numpad: '7 is top left' } satisfies Record<KeypadLayout, string>,
  keypadHints: {
    phone: 'Phone order: 1 2 3 along the top row.',
    numpad: 'Numeric keypad order: 7 8 9 along the top row.',
  } satisfies Record<KeypadLayout, string>,
  showEvaluation: 'Show evaluation',
  evaluationHint:
    'Each empty square shows its minimax score for the player to move, if both sides play perfectly from then on: +9 wins at once, smaller positive scores win later, 0 is a draw, negative scores lose.',
  evaluationFor: (mark: string) => `Scores for ${mark}`,
  evaluation: (score: string, result: 'win' | 'draw' | 'loss') =>
    `score ${score}, ${result === 'win' ? 'winning' : result === 'loss' ? 'losing' : 'draw'}`,
  newRound: 'New round',
  resetScore: 'Reset score',
  score: 'Score',
  scoreLabels: { you: 'You', computer: 'Computer', draws: 'Draws' },
  status: {
    yourTurn: 'Your turn',
    computerTurn: 'The computer is thinking…',
    toMove: (mark: string) => `${mark} to move`,
    youWin: 'You win',
    computerWins: 'The computer wins',
    markWins: (mark: string) => `${mark} wins`,
    draw: 'Draw',
    youAre: (mark: string) => `You are ${mark}`,
  },
  guide: { howToPlay: 'How to play', thinking: 'How the computer thinks' },
  announce: {
    move: (mark: string, square: string) => `${mark}: ${square}.`,
    computerMove: (mark: string, square: string) => `The computer plays ${mark}: ${square}.`,
    yourTurn: 'Your turn.',
    toMove: (mark: string) => `${mark} to move.`,
    youWin: (line: string) => `You win: ${line}.`,
    computerWins: (line: string) => `The computer wins: ${line}.`,
    markWins: (mark: string, line: string) => `${mark} wins: ${line}.`,
    draw: 'Draw.',
    newRound: 'New round.',
    computerFirst: 'The computer moves first.',
    taken: (square: string) => `${square} is taken.`,
    wait: 'Wait for the computer’s move.',
    roundOver: 'This round is over. Start a new round to play again.',
    scoreReset: 'Score reset.',
  },
};

export type TicTacToeMessages = typeof en;

const tr: TicTacToeMessages = {
  meta: {
    title: 'XOX',
    description:
      'Alfa–beta budamalı minimax ile oynayan bir rakibe ya da aynı cihazda bir arkadaşınıza karşı XOX. Değerlendirmeyi açarak her karenin puanını görün.',
  },
  lead: 'Üç işareti yan yana, alt alta ya da çapraz dizen kazanır. Bilgisayar oyun ağacını minimax ve alfa–beta budamayla tarar; Yenilmez seviyede alabileceğiniz en iyi sonuç beraberliktir. Değerlendirmeyi açarak her kareyi nasıl puanladığını görün.',
  region: 'XOX oyunu',
  board: 'XOX tahtası',
  boardHelp: 'Ok tuşlarıyla gezinin, Enter ya da Boşluk ile oynayın. 1–9 rakam tuşları doğrudan bir kareye oynar.',
  squares: ['Sol üst', 'Üst orta', 'Sağ üst', 'Sol orta', 'Orta', 'Sağ orta', 'Sol alt', 'Alt orta', 'Sağ alt'],
  squaresInline: ['sol üst', 'üst orta', 'sağ üst', 'sol orta', 'orta', 'sağ orta', 'sol alt', 'alt orta', 'sağ alt'],
  lines: [
    'üst satır',
    'orta satır',
    'alt satır',
    'sol sütun',
    'orta sütun',
    'sağ sütun',
    'sol üstten sağ alta çapraz',
    'sağ üstten sol alta çapraz',
  ],
  empty: 'boş',
  squareLabel: (square, ...details) => [square, ...details].join(', '),
  settings: 'Ayarlar',
  opponent: 'Rakip',
  opponents: { computer: 'Bilgisayar', human: 'İki oyuncu' },
  difficulty: 'Zorluk',
  difficulties: { easy: 'Kolay', medium: 'Orta', unbeatable: 'Yenilmez' },
  difficultyHints: {
    easy: 'Boş karelerden herhangi birine oynar.',
    medium: 'İki hamle ileriyi görür: kazanabiliyorsa kazanır, sizin kazanmanızı engeller ama çatal tuzaklarını görmez.',
    unbeatable: 'Her olası oyunu sonuna kadar tarar. Asla kaybetmez.',
  },
  yourMark: 'İşaretiniz',
  firstMove: 'İlk hamle',
  starters: { human: 'Siz', computer: 'Bilgisayar' },
  keypad: 'Rakam tuşları',
  keypads: { phone: '1 sol üstte', numpad: '7 sol üstte' },
  keypadHints: {
    phone: 'Telefon düzeni: üst sırada 1 2 3.',
    numpad: 'Sayısal tuş takımı düzeni: üst sırada 7 8 9.',
  },
  showEvaluation: 'Değerlendirmeyi göster',
  evaluationHint:
    'Her boş kare, o andan sonra iki taraf da kusursuz oynarsa sıradaki oyuncunun alacağı minimax puanını gösterir: +9 hemen kazanır, daha küçük artı puanlar daha geç kazanır, 0 beraberliktir, eksi puanlar kaybeder.',
  evaluationFor: (mark) => `Puanlar: ${mark} için`,
  evaluation: (score, result) =>
    `puan ${score}, ${result === 'win' ? 'kazandırır' : result === 'loss' ? 'kaybettirir' : 'beraberlik'}`,
  newRound: 'Yeni tur',
  resetScore: 'Skoru sıfırla',
  score: 'Skor',
  scoreLabels: { you: 'Siz', computer: 'Bilgisayar', draws: 'Beraberlik' },
  status: {
    yourTurn: 'Sıra sizde',
    computerTurn: 'Bilgisayar düşünüyor…',
    toMove: (mark) => `Sıra: ${mark}`,
    youWin: 'Kazandınız',
    computerWins: 'Bilgisayar kazandı',
    markWins: (mark) => `${mark} kazandı`,
    draw: 'Berabere',
    youAre: (mark) => `İşaretiniz: ${mark}`,
  },
  guide: { howToPlay: 'Nasıl oynanır', thinking: 'Bilgisayar nasıl düşünür' },
  announce: {
    move: (mark, square) => `${mark}: ${square}.`,
    computerMove: (mark, square) => `Bilgisayar ${mark} oynadı: ${square}.`,
    yourTurn: 'Sıra sizde.',
    toMove: (mark) => `Sıra: ${mark}.`,
    youWin: (line) => `Kazandınız: ${line}.`,
    computerWins: (line) => `Bilgisayar kazandı: ${line}.`,
    markWins: (mark, line) => `${mark} kazandı: ${line}.`,
    draw: 'Berabere.',
    newRound: 'Yeni tur.',
    computerFirst: 'İlk hamle bilgisayarda.',
    taken: (square) => `${square} dolu.`,
    wait: 'Bilgisayarın hamlesini bekleyin.',
    roundOver: 'Bu tur bitti. Yeniden oynamak için yeni bir tur başlatın.',
    scoreReset: 'Skor sıfırlandı.',
  },
};

export const ticTacToeMessages = { en, tr } as const satisfies Localized<TicTacToeMessages>;
