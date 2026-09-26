/**
 * Interface text of the Integer & prime factorizer (page, component and client controller).
 * Tips with inline markup are written per locale in the page.
 *
 * Big numbers arrive pre-formatted as strings (digits grouped with the locale's thousands
 * separator: "6,700,417" / "6.700.417"); small counts arrive as numbers and are formatted here.
 * Turkish sentences are built so that no interpolated value needs a case suffix.
 */
import type { Localized } from '../config.ts';
import { formatters } from '../format.ts';
import type { Abundance } from '../../lib/math/arithmetic.ts';

const enNumber = (value: number) => formatters('en').number(value);
const trNumber = (value: number) => formatters('tr').number(value);
const enPlural = (count: number, one: string, many: string) => `${enNumber(count)} ${count === 1 ? one : many}`;

const en = {
  meta: {
    title: 'Integer & prime factorizer',
    description:
      'Factor whole numbers of up to 40 digits in your browser: the canonical prime factorization, every divisor, and τ(n), σ(n) and φ(n). Nothing is uploaded.',
  },
  header: {
    eyebrow: 'Browser tool',
    lead: 'Type a whole number to see its prime factorization, all of its divisors and a few classic arithmetic functions. The search runs in a background thread on your device, so the page stays responsive even for 40-digit numbers.',
  },
  toolLabel: 'Integer & prime factorizer',
  noscript: 'This tool needs JavaScript. It runs entirely in your browser; nothing is uploaded.',

  form: {
    label: 'Whole number',
    hint: (maxDigits: number) =>
      `Up to ${enNumber(maxDigits)} digits. Spaces, underscores, thousands separators and a minus sign are fine.`,
    placeholder: 'e.g. 360',
    submit: 'Factor',
    cancel: 'Cancel',
    /** Live preview of the parsed value: "= 18,446,744,073,709,551,615 · 20 digits". */
    preview: (value: string, digits: number) => `= ${value} · ${enPlural(digits, 'digit', 'digits')}`,
    examplesLabel: 'Examples',
  },

  /** One message per parse error code (src/lib/math/parse.ts). */
  errors: {
    empty: 'Enter a whole number.',
    invalidChar: (char: string) => `“${char}” can’t be used here. Enter the digits of a whole number, such as 360.`,
    /** For operators and exponents: "2^64", "3*5", "1e9". */
    expression: 'Enter the number itself rather than a formula: write out all of its digits.',
    decimal: 'Enter a whole number: this one seems to have a decimal part.',
    grouping: 'Check the separators: thousands separators split the digits into groups of three, as in 1,000,000.',
    sign: 'Use one sign at most, at the very start.',
    noDigits: 'Enter some digits after the sign.',
    tooLong: (digits: number, max: number) =>
      `That number has ${enNumber(digits)} digits; this tool factors numbers of up to ${enNumber(max)} digits.`,
  },

  /** Captions of the example buttons. */
  examples: {
    highlyComposite: 'highly composite',
    uint64: 'largest uint64',
    mersenne: 'Mersenne prime',
    carmichael: 'Carmichael number',
    fermat: 'Fermat number F₅',
    perfect: 'perfect number',
  },

  status: {
    factoring: 'Factoring…',
    /** Progress line while a long search runs (not announced). */
    progress: (digits: number, found: number, elapsed: string) =>
      `Splitting a ${enNumber(digits)}-digit factor · ${enPlural(found, 'prime factor', 'prime factors')} found · ${elapsed}`,
    seconds: (value: string) => `${value} s`,
    cancelled: 'Cancelled.',
    failed: 'The calculation stopped unexpectedly. Try again.',
    /** Screen-reader summaries after a run. */
    announcePrime: (value: string) => `${value} is prime.`,
    announceProbablePrime: (value: string) => `${value} is a probable prime.`,
    announceFactors: (value: string, spoken: string) => `Prime factorization of ${value}: ${spoken}.`,
    announceIncomplete: (count: number, elapsed: string) =>
      `Stopped after ${elapsed}: ${enPlural(count, 'composite factor', 'composite factors')} could not be split in time.`,
  },

  result: {
    heading: 'Result',
    kind: {
      prime: 'Prime',
      probablePrime: 'Probable prime',
      composite: 'Composite',
      unit: 'Neither prime nor composite',
      zero: 'Zero',
    },
    digits: (count: number) => enPlural(count, 'digit', 'digits'),
    canonicalLabel: 'Prime factorization',
    copy: 'Copy',
    copied: 'Copied',
    copyFactorization: 'Copy the factorization',
    copyDivisors: 'Copy the divisors',
    copiedAnnouncement: 'Copied to clipboard',
    copyFailed: 'Couldn’t copy automatically. Select the text and use your device’s Copy command.',
    /** The factorization read aloud: "2 to the power 3 times 3 to the power 2 times 5". */
    spoken: {
      power: (base: string, exponent: string) => `${base} to the power ${exponent}`,
      times: 'times',
      minus: 'minus',
      plus: 'plus',
      minusOne: 'minus 1',
      probable: (value: string) => `${value} (a probable prime)`,
      unfactored: (value: string) => `${value} (composite, not split yet)`,
    },
    notes: {
      zero: '0 has no prime factorization. Every integer divides 0 (0 = d × 0), so 0 has infinitely many divisors, and τ, σ and φ are not defined for it.',
      one: '1 is the empty product: it has no prime factors and is neither prime nor composite. Its only positive divisor is 1.',
      minusOne: '−1 is a unit, like 1: it has no prime factors and is neither prime nor composite. Its only positive divisor is 1.',
      negative: (magnitude: string) =>
        `A negative number factors as −1 × |n|. The divisors, functions and properties below describe |n| = ${magnitude}.`,
      probable:
        'Factors marked † passed the Baillie–PSW probable-prime test. No composite number is known to pass it, but for numbers of 25 digits or more it is not a proof.',
      incomplete: (count: number) =>
        `The ${count === 1 ? 'factor' : 'factors'} in brackets ${count === 1 ? 'is' : 'are'} composite but could not be split within the time limit. Pollard’s rho needs about √p steps to find a prime factor p, so this happens when every prime factor left has about 15 digits or more.`,
    },
    searchLonger: (seconds: string) => `Search ${seconds} longer`,
  },

  divisors: {
    heading: 'Divisors',
    count: (total: string, isOne: boolean) => `${total} positive ${isOne ? 'divisor' : 'divisors'}`,
    listLabel: 'Positive divisors, in ascending order',
    showAll: (total: string) => `Show all ${total}`,
    showFirst: (cap: string) => `Show the first ${cap}`,
    showFewer: 'Show fewer',
    truncated: (shown: string, total: string) => `Showing the smallest ${shown} of ${total} divisors.`,
    unavailable: 'The divisors follow from the complete factorization, which is not known yet.',
  },

  functions: {
    heading: 'Arithmetic functions',
    tau: { name: 'Number of divisors', note: 'Add 1 to every exponent and multiply.' },
    sigma: {
      name: 'Sum of divisors',
      note: (aliquot: string) => `All divisors added up, n included. Without n they sum to ${aliquot}.`,
    },
    phi: { name: 'Euler’s totient', note: 'How many of 1, 2, …, n share no prime factor with n.' },
    omega: {
      name: 'Prime factors',
      value: (distinct: number, total: number) => `${enNumber(distinct)} distinct · ${enNumber(total)} with multiplicity`,
    },
    unknown: 'Needs the complete factorization',
  },

  properties: {
    heading: 'Properties',
    yes: 'Yes',
    no: 'No',
    prime: 'Prime number',
    probableNote: 'By the Baillie–PSW probable-prime test.',
    perfectSquare: 'Perfect square',
    squareOf: (root: string) => `The square of ${root}`,
    squarefree: 'Square-free',
    squarefreeNote: 'No prime factor appears more than once.',
    perfect: 'Perfect number',
    abundance: {
      perfect: 'σ(n) = 2n: n is the sum of its other divisors.',
      abundant: 'Abundant: σ(n) > 2n.',
      deficient: 'Deficient: σ(n) < 2n.',
    } satisfies Record<Abundance, string>,
    carmichael: 'Carmichael number',
    carmichaelNote: 'Composite, yet it passes Fermat’s test for every base coprime to it.',
    unknown: 'Unknown',
  },

  figure: {
    label: 'Fig. 1',
    caption: 'Factor tree: each split takes off the smallest prime factor.',
    more: (count: number) => `+${enNumber(count)} more`,
  },

  privacy: {
    label: 'Privacy',
    title: 'Runs on your device.',
    body: 'The number is factored in a background thread in this browser. It is never sent anywhere or stored.',
  },
  tipsTitle: 'Tips',
};

export type PrimeFactorizerMessages = typeof en;

const tr: PrimeFactorizerMessages = {
  meta: {
    title: 'Asal çarpanlara ayırma',
    description:
      '40 basamağa kadar tam sayıları tarayıcınızda çarpanlarına ayırın: kanonik asal çarpan gösterimi, tüm bölenler ve τ(n), σ(n), φ(n) değerleri. Hiçbir şey yüklenmez.',
  },
  header: {
    eyebrow: 'Tarayıcı aracı',
    lead: 'Bir tam sayı yazın; asal çarpanlarını, tüm bölenlerini ve birkaç klasik aritmetik fonksiyonun değerini görün. Hesaplama cihazınızda, arka planda çalışan bir iş parçacığında yapılır; böylece 40 basamaklı sayılarda bile sayfa donmaz.',
  },
  toolLabel: 'Asal çarpanlara ayırma',
  noscript: 'Bu araç JavaScript gerektirir. Tamamen tarayıcınızda çalışır; hiçbir şey yüklenmez.',

  form: {
    label: 'Tam sayı',
    hint: (maxDigits) =>
      `En fazla ${trNumber(maxDigits)} basamak. Boşluk, alt çizgi, binlik ayırıcı ve eksi işareti kullanabilirsiniz.`,
    placeholder: 'ör. 360',
    submit: 'Çarpanlara ayır',
    cancel: 'İptal',
    preview: (value, digits) => `= ${value} · ${trNumber(digits)} basamak`,
    examplesLabel: 'Örnekler',
  },

  errors: {
    empty: 'Bir tam sayı girin.',
    invalidChar: (char) => `“${char}” burada kullanılamaz. 360 gibi bir tam sayının rakamlarını girin.`,
    expression: 'Formül yerine sayının kendisini girin: tüm rakamlarını yazın.',
    decimal: 'Bir tam sayı girin: bu sayının ondalık kısmı var gibi görünüyor.',
    grouping: 'Ayırıcıları kontrol edin: binlik ayırıcılar rakamları üçerli gruplara böler, ör. 1.000.000.',
    sign: 'En fazla bir işaret kullanın ve onu sayının en başına yazın.',
    noDigits: 'İşaretten sonra rakam girin.',
    tooLong: (digits, max) =>
      `Bu sayı ${trNumber(digits)} basamaklı; bu araç en fazla ${trNumber(max)} basamaklı sayıları çarpanlarına ayırır.`,
  },

  examples: {
    highlyComposite: 'yüksek bileşik sayı',
    uint64: 'en büyük uint64',
    mersenne: 'Mersenne asalı',
    carmichael: 'Carmichael sayısı',
    fermat: 'Fermat sayısı F₅',
    perfect: 'mükemmel sayı',
  },

  status: {
    factoring: 'Çarpanlara ayrılıyor…',
    progress: (digits, found, elapsed) =>
      `${trNumber(digits)} basamaklı bir çarpan ayrıştırılıyor · ${trNumber(found)} asal çarpan bulundu · ${elapsed}`,
    seconds: (value) => `${value} sn`,
    cancelled: 'İptal edildi.',
    failed: 'Hesaplama beklenmedik biçimde durdu. Yeniden deneyin.',
    announcePrime: (value) => `${value} bir asal sayıdır.`,
    announceProbablePrime: (value) => `${value} olası bir asal sayıdır.`,
    announceFactors: (value, spoken) => `${value} sayısının asal çarpanlara ayrılışı: ${spoken}.`,
    announceIncomplete: (count, elapsed) =>
      `Arama ${elapsed} sonra durduruldu: ${trNumber(count)} bileşik çarpan süre içinde ayrıştırılamadı.`,
  },

  result: {
    heading: 'Sonuç',
    kind: {
      prime: 'Asal',
      probablePrime: 'Olası asal',
      composite: 'Bileşik',
      unit: 'Ne asal ne bileşik',
      zero: 'Sıfır',
    },
    digits: (count) => `${trNumber(count)} basamak`,
    canonicalLabel: 'Asal çarpanlara ayrılış',
    copy: 'Kopyala',
    copied: 'Kopyalandı',
    copyFactorization: 'Çarpanlara ayrılışı kopyala',
    copyDivisors: 'Bölenleri kopyala',
    copiedAnnouncement: 'Panoya kopyalandı',
    copyFailed: 'Otomatik olarak kopyalanamadı. Metni seçip cihazınızın Kopyala komutunu kullanın.',
    spoken: {
      power: (base, exponent) => `${base} üzeri ${exponent}`,
      times: 'çarpı',
      minus: 'eksi',
      plus: 'artı',
      minusOne: 'eksi 1',
      probable: (value) => `${value} (olası asal)`,
      unfactored: (value) => `${value} (bileşik, henüz ayrıştırılamadı)`,
    },
    notes: {
      zero: '0’ın asal çarpanlara ayrılışı yoktur. Her tam sayı 0’ı böler (0 = d × 0); bu yüzden 0’ın sonsuz sayıda böleni vardır ve τ, σ, φ fonksiyonları 0 için tanımlı değildir.',
      one: '1 boş çarpımdır: hiç asal çarpanı yoktur, ne asal ne de bileşiktir. Tek pozitif böleni 1’dir.',
      minusOne: '−1, tıpkı 1 gibi bir birimdir: hiç asal çarpanı yoktur, ne asal ne de bileşiktir. Tek pozitif böleni 1’dir.',
      negative: (magnitude) =>
        `Negatif bir sayı −1 × |n| biçiminde ayrılır. Aşağıdaki bölenler, fonksiyonlar ve özellikler |n| = ${magnitude} için geçerlidir.`,
      probable:
        '† ile işaretlenen çarpanlar Baillie–PSW olası asallık testini geçti. Bu testi geçen hiçbir bileşik sayı bilinmiyor; yine de 25 ve daha fazla basamaklı sayılar için bu bir ispat değildir.',
      incomplete: (count) =>
        `Köşeli parantez içindeki ${count === 1 ? 'çarpan' : 'çarpanlar'} bileşik, ancak süre sınırı içinde ayrıştırılamadı. Pollard’ın rho yöntemi bir p asal çarpanını bulmak için yaklaşık √p adım atar; kalan asal çarpanların hepsi 15 ya da daha fazla basamaklı olduğunda bu durum yaşanır.`,
    },
    searchLonger: (seconds) => `${seconds} daha ara`,
  },

  divisors: {
    heading: 'Bölenler',
    // Turkish nouns stay singular after a number: "24 pozitif bölen".
    count: (total) => `${total} pozitif bölen`,
    listLabel: 'Pozitif bölenler, küçükten büyüğe',
    showAll: (total) => `Tümünü göster (${total})`,
    showFirst: (cap) => `İlk ${cap} böleni göster`,
    showFewer: 'Daha az göster',
    truncated: (shown, total) => `Toplam ${total} bölenden en küçük ${shown} tanesi gösteriliyor.`,
    unavailable: 'Bölenler tam asal çarpan ayrılışından elde edilir; bu sayının tam ayrılışı henüz bilinmiyor.',
  },

  functions: {
    heading: 'Aritmetik fonksiyonlar',
    tau: { name: 'Bölen sayısı', note: 'Her üsse 1 ekleyip sonuçları çarpın.' },
    sigma: {
      name: 'Bölenlerin toplamı',
      note: (aliquot) => `n dahil tüm bölenlerin toplamı. n hariç toplam: ${aliquot}.`,
    },
    phi: { name: 'Euler’in φ fonksiyonu', note: '1, 2, …, n arasında n ile ortak asal çarpanı olmayan sayıların adedi.' },
    omega: {
      name: 'Asal çarpanlar',
      value: (distinct, total) => `${trNumber(distinct)} farklı · katlılıkla ${trNumber(total)}`,
    },
    unknown: 'Tam ayrılış gerekiyor',
  },

  properties: {
    heading: 'Özellikler',
    yes: 'Evet',
    no: 'Hayır',
    prime: 'Asal sayı',
    probableNote: 'Baillie–PSW olası asallık testine göre.',
    perfectSquare: 'Tam kare',
    squareOf: (root) => `Karekökü: ${root}`,
    squarefree: 'Karesiz',
    squarefreeNote: 'Hiçbir asal çarpan birden fazla kez geçmez.',
    perfect: 'Mükemmel sayı',
    abundance: {
      perfect: 'σ(n) = 2n: n, kendisi dışındaki bölenlerinin toplamına eşittir.',
      abundant: 'Bol sayı: σ(n) > 2n.',
      deficient: 'Eksik sayı: σ(n) < 2n.',
    },
    carmichael: 'Carmichael sayısı',
    carmichaelNote: 'Bileşik olduğu hâlde, kendisiyle aralarında asal her tabanda Fermat testini geçer.',
    unknown: 'Bilinmiyor',
  },

  figure: {
    label: 'Şekil 1',
    caption: 'Çarpan ağacı: her dalda en küçük asal çarpan ayrılır.',
    more: (count) => `+${trNumber(count)} dal daha`,
  },

  privacy: {
    label: 'Gizlilik',
    title: 'Cihazınızda çalışır.',
    body: 'Sayı bu tarayıcıda, arka planda çalışan bir iş parçacığında çarpanlarına ayrılır. Hiçbir yere gönderilmez ve saklanmaz.',
  },
  tipsTitle: 'İpuçları',
};

export const primeFactorizerMessages = { en, tr } as const satisfies Localized<PrimeFactorizerMessages>;
