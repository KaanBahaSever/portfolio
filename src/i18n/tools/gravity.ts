/**
 * Interface text of the gravity simulator (page, component and browser controller). Rich prose
 * with inline markup (the "How it works" section and the tips) is written per locale in the page
 * itself.
 *
 * The library (src/lib/physics/gravity.ts) returns numbers and codes; this catalogue gives them
 * words and src/scripts/tools/gravity/present.ts combines them with formatters(locale).
 * Interpolated values arrive formatted ("1.02 km/s" / "1,02 km/s", "27 d 2 h" / "27 gün 2 sa").
 * Body names can be anything the visitor types, so no Turkish sentence puts a case suffix on a
 * name: names stand alone, as a label's value or at the start of a sentence.
 */
import type { Localized } from '../config.ts';
import type { BodyKind, MassUnit, PresetBodyName, PresetId } from '../../lib/physics/gravity.ts';

interface Choice {
  label: string;
  /** One line under the menu: what the choice is. */
  detail: string;
}

const en = {
  meta: {
    title: 'Gravity simulator',
    description:
      'Watch the Moon orbit the Earth under Newton’s law of gravitation, then add your own planets, moons and satellites: choose their mass, throw them with the mouse or a finger, and see the predicted path before you let go. Runs in your browser.',
  },
  header: {
    eyebrow: 'Browser tool',
    lead: 'The Earth and the Moon in 3D, moved by Newton’s law of gravitation with their real masses and distance. Add bodies of any mass, throw them into orbit, and see the path each one will take before you let it go.',
  },
  toolLabel: 'Gravity simulator',
  noscript: 'This simulator needs JavaScript to run.',
  noWebgl:
    'Your browser could not start WebGL, so the 3D view cannot be shown. The simulation still runs: add bodies with the form and follow them in the list of bodies.',
  view: {
    /** aria-label of the canvas. */
    canvas:
      'Three-dimensional view of the simulation. The list of bodies below gives the same information as text. When the view has focus, the arrow keys move it.',
    hint: {
      add: 'Press on the plane where the new body should go, and drag to give it a speed.',
      camera: 'Drag to turn the view, scroll or pinch to zoom, right-drag or drag with two fingers to move it.',
    },
    notToScale: 'Bodies are drawn larger than they are; distances, masses and motion are real.',
    /** While throwing a body: its speed, then what the prediction shows. */
    readout: {
      bound: (speed: string, period: string) => `${speed} · orbit of ${period}`,
      escapes: (speed: string) => `${speed} · escapes`,
      collides: (speed: string) => `${speed} · collides`,
      still: (speed: string) => speed,
    },
  },
  transport: {
    label: 'Simulation controls',
    play: 'Play',
    pause: 'Pause',
    step: 'Step',
    stepHint: (amount: string) => `Step moves the simulation on by ${amount}.`,
    speed: 'Speed',
    /** "2 days per second". */
    perSecond: (amount: string) => `${amount} per second`,
    limited: 'The simulation is running slower than set, to keep its steps small enough to stay accurate.',
    mode: 'Dragging in the view',
    modes: { add: 'Adds a body', camera: 'Moves the camera' },
    trails: 'Trails',
    labels: 'Labels',
    follow: 'Follow selected',
    fit: 'Fit to view',
  },
  presets: {
    heading: 'Scene',
    label: 'Start from',
    items: {
      'earth-moon': {
        label: 'Earth and Moon',
        detail: 'The Moon at its mean distance of 384,400 km and mean speed of 1.022 km/s.',
      },
      geostationary: {
        label: 'Geostationary satellite',
        detail: 'A satellite 42,164 km from the Earth’s centre goes round once a day, so from the ground it seems to stand still.',
      },
      'three-speeds': {
        label: 'Three speeds',
        detail: 'Three small moons start at the Moon’s distance: too slow for a circle, just right, and faster than escape speed.',
      },
      'double-planet': {
        label: 'Double planet',
        detail: 'Two Earths 200,000 km apart circle the point between them once a week.',
      },
      'figure-eight': {
        label: 'Figure eight',
        detail: 'Three equal masses chase each other along one figure-eight curve (Chenciner and Montgomery, 2000).',
      },
    } satisfies Record<PresetId, Choice>,
    reset: 'Reset',
    clear: 'Clear all',
  },
  /** Names of the preset bodies. */
  bodies: {
    earth: 'Earth',
    moon: 'Moon',
    satellite: 'Satellite',
    slow: 'Slow moon',
    circular: 'Circular moon',
    fast: 'Fast moon',
    twin: 'Twin Earth',
    a: 'A',
    b: 'B',
    c: 'C',
  } satisfies Record<PresetBodyName, string>,
  add: {
    heading: 'Add a body',
    kind: 'Body',
    kinds: {
      moon: 'Moon',
      mars: 'Mars',
      earth: 'Earth',
      jupiter: 'Jupiter',
      asteroid: 'Asteroid',
      satellite: 'Satellite',
      custom: 'Custom mass',
    } satisfies Record<BodyKind, string>,
    /** Name of a new body of custom mass: "Body 3". */
    customName: (n: number) => `Body ${n}`,
    mass: 'Mass',
    massSlider: 'Mass, on a logarithmic scale',
    unit: 'Unit',
    units: { kg: 'kg', earth: 'Earth masses', moon: 'Moon masses' } satisfies Record<MassUnit, string>,
    /** "= 0.0123 Earth masses = 1 Moon mass" under the mass field. */
    equals: 'Equals',
    howTo:
      'Choose a body, then press on the plane in the view and drag. The arrow is the body’s velocity, measured against the body that pulls on it hardest at that point; the dashed line is the path it will take.',
    full: 'There are 24 bodies, the most this simulator runs. Remove one to add another.',
    numbers: {
      heading: 'Place with numbers',
      position: 'Position',
      velocity: 'Velocity',
      x: 'x',
      y: 'y',
      vx: 'vx',
      vy: 'vy',
      hint: 'Measured from the centre of mass of the scene at the start; the Moon begins on the +x axis and moves toward +y.',
      submit: 'Add body',
    },
    orbit: {
      heading: 'Circular orbit',
      around: 'Around',
      distance: 'Distance from its centre',
      hint: 'Speed v = √(GM/r), at right angles to the radius, counterclockwise like the Moon.',
      submit: 'Add in a circular orbit',
      none: 'There is no body to orbit yet.',
    },
  },
  selected: {
    heading: 'Selected body',
    none: 'Select a body by clicking or tapping it in the view, or in the list of bodies.',
    name: 'Name',
    mass: 'Mass',
    apply: 'Apply',
    remove: 'Remove',
    follow: 'Follow',
    attractor: 'Strongest pull',
    distance: 'Distance',
    speed: 'Relative speed',
    period: 'Orbital period',
    eccentricity: 'Eccentricity',
    unbound: 'not bound, escaping',
    alone: 'nothing else pulls on it',
  },
  stats: {
    heading: 'Measurements',
    elapsed: 'Simulated time',
    count: 'Bodies',
    energy: 'Total energy',
    drift: 'Energy drift',
    driftNote: 'Relative change since the last time bodies were added, removed, merged or edited.',
  },
  list: {
    heading: 'Bodies',
    empty: 'There are no bodies. Choose a scene or add a body.',
    columns: {
      name: 'Name',
      mass: 'Mass',
      attractor: 'Strongest pull',
      distance: 'Distance',
      speed: 'Relative speed',
    },
    select: (name: string) => `Select ${name}`,
  },
  errors: {
    mass: {
      empty: 'Enter a mass.',
      number: 'Enter a number, like 7.342e22 or 0.5.',
      range: 'The mass must be between 1 kg and 2 × 10²⁸ kg (about ten Jupiters).',
    },
    number: 'Enter a number, like 384400 or −1.2.',
    empty: 'Fill in every field.',
    distance: 'The distance must be larger than the two bodies’ radii added together.',
    name: 'Enter a name.',
    overlap: 'That spot is inside another body.',
  },
  units: {
    /** Short units for durations. */
    d: 'd',
    h: 'h',
    min: 'min',
    s: 's',
    /** Time-scale stops, as words: "1 minute", "2 days". */
    minute: (n: string, one: boolean) => `${n} ${one ? 'minute' : 'minutes'}`,
    hour: (n: string, one: boolean) => `${n} ${one ? 'hour' : 'hours'}`,
    day: (n: string, one: boolean) => `${n} ${one ? 'day' : 'days'}`,
    /** "0.0123 Earth masses", "1 Moon mass". */
    earthMasses: (n: string, one: boolean) => `${n} ${one ? 'Earth mass' : 'Earth masses'}`,
    moonMasses: (n: string, one: boolean) => `${n} ${one ? 'Moon mass' : 'Moon masses'}`,
  },
  announce: {
    added: (name: string) => `${name} added.`,
    removed: (name: string) => `${name} removed.`,
    merged: (survivor: string, absorbed: string) => `${absorbed} collided with ${survivor} and merged into it.`,
    preset: (name: string) => `Scene loaded: ${name}.`,
    cleared: 'All bodies removed.',
    playing: 'Running.',
    paused: 'Paused.',
    selected: (name: string) => `${name} selected.`,
  },
  privacy: {
    label: 'Privacy',
    title: 'Nothing leaves your device.',
    body: 'The simulation runs in your browser, and nothing you add or type is sent anywhere or saved.',
  },
  formulaTitle: 'How it works',
  tips: 'Tips',
};

export type GravityMessages = typeof en;

const tr: GravityMessages = {
  meta: {
    title: 'Yerçekimi simülasyonu',
    description:
      'Ay’ın Newton’un kütleçekim yasasıyla Dünya’nın çevresinde dönüşünü izleyin, sonra kendi gezegenlerinizi, uydularınızı ekleyin: kütlelerini seçin, fareyle ya da parmağınızla fırlatın ve bırakmadan önce izleyecekleri yolu görün. Araç tarayıcınızda çalışır.',
  },
  header: {
    eyebrow: 'Tarayıcı aracı',
    lead: 'Dünya ve Ay, gerçek kütleleri ve aralarındaki gerçek uzaklıkla, Newton’un kütleçekim yasasına göre üç boyutlu olarak hareket ediyor. İstediğiniz kütlede cisimler ekleyin, onları yörüngeye fırlatın ve bırakmadan önce her birinin izleyeceği yolu görün.',
  },
  toolLabel: 'Yerçekimi simülasyonu',
  noscript: 'Bu simülasyonun çalışması için JavaScript gerekir.',
  noWebgl:
    'Tarayıcınız WebGL’i başlatamadı, bu yüzden üç boyutlu görünüm gösterilemiyor. Simülasyon yine de çalışıyor: Cisimleri formla ekleyebilir, cisimler listesinden izleyebilirsiniz.',
  view: {
    canvas:
      'Simülasyonun üç boyutlu görünümü. Aşağıdaki cisimler listesi aynı bilgileri metin olarak verir. Görünüm odaktayken ok tuşlarıyla kaydırılabilir.',
    hint: {
      add: 'Yeni cismin duracağı yere basın ve ona hız vermek için sürükleyin.',
      camera: 'Görünümü döndürmek için sürükleyin, yakınlaştırmak için kaydırın ya da iki parmağınızla çimdikleyin, kaydırmak için sağ tuşla ya da iki parmakla sürükleyin.',
    },
    notToScale: 'Cisimler olduklarından büyük çizilir; uzaklıklar, kütleler ve hareket gerçektir.',
    readout: {
      bound: (speed, period) => `${speed} · ${period} süren yörünge`,
      escapes: (speed) => `${speed} · kaçıyor`,
      collides: (speed) => `${speed} · çarpışıyor`,
      still: (speed) => speed,
    },
  },
  transport: {
    label: 'Simülasyon denetimleri',
    play: 'Başlat',
    pause: 'Duraklat',
    step: 'Adım',
    stepHint: (amount) => `Adım düğmesi simülasyonu ${amount} ilerletir.`,
    speed: 'Hız',
    perSecond: (amount) => `saniyede ${amount}`,
    limited: 'Simülasyon, adımlarını doğru sonuç verecek kadar küçük tutmak için ayarladığınızdan yavaş çalışıyor.',
    mode: 'Görünümde sürükleyince',
    modes: { add: 'Cisim eklenir', camera: 'Kamera hareket eder' },
    trails: 'İzler',
    labels: 'Adlar',
    follow: 'Seçileni izle',
    fit: 'Hepsini göster',
  },
  presets: {
    heading: 'Sahne',
    label: 'Başlangıç',
    items: {
      'earth-moon': {
        label: 'Dünya ve Ay',
        detail: 'Ay, ortalama 384.400 km uzaklıkta ve saniyede ortalama 1,022 km hızla dolanıyor.',
      },
      geostationary: {
        label: 'Yer eşzamanlı uydu',
        detail: 'Dünya’nın merkezinden 42.164 km uzaktaki bir uydu, Dünya’nın çevresini günde bir kez dolanır; bu yüzden yerden bakınca hep aynı yerde durur gibi görünür.',
      },
      'three-speeds': {
        label: 'Üç hız',
        detail: 'Üç küçük uydu Ay’ın uzaklığından yola çıkar: biri daire için fazla yavaş, biri tam yerinde, biri de kaçış hızından hızlı.',
      },
      'double-planet': {
        label: 'Çift gezegen',
        detail: 'Birbirinden 200.000 km uzaktaki iki Dünya, aralarındaki noktanın çevresini haftada bir dolanır.',
      },
      'figure-eight': {
        label: 'Sekiz',
        detail: 'Eşit kütleli üç cisim, aynı sekiz biçimli eğri üzerinde birbirini kovalar (Chenciner ve Montgomery, 2000).',
      },
    },
    reset: 'Baştan başlat',
    clear: 'Hepsini sil',
  },
  bodies: {
    earth: 'Dünya',
    moon: 'Ay',
    satellite: 'Yapay uydu',
    slow: 'Yavaş uydu',
    circular: 'Dairesel uydu',
    fast: 'Hızlı uydu',
    twin: 'İkiz Dünya',
    a: 'A',
    b: 'B',
    c: 'C',
  },
  add: {
    heading: 'Cisim ekle',
    kind: 'Cisim',
    kinds: {
      moon: 'Ay',
      mars: 'Mars',
      earth: 'Dünya',
      jupiter: 'Jüpiter',
      asteroid: 'Asteroit',
      satellite: 'Yapay uydu',
      custom: 'Özel kütle',
    },
    customName: (n) => `Cisim ${n}`,
    mass: 'Kütle',
    massSlider: 'Kütle, logaritmik ölçekte',
    unit: 'Birim',
    units: { kg: 'kg', earth: 'Dünya kütlesi', moon: 'Ay kütlesi' },
    equals: 'Eşittir',
    howTo:
      'Bir cisim seçin, sonra görünümde düzleme basıp sürükleyin. Ok, cismin hızını gösterir; bu hız, o noktada cismi en güçlü çeken cisme göre ölçülür. Kesikli çizgi de cismin izleyeceği yoldur.',
    full: 'Şu anda 24 cisim var; bu simülasyon en fazla bu kadarını çalıştırır. Yeni bir cisim eklemek için birini silin.',
    numbers: {
      heading: 'Sayılarla yerleştir',
      position: 'Konum',
      velocity: 'Hız',
      x: 'x',
      y: 'y',
      vx: 'vx',
      vy: 'vy',
      hint: 'Sahnenin başlangıçtaki kütle merkezinden ölçülür; Ay +x ekseninden yola çıkar ve +y yönünde ilerler.',
      submit: 'Cismi ekle',
    },
    orbit: {
      heading: 'Dairesel yörünge',
      around: 'Merkezdeki cisim',
      distance: 'Merkezine uzaklık',
      hint: 'Hız v = √(GM/r) olur ve yarıçapa diktir; cisim, Ay gibi saat yönünün tersine döner.',
      submit: 'Dairesel yörüngeye ekle',
      none: 'Çevresinde dönülecek bir cisim yok.',
    },
  },
  selected: {
    heading: 'Seçili cisim',
    none: 'Bir cismi seçmek için görünümde ya da cisimler listesinde üzerine tıklayın veya dokunun.',
    name: 'Ad',
    mass: 'Kütle',
    apply: 'Uygula',
    remove: 'Sil',
    follow: 'İzle',
    attractor: 'En güçlü çeken',
    distance: 'Uzaklık',
    speed: 'Göreli hız',
    period: 'Yörünge periyodu',
    eccentricity: 'Basıklık (eksantriklik)',
    unbound: 'bağlı değil, kaçıyor',
    alone: 'onu çeken başka cisim yok',
  },
  stats: {
    heading: 'Ölçümler',
    elapsed: 'Simülasyon zamanı',
    count: 'Cisim sayısı',
    energy: 'Toplam enerji',
    drift: 'Enerji kayması',
    driftNote: 'Cisimler en son eklendiğinden, silindiğinden, birleştiğinden ya da değiştirildiğinden bu yana göreli değişim.',
  },
  list: {
    heading: 'Cisimler',
    empty: 'Hiç cisim yok. Bir sahne seçin ya da cisim ekleyin.',
    columns: {
      name: 'Ad',
      mass: 'Kütle',
      attractor: 'En güçlü çeken',
      distance: 'Uzaklık',
      speed: 'Göreli hız',
    },
    select: (name) => `Seç: ${name}`,
  },
  errors: {
    mass: {
      empty: 'Bir kütle girin.',
      number: '7,342e22 ya da 0,5 gibi bir sayı girin.',
      range: 'Kütle 1 kg ile 2 × 10²⁸ kg (yaklaşık on Jüpiter) arasında olmalı.',
    },
    number: '384400 ya da −1,2 gibi bir sayı girin.',
    empty: 'Bütün alanları doldurun.',
    distance: 'Uzaklık, iki cismin yarıçaplarının toplamından büyük olmalı.',
    name: 'Bir ad girin.',
    overlap: 'Bu nokta başka bir cismin içinde.',
  },
  units: {
    d: 'gün',
    h: 'sa',
    min: 'dk',
    s: 'sn',
    minute: (n) => `${n} dakika`,
    hour: (n) => `${n} saat`,
    day: (n) => `${n} gün`,
    earthMasses: (n) => `${n} Dünya kütlesi`,
    moonMasses: (n) => `${n} Ay kütlesi`,
  },
  announce: {
    added: (name) => `${name} eklendi.`,
    removed: (name) => `${name} silindi.`,
    merged: (survivor, absorbed) => `Çarpışma: ${absorbed} ile ${survivor} birleşti.`,
    preset: (name) => `Sahne yüklendi: ${name}.`,
    cleared: 'Bütün cisimler silindi.',
    playing: 'Simülasyon çalışıyor.',
    paused: 'Simülasyon duraklatıldı.',
    selected: (name) => `${name} seçildi.`,
  },
  privacy: {
    label: 'Gizlilik',
    title: 'Hiçbir şey cihazınızdan çıkmaz.',
    body: 'Simülasyon tarayıcınızda çalışır; eklediğiniz ya da yazdığınız hiçbir şey bir yere gönderilmez veya kaydedilmez.',
  },
  formulaTitle: 'Nasıl çalışır?',
  tips: 'İpuçları',
};

export const gravityMessages = { en, tr } as const satisfies Localized<GravityMessages>;
