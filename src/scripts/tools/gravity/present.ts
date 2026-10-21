/**
 * Turns the gravity simulator's numbers into the strings it shows, in one locale. Pure (no DOM),
 * so the tests can check it.
 *
 * Precision follows what the numbers mean: masses and energies span dozens of orders of
 * magnitude, so they are written in scientific notation with four significant digits
 * ("7.342 × 10²² kg"); distances to the kilometre; speeds to three significant digits; the
 * energy drift, which is tiny when all is well, in scientific notation with two.
 */
import type { Locale } from '../../../i18n/config.ts';
import { formatters } from '../../../i18n/format.ts';
import { gravityMessages } from '../../../i18n/tools/gravity.ts';
import { DAY, EARTH_MASS, HOUR, MINUTE, MOON_MASS, type MassUnit } from '../../../lib/physics/gravity.ts';

/** No-break space: keeps a number with its unit. */
const NBSP = ' ';
const MINUS = '−';
const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';

export function superscript(exponent: number): string {
  const digits = String(Math.abs(exponent)).replace(/\d/g, (d) => SUPERSCRIPT[Number(d)]!);
  return exponent < 0 ? `⁻${digits}` : digits;
}

export type Presenter = ReturnType<typeof presenter>;

export function presenter(locale: Locale) {
  const m = gravityMessages[locale];
  const f = formatters(locale);

  /** A number with up to `digits` significant digits, with a real minus sign. */
  const significant = (value: number, digits: number) =>
    f.number(value, { maximumSignificantDigits: digits }).replace('-', MINUS);

  /**
   * 1234 → "1,234"; 7.342e22 → "7.342 × 10²²"; 2.4e-8 → "2.4 × 10⁻⁸". Plain notation from 0.001
   * up to a million, scientific beyond.
   */
  function scientific(value: number, digits = 4): string {
    if (value === 0 || !Number.isFinite(value)) return f.number(value);
    const magnitude = Math.abs(value);
    if (magnitude >= 1e-3 && magnitude < 1e6) return significant(value, digits);
    let exponent = Math.floor(Math.log10(magnitude));
    let mantissa = Number((value / 10 ** exponent).toPrecision(digits));
    // 9.9996e22 rounds to "10.00 × 10²²": carry into the exponent.
    if (Math.abs(mantissa) >= 10) {
      mantissa /= 10;
      exponent += 1;
    }
    return `${significant(mantissa, digits)}${NBSP}×${NBSP}10${superscript(exponent)}`;
  }

  /** "7.342 × 10²² kg" */
  const mass = (kg: number) => `${scientific(kg)}${NBSP}kg`;

  /** The mass in one unit: "7.342 × 10²² kg", "0.0123 Earth masses", "1 Moon mass". */
  function massIn(kg: number, unit: MassUnit): string {
    if (unit === 'kg') return mass(kg);
    const value = kg / (unit === 'earth' ? EARTH_MASS : MOON_MASS);
    const text = scientific(value, 4);
    const one = Math.abs(value - 1) < 5e-5;
    return unit === 'earth' ? m.units.earthMasses(text, one) : m.units.moonMasses(text, one);
  }

  /** The other two units of a mass, for the line under a mass field. */
  const equivalents = (kg: number, unit: MassUnit) =>
    (['kg', 'earth', 'moon'] as const).filter((other) => other !== unit).map((other) => massIn(kg, other));

  /**
   * A mass in a unit as an editable field value that parseAmount reads back: "1", "0.0123",
   * "7.342e22" (with a decimal comma in Turkish).
   */
  function massField(kg: number, unit: MassUnit): string {
    const value = unit === 'kg' ? kg : kg / (unit === 'earth' ? EARTH_MASS : MOON_MASS);
    const magnitude = Math.abs(value);
    const text =
      magnitude !== 0 && (magnitude < 1e-3 || magnitude >= 1e6)
        ? value.toExponential(3).replace(/\.?0+e/, 'e').replace('e+', 'e')
        : String(Number(value.toPrecision(4)));
    return locale === 'tr' ? text.replace('.', ',') : text;
  }

  /** "384,400 km"; one decimal below 100 km. */
  function distance(metres: number): string {
    const km = metres / 1000;
    const digits = Math.abs(km) < 100 ? 1 : 0;
    return `${f.number(km, { maximumFractionDigits: digits, minimumFractionDigits: digits }).replace('-', MINUS)}${NBSP}km`;
  }

  /** "1.02 km/s", or "45 m/s" below 0.1 km/s. */
  function speed(metresPerSecond: number): string {
    if (Math.abs(metresPerSecond) < 100) return `${significant(metresPerSecond, 3)}${NBSP}m/s`;
    return `${f.number(metresPerSecond / 1000, { minimumSignificantDigits: 3, maximumSignificantDigits: 3 }).replace('-', MINUS)}${NBSP}km/s`;
  }

  /** "27 d 2 h", "23 h 56 min", "4 min 10 s", "12 s". */
  function duration(seconds: number): string {
    const s = Math.max(0, Math.round(seconds));
    const u = m.units;
    const join = (a: number, ua: string, b: number, ub: string) =>
      b === 0 ? `${f.number(a)}${NBSP}${ua}` : `${f.number(a)}${NBSP}${ua} ${f.number(b)}${NBSP}${ub}`;
    if (s >= DAY) {
      const days = Math.floor(s / DAY);
      return join(days, u.d, Math.round((s - days * DAY) / HOUR) % 24, u.h);
    }
    if (s >= HOUR) {
      const hours = Math.floor(s / HOUR);
      return join(hours, u.h, Math.round((s - hours * HOUR) / MINUTE) % 60, u.min);
    }
    if (s >= MINUTE) {
      const minutes = Math.floor(s / MINUTE);
      return join(minutes, u.min, s - minutes * MINUTE, u.s);
    }
    return `${f.number(s)}${NBSP}${u.s}`;
  }

  /** A time-scale stop in words: "1 minute", "12 hours", "2 days". */
  function timeAmount(seconds: number): string {
    const [count, word] =
      seconds >= DAY
        ? [seconds / DAY, m.units.day]
        : seconds >= HOUR
          ? [seconds / HOUR, m.units.hour]
          : [seconds / MINUTE, m.units.minute];
    return word(f.number(count, { maximumFractionDigits: 2 }), count === 1);
  }

  /** "2 days per second" / "saniyede 2 gün". */
  const timeScale = (seconds: number) => m.transport.perSecond(timeAmount(seconds));

  /** "−3.814 × 10²⁸ J" */
  const energy = (joules: number) => `${scientific(joules, 4)}${NBSP}J`;

  /** "+2.4 × 10⁻⁸", "0" — the relative energy change, signed. */
  function drift(fraction: number): string {
    if (fraction === 0 || !Number.isFinite(fraction)) return '0';
    const text = scientific(fraction, 2);
    return fraction > 0 ? `+${text}` : text;
  }

  const eccentricity = (e: number) => f.number(e, { maximumFractionDigits: 3, minimumFractionDigits: 3 });

  return {
    scientific,
    mass,
    massIn,
    equivalents,
    massField,
    distance,
    speed,
    duration,
    timeAmount,
    timeScale,
    energy,
    drift,
    eccentricity,
  };
}
