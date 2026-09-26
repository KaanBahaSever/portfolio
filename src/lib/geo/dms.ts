/**
 * Degrees, minutes and seconds for display: splits a signed decimal angle into whole degrees,
 * whole minutes, rounded seconds and a hemisphere letter code. Rounding carries over, so
 * 29.99″ shown with one decimal becomes 30.0″ and 59.96″ becomes the next minute, never "60.0″".
 */
import type { Axis, Hemisphere } from './parse.ts';

export interface DmsParts {
  degrees: number;
  minutes: number;
  seconds: number;
  hemisphere: Hemisphere;
}

/** N or S for latitudes, E or W for longitudes; zero counts as north or east. */
export function hemisphereOf(value: number, axis: Axis): Hemisphere {
  if (axis === 'lat') return value < 0 ? 'S' : 'N';
  return value < 0 ? 'W' : 'E';
}

/** Splits `value` (degrees) with `secondDecimals` decimals on the seconds. */
export function toDms(value: number, axis: Axis, secondDecimals = 1): DmsParts {
  const scale = 10 ** secondDecimals;
  // Count in units of the last shown decimal of a second, so the rounding happens once.
  const total = Math.round(Math.abs(value) * 3600 * scale);
  const secondUnits = total % (60 * scale);
  const totalMinutes = (total - secondUnits) / (60 * scale);
  const minutes = totalMinutes % 60;
  const degrees = (totalMinutes - minutes) / 60;
  // A value that rounds to 0″ has no hemisphere to speak of: call it north or east.
  const hemisphere = hemisphereOf(total === 0 ? 0 : value, axis);
  return { degrees, minutes, seconds: secondUnits / scale, hemisphere };
}
