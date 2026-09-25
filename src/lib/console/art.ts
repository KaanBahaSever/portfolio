/**
 * ASCII art for secret.txt: the unit circle in the complex plane, with e^(iπ) marked at −1
 * (the '*', drawn bright) half a turn from 1 (the 'o'), and Euler's identity below it.
 *
 * Plain ASCII on purpose: box-drawing characters are outside the subsets of JetBrains Mono the
 * site loads, and a fallback font could break the alignment. The only non-ASCII character, π,
 * ends its row, so nothing after it depends on its width. At most 31 columns wide, so the
 * drawing fits a 320 px screen at the default size (CSS shrinks it further when needed).
 */
export const EULER_ART: readonly string[] = [
  '             ^ Im',
  '             |',
  '        .----+----.',
  "      .'     |     '.",
  '     /       |       \\',
  ' ---*--------+--------o---> Re',
  '   -1        0        1',
  '     \\       |       /',
  "      '.     |     .'",
  "        '----+----'",
  '             |',
  '',
  '          iπ',
  '         e   + 1 = 0',
];

/** The character marking e^(iπ) = −1 (appears once). */
export const EULER_ART_HIGHLIGHT = '*';
