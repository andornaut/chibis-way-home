/**
 * Preview labels in the private body bitmap font, art/generated/fonts/font-body.png and .fnt. For
 * contact sheets and previews only; shipped art carries no text.
 */

import { readFileSync } from "node:fs";

import {
  type BitmapFont,
  drawBitmapText,
  measureBitmapText,
  readBitmapFont,
} from "@andornaut/art-kit/bitmapFont";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { buildPreviewFont, PREVIEW_FONT } from "./fonts.ts";
import { readImage } from "./imageArt.ts";
import * as pixel from "./pixel.ts";

const FONT = PREVIEW_FONT;
/** Pixels between preview text lines. */
const LINE_SPACING = 4;
const MISSING = { fallback: 63, absent: "skip" } as const;

type PreviewFont = BitmapFont & { atlas: RgbaImage };

let font: PreviewFont | undefined;

/** font-body's metrics, kernings and atlas, parsed once. */
export function bitmapFont(): PreviewFont {
  if (font) {
    return font;
  }
  buildPreviewFont();
  font = {
    ...readBitmapFont(readFileSync(`${FONT}.fnt`, "utf8")),
    atlas: readImage(`${FONT}.png`),
  };
  return font;
}

/** The height of text's lines as drawLabel sets them, from the first line's top. */
export function labelHeight(text: string): number {
  return measureBitmapText(
    { font: bitmapFont(), lineSpacing: LINE_SPACING, missing: MISSING },
    text,
  ).height;
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
  const ready = bitmapFont();
  drawBitmapText(
    {
      at: { x, y },
      atlas: ready.atlas,
      font: ready,
      lineSpacing: LINE_SPACING,
      missing: MISSING,
      tint: pixel.rgb(colour),
    },
    text,
    image,
  );
}
