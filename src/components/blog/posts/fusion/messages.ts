/**
 * Text inside the fusion post's figures, in both languages: labels, axis titles, legends and the
 * accessible descriptions of the drawings. The prose and the captions live in the two MDX files.
 *
 * Figures follow the post's language (a `lang` prop), not the interface language. Numbers arrive
 * already formatted (formatters(locale)), so messages only place them; Turkish phrasing keeps every
 * interpolated value free of case suffixes. Multi-line labels are arrays of lines.
 */
import type { Localized } from '../../../../i18n/config.ts';
import type { Reaction } from './model.ts';

export type TokamakPart = 'plasma' | 'fieldLine' | 'coils' | 'solenoid' | 'blanket' | 'vessel';

const en = {
  tokamak: {
    parts: {
      plasma: ['Plasma, about', '150 million °C'],
      fieldLine: ['Magnetic', 'field line'],
      coils: ['Toroidal', 'field coils'],
      solenoid: ['Central', 'solenoid'],
      blanket: ['Blanket'],
      vessel: ['Vacuum vessel'],
    } satisfies Record<TokamakPart, string[]>,
    aria: 'A drawing of a tokamak with a slice cut away at the front. A glowing ring of plasma runs inside a doughnut-shaped vacuum vessel. D-shaped toroidal field coils stand around the vessel, and a tall cylinder, the central solenoid, fills the hole in the middle. At the cut, the layers show in cross-section: the vessel, the blanket inside it, a dark gap of vacuum, and the plasma. Magnetic field lines wind around the plasma in a helix.',
    legend: 'Parts of the tokamak',
  },
  reaction: {
    deuterium: 'Deuterium',
    tritium: 'Tritium',
    helium: 'Helium-4',
    neutron: 'Neutron',
    proton: 'Proton',
    neutronKey: 'Neutron',
    before: 'Before',
    after: 'After',
    massBefore: (mass: string) => `${mass} u`,
    massAfter: (mass: string) => `${mass} u`,
    aria: (alpha: string, neutron: string, total: string, share: string) =>
      `A deuterium nucleus, one proton and one neutron, meets a tritium nucleus, one proton and two neutrons. They fuse into a helium-4 nucleus, which flies off with ${alpha} MeV, and a free neutron, which flies the other way with ${neutron} MeV. Together that is ${total} MeV, and the products weigh ${share} less than the fuel.`,
  },
  binding: {
    xAxis: 'Nucleons in the nucleus',
    yAxis: 'Binding energy per nucleon (MeV)',
    fusion: 'Fusion',
    fission: 'Fission',
    peak: ['Iron and nickel:', 'the most tightly bound'],
    aria: (iron: string, helium: string, deuterium: string, uranium: string) =>
      `A chart of the binding energy per nucleon against the number of nucleons. It climbs steeply from deuterium at ${deuterium} MeV, with a jump at helium-4 (${helium} MeV), peaks at iron and nickel at about ${iron} MeV, and falls slowly to uranium at ${uranium} MeV. An arrow from the light end marks fusion; an arrow from the heavy end marks fission. Both climb towards iron.`,
  },
  reactivity: {
    xAxis: 'Temperature (keV)',
    xAxisCelsius: 'million °C',
    yAxis: 'Reactivity ⟨σv⟩ (m³/s)',
    window: 'Where reactors work',
    names: { dt: 'D–T', dd: 'D–D', dhe3: 'D–³He' } satisfies Record<Reaction, string>,
    aria: (dt10: string, peakKev: string, ratioDd: string, ratioHe: string) =>
      `A chart of how readily three fuels fuse against temperature, both on logarithmic scales. The deuterium–tritium curve lies far above the other two at every temperature shown: at 10 keV, about 116 million °C, its reactivity is ${dt10} cubic metres per second, ${ratioDd} times that of deuterium–deuterium and ${ratioHe} times that of deuterium–helium-3. It peaks at about ${peakKev} keV. A band from 10 to 20 keV marks where reactors work.`,
  },
  lawson: {
    xAxis: 'Temperature (keV)',
    yAxis: 'Triple product needed n T τ (keV·s/m³)',
    burning: 'The plasma heats itself',
    short: 'Not enough',
    minimum: (kev: string, celsius: string) => `Easiest: about ${kev} keV (${celsius} million °C)`,
    aria: (kev: string, celsius: string, value: string) =>
      `A U-shaped curve of the triple product of density, temperature and confinement time that a deuterium–tritium plasma needs to heat itself, against temperature. It is lowest, about ${value} keV seconds per cubic metre, at about ${kev} keV, or ${celsius} million °C, and rises on both sides.`,
  },
};

export type FusionPostMessages = typeof en;

const tr: FusionPostMessages = {
  tokamak: {
    parts: {
      plasma: ['Plazma, yaklaşık', '150 milyon °C'],
      fieldLine: ['Manyetik', 'alan çizgisi'],
      coils: ['Toroidal', 'alan bobinleri'],
      solenoid: ['Merkezî', 'solenoid'],
      blanket: ['Örtü'],
      vessel: ['Vakum kabı'],
    },
    aria: 'Ön tarafından bir dilimi kesilip çıkarılmış bir tokamak çizimi. Simit biçimindeki vakum kabının içinde parlayan bir plazma halkası dolaşıyor. Kabın çevresinde D biçimli toroidal alan bobinleri duruyor, ortadaki boşluğu da merkezî solenoid denen uzun bir silindir dolduruyor. Kesitte katmanlar görünüyor: dışta vakum kabı, onun içinde örtü, sonra karanlık bir vakum boşluğu ve en içte plazma. Manyetik alan çizgileri plazmanın çevresine sarmal biçiminde dolanıyor.',
    legend: 'Tokamakın parçaları',
  },
  reaction: {
    deuterium: 'Döteryum',
    tritium: 'Trityum',
    helium: 'Helyum-4',
    neutron: 'Nötron',
    proton: 'Proton',
    neutronKey: 'Nötron',
    before: 'Önce',
    after: 'Sonra',
    massBefore: (mass: string) => `${mass} u`,
    massAfter: (mass: string) => `${mass} u`,
    aria: (alpha: string, neutron: string, total: string, share: string) =>
      `Bir döteryum çekirdeği (bir proton, bir nötron) bir trityum çekirdeğiyle (bir proton, iki nötron) karşılaşıyor. İkisi kaynaşıp bir helyum-4 çekirdeğine ve serbest bir nötrona dönüşüyor. Helyum ${alpha} MeV, nötron ${neutron} MeV enerjiyle ters yönlere uçuyor. Toplam ${total} MeV ediyor; ürünlerin kütlesi, yakıtınkinden ${share} daha az.`,
  },
  binding: {
    xAxis: 'Çekirdekteki nükleon sayısı',
    yAxis: 'Nükleon başına bağlanma enerjisi (MeV)',
    fusion: 'Füzyon',
    fission: 'Fisyon',
    peak: ['Demir ve nikel:', 'en sıkı bağlı çekirdekler'],
    aria: (iron: string, helium: string, deuterium: string, uranium: string) =>
      `Nükleon başına bağlanma enerjisinin nükleon sayısına göre grafiği. Eğri, ${deuterium} MeV’luk döteryumdan dik bir şekilde yükseliyor; helyum-4’te (${helium} MeV) bir sıçrama yapıyor. Demir ve nikelde yaklaşık ${iron} MeV ile tepeye çıkıyor, sonra uranyuma (${uranium} MeV) doğru yavaşça iniyor. Hafif uçtan çıkan bir ok füzyonu, ağır uçtan çıkan bir ok fisyonu gösteriyor; ikisi de demire doğru tırmanıyor.`,
  },
  reactivity: {
    xAxis: 'Sıcaklık (keV)',
    xAxisCelsius: 'milyon °C',
    yAxis: 'Reaktivite ⟨σv⟩ (m³/s)',
    window: 'Reaktörlerin çalıştığı aralık',
    names: { dt: 'D–T', dd: 'D–D', dhe3: 'D–³He' },
    aria: (dt10: string, peakKev: string, ratioDd: string, ratioHe: string) =>
      `Üç yakıtın ne kadar kolay kaynaştığını sıcaklığa göre gösteren grafik; iki eksen de logaritmik. Döteryum–trityum eğrisi, gösterilen her sıcaklıkta öbür ikisinin çok üstünde. 10 keV’ta, yani yaklaşık 116 milyon °C’de reaktivitesi saniyede ${dt10} metreküp: döteryum–döteryumunkinin ${ratioDd} katı, döteryum–helyum-3’ünkinin ${ratioHe} katı. Eğri yaklaşık ${peakKev} keV’ta tepe yapıyor. 10 ile 20 keV arasındaki bir şerit, reaktörlerin çalıştığı aralığı gösteriyor.`,
  },
  lawson: {
    xAxis: 'Sıcaklık (keV)',
    yAxis: 'Gereken üçlü çarpım n T τ (keV·s/m³)',
    burning: 'Plazma kendini ısıtıyor',
    short: 'Yetmiyor',
    minimum: (kev: string, celsius: string) => `En kolayı: yaklaşık ${kev} keV (${celsius} milyon °C)`,
    aria: (kev: string, celsius: string, value: string) =>
      `Bir döteryum–trityum plazmasının kendini ısıtabilmesi için gereken yoğunluk, sıcaklık ve tutma süresi çarpımının sıcaklığa göre grafiği; eğri U biçiminde. En alçak noktası yaklaşık ${kev} keV’ta, yani ${celsius} milyon °C’de; orada gereken değer yaklaşık ${value} keV·s/m³. İki yana doğru yükseliyor.`,
  },
};

export const fusionPostMessages: Localized<FusionPostMessages> = { en, tr };
