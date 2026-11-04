/**
 * Apartment wayfinding props, bottom-left anchored on the local floor.
 *
 * The ordinary room door is 60x84; the unchanged stair markers are 48x72.
 *
 * Usage: node art/tools/apartmentWayfinding.ts build | preview OUT.png
 * Run from the repository root. Build writes the four backdrop PNGs and lists them in the manifest.
 *
 * - apartment-stairwell: an open recess containing an ascending stepped silhouette, with a white
 *   up-arrow on a dslate sign. It identifies an automatic upstairs walking trigger, not a Use action
 *   or physical stair mechanic.
 * - apartment-stairwell-down: the same recess with a descending silhouette and a white down-arrow.
 * - apartment-stairwell-door: a closed warm-panelled 48x72 stair entrance, without an arrow or Use
 *   action.
 * - apartment-room-door: a muted peach-panelled 60x84 optional room door in grey jambs with a small
 *   amber handle. No arrow.
 *
 * Registry contract: each key uses backdrops/<key>.png, size 60x84 for the room door and 48x72 for
 * stairs, anchor bottom-left, y 720, repeat none. There are no animation tags, collision boxes or
 * light anchors. Place the frame bottom on the local floor. Only real terrain carries a safe white
 * lip; these props have no continuous white horizontal edge.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { decodePng, encodeRgbaPng, encodeRgbPng } from "@andornaut/art-kit/png";
import { composite, crop, filledImage, resizeNearest } from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { commands, run } from "./cli.ts";
import { greyscale, rect, rgba } from "./imageArt.ts";
import * as pixel from "./pixel.ts";
import * as roomDoors from "./roomDoors.ts";

const SIZE = [48, 72] as const;
const KEYS = [
  "apartment-room-door",
  "apartment-stairwell",
  "apartment-stairwell-door",
  "apartment-stairwell-down",
] as const;
const BACKDROPS = "public/art/backdrops";
const USAGE = "Usage: apartmentWayfinding.ts build | preview OUT.png";
const PNG = { deflateLevel: 9, deflateStrategy: 0, filterType: 0 };
export const REGISTRY = KEYS.map((key) => ({
  key,
  png: `backdrops/${key}.png`,
  width: key === "apartment-room-door" ? 60 : 48,
  height: key === "apartment-room-door" ? 84 : 72,
  anchor: "bottom-left",
  y: 720,
  repeat: "none",
}));

function canvas(): RgbaImage {
  return filledImage([0, 0, 0, 0], ...SIZE);
}

export function stairwell(down = false): RgbaImage {
  const im = canvas();
  // Rose plaster jambs surround an open, cool recess rather than a closed door leaf.
  for (const [box, colour] of [
    [[3, 4, 45, 72], "dbrown"],
    [[4, 5, 44, 72], "zone-red-shade"],
    [[7, 8, 41, 72], "navy"],
    [[8, 9, 40, 72], "dslate"],
    [[8, 10, 11, 72], "slate"],
    [[39, 10, 41, 72], "ink"],
  ] as const) {
    rect(colour, box, im);
  }
  // Quiet broad steps rise into the recess; they have no bright standable lip.
  if (down) {
    for (const [x, y] of [
      [9, 40],
      [16, 48],
      [23, 56],
      [30, 64],
    ] as const) {
      rect("grey", [x, y, Math.min(x + 7, 40), 72], im);
      rect("slate", [x, y, Math.min(x + 7, 40), y + 2], im);
    }
  } else {
    for (const [x, y] of [
      [9, 64],
      [16, 56],
      [23, 48],
      [30, 40],
    ] as const) {
      rect("grey", [x, y, 40, 72], im);
      rect("slate", [x, y, 40, y + 2], im);
    }
  }
  rect("navy", [14, 4, 39, 29], im);
  rect("dslate", [15, 5, 38, 28], im);
  // A compact directional arrow, separated from the architecture by a dark sign.
  if (down) {
    rect("white", [24, 10, 29, 19], im);
    for (const [y, half] of [
      [18, 6],
      [19, 5],
      [20, 4],
      [21, 3],
      [22, 2],
      [23, 1],
    ] as const) {
      rect("white", [26 - half, y, 27 + half, y + 1], im);
    }
  } else {
    for (const [y, half] of [
      [10, 1],
      [11, 2],
      [12, 3],
      [13, 4],
      [14, 5],
      [15, 6],
    ] as const) {
      rect("white", [26 - half, y, 27 + half, y + 1], im);
    }
    rect("white", [24, 15, 29, 24], im);
  }
  return im;
}

function roomDoor(): RgbaImage {
  return roomDoors.image("apartment");
}

/** Closed 48x72 stair entrance skin, independent of ordinary Use-room door artwork. */
export function stairwellDoor(): RgbaImage {
  const im = canvas();
  for (const [box, colour] of [
    [[5, 10, 43, 72], "dbrown"],
    [[6, 11, 42, 72], "ochre"],
    [[7, 12, 10, 72], "amber"],
    [[10, 12, 39, 15], "amber"],
    [[10, 15, 39, 72], "dbrown"],
    [[12, 17, 37, 72], "tan"],
    [[13, 18, 15, 70], "skin1"],
    [[33, 18, 37, 72], "brown"],
    [[17, 24, 31, 41], "brown"],
    [[18, 25, 30, 40], "skin1"],
    [[17, 48, 31, 65], "brown"],
    [[18, 49, 30, 64], "skin1"],
    [[32, 43, 35, 50], "dbrown"],
    [[31, 44, 35, 47], "amber"],
  ] as const) {
    rect(colour, box, im);
  }
  return im;
}

export function images(): Record<(typeof KEYS)[number], RgbaImage> {
  return {
    "apartment-room-door": roomDoor(),
    "apartment-stairwell": stairwell(),
    "apartment-stairwell-door": stairwellDoor(),
    "apartment-stairwell-down": stairwell(true),
  };
}

export function build(): void {
  mkdirSync(BACKDROPS, { recursive: true });
  for (const [key, im] of Object.entries(images())) {
    writeFileSync(`${BACKDROPS}/${key}.png`, encodeRgbaPng(PNG, im));
  }
  pixel.updateManifest("backdrops", REGISTRY);
}

export function preview(out: string): void {
  const im = filledImage(rgba("zone-red"), 720, 360);
  for (let x = 0; x < 720; x += 144) {
    rect("zone-red-shade", [x, 48, x + 2, 252], im);
  }
  rect("zone-red-shade", [0, 244, 720, 252], im);
  rect("dbrown", [0, 252, 720, 360], im);
  // The bright edge below belongs to actual floor terrain, never either backdrop.
  rect("plum", [0, 252, 720, 253], im);
  rect("cream", [0, 253, 720, 255], im);
  for (const [key, x] of [
    ["apartment-stairwell", 180],
    ["apartment-stairwell-down", 336],
    ["apartment-room-door", 492],
  ] as const) {
    const prop = images()[key];
    composite({ x, y: 252 - prop.height }, prop, im);
  }
  const bird = crop(
    { x: 0, y: 0, width: 48, height: 42 },
    decodePng(readFileSync("public/art/sprites/bird.png")),
  );
  composite({ x: 260, y: 210 }, bird, im);
  writeFileSync(out, encodeRgbaPng(PNG, im));
  const stem = out.replace(/\.[^./]*$/, "");
  // ITU-R 601-2 luma grey levels, written as an RGB PNG.
  writeFileSync(`${stem}-grey.png`, encodeRgbPng(PNG, greyscale(im)));
  writeFileSync(`${stem}-phone.png`, encodeRgbaPng(PNG, resizeNearest(864, 432, im)));
  writeFileSync(`${stem}-3x.png`, encodeRgbaPng(PNG, resizeNearest(2160, 1080, im)));
}

if (import.meta.main) {
  run(() => commands({ usage: USAGE, build, preview }));
}
