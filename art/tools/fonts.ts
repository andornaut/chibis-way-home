/**
 * Build the two native 16px Liberation Sans BMFonts from bundled SIL OFL fonts.
 *
 * font-body uses Liberation Sans Regular for body text, dialogue and quips. font-title uses
 * Liberation Sans Bold for headings, names and action labels. Both draw at native 1x. The line
 * height is the ascent plus the descent plus one pixel of leading, and the base is the ascent. The
 * exported FNT metrics own layout. Printable ASCII and the middle dot cover current player text.
 * Native glyph bearings and rounded pair kerning are retained. White RGBA glyphs use grayscale
 * alpha for tinting; font textures require linear sampling independently of art.
 *
 * Glyphs rasterise with art-kit's Skia bitmap font renderer, so their coverage, advances and
 * kerning follow Skia rather than FreeType. Each glyph is cropped to its ink and art-kit packs it in
 * insertion order from the atlas's top-left with 1px spacing and a power-of-two atlas height.
 *
 * Usage, from the repository root:
 *   node art/tools/fonts.ts build             write public/art/fonts/<key>.png and XML .fnt,
 *                                             retaining the two keys, list them in the manifest,
 *                                             and copy art/fonts/liberation/ to fonts/liberation/
 *   node art/tools/fonts.ts preview OUT.png   every face with sample lines, 3x
 */

import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

import { rasteriseGlyphs } from "@andornaut/art-kit/fonts";
import { buildBitmapFontFromGlyphs } from "@andornaut/art-kit/glyphAtlas";
import { encodeRgbaPng } from "@andornaut/art-kit/png";
import { composite, filledImage, resizeNearest } from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { commands, run } from "./cli.ts";
import * as pixel from "./pixel.ts";

const FONTS: Readonly<Record<string, readonly [face: string, path: string, size: number]>> = {
  "font-body": ["Liberation Sans Regular", "art/fonts/liberation/LiberationSans-Regular.ttf", 16],
  "font-title": ["Liberation Sans Bold", "art/fonts/liberation/LiberationSans-Bold.ttf", 16],
};
const OUT = "public/art/fonts";
// The Liberation TTFs and licence, served unchanged as the runtime UI fonts.
const LIBERATION = "art/fonts/liberation";
const SERVED_LIBERATION = `${OUT}/liberation`;
const CHARS: readonly string[] = [
  ...Array.from({ length: 127 - 32 }, (_, i) => String.fromCharCode(32 + i)),
  "·",
];
const ATLAS_W = 256;
const PNG_OPTIONS = { deflateLevel: 9, deflateStrategy: 3, filterType: -1 };
const USAGE = "Usage: fonts.ts build | preview OUT.png";

/** A glyph's white coverage image (undefined without ink), x and y offsets and advance. */
export type Glyph = readonly [
  image: RgbaImage | undefined,
  xoffset: number,
  yoffset: number,
  xadvance: number,
];
type Kerning = readonly [first: string, second: string, amount: number];

interface Rasterised {
  glyphs: Map<string, Glyph>;
  ascent: number;
  descent: number;
  kernings: Kerning[];
}

// CLEANUP (added 2026-11-04): replace with art-kit's font coverage API once released, and remove
// once fonts.ts uses it.
/**
 * The code points the font file maps to a glyph other than .notdef, from its Unicode cmap
 * subtable (format 12, else format 4). Skia substitutes a system font for any other code point.
 */
function mappedCodePoints(path: string): Set<number> {
  const bytes = readFileSync(path);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (at: number): number => view.getUint16(at);
  const u32 = (at: number): number => view.getUint32(at);
  let cmap = -1;
  for (let i = 0, record = 12; i < u16(4); i++, record += 16) {
    if (bytes.toString("latin1", record, record + 4) === "cmap") {
      cmap = u32(record + 8);
    }
  }
  if (cmap < 0) {
    throw new Error(`${path} has no cmap table`);
  }
  const subtables = Array.from({ length: u16(cmap + 2) }, (_, i) => cmap + 4 + 8 * i).map(
    (record) => ({ id: `${u16(record)}.${u16(record + 2)}`, at: cmap + u32(record + 4) }),
  );
  const find = (format: number, ids: readonly string[]) =>
    subtables.find(({ at, id }) => ids.includes(id) && u16(at) === format)?.at;
  const mapped = new Set<number>();
  const format12 = find(12, ["0.4", "0.6", "3.10"]);
  if (format12 !== undefined) {
    for (let i = 0, group = format12 + 16; i < u32(format12 + 12); i++, group += 12) {
      for (let c = u32(group); c <= u32(group + 4); c++) {
        if (u32(group + 8) + c - u32(group)) {
          mapped.add(c);
        }
      }
    }
    return mapped;
  }
  const format4 = find(4, ["0.3", "0.4", "3.1"]);
  if (format4 === undefined) {
    throw new Error(`${path} has no Unicode cmap subtable in format 4 or 12`);
  }
  const segments = u16(format4 + 6) / 2;
  const ends = format4 + 14;
  const starts = ends + 2 * segments + 2;
  const deltas = starts + 2 * segments;
  const rangeOffsets = deltas + 2 * segments;
  for (let s = 0; s < segments; s++) {
    const [start, end, delta] = [u16(starts + 2 * s), u16(ends + 2 * s), u16(deltas + 2 * s)];
    const rangeOffset = u16(rangeOffsets + 2 * s);
    for (let c = start; c <= end && c !== 0xffff; c++) {
      const index = rangeOffset ? u16(rangeOffsets + 2 * s + rangeOffset + 2 * (c - start)) : c;
      if (index && (index + delta) & 0xffff) {
        mapped.add(c);
      }
    }
  }
  return mapped;
}

/** Throw unless every CHARS entry was drawn, and from the font file rather than a fallback font. */
function checkCoverage(path: string, glyphs: ReadonlyMap<string, unknown>): void {
  const mapped = mappedCodePoints(path);
  for (const char of CHARS) {
    if (!glyphs.has(char) || !mapped.has(char.codePointAt(0) as number)) {
      throw new Error(`No glyph for ${JSON.stringify(char)} in ${path}`);
    }
  }
}

/** Antialiased glyphs, line metrics and every nonzero pair kerning, in CHARS order. */
function rasterise(size: number, path: string): Rasterised {
  const rasterised = rasteriseGlyphs({
    antialias: true,
    characters: CHARS,
    hinting: true,
    kerning: "all",
    path,
    size,
  });
  checkCoverage(path, rasterised.glyphs);
  const glyphs = new Map<string, Glyph>();
  for (const [char, { image, xadvance, xoffset, yoffset }] of rasterised.glyphs) {
    if (!image) {
      glyphs.set(char, [undefined, 0, 0, xadvance]);
      continue;
    }
    // White everywhere, coverage in alpha.
    for (let i = 0; i < image.data.length; i += 4) {
      image.data.fill(255, i, i + 3);
    }
    glyphs.set(char, [image, xoffset, yoffset, xadvance]);
  }
  const kernings = rasterised.kernings.map(({ amount, first, second }): Kerning => [
    String.fromCodePoint(first),
    String.fromCodePoint(second),
    amount,
  ]);
  return { ascent: rasterised.base, descent: Math.ceil(rasterised.descent), glyphs, kernings };
}

function buildFont(key: string, face: string, size: number, path: string): void {
  const font = rasterise(size, path);
  const code = (char: string) => char.codePointAt(0) as number;
  const { image, xml } = buildBitmapFontFromGlyphs(
    {
      layout: "packed",
      antialias: true,
      key,
      face,
      size,
      base: font.ascent,
      lineHeight: font.ascent + font.descent + 1,
      atlasWidth: ATLAS_W,
      kernings: font.kernings.map(([first, second, amount]) => ({
        first: code(first),
        second: code(second),
        amount,
      })),
    },
    new Map(
      [...font.glyphs].map(([char, [glyph, xoffset, yoffset, xadvance]]) => [
        char,
        { image: glyph, xoffset, yoffset, xadvance },
      ]),
    ),
  );
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${key}.png`, encodeRgbaPng(PNG_OPTIONS, image));
  writeFileSync(`${OUT}/${key}.fnt`, xml);
}

/** Copy every file in art/fonts/liberation/ byte for byte to public/art/fonts/liberation/. */
function copyLiberation(): void {
  mkdirSync(SERVED_LIBERATION, { recursive: true });
  for (const name of readdirSync(LIBERATION).sort()) {
    copyFileSync(`${LIBERATION}/${name}`, `${SERVED_LIBERATION}/${name}`);
  }
}

export function build(): void {
  for (const [key, [face, path, size]] of Object.entries(FONTS)) {
    buildFont(key, face, size, path);
  }
  copyLiberation();
  pixel.updateManifest(
    "fonts",
    Object.keys(FONTS).map((key) => ({ key, png: `fonts/${key}.png`, fnt: `fonts/${key}.fnt` })),
  );
  console.log("built", Object.keys(FONTS).join(", "));
}

function drawLine(
  glyphs: ReadonlyMap<string, Glyph>,
  pairs: ReadonlyMap<string, number>,
  [startX, y]: readonly [number, number],
  sheet: RgbaImage,
  text: string,
): void {
  const cream = pixel.rgb("cream");
  let x = startX;
  let previous: string | undefined;
  for (const char of text) {
    if (previous !== undefined) {
      x += pairs.get(`${previous}\u0000${char}`) ?? 0;
    }
    const [image, ox, oy, advance] = glyphs.get(char) as Glyph;
    if (image) {
      const tinted = filledImage([...cream, 255], image.width, image.height);
      for (let i = 3; i < image.data.length; i += 4) {
        tinted.data[i] = image.data[i] as number;
      }
      composite({ x: x + ox, y: y + oy }, tinted, sheet);
    }
    x += advance;
    previous = char;
  }
}

export function preview(scale: number, out: string): void {
  const samples = [
    "Chibi  Archie  Fert  Trixi  Bini  Pebble  Kiwi",
    "Try again  Back to title  Continue",
    "j _ w AV To Wy 0123456789 !?.,:;'\"+-/%&() ·",
  ];
  const faces = Object.values(FONTS);
  const sheet = filledImage([...pixel.rgb("navy"), 255], 720, faces.length * 112);
  let y = 4;
  for (const [face, path, size] of faces) {
    const { ascent, descent, glyphs, kernings } = rasterise(size, path);
    const pairs = new Map(kernings.map(([a, b, amount]) => [`${a}\u0000${b}`, amount]));
    for (const text of [face, ...samples]) {
      drawLine(glyphs, pairs, [8, y], sheet, text);
      y += ascent + descent + 1;
    }
    y += 12;
  }
  const scaled = resizeNearest(sheet.width * scale, sheet.height * scale, sheet);
  writeFileSync(out, encodeRgbaPng(PNG_OPTIONS, scaled));
}

if (import.meta.main) {
  run(() => commands({ usage: USAGE, build, preview: (out) => preview(3, out) }));
}
