/**
 * Battleship (Amiral Battı) interface text, used by the page, the component and the controller.
 *
 * Coordinates such as "C7" are locale-neutral and always interpolated whole. Turkish possessive
 * phrases ("Kruvazörümü batırdınız") depend on the ship's name, so each ship carries its own
 * complete sentences instead of a template with a suffix.
 */
import type { Localized } from '../config.ts';
import type { Difficulty } from '../../lib/games/battleship/ai.ts';
import type { Orientation, ShipId } from '../../lib/games/battleship/rules.ts';

interface ShipText {
  name: string;
  /** Said by the computer when the player sinks this ship. */
  youSankMine: string;
  /** When the computer sinks the player's ship. */
  yoursSunk: string;
}

const en = {
  meta: {
    title: 'Battleship',
    description:
      'Play Battleship against a computer that aims with a probability density map. Place your fleet, choose a difficulty and watch its heat map as it hunts.',
  },
  lead: 'Place your fleet, then take turns firing at the computer’s waters. On Hard it fires wherever the most possible ship positions overlap, and you can watch that probability density as it hunts.',
  /** Accessible name of the whole game region. */
  region: 'Battleship game',
  phases: { setup: 'Setup', battle: 'Battle', over: 'Game over' },
  ships: {
    carrier: { name: 'Carrier', youSankMine: 'You sank my Carrier.', yoursSunk: 'Your Carrier was sunk.' },
    battleship: { name: 'Battleship', youSankMine: 'You sank my Battleship.', yoursSunk: 'Your Battleship was sunk.' },
    cruiser: { name: 'Cruiser', youSankMine: 'You sank my Cruiser.', yoursSunk: 'Your Cruiser was sunk.' },
    submarine: { name: 'Submarine', youSankMine: 'You sank my Submarine.', yoursSunk: 'Your Submarine was sunk.' },
    destroyer: { name: 'Destroyer', youSankMine: 'You sank my Destroyer.', yoursSunk: 'Your Destroyer was sunk.' },
  } satisfies Record<ShipId, ShipText>,
  cells: (n: number) => `${n} cells`,
  boards: {
    own: 'Your waters',
    enemy: 'Enemy waters',
    help: {
      setup: 'Arrow keys move, Enter places the selected ship, R rotates it.',
      enemy: 'Arrow keys move, Enter fires.',
      own: 'Your fleet under fire. Arrow keys move between cells.',
    },
  },
  cell: {
    label: (coordinate: string, ...details: string[]) => [coordinate, ...details].join(', '),
    empty: 'empty',
    unknown: 'not fired yet',
    miss: 'miss',
    hit: 'hit',
    sunk: 'sunk',
  },
  setup: {
    difficulty: 'Difficulty',
    difficulties: { easy: 'Easy', normal: 'Normal', hard: 'Hard' } satisfies Record<Difficulty, string>,
    difficultyHints: {
      easy: 'Fires at random cells.',
      normal: 'Hunts on a chequerboard pattern, then closes in on every hit.',
      hard: 'Fires where the most possible ship positions overlap: a probability density.',
    } satisfies Record<Difficulty, string>,
    fleet: 'Your fleet',
    placed: 'Placed',
    notPlaced: 'Not placed',
    rotate: 'Rotate',
    orientations: { horizontal: 'Horizontal', vertical: 'Vertical' } satisfies Record<Orientation, string>,
    random: 'Random',
    clear: 'Clear',
    start: 'Start battle',
    rule: 'Ships run right or down from the cell you choose. They may touch, but not overlap.',
    startHint: 'Place all five ships to start.',
    ready: 'Fleet ready.',
  },
  status: {
    selected: (ship: string, orientation: Orientation) =>
      `${ship} selected. It runs ${orientation === 'horizontal' ? 'right' : 'down'} from the cell you choose.`,
    rotated: (orientation: Orientation): string =>
      orientation === 'horizontal' ? 'Horizontal: ships run right.' : 'Vertical: ships run down.',
    fits: (ship: string, from: string, to: string) => `${ship}, ${from} to ${to}: fits.`,
    offBoard: (ship: string, from: string) => `${ship} from ${from}: runs off the board.`,
    overlaps: (ship: string, from: string, others: string) => `${ship} from ${from}: overlaps the ${others}.`,
    placed: (ship: string, from: string, to: string) => `${ship} placed, ${from} to ${to}.`,
    /** The pointer or cursor is on another ship: activating the cell selects that ship. */
    pickUp: (ship: string) => `${ship}: select it to move it.`,
    allPlaced: 'All five ships are placed. Start the battle when you are ready, or select a ship to move it.',
    noShipSelected: 'All ships are placed. Select a ship on the board or in the list to move it.',
    randomized: 'Fleet placed at random.',
    cleared: 'Board cleared.',
    needFleet: 'Place all five ships first.',
    newGame: 'New game. Your fleet is where you left it: start the battle, or move ships first.',
  },
  battle: {
    newGame: 'New game',
    yourTurn: 'Your turn',
    computerTurn: 'The computer is aiming…',
    started: (difficulty: string) => `Battle started on ${difficulty}. You fire first.`,
    playerShot: {
      miss: (coordinate: string) => `${coordinate}: miss.`,
      hit: (coordinate: string) => `${coordinate}: hit.`,
      sunk: (coordinate: string, sentence: string) => `${coordinate}: hit. ${sentence}`,
    },
    computerShot: {
      miss: (coordinate: string) => `The computer fires at ${coordinate}: miss.`,
      hit: (coordinate: string) => `The computer fires at ${coordinate}: hit.`,
      sunk: (coordinate: string, sentence: string) => `The computer fires at ${coordinate}: hit. ${sentence}`,
    },
    repeat: (coordinate: string) => `${coordinate}: you have already fired there.`,
    wait: 'Wait for the computer’s shot.',
    log: 'Battle log',
    scoreboard: 'Scoreboard',
    you: 'You',
    computer: 'Computer',
    shots: 'Shots',
    hits: 'Hits',
    accuracy: 'Accuracy',
    afloat: 'Ships afloat',
    enemyFleet: 'Enemy fleet',
    ownFleet: 'Your fleet',
    shipAfloat: 'afloat',
    shipSunk: 'sunk',
    hitsTaken: (n: number) => `${n} ${n === 1 ? 'hit' : 'hits'}`,
  },
  heat: {
    toggle: 'Show AI heat map',
    caption:
      'The tint shows the computer’s probability density over your board: the stronger a cell’s green tint, the more possible ship positions cover it. On Hard, it fires at the most strongly tinted cell.',
    low: 'Low',
    high: 'High',
    peaks: (coordinates: string, count: number) =>
      `${count === 1 ? 'Most likely target' : 'Most likely targets'}: ${coordinates}`,
    more: (n: number) => `${n} more`,
  },
  guide: { howToPlay: 'How to play', aiming: 'How the computer aims', story: 'Behind the game' },
  result: {
    eyebrow: 'Game over',
    win: 'You win',
    loss: 'The computer wins',
    winSummary: (shots: number) => `You sank the whole enemy fleet in ${shots} shots.`,
    lossSummary: (shots: number) =>
      `The computer sank your fleet in ${shots} shots. Its remaining ships are now shown on the enemy board.`,
    replay: 'Play again',
    review: 'Review the boards',
  },
};

export type BattleshipMessages = typeof en;

const tr: BattleshipMessages = {
  meta: {
    title: 'Amiral Battı',
    description:
      'Olasılık yoğunluğu haritasıyla nişan alan bir bilgisayara karşı Amiral Battı oynayın. Filonuzu yerleştirin, zorluk seviyesini seçin ve bilgisayar gemilerinizi ararken ısı haritasını izleyin.',
  },
  lead: 'Filonuzu yerleştirin, sonra sıra size geldikçe bilgisayarın sularına ateş edin. Zor seviyede bilgisayar, olası gemi konumlarının en çok üst üste geldiği hücreye ateş eder. Bilgisayar gemilerinizi ararken bu olasılık yoğunluğunu siz de izleyebilirsiniz.',
  region: 'Amiral Battı oyunu',
  phases: { setup: 'Hazırlık', battle: 'Savaş', over: 'Oyun bitti' },
  ships: {
    carrier: { name: 'Uçak gemisi', youSankMine: 'Uçak gemimi batırdınız.', yoursSunk: 'Uçak geminiz battı.' },
    battleship: { name: 'Zırhlı', youSankMine: 'Zırhlımı batırdınız.', yoursSunk: 'Zırhlınız battı.' },
    cruiser: { name: 'Kruvazör', youSankMine: 'Kruvazörümü batırdınız.', yoursSunk: 'Kruvazörünüz battı.' },
    submarine: { name: 'Denizaltı', youSankMine: 'Denizaltımı batırdınız.', yoursSunk: 'Denizaltınız battı.' },
    destroyer: { name: 'Muhrip', youSankMine: 'Muhribimi batırdınız.', yoursSunk: 'Muhribiniz battı.' },
  },
  cells: (n) => `${n} hücre`,
  boards: {
    own: 'Kendi sularınız',
    enemy: 'Düşman suları',
    help: {
      setup: 'Ok tuşlarıyla gezinin, Enter ile seçili gemiyi yerleştirin, R ile döndürün.',
      enemy: 'Ok tuşlarıyla gezinin, Enter ile ateş edin.',
      own: 'Ateş altındaki filonuz. Ok tuşlarıyla hücreler arasında gezinin.',
    },
  },
  cell: {
    label: (coordinate, ...details) => [coordinate, ...details].join(', '),
    empty: 'boş',
    unknown: 'henüz ateş edilmedi',
    miss: 'ıska',
    hit: 'isabet',
    sunk: 'battı',
  },
  setup: {
    difficulty: 'Zorluk',
    difficulties: { easy: 'Kolay', normal: 'Normal', hard: 'Zor' },
    difficultyHints: {
      easy: 'Rastgele hücrelere ateş eder.',
      normal: 'Tahtayı dama deseniyle tarar, bir gemiyi vurunca da çevresini yoklar.',
      hard: 'Olası gemi konumlarının en çok üst üste geldiği hücreye, yani olasılık yoğunluğunun en yüksek olduğu yere ateş eder.',
    },
    fleet: 'Filonuz',
    placed: 'Yerleştirildi',
    notPlaced: 'Yerleştirilmedi',
    rotate: 'Döndür',
    orientations: { horizontal: 'Yatay', vertical: 'Dikey' },
    random: 'Rastgele',
    clear: 'Temizle',
    start: 'Savaşı başlat',
    rule: 'Gemiler seçtiğiniz hücreden sağa ya da aşağı doğru uzanır. Birbirine değebilir ama üst üste binemez.',
    startHint: 'Başlamak için beş geminin hepsini yerleştirin.',
    ready: 'Filo hazır.',
  },
  status: {
    selected: (ship, orientation) =>
      `${ship} seçildi. Seçeceğiniz hücreden ${orientation === 'horizontal' ? 'sağa' : 'aşağı'} doğru uzanacak.`,
    rotated: (orientation) =>
      orientation === 'horizontal' ? 'Yatay: gemiler sağa doğru uzanır.' : 'Dikey: gemiler aşağı doğru uzanır.',
    fits: (ship, from, to) => `${ship}, ${from}–${to}: sığıyor.`,
    offBoard: (ship, from) => `${ship}, ${from} hücresinden başlarsa tahtanın dışına taşar.`,
    overlaps: (ship, from, others) => `${ship}, ${from} hücresinden başlarsa ${others} ile çakışır.`,
    placed: (ship, from, to) => `${ship} yerleştirildi: ${from}–${to}.`,
    pickUp: (ship) => `${ship}: taşımak için seçin.`,
    allPlaced:
      'Beş geminin hepsi yerleştirildi. Hazır olduğunuzda savaşı başlatın ya da taşımak istediğiniz gemiyi seçin.',
    noShipSelected: 'Tüm gemiler yerleştirildi. Taşımak için tahtada ya da listede bir gemi seçin.',
    randomized: 'Filo rastgele yerleştirildi.',
    cleared: 'Tahta temizlendi.',
    needFleet: 'Önce beş geminin hepsini yerleştirin.',
    newGame: 'Yeni oyun. Gemileriniz bıraktığınız yerde duruyor. Savaşı başlatabilir ya da önce gemilerin yerini değiştirebilirsiniz.',
  },
  battle: {
    newGame: 'Yeni oyun',
    yourTurn: 'Sıra sizde',
    computerTurn: 'Bilgisayar nişan alıyor…',
    started: (difficulty) => `Savaş başladı. Zorluk: ${difficulty}. İlk atış sizde.`,
    playerShot: {
      miss: (coordinate) => `${coordinate}: ıska.`,
      hit: (coordinate) => `${coordinate}: isabet.`,
      sunk: (coordinate, sentence) => `${coordinate}: isabet. ${sentence}`,
    },
    computerShot: {
      miss: (coordinate) => `Bilgisayarın atışı: ${coordinate}, ıska.`,
      hit: (coordinate) => `Bilgisayarın atışı: ${coordinate}, isabet.`,
      sunk: (coordinate, sentence) => `Bilgisayarın atışı: ${coordinate}, isabet. ${sentence}`,
    },
    repeat: (coordinate) => `${coordinate}: bu hücreye zaten ateş ettiniz.`,
    wait: 'Bilgisayarın atışını bekleyin.',
    log: 'Savaş günlüğü',
    scoreboard: 'Skor tablosu',
    you: 'Siz',
    computer: 'Bilgisayar',
    shots: 'Atış',
    hits: 'İsabet',
    accuracy: 'İsabet oranı',
    afloat: 'Yüzen gemi',
    enemyFleet: 'Düşman filosu',
    ownFleet: 'Filonuz',
    shipAfloat: 'yüzüyor',
    shipSunk: 'battı',
    hitsTaken: (n) => `${n} isabet`,
  },
  heat: {
    toggle: 'Bilgisayarın ısı haritasını göster',
    caption:
      'Renkler, bilgisayarın sizin tahtanız için hesapladığı olasılık yoğunluğunu gösterir. Bir hücrenin yeşili ne kadar belirginse o hücreden geçen olası gemi konumu o kadar çoktur. Zor seviyede bilgisayar, yeşilin en belirgin olduğu hücreye ateş eder.',
    low: 'Düşük',
    high: 'Yüksek',
    peaks: (coordinates, count) => `${count === 1 ? 'En olası hedef' : 'En olası hedefler'}: ${coordinates}`,
    more: (n) => `${n} hücre daha`,
  },
  guide: { howToPlay: 'Nasıl oynanır', aiming: 'Bilgisayar nasıl nişan alır', story: 'Oyunun hikâyesi' },
  result: {
    eyebrow: 'Oyun bitti',
    win: 'Kazandınız',
    loss: 'Bilgisayar kazandı',
    winSummary: (shots) => `Düşman filosunun tamamını ${shots} atışta batırdınız.`,
    lossSummary: (shots) =>
      `Bilgisayar filonuzu ${shots} atışta batırdı. Batmayan düşman gemileri artık düşman tahtasında görünüyor.`,
    replay: 'Yeniden oyna',
    review: 'Tahtalara göz at',
  },
};

export const battleshipMessages = { en, tr } as const satisfies Localized<BattleshipMessages>;
