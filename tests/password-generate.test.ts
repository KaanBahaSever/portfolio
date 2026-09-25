import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHARSETS,
  CHARSET_NAMES,
  DEFAULT_OPTIONS,
  LOOK_ALIKES,
  MAX_LENGTH,
  MIN_LENGTH,
  STRENGTH_LEVELS,
  characterKind,
  characterPool,
  entropyBits,
  generatePassword,
  randomInt,
  strength,
} from '../src/lib/password/generate.ts';
import type { PasswordOptions, RandomSource, StrengthLevel } from '../src/lib/password/generate.ts';
import { passwordMessages } from '../src/i18n/tools/password-generator.ts';

/** Deterministic 32-bit PRNG (mulberry32), so statistical checks can never flake. */
function seeded(seed: number): RandomSource {
  let state = seed >>> 0;
  return (array) => {
    for (let i = 0; i < array.length; i++) {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      array[i] = (t ^ (t >>> 14)) >>> 0;
    }
    return array;
  };
}

/** Returns the given values in order, then fails the test if more are requested. */
function scripted(values: number[]): RandomSource & { calls: number } {
  const source = ((array: Uint32Array) => {
    const value = values[source.calls];
    source.calls++;
    if (value === undefined) throw new Error('scripted source exhausted');
    array[0] = value;
    return array;
  }) as RandomSource & { calls: number };
  source.calls = 0;
  return source;
}

function options(overrides: Partial<PasswordOptions> = {}): PasswordOptions {
  return { ...DEFAULT_OPTIONS, ...overrides };
}

const ALL_TYPE_COMBINATIONS: Array<Pick<PasswordOptions, 'lowercase' | 'uppercase' | 'numbers' | 'symbols'>> = [];
for (let mask = 1; mask < 16; mask++) {
  ALL_TYPE_COMBINATIONS.push({
    lowercase: (mask & 1) !== 0,
    uppercase: (mask & 2) !== 0,
    numbers: (mask & 4) !== 0,
    symbols: (mask & 8) !== 0,
  });
}

// ------------------------------------------------------------------ character sets

test('character sets are disjoint, have no duplicates and the expected sizes', () => {
  assert.equal(CHARSETS.lowercase.length, 26);
  assert.equal(CHARSETS.uppercase.length, 26);
  assert.equal(CHARSETS.numbers.length, 10);
  const all = CHARSET_NAMES.map((name) => CHARSETS[name]).join('');
  assert.equal(new Set(all).size, all.length);
});

test('symbols avoid characters that paste badly into password fields', () => {
  for (const unsafe of [' ', "'", '"', '`', '\\', '<', '>', '&']) {
    assert.ok(!CHARSETS.symbols.includes(unsafe), `symbols must not contain ${JSON.stringify(unsafe)}`);
  }
  assert.match(CHARSETS.symbols, /^[\x21-\x7e]+$/, 'printable ASCII only');
});

test('look-alikes cover I l 1 O 0 o |', () => {
  for (const char of ['I', 'l', '1', 'O', '0', 'o', '|']) {
    assert.ok(LOOK_ALIKES.includes(char), `missing ${char}`);
  }
});

// ------------------------------------------------------------------ randomInt

test('randomInt rejects invalid bounds', () => {
  for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 32 + 1]) {
    assert.throws(() => randomInt(bad, seeded(1)), RangeError, `bound ${bad}`);
  }
});

test('randomInt(1) is always 0 and draws nothing', () => {
  const source = scripted([]);
  assert.equal(randomInt(1, source), 0);
  assert.equal(source.calls, 0);
});

test('randomInt never leaves the range', () => {
  const random = seeded(42);
  for (const max of [2, 3, 7, 10, 26, 90, 1000, 2 ** 31 + 1, 2 ** 32]) {
    for (let i = 0; i < 2000; i++) {
      const value = randomInt(max, random);
      assert.ok(Number.isInteger(value) && value >= 0 && value < max, `randomInt(${max}) gave ${value}`);
    }
  }
});

test('randomInt draws again for values that would bias the result', () => {
  // 2^32 = 3 × 1431655765 + 1, so only 0xFFFFFFFF is outside the unbiased range for 3.
  const source = scripted([0xffffffff, 5]);
  assert.equal(randomInt(3, source), 2);
  assert.equal(source.calls, 2);

  // The largest accepted value maps normally.
  const edge = scripted([0xfffffffe]);
  assert.equal(randomInt(3, edge), 0xfffffffe % 3);
  assert.equal(edge.calls, 1);

  // 3 × 2^30: every value from 3 × 2^30 up is rejected (a quarter of the 32-bit range).
  const big = scripted([3_500_000_000, 0xffffffff, 3 * 2 ** 30, 3 * 2 ** 30 - 1]);
  assert.equal(randomInt(3 * 2 ** 30, big), 3 * 2 ** 30 - 1);
  assert.equal(big.calls, 4);

  // Powers of two never reject.
  const pow = scripted([0xffffffff]);
  assert.equal(randomInt(2 ** 32, pow), 0xffffffff);
  assert.equal(randomInt(16, scripted([0xffffffff])), 15);
});

test('randomInt fails loudly for a broken random source', () => {
  assert.throws(() => randomInt(3, (array) => array.fill(0xffffffff)), /rejected values/);
  assert.throws(() => randomInt(3, () => new Uint32Array(0)), /no values/);
});

test('randomInt is roughly uniform (chi-square, deterministic source)', () => {
  const random = seeded(2026);
  for (const max of [7, 90]) {
    const draws = max * 5000;
    const counts = new Array<number>(max).fill(0);
    for (let i = 0; i < draws; i++) counts[randomInt(max, random)]!++;
    const expected = draws / max;
    const chiSquare = counts.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0);
    // Critical values at p = 0.001: df 6 → 22.46, df 89 → 135.98.
    const critical = max === 7 ? 22.46 : 135.98;
    assert.ok(chiSquare < critical, `chi-square ${chiSquare.toFixed(2)} for randomInt(${max})`);
    for (const count of counts) {
      assert.ok(Math.abs(count - expected) / expected < 0.08, `count ${count}, expected ${expected}`);
    }
  }
});

test('randomInt uses the Web Crypto API by default', () => {
  for (let i = 0; i < 200; i++) {
    const value = randomInt(10);
    assert.ok(value >= 0 && value < 10);
  }
});

// ------------------------------------------------------------------ generatePassword

test('generatePassword returns exactly the requested length', () => {
  const random = seeded(7);
  for (const length of [MIN_LENGTH, 5, 12, 20, 64, MAX_LENGTH]) {
    for (const requireEachType of [true, false]) {
      assert.equal(generatePassword(options({ length, requireEachType }), random).length, length);
    }
  }
});

test('generatePassword uses only pool characters for every combination of options', () => {
  const random = seeded(11);
  for (const types of ALL_TYPE_COMBINATIONS) {
    for (const excludeLookAlikes of [false, true]) {
      for (const requireEachType of [false, true]) {
        const opts = options({ ...types, excludeLookAlikes, requireEachType, length: 64 });
        const pool = characterPool(opts);
        for (let i = 0; i < 20; i++) {
          for (const char of generatePassword(opts, random)) {
            assert.ok(pool.includes(char), `${JSON.stringify(char)} is not in the pool for ${JSON.stringify(opts)}`);
          }
        }
      }
    }
  }
});

test('the pool is the union of enabled sets', () => {
  assert.equal(characterPool(options({ uppercase: false, symbols: false })), CHARSETS.lowercase + CHARSETS.numbers);
  assert.equal(
    characterPool(options({ lowercase: false, uppercase: false, symbols: false, excludeLookAlikes: true })),
    '23456789',
  );
});

test('requireEachType puts every selected type in even the shortest password', () => {
  const random = seeded(3);
  for (const types of ALL_TYPE_COMBINATIONS) {
    for (const excludeLookAlikes of [false, true]) {
      const opts = options({ ...types, excludeLookAlikes, requireEachType: true, length: MIN_LENGTH });
      for (let i = 0; i < 300; i++) {
        const kinds = new Set([...generatePassword(opts, random)].map(characterKind));
        for (const name of CHARSET_NAMES) {
          assert.equal(kinds.has(name), opts[name], `${name} presence in a password for ${JSON.stringify(opts)}`);
        }
      }
    }
  }
});

test('requireEachType shuffles the required characters to random positions', () => {
  const random = seeded(99);
  const opts = options({ length: MIN_LENGTH, requireEachType: true });
  const firstKinds = new Map<string, number>();
  const runs = 4000;
  for (let i = 0; i < runs; i++) {
    const kind = characterKind(generatePassword(opts, random).charAt(0));
    firstKinds.set(kind, (firstKinds.get(kind) ?? 0) + 1);
  }
  // With 4 characters and 4 types, each type starts the password about a quarter of the time.
  for (const name of CHARSET_NAMES) {
    const share = (firstKinds.get(name) ?? 0) / runs;
    assert.ok(share > 0.2 && share < 0.3, `${name} starts ${(share * 100).toFixed(1)}% of passwords`);
  }
});

test('excludeLookAlikes removes look-alike characters', () => {
  const random = seeded(5);
  const opts = options({ length: MAX_LENGTH, excludeLookAlikes: true });
  for (let i = 0; i < 200; i++) {
    const password = generatePassword(opts, random);
    for (const char of LOOK_ALIKES) assert.ok(!password.includes(char), `found ${char}`);
  }
  // Without the option they do show up.
  const seen = new Set(Array.from({ length: 50 }, () => generatePassword(options({ length: MAX_LENGTH }), random)).join(''));
  for (const char of LOOK_ALIKES) assert.ok(seen.has(char), `${char} never appeared without the option`);
});

test('without requireEachType every character is drawn uniformly from the pool', () => {
  const random = seeded(123);
  const opts = options({ length: MAX_LENGTH, requireEachType: false });
  const pool = characterPool(opts);
  const counts = new Map<string, number>();
  const passwords = 700;
  for (let i = 0; i < passwords; i++) {
    for (const char of generatePassword(opts, random)) counts.set(char, (counts.get(char) ?? 0) + 1);
  }
  const expected = (passwords * MAX_LENGTH) / pool.length;
  assert.equal(counts.size, pool.length);
  for (const [char, count] of counts) {
    assert.ok(Math.abs(count - expected) / expected < 0.1, `${char}: ${count}, expected ≈ ${expected.toFixed(0)}`);
  }
});

test('a single enabled type gives a password of only that type', () => {
  const random = seeded(8);
  assert.match(generatePassword(options({ lowercase: false, uppercase: false, numbers: false }), random), /^[^A-Za-z0-9]{20}$/);
  assert.match(
    generatePassword(options({ lowercase: false, uppercase: false, symbols: false, length: 6 }), random),
    /^[0-9]{6}$/,
  );
});

test('generatePassword validates its options', () => {
  const random = seeded(1);
  for (const length of [3, 129, 20.5, Number.NaN, 0, -20]) {
    assert.throws(() => generatePassword(options({ length }), random), RangeError, `length ${length}`);
  }
  assert.throws(
    () => generatePassword(options({ lowercase: false, uppercase: false, numbers: false, symbols: false }), random),
    /at least one character type/,
  );
});

test('generatePassword uses the Web Crypto API by default', () => {
  const a = generatePassword(DEFAULT_OPTIONS);
  const b = generatePassword(DEFAULT_OPTIONS);
  assert.equal(a.length, 20);
  assert.notEqual(a, b); // 2^-129 chance of a false failure
});

// ------------------------------------------------------------------ entropy and strength

test('entropyBits is length × log2(pool size)', () => {
  assert.equal(entropyBits(options()), 20 * Math.log2(87));
  assert.equal(entropyBits(options({ length: 4, lowercase: false, uppercase: false, symbols: false })), 4 * Math.log2(10));
  // Look-alikes removed: 24 + 24 + 8 + 24 characters.
  assert.equal(entropyBits(options({ excludeLookAlikes: true })), 20 * Math.log2(80));
  assert.equal(entropyBits(options({ length: 128 })), 128 * Math.log2(87));
  assert.equal(entropyBits(options({ requireEachType: false })), entropyBits(options({ requireEachType: true })));
});

test('entropyBits validates its options', () => {
  assert.throws(() => entropyBits(options({ length: 2 })), RangeError);
  assert.throws(() => entropyBits(options({ lowercase: false, uppercase: false, numbers: false, symbols: false })));
});

test('strength thresholds', () => {
  const cases: Array<[number, StrengthLevel, number]> = [
    [Number.NaN, 'very-weak', 0],
    [0, 'very-weak', 0],
    [39.99, 'very-weak', 0],
    [40, 'weak', 1],
    [59.99, 'weak', 1],
    [60, 'fair', 2],
    [79.99, 'fair', 2],
    [80, 'strong', 3],
    [99.99, 'strong', 3],
    [100, 'very-strong', 4],
    [840, 'very-strong', 4],
  ];
  for (const [bits, level, score] of cases) {
    assert.deepEqual(strength(bits), { score, level }, `${bits} bits`);
  }
  // The defaults (20 characters, all types) are very strong; 4 digits are very weak.
  assert.equal(strength(entropyBits(DEFAULT_OPTIONS)).level, 'very-strong');
  assert.equal(strength(entropyBits(options({ length: 4, lowercase: false, uppercase: false, symbols: false }))).score, 0);
});

test('strength levels are listed in score order', () => {
  assert.deepEqual(STRENGTH_LEVELS, ['very-weak', 'weak', 'fair', 'strong', 'very-strong']);
  STRENGTH_LEVELS.forEach((level, score) => assert.equal(strength(score * 20 + 20).level, level));
});

test('bits rounded down (as displayed) always give the same level as the exact bits', () => {
  // The page shows Math.floor(bits); Math.round would show e.g. "Very weak, 40 bits" for 12 digits (39.86 bits).
  const levelsByShownBits = new Map<number, Set<string>>();
  for (const types of ALL_TYPE_COMBINATIONS) {
    for (const excludeLookAlikes of [false, true]) {
      for (let length = MIN_LENGTH; length <= MAX_LENGTH; length++) {
        const bits = entropyBits(options({ ...types, excludeLookAlikes, length }));
        const shown = Math.floor(bits);
        assert.deepEqual(strength(shown), strength(bits), `${bits} bits shown as ${shown}`);
        const levels = levelsByShownBits.get(shown) ?? new Set<string>();
        levels.add(strength(bits).level);
        levelsByShownBits.set(shown, levels);
      }
    }
  }
  for (const [shown, levels] of levelsByShownBits) {
    assert.equal(levels.size, 1, `${shown} bits shown with levels ${[...levels].join(', ')}`);
  }
});

// ------------------------------------------------------------------ messages

test('both locales define the same password generator messages', () => {
  const keys = (value: unknown, prefix = ''): string[] =>
    value && typeof value === 'object'
      ? Object.entries(value).flatMap(([key, child]) => keys(child, `${prefix}${key}.`))
      : [prefix];
  assert.deepEqual(keys(passwordMessages.tr).sort(), keys(passwordMessages.en).sort());
  for (const locale of ['en', 'tr'] as const) {
    const m = passwordMessages[locale];
    for (const level of STRENGTH_LEVELS) assert.ok(m.strength[level].length > 0, `${locale}: ${level}`);
    for (const name of CHARSET_NAMES) assert.ok(m.types[name].length > 0, `${locale}: ${name}`);
  }
});

test('password generator messages pluralise and format numbers per locale', () => {
  const { en, tr } = passwordMessages;
  assert.equal(en.characters(1), '1 character');
  assert.equal(en.characters(20), '20 characters');
  assert.equal(tr.characters(20), '20 karakter');
  assert.equal(en.bits(131), '131 bits');
  assert.equal(tr.bits(131), '131 bit');
  assert.equal(en.strengthAnnouncement('very-strong', 131), 'Strength: Very strong, about 131 bits');
  assert.equal(tr.strengthAnnouncement('very-strong', 131), 'Güç: Çok güçlü, yaklaşık 131 bit');
  // The locked type is quoted in Turkish so no case suffix has to follow it.
  assert.equal(tr.lockNotice('symbols'), '“Semboller” seçili kalıyor: en az bir tür seçili olmalı.');
  assert.equal(en.lockNotice('symbols'), 'Symbols stays on: at least one type must stay selected.');
});

test('characterKind classifies characters', () => {
  assert.equal(characterKind('a'), 'lowercase');
  assert.equal(characterKind('Z'), 'uppercase');
  assert.equal(characterKind('7'), 'numbers');
  assert.equal(characterKind('#'), 'symbols');
  assert.equal(characterKind('é'), 'symbols');
  for (const name of CHARSET_NAMES) {
    for (const char of CHARSETS[name]) assert.equal(characterKind(char), name);
  }
});
