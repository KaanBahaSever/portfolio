/**
 * About page text: headings, labels and figure captions. Paragraphs with inline links live in
 * per-locale Astro markup (src/components/about/prose/*), next to each other for translators.
 *
 * Voice: the owner is a software developer. Never call him an engineer (EN or TR) or label his
 * story as "engineering"; describe the work instead. Other people keep their own titles.
 */
import type { Localized } from '../config.ts';

/**
 * The chapters of the journey (section #journey), in reading order. Each chapter's fragment id
 * is `journey-<key>`; the home page and the timeline link to some of them, so keep the keys.
 */
export const JOURNEY_CHAPTERS = [
  'space',
  'algorithms',
  'research',
  'avionics',
  'control',
  'guidance',
  'simulation',
  'cubesat',
  'work',
  'community',
  'core',
  'automation',
] as const;
export type JourneyChapter = (typeof JOURNEY_CHAPTERS)[number];

interface ChapterText {
  /** Name in the chapter list at the top of the section. */
  short: string;
  /** Mono label after the chapter number (and the period, where the chapter has one). */
  label: string;
  title: string;
  /** Chapters with a figure add its `caption` (and any `figureLabels`) next to these. */
  [extra: string]: unknown;
}

/**
 * The sum the odd-number figure (#journey-community) proves, the same in both languages. No-break
 * spaces keep the equation on one line when a narrow caption wraps.
 */
const ODD_SUM = `${['1', '3', '5', '7', '9'].join(' + ')} = 5²`;

const en = {
  meta: {
    title: 'About',
    description:
      'About Kaan Baha Sever, a software developer and mathematics student in Istanbul: from C# at a vocational high school and rocket avionics to C++ and Go.',
  },
  header: {
    eyebrow: 'About',
    title: 'Mathematical intuition, applied to systems software',
  },
  glance: {
    heading: 'At a glance',
    location: 'Based in',
    study: 'Studying',
    studyValue: 'BSc Mathematics, Istanbul University',
    languages: 'Day to day',
    languagesValue: 'Modern C++ and Go',
    building: 'Currently building',
  },
  journey: {
    title: 'The journey so far',
    intro:
      'Roughly in chronological order, from an early fascination with spaceflight to the software I build today. The figures sketch the idea behind each chapter; most are computed from a small model of that idea rather than drawn by hand.',
    /** Accessible name of the chapter list. */
    contents: 'Chapters',
    /** Figure number shown above each caption ("Fig. 2"). */
    figure: (n: number) => `Fig. ${n}`,
    chapters: {
      space: {
        short: 'Space',
        // From the film Contact in early childhood to his own small projects in 2015.
        label: 'Childhood – 2015',
        title: 'Looking up: space exploration',
        /** Δv of the departure burn in km/s and the flight time in days, already formatted. */
        caption: (dv: string, days: string) =>
          `A Hohmann transfer, the classic first sketch of a lunar mission. A single engine burn at perigee (Δv ≈ ${dv} km/s) stretches a 300 km parking orbit (radius r₁) into an ellipse whose far end reaches the Moon’s orbit (radius r₂) about ${days} days later. Not to scale.`,
      },
      algorithms: {
        short: 'Foundations',
        /** Follows the period (2016 – 2019), which the page renders from the chapter's dates. */
        label: 'C# · MSSQL',
        title: 'Programming foundations',
        caption:
          'The algorithms behind the browser versions. Left: the Battleship opponent in hunt mode. Each cell is shaded by how many placements of the remaining fleet cover it after five misses; the next shot takes the densest cell. Right: minimax picks the move whose worst case is best.',
      },
      research: {
        short: 'TÜBİTAK research',
        label: '2019 · TÜBİTAK',
        title: 'Research: cryptography and visual programming',
        caption:
          'Programming by drawing: a Caesar cipher as a flowchart. Each letter cᵢ of the message moves k places along the alphabet (mod 26) until i reaches the message length n. On the right, the same program run with k = 3.',
        /** The flowchart's branch labels. */
        figureLabels: { yes: 'yes', no: 'no' },
      },
      avionics: {
        short: 'Rocketry',
        /** Follows the period (2019 – 2022). */
        label: 'Rocket and Space Club',
        title: 'Rocketry and flight avionics',
        caption:
          'The two altitude classes on one scale, as idealised flights: one low-altitude rocket with a 5,000 ft target altitude and two high-altitude rockets with a 10,000 ft target. Apogee is where dh/dt = 0; the dots stand for logged telemetry samples.',
        figureLabels: {
          /** Altitude tick label; the number is already formatted ("10,000"). */
          feet: (value: string) => `${value} ft`,
          /** How many of the club's rockets were built for that altitude. */
          rockets: (n: number) => (n === 1 ? '1 rocket' : `${n} rockets`),
        },
      },
      control: {
        short: 'Kalman and PID',
        // The same club and years as the rocketry chapter; no exact dates, so no period is rendered.
        label: 'Rocket and Space Club · Kalman · PID',
        title: 'From noisy data to a good estimate: Kalman filters and PID',
        /** Both models are illustrations (geometry.ts, CONTROL_FIGURE): say so first. */
        caption:
          'An illustration, not the club’s flight data. Left: an idealised ascent (thin line), noisy altimeter readings (dots) and a Kalman filter’s estimate (highlighted line). The filter also uses a noisy accelerometer, and its estimate stays much closer to the true altitude than the readings do. Right: a simple model of a vertical landing. The rocket starts high up and has to hover at the target height (dashed) using its engine. With PID it first drops a little below the target, then settles on it. Without the integral term (PD) it stays below the target, because nothing builds up the thrust that carries the rocket’s weight.',
      },
      guidance: {
        short: 'Parachute guidance',
        label: 'Research',
        title: 'Autonomous parachute guidance and precision landing',
        caption:
          'A steering field around the landing target, seen from above. The arrows show the direction to head at each point; the highlighted path is one guided descent.',
      },
      simulation: {
        short: 'Flight simulation',
        label: 'Python (2020) → C++ (today)',
        title: 'Flight simulation: from prototype to Rocket-Up',
        caption:
          'A trajectory integrated step by step in three dimensions, with its ground track and the velocity vector at one state.',
      },
      cubesat: {
        short: 'CubeSat',
        // The club's last period, which ended in 2022; no exact dates, so no period is rendered.
        label: 'Rocket and Space Club · CubeSat',
        title: 'CubeSat: the satellite we could not finish',
        /** The length of an overhead pass in minutes, already formatted ("6"). */
        caption: (minutes: string) =>
          `A ground station can only talk to a satellite while the satellite is above the station’s horizon. Take an example orbit 400 km up: a satellite passing straight overhead stays in view for only about ${minutes} minutes, and the ground station software has to make the most of them. The highlighted arc is the part of the orbit the station sees at least 10° (ε) above its horizon, and λ is the angle at Earth’s centre between the station and the end of that arc. Not to scale.`,
      },
      work: {
        short: 'crowd.inc',
        /** Follows the period (2021 – 2024). */
        label: 'crowd.inc',
        title: 'Software Developer at crowd.inc',
        /**
         * The network is a schematic picture, not crowd.inc's data: say so first, and give no
         * counts (the site had hundreds of users; the figure draws a few dozen dots).
         */
        caption:
          'A schematic picture of crowd.inc: people shared their ideas there, and others helped with them. Large circles are ideas and small dots are users; each line shows who helped with which idea, and the highlighted idea has the most helpers. Inside the dashed boundary on the right are the private ideas we turned to in the end.',
        /** Labels over the public side and over the private region, in small mono capitals. */
        figureLabels: { public: 'PUBLIC', private: 'PRIVATE' },
      },
      community: {
        short: 'Community',
        label: 'GDSC · Mathematics Club',
        title: 'Community: workshops, live streams and competitions',
        /** Do not claim this proof was shown at the club; it is the kind of puzzle the club was about. */
        caption:
          `A proof without words, the kind of puzzle that suits the Mathematics Club’s seminars and competitions. Add up the odd numbers in order and you always get a square: each L-shaped piece adds the next odd number and makes the side one unit longer, so ${ODD_SUM}.`,
      },
      core: {
        short: 'C++ and Go',
        label: 'Today',
        title: 'Current core: modern C++ and Go',
        caption: 'Publish/subscribe: messages fan out from one broker to many subscribers.',
        /** The figure's own labels, set in small mono capitals under its three columns. */
        figureLabels: { publisher: 'PUB', broker: 'BROKER', subscriber: 'SUB' },
      },
      automation: {
        short: 'Automation',
        label: 'Today · CI/CD',
        title: 'Automation: one-click test, package and deploy',
        caption:
          'One trigger runs the tests, fans out into a build for each platform, then fans back in to package the artifacts and deploy them.',
        /** Column labels under the pipeline, in small mono capitals. */
        figureLabels: { trigger: 'TRIGGER', test: 'TEST', build: 'BUILD', package: 'PACKAGE', deploy: 'DEPLOY' },
      },
    } satisfies Record<JourneyChapter, ChapterText>,
  },
  milestones: {
    title: 'Milestones',
    intro: 'The dated record, oldest first.',
  },
  resume: {
    title: 'Résumé',
    text: 'Experience, education and skills are summarised on the home page.',
    experienceLink: 'Experience on the home page',
    /** Shown after "Download CV" (the CV in the page's language). */
    cvFormat: '(PDF)',
  },
};

export type AboutMessages = typeof en;

const tr: AboutMessages = {
  meta: {
    title: 'Hakkımda',
    description:
      'Kaan Baha Sever, İstanbul’da yaşayan bir yazılım geliştirici ve matematik öğrencisi. Programlamaya meslek lisesinde C# ile başladı, roket aviyoniği üzerinde çalıştı; bugün C++ ve Go kullanıyor.',
  },
  header: {
    eyebrow: 'Hakkımda',
    title: 'Kod yazarken matematikle düşünüyorum',
  },
  glance: {
    heading: 'Kısaca',
    location: 'Yaşadığım yer',
    study: 'Okuduğum bölüm',
    studyValue: 'Matematik, İstanbul Üniversitesi',
    languages: 'Her gün kullandığım diller',
    languagesValue: 'Modern C++ ve Go',
    building: 'Şu an geliştirdiğim proje',
  },
  journey: {
    title: 'Bugüne nasıl geldim',
    intro:
      'Bölümler kabaca zaman sırasıyla ilerliyor: uzay uçuşlarına duyduğum ilk meraktan bugün geliştirdiğim yazılımlara kadar. Şekiller her bölümün ana fikrini basitçe gösteriyor. Çoğunu elle çizmedim, anlattıkları fikrin küçük bir modelinden hesapladım.',
    contents: 'Bölümler',
    figure: (n) => `Şekil ${n}`,
    chapters: {
      space: {
        short: 'Uzay',
        label: 'Çocukluk – 2015',
        title: 'Gökyüzüne bakmak: uzay araştırmaları',
        // "Yerberi" is the TDK term for perigee; the caption says what it means. The values sit
        // in parentheses or before a fixed noun ("gün"), so no suffix depends on how a number
        // is read.
        caption: (dv, days) =>
          `Hohmann transferi: bir Ay görevi planlanırken çizilen klasik ilk taslak. Yerberide, yani Dünya’ya en yakın noktada, motor bir kez ateşlenir (Δv ≈ ${dv} km/s). Bu ateşleme, 300 km yükseklikteki park yörüngesini (yarıçap r₁) uzatıp bir elipse çevirir. Araç yaklaşık ${days} gün sonra elipsin uzak ucunda Ay’ın yörüngesine (yarıçap r₂) ulaşır. Çizim ölçekli değildir.`,
      },
      algorithms: {
        short: 'Temeller',
        label: 'C# · MS SQL',
        title: 'Programlamanın temelleri',
        // "Hücre" and "ıska", as the Battleship game itself says.
        caption:
          'Oyunların tarayıcı sürümlerindeki algoritmalar. Solda Amiral Battı’daki bilgisayar rakip gemi arıyor: Beş ıskadan sonra her hücrenin rengi, kalan gemilerin o hücreyi kaç farklı yerleşimle kapladığını gösteriyor. Sıradaki atış en koyu hücreye yapılıyor. Sağda minimax, en kötü durumda en iyi sonucu veren hamleyi seçiyor.',
      },
      research: {
        short: 'TÜBİTAK projesi',
        label: '2019 · TÜBİTAK',
        title: 'Kriptografi ve görsel programlama üzerine bir araştırma',
        caption:
          'Programı yazmak yerine çizmek: Sezar şifresinin akış şeması. Mesajdaki her cᵢ harfi alfabede k harf ileri kaydırılır (mod 26). Bu, i sayacı mesajın uzunluğuna (n) ulaşana kadar sürer. Sağda aynı program k = 3 ile çalışıyor.',
        figureLabels: { yes: 'evet', no: 'hayır' },
      },
      avionics: {
        short: 'Roketçilik',
        label: 'Roket ve Uzay Kulübü',
        title: 'Roketçilik ve uçuş aviyoniği',
        caption:
          'İki irtifa sınıfı aynı ölçekte, ideal uçuşlarla gösteriliyor: hedef irtifası 5.000 ft olan bir alçak irtifa roketi ve hedefi 10.000 ft olan iki yüksek irtifa roketi. Tepe noktası, roketin yükselmeyi bıraktığı yerdir (dh/dt = 0). Noktalar, kaydedilen telemetri ölçümlerini temsil ediyor.',
        figureLabels: {
          feet: (value) => `${value} ft`,
          rockets: (n) => `${n} roket`,
        },
      },
      control: {
        short: 'Kalman ve PID',
        label: 'Roket ve Uzay Kulübü · Kalman · PID',
        title: 'Gürültülü veriden doğru tahmine: Kalman filtresi ve PID',
        // "İtki" is the rocketry word for thrust; "havada asılı kalmak" for hovering.
        caption:
          'Bu bir örnek çizim; kulübün uçuş verisi değil. Solda ideal bir yükseliş (ince çizgi), gürültülü altimetre ölçümleri (noktalar) ve Kalman filtresinin tahmini (vurgulu çizgi) var. Filtre gürültülü bir ivmeölçerden de yararlanıyor ve tahmini gerçek irtifaya ölçümlerden çok daha yakın kalıyor. Sağda basit bir dikey iniş modeli var: Roket yüksekten başlıyor ve motoruyla hedef yükseklikte (kesikli çizgi) havada asılı kalmaya çalışıyor. PID ile önce hedefin biraz altına iniyor, sonra hedefe oturuyor. İntegral terimi olmadan (PD) hedefin altında kalıyor, çünkü roketin ağırlığını taşıyacak itkiyi zamanla biriktiren bir şey yok.',
      },
      guidance: {
        short: 'Paraşüt güdümü',
        label: 'Araştırma',
        title: 'Otonom paraşüt güdümü ve hassas iniş',
        caption:
          'İniş hedefinin çevresindeki yönlendirme alanı, kuş bakışı. Oklar her noktada gidilmesi gereken yönü gösteriyor. Vurgulu çizgi, güdümlü bir inişin izlediği yol.',
      },
      simulation: {
        short: 'Uçuş simülasyonu',
        label: 'Python (2020) → C++ (bugün)',
        title: 'Uçuş simülasyonu: prototipten Rocket-Up’a',
        caption:
          'Üç boyutta adım adım hesaplanan bir yörünge. Kesikli çizgi yörüngenin yerdeki izdüşümünü, v oku da bir andaki hız vektörünü gösteriyor.',
      },
      cubesat: {
        short: 'CubeSat',
        label: 'Roket ve Uzay Kulübü · CubeSat',
        title: 'CubeSat: bitiremediğimiz uydu',
        // The number sits before a fixed noun ("dakika"), so no suffix depends on how it is read.
        caption: (minutes) =>
          `Yer istasyonu uyduyla yalnızca uydu ufkun üzerindeyken haberleşebilir. Örnek olarak 400 km yükseklikte bir yörünge düşünelim: Tam tepeden geçen bir uydu, istasyondan yalnızca yaklaşık ${minutes} dakika görünür. Yer istasyonu yazılımı bu birkaç dakikayı en iyi şekilde kullanmak zorundadır. Vurgulu yay, yörüngenin istasyondan ufkun en az 10° (ε) üzerinde görülen kısmı. λ ise Dünya’nın merkezinde, istasyon ile bu yayın ucu arasındaki açı. Çizim ölçekli değildir.`,
      },
      work: {
        short: 'crowd.inc',
        label: 'crowd.inc',
        // "crowd.inc" is read "kraud ink", so the suffix is "’te", after the typographic apostrophe.
        title: 'crowd.inc’te yazılım geliştirici',
        // "Fikirler için yardım", in the words the chapter opens with ("bu fikirler için yardım bulduğu").
        caption:
          'Şematik bir çizim: crowd.inc’te insanlar fikirlerini paylaşıyor, başkaları da bu fikirler için yardım ediyordu. Büyük daireler fikirler, küçük noktalar kullanıcılar; çizgiler kimin hangi fikir için yardım ettiğini gösteriyor. Vurgulu daire, en çok yardım alan fikir. Sağdaki kesikli sınırın içinde de son dönemde yöneldiğimiz, herkese açık olmayan özel fikirler var.',
        figureLabels: { public: 'HERKESE AÇIK', private: 'ÖZEL' },
      },
      community: {
        short: 'Topluluk',
        label: 'GDSC · Matematik Kulübü',
        title: 'Topluluk: atölyeler, canlı yayınlar ve yarışmalar',
        caption:
          `Sözsüz bir ispat: Matematik Kulübünün seminerlerine ve yarışmalarına yakışacak türden bir bulmaca. Tek sayıları sırayla toplayınca hep bir tam kare çıkar. L biçimindeki her parça sıradaki tek sayıyı ekler ve karenin kenarını bir birim uzatır. Böylece ${ODD_SUM} olur.`,
      },
      core: {
        short: 'C++ ve Go',
        label: 'Bugün',
        title: 'Bugün en çok kullandığım diller: modern C++ ve Go',
        caption: 'Yayıncı/abone (pub/sub) modeli: Mesajlar tek bir aracıdan (broker) birçok aboneye dağılır.',
        figureLabels: { publisher: 'YAYINCI', broker: 'ARACI', subscriber: 'ABONE' },
      },
      automation: {
        short: 'Otomasyon',
        label: 'Bugün · CI/CD',
        title: 'Otomasyon: tek tıkla test, paketleme ve dağıtım',
        caption:
          'Tek bir tetikleme önce testleri çalıştırır. Sonra akış dallanır ve her platform için ayrı bir derleme başlar. Derlemelerin çıktıları yeniden bir araya gelir, paketlenir ve dağıtılır.',
        // "Tetikleme", as the caption says; plain "tetik" reads as a gun's trigger.
        figureLabels: { trigger: 'TETİKLEME', test: 'TEST', build: 'DERLEME', package: 'PAKET', deploy: 'DAĞITIM' },
      },
    },
  },
  milestones: {
    title: 'Kilometre taşları',
    intro: 'Önemli tarihleri eskiden yeniye sıraladım.',
  },
  resume: {
    title: 'Özgeçmiş',
    // "yetkinliklerimi" contains the home page's skills heading ("Yetkinlikler") this sentence points to.
    text: 'Deneyimimi, eğitimimi ve yetkinliklerimi ana sayfada özetledim.',
    experienceLink: 'Ana sayfadaki deneyim bölümü',
    cvFormat: '(PDF)',
  },
};

export const aboutMessages = { en, tr } as const satisfies Localized<AboutMessages>;
