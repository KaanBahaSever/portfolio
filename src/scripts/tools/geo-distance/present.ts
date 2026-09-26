/**
 * Turns the engine's numbers and codes into the strings the calculator shows, in one locale.
 * Shared by the server-rendered component (the first result is in the HTML) and the browser
 * controller, so both print the same thing. Pure: no DOM.
 *
 * Precision follows what the numbers mean: distances to 0.1 km (the sphere itself is only
 * good to about 0.5 %), bearings to 0.1°, coordinates to four decimals of a degree (about
 * 11 m) or to 0.1″ in degrees, minutes and seconds.
 */
import type { Locale } from '../../../i18n/config.ts';
import { formatters } from '../../../i18n/format.ts';
import { geoDistanceMessages } from '../../../i18n/tools/geo-distance.ts';
import { hemisphereOf, toDms } from '../../../lib/geo/dms.ts';
import type { Axis, ParseErrorCode } from '../../../lib/geo/parse.ts';
import {
  DISTANCE_UNITS,
  compassPoint,
  fromKm,
  toDegrees,
  type DistanceUnit,
  type GreatCircleSummary,
} from '../../../lib/geo/sphere.ts';
import type { VincentyResult } from '../../../lib/geo/vincenty.ts';

/** No-break space: keeps a number with its unit or hemisphere letter. */
const NBSP = ' ';

export interface BearingView {
  /** "309.3°" */
  degrees: string;
  /** Compass abbreviation, "NW" / "KB". */
  abbr: string;
  /** Spelled out, "northwest" / "kuzeybatı". */
  name: string;
}

export interface ResultView {
  distance: { value: string; unit: string; unitName: string };
  /** The distance in the other two units: "5,014.4 mi · 4,357.4 nmi". */
  others: string;
  initialBearing: BearingView | null;
  finalBearing: BearingView | null;
  /** Latitude and longitude, in decimal degrees and in DMS. Null for antipodal points. */
  midpoint: { decimal: [string, string]; dms: [string, string] } | null;
  angle: { degrees: string; radians: string };
  ellipsoid: { distance: string; comparison: string } | null;
  notes: string[];
  /** Caption sentence for the figure. */
  view: string;
  /** One sentence for the live region. */
  announcement: string;
}

export type Presenter = ReturnType<typeof presenter>;

export function presenter(locale: Locale) {
  const m = geoDistanceMessages[locale];
  const f = formatters(locale);

  /** A number with exactly `digits` decimals ("+ 0" keeps −0 from printing as "-0"). */
  const fixed = (value: number, digits: number) =>
    f.number(value + 0, { minimumFractionDigits: digits, maximumFractionDigits: digits });

  /** Decimals for a distance: 0.1 from 100 up, 0.01 from 1 up, and metres below that. */
  function distanceDigits(value: number): number {
    if (value === 0) return 0;
    if (value >= 100) return 1;
    return value >= 1 ? 2 : 3;
  }

  function distanceNumber(km: number, unit: DistanceUnit): string {
    const value = fromKm(km, unit);
    return fixed(value, distanceDigits(value));
  }

  function distanceWithUnit(km: number, unit: DistanceUnit): string {
    return `${distanceNumber(km, unit)}${NBSP}${m.result.units[unit].abbr}`;
  }

  function bearing(degrees: number): BearingView {
    // Round first, so 359.96° shows as 0.0° N rather than 360.0°, and the compass point
    // agrees with the figure shown.
    let rounded = Math.round(degrees * 10) / 10;
    if (rounded >= 360) rounded = 0;
    const point = m.compass[compassPoint(rounded)];
    return { degrees: `${fixed(rounded, 1)}°`, abbr: point.abbr, name: point.name };
  }

  /** "41.0082° N" / "41,0082° K"; the equator and the prime meridian get no letter. */
  function decimal(value: number, axis: Axis): string {
    const shown = fixed(Math.abs(value), 4);
    if (Math.round(Math.abs(value) * 1e4) === 0) return `${shown}°`;
    return `${shown}°${NBSP}${m.hemispheres[hemisphereOf(value, axis)]}`;
  }

  /** "41°00′29.5″ N" / "41°00′29,5″ K". */
  function dms(value: number, axis: Axis): string {
    const parts = toDms(value, axis, 1);
    const minutes = f.number(parts.minutes, { minimumIntegerDigits: 2 });
    const seconds = f.number(parts.seconds, {
      minimumIntegerDigits: 2,
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `${parts.degrees}°${minutes}′${seconds}″${NBSP}${m.hemispheres[parts.hemisphere]}`;
  }

  return {
    distanceNumber,
    distanceWithUnit,
    bearing,
    decimal,
    dms,

    /**
     * The compass point as screen readers hear it after the degrees: ", northwest". The visible
     * abbreviation next to the degrees is hidden from them.
     */
    spokenCompassName(view: BearingView | null): string {
      return view ? `, ${view.name}` : '';
    },

    /** A coordinate as it goes into an input field: plain, with the locale's decimal separator. */
    inputValue(value: number): string {
      return f.number(value + 0, { maximumFractionDigits: 6, useGrouping: false });
    },

    /** The message for a field that does not parse. Pair-only codes read as "one value here". */
    fieldError(code: ParseErrorCode, axis: Axis): string {
      const errors = m.errors;
      switch (code) {
        case 'empty':
          return errors.empty[axis];
        case 'lat-range':
          return errors.latRange;
        case 'lon-range':
          return errors.lonRange;
        case 'minutes-range':
          return errors.minutesRange;
        case 'seconds-range':
          return errors.secondsRange;
        case 'fraction':
          return errors.fraction;
        case 'sign-and-hemisphere':
          return errors.signAndHemisphere;
        case 'wrong-axis':
          return errors.wrongAxis[axis];
        case 'multiple':
        case 'one-value':
        case 'too-many':
        case 'same-axis':
          return errors.multiple;
        case 'syntax':
          return errors.syntax;
      }
    },

    result(
      summary: GreatCircleSummary,
      vincenty: VincentyResult,
      unit: DistanceUnit,
    ): ResultView {
      const distance = {
        value: distanceNumber(summary.distanceKm, unit),
        unit: m.result.units[unit].abbr,
        unitName: m.result.units[unit].name,
      };
      const others = DISTANCE_UNITS.filter((other) => other !== unit)
        .map((other) => distanceWithUnit(summary.distanceKm, other))
        .join(' · ');

      const initial = summary.initialBearing === null ? null : bearing(summary.initialBearing);
      const final = summary.finalBearing === null ? null : bearing(summary.finalBearing);
      const middle = summary.midpoint;

      let ellipsoid: ResultView['ellipsoid'] = null;
      if (vincenty.ok) {
        const ratio = vincenty.distanceKm > 0 ? summary.distanceKm / vincenty.distanceKm - 1 : 0;
        const percent = f.number(Math.abs(ratio), { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
        // Below 0.005 % both round to the same figure: say so instead of "0.00% shorter".
        const comparison =
          Math.abs(ratio) < 0.00005
            ? m.result.sphereSame
            : ratio < 0
              ? m.result.sphereShorter(percent)
              : m.result.sphereLonger(percent);
        ellipsoid = { distance: distanceWithUnit(vincenty.distanceKm, unit), comparison };
      }

      const notes: string[] = [];
      if (summary.relation === 'coincident') notes.push(m.result.notes.coincident);
      if (summary.relation === 'antipodal') notes.push(m.result.notes.antipodal);
      if (summary.atPole.a) notes.push(m.result.notes.poleA);
      if (summary.atPole.b) notes.push(m.result.notes.poleB);
      if (!vincenty.ok) notes.push(m.result.notes.vincenty);

      const spoken = `${distance.value} ${distance.unitName}`;
      return {
        distance,
        others,
        initialBearing: initial,
        finalBearing: final,
        midpoint: middle
          ? {
              decimal: [decimal(middle.lat, 'lat'), decimal(middle.lon, 'lon')],
              dms: [dms(middle.lat, 'lat'), dms(middle.lon, 'lon')],
            }
          : null,
        angle: {
          degrees: `${fixed(toDegrees(summary.angle), 2)}°`,
          radians: `${fixed(summary.angle, 4)}${NBSP}rad`,
        },
        ellipsoid,
        notes,
        view: m.figure.view[summary.relation],
        announcement: initial
          ? m.announce.result(spoken, `${initial.degrees}, ${initial.name}`)
          : m.announce.distance(spoken),
      };
    },
  };
}
