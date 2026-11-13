/**
 * Build the private native 16px Liberation Sans body BMFont for generator preview labels.
 *
 * font-body uses Liberation Sans Regular at native 1x. Runtime UI uses the served TTF faces. The line
 * height is the ascent plus the descent plus one pixel of leading, and the base is the ascent. The
 * exported FNT metrics own layout. Printable ASCII and the middle dot cover current player text.
 * Native glyph bearings and rounded pair kerning are retained. White RGBA glyphs use grayscale
 * alpha for compositing preview labels independently of game art.
 *
 * Glyphs rasterise with art-kit's Skia bitmap font renderer, so their coverage, advances and
 * kerning follow Skia rather than FreeType. The renderer fails the build when the font file has no
 * glyph for a character. Each glyph is cropped to its ink and art-kit packs it in insertion order
 * from the atlas's top-left with 1px spacing and a power-of-two atlas height.
 *
 * Usage, from the repository root:
 *   node art/tools/fonts.ts build             write art/generated/fonts/font-body.png and .fnt,
 *                                             copy the TTFs and licence to public/art/fonts/liberation/
 *   node art/tools/fonts.ts preview OUT.png   every face with sample lines, 3x
 */

import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";

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
const OUT = "art/generated/fonts";
export const PREVIEW_FONT = `${OUT}/font-body`;
// The Liberation TTFs and licence, served unchanged as the runtime UI fonts.
const LIBERATION = "art/fonts/liberation";
const SERVED_LIBERATION = "public/art/fonts/liberation";
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

/** Copy every file in art/fonts/liberation/ byte for byte to public/art/fonts/liberation/. */
function copyLiberation(): void {
  mkdirSync(SERVED_LIBERATION, { recursive: true });
  for (const name of readdirSync(LIBERATION).sort()) {
    copyFileSync(`${LIBERATION}/${name}`, `${SERVED_LIBERATION}/${name}`);
  }
}

/** Deterministic prerequisite for standalone preview commands as well as the full art build. */
export function buildPreviewFont(): void {
  const [face, path, size] = FONTS["font-body"]!;
  buildFont("font-body", face, size, path);
}

export function build(): void {
  buildPreviewFont();
  copyLiberation();
  const manifest = pixel.readManifest();
  manifest.fonts = [];
  pixel.writeJson({}, pixel.MANIFEST, manifest);
  console.log("built private font-body and served Liberation fonts");
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
