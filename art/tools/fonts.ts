/**
 * Build the private native 16px Liberation Sans body BMFont for generator preview labels, and
 * subset the Liberation Sans sources to the served Chibi Sans WOFF2 faces.
 *
 * font-body uses Liberation Sans Regular at native 1x. The line height is the ascent plus the
 * descent plus one pixel of leading, and the base is the ascent. The exported FNT metrics own
 * layout. Printable ASCII and the middle dot cover current player text. Native glyph bearings and
 * rounded pair kerning are retained. White RGBA glyphs use grayscale alpha for compositing preview
 * labels independently of game art.
 *
 * Glyphs rasterise with art-kit's Skia bitmap font renderer, so their coverage, advances and
 * kerning follow Skia rather than FreeType. The renderer fails the build when the font file has no
 * glyph for a character. Each glyph is cropped to its ink and art-kit packs it in insertion order
 * from the atlas's top-left with 1px spacing and a power-of-two atlas height.
 *
 * Runtime faces are Chibi Sans Regular (400) and Bold (700), WOFF2 subsets of the Liberation Sans
 * TTFs, which are not served. Each keeps playerCodePoints() plus printable ASCII (U+0020 to
 * U+007E), so changed player strings change the faces, along with the glyphs, layout features and
 * kerning those code points reach. The sources' SIL OFL 1.1 reserves the names Arimo, Cousine,
 * Liberation and Tinos, and a subset is a Modified Version, so its family, unique, full and
 * PostScript names are Chibi Sans ones; the copyright and licence records are kept.
 *
 * Usage, from the repository root:
 *   node art/tools/fonts.ts build             write art/generated/fonts/font-body.png and .fnt,
 *                                             copy the licence to public/art/fonts/chibi-sans/ and
 *                                             subset the Regular and Bold WOFF2 faces there
 *   node art/tools/fonts.ts preview OUT.png   every face with sample lines, 3x
 */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { rasteriseGlyphs } from "@andornaut/art-kit/build/fonts";
import { buildBitmapFontFromGlyphs } from "@andornaut/art-kit/build/glyphAtlas";
import { encodeRgbaPng } from "@andornaut/art-kit/build/png";
import { composite, filledImage, resizeNearest } from "@andornaut/art-kit/build/raster";
import type { RgbaImage } from "@andornaut/art-kit/build/rgbaImage";
import { subsetWoff2 } from "@andornaut/art-kit/build/woff2";

import { playerCodePoints } from "../../src/ui/chrome/uiFontCodePoints.ts";
import { commands, run } from "./cli.ts";
import * as pixel from "./pixel.ts";

const FONTS: Readonly<Record<string, readonly [face: string, path: string, size: number]>> = {
  "font-body": ["Liberation Sans Regular", "art/fonts/liberation/LiberationSans-Regular.ttf", 16],
  "font-title": ["Liberation Sans Bold", "art/fonts/liberation/LiberationSans-Bold.ttf", 16],
};
const OUT = "art/generated/fonts";
export const PREVIEW_FONT = `${OUT}/font-body`;
// The Liberation sources. Their TTFs are subset to the served faces and are not served themselves;
// only the licence is copied unchanged.
const LIBERATION = "art/fonts/liberation";
const LICENCE = "OFL.txt";
const SERVED = "public/art/fonts/chibi-sans";
const FAMILY = "Chibi Sans";
// The Reserved Font Names the sources' OFL.txt declares.
const RESERVED = ["Arimo", "Cousine", "Liberation", "Tinos"];
// The version string (name ID 5) of both sources, which the subsets keep.
const SOURCE_VERSION = "2.1.5";
// Each served style's source TTF.
const FACES: Readonly<Record<string, string>> = {
  Bold: `${LIBERATION}/LiberationSans-Bold.ttf`,
  Regular: `${LIBERATION}/LiberationSans-Regular.ttf`,
};
// Printable ASCII, kept beside the player code points for runtime text the data does not hold.
const ASCII_FLOOR = Array.from({ length: 0x7f - 0x20 }, (_, i) => 0x20 + i);
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

/** Copy the licence unchanged and subset both runtime faces as renamed WOFF2. */
async function buildServedFaces(): Promise<void> {
  const codePoints = new Set([...ASCII_FLOOR, ...playerCodePoints()]);
  const strings = [...codePoints].map((codePoint) => String.fromCodePoint(codePoint));
  mkdirSync(SERVED, { recursive: true });
  copyFileSync(`${LIBERATION}/${LICENCE}`, `${SERVED}/${LICENCE}`);
  await Promise.all(
    Object.entries(FACES).map(async ([style, path]) => {
      const postScriptName = `${FAMILY.replaceAll(" ", "")}-${style}`;
      const names = {
        family: FAMILY,
        fullName: `${FAMILY} ${style}`,
        postScriptName,
        reserved: RESERVED,
        uniqueId: `${FAMILY} ${style} ${SOURCE_VERSION}`,
      };
      const subset = await subsetWoff2({ label: style, names, strings }, readFileSync(path));
      writeFileSync(`${SERVED}/${postScriptName}.woff2`, subset);
    }),
  );
}

/** Deterministic prerequisite for standalone preview commands as well as the full art build. */
export function buildPreviewFont(): void {
  const [face, path, size] = FONTS["font-body"]!;
  buildFont("font-body", face, size, path);
}

export async function build(): Promise<void> {
  buildPreviewFont();
  await buildServedFaces();
  const manifest = pixel.readManifest();
  manifest.fonts = [];
  pixel.writeJson({}, pixel.MANIFEST, manifest);
  console.log("built private font-body and served Chibi Sans faces");
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
