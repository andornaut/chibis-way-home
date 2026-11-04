/**
 * Static start-screen background: opaque 720x360, top-left origin, no repeat or animation.
 *
 * Seven low outer skyline silhouettes leave the logo and action field clear. A single ground band
 * anchors the scene. The existing lgrey, zone-blue and zone-blue-shade palette colours are used
 * directly, without ambient dimming. This image has no collision or light data and does not alter
 * the homepage.
 *
 * Usage from the repository root:
 *   node art/tools/start.ts build             write the PNG and update its manifest image entry
 *   node art/tools/start.ts preview OUT.png   show the background at 3x nearest-neighbour scale
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, posix } from "node:path";

import { rectangle } from "@andornaut/art-kit/draw";
import { encodeRgbaPng } from "@andornaut/art-kit/png";
import { filledImage, type Rgba, resizeNearest } from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { commands, run } from "./cli.ts";
import { dumpJson, type ManifestEntry, rgb } from "./pixel.ts";

const USAGE = "Usage: start.ts build | preview OUT.png";
const PNG = { deflateLevel: 9, deflateStrategy: 3, filterType: -1 };
const SIZE = [720, 360] as const;
const KEY = "start-background";
const OUT = "public/art/images/start-background.png";
const MANIFEST = "public/art/manifest.json";
const PALETTE = "public/art/palette.json";
const GROUND_Y = 332;
const SKYLINE = [
  [0, 277, 48],
  [48, 290, 34],
  [82, 266, 35],
  [117, 297, 44],
  [586, 294, 35],
  [621, 275, 49],
  [670, 288, 50],
] as const;

function background(): RgbaImage {
  const colours = (JSON.parse(readFileSync(PALETTE, "utf8")) as { colours: Record<string, string> })
    .colours;
  const colour = (name: string): Rgba => [...rgb((colours[name] as string).slice(1)), 255];
  const image = filledImage(colour("lgrey"), SIZE[0], SIZE[1]);
  for (const [x, y, width] of SKYLINE)
    rectangle(
      { fill: colour("zone-blue") },
      { x0: x, y0: y, x1: x + width - 1, y1: GROUND_Y - 1 },
      image,
    );
  rectangle(
    { fill: colour("zone-blue-shade") },
    { x0: 0, y0: GROUND_Y, x1: SIZE[0] - 1, y1: SIZE[1] - 1 },
    image,
  );
  return image;
}

function save(path: string, image: RgbaImage): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodeRgbaPng(PNG, image));
}

function build(): void {
  save(OUT, background());
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as Record<string, unknown>;
  const entries = new Map<string, ManifestEntry>();
  for (const entry of (manifest.images as ManifestEntry[] | undefined) ?? [])
    entries.set(entry.key, entry);
  entries.set(KEY, {
    key: KEY,
    png: posix.relative(posix.dirname(MANIFEST), OUT),
    width: SIZE[0],
    height: SIZE[1],
  });
  manifest.images = [...entries.values()].sort((a, b) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0,
  );
  writeFileSync(MANIFEST, dumpJson({}, manifest));
  console.log(`built ${KEY} ${SIZE[0]}x${SIZE[1]}`);
}

function preview(out: string): void {
  save(out, resizeNearest(SIZE[0] * 3, SIZE[1] * 3, background()));
}

if (import.meta.main) run(() => commands({ usage: USAGE, build, preview }));
