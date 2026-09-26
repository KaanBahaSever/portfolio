/**
 * Interface text of the interactive collision figures (CollisionDemo.astro and its controller).
 * The figures take the language of the post they sit in, which is also why this catalogue lives
 * next to them rather than under src/i18n/: nothing else uses it.
 *
 * Numbers arrive already formatted (formatters(locale)), so messages only place them. Turkish
 * phrasing keeps every interpolated value free of case suffixes ("derinlik 12 px", "Eksen B2").
 */
import type { Localized } from '../../../../i18n/config.ts';

export type DemoKind = 'aabb' | 'circles' | 'circle-box' | 'sat' | 'concave';
export type PolygonName = 'rectangle' | 'triangle' | 'pentagon';
export type ShapeKey = 'a' | 'b';

const en = {
  /** Accessible name of each figure's drawing (the figcaption names the whole figure). */
  stage: {
    aabb: 'Two axis-aligned boxes, A and B',
    circles: 'Two circles, A and B',
    'circle-box': 'A box A and a circle B',
    sat: 'A rotated rectangle A and a convex polygon B',
    concave: 'A U-shaped polygon A and a small square B',
  } satisfies Record<DemoKind, string>,
  shapeRole: 'movable shape',
  shapes: {
    aabb: { a: 'Box A', b: 'Box B' },
    circles: { a: 'Circle A', b: 'Circle B' },
    'circle-box': { a: 'Box A', b: 'Circle B' },
    sat: { a: 'Rectangle A', b: 'Polygon B' },
    concave: { a: 'U shape A', b: 'Square B' },
  } satisfies Record<DemoKind, Record<ShapeKey, string>>,
  polygons: { rectangle: 'Rectangle', triangle: 'Triangle', pentagon: 'Pentagon' } satisfies Record<PolygonName, string>,
  status: {
    overlapping: (depth: string) => `Colliding — depth ${depth} px`,
    touching: 'Touching — depth 0 px',
    separated: (gap: string) => `Separated — gap ${gap} px`,
    /** The concave figure: SAT reports a hit although the shapes are apart. */
    falseHit: (gap: string) => `SAT: colliding — wrong, the shapes are ${gap} px apart`,
    agreeOverlapping: 'Colliding — SAT agrees',
    agreeTouching: 'Touching — SAT agrees',
    /** The concave figure: the square only touches the U, but SAT on the whole U sees an overlap. */
    touchingSatOverlaps: 'Touching — SAT says colliding',
  },
  relations: { separated: 'separated', touching: 'touching', overlapping: 'colliding' },
  readout: {
    overlapX: 'Overlap on x',
    overlapY: 'Overlap on y',
    mtv: 'MTV',
    contact: 'Contact point',
    centerDistance: 'Centre distance',
    radiusSum: 'Sum of radii',
    closestPoint: 'Closest point p',
    toCenter: 'Distance |c − p|',
    center: 'Centre of B',
    inside: 'inside the box',
    outside: 'outside the box',
    axes: 'Candidate axes',
    separatingAxis: 'Separating axis',
    none: 'none',
    satSays: 'SAT (whole U)',
    piecesSay: 'Convex pieces',
    distance: 'Distance',
  },
  px: (value: string) => `${value} px`,
  point: (x: string, y: string) => `(${x}, ${y})`,
  controls: {
    reset: 'Reset',
    rotate: 'Rotate',
    rotateTarget: 'Shape to rotate',
    anticlockwise: (degrees: string) => `Rotate anticlockwise by ${degrees}°`,
    clockwise: (degrees: string) => `Rotate clockwise by ${degrees}°`,
    shapeB: 'Shape B',
  },
  axes: {
    heading: 'Projections on each axis',
    hint: 'Choose an axis to draw it on the figure; choose it again to go back to automatic.',
    shownAuto: (axis: string) => `On the figure: ${axis} (automatic)`,
    shownPinned: (axis: string) => `On the figure: ${axis}`,
    name: (source: string, index: number) => `${source}${index}`,
    overlap: (value: string) => `overlap ${value} px`,
    gap: (value: string) => `gap ${value} px`,
    separating: 'separates',
    parallel: (axis: string) => `parallel to ${axis}`,
    /** Read before an axis name ("Axis A1"); visually hidden, the rows show only "A1". */
    axisWord: 'Axis',
    legendA: 'shadow of A',
    legendB: 'shadow of B',
  },
  noscript: 'This figure is interactive and needs JavaScript; without it you see its starting position.',
};

export type CollisionMessages = typeof en;

const tr: CollisionMessages = {
  stage: {
    aabb: 'Eksenlere hizalı iki kutu: A ve B',
    circles: 'İki daire: A ve B',
    'circle-box': 'A kutusu ve B dairesi',
    sat: 'Döndürülmüş A dikdörtgeni ve dışbükey B çokgeni',
    concave: 'U biçimli A çokgeni ve küçük B karesi',
  },
  shapeRole: 'taşınabilir şekil',
  shapes: {
    aabb: { a: 'A kutusu', b: 'B kutusu' },
    circles: { a: 'A dairesi', b: 'B dairesi' },
    'circle-box': { a: 'A kutusu', b: 'B dairesi' },
    sat: { a: 'A dikdörtgeni', b: 'B çokgeni' },
    concave: { a: 'U biçimli A çokgeni', b: 'B karesi' },
  },
  polygons: { rectangle: 'Dikdörtgen', triangle: 'Üçgen', pentagon: 'Beşgen' },
  status: {
    overlapping: (depth) => `Çarpışıyor — derinlik ${depth} px`,
    touching: 'Temas ediyor — derinlik 0 px',
    separated: (gap) => `Çarpışma yok — boşluk ${gap} px`,
    falseHit: (gap) => `SAT: çarpışıyor — yanlış, şekiller arasında ${gap} px boşluk var`,
    agreeOverlapping: 'Çarpışıyor — SAT de aynı sonucu veriyor',
    agreeTouching: 'Temas ediyor — SAT de aynı sonucu veriyor',
    touchingSatOverlaps: 'Temas ediyor — SAT ise çarpışıyor diyor',
  },
  relations: { separated: 'çarpışma yok', touching: 'temas ediyor', overlapping: 'çarpışıyor' },
  readout: {
    overlapX: 'x ekseninde örtüşme',
    overlapY: 'y ekseninde örtüşme',
    mtv: 'MTV',
    contact: 'Temas noktası',
    centerDistance: 'Merkezler arası uzaklık',
    radiusSum: 'Yarıçapların toplamı',
    closestPoint: 'En yakın nokta p',
    toCenter: 'Uzaklık |c − p|',
    center: 'B dairesinin merkezi',
    inside: 'kutunun içinde',
    outside: 'kutunun dışında',
    axes: 'Aday eksenler',
    separatingAxis: 'Ayırıcı eksen',
    none: 'yok',
    satSays: 'SAT (U’nun tamamı)',
    piecesSay: 'Dışbükey parçalar',
    distance: 'Uzaklık',
  },
  px: (value) => `${value} px`,
  point: (x, y) => `(${x}, ${y})`,
  controls: {
    reset: 'Sıfırla',
    rotate: 'Döndür',
    rotateTarget: 'Döndürülecek şekil',
    anticlockwise: (degrees) => `Saat yönünün tersine ${degrees}° döndür`,
    clockwise: (degrees) => `Saat yönünde ${degrees}° döndür`,
    shapeB: 'B şekli',
  },
  axes: {
    heading: 'Her eksendeki izdüşümler',
    hint: 'Çizimde görmek istediğiniz ekseni seçin; otomatik seçime dönmek için aynı ekseni yeniden seçin.',
    shownAuto: (axis) => `Çizimde: ${axis} (otomatik)`,
    shownPinned: (axis) => `Çizimde: ${axis}`,
    name: (source, index) => `${source}${index}`,
    overlap: (value) => `örtüşme ${value} px`,
    gap: (value) => `boşluk ${value} px`,
    separating: 'ayırıyor',
    parallel: (axis) => `${axis} eksenine paralel`,
    axisWord: 'Eksen',
    legendA: 'A şeklinin gölgesi',
    legendB: 'B şeklinin gölgesi',
  },
  noscript: 'Bu etkileşimli çizim JavaScript ile çalışır. JavaScript kapalıysa yalnızca başlangıç konumunu görürsünüz.',
};

export const collisionMessages = { en, tr } as const satisfies Localized<CollisionMessages>;
