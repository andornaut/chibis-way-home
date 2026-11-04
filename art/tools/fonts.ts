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

import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";

import { buildBitmapFont } from "@andornaut/art-kit/fonts";
import { buildBitmapFontFromGlyphs } from "@andornaut/art-kit/glyphAtlas";
import { encodeRgbaPng } from "@andornaut/art-kit/png";
import { composite, crop, filledImage, resizeNearest } from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";
import { Canvas, FontLibrary } from "skia-canvas";

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
// Skia's measured ink bounds can miss antialiased edge pixels; wide spacing keeps them separable.
const RENDER_PADDING = 4;
const BLEED = 2;
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

const families = new Map<string, string>();

/** The face's line ascent and descent in whole pixels, rounded outwards. */
function metrics(size: number, path: string): readonly [ascent: number, descent: number] {
  let family = families.get(path);
  if (!family) {
    family = `fonts_metrics_${families.size}`;
    FontLibrary.use(family, path);
    families.set(path, family);
  }
  const canvas = new Canvas(1, 1);
  canvas.gpu = false;
  const context = canvas.getContext("2d");
  context.font = `${size}px "${family}"`;
  const measured = context.measureText(" ");
  return [Math.ceil(measured.fontBoundingBoxAscent), Math.ceil(measured.fontBoundingBoxDescent)];
}

/** The smallest box holding every pixel with nonzero alpha, or undefined when there is none. */
function inkBox(
  image: RgbaImage,
): { x: number; y: number; width: number; height: number } | undefined {
  let [left, top, right, bottom] = [Infinity, Infinity, -1, -1];
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3]) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  return right < 0
    ? undefined
    : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/** Antialiased glyphs, line metrics and every nonzero pair kerning, in CHARS order. */
function rasterise(size: number, path: string): Rasterised {
  const [ascent, descent] = metrics(size, path);
  const font = buildBitmapFont({
    path,
    size,
    key: "glyphs",
    characters: CHARS,
    atlasWidth: 1024,
    padding: RENDER_PADDING,
    base: ascent,
    kerning: "all",
    antialias: true,
    hinting: true,
  });
  const atlas = font.image.getContext("2d").getImageData(0, 0, font.image.width, font.image.height);
  const sheet: RgbaImage = {
    width: atlas.width,
    height: atlas.height,
    data: new Uint8Array(atlas.data.buffer, atlas.data.byteOffset, atlas.data.byteLength),
  };
  const glyphs = new Map<string, Glyph>();
  for (const char of CHARS) {
    const placed = font.metadata.glyphs.get(char);
    if (!placed) {
      throw new Error(`No glyph for ${JSON.stringify(char)}`);
    }
    const cell = placed.width
      ? crop(
          {
            x: placed.x - BLEED,
            y: placed.y - BLEED,
            width: placed.width + 2 * BLEED,
            height: placed.height + 2 * BLEED,
          },
          sheet,
        )
      : undefined;
    const box = cell && inkBox(cell);
    if (!cell || !box) {
      glyphs.set(char, [undefined, 0, 0, placed.xadvance]);
      continue;
    }
    // White everywhere, coverage in alpha.
    const image = crop(box, cell);
    for (let i = 0; i < image.data.length; i += 4) {
      image.data.fill(255, i, i + 3);
    }
    glyphs.set(char, [
      image,
      placed.xoffset - BLEED + box.x,
      placed.yoffset - BLEED + box.y,
      placed.xadvance,
    ]);
  }
  const kernings = font.metadata.kernings.map(({ amount, first, second }): Kerning => [
    String.fromCodePoint(first),
    String.fromCodePoint(second),
    amount,
  ]);
  return { glyphs, ascent, descent, kernings };
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
    "Whole run: 02:34.56 · Deaths: 3 · Stages: 2/6",
    "j _ w AV To Wy 0123456789 !?.,:;'\"+-/%&()",
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
