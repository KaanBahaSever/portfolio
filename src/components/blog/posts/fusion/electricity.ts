/**
 * Lifecycle greenhouse-gas emissions of electricity sources: the medians of IPCC AR5 Working
 * Group III, Annex III, Table A.III.2 (Schlömer et al., 2014, p. 1335), in grams of CO₂ equivalent
 * per kWh. “Lifecycle” counts everything: mining, fuel, building and dismantling the plant.
 * Fusion has no entry: no fusion power plant exists yet, so nothing has been measured.
 */

export type Source =
  | 'coal'
  | 'gas'
  | 'solarUtility'
  | 'solarRooftop'
  | 'hydro'
  | 'nuclear'
  | 'windOffshore'
  | 'windOnshore';

/** Median lifecycle emissions, gCO₂eq/kWh, in the order the post’s chart shows them. */
export const LIFECYCLE_CO2: readonly { source: Source; median: number }[] = [
  { source: 'coal', median: 820 }, // Coal — PC: 740 / 820 / 910
  { source: 'gas', median: 490 }, // Gas — Combined Cycle: 410 / 490 / 650
  { source: 'solarUtility', median: 48 }, // Solar PV — utility: 18 / 48 / 180
  { source: 'solarRooftop', median: 41 }, // Solar PV — rooftop: 26 / 41 / 60
  { source: 'hydro', median: 24 }, // Hydropower: 1.0 / 24 / 2200
  { source: 'nuclear', median: 12 }, // Nuclear: 3.7 / 12 / 110
  { source: 'windOffshore', median: 12 }, // Wind offshore: 8.0 / 12 / 35
  { source: 'windOnshore', median: 11 }, // Wind onshore: 7.0 / 11 / 56
];

export function lifecycleCo2(source: Source): number {
  const row = LIFECYCLE_CO2.find((r) => r.source === source);
  if (!row) throw new Error(`electricity: no lifecycle value for ${source}`);
  return row.median;
}
