import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presenter } from '../src/scripts/tools/geo-distance/present.ts';
import { geoDistanceMessages } from '../src/i18n/tools/geo-distance.ts';
import { parseCoordinate } from '../src/lib/geo/parse.ts';
import { CITIES } from '../src/lib/geo/presets.ts';
import { greatCircle, type LatLon } from '../src/lib/geo/sphere.ts';
import { vincentyInverse } from '../src/lib/geo/vincenty.ts';

const NBSP = ' ';
const en = presenter('en');
const tr = presenter('tr');

function view(which: typeof en, a: LatLon, b: LatLon, unit: 'km' | 'mi' | 'nmi' = 'km') {
  return which.result(greatCircle(a, b), vincentyInverse(a, b), unit);
}

test('distances in the chosen unit, with the other two alongside', () => {
  const english = view(en, CITIES.london, CITIES['new-york']);
  assert.deepEqual(english.distance, { value: '5,570.2', unit: 'km', unitName: 'kilometers' });
  assert.equal(english.others, `3,461.2${NBSP}mi · 3,007.7${NBSP}nmi`);
  const turkish = view(tr, CITIES.london, CITIES['new-york'], 'nmi');
  assert.deepEqual(turkish.distance, { value: '3.007,7', unit: 'nmi', unitName: 'deniz mili' });
  assert.equal(turkish.others, `5.570,2${NBSP}km · 3.461,2${NBSP}mi`);
});

test('precision follows the size of the distance', () => {
  assert.equal(en.distanceNumber(349.356, 'km'), '349.4');
  assert.equal(en.distanceNumber(12.3456, 'km'), '12.35');
  assert.equal(en.distanceNumber(0.7423, 'km'), '0.742');
  assert.equal(en.distanceNumber(0, 'km'), '0');
  assert.equal(tr.distanceNumber(0.7423, 'km'), '0,742');
});

test('bearings with localized compass points, never 360°', () => {
  assert.deepEqual(en.bearing(309.27), { degrees: '309.3°', abbr: 'NW', name: 'northwest' });
  assert.deepEqual(tr.bearing(309.27), { degrees: '309,3°', abbr: 'KB', name: 'kuzeybatı' });
  assert.deepEqual(en.bearing(359.96), { degrees: '0.0°', abbr: 'N', name: 'north' });
  assert.deepEqual(tr.bearing(108.73), { degrees: '108,7°', abbr: 'DGD', name: 'doğu-güneydoğu' });
  assert.equal(en.spokenCompassName(en.bearing(90)), ', east');
  assert.equal(en.spokenCompassName(null), '');
});

test('coordinates in decimal degrees and DMS with localized hemisphere letters', () => {
  assert.equal(en.decimal(-33.8688, 'lat'), `33.8688°${NBSP}S`);
  assert.equal(tr.decimal(-33.8688, 'lat'), `33,8688°${NBSP}G`);
  assert.equal(tr.decimal(-74.006, 'lon'), `74,0060°${NBSP}B`);
  assert.equal(en.decimal(0.00001, 'lat'), '0.0000°');
  assert.equal(en.dms(41.0082, 'lat'), `41°00′29.5″${NBSP}N`);
  assert.equal(tr.dms(28.9784, 'lon'), `28°58′42,2″${NBSP}D`);
  assert.equal(en.dms(-74.006, 'lon'), `74°00′21.6″${NBSP}W`);
});

test('what the presenter prints, the parser reads back', () => {
  for (const which of [en, tr]) {
    for (const value of [41.0082, -33.8688, 0.5, -89.99]) {
      const back = parseCoordinate(which.dms(value, 'lat'), 'lat');
      assert.ok(back.ok && Math.abs(back.value - value) < 0.05 / 3600 + 1e-12, `${which.dms(value, 'lat')}`);
      const input = parseCoordinate(which.inputValue(value), 'lat');
      assert.ok(input.ok && input.value === value, which.inputValue(value));
    }
  }
  assert.equal(tr.inputValue(-74.006), '-74,006');
  assert.equal(en.inputValue(28.9784), '28.9784');
  assert.equal(en.inputValue(1234.5), '1234.5');
});

test('the ellipsoid comparison says which model is longer', () => {
  const eastWest = view(en, CITIES.istanbul, CITIES.ankara);
  assert.equal(eastWest.ellipsoid?.distance, `350.1${NBSP}km`);
  assert.equal(eastWest.ellipsoid?.comparison, '0.21% shorter on the sphere');
  const northSouth = view(tr, CITIES.tokyo, CITIES.sydney);
  assert.equal(northSouth.ellipsoid?.comparison, 'Kürede %0,43 daha uzun');
});

test('special cases come with notes, and undefined values are null', () => {
  const same = view(en, CITIES.tokyo, CITIES.tokyo);
  assert.equal(same.distance.value, '0');
  assert.equal(same.initialBearing, null);
  assert.deepEqual(same.notes, [geoDistanceMessages.en.result.notes.coincident]);
  assert.equal(same.view, geoDistanceMessages.en.figure.view.coincident);
  assert.equal(same.announcement, 'Distance 0 kilometers.');

  const opposite = view(tr, { lat: 0, lon: 0 }, { lat: 0, lon: 180 });
  assert.equal(opposite.midpoint, null);
  assert.equal(opposite.angle.degrees, '180,00°');
  assert.ok(opposite.notes.includes(geoDistanceMessages.tr.result.notes.antipodal));

  const stuck = view(en, { lat: 0, lon: 0 }, { lat: 0.5, lon: 179.7 });
  assert.equal(stuck.ellipsoid, null);
  assert.ok(stuck.notes.includes(geoDistanceMessages.en.result.notes.vincenty));

  const pole = view(en, { lat: 90, lon: 0 }, CITIES.london);
  assert.ok(pole.notes.includes(geoDistanceMessages.en.result.notes.poleA));
});

test('announcements read the distance and the initial bearing in words', () => {
  assert.equal(
    view(en, CITIES.istanbul, CITIES['new-york']).announcement,
    'Distance 8,069.8 kilometers. Initial bearing 309.3°, northwest.',
  );
  assert.equal(
    view(tr, CITIES.istanbul, CITIES['new-york'], 'mi').announcement,
    'Mesafe: 5.014,4 mil. Başlangıç yönü: 309,3°, kuzeybatı.',
  );
});

test('every parse error has a message in both languages', () => {
  const codes = [
    'empty',
    'syntax',
    'lat-range',
    'lon-range',
    'minutes-range',
    'seconds-range',
    'fraction',
    'sign-and-hemisphere',
    'wrong-axis',
    'multiple',
    'one-value',
    'too-many',
    'same-axis',
  ] as const;
  for (const which of [en, tr]) {
    for (const code of codes) {
      for (const axis of ['lat', 'lon'] as const) {
        const message = which.fieldError(code, axis);
        assert.ok(message.length > 10, `${code} (${axis})`);
      }
    }
  }
  assert.notEqual(en.fieldError('wrong-axis', 'lat'), en.fieldError('wrong-axis', 'lon'));
  assert.equal(tr.fieldError('empty', 'lon'), 'Boylamı girin.');
});
