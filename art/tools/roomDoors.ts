/**
 * Ordinary Use-room doors, 60x84 (5x7 tiles), with a 48px clear leaf, bottom anchored at the local
 * floor.
 *
 * Muted complete jambs enclose a blue glazed street door or a peach apartment panel door. Amber is
 * confined to a small handle. No arrow, text, continuous white safe lip, hazard red, collision or
 * light data. Existing non-door street tile indices and apartment stair markers retain their
 * contracts.
 *
 * Usage from the repository root:
 *   node art/tools/roomDoors.ts build            export the street tileset, apartment room door
 *                                                and closed stair entrance
 *   node art/tools/roomDoors.ts preview OUT.png  compare both doors with native Chibi on enclosed
 *                                                wall sections
 */

import { readFileSync, writeFileSync } from "node:fs";

import { renderFrame } from "@andornaut/art-kit/generate";
import { decodePng, encodeRgbaPng, encodeRgbPng } from "@andornaut/art-kit/png";
import { composite, crop, fill, filledImage, resizeNearest } from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { commands, run } from "./cli.ts";
import { frameImage, greyscale, rgba } from "./imageArt.ts";
import * as pixel from "./pixel.ts";

const SIZE = [60, 84] as const;
const USAGE = "Usage: roomDoors.ts build | preview OUT.png";
const PNG = { deflateLevel: 9, deflateStrategy: 0, filterType: 0 };

export function door(style = "street"): pixel.Grid {
  const apartment = style === "apartment";
  const leaf = apartment ? "zone-peach" : "zone-blue-shade";
  const panel = apartment ? "zone-peach-shade" : "zone-blue";
  const shade = apartment ? "zone-peach-shade" : "slate";
  const grid = new pixel.Grid(...SIZE);
  for (const [x, y, width, height, colour] of [
    [0, 0, 60, 84, "grey"],
    [0, 0, 60, 3, "lgrey"],
    [0, 3, 3, 81, "lgrey"],
    [57, 3, 3, 81, "slate"],
    [4, 6, 52, 78, "dslate"],
    [6, 8, 48, 74, leaf],
    [6, 8, 48, 2, panel],
    [6, 10, 2, 70, panel],
    [52, 10, 2, 72, shade],
    [10, 15, 40, 27, shade],
    [12, 17, 36, 23, panel],
    [12, 17, 2, 19, apartment ? "zone-red" : "lgrey"],
    [10, 50, 40, 25, shade],
    [12, 52, 36, 21, leaf],
    [46, 44, 5, 13, "dslate"],
    [47, 45, 3, 9, "amber"],
    [4, 82, 52, 2, "slate"],
  ] as const) {
    grid.rect(x, y, width, height, colour);
  }
  return grid;
}

export function image(style = "street"): RgbaImage {
  return frameImage(door(style).px);
}

export async function build(): Promise<void> {
  // Loaded when building: floor1.ts imports this module.
  const floor = await import("./floor1.ts");
  const wayfinding = await import("./apartmentWayfinding.ts");
  const [tiles, pieces] = floor.streetTilesCool();
  const entry = await pixel.writeTileset(
    { key: "tiles-street", pieces },
    tiles.map(([key, grid]) => [key, renderFrame({ resolveRgb: pixel.rgb }, grid.px)] as const),
  );
  pixel.updateManifest("tilesets", [entry]);
  writeFileSync(
    "public/art/backdrops/apartment-room-door.png",
    encodeRgbaPng(PNG, image("apartment")),
  );
  writeFileSync(
    "public/art/backdrops/apartment-stairwell-door.png",
    encodeRgbaPng(PNG, wayfinding.stairwellDoor()),
  );
  const keys = new Set(["apartment-room-door", "apartment-stairwell-door"]);
  pixel.updateManifest(
    "backdrops",
    wayfinding.REGISTRY.filter((registered) => keys.has(registered.key)),
  );
  console.log("built street door 5x7 and apartment-room-door 60x84");
}

export function preview(out: string): void {
  const result = filledImage(rgba("lgrey"), 720, 360);
  for (const [left, style, wall] of [
    [0, "street", "zone-purple"],
    [360, "apartment", "zone-red"],
  ] as const) {
    fill({ rect: { x: left, y: 0, width: 360, height: 252 } }, rgba(wall), result);
    fill({ rect: { x: left, y: 252, width: 360, height: 108 } }, rgba("grey"), result);
    fill({ rect: { x: left, y: 252, width: 360, height: 2 } }, rgba("slate"), result);
    composite({ x: left + 132, y: 168 }, image(style), result);
    const bird = crop(
      { x: 0, y: 0, width: 48, height: 42 },
      decodePng(readFileSync("public/art/sprites/bird.png")),
    );
    composite({ x: left + 194, y: 210 }, bird, result);
  }
  writeFileSync(out, encodeRgbaPng(PNG, result));
  const stem = out.replace(/\.[^./]*$/, "");
  // ITU-R 601-2 luma grey levels, written as an RGB PNG.
  writeFileSync(`${stem}-grey.png`, encodeRgbPng(PNG, greyscale(result)));
  writeFileSync(`${stem}-phone.png`, encodeRgbaPng(PNG, resizeNearest(864, 432, result)));
  writeFileSync(`${stem}-3x.png`, encodeRgbaPng(PNG, resizeNearest(2160, 1080, result)));
}

if (import.meta.main) {
  run(() => commands({ usage: USAGE, build, preview }));
}
