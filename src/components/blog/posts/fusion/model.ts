/**
 * The physics behind the fusion post's figures and numbers, computed during the build from a few
 * measured constants: atomic masses (AME2020), the D–T reaction's energy (E = mc²), the
 * Bosch–Hale fit of fusion reactivities, and the ignition condition that gives the Lawson triple
 * product. The prose interpolates these numbers (numbers.ts) instead of hard-coding them, and the
 * figures assert the facts the text states, so a changed constant fails the build.
 *
 * Pure TypeScript: no DOM, no `astro:*`, so tests import it directly.
 */

/** CODATA 2018: the energy of one atomic mass unit, in MeV. */
export const MEV_PER_U = 931.49410242;
/** CODATA 2018 (exact): one electronvolt in joules. */
export const JOULES_PER_EV = 1.602176634e-19;
/** CODATA 2018: one atomic mass unit in kilograms. */
export const KG_PER_U = 1.6605390666e-27;
/** CODATA 2018 (exact): the Boltzmann constant in eV per kelvin; 1 keV ≈ 11.6 million K. */
export const BOLTZMANN_EV_PER_K = 8.617333262e-5;
/** The speed of light in m/s (exact). */
export const SPEED_OF_LIGHT = 299_792_458;

/** Atomic masses in u (AME2020), of the hydrogen atom and the neutron. */
export const MASS_H1 = 1.00782503223;
export const MASS_NEUTRON = 1.00866491595;

export interface Nuclide {
  /** Display name, e.g. ⁵⁶Fe. */
  label: string;
  /** Element symbol and mass number, e.g. 'Fe-56' (also the key the figures use). */
  id: string;
  /** Protons. */
  z: number;
  /** Nucleons (protons + neutrons). */
  a: number;
  /** Atomic mass in u (AME2020). */
  mass: number;
}

/**
 * The nuclides on the binding energy curve. Atomic masses from the 2020 Atomic Mass Evaluation
 * (Wang et al., Chinese Physics C 45, 030003, 2021); the binding energy follows from them.
 */
export const NUCLIDES: readonly Nuclide[] = [
  { label: '²H', id: 'H-2', z: 1, a: 2, mass: 2.01410177812 },
  { label: '³H', id: 'H-3', z: 1, a: 3, mass: 3.01604928132 },
  { label: '³He', id: 'He-3', z: 2, a: 3, mass: 3.01602932197 },
  { label: '⁴He', id: 'He-4', z: 2, a: 4, mass: 4.00260325413 },
  { label: '⁶Li', id: 'Li-6', z: 3, a: 6, mass: 6.0151228874 },
  { label: '⁷Li', id: 'Li-7', z: 3, a: 7, mass: 7.0160034366 },
  { label: '⁹Be', id: 'Be-9', z: 4, a: 9, mass: 9.012183065 },
  { label: '¹²C', id: 'C-12', z: 6, a: 12, mass: 12 },
  { label: '¹⁶O', id: 'O-16', z: 8, a: 16, mass: 15.99491461957 },
  { label: '²⁰Ne', id: 'Ne-20', z: 10, a: 20, mass: 19.9924401762 },
  { label: '²⁸Si', id: 'Si-28', z: 14, a: 28, mass: 27.97692653465 },
  { label: '⁴⁰Ca', id: 'Ca-40', z: 20, a: 40, mass: 39.962590863 },
  { label: '⁵⁶Fe', id: 'Fe-56', z: 26, a: 56, mass: 55.93493633 },
  { label: '⁶²Ni', id: 'Ni-62', z: 28, a: 62, mass: 61.92834537 },
  { label: '⁸⁴Kr', id: 'Kr-84', z: 36, a: 84, mass: 83.9114977282 },
  { label: '¹²⁰Sn', id: 'Sn-120', z: 50, a: 120, mass: 119.902201873 },
  { label: '¹³⁸Ba', id: 'Ba-138', z: 56, a: 138, mass: 137.905247 },
  { label: '²⁰⁸Pb', id: 'Pb-208', z: 82, a: 208, mass: 207.9766525 },
  { label: '²³⁵U', id: 'U-235', z: 92, a: 235, mass: 235.0439281 },
  { label: '²³⁸U', id: 'U-238', z: 92, a: 238, mass: 238.0507869 },
];

export function nuclide(id: string): Nuclide {
  const found = NUCLIDES.find((n) => n.id === id);
  if (!found) throw new Error(`fusion model: unknown nuclide ${id}`);
  return found;
}

/**
 * Binding energy per nucleon in MeV: the mass the separate protons (as hydrogen atoms, so the
 * electrons cancel) and neutrons would have, minus the atom's mass, as energy, shared out.
 */
export function bindingPerNucleon(n: Nuclide): number {
  const separate = n.z * MASS_H1 + (n.a - n.z) * MASS_NEUTRON;
  return ((separate - n.mass) * MEV_PER_U) / n.a;
}

/** The D–T reaction: D + T → ⁴He + n. */
export function dtReaction() {
  const d = nuclide('H-2').mass;
  const t = nuclide('H-3').mass;
  const alphaMass = nuclide('He-4').mass;
  const before = d + t;
  const after = alphaMass + MASS_NEUTRON;
  const defect = before - after;
  /** Energy released, MeV. */
  const q = defect * MEV_PER_U;
  // Momentum is conserved and the fuel was nearly at rest, so the two products fly apart with
  // equal and opposite momenta: the lighter neutron takes the larger share of the energy.
  const alpha = (q * MASS_NEUTRON) / (alphaMass + MASS_NEUTRON);
  const neutron = q - alpha;
  // Rounded to tenths of an MeV the way the reaction is usually written, so that the parts add up
  // to the total: 17.6 = 3.5 + 14.1. (The neutron's own share, 14.05 MeV for fuel at rest, rounds
  // to 14.0; in a hot plasma the fusing nuclei bring some kinetic energy of their own, and 14.1 MeV
  // is the figure quoted for D–T neutrons.)
  const tenth = (x: number) => Math.round(x * 10) / 10;
  const rounded = { q: tenth(q), alpha: tenth(alpha), neutron: tenth(tenth(q) - tenth(alpha)) };
  /** Energy per kilogram of D–T fuel, J/kg. */
  const perKg = (q * 1e6 * JOULES_PER_EV) / (before * KG_PER_U);
  return {
    q,
    alpha,
    neutron,
    rounded,
    massBefore: before,
    massAfter: after,
    defect,
    /** The share of the mass that turns into energy. */
    defectShare: defect / before,
    perKg,
  };
}

/** Typical heating value of coal, J/kg: hard coal gives about 24–30 MJ/kg. */
export const COAL_MJ_PER_KG = { low: 24, high: 30 } as const;

/**
 * Methane, the main part of natural gas: CH₄ + 2 O₂ → CO₂ + 2 H₂O. The NIST Chemistry WebBook
 * gives ΔcH°(gas) = −890.7 kJ/mol (Pittam and Pilcher, 1972), with liquid water; a power plant’s
 * water leaves as vapour, so the usable (lower) heating value takes off 2 × 44.0 kJ/mol, the heat
 * of vaporisation of water at 25 °C. Molar mass 16.043 g/mol.
 */
const METHANE = { combustionKjPerMol: 890.7, waterVaporisationKjPerMol: 44.0, gramsPerMol: 16.043 } as const;

/** Lower heating value of methane, J/kg (≈ 50 MJ/kg). */
export function methaneJoulesPerKg(): number {
  const kjPerMol = METHANE.combustionKjPerMol - 2 * METHANE.waterVaporisationKjPerMol;
  return (kjPerMol * 1000) / (METHANE.gramsPerMol / 1000);
}

/** Energy released per fission of uranium-235, MeV: about 200 MeV ends up as heat in a reactor. */
export const FISSION_MEV = 200;

/** Energy per kilogram of uranium-235 if every nucleus split, J/kg (≈ 82 TJ/kg). */
export function fissionJoulesPerKg(): number {
  return (FISSION_MEV * 1e6 * JOULES_PER_EV) / (nuclide('U-235').mass * KG_PER_U);
}

export type Fuel = 'coal' | 'gas' | 'fission' | 'fusion';

/**
 * Energy from one kilogram of each fuel, J/kg, as a range (coal varies; the others are single
 * values). The nuclear values assume all of the fuel reacts: upper bounds.
 */
export function fuelEnergies(): { fuel: Fuel; low: number; high: number }[] {
  const gas = methaneJoulesPerKg();
  const fission = fissionJoulesPerKg();
  const fusion = dtReaction().perKg;
  return [
    { fuel: 'coal', low: COAL_MJ_PER_KG.low * 1e6, high: COAL_MJ_PER_KG.high * 1e6 },
    { fuel: 'gas', low: gas, high: gas },
    { fuel: 'fission', low: fission, high: fission },
    { fuel: 'fusion', low: fusion, high: fusion },
  ];
}

/** Temperature in kelvin for a plasma temperature in keV (T = E / k). */
export function kevToKelvin(kev: number): number {
  return (kev * 1000) / BOLTZMANN_EV_PER_K;
}

export type Reaction = 'dt' | 'dd' | 'dhe3';

/**
 * Bosch & Hale, “Improved formulas for fusion cross-sections and thermal reactivities”,
 * Nuclear Fusion 32 (1992) 611, Table VII. ⟨σv⟩ in cm³/s for T in keV:
 *
 *   θ = T / (1 − T(C2 + T(C4 + T C6)) / (1 + T(C3 + T(C5 + T C7))))
 *   ξ = (B_G² / 4θ)^(1/3)
 *   ⟨σv⟩ = C1 θ √(ξ / (m_r c² T³)) e^(−3ξ)
 *
 * Valid for 0.2–100 keV (D–T, D–D) and 0.5–190 keV (D–³He).
 */
interface BoschHale {
  bg: number;
  mrc2: number;
  c: readonly [number, number, number, number, number, number, number];
}

const BOSCH_HALE = {
  /** T(d,n)⁴He */
  dt: { bg: 34.3827, mrc2: 1_124_656, c: [1.17302e-9, 1.51361e-2, 7.51886e-2, 4.60643e-3, 1.35e-2, -1.0675e-4, 1.366e-5] },
  /** ³He(d,p)⁴He */
  dhe3: { bg: 68.7508, mrc2: 1_124_572, c: [5.51036e-10, 6.41918e-3, -2.02896e-3, -1.9108e-5, 1.35776e-4, 0, 0] },
  /** D(d,p)T */
  ddp: { bg: 31.397, mrc2: 937_814, c: [5.65718e-12, 3.41267e-3, 1.99167e-3, 0, 1.0506e-5, 0, 0] },
  /** D(d,n)³He */
  ddn: { bg: 31.397, mrc2: 937_814, c: [5.4336e-12, 5.85778e-3, 7.68222e-3, 0, -2.964e-6, 0, 0] },
} satisfies Record<string, BoschHale>;

function boschHale({ bg, mrc2, c }: BoschHale, t: number): number {
  const [c1, c2, c3, c4, c5, c6, c7] = c;
  const theta = t / (1 - (t * (c2 + t * (c4 + t * c6))) / (1 + t * (c3 + t * (c5 + t * c7))));
  const xi = Math.cbrt((bg * bg) / (4 * theta));
  return c1 * theta * Math.sqrt(xi / (mrc2 * t ** 3)) * Math.exp(-3 * xi);
}

/** Thermal fusion reactivity ⟨σv⟩ in m³/s at a temperature in keV. D–D counts both branches. */
export function reactivity(reaction: Reaction, kev: number): number {
  const cm3 =
    reaction === 'dd'
      ? boschHale(BOSCH_HALE.ddp, kev) + boschHale(BOSCH_HALE.ddn, kev)
      : boschHale(BOSCH_HALE[reaction], kev);
  return cm3 * 1e-6;
}

/** The temperature range the fit covers for every reaction plotted, keV. */
export const REACTIVITY_RANGE = { min: 1, max: 100 } as const;

/** Where ⟨σv⟩ peaks within the fit's range (searched in 0.1 keV steps). */
export function reactivityPeak(reaction: Reaction): { kev: number; value: number } {
  let best: { kev: number; value: number } = { kev: REACTIVITY_RANGE.min, value: 0 };
  for (let tenths = REACTIVITY_RANGE.min * 10; tenths <= REACTIVITY_RANGE.max * 10; tenths++) {
    const kev = tenths / 10;
    const value = reactivity(reaction, kev);
    if (value > best.value) best = { kev, value };
  }
  return best;
}

/**
 * The triple product n T τ_E (keV·s/m³) a 50:50 D–T plasma needs to keep itself hot: the alpha
 * particles, which stay in the plasma, must bring in heat as fast as it leaks out,
 *
 *   (n²/4) ⟨σv⟩ E_α ≥ 3 n T / τ_E   ⇔   n T τ_E ≥ 12 T² / (⟨σv⟩ E_α),
 *
 * with the thermal energy 3nT of electrons and ions together. Radiation is left out, as in the
 * usual textbook estimate; it raises the curve a little at low temperatures.
 */
export function ignitionTripleProduct(kev: number): number {
  const alphaKev = dtReaction().alpha * 1000;
  return (12 * kev * kev) / (reactivity('dt', kev) * alphaKev);
}

/** The bottom of the ignition curve: the easiest temperature and the triple product it needs. */
export function ignitionMinimum(): { kev: number; value: number } {
  let best = { kev: 0, value: Infinity };
  for (let tenths = 20; tenths <= 1000; tenths++) {
    const kev = tenths / 10;
    const value = ignitionTripleProduct(kev);
    if (value < best.value) best = { kev, value };
  }
  return best;
}

/**
 * Coulomb barrier between a deuteron and a triton when their surfaces touch, in keV: the energy
 * e²/(4πε₀ r) with e²/(4πε₀) = 1.44 MeV·fm and nuclear radii 1.2 A^(1/3) fm.
 */
export function coulombBarrierKev(): number {
  const touching = 1.2 * (Math.cbrt(2) + Math.cbrt(3));
  return 1440 / touching;
}

/**
 * Deuterium in a litre of fresh water, mg: one hydrogen atom in about 6,420 is deuterium
 * (VSMOW, 155.76 ppm), and a litre of water holds 1000/18.015 moles of H₂O.
 */
export function deuteriumPerLitreMg(): number {
  const hydrogenMoles = (1000 / 18.015) * 2;
  return hydrogenMoles * 155.76e-6 * nuclide('H-2').mass * 1000;
}

/** Air at sea level holds about 2.5 × 10²⁵ molecules per m³. */
export const AIR_MOLECULES_PER_M3 = 2.5e25;
