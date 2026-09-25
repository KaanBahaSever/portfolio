// @ts-check
/**
 * Favicon and app-icon builder: `npm run favicons` (node scripts/build-favicons.mjs).
 *
 * Everything is generated from the one construction of the site's mark below, and the outputs
 * are committed to public/. Re-run this script after changing the geometry or the palette, and
 * keep src/components/ui/BrandMark.astro in step (the script checks it and fails if it drifts).
 *
 * THE MARK — a λ whose strokes meet at an accent node
 *   λ for eigenvalues and for lambda calculus; the node is the vertex where its three edges meet.
 *   Construction, in a 32-unit box (1 unit = ½ px at 16 px, 1 px at 32 px):
 *   - The node sits at the centre of the box, (16, 16), and bisects the long stroke.
 *   - Both strokes rise 10 units for every 6 across (≈ 59°), so the legs and the baseline form a
 *     nearly equilateral triangle, and every terminal lands on an even coordinate.
 *   - Strokes are 4 units wide measured horizontally and end in horizontal cuts, so at 16 and
 *     32 px the top terminal and both feet sit on whole pixels: a crisp baseline and cap line.
 *   - The glyph is a single 8-point polygon; the node (r = 3) covers the joint of the short leg.
 *   - In the 16 px raster (the first image in favicon.ico) the node grows to r = 4, a 4 px dot on
 *     whole pixels: at r = 3 it is a 3 px dot with half-covered edge pixels that dissolves into
 *     the strokes. favicon.svg cannot switch by size and keeps r = 3.
 *
 * PALETTE — Tailwind tokens from src/styles/global.css, converted OKLCH → sRGB by hand
 *   ink    zinc-950   oklch(0.141 0.005 285.823) → #09090b   (also the manifest theme_color)
 *   paper  zinc-50    oklch(0.985 0 0)           → #fafafa   (also the manifest background_color)
 *   node   accent-600 oklch(0.59 0.115 172)      → #009375   (red is −0.013 before clipping: the
 *                                                             colour sits just outside sRGB)
 *          accent-400 oklch(0.772 0.14 172)      → #2fd1ab   (BrandMark's dark-mode node; unused
 *                                                             here, see below)
 *   The favicon is always a tile that inverts its surroundings: an ink tile with a paper λ where
 *   the browser chrome is light, a paper tile with an ink λ where it is dark, so the silhouette
 *   stands out from any tab strip (a transparent glyph would disappear on custom browser themes
 *   and in lists drawn on the opposite colour). The node keeps accent-600 in both: a mid-tone
 *   between ink and paper, it has ≥ 3:1 contrast against the tile AND against the strokes it
 *   touches in either scheme (5.14:1 and 3.70:1), where accent-400 would blur into a paper λ
 *   (1.86:1). The node is the one part the inversion leaves unchanged.
 *   The PNG and ICO files have one palette, the ink tile: it carries its own background, so it
 *   reads on light and dark tab strips alike (Safari and older browsers use these).
 *
 * OUTPUTS (public/)
 *   favicon.svg              vector favicon; an embedded @media (prefers-color-scheme: dark) rule
 *                            swaps the tile and glyph colours
 *   favicon.ico              16 (small-size node), 32 and 48 px PNGs in one ICO container
 *   favicon-32x32.png        32 px tile
 *   apple-touch-icon.png     180 px, opaque, full bleed (iOS rounds the corners), glyph at 53 %
 *   icon-192.png, icon-512.png   the rounded tile, for the web manifest (purpose "any")
 *   icon-maskable-512.png    full-bleed, glyph and node inside the central 80 % safe zone
 *
 * DETERMINISM
 *   Shapes are paths and circles only, never <text>, so no system font is involved. librsvg
 *   (sharp's SVG renderer) ignores @media inside SVG, so the rasters are rendered from the
 *   fixed-palette ink variant built here, never from favicon.svg. Each PNG is rasterised at its
 *   final pixel size (no resampling) and written without metadata: the same sharp version gives
 *   byte-identical files. The ICO container is written by hand (ICONDIR + ICONDIRENTRY, PNG
 *   payloads) — no extra dependency.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const PUBLIC = new URL('../public/', import.meta.url);
const BRAND_MARK = new URL('../src/components/ui/BrandMark.astro', import.meta.url);

const INK = '#09090b';
const PAPER = '#fafafa';
const NODE_FILL = '#009375';

// ── Geometry (32-unit box) ────────────────────────────────────────────────────────────────────

const C = 16; // the node: centre of the box
const HALF_HEIGHT = 10; // terminals at y = C ± 10
const RUN = 6; // horizontal run of a stroke over HALF_HEIGHT (slope 10 : 6, ≈ 59° from horizontal)
const STEM = 4; // stroke width measured horizontally, so horizontal cuts are exactly this wide
const NODE_R = 3;
const NODE_R_SMALL = 4; // for the 16 px raster only (see the header)
const TILE_RADIUS = 7; // rounded tile corners (≈ 22 % of the side, like platform app icons)

/** @param {number} n */
const num = (n) => String(Math.round(n * 1000) / 1000);

/**
 * The λ as one polygon, clockwise from the top-left corner of the upper terminal. The long stroke
 * runs from (C − RUN, C − H) through the node to (C + RUN, C + H); the short leg runs from the node
 * to (C − RUN, C + H) and joins the long stroke's left edge at the node's height.
 */
function glyphPath() {
  const top = C - HALF_HEIGHT;
  const base = C + HALF_HEIGHT;
  const half = STEM / 2;
  // Where the long stroke's left edge crosses the vertical through the node: the crotch between
  // the legs. By symmetry of the two legs it lies on x = C.
  const crotchY = C + (half * HALF_HEIGHT) / RUN;
  /** @type {Array<[number, number]>} */
  const points = [
    [C - RUN - half, top], // upper terminal, left
    [C - RUN + half, top], // upper terminal, right
    [C + RUN + half, base], // right foot, outer
    [C + RUN - half, base], // right foot, inner
    [C, crotchY], // crotch
    [C - RUN + half, base], // left foot, inner
    [C - RUN - half, base], // left foot, outer
    [C - half, C], // short leg meets the long stroke's left edge (under the node)
  ];
  const [first, ...rest] = points;
  return (
    `M${num(first[0])} ${num(first[1])}` +
    rest.map(([x, y], i) => (y === points[i][1] ? `H${num(x)}` : `L${num(x)} ${num(y)}`)).join('') +
    'Z'
  );
}

const GLYPH = glyphPath();

/**
 * Distance from the centre to the farthest point of the mark, in box units (for safe zones): the
 * outer corners of the terminals, (8, 6), (24, 26) and (8, 26), are equidistant; the node is smaller.
 */
function markRadius() {
  return Math.hypot(RUN + STEM / 2, HALF_HEIGHT);
}

// ── SVG documents ─────────────────────────────────────────────────────────────────────────────

/**
 * A fixed-palette raster source: ink background, paper λ, accent node.
 * @param {object} o
 * @param {number} o.size      output pixels (the SVG is rasterised at exactly this size)
 * @param {number} [o.pad]     box units of background added on every side (full-bleed icons)
 * @param {boolean} [o.rounded] rounded tile with transparent corners instead of a full-bleed square
 * @param {number} [o.nodeR]
 */
function rasterSvg({ size, pad = 0, rounded = false, nodeR = NODE_R }) {
  const side = 32 + 2 * pad;
  const background = rounded
    ? `<rect width="32" height="32" rx="${TILE_RADIUS}" fill="${INK}"/>`
    : `<rect x="${-pad}" y="${-pad}" width="${side}" height="${side}" fill="${INK}"/>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-pad} ${-pad} ${side} ${side}">` +
      background +
      `<path d="${GLYPH}" fill="${PAPER}"/>` +
      `<circle cx="${C}" cy="${C}" r="${nodeR}" fill="${NODE_FILL}"/>` +
      `</svg>`,
  );
}

/** public/favicon.svg: the same tile, with colours that follow the browser's colour scheme. */
function faviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <!-- Lambda mark, Kaan Baha Sever. Generated by scripts/build-favicons.mjs: edit that script, not this file. -->
  <style>
    .tile { fill: ${INK}; }
    .glyph { fill: ${PAPER}; }
    @media (prefers-color-scheme: dark) {
      .tile { fill: ${PAPER}; }
      .glyph { fill: ${INK}; }
    }
  </style>
  <rect class="tile" width="32" height="32" rx="${TILE_RADIUS}" fill="${INK}"/>
  <path class="glyph" d="${GLYPH}" fill="${PAPER}"/>
  <circle cx="${C}" cy="${C}" r="${NODE_R}" fill="${NODE_FILL}"/>
</svg>
`;
}

// ── Raster and ICO writers ────────────────────────────────────────────────────────────────────

/**
 * @param {Buffer} svg
 * @param {{ opaque?: boolean }} [options] flatten onto ink and drop the alpha channel
 */
async function png(svg, { opaque = false } = {}) {
  let image = sharp(svg);
  if (opaque) image = image.flatten({ background: INK }).removeAlpha();
  return image.png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toBuffer();
}

/**
 * A Windows ICO holding PNG images (supported since Windows Vista and by every browser).
 * Layout, little-endian: ICONDIR { reserved u16 = 0, type u16 = 1 (icon), count u16 }, then one
 * 16-byte ICONDIRENTRY per image { width u8, height u8 (0 means 256), colours u8 = 0,
 * reserved u8 = 0, planes u16 = 1, bits per pixel u16 = 32, byte length u32, offset u32 },
 * then the PNG files themselves.
 * @param {Array<{ size: number, data: Buffer }>} images
 */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

// ── Build ─────────────────────────────────────────────────────────────────────────────────────

// Maskable icons are cropped to a circle (or squircle) of 80 % of the side; keep the mark in it.
const MASKABLE_PAD = 4; // 40-unit canvas
const maskableExtent = markRadius() / (32 + 2 * MASKABLE_PAD);
if (maskableExtent > 0.4) throw new Error(`Mark reaches ${maskableExtent} of the maskable icon; the safe zone is 0.4.`);

const tile16 = await png(rasterSvg({ size: 16, rounded: true, nodeR: NODE_R_SMALL }));
const tile32 = await png(rasterSvg({ size: 32, rounded: true }));
const tile48 = await png(rasterSvg({ size: 48, rounded: true }));

/** @type {Array<[string, Buffer | string]>} */
const outputs = [
  ['favicon.svg', faviconSvg()],
  ['favicon.ico', ico([{ size: 16, data: tile16 }, { size: 32, data: tile32 }, { size: 48, data: tile48 }])],
  ['favicon-32x32.png', tile32],
  // 3 units of padding: the glyph fills 20/38 ≈ 53 % of the icon, clear of iOS's rounded corners.
  ['apple-touch-icon.png', await png(rasterSvg({ size: 180, pad: 3 }), { opaque: true })],
  ['icon-192.png', await png(rasterSvg({ size: 192, rounded: true }))],
  ['icon-512.png', await png(rasterSvg({ size: 512, rounded: true }))],
  ['icon-maskable-512.png', await png(rasterSvg({ size: 512, pad: MASKABLE_PAD }), { opaque: true })],
];

for (const [name, data] of outputs) {
  writeFileSync(new URL(name, PUBLIC), data);
  console.log(`${name.padEnd(24)} ${Buffer.byteLength(data).toLocaleString('en-US').padStart(7)} B`);
}
console.log(`maskable: the mark reaches ${(maskableExtent * 100).toFixed(1)} % of the side from the centre (limit 40 %)`);

// BrandMark.astro draws the same geometry inline (currentColor λ, token-coloured node).
const brandMark = readFileSync(BRAND_MARK, 'utf8');
const expected = [`d="${GLYPH}"`, `cx="${C}" cy="${C}" r="${NODE_R}"`];
const missing = expected.filter((snippet) => !brandMark.includes(snippet));
if (missing.length > 0) {
  console.error(`\nsrc/components/ui/BrandMark.astro is out of step with this geometry. Expected:\n  ${missing.join('\n  ')}`);
  process.exitCode = 1;
}
