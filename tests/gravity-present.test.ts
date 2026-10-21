import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY, EARTH_MASS, HOUR, MOON_MASS, TIME_SCALES, parseAmount } from '../src/lib/physics/gravity.ts';
import { presenter, superscript } from '../src/scripts/tools/gravity/present.ts';

const en = presenter('en');
const tr = presenter('tr');
const NBSP = ' ';

test('superscript exponents', () => {
  assert.equal(superscript(22), '²²');
  assert.equal(superscript(-11), '⁻¹¹');
  assert.equal(superscript(0), '⁰');
});

test('scientific notation beyond a million, plain numbers below', () => {
  assert.equal(en.scientific(7.342e22), `7.342${NBSP}×${NBSP}10²²`);
  assert.equal(tr.scientific(7.342e22), `7,342${NBSP}×${NBSP}10²²`);
  assert.equal(en.scientific(-3.8254e28), `−3.825${NBSP}×${NBSP}10²⁸`);
  assert.equal(en.scientific(6.6743e-11, 5), `6.6743${NBSP}×${NBSP}10⁻¹¹`);
  assert.equal(en.scientific(1000), '1,000');
  assert.equal(tr.scientific(1000), '1.000');
  // 9.99996e22 rounds up to 10.00: the exponent carries.
  assert.equal(en.scientific(9.99996e22), `1${NBSP}×${NBSP}10²³`);
});

test('masses in each unit, singular for exactly one', () => {
  assert.equal(en.mass(MOON_MASS), `7.342${NBSP}×${NBSP}10²²${NBSP}kg`);
  assert.equal(en.massIn(MOON_MASS, 'moon'), '1 Moon mass');
  assert.equal(en.massIn(2 * MOON_MASS, 'moon'), '2 Moon masses');
  assert.equal(en.massIn(MOON_MASS, 'earth'), '0.01229 Earth masses');
  assert.equal(tr.massIn(MOON_MASS, 'earth'), '0,01229 Dünya kütlesi');
  assert.deepEqual(en.equivalents(EARTH_MASS, 'earth'), [`5.972${NBSP}×${NBSP}10²⁴${NBSP}kg`, '81.34 Moon masses']);
});

test('mass fields read back as the same mass', () => {
  for (const presenterFor of [en, tr]) {
    for (const [kg, unit] of [
      [MOON_MASS, 'kg'],
      [MOON_MASS, 'moon'],
      [MOON_MASS, 'earth'],
      [1000, 'kg'],
      [1000, 'earth'],
      [1.898e27, 'earth'],
    ] as const) {
      const text = presenterFor.massField(kg, unit);
      const value = parseAmount(text)!;
      const back = value * (unit === 'kg' ? 1 : unit === 'earth' ? EARTH_MASS : MOON_MASS);
      assert.ok(Math.abs(back - kg) / kg < 1e-3, `${text} (${unit}) → ${back}, expected ${kg}`);
    }
  }
  assert.equal(en.massField(MOON_MASS, 'kg'), '7.342e22');
  assert.equal(tr.massField(MOON_MASS, 'kg'), '7,342e22');
  assert.equal(en.massField(MOON_MASS, 'moon'), '1');
});

test('distances, speeds and durations', () => {
  assert.equal(en.distance(384_400e3), `384,400${NBSP}km`);
  assert.equal(tr.distance(384_400e3), `384.400${NBSP}km`);
  assert.equal(en.distance(42_500), `42.5${NBSP}km`);
  assert.equal(en.speed(1022), `1.02${NBSP}km/s`);
  assert.equal(tr.speed(1022), `1,02${NBSP}km/s`);
  assert.equal(en.speed(12.5), `12.5${NBSP}m/s`);
  assert.equal(en.duration(27.3 * DAY), `27${NBSP}d 7${NBSP}h`);
  assert.equal(tr.duration(27.3 * DAY), `27${NBSP}gün 7${NBSP}sa`);
  assert.equal(en.duration(23.934 * HOUR), `23${NBSP}h 56${NBSP}min`);
  assert.equal(en.duration(2 * DAY), `2${NBSP}d`);
  assert.equal(en.duration(42), `42${NBSP}s`);
});

test('time scales in words', () => {
  assert.deepEqual(
    TIME_SCALES.map((seconds) => en.timeAmount(seconds)),
    ['1 minute', '5 minutes', '15 minutes', '30 minutes', '1 hour', '3 hours', '6 hours', '12 hours', '1 day', '2 days', '5 days', '10 days'],
  );
  assert.equal(en.timeScale(2 * DAY), '2 days per second');
  assert.equal(tr.timeScale(2 * DAY), 'saniyede 2 gün');
  assert.equal(tr.timeScale(HOUR), 'saniyede 1 saat');
});

test('energy and its drift', () => {
  assert.equal(en.energy(-3.8254e28), `−3.825${NBSP}×${NBSP}10²⁸${NBSP}J`);
  assert.equal(en.drift(2.43e-8), `+2.4${NBSP}×${NBSP}10⁻⁸`);
  assert.equal(en.drift(-2.43e-8), `−2.4${NBSP}×${NBSP}10⁻⁸`);
  assert.equal(en.drift(0), '0');
});
