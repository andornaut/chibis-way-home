/**
 * Reusable decorative apartment furnishings at the canonical bird scale.
 *
 * Usage: node art/tools/apartmentProps.ts build | preview OUT.png, from the repository root. Plain
 * PNG exports. Ten bottom-left backdrops default to world y 720. Only pool-water repeats x; its
 * horizontal edges match. All props are decorative with no collision, white walkable lip, hazard
 * paint, characters or text. Physical platforms and doors remain separately placed objects. Pool
 * water has no lethal behaviour. Zone-red rose ties the rooms together with quiet wood, sage and
 * blue accents from the existing palette. The preview is a furniture contact sheet beside the 48x42
 * bird, not a proposed level layout.
 */

import { paste } from "@andornaut/art-kit/raster";

import * as backgroundTones from "./backgroundTones.ts";
import { commands, run } from "./cli.ts";
import {
  BACKDROPS_DIR,
  cropBox,
  ellipse,
  image,
  line,
  polygon,
  readImage,
  rect,
  type RgbaImage,
  writeImage,
  writeRgbImage,
} from "./imageArt.ts";
import * as pixel from "./pixel.ts";
import { drawLabel, labelHeight } from "./previewText.ts";

export const SIZES: Readonly<Record<string, readonly [width: number, height: number]>> = {
  "restaurant-counter": [96, 48],
  "restaurant-booth": [72, 48],
  "pool-water": [96, 24],
  "pool-bench": [72, 36],
  "spa-screen": [72, 96],
  "spa-bench": [72, 36],
  "residential-shelf": [72, 96],
  "lobby-desk": [96, 48],
  "lobby-sofa": [96, 48],
  "lobby-plant": [36, 60],
};
const USAGE = "Usage: apartmentProps.ts build | preview OUT.png";

function legs(
  { bottom, top, xs }: { xs: readonly number[]; top: number; bottom: number },
  im: RgbaImage,
): void {
  for (const x of xs) {
    rect("dbrown", [x, top, x + 4, bottom], im);
    rect("zone-peach-shade", [x + 1, top, x + 3, bottom - 1], im);
  }
}

export function draw(kind: string): RgbaImage {
  const size = SIZES[kind];
  if (!size) throw new Error(`unknown apartment prop ${kind}`);
  const [w, h] = size;
  const im = image(w, h);
  if (kind === "restaurant-counter" || kind === "lobby-desk") {
    rect("dbrown", [2, 10, 94, 48], im);
    rect("zone-peach-shade", [5, 15, 91, 44], im);
    rect("zone-red-shade", [8, 18, 88, 40], im);
    for (const x of [32, 62]) rect("dbrown", [x, 18, x + 2, 40], im);
    rect("brown", [0, 8, 96, 15], im);
    rect("zone-peach", [2, 9, 94, 12], im);
    if (kind === "restaurant-counter") {
      ellipse("zone-peach", [12, 4, 34, 10], im);
      ellipse("zone-peach-shade", [16, 6, 30, 9], im);
      rect("zone-green-shade", [70, 1, 78, 8], im);
    } else {
      rect("zone-blue-shade", [64, 1, 82, 8], im);
      rect("dslate", [62, 6, 84, 9], im);
    }
  } else if (kind === "restaurant-booth" || kind === "lobby-sofa") {
    legs({ xs: [8, w - 12], top: 39, bottom: 48 }, im);
    rect("dbrown", [3, 2, w - 3, 38], im);
    rect("zone-red-shade", [5, 4, w - 5, 34], im);
    rect("zone-red", [8, 5, w - 8, 25], im);
    rect("zone-red", [4, 29, w - 4, 38], im);
    rect("zone-red-shade", [4, 38, w - 4, 42], im);
    rect("zone-red-shade", [Math.floor(w / 2) - 1, 6, Math.floor(w / 2) + 1, 24], im);
    if (kind === "lobby-sofa")
      for (const x of [1, w - 13]) {
        rect("dbrown", [x, 19, x + 12, 41], im);
        rect("zone-red-shade", [x + 2, 20, x + 10, 38], im);
      }
  } else if (kind === "pool-water") {
    rect("zone-blue-shade", [0, 0, 96, 24], im);
    rect("zone-blue", [0, 3, 96, 21], im);
    rect("zone-blue-shade", [0, 11, 96, 13], im);
    for (const x of [8, 40, 72]) {
      rect("zone-blue-shade", [x, 6, x + 16, 8], im);
      rect("zone-blue-shade", [x + 8, 17, x + 22, 19], im);
    }
  } else if (kind === "pool-bench" || kind === "spa-bench") {
    legs({ xs: [7, 61], top: 22, bottom: 36 }, im);
    const wood = kind === "spa-bench" ? "zone-peach" : "zone-green";
    const shade = `${wood}-shade`;
    rect("dbrown", [2, 8, 70, 25], im);
    for (const y of [10, 17]) {
      rect(shade, [4, y, 68, y + 5], im);
      rect(wood, [5, y, 67, y + 2], im);
    }
    if (kind === "spa-bench") {
      rect("zone-green-shade", [45, 3, 64, 9], im);
      rect("zone-green", [46, 3, 63, 6], im);
    }
  } else if (kind === "spa-screen") {
    for (const [x, top, bottom] of [
      [0, 8, 96],
      [24, 0, 90],
      [48, 8, 96],
    ] as const) {
      rect("dbrown", [x + 1, top, x + 23, bottom], im);
      rect("zone-peach-shade", [x + 3, top + 3, x + 21, bottom - 8], im);
      rect("zone-green", [x + 5, top + 5, x + 19, bottom - 11], im);
      for (let y = top + 18; y < bottom - 10; y += 18)
        rect("zone-green-shade", [x + 5, y, x + 19, y + 2], im);
    }
  } else if (kind === "residential-shelf") {
    rect("dbrown", [4, 0, 68, 96], im);
    rect("zone-peach-shade", [8, 4, 64, 92], im);
    for (const y of [26, 56, 86]) rect("brown", [8, y, 64, y + 4], im);
    for (const [x, y, height, colour] of [
      [12, 7, 19, "zone-red"],
      [21, 12, 14, "zone-green"],
      [31, 6, 20, "zone-blue-shade"],
      [43, 38, 18, "zone-red-shade"],
    ] as const)
      rect(colour, [x, y, x + 7, y + height], im);
    ellipse("zone-peach", [13, 39, 32, 55], im);
    rect("zone-green-shade", [16, 70, 40, 86], im);
    rect("zone-green", [16, 70, 40, 74], im);
  } else if (kind === "lobby-plant") {
    for (const [[x, y], side] of [
      [[5, 8], -1],
      [[29, 3], 1],
      [[3, 24], -1],
      [[32, 26], 1],
    ] as const) {
      line(
        { colour: "zone-green-shade", width: 2 },
        [
          [18, 42],
          [x, y],
        ],
        im,
      );
      polygon(
        { colour: "zone-green-shade" },
        [
          [x, y],
          [x + side * 3, y + 8],
          [18, y + 16],
          [x - side * 3, y + 4],
        ],
        im,
      );
      polygon(
        { colour: "zone-green" },
        [
          [x, y + 2],
          [x - side * 2, y + 5],
          [17, y + 14],
        ],
        im,
      );
    }
    polygon(
      { colour: "dbrown" },
      [
        [5, 40],
        [31, 40],
        [27, 59],
        [9, 59],
      ],
      im,
    );
    polygon(
      { colour: "zone-red-shade" },
      [
        [7, 42],
        [29, 42],
        [25, 57],
        [11, 57],
      ],
      im,
    );
    rect("zone-red", [4, 39, 32, 44], im);
  }
  return im;
}

export function registry(): pixel.ManifestEntry[] {
  return Object.entries(SIZES).map(([key, [width, height]]) => ({
    key: `apartment-${key}`,
    png: `backdrops/apartment-${key}.png`,
    width,
    height,
    anchor: "bottom-left",
    y: 720,
    repeat: key === "pool-water" ? "x" : "none",
  }));
}

function build(): void {
  for (const key of Object.keys(SIZES))
    writeImage(
      `${BACKDROPS_DIR}/apartment-${key}.png`,
      backgroundTones.apply(`apartment-${key}`, draw(key)),
    );
}

function preview(out: string): void {
  const keys = Object.keys(SIZES);
  const label = (key: string) => key.replaceAll("-", "\n");
  // Rows of five 240px cells, extended below the last row so its labels are not clipped.
  const bottom = keys.reduce(
    (most, key, i) => Math.max(most, Math.floor(i / 5) * 240 + 212 + labelHeight(label(key)) + 4),
    480,
  );
  const im = image(720, bottom, "zone-red");
  const bird = cropBox([0, 0, 48, 42], readImage(`${pixel.SPRITES}/bird.png`));
  keys.forEach((key, i) => {
    const x = (i % 5) * 144;
    const y = Math.floor(i / 5) * 240;
    rect("zone-red-shade", [x + 4, y + 32, x + 140, y + 204], im);
    rect("dbrown", [x + 4, y + 204, x + 140, y + 207], im);
    const prop = draw(key);
    paste({ at: { x: x + 8, y: y + 204 - prop.height }, mask: "alpha", keepAlpha: true }, prop, im);
    paste({ at: { x: x + 94, y: y + 162 }, mask: "alpha", keepAlpha: true }, bird, im);
    drawLabel({ x: x + 5, y: y + 212, colour: "ink" }, label(key), im);
  });
  writeRgbImage(out, im);
}

if (import.meta.main) run(() => commands({ usage: USAGE, build, preview }));
