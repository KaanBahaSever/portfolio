import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pairInField, parseCoordinate, parsePair, type Axis, type ParseErrorCode } from '../src/lib/geo/parse.ts';
import { hemisphereOf, toDms } from '../src/lib/geo/dms.ts';

const EPSILON = 1e-12;

function value(text: string, axis: Axis): number {
  const result = parseCoordinate(text, axis);
  assert.ok(result.ok, `${JSON.stringify(text)} (${axis}) failed with ${result.ok ? '' : result.code}`);
  return result.value;
}

function error(text: string, axis: Axis): ParseErrorCode {
  const result = parseCoordinate(text, axis);
  assert.equal(result.ok, false, `${JSON.stringify(text)} (${axis}) should fail`);
  return result.ok ? 'empty' : result.code;
}

function pair(text: string) {
  const result = parsePair(text);
  assert.ok(result.ok, `${JSON.stringify(text)} failed with ${result.ok ? '' : result.code}`);
  return result.value;
}

function pairError(text: string): ParseErrorCode {
  const result = parsePair(text);
  assert.equal(result.ok, false, `${JSON.stringify(text)} should fail`);
  return result.ok ? 'empty' : result.code;
}

function near(actual: number, expected: number, message = ''): void {
  assert.ok(Math.abs(actual - expected) < EPSILON, `${message} expected ${expected}, got ${actual}`.trim());
}

const ISTANBUL_DMS_LAT = 41 + 0 / 60 + 29.5 / 3600;
const ISTANBUL_DMS_LON = 28 + 58 / 60 + 42.2 / 3600;

test('decimal degrees, signed or with a hemisphere letter before or after', () => {
  assert.equal(value('41.0082', 'lat'), 41.0082);
  assert.equal(value('  41.0082  ', 'lat'), 41.0082);
  assert.equal(value('+41.0082', 'lat'), 41.0082);
  assert.equal(value('-33.8688', 'lat'), -33.8688);
  assert.equal(value('33.8688 S', 'lat'), -33.8688);
  assert.equal(value('33.8688S', 'lat'), -33.8688);
  assert.equal(value('S 33.8688', 'lat'), -33.8688);
  assert.equal(value('s33.8688', 'lat'), -33.8688);
  assert.equal(value('74.006 W', 'lon'), -74.006);
  assert.equal(value('W74.006', 'lon'), -74.006);
  assert.equal(value('151.2093° E', 'lon'), 151.2093);
  assert.equal(value('.5', 'lat'), 0.5);
  assert.equal(value('41', 'lat'), 41);
});

test('dashes and the Unicode minus sign are minus signs', () => {
  assert.equal(value('−33.8688', 'lat'), -33.8688);
  assert.equal(value('–33.8688', 'lat'), -33.8688);
  assert.equal(value('− 33.8688', 'lat'), -33.8688);
});

test('zero is never negative', () => {
  assert.ok(Object.is(value('-0', 'lat'), 0));
  assert.ok(Object.is(value('0 W', 'lon'), 0));
});

test('degrees, minutes and seconds with typographic marks', () => {
  near(value('41°00′29.5″N', 'lat'), ISTANBUL_DMS_LAT);
  near(value('28°58′42.2″E', 'lon'), ISTANBUL_DMS_LON);
  near(value('41° 00′ 29.5″ N', 'lat'), ISTANBUL_DMS_LAT);
  near(value('N 41°00′29.5″', 'lat'), ISTANBUL_DMS_LAT);
  near(value('33°52′07.7″S', 'lat'), -(33 + 52 / 60 + 7.7 / 3600));
  near(value('-33°52′07.7″', 'lat'), -(33 + 52 / 60 + 7.7 / 3600));
  // º (ordinal) and ˚ (ring) are often typed for the degree sign.
  near(value('41º00′29.5″N', 'lat'), ISTANBUL_DMS_LAT);
  near(value('41˚00′29.5″N', 'lat'), ISTANBUL_DMS_LAT);
});

test('degrees, minutes and seconds with ASCII and other common marks', () => {
  near(value(`41°00'29.5"N`, 'lat'), ISTANBUL_DMS_LAT);
  near(value(`41°00’29.5”N`, 'lat'), ISTANBUL_DMS_LAT);
  // Two apostrophes (or two primes) make a second mark.
  near(value(`41°00'29.5''N`, 'lat'), ISTANBUL_DMS_LAT);
  near(value('41°00′29.5′′N', 'lat'), ISTANBUL_DMS_LAT);
});

test('bare numbers continue as minutes and seconds within one value', () => {
  near(value('41 00 29.5 N', 'lat'), ISTANBUL_DMS_LAT);
  near(value('41 00 29.5', 'lat'), ISTANBUL_DMS_LAT);
  near(value('41 30', 'lat'), 41.5);
  // A marked part fixes its unit, and the next bare number follows it.
  near(value('41° 30', 'lat'), 41.5);
  near(value('41 30″', 'lat'), 41 + 30 / 3600);
});

test('degrees and decimal minutes', () => {
  near(value('41°0.4917′N', 'lat'), 41 + 0.4917 / 60);
  near(value('41 0.4917 N', 'lat'), 41 + 0.4917 / 60);
});

test('Turkish hemisphere letters, in either case', () => {
  near(value('41°00′29.5″K', 'lat'), ISTANBUL_DMS_LAT);
  near(value('33.8688 G', 'lat'), -33.8688);
  near(value('28°58′42.2″D', 'lon'), ISTANBUL_DMS_LON);
  near(value('74.006 B', 'lon'), -74.006);
  near(value('74.006 b', 'lon'), -74.006);
  near(value('k 41.0082', 'lat'), 41.0082);
});

test('a decimal comma when there is no decimal point', () => {
  assert.equal(value('41,0082', 'lat'), 41.0082);
  assert.equal(value('-74,006', 'lon'), -74.006);
  near(value('41°00′29,5″K', 'lat'), ISTANBUL_DMS_LAT);
  near(value('41°0,4917′', 'lat'), 41 + 0.4917 / 60);
});

test('the limits are inclusive', () => {
  assert.equal(value('90', 'lat'), 90);
  assert.equal(value('-90', 'lat'), -90);
  assert.equal(value('90°00′00″S', 'lat'), -90);
  assert.equal(value('180', 'lon'), 180);
  assert.equal(value('-180', 'lon'), -180);
  assert.equal(value('180 W', 'lon'), -180);
});

test('out of range', () => {
  assert.equal(error('90.0001', 'lat'), 'lat-range');
  assert.equal(error('-91', 'lat'), 'lat-range');
  assert.equal(error('90°00′00.1″N', 'lat'), 'lat-range');
  assert.equal(error('180.5', 'lon'), 'lon-range');
  assert.equal(error('181 E', 'lon'), 'lon-range');
  // Latitudes above 90 are fine as longitudes.
  assert.equal(value('120', 'lon'), 120);
});

test('minutes and seconds stay below 60', () => {
  assert.equal(error('41°60′', 'lat'), 'minutes-range');
  assert.equal(error('41 75 00', 'lat'), 'minutes-range');
  assert.equal(error('41°00′60″', 'lat'), 'seconds-range');
  assert.equal(error('41 00 60.0', 'lat'), 'seconds-range');
  near(value('41°59′59.99″', 'lat'), 41 + 59 / 60 + 59.99 / 3600);
});

test('only the last part may have decimals', () => {
  assert.equal(error('41.5°30′', 'lat'), 'fraction');
  assert.equal(error('41°30.5′15″', 'lat'), 'fraction');
  assert.equal(error('41.5 30', 'lat'), 'fraction');
});

test('a minus sign and a hemisphere letter together are a contradiction', () => {
  assert.equal(error('-41 S', 'lat'), 'sign-and-hemisphere');
  assert.equal(error('−41 N', 'lat'), 'sign-and-hemisphere');
  assert.equal(error('N -41', 'lat'), 'sign-and-hemisphere');
  // A plus sign with a letter is redundant, not contradictory.
  assert.equal(value('+41 S', 'lat'), -41);
});

test('a letter for the other axis', () => {
  assert.equal(error('28°58′42.2″E', 'lat'), 'wrong-axis');
  assert.equal(error('28.9784 D', 'lat'), 'wrong-axis');
  assert.equal(error('41.0082 N', 'lon'), 'wrong-axis');
  assert.equal(error('41.0082 K', 'lon'), 'wrong-axis');
});

test('two values in a single field', () => {
  assert.equal(error('41.0082, 28.9784', 'lat'), 'multiple');
  assert.equal(error('41°00′29.5″N 28°58′42.2″E', 'lat'), 'multiple');
  assert.equal(error('41,0082; 28,9784', 'lat'), 'multiple');
  assert.equal(error('41° 28°', 'lat'), 'multiple');
});

test('what is not a coordinate', () => {
  assert.equal(error('', 'lat'), 'empty');
  assert.equal(error('   ', 'lat'), 'empty');
  for (const text of ['abc', 'North 41', '41 North', '41°°', '°41', '41 00 29 5', '--41', '41..5', ',41', '41,,', 'N', '-', '41 N S', '41x']) {
    assert.equal(error(text, 'lat'), 'syntax', JSON.stringify(text));
  }
});

test('pairs: the formats map apps and people use', () => {
  assert.deepEqual(pair('41.0082, 28.9784'), { lat: 41.0082, lon: 28.9784, latText: '41.0082', lonText: '28.9784' });
  assert.deepEqual(pair('41.0082,28.9784'), { lat: 41.0082, lon: 28.9784, latText: '41.0082', lonText: '28.9784' });
  assert.deepEqual(pair('41.0082 28.9784'), { lat: 41.0082, lon: 28.9784, latText: '41.0082', lonText: '28.9784' });
  assert.deepEqual(pair('41.0082; 28.9784'), { lat: 41.0082, lon: 28.9784, latText: '41.0082', lonText: '28.9784' });
  assert.deepEqual(pair('41.0082/28.9784'), { lat: 41.0082, lon: 28.9784, latText: '41.0082', lonText: '28.9784' });
  const southWest = pair('-33.8688 −70.6693');
  assert.equal(southWest.lat, -33.8688);
  assert.equal(southWest.lon, -70.6693);
  // The text of each part is kept as written, Unicode minus included.
  assert.equal(southWest.lonText, '−70.6693');
});

test('pairs in degrees, minutes and seconds', () => {
  const dms = pair('41°00′29.5″N 28°58′42.2″E');
  near(dms.lat, ISTANBUL_DMS_LAT);
  near(dms.lon, ISTANBUL_DMS_LON);
  assert.equal(dms.latText, '41°00′29.5″N');
  assert.equal(dms.lonText, '28°58′42.2″E');
  const ascii = pair(`41°00'29.5"N, 28°58'42.2"E`);
  near(ascii.lat, ISTANBUL_DMS_LAT);
  assert.equal(ascii.lonText, `28°58'42.2"E`);
  const leading = pair('N 41°00′29.5″ E 28°58′42.2″');
  near(leading.lon, ISTANBUL_DMS_LON);
  assert.equal(leading.lonText, 'E 28°58′42.2″');
  const noLetters = pair('41°00′ 28°58′');
  assert.equal(noLetters.lat, 41);
  near(noLetters.lon, 28 + 58 / 60);
  const bare = pair('41 00 29.5 N 28 58 42.2 E');
  near(bare.lat, ISTANBUL_DMS_LAT);
  near(bare.lon, ISTANBUL_DMS_LON);
});

test('pairs the other way round follow their letters', () => {
  const swapped = pair('28.9784 E, 41.0082 N');
  assert.equal(swapped.lat, 41.0082);
  assert.equal(swapped.lon, 28.9784);
  assert.equal(swapped.latText, '41.0082 N');
  assert.equal(swapped.lonText, '28.9784 E');
  assert.equal(pair('151.2093 E -33.8688').lat, -33.8688);
});

test('pairs with Turkish decimal commas and letters', () => {
  assert.deepEqual(pair('41,0082 28,9784'), { lat: 41.0082, lon: 28.9784, latText: '41,0082', lonText: '28,9784' });
  assert.deepEqual(pair('41,0082; 28,9784'), { lat: 41.0082, lon: 28.9784, latText: '41,0082', lonText: '28,9784' });
  assert.deepEqual(pair('41,0082, 28,9784'), { lat: 41.0082, lon: 28.9784, latText: '41,0082', lonText: '28,9784' });
  const dms = pair('41°00′29,5″K 28°58′42,2″D');
  near(dms.lat, ISTANBUL_DMS_LAT);
  near(dms.lon, ISTANBUL_DMS_LON);
  // One comma between whole numbers separates them.
  assert.deepEqual(pair('41,29'), { lat: 41, lon: 29, latText: '41', lonText: '29' });
});

test('pair errors', () => {
  assert.equal(pairError(''), 'empty');
  assert.equal(pairError('41.0082'), 'one-value');
  assert.equal(pairError('41 28 3'), 'too-many');
  assert.equal(pairError('41.0082, 28.9784, 10'), 'too-many');
  assert.equal(pairError('41 N 42 S'), 'same-axis');
  assert.equal(pairError('28 E, 29 W'), 'same-axis');
  assert.equal(pairError('95, 28'), 'lat-range');
  assert.equal(pairError('41, 190'), 'lon-range');
  assert.equal(pairError('41.5°30′, 28'), 'fraction');
  assert.equal(pairError('41.0082, x'), 'syntax');
});

test('a whole pair in one field is split, in either field of a point', () => {
  const cases: Array<[string, Axis, { lat: number; lon: number; latText: string; lonText: string }]> = [
    ['41.0082, 28.9784', 'lat', { lat: 41.0082, lon: 28.9784, latText: '41.0082', lonText: '28.9784' }],
    ['41.0082 28.9784', 'lon', { lat: 41.0082, lon: 28.9784, latText: '41.0082', lonText: '28.9784' }],
    ['41,0082, 28,9784', 'lat', { lat: 41.0082, lon: 28.9784, latText: '41,0082', lonText: '28,9784' }],
    ['41,0082 28,9784', 'lon', { lat: 41.0082, lon: 28.9784, latText: '41,0082', lonText: '28,9784' }],
    ['41,0082; 28,9784', 'lat', { lat: 41.0082, lon: 28.9784, latText: '41,0082', lonText: '28,9784' }],
    ['41 N 28', 'lat', { lat: 41, lon: 28, latText: '41 N', lonText: '28' }],
    ['28.9784 E, 41.0082 N', 'lon', { lat: 41.0082, lon: 28.9784, latText: '41.0082 N', lonText: '28.9784 E' }],
    ['41 100', 'lat', { lat: 41, lon: 100, latText: '41', lonText: '100' }],
  ];
  for (const [text, axis, expected] of cases) {
    assert.deepEqual(pairInField(text, axis), expected, `${JSON.stringify(text)} in ${axis}`);
  }
  const dms = pairInField('41°00′29.5″N 28°58′42.2″E', 'lat');
  assert.ok(dms);
  assert.equal(dms.latText, '41°00′29.5″N');
  assert.equal(dms.lonText, '28°58′42.2″E');
  const turkish = pairInField('41°00′29,5″K 28°58′42,2″D', 'lon');
  assert.ok(turkish);
  near(turkish.lat, ISTANBUL_DMS_LAT);
  near(turkish.lon, ISTANBUL_DMS_LON);
});

test('a single value stays in its field, valid or not', () => {
  // Valid values are never split: "41,29" is 41.29 and "41 30" is 41°30′ in one field.
  for (const [text, axis] of [['41,29', 'lat'], ['41,29', 'lon'], ['41 30', 'lat'], ['41.0082', 'lat']] as const) {
    assert.equal(pairInField(text, axis), null, `${JSON.stringify(text)} in ${axis}`);
  }
  assert.equal(pairInField('', 'lat'), null);
  assert.equal(pairInField('abc', 'lat'), null);
  // One value with a mistake keeps its text and its own error: a decimal comma is never
  // re-read as the separator between two values.
  const mistakes: Array<[string, Axis, ParseErrorCode]> = [
    ['41,0082 K', 'lon', 'wrong-axis'],
    ['41°00′29,5″K', 'lon', 'wrong-axis'],
    ['28°58′42,2″K', 'lon', 'wrong-axis'],
    ['45,5 E', 'lat', 'wrong-axis'],
    ['41,5°30′', 'lat', 'fraction'],
    ['-41,0082 G', 'lat', 'sign-and-hemisphere'],
    ['41.0082 K', 'lon', 'wrong-axis'],
    ['41.5°30′', 'lat', 'fraction'],
    ['-41.0082 S', 'lat', 'sign-and-hemisphere'],
  ];
  for (const [text, axis, code] of mistakes) {
    assert.equal(pairInField(text, axis), null, `${JSON.stringify(text)} in ${axis} should not split`);
    assert.equal(error(text, axis), code, JSON.stringify(text));
  }
  // An invalid pair is not spread over the fields either.
  assert.equal(pairInField('95, 28', 'lat'), null);
  assert.equal(pairInField('41 N 42 S', 'lat'), null);
});

test('toDms splits and rounds with carries', () => {
  assert.deepEqual(toDms(41.0082, 'lat'), { degrees: 41, minutes: 0, seconds: 29.5, hemisphere: 'N' });
  assert.deepEqual(toDms(28.9784, 'lon'), { degrees: 28, minutes: 58, seconds: 42.2, hemisphere: 'E' });
  assert.deepEqual(toDms(-33.8688, 'lat'), { degrees: 33, minutes: 52, seconds: 7.7, hemisphere: 'S' });
  assert.deepEqual(toDms(-74.006, 'lon'), { degrees: 74, minutes: 0, seconds: 21.6, hemisphere: 'W' });
  // 10.999999° is 10°59′59.9964″: rounds up through the seconds and minutes.
  assert.deepEqual(toDms(10.999999, 'lat'), { degrees: 11, minutes: 0, seconds: 0, hemisphere: 'N' });
  // A value that rounds to zero is not "south".
  assert.deepEqual(toDms(-0.00000001, 'lat'), { degrees: 0, minutes: 0, seconds: 0, hemisphere: 'N' });
  assert.deepEqual(toDms(180, 'lon', 0), { degrees: 180, minutes: 0, seconds: 0, hemisphere: 'E' });
  assert.equal(hemisphereOf(-1, 'lon'), 'W');
  assert.equal(hemisphereOf(0, 'lat'), 'N');
});

test('what toDms prints parses back to within the rounding', () => {
  for (let lat = -90; lat <= 90; lat += 7.123457) {
    const parts = toDms(lat, 'lat');
    const text = `${parts.degrees}°${parts.minutes}′${parts.seconds}″${parts.hemisphere}`;
    const back = value(text, 'lat');
    assert.ok(Math.abs(back - lat) <= 0.05 / 3600 + EPSILON, `${lat} → ${text} → ${back}`);
  }
});
