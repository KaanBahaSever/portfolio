/**
 * Interface text of the great-circle distance calculator (page, component and browser
 * controller). Rich prose with inline markup (the formula section and the tips) is written per
 * locale in the page itself.
 *
 * The library (src/lib/geo/) returns numbers and codes: compass points, hemisphere letters,
 * parse error codes. This catalogue gives them words; src/scripts/tools/geo-distance/present.ts
 * combines them with formatters(locale). Interpolated values arrive formatted ("8,069.8 km" /
 * "8.069,8 km", "0.25%" / "%0,25"), and Turkish sentences are built so that no value needs a
 * case suffix.
 */
import type { Localized } from '../config.ts';
import type { Hemisphere } from '../../lib/geo/parse.ts';
import type { CityId } from '../../lib/geo/presets.ts';
import type { CompassPoint, DistanceUnit, PointRelation } from '../../lib/geo/sphere.ts';

interface Named {
  /** Shown. */
  abbr: string;
  /** Read by screen readers and used in announcements. */
  name: string;
}

const en = {
  meta: {
    title: 'Great-circle distance',
    description:
      'Calculate the distance, bearings and midpoint between two latitude/longitude points with the haversine formula, compared with Vincenty’s method on the WGS-84 ellipsoid. Runs in your browser.',
  },
  header: {
    eyebrow: 'Browser tool',
    lead: 'The shortest distance between two points on the Earth’s surface, from their latitude and longitude, with the route drawn on a globe. Enter decimal degrees or degrees, minutes and seconds.',
  },
  toolLabel: 'Great-circle distance calculator',
  noscript: 'This calculator needs JavaScript. Without it, the page shows the result for Istanbul and New York.',
  points: {
    heading: 'Points',
    hint: 'Decimal degrees (41.0082) or degrees, minutes and seconds (41°00′29.5″N). Paste “latitude, longitude” into either field of a point to fill both.',
    legend: { a: 'Point A', b: 'Point B' },
    latitude: 'Latitude',
    longitude: 'Longitude',
    city: 'City',
    cityPrompt: 'Choose a city',
    swap: 'Swap A and B',
  },
  cities: {
    istanbul: 'Istanbul',
    ankara: 'Ankara',
    london: 'London',
    'new-york': 'New York',
    tokyo: 'Tokyo',
    sydney: 'Sydney',
  } satisfies Record<CityId, string>,
  errors: {
    empty: { lat: 'Enter the latitude.', lon: 'Enter the longitude.' },
    syntax: 'This is not a coordinate. Write it like 41.0082 or 41°00′29.5″N.',
    latRange: 'Latitude must be between −90° and 90°.',
    lonRange: 'Longitude must be between −180° and 180°.',
    minutesRange: 'Minutes must be less than 60.',
    secondsRange: 'Seconds must be less than 60.',
    fraction: 'Only the last part can have decimals: write 41°30.5′, not 41.5°30′.',
    signAndHemisphere: 'Use a minus sign or a hemisphere letter, not both.',
    wrongAxis: {
      lat: 'This value is a longitude (east or west). Enter the latitude here.',
      lon: 'This value is a latitude (north or south). Enter the longitude here.',
    },
    multiple: 'Enter one value here. To fill both fields at once, paste “latitude, longitude”.',
  },
  result: {
    heading: 'Great-circle distance',
    unitLegend: 'Unit',
    units: {
      km: { abbr: 'km', name: 'kilometers' },
      mi: { abbr: 'mi', name: 'miles' },
      nmi: { abbr: 'nmi', name: 'nautical miles' },
    } satisfies Record<DistanceUnit, Named>,
    initialBearing: 'Initial bearing',
    initialBearingNote: 'leaving A',
    finalBearing: 'Final bearing',
    finalBearingNote: 'arriving at B',
    midpoint: 'Midpoint',
    centralAngle: 'Central angle',
    ellipsoid: 'WGS-84 ellipsoid',
    ellipsoidNote: 'Vincenty’s method',
    sphereShorter: (percent: string) => `${percent} shorter on the sphere`,
    sphereLonger: (percent: string) => `${percent} longer on the sphere`,
    sphereSame: 'The same on the sphere',
    /** Shown in place of a value that is not defined or not available. */
    none: '—',
    incomplete: 'Enter both points to see the distance.',
    invalid: 'Correct the marked coordinates to see the distance.',
    notes: {
      coincident: 'A and B are the same point: the distance is zero and there is no direction to travel.',
      antipodal:
        'A and B are antipodal, on opposite sides of the Earth. Every great circle through A also passes through B, so the route, the bearings and the midpoint are not defined.',
      poleA:
        'A is at a pole, where every direction points south (north at the South Pole). Its bearing is measured from the meridian of the longitude you entered.',
      poleB:
        'B is at a pole. The final bearing is measured from the meridian of the longitude you entered for it.',
      vincenty:
        'Vincenty’s method does not converge for these nearly antipodal points, so the ellipsoid distance is not shown.',
    },
  },
  compass: {
    N: { abbr: 'N', name: 'north' },
    NNE: { abbr: 'NNE', name: 'north-northeast' },
    NE: { abbr: 'NE', name: 'northeast' },
    ENE: { abbr: 'ENE', name: 'east-northeast' },
    E: { abbr: 'E', name: 'east' },
    ESE: { abbr: 'ESE', name: 'east-southeast' },
    SE: { abbr: 'SE', name: 'southeast' },
    SSE: { abbr: 'SSE', name: 'south-southeast' },
    S: { abbr: 'S', name: 'south' },
    SSW: { abbr: 'SSW', name: 'south-southwest' },
    SW: { abbr: 'SW', name: 'southwest' },
    WSW: { abbr: 'WSW', name: 'west-southwest' },
    W: { abbr: 'W', name: 'west' },
    WNW: { abbr: 'WNW', name: 'west-northwest' },
    NW: { abbr: 'NW', name: 'northwest' },
    NNW: { abbr: 'NNW', name: 'north-northwest' },
  } satisfies Record<CompassPoint, Named>,
  hemispheres: { N: 'N', S: 'S', E: 'E', W: 'W' } satisfies Record<Hemisphere, string>,
  figure: {
    label: 'Fig. 1',
    projection: 'Orthographic',
    /** First sentence of the caption: where the globe is seen from. */
    view: {
      distinct: 'The globe seen from far away, from an angle that shows the curve of the route.',
      coincident: 'The globe seen from far away, turned toward the point.',
      antipodal: 'With no single route, A and B sit on opposite edges of the globe.',
    } satisfies Record<PointRelation, string>,
    legend: 'Solid line: the route from A to B. Dashed: the rest of its great circle. Dot: the midpoint.',
  },
  announce: {
    result: (distance: string, bearing: string) => `Distance ${distance}. Initial bearing ${bearing}.`,
    distance: (distance: string) => `Distance ${distance}.`,
    swapped: 'Points A and B swapped.',
    split: 'Latitude and longitude filled in.',
  },
  privacy: {
    label: 'Privacy',
    title: 'Nothing leaves your device.',
    body: 'The distance is calculated in your browser. The coordinates you enter are not sent anywhere or stored, and the page never asks for your location.',
  },
  formulaTitle: 'How it is calculated',
  tips: 'Tips',
};

export type GeoDistanceMessages = typeof en;

const tr: GeoDistanceMessages = {
  meta: {
    title: 'Büyük daire mesafesi',
    description:
      'Enlem ve boylamını girdiğiniz iki nokta arasındaki mesafeyi, yönleri ve orta noktayı haversine formülüyle hesaplayın. Sonuç, WGS-84 elipsoidinde Vincenty yöntemiyle bulunan mesafeyle karşılaştırılır. Araç tarayıcınızda çalışır.',
  },
  header: {
    eyebrow: 'Tarayıcı aracı',
    lead: 'İki noktanın enlem ve boylamını girin, Dünya yüzeyinde aralarındaki en kısa mesafeyi görün. Rota bir küre üzerinde çizilir. Koordinatları ondalık derece ya da derece, dakika ve saniye olarak yazabilirsiniz.',
  },
  toolLabel: 'Büyük daire mesafesi hesaplayıcı',
  noscript: 'Bu hesaplayıcı JavaScript olmadan çalışmaz. JavaScript kapalıyken sayfa, İstanbul ile New York arasındaki sonucu gösterir.',
  points: {
    heading: 'Noktalar',
    hint: 'Ondalık derece (41,0082) ya da derece, dakika ve saniye (41°00′29,5″K) girin. İki alanı birden doldurmak için “enlem, boylam” çiftini noktanın alanlarından birine yapıştırın.',
    legend: { a: 'A noktası', b: 'B noktası' },
    latitude: 'Enlem',
    longitude: 'Boylam',
    city: 'Şehir',
    cityPrompt: 'Şehir seçin',
    swap: 'A ile B’nin yerini değiştir',
  },
  cities: {
    istanbul: 'İstanbul',
    ankara: 'Ankara',
    london: 'Londra',
    'new-york': 'New York',
    tokyo: 'Tokyo',
    sydney: 'Sidney',
  },
  errors: {
    empty: { lat: 'Enlemi girin.', lon: 'Boylamı girin.' },
    syntax: 'Koordinat okunamadı. 41,0082 ya da 41°00′29,5″K biçiminde yazın.',
    latRange: 'Enlem −90° ile 90° arasında olmalıdır.',
    lonRange: 'Boylam −180° ile 180° arasında olmalıdır.',
    minutesRange: 'Dakika 60’tan küçük olmalıdır.',
    secondsRange: 'Saniye 60’tan küçük olmalıdır.',
    fraction: 'Yalnızca son kısım ondalıklı olabilir: 41,5°30′ değil, 41°30,5′ yazın.',
    signAndHemisphere: 'Ya eksi işareti ya da yarım küre harfi kullanın, ikisini birden değil.',
    wrongAxis: {
      lat: 'Bu değer bir boylam (doğu ya da batı). Buraya enlemi girin.',
      lon: 'Bu değer bir enlem (kuzey ya da güney). Buraya boylamı girin.',
    },
    multiple: 'Buraya tek bir değer girin. İki alanı birden doldurmak için “enlem, boylam” çiftini yapıştırın.',
  },
  result: {
    heading: 'Büyük daire mesafesi',
    unitLegend: 'Birim',
    units: {
      km: { abbr: 'km', name: 'kilometre' },
      mi: { abbr: 'mi', name: 'mil' },
      nmi: { abbr: 'nmi', name: 'deniz mili' },
    },
    initialBearing: 'Başlangıç yönü',
    initialBearingNote: 'A noktasından çıkarken',
    finalBearing: 'Varış yönü',
    finalBearingNote: 'B noktasına varırken',
    midpoint: 'Orta nokta',
    centralAngle: 'Merkez açı',
    ellipsoid: 'WGS-84 elipsoidi',
    ellipsoidNote: 'Vincenty yöntemi',
    sphereShorter: (percent) => `Kürede ${percent} daha kısa`,
    sphereLonger: (percent) => `Kürede ${percent} daha uzun`,
    sphereSame: 'Kürede de aynı',
    none: '—',
    incomplete: 'Mesafeyi görmek için iki noktayı da girin.',
    invalid: 'Mesafeyi görmek için işaretli koordinatları düzeltin.',
    notes: {
      coincident: 'A ve B aynı nokta: mesafe sıfır ve gidilecek bir yön yok.',
      antipodal:
        'A ve B, Dünya’nın tam karşıt noktalarında. A noktasından geçen her büyük daire B noktasından da geçer; bu yüzden rota, yönler ve orta nokta tanımlı değildir.',
      poleA:
        'A noktası bir kutupta; oradan her yön güneyi (Güney Kutbu’nda kuzeyi) gösterir. Başlangıç yönü, girdiğiniz boylamın meridyenine göre ölçülür.',
      poleB: 'B noktası bir kutupta. Varış yönü, bu nokta için girdiğiniz boylamın meridyenine göre ölçülür.',
      vincenty:
        'Neredeyse karşıt olan bu noktalar için Vincenty yöntemi yakınsamıyor; bu yüzden elipsoit üzerindeki mesafe gösterilmiyor.',
    },
  },
  compass: {
    N: { abbr: 'K', name: 'kuzey' },
    NNE: { abbr: 'KKD', name: 'kuzey-kuzeydoğu' },
    NE: { abbr: 'KD', name: 'kuzeydoğu' },
    ENE: { abbr: 'DKD', name: 'doğu-kuzeydoğu' },
    E: { abbr: 'D', name: 'doğu' },
    ESE: { abbr: 'DGD', name: 'doğu-güneydoğu' },
    SE: { abbr: 'GD', name: 'güneydoğu' },
    SSE: { abbr: 'GGD', name: 'güney-güneydoğu' },
    S: { abbr: 'G', name: 'güney' },
    SSW: { abbr: 'GGB', name: 'güney-güneybatı' },
    SW: { abbr: 'GB', name: 'güneybatı' },
    WSW: { abbr: 'BGB', name: 'batı-güneybatı' },
    W: { abbr: 'B', name: 'batı' },
    WNW: { abbr: 'BKB', name: 'batı-kuzeybatı' },
    NW: { abbr: 'KB', name: 'kuzeybatı' },
    NNW: { abbr: 'KKB', name: 'kuzey-kuzeybatı' },
  },
  // Kuzey, Güney, Doğu, Batı.
  hemispheres: { N: 'K', S: 'G', E: 'D', W: 'B' },
  figure: {
    label: 'Şekil 1',
    projection: 'Ortografik',
    view: {
      distinct: 'Küreye çok uzaktan, rotanın eğriliği görünecek bir açıdan bakılıyor.',
      coincident: 'Küreye çok uzaktan, nokta tam karşıda kalacak şekilde bakılıyor.',
      antipodal: 'Tek bir rota olmadığı için A ve B kürenin karşıt kenarlarında duruyor.',
    },
    legend: 'Düz çizgi: A ile B arasındaki rota. Kesikli çizgi: bu büyük dairenin geri kalanı. Nokta: orta nokta.',
  },
  announce: {
    result: (distance, bearing) => `Mesafe: ${distance}. Başlangıç yönü: ${bearing}.`,
    distance: (distance) => `Mesafe: ${distance}.`,
    swapped: 'A ve B noktalarının yeri değiştirildi.',
    split: 'Enlem ve boylam dolduruldu.',
  },
  privacy: {
    label: 'Gizlilik',
    title: 'Hiçbir şey cihazınızdan çıkmaz.',
    body: 'Mesafe tarayıcınızda hesaplanır. Girdiğiniz koordinatlar hiçbir yere gönderilmez ve saklanmaz. Sayfa konumunuzu da hiçbir zaman istemez.',
  },
  formulaTitle: 'Nasıl hesaplanır?',
  tips: 'İpuçları',
};

export const geoDistanceMessages = { en, tr } as const satisfies Localized<GeoDistanceMessages>;
