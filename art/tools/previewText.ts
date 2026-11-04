/**
 * Preview labels in the committed body bitmap font, public/art/fonts/font-body.png and .fnt. For
 * contact sheets and previews only; shipped art carries no text.
 */

import { readFileSync } from "node:fs";

import { composite, crop } from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { readImage } from "./imageArt.ts";
import * as pixel from "./pixel.ts";

const FONT = "public/art/fonts/font-body";
/** Pixels between preview text lines. */
const LINE_SPACING = 4;

export interface Glyph {
  x: number;
  y: number;
  width: number;
  height: number;
  xoffset: number;
  yoffset: number;
  xadvance: number;
}

interface BitmapFont {
  lineHeight: number;
  glyphs: Map<number, Glyph>;
  kernings: Map<string, number>;
  atlas: RgbaImage;
}

let font: BitmapFont | undefined;

function attributes(tag: string): Record<string, string> {
  return Object.fromEntries([...tag.matchAll(/(\w+)="([^"]*)"/g)].map(([, k, v]) => [k, v]));
}

/** font-body's metrics, kernings and atlas, parsed once. */
export function bitmapFont(): BitmapFont {
  if (font) {
    return font;
  }
  const xml = readFileSync(`${FONT}.fnt`, "utf8");
  const common = attributes(/<common\b[^>]*>/.exec(xml)?.[0] ?? "");
  const glyphs = new Map<number, Glyph>();
  for (const [tag] of xml.matchAll(/<char\b[^>]*>/g)) {
    const a = attributes(tag);
    glyphs.set(Number(a.id), {
      x: Number(a.x),
      y: Number(a.y),
      width: Number(a.width),
      height: Number(a.height),
      xoffset: Number(a.xoffset),
      yoffset: Number(a.yoffset),
      xadvance: Number(a.xadvance),
    });
  }
  const kernings = new Map<string, number>();
  for (const [tag] of xml.matchAll(/<kerning\b[^>]*>/g)) {
    const a = attributes(tag);
    kernings.set(`${a.first},${a.second}`, Number(a.amount));
  }
  font = {
    lineHeight: Number(common.lineHeight),
    glyphs,
    kernings,
    atlas: readImage(`${FONT}.png`),
  };
  return font;
}

/** The height of text's lines as drawLabel sets them, from the first line's top. */
export function labelHeight(text: string): number {
  const lines = text.split("\n").length;
  return lines * bitmapFont().lineHeight + (lines - 1) * LINE_SPACING;
}

/**
 * Draw text with its top-left at x, y in colour (a K name or hex string), each glyph's coverage
 * composited over image. "\n" starts a new line.
 */
export function drawLabel(
  { colour, x, y }: { x: number; y: number; colour: string },
  text: string,
  image: RgbaImage,
): void {
  const { atlas, glyphs, kernings, lineHeight } = bitmapFont();
  const [r, g, b] = pixel.rgb(colour);
  text.split("\n").forEach((line, row) => {
    const top = y + row * (lineHeight + LINE_SPACING);
    let cursor = x;
    let previous: number | undefined;
    for (const character of line) {
      const code = character.codePointAt(0) as number;
      const glyph = glyphs.get(code) ?? glyphs.get(63);
      if (!glyph) {
        continue;
      }
      if (previous !== undefined) {
        cursor += kernings.get(`${previous},${code}`) ?? 0;
      }
      if (glyph.width && glyph.height) {
        const ink = crop(
          { x: glyph.x, y: glyph.y, width: glyph.width, height: glyph.height },
          atlas,
        );
        for (let i = 0; i < ink.data.length; i += 4) {
          ink.data[i] = r;
          ink.data[i + 1] = g;
          ink.data[i + 2] = b;
        }
        composite({ x: cursor + glyph.xoffset, y: top + glyph.yoffset }, ink, image);
      }
      cursor += glyph.xadvance;
      previous = code;
    }
  });
}
