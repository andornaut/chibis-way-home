/**
 * Neutral reusable stage-transition illustration, 720x360, fully opaque, with no baked text or
 * controls.
 *
 * Usage: node art/tools/cutscene.ts build | preview OUT.png
 * Run from the repository root. Build writes public/art/images/stage-cutscene-placeholder.png only.
 *
 * CLEANUP (added 2026-10-31): retain this neutral illustration until authored stage cutscenes are
 * approved.
 *
 * Registry key stage-cutscene-placeholder: image, width 720, height 360. Draw at viewport origin
 * (0,0). Quiet lgrey/grey abstract blocks frame the canonical cream bird standing on a real safe
 * floor edge. No plot, place, event or additional character is depicted. The bottom 80px remains
 * plain for a runtime Continue action. The bird's existing idle frame is copied without
 * recolouring, resizing or redrawing. No tags or collision. Preview overlays the existing primary
 * button and font-body label; neither is included in the served image.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { rectangle, roundedRectangle } from "@andornaut/art-kit/draw";
import { decodePng, encodeRgbaPng } from "@andornaut/art-kit/png";
import { composite, crop, filledImage, resizeNearest } from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { commands, run } from "./cli.ts";
import { greyscale, rgba } from "./imageArt.ts";
import { bitmapFont, type Glyph } from "./previewText.ts";

const USAGE = "Usage: cutscene.ts build | preview OUT.png";
const PNG = { deflateLevel: 9, deflateStrategy: 3, filterType: -1 };
const KEY = "stage-cutscene-placeholder";
const OUT = `public/art/images/${KEY}.png`;
const SIZE = [720, 360] as const;

interface SpriteSheet {
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
  meta: { frameTags: { name: string; from: number }[] };
}

/** The first frame of a sprite's tag, cropped from its exported sheet. */
function sprite(key: string, tag: string): RgbaImage {
  const data = JSON.parse(readFileSync(`public/art/sprites/${key}.json`, "utf8")) as SpriteSheet;
  const found = data.meta.frameTags.find((t) => t.name === tag);
  if (!found) {
    throw new Error(`${key}: no tag ${tag}`);
  }
  const entry = Object.values(data.frames)[found.from];
  if (!entry) {
    throw new Error(`${key}: no frame ${found.from}`);
  }
  const { h, w, x, y } = entry.frame;
  const sheet = decodePng(new Uint8Array(readFileSync(`public/art/sprites/${key}.png`)));
  return crop({ x, y, width: w, height: h }, sheet);
}

function illustration(): RgbaImage {
  const im = filledImage(rgba("lgrey"), SIZE[0], SIZE[1]);
  // Broad neutral blocks suggest depth without depicting a new destination or story prop.
  for (const [x0, y0, x1, y1] of [
    [0, 142, 112, 247],
    [58, 102, 156, 247],
    [560, 118, 656, 247],
    [624, 160, 719, 247],
  ] as const) {
    roundedRectangle({ radius: 10, fill: rgba("grey") }, { x0, y0, x1, y1 }, im);
  }
  for (const [x0, y0, x1, y1] of [
    [0, 218, 184, 247],
    [536, 218, 719, 247],
  ] as const) {
    roundedRectangle({ radius: 6, fill: rgba("slate") }, { x0, y0, x1, y1 }, im);
  }
  // Shared safe-edge grammar: one dark edge and two light pixels over the solid floor.
  rectangle({ fill: rgba("slate") }, { x0: 0, y0: 248, x1: 719, y1: 359 }, im);
  rectangle({ fill: rgba("navy") }, { x0: 0, y0: 248, x1: 719, y1: 248 }, im);
  rectangle({ fill: rgba("white") }, { x0: 0, y0: 249, x1: 719, y1: 250 }, im);
  rectangle({ fill: rgba("grey") }, { x0: 0, y0: 251, x1: 719, y1: 254 }, im);
  const bird = sprite("bird", "idle");
  composite({ x: 336, y: 248 - bird.height }, bird, im);
  return im;
}

function save(path: string, image: RgbaImage): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodeRgbaPng(PNG, image));
}

export function build(): void {
  save(OUT, illustration());
}

function button(im: RgbaImage, box: readonly [number, number, number, number]): void {
  const src = sprite("ui-button-primary", "normal");
  const [x, y, width, height] = box;
  const sx = [0, 2, 14, 16];
  const sy = [0, 4, 22, 28];
  const dx = [x, x + 2, x + width - 2, x + width];
  const dy = [y, y + 4, y + height - 6, y + height];
  const at = (edges: readonly number[], i: number) => edges[i] as number;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const piece = crop(
        {
          x: at(sx, col),
          y: at(sy, row),
          width: at(sx, col + 1) - at(sx, col),
          height: at(sy, row + 1) - at(sy, row),
        },
        src,
      );
      const scaled = resizeNearest(
        at(dx, col + 1) - at(dx, col),
        at(dy, row + 1) - at(dy, row),
        piece,
      );
      composite({ x: at(dx, col), y: at(dy, row) }, scaled, im);
    }
  }
  // Preview-only existing action label, never exported in the backdrop.
  const { atlas, glyphs } = bitmapFont();
  const label = "Continue";
  const glyphOf = (c: string): Glyph => {
    const glyph = glyphs.get(c.charCodeAt(0));
    if (!glyph) {
      throw new Error(`font-body has no ${c}`);
    }
    return glyph;
  };
  const labelWidth = [...label].reduce((sum, c) => sum + glyphOf(c).xadvance, 0) * 2 - 2;
  let cursor = x + Math.floor((width - labelWidth) / 2);
  for (const c of label) {
    const f = glyphOf(c);
    const glyph = crop({ x: f.x, y: f.y, width: f.width, height: f.height }, atlas);
    const scaled = resizeNearest(glyph.width * 2, glyph.height * 2, glyph);
    composite({ x: cursor + f.xoffset * 2, y: y + 13 + f.yoffset * 2 }, scaled, im);
    cursor += f.xadvance * 2;
  }
}

function preview(out: string): void {
  const im = illustration();
  button(im, [280, 296, 160, 48]);
  save(out, im);
  const stem = out.replace(/\.[^./]*$/, "");
  save(`${stem}-grey.png`, greyscale(im));
  save(`${stem}-phone.png`, resizeNearest(864, 432, im));
}

if (import.meta.main) {
  run(() => commands({ usage: USAGE, build, preview }));
}
