/**
 * Text inside the figures and the density lab of the Battleship post, in both languages. The
 * prose and the captions live in the two MDX files; this is what the components draw or announce:
 * labels, accessible descriptions, legends, table headings and the lab's interface.
 *
 * Figures follow the post's language (a `lang` prop), not the interface language: they are part of
 * the article. Coordinates such as "E5" are locale-neutral and always interpolated whole, so no
 * Turkish case suffix is ever attached to them. Multi-line diagram labels are arrays of lines.
 */
import type { Localized } from '../../../../i18n/config.ts';
import type { ShipId } from '../../../../lib/games/battleship/rules.ts';
import type { Strategy } from './model.ts';

const en = {
  /** What the shooter knows about a cell (as the game's own boards say it). */
  cellState: { unknown: 'not fired at', miss: 'miss', hit: 'hit', sunk: 'sunk' },
  ships: {
    carrier: 'Carrier',
    battleship: 'Battleship',
    cruiser: 'Cruiser',
    submarine: 'Submarine',
    destroyer: 'Destroyer',
  } satisfies Record<ShipId, string>,
  legend: {
    heat: 'Density',
    low: 'Low',
    high: 'High',
    miss: 'Miss',
    hit: 'Hit',
    shotMiss: 'Miss, numbered in order',
    shotHit: 'Hit, numbered in order',
    peak: 'Highest density',
    sunk: 'Sunk ship',
    ghost: 'A destroyer that slips through',
    lattice: 'Pattern cell',
    highlight: 'Pattern cell the ship covers',
    latest: 'Latest shot',
    hidden: 'Ship afloat',
    huntShots: 'Hunt shots',
    targetShots: 'Target shots',
  },
  fleet: {
    ship: 'Ship',
    length: 'Cells',
    positions: 'Positions',
    total: 'Fleet',
    cellsCount: (n: number) => `, ${n} cells`,
  },
  initial: {
    aria: (min: string, max: string, peaks: string) =>
      `A 10 by 10 board showing the density of every cell before the first shot. It is ${min} in the corners and rises towards the centre, to ${max} at ${peaks}.`,
  },
  target: {
    shot: 'Shot',
    cell: 'Cell',
    result: 'Result',
    next: 'Then',
    sunk: 'hit, sunk',
    aria: (steps: string) => `A part of the board, B3 to H7, with the Normal computer’s shots in order: ${steps}.`,
    step: (n: number, cell: string, result: string) => `${n}: ${cell}, ${result}`,
  },
  parity: {
    /** Follows "m = 2 · " in the panel title. */
    cells: (n: number) => `${n} cells`,
    aria: (m2: number, m3: number) =>
      `Two boards. Left: the ${m2} cells whose row and column add up to an even number, a chequerboard; a destroyer at H2 to H3 covers one of them, H2. Right: the ${m3} cells whose row and column add up to a multiple of 3, on diagonals; a cruiser at B7 to D7 covers one of them, D7, while a destroyer at G2 to H2 covers none.`,
  },
  hunt: {
    aria: (shots: number, cells: string, peaks: string) =>
      `The Hard computer after ${shots} shots, all misses, at ${cells}, with its density for the next shot. No two misses are side by side, and the density is highest at ${peaks}, in the corner the misses have not reached.`,
  },
  hits: {
    one: 'One hit',
    two: 'Two hits in a line',
    aria: (one: string, oneValue: string, two: string, twoValue: string) =>
      `Two boards. After one hit at E5, the density is highest at the neighbours ${one}, with ${oneValue}. After a second hit at F5, it is highest at the two ends of the line, ${two}, with ${twoValue}.`,
  },
  machine: {
    aria: 'A state diagram. The computer starts in Hunt, which it keeps after a miss and leaves for Target after a hit. Target and Line form the Targeting state. Target stays after a miss and moves to Line when a second hit lines up; Line stays while it extends the run and goes back to Target when both ends are blocked. When a ship sinks, the Sunk step marks its cells and removes it from the fleet, then returns to Targeting if hits are left over, and to Hunt if none are.',
    targeting: 'Targeting',
    hunt: { title: 'Hunt', lines: ['fire on the', 'search pattern'] },
    target: { title: 'Target', lines: ['try the neighbours', 'of the open hits'] },
    line: { title: 'Line', lines: ['extend the run', 'at either end'] },
    sunk: { title: 'Sunk', lines: ['mark its cells, drop', 'it from the fleet'] },
    edges: {
      miss: 'miss',
      hit: 'hit',
      inLine: ['second hit', 'in line'],
      blocked: ['both ends', 'blocked'],
      extend: ['hit, or miss', 'at one end'],
      sunk: 'sunk',
      hitsLeft: 'hits left',
      noHits: ['no hits', 'left'],
    },
  },
  chart: {
    xAxis: 'Shots fired',
    yAxis: 'Games over',
    theory: 'Random fire, exact',
    aria: (lines: string) =>
      `A chart of the share of games over within a given number of shots, one curve per strategy. ${lines}`,
    line: (name: string, median: number, p90: number) =>
      `${name}: half the games are over by shot ${median}, nine in ten by shot ${p90}.`,
  },
  strategy: {
    random: 'Random (Easy)',
    'no-parity': 'Hunt & target without parity',
    parity: 'Hunt & target (Normal)',
    density: 'Probability density (Hard)',
  } satisfies Record<Strategy, string>,
  table: {
    caption: (games: string) => `Shots needed to sink the whole fleet, ${games} games per strategy`,
    strategy: 'Strategy',
    mean: 'Mean',
    median: 'Median',
    range: 'Middle 80%',
    best: 'Best',
    worst: 'Worst',
    rangeValue: (low: number, high: number) => `${low}–${high}`,
  },
  lab: {
    region: 'Density lab',
    tool: 'Mark cells as',
    tools: { miss: 'Miss', hit: 'Hit', sunk: 'Sunk', clear: 'Clear' },
    fleet: 'Ships afloat',
    reset: 'Reset the board',
    grid: 'Density lab board',
    help: 'Click or tap a cell to mark it; with the keyboard, move with the arrow keys and press Enter or Space. Marking a cell again with the same tool clears it. When a ship sinks, mark its cells as sunk and untick it.',
    cell: (coordinate: string, state: string, value: string, peak: boolean) =>
      `${coordinate}, ${state}${value ? `, density ${value}` : ''}${peak ? ', highest' : ''}`,
    best: 'Hard fires at',
    bestValue: (cells: string, value: string) => `${cells} · d = ${value}`,
    /** Every ship is unticked. */
    none: 'No ship left to find.',
    /** Ships are ticked, but the marked board leaves no room for any of them. */
    noRoom: 'No position fits the ships afloat.',
    inspect: 'Cell',
    inspectValue: (coordinate: string, value: string) => `${coordinate} · d = ${value}`,
    inspectFired: (coordinate: string, state: string) => `${coordinate} · ${state}`,
    weight: 'Weight of a hit',
    announce: (coordinate: string, state: string, cells: string, value: string) =>
      `${coordinate}: ${state}. Hard fires at ${cells}, density ${value}.`,
    /** `reason` is `none` or `noRoom`. */
    announceNone: (coordinate: string, state: string, reason: string) => `${coordinate}: ${state}. ${reason}`,
    announceFleet: (cells: string, value: string) => `Fleet changed. Hard fires at ${cells}, density ${value}.`,
    announceFleetNone: (reason: string) => `Fleet changed. ${reason}`,
    announceReset: 'Board reset.',
    more: (n: number) => `${n} more`,
  },
  /** The parity replay (ParityReplay.astro, parity-replay.ts). */
  replay: {
    /** Legend of the switch between the two games. */
    mode: 'Hunting',
    games: { parity: 'With parity', 'no-parity': 'Without parity' },
    /** The same, inside a sentence. */
    gamesInline: { parity: 'with parity', 'no-parity': 'without parity' },
    controls: 'Replay controls',
    first: 'Back to the start',
    previous: 'Previous shot',
    play: 'Play',
    pause: 'Pause',
    next: 'Next shot',
    last: 'Go to the end',
    slider: 'Shot',
    readout: {
      shot: 'Shot',
      shotValue: (shot: number, total: number) => `${shot} of ${total}`,
      last: 'Latest shot',
      none: 'None yet',
      kind: 'Shot type',
      lattice: 'Search pattern',
      /** Without parity: the computer hunts on every cell. */
      noLattice: 'None (any cell)',
      huntShots: 'Hunt shots',
      targetShots: 'Target shots',
      sunk: 'Ships sunk',
      sunkValue: (sunk: number, total: number) => `${sunk} of ${total}`,
    },
    kind: { hunt: 'Hunt shot', target: 'Target shot' },
    /** The same, inside a sentence. */
    kindInline: { hunt: 'hunt shot', target: 'target shot' },
    result: { miss: 'miss', hit: 'hit', sunk: (ship: string) => `${ship} sunk` },
    lastValue: (cell: string, result: string) => `${cell} · ${result}`,
    /** The board's accessible description, sentence by sentence; `aria` puts them together. */
    board: {
      state: (seed: number, game: string, shot: number, total: number) =>
        shot === 0
          ? `Game ${seed}, ${game}: the board before the first shot (${total} in all). `
          : `Game ${seed}, ${game}: the board after shot ${shot} of ${total}. `,
      lattice: (m: number, cells: number) => `The shaded cells are the search pattern for m = ${m}: ${cells} cells. `,
      noLattice: 'There is no pattern: the computer hunts at random. ',
      last: (shot: number, cell: string, result: string, kind: string) => `Shot ${shot}, ${cell}: ${result} (${kind}). `,
      counts: (hunt: number, target: number, sunk: string) =>
        `So far ${hunt} ${hunt === 1 ? 'hunt shot' : 'hunt shots'} and ${target} ${target === 1 ? 'target shot' : 'target shots'}; ships sunk: ${sunk}. `,
      noneSunk: 'none',
      fleet: (ships: string) => `Where the ships are: ${ships}.`,
      ship: (name: string, from: string, to: string) => `${name} ${from} to ${to}`,
    },
    announce: {
      step: (shot: number, total: number, cell: string, result: string, kind: string) =>
        `Shot ${shot} of ${total}: ${cell}, ${result}, ${kind}.`,
      start: 'Before the first shot.',
      latticeNow: (m: number) => ` The pattern is now m = ${m}.`,
      paused: (step: string) => `Paused. ${step}`,
      ended: (total: number, hunt: number, target: number) =>
        `Game over after ${total} shots: ${hunt} hunt shots and ${target} target shots.`,
    },
    chart: {
      title: 'Shots in this game',
      aria: (rows: string) => `A bar chart of the shots this game took to sink the fleet. ${rows}`,
      row: (game: string, total: number, hunt: number, target: number) =>
        `${game}: ${total} shots, ${hunt} hunt shots and ${target} target shots.`,
    },
  },
};

export type BattleshipPostMessages = typeof en;

const tr: BattleshipPostMessages = {
  cellState: { unknown: 'atış yapılmadı', miss: 'ıska', hit: 'isabet', sunk: 'battı' },
  ships: {
    carrier: 'Uçak gemisi',
    battleship: 'Zırhlı',
    cruiser: 'Kruvazör',
    submarine: 'Denizaltı',
    destroyer: 'Muhrip',
  },
  legend: {
    heat: 'Yoğunluk',
    low: 'Düşük',
    high: 'Yüksek',
    miss: 'Iska',
    hit: 'İsabet',
    shotMiss: 'Iska, atış sırasıyla',
    shotHit: 'İsabet, atış sırasıyla',
    peak: 'En yüksek yoğunluk',
    sunk: 'Batmış gemi',
    ghost: 'Aradan sıyrılan muhrip',
    lattice: 'Desen hücresi',
    highlight: 'Geminin kapsadığı desen hücresi',
    latest: 'Son atış',
    hidden: 'Batmamış gemi',
    huntShots: 'Av atışları',
    targetShots: 'Hedef atışları',
  },
  fleet: {
    ship: 'Gemi',
    length: 'Hücre',
    positions: 'Konum',
    total: 'Filo',
    cellsCount: (n) => `, ${n} hücre`,
  },
  initial: {
    aria: (min, max, peaks) =>
      `İlk atıştan önce her hücrenin yoğunluğunu gösteren 10×10 tahta. Değer köşelerde ${min}; merkeze doğru artıyor ve ${peaks} hücrelerinde ${max} oluyor.`,
  },
  target: {
    shot: 'Atış',
    cell: 'Hücre',
    result: 'Sonuç',
    next: 'Sonra',
    sunk: 'isabet, battı',
    aria: (steps) => `Tahtanın B3–H7 arasındaki bölümü ve Normal seviyenin sırasıyla yaptığı atışlar: ${steps}.`,
    step: (n, cell, result) => `${n}. atış: ${cell}, ${result}`,
  },
  parity: {
    cells: (n) => `${n} hücre`,
    aria: (m2, m3) =>
      `İki tahta. Solda satır ve sütun numaralarının toplamı çift olan ${m2} hücre, yani bir dama tahtası; H2–H3 arasındaki muhrip bunlardan birini, H2 hücresini kapsıyor. Sağda toplamı 3’ün katı olan ${m3} hücre, çapraz çizgiler üzerinde; B7–D7 arasındaki kruvazör bunlardan birini, D7 hücresini kapsıyor, G2–H2 arasındaki muhrip ise hiçbirini kapsamıyor.`,
  },
  hunt: {
    aria: (shots, cells, peaks) =>
      `Zor seviye ${shots} atıştan sonra; atışların hepsi ıska: ${cells}. Bir sonraki atış için yoğunluk da gösteriliyor. Hiçbir ıska bir başkasının yanında değil; yoğunluk en yüksek değerine ıskaların henüz ulaşmadığı köşede, ${peaks} hücrelerinde ulaşıyor.`,
  },
  hits: {
    one: 'Tek isabet',
    two: 'Aynı hizada iki isabet',
    aria: (one, oneValue, two, twoValue) =>
      `İki tahta. E5’teki tek isabetten sonra yoğunluk en çok komşu hücrelerde yükseliyor: ${one}, değer ${oneValue}. F5’teki ikinci isabetten sonra en yüksek değer çizginin iki ucunda: ${two}, değer ${twoValue}.`,
  },
  machine: {
    aria: 'Bir durum diyagramı. Bilgisayar Av durumunda başlar; ıskada bu durumda kalır, isabette Hedef durumuna geçer. Hedef ve Çizgi birlikte Hedefleme durumunu oluşturur. Hedef, ıskada aynı durumda kalır, ikinci isabet aynı hizaya gelince Çizgi durumuna geçer; Çizgi, isabet dizisini uzattıkça aynı durumda kalır, iki ucu da kapanınca Hedef durumuna döner. Bir gemi batınca Battı adımı geminin hücrelerini işaretler ve gemiyi filodan çıkarır; açıkta isabet kaldıysa Hedefleme durumuna, kalmadıysa Av durumuna döner.',
    targeting: 'Hedefleme',
    hunt: { title: 'Av', lines: ['tarama deseni', 'üzerine ateş et'] },
    target: { title: 'Hedef', lines: ['açık isabetlerin', 'komşularını dene'] },
    line: { title: 'Çizgi', lines: ['isabet dizisini', 'uçlarından uzat'] },
    sunk: { title: 'Battı', lines: ['hücrelerini işaretle,', 'gemiyi filodan çıkar'] },
    edges: {
      miss: 'ıska',
      hit: 'isabet',
      inLine: ['hizada ikinci', 'isabet'],
      blocked: ['iki uç da', 'kapalı'],
      extend: ['isabet ya da', 'bir uçta ıska'],
      sunk: 'battı',
      hitsLeft: 'isabet kaldı',
      noHits: ['isabet', 'kalmadı'],
    },
  },
  chart: {
    xAxis: 'Atış sayısı',
    yAxis: 'Biten oyunlar',
    theory: 'Rastgele atış, kesin',
    aria: (lines) =>
      `Belirli bir atış sayısına kadar biten oyunların oranını gösteren grafik; her strateji için bir eğri. ${lines}`,
    line: (name, median, p90) => `${name}: oyunların yarısı ${median}. atışa, onda dokuzu ${p90}. atışa kadar bitiyor.`,
  },
  strategy: {
    random: 'Rastgele (Kolay)',
    'no-parity': 'Desensiz av ve hedef',
    parity: 'Av ve hedef (Normal)',
    density: 'Olasılık yoğunluğu (Zor)',
  },
  table: {
    caption: (games) => `Tüm filoyu batırmak için gereken atış sayısı; strateji başına ${games} oyun`,
    strategy: 'Strateji',
    mean: 'Ortalama',
    median: 'Medyan',
    range: 'Ortadaki %80',
    best: 'En iyi',
    worst: 'En kötü',
    rangeValue: (low, high) => `${low}–${high}`,
  },
  lab: {
    region: 'Yoğunluk laboratuvarı',
    tool: 'İşaretleme aracı',
    tools: { miss: 'Iska', hit: 'İsabet', sunk: 'Battı', clear: 'Sil' },
    fleet: 'Su üstündeki gemiler',
    reset: 'Tahtayı sıfırla',
    grid: 'Yoğunluk laboratuvarı tahtası',
    help: 'İşaretlemek için bir hücreye tıklayın ya da dokunun; klavyede ok tuşlarıyla gezinip Enter ya da Boşluk tuşuna basın. Aynı araçla yeniden işaretlemek hücreyi temizler. Bir gemi batınca hücrelerini “Battı” olarak işaretleyin ve gemiyi listeden kaldırın.',
    cell: (coordinate, state, value, peak) =>
      `${coordinate}, ${state}${value ? `, yoğunluk ${value}` : ''}${peak ? ', en yüksek' : ''}`,
    best: 'Zor seviyenin hedefi',
    bestValue: (cells, value) => `${cells} · d = ${value}`,
    none: 'Bulunacak gemi kalmadı.',
    noRoom: 'Su üstündeki gemilerin sığabileceği bir konum kalmadı.',
    inspect: 'Hücre',
    inspectValue: (coordinate, value) => `${coordinate} · d = ${value}`,
    inspectFired: (coordinate, state) => `${coordinate} · ${state}`,
    weight: 'Bir isabetin ağırlığı',
    announce: (coordinate, state, cells, value) =>
      `${coordinate}: ${state}. Zor seviyenin hedefi: ${cells}; yoğunluk ${value}.`,
    announceNone: (coordinate, state, reason) => `${coordinate}: ${state}. ${reason}`,
    announceFleet: (cells, value) => `Filo değişti. Zor seviyenin hedefi: ${cells}; yoğunluk ${value}.`,
    announceFleetNone: (reason) => `Filo değişti. ${reason}`,
    announceReset: 'Tahta sıfırlandı.',
    more: (n) => `${n} hücre daha`,
  },
  replay: {
    mode: 'Av biçimi',
    games: { parity: 'Desen açık', 'no-parity': 'Desen kapalı' },
    gamesInline: { parity: 'desen açık', 'no-parity': 'desen kapalı' },
    controls: 'Oynatma düğmeleri',
    first: 'Başa dön',
    previous: 'Önceki atış',
    play: 'Oynat',
    pause: 'Duraklat',
    next: 'Sonraki atış',
    last: 'Sona git',
    slider: 'Atış',
    readout: {
      shot: 'Atış',
      shotValue: (shot, total) => `${shot} / ${total}`,
      last: 'Son atış',
      none: 'Henüz yok',
      kind: 'Atış türü',
      lattice: 'Tarama deseni',
      noLattice: 'Yok (bütün tahta)',
      huntShots: 'Av atışları',
      targetShots: 'Hedef atışları',
      sunk: 'Batan gemiler',
      sunkValue: (sunk, total) => `${sunk} / ${total}`,
    },
    kind: { hunt: 'Av atışı', target: 'Hedef atışı' },
    kindInline: { hunt: 'av atışı', target: 'hedef atışı' },
    result: { miss: 'ıska', hit: 'isabet', sunk: (ship) => `${ship} battı` },
    lastValue: (cell, result) => `${cell} · ${result}`,
    board: {
      state: (seed, game, shot, total) =>
        shot === 0
          ? `${seed} numaralı oyun, ${game}: tahtanın ilk atıştan önceki hâli (toplam ${total} atış). `
          : `${seed} numaralı oyun, ${game}: tahtanın ${shot}. atıştan sonraki hâli (toplam ${total} atış). `,
      lattice: (m, cells) => `Gölgeli hücreler, m = ${m} için tarama deseni: ${cells} hücre. `,
      noLattice: 'Desen yok: bilgisayar av atışlarını rastgele yapıyor. ',
      last: (shot, cell, result, kind) => `${shot}. atış, ${cell}: ${result} (${kind}). `,
      counts: (hunt, target, sunk) => `Şimdiye kadar ${hunt} av atışı ve ${target} hedef atışı; batan gemiler: ${sunk}. `,
      noneSunk: 'yok',
      fleet: (ships) => `Gemilerin yerleri: ${ships}.`,
      ship: (name, from, to) => `${name} ${from}–${to}`,
    },
    announce: {
      step: (shot, total, cell, result, kind) => `${shot}. atış (toplam ${total}): ${cell}, ${result}; ${kind}.`,
      start: 'İlk atıştan önce.',
      latticeNow: (m) => ` Desen artık m = ${m}.`,
      paused: (step) => `Duraklatıldı. ${step}`,
      ended: (total, hunt, target) => `Oyun ${total} atışta bitti: ${hunt} av atışı ve ${target} hedef atışı.`,
    },
    chart: {
      title: 'Bu oyundaki atışlar',
      aria: (rows) => `Bu oyunda filoyu batırmak için gereken atışları gösteren çubuk grafik. ${rows}`,
      row: (game, total, hunt, target) => `${game}: ${total} atış; ${hunt} av atışı, ${target} hedef atışı.`,
    },
  },
};

export const battleshipPostMessages = { en, tr } as const satisfies Localized<BattleshipPostMessages>;
