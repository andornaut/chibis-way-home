/**
 * Reusable platforming pieces, 12px tiles in eight columns, with the street's blue-grey materials.
 *
 * Usage: node art/tools/obstacles.ts build | preview OUT.png
 * Run from the repository root. Build writes tiles-platforming.png/.json and merges its manifest
 * entry.
 *
 * Solid terrain is assembled from top, bottom, left, right, corner and fill tiles, and
 * platform-slab-left, platform-slab and platform-slab-right (after the crumbling ledges) for a
 * one-row block, the top over the bottom's closing band. The top has a white lip; wall and ceiling
 * edges have no white lip. One-way ledges are thin slabs, transparent underneath.
 *
 * Crumbling ledges reuse the one-way ledge cells exactly (opaque rows 0..5, the same per-side
 * mask) and add marks only inside that band, never touching columns 0 or 11, so any
 * left/middle/right repeat stays seamless. The intact frames carry a faint lip notch and a short
 * dslate body seam and still read as a safe white lip. The warn frames carry bold, branched navy
 * cracks through the lip and body with grey tips. crumbling-ledge and crumbling-ledge-warn alias
 * their middle tiles.
 *
 * Hazards are separate transparent overlay tiles: a solid 4px bright-red panel on the supporting
 * surface or edge, never spikes. Every theme uses the same red. Place hazard-top in the cell ABOVE
 * a solid: its band occupies rows 8..11. Place hazard-bottom BELOW a solid (rows 0..3),
 * hazard-left LEFT of a solid (columns 8..11), and hazard-right RIGHT of a solid (columns 0..3).
 * Their hitboxes cover exactly the four visible rows or columns, so a contact kills from any
 * direction. Overlays have no terrain collision themselves. The supporting solid retains its
 * full-cell collision. No hazard is drawn across a safe white lip.
 *
 * The preview is a conceptual 720x720 assembly with two 720x360 phone views, a low-ceiling jump, a
 * high ledge and floor, wall and ceiling contact strips. It is an art composition, not a validated
 * level.
 */

import { readFileSync, writeFileSync } from "node:fs";

import { decodePng, encodeRgbPng } from "@andornaut/art-kit/png";
import { composite, crop, filledImage } from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { TILE as T } from "../../src/data/screen.ts";
import { commands, run } from "./cli.ts";
import { greyscale, rect, rgba } from "./imageArt.ts";
import * as pixel from "./pixel.ts";

const KEY = "tiles-platforming";
export const HITBOXES: Record<string, pixel.Hitbox> = {
  "hazard-bottom": { x: 0, y: 0, width: 12, height: 4 },
  "hazard-left": { x: 8, y: 0, width: 4, height: 12 },
  "hazard-right": { x: 0, y: 0, width: 4, height: 12 },
  "hazard-top": { x: 0, y: 8, width: 12, height: 4 },
};
const USAGE = "Usage: obstacles.ts build | preview OUT.png";
const PNG = { deflateLevel: 9, deflateStrategy: 0, filterType: 0 };

function solid(top = false, bottom = false, left = false, right = false): RgbaImage {
  const im = filledImage(rgba("slate"), T, T);
  if (left) {
    rect("dslate", [0, 0, 2, T], im);
  }
  if (right) {
    rect("dslate", [10, 0, 12, T], im);
  }
  if (bottom) {
    rect("dslate", [0, 9, T, 11], im);
    rect("navy", [0, 11, T, 12], im);
  }
  if (top) {
    rect("navy", [0, 0, T, 1], im);
    rect("white", [0, 1, T, 3], im);
    rect("lgrey", [0, 3, T, 5], im);
  }
  return im;
}

function ledge(side: string): RgbaImage {
  const im = filledImage([0, 0, 0, 0], T, T);
  for (const [y0, y1, colour] of [
    [0, 1, "navy"],
    [1, 3, "white"],
    [3, 5, "lgrey"],
    [5, 6, "dslate"],
  ] as const) {
    rect(colour, [0, y0, T, y1], im);
  }
  if (side === "left") {
    rect("navy", [0, 3, 1, 6], im);
  }
  if (side === "right") {
    rect("navy", [11, 3, 12, 6], im);
  }
  return im;
}

// Marks for ledge rows 1..5, one string per row, 12 columns: "." keeps the ledge pixel, other codes
// recolour it. Right frames mirror the left ones.
const MARK_COLOURS: Record<string, string> = { d: "dslate", g: "grey", l: "lgrey", n: "navy" };
const CRUMBLING_MARKS: Record<string, readonly string[]> = {
  "intact left": ["............", "....l.......", ".......d....", ".......d....", "............"],
  "intact middle": ["............", ".........l..", ".....d......", ".....d......", "............"],
  "warn left": [".....n...n..", ".....n...n..", "...g..n.n.n.", "..g...n.n...", ".......n...."],
  "warn middle": ["...n....n...", "...n....n...", "..g.n..n.n..", ".g..n..n..g.", ".....n.n...."],
};

function crumblingLedge(state: string, side: string): RgbaImage {
  const im = ledge(side);
  const rows = CRUMBLING_MARKS[`${state} ${side === "right" ? "left" : side}`] as readonly string[];
  rows.forEach((row, i) => {
    const y = i + 1;
    [...(side === "right" ? [...row].reverse().join("") : row)].forEach((code, x) => {
      if (code !== ".") {
        im.data.set(rgba(MARK_COLOURS[code] as string), (y * im.width + x) * 4);
      }
    });
  });
  return im;
}

export function hazard(side: string): RgbaImage {
  const im = filledImage([0, 0, 0, 0], T, T);
  const { height, width, x, y } = HITBOXES[`hazard-${side}`] as pixel.Hitbox;
  rect("red", [x, y, x + width, y + height], im);
  return im;
}

export function tiles(): [name: string, tile: RgbaImage][] {
  const items: [string, RgbaImage][] = [];
  for (const [name, flags] of [
    ["platform-top", [1, 0, 0, 0]],
    ["platform-top-left", [1, 0, 1, 0]],
    ["platform-top-right", [1, 0, 0, 1]],
    ["platform-top-joint", [1, 0, 0, 0]],
    ["platform-face", [0, 0, 0, 0]],
    ["platform-face-left", [0, 0, 1, 0]],
    ["platform-face-right", [0, 0, 0, 1]],
    ["platform-bottom", [0, 1, 0, 0]],
    ["platform-bottom-left", [0, 1, 1, 0]],
    ["platform-bottom-right", [0, 1, 0, 1]],
  ] as const) {
    const [top, bottom, left, right] = flags.map(Boolean) as [boolean, boolean, boolean, boolean];
    const tile = solid(top, bottom, left, right);
    if (name === "platform-top-joint") {
      rect("dslate", [10, 5, 12, 7], tile);
    }
    items.push([name, tile]);
  }
  for (const side of ["left", "middle", "right"]) {
    items.push([`one-way-ledge-${side}`, ledge(side)]);
  }
  for (const side of ["top", "bottom", "left", "right"]) {
    items.push([`hazard-${side}`, hazard(side)]);
  }
  for (const [state, prefix] of [
    ["intact", "crumbling-ledge"],
    ["warn", "crumbling-ledge-warn"],
  ] as const) {
    for (const side of ["left", "middle", "right"]) {
      items.push([`${prefix}-${side}`, crumblingLedge(state, side)]);
    }
  }
  // Appended so the earlier indices hold.
  items.push(
    ["platform-slab-left", solid(true, true, true, false)],
    ["platform-slab", solid(true, true, false, false)],
    ["platform-slab-right", solid(true, true, false, true)],
  );
  return items;
}

export async function build(): Promise<void> {
  const entry = await pixel.writeTileset({ hitboxes: HITBOXES, key: KEY }, tiles());
  const path = `public/art/${String(entry.json)}`;
  const data = JSON.parse(readFileSync(path, "utf8")) as { tiles: Record<string, number> };
  for (const alias of ["crumbling-ledge", "crumbling-ledge-warn", "one-way-ledge"]) {
    data.tiles[alias] = data.tiles[`${alias}-middle`] as number;
  }
  pixel.writeJson({ sortKeys: true }, path, data);
  pixel.updateManifest("tilesets", [entry]);
}

export function preview(out: string): void {
  const im = filledImage(rgba("lgrey"), 720, 720);
  const ts = new Map(tiles());
  const put = (name: string, c: number, r: number) =>
    composite({ x: c * T, y: r * T }, ts.get(name) as RgbaImage, im);
  const block = (c: number, r: number, w: number, h: number) => {
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const name = yy === 0 ? "platform-top" : yy === h - 1 ? "platform-bottom" : "platform-face";
        const side = xx === 0 ? "-left" : xx === w - 1 ? "-right" : "";
        put(side ? name + side : name, c + xx, r + yy);
      }
    }
  };

  // Open skyline silhouettes stay lower in contrast than the play plane.
  for (const [c, r, w] of [
    [0, 12, 8],
    [11, 5, 6],
    [22, 9, 10],
    [37, 3, 8],
    [50, 11, 10],
  ] as const) {
    rect("grey", [c * T, r * T, (c + w) * T, 600], im);
  }
  block(0, 50, 60, 10);
  block(5, 44, 8, 2);
  block(18, 39, 7, 3);
  block(31, 35, 9, 3);
  block(43, 29, 10, 4);
  block(7, 17, 12, 2);
  // Low ceiling above the short route; strips project into free cells.
  block(5, 44, 8, 2);
  block(5, 38, 8, 2);
  for (let c = 5; c < 13; c++) {
    put("hazard-bottom", c, 40);
  }
  for (let c = 26; c < 30; c++) {
    put("hazard-top", c, 49);
    put("platform-face", c, 50);
  }
  for (let r = 36; r < 38; r++) {
    put("hazard-left", 30, r);
    put("hazard-right", 40, r);
  }
  for (let c = 19; c < 23; c++) {
    const side = c === 19 ? "left" : c === 22 ? "right" : "middle";
    put(`one-way-ledge-${side}`, c, 22);
  }
  const bird = crop(
    { x: 0, y: 0, width: 48, height: 42 },
    decodePng(readFileSync("public/art/sprites/bird.png")),
  );
  composite({ x: 24, y: 600 - 42 }, bird, im);
  writeFileSync(out, encodeRgbPng(PNG, im));
  const stem = out.replace(/\.[^./]*$/, "");
  writeFileSync(
    `${stem}-lower.png`,
    encodeRgbPng(PNG, crop({ x: 0, y: 360, width: 720, height: 360 }, im)),
  );
  writeFileSync(
    `${stem}-upper.png`,
    encodeRgbPng(PNG, crop({ x: 0, y: 0, width: 720, height: 360 }, im)),
  );
  // ITU-R 601-2 luma grey levels, written as an RGB PNG.
  writeFileSync(`${stem}-grey.png`, encodeRgbPng(PNG, greyscale(im)));
}

if (import.meta.main) {
  run(() => commands({ usage: USAGE, build, preview }));
}
