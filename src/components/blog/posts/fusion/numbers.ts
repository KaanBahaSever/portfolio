/**
 * The numbers quoted in the prose of the fusion post, formatted for the post's language. The MDX
 * files interpolate these instead of hard-coding results, so the text always matches the model and
 * the figures (model.ts, all computed during the build). Formulas in KaTeX are written out by hand;
 * tests/blog-fusion-post.test.ts checks them against the model.
 */
import type { Locale } from '../../../../i18n/config.ts';
import { formatters } from '../../../../i18n/format.ts';
import { lifecycleCo2 } from './electricity.ts';
import {
  AIR_MOLECULES_PER_M3,
  COAL_MJ_PER_KG,
  bindingPerNucleon,
  coulombBarrierKev,
  deuteriumPerLitreMg,
  dtReaction,
  fissionJoulesPerKg,
  ignitionMinimum,
  kevToKelvin,
  methaneJoulesPerKg,
  nuclide,
  reactivity,
  reactivityPeak,
} from './model.ts';

/** A plasma density typical of ITER-class tokamaks, particles per m³. */
export const TOKAMAK_DENSITY = 1e20;

export function postNumbers(lang: Locale) {
  const f = formatters(lang);
  const fixed = (x: number, digits: number) =>
    f.number(x, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const int = (x: number) => f.number(Math.round(x));
  const dt = dtReaction();
  const million = (kelvin: number) => int(kelvin / 1e6);
  const minimum = ignitionMinimum();
  const fuelGramJoules = dt.perKg / 1000;
  const coalTonnes = (mj: number) => fuelGramJoules / (mj * 1e6) / 1000;

  return {
    /** D–T: energy released and its split, MeV. */
    q: fixed(dt.rounded.q, 1),
    alpha: fixed(dt.rounded.alpha, 1),
    neutron: fixed(dt.rounded.neutron, 1),
    /** The neutron's share of the energy. */
    neutronShare: f.percent(dt.neutron / dt.q),
    massBefore: fixed(dt.massBefore, 3),
    massAfter: fixed(dt.massAfter, 3),
    defect: fixed(dt.defect, 3),
    /** Share of the mass that becomes energy, e.g. "0.4%". */
    defectShare: f.percent(dt.defectShare, { maximumFractionDigits: 1 }),
    /** Energy per kilogram of D–T fuel, terajoules. */
    perKgTj: int(dt.perKg / 1e12),
    /** Energy in one gram of D–T fuel, gigajoules. */
    perGramGj: int(fuelGramJoules / 1e9),
    /** That gram as coal, tonnes (for the low and high heating values). */
    coalTonnesLow: int(coalTonnes(COAL_MJ_PER_KG.high)),
    coalTonnesHigh: int(coalTonnes(COAL_MJ_PER_KG.low)),
    coalLow: int(COAL_MJ_PER_KG.low),
    coalHigh: int(COAL_MJ_PER_KG.high),
    /** How many times more energy per kilogram than coal, in millions. */
    coalRatioLow: int(dt.perKg / (COAL_MJ_PER_KG.high * 1e6) / 1e6),
    coalRatioHigh: int(dt.perKg / (COAL_MJ_PER_KG.low * 1e6) / 1e6),
    /** One keV in millions of kelvin. */
    kevMillionK: fixed(kevToKelvin(1) / 1e6, 1),
    at10: million(kevToKelvin(10)),
    at15: million(kevToKelvin(15)),
    at20: million(kevToKelvin(20)),
    /** The Coulomb barrier of D–T, keV, and as a temperature in billions of kelvin. */
    barrierKev: int(Math.round(coulombBarrierKev() / 10) * 10),
    barrierBillionK: int(kevToKelvin(coulombBarrierKev()) / 1e9),
    /** Reactivities at 10 keV: D–T against the two other fuels. */
    ratioDd: int(reactivity('dt', 10) / reactivity('dd', 10)),
    ratioDhe3: int(reactivity('dt', 10) / reactivity('dhe3', 10)),
    dtPeakKev: int(reactivityPeak('dt').kev),
    /** The bottom of the ignition curve. */
    ignitionKev: int(minimum.kev),
    /** Rounded to tens: the minimum is broad, and “about 160 million” reads truer than 157. */
    ignitionMillionC: int(Math.round(kevToKelvin(minimum.kev) / 1e7) * 10),
    /** Binding energy per nucleon, MeV. */
    binding: {
      deuterium: fixed(bindingPerNucleon(nuclide('H-2')), 2),
      helium: fixed(bindingPerNucleon(nuclide('He-4')), 2),
      iron: fixed(bindingPerNucleon(nuclide('Fe-56')), 2),
      uranium: fixed(bindingPerNucleon(nuclide('U-235')), 2),
    },
    /** Energy per kilogram: natural gas (MJ), complete fission of U-235 (TJ). */
    gasMj: int(methaneJoulesPerKg() / 1e6),
    fissionTj: int(fissionJoulesPerKg() / 1e12),
    /** How many times more energy per kilogram D–T fusion gives than U-235 fission. */
    fusionVsFission: int(dt.perKg / fissionJoulesPerKg()),
    /** How many times more energy per kilogram U-235 fission gives than coal (27 MJ/kg), in millions. */
    fissionVsCoal: int(fissionJoulesPerKg() / (((COAL_MJ_PER_KG.low + COAL_MJ_PER_KG.high) / 2) * 1e6) / 1e6),
    /** IPCC AR5 lifecycle medians, gCO₂eq/kWh. */
    co2: {
      coal: int(lifecycleCo2('coal')),
      gas: int(lifecycleCo2('gas')),
      nuclear: int(lifecycleCo2('nuclear')),
      windOnshore: int(lifecycleCo2('windOnshore')),
      /** Coal against onshore wind, how many times. */
      coalVsWind: int(lifecycleCo2('coal') / lifecycleCo2('windOnshore')),
    },
    /** Deuterium in a litre of water, mg. */
    deuteriumMg: int(deuteriumPerLitreMg()),
    /** How many times thinner a tokamak plasma is than air, in thousands. */
    thinnerThanAirThousands: int(AIR_MOLECULES_PER_M3 / TOKAMAK_DENSITY / 1000),
  };
}
