/**
 * The park theme: an autumn park for chunk-built zones, as a 12px tileset, repeating backdrops and
 * props that the game places from chunk data.
 *
 * Usage, from the repository root:
 *   node art/tools/park.ts build            write public/art/tilesets/tiles-park.png + .json and
 *                                           public/art/backdrops/park-*.png, and merge them into
 *                                           the manifest's "tilesets" and "backdrops"
 *   node art/tools/park.ts preview OUT.png  two example chunks joined at a seam (1440x720) with the
 *                                           bird, above the tileset at 4x
 *
 * Frame and scale: as the street, outdoor scale (a storey about 180px, a door about 45px), 12px
 * tiles, zones 60 rows (720px) tall. Chunk seams sit at ground rows 50, 40 and 30 (y 600, 480 and
 * 360): a chunk's left and right edges meet the next chunk's at one of those heights. A step of 1
 * or 2 rows is a tap's walk-up (a tap rises about 1.5 tiles, a full hold about 6.5); a taller
 * terrace face is turf over soil, soil-left or soil-right running down the face, any height. There
 * are no slopes.
 *
 * Look: a peach autumn sky with cream clouds, tall muted peach treetops and a skin2 city behind,
 * close to the sky's value; the ground two bright rows deep (a cream-lipped grass top over green
 * turf) and then warm brown soil with sparse 2px pebble clusters. Every walkable top carries a 2px
 * light lip under a 1px dark edge, the brightest edge against what is behind it.
 *
 * tiles-park (12x12; the tileset format and collision rules are in art/style-guide.md, Export contracts)
 * - grass-top, grass-top-left, grass-top-right: the walkable top, solid; the end tiles round the
 *   lip on an exposed side (a step's riser).
 * - turf, turf-left, turf-right: the row under a grass top, solid: green with 2px roots into the
 *   soil.
 * - soil, soil-pebbles, soil-left, soil-right: the fill below, solid; use soil-pebbles on about
 *   one tile in five; the side tiles show a brown band where the ground is exposed.
 * - grass-bottom-left, grass-bottom, grass-bottom-right: the soil closed off underneath, solid: the
 *   side tiles' dark-brown band and plum edge along the bottom, for the underside of a raised or
 *   floating block. After the thorn hedge, so every earlier index holds.
 * - path-top, path-top-joint: a gravel path top, solid; alternate them.
 * - step-stair, step-stair-left: a stone stair tread inset in a step's grass top, solid, with a
 *   white lip so it holds 2:1 against the tan treetops. Lay steps 2 columns deep and 1 or 2 rows
 *   high; make every other one a stair.
 * - one-way-bench-left, one-way-bench, one-way-bench-right: a bench's seat-back top, 2 rows above
 *   the ground.
 * - one-way-branch-left, one-way-branch, one-way-branch-right: a tree's branch, 6 rows above the
 *   ground.
 * - one-way-bandstand-left, one-way-bandstand, one-way-bandstand-right: the bandstand roof, 6 rows
 *   above its base, with a white lip so it holds 2:1 against the tan treetops behind it.
 * - hazard-pond-left, hazard-pond, hazard-pond-right; hazard-pond-bed-left, hazard-pond-bed,
 *   hazard-pond-bed-right: a shallow pond two rows deep, drawn for a pond hazard placed with a
 *   width; not solid. The first row's water surface sits 4px below its top with 2px ripples; the
 *   second row is darker water over a mud bed. Touching the water restarts her: the first row's
 *   tiles hit {x 0, y 4, width 12, height 8} (the tileset's "hitboxes") and the bed row its whole
 *   cell, so 20px from the water surface down. The grass banks beside it stay solid; solid soil
 *   goes under the bed row.
 * - hazard-thorn-left, hazard-thorn, hazard-thorn-right: a low thorn hedge one tile tall, drawn
 *   for a thorn hazard placed with a width; not solid. A dark bramble with pale 2px thorns and
 *   dark-red tips, no lip. Each tile hits {x 0, y 2, width 12, height 10} (the tileset's
 *   "hitboxes").
 *
 * Backdrops (bottom-left anchored at world y; repeat-x widths divide 720 so chunk seams never show)
 * - park-sky 48x600 (y 600, x): peach above, a step deeper tan from y 200 behind play.
 * - park-clouds 360x160 (y 200, x): two flat cream clouds.
 * - park-treetops 360x420 (y 600, x): branching muted peach treetops rising into the upper screen.
 * - park-city 360x200 (y 540, x): the city behind the trees, skin2, with two water towers.
 * - park-far-trees 240x120 (y 600, x): a low-contrast band of irregular distant peach crowns.
 * Sprites (sheets, public/art/sprites/<key>.png + .json, listed under the manifest's "sprites")
 * - park-boat, 72x18, facing right: a rowing boat, the moving platform on a pond. Its collision is
 *   6x1 tiles (72x12) with its top on the frame's row 0, the deck line: a 1px dark-brown edge on
 *   row 0 and a 2px cream lip on rows 1 and 2, like every walkable top; nothing is drawn above it.
 *   A tan gunwale (rows 3 and 4), then a rust hull lit ochre along its top and shaded dark brown
 *   underneath, rounded to the keel at row 16 or 17, dipping into the pond's water rows. Tag idle,
 *   2 frames at 400ms: frame 1 drops the keel 1px; the deck line stays fixed.
 * - park-gate, 36x60 (3x5 tiles), the park's room door: no collision, and the game puts a Use zone
 *   over it. Anchor: the frame's bottom-left on the ground's top, centred in the door's slot. A
 *   wrought-iron arch (ink with plum lit edges) on two posts with leaf finials and ochre and rust
 *   leaves along the arch, over a pale skin1 opening above a brown path (the way on); two leaves
 *   of 2px bars with scrolls. Tags idle (closed, 1 frame at 400ms) and open (4 frames at 80ms,
 *   played once: the leaves swing back to the posts and hold open) when she uses it.
 * Props (none; y is the ground top they stand on, given for row 50; add -120 per seam row up)
 * - park-tree 96x150 (y 600): an irregular autumn crown, branching trunk and restrained peach leaf
 *   planes; its one-way-branch row is 6 rows up.
 * - park-bench 36x24 (y 600): the bench's legs and seat under its one-way-bench row, 2 rows up.
 * - park-bandstand 120x84 (y 600): posts, rail and base under its one-way-bandstand row, 6 rows up.
 * - park-lamp 16x84 (y 600).
 */

import { mkdirSync, writeFileSync } from "node:fs";

import { encodeRgbPng } from "@andornaut/art-kit/png";
import { opaque, resizeNearest } from "@andornaut/art-kit/raster";

import * as backgroundTones from "./backgroundTones.ts";
import { commands, run } from "./cli.ts";
import {
  backdropEntry,
  BACKDROPS_DIR,
  cropBox,
  ellipse,
  frameImage,
  image,
  over,
  readImage,
  rect,
  type RgbaImage,
  writeImage,
} from "./imageArt.ts";
import * as nature from "./nature.ts";
import * as pixel from "./pixel.ts";

const T = 12;
const COLUMNS = 8;
const TILESET = "tiles-park";
const USAGE = "Usage: park.ts build | preview OUT.png";
const PNG = { deflateLevel: 9, deflateStrategy: 0, filterType: -1 };

const GRASS = ["dgreen", "cream", "green"] as const; // edge, lip, body
const SOIL = ["brown", "dbrown", "plum"] as const; // fill, pebbles and roots, side edge
const PATH = ["dbrown", "cream", "tan", "brown"] as const; // edge, lip, body, gravel
const STONE = ["dbrown", "white", "skin2", "brown"] as const; // edge, lip, body, joint
const WATER = ["blue", "sky", "navy"] as const; // water, ripple, deep
const BENCH = ["plum", "cream", "dbrown"] as const;
// A white lip: the roof stands against the tan treetops.
const ROOF = ["plum", "white", "forest", "dgreen"] as const;
const HEDGE = ["ink", "forest", "cream"] as const;
const LEAF = ["rust", "ochre", "dbrown"] as const;

type Fill = readonly [x: number, y: number, w: number, h: number, c: string | null];

/** A rectangle in colour c, or cleared to transparent when c is null. */
function fill(im: RgbaImage, [x, y, w, h, c]: Fill): RgbaImage {
  rect(c, [x, y, x + w, y + h], im);
  return im;
}

function rects(im: RgbaImage, ...list: readonly Fill[]): RgbaImage {
  for (const item of list) {
    fill(im, item);
  }
  return im;
}

// ---------------------------------------------------------------- tiles

function grass(kind = ""): RgbaImage {
  const [edge, lip, body] = GRASS;
  const t = rects(
    image(T, T),
    [0, 0, T, T, SOIL[0]],
    [0, 0, T, 1, edge],
    [0, 1, T, 2, lip],
    [0, 3, T, 3, body],
    [2, 6, 3, 1, body],
    [8, 6, 2, 1, body],
  );
  // A soft rounded lip on an exposed end.
  if (kind.includes("l")) {
    rects(t, [0, 0, 2, 1, null], [0, 1, 1, 1, null], [1, 1, 1, 2, edge], [0, 3, 1, 9, edge]);
  }
  if (kind.includes("r")) {
    rects(
      t,
      [T - 2, 0, 2, 1, null],
      [T - 1, 1, 1, 1, null],
      [T - 2, 1, 1, 2, edge],
      [T - 1, 3, 1, 9, edge],
    );
  }
  return t;
}

function soil(kind = "", pebbles = false): RgbaImage {
  const [fillc, pebble, side] = SOIL;
  const t = rects(image(T, T), [0, 0, T, T, fillc]);
  if (pebbles) {
    rects(t, [2, 8, 2, 2, pebble], [8, 2, 2, 1, pebble]);
  }
  if (kind.includes("l")) {
    rects(t, [0, 0, 3, T, pebble], [0, 0, 1, T, side]);
  }
  if (kind.includes("r")) {
    rects(t, [T - 3, 0, 3, T, pebble], [T - 1, 0, 1, T, side]);
  }
  // A closed underside: the side band and edge along the bottom, the side edges redrawn over it.
  if (kind.includes("b")) {
    rects(t, [0, T - 3, T, 3, pebble], [0, T - 1, T, 1, side]);
    if (kind.includes("l")) {
      rects(t, [0, 0, 1, T, side]);
    }
    if (kind.includes("r")) {
      rects(t, [T - 1, 0, 1, T, side]);
    }
  }
  return t;
}

function turf(kind = ""): RgbaImage {
  const t = rects(
    soil(kind),
    [0, 0, T, 6, "green"],
    [0, 6, T, 1, "dgreen"],
    [2, 7, 2, 2, "dgreen"],
    [8, 7, 2, 3, "dgreen"],
  );
  if (kind.includes("l")) {
    rects(t, [0, 0, 3, T, SOIL[1]], [0, 0, 1, T, SOIL[2]]);
  }
  if (kind.includes("r")) {
    rects(t, [T - 3, 0, 3, T, SOIL[1]], [T - 1, 0, 1, T, SOIL[2]]);
  }
  return t;
}

function path(joint = false): RgbaImage {
  const [edge, lip, body, under] = PATH;
  const t = rects(
    image(T, T),
    [0, 0, T, T, SOIL[0]],
    [0, 0, T, 1, edge],
    [0, 1, T, 2, lip],
    [0, 3, T, 4, body],
    [0, 7, T, 1, under],
    [3, 4, 2, 1, under],
    [8, 5, 2, 1, under],
  );
  if (joint) {
    rects(t, [T - 1, 3, 1, 4, under]);
  }
  return t;
}

function stair(kind = ""): RgbaImage {
  const [edge, lip, body, joint] = STONE;
  const t = grass(kind);
  const x0 = kind.includes("l") ? 2 : 0;
  return rects(
    t,
    [x0, 0, T - x0, 1, edge],
    [x0, 1, T - x0, 2, lip],
    [x0, 3, T - x0, 3, body],
    [x0, 6, T - x0, 1, joint],
  );
}

function bench(kind: string): RgbaImage {
  const [edge, lip, wood] = BENCH;
  const t = rects(
    image(T, T),
    [0, 0, T, 1, edge],
    [0, 1, T, 2, lip],
    [0, 3, T, 3, wood],
    [0, 6, T, 1, edge],
  );
  if (kind === "l" || kind === "r") {
    rects(t, [kind === "l" ? 2 : T - 4, 7, 2, 5, edge]);
  }
  return t;
}

function branch(kind: string): RgbaImage {
  const [leaf, lit] = LEAF;
  const t = rects(
    image(T, T),
    [0, 2, T, 3, "brown"],
    [0, 2, T, 1, "tan"],
    [0, 5, T, 1, "dbrown"],
    [0, 0, T, 1, "dbrown"],
    [0, 1, T, 1, "cream"],
  );
  if (kind === "r") {
    rects(t, [T - 4, 0, 4, 6, null], [T - 6, 6, 6, 4, leaf], [T - 5, 6, 3, 1, lit]);
  }
  if (kind === "l") {
    rects(t, [0, 0, 2, 6, null]);
  }
  return t;
}

function roof(kind: string): RgbaImage {
  const [edge, lip, a, b] = ROOF;
  const t = rects(
    image(T, T),
    [0, 0, T, 1, edge],
    [0, 1, T, 2, lip],
    [0, 3, T, 5, a],
    [0, 3, 4, 5, b],
    [8, 3, 4, 5, b],
  );
  for (const x of [0, 6]) {
    rects(t, [x + 1, 8, 4, 1, a], [x + 2, 9, 2, 1, edge]);
  }
  if (kind === "l") {
    rects(t, [0, 0, 1, 9, edge]);
  }
  if (kind === "r") {
    rects(t, [T - 1, 0, 1, 9, edge]);
  }
  return t;
}

function pond(kind: string, bed: boolean): RgbaImage {
  const [w, hi, deep] = WATER;
  const t = image(T, T);
  if (!bed) {
    rects(t, [0, 4, T, 8, w], [0, 4, T, 1, hi], [2, 7, 4, 1, "white"], [8, 9, 3, 1, hi]);
    if (kind === "l") {
      rects(t, [0, 0, 3, T, SOIL[1]], [3, 6, 2, 6, SOIL[1]]);
    }
    if (kind === "r") {
      rects(t, [T - 3, 0, 3, T, SOIL[1]], [T - 5, 6, 2, 6, SOIL[1]]);
    }
  } else {
    rects(t, [0, 0, T, 8, deep], [0, 8, T, 4, SOIL[1]]);
    if (kind === "l") {
      rects(t, [0, 0, 5, T, SOIL[1]]);
    }
    if (kind === "r") {
      rects(t, [T - 5, 0, 5, T, SOIL[1]]);
    }
  }
  return t;
}

function thorn(kind: string): RgbaImage {
  const [dark, mid, th] = HEDGE;
  const t = rects(image(T, T), [0, 5, T, 7, dark], [1, 7, 4, 3, mid], [7, 8, 4, 3, mid]);
  for (const x of [1, 5, 9]) {
    rects(t, [x, 2, 2, 3, th], [x, 1, 1, 1, th], [x, 0, 1, 1, "dred"]);
  }
  if (kind === "l") {
    rects(t, [0, 5, 1, 2, null], [0, 3, 2, 2, th]);
  }
  if (kind === "r") {
    rects(t, [T - 1, 5, 1, 2, null], [T - 2, 3, 2, 2, th]);
  }
  return t;
}

const SIDES = ["-left", "", "-right"] as const;

// Hit boxes for the hazard tiles that hit less than their whole 12x12 cell, in pixels within the
// tile, written to tiles-park.json's "hitboxes": each thorn tile from 2px below its top, and the
// pond's first row from its water surface down. The pond's bed row hits its whole cell, so it has
// no entry.
const HITBOXES: Readonly<Record<string, pixel.Hitbox>> = Object.fromEntries([
  ...SIDES.map((s) => [`hazard-thorn${s}`, { x: 0, y: 2, width: 12, height: 10 }]),
  ...SIDES.map((s) => [`hazard-pond${s}`, { x: 0, y: 4, width: 12, height: 8 }]),
]);

type Tile = readonly [name: string, tile: RgbaImage];

function three(name: string, fn: (kind: string) => RgbaImage): Tile[] {
  return [
    [`${name}-left`, fn("l")],
    [name, fn("m")],
    [`${name}-right`, fn("r")],
  ];
}

function tiles(): Tile[] {
  return [
    ["grass-top", grass()],
    ["grass-top-left", grass("l")],
    ["grass-top-right", grass("r")],
    ["turf", turf()],
    ["turf-left", turf("l")],
    ["turf-right", turf("r")],
    ["soil", soil()],
    ["soil-pebbles", soil("", true)],
    ["soil-left", soil("l")],
    ["soil-right", soil("r")],
    ["path-top", path()],
    ["path-top-joint", path(true)],
    ["step-stair", stair()],
    ["step-stair-left", stair("l")],
    ...three("one-way-bench", bench),
    ...three("one-way-branch", branch),
    ...three("one-way-bandstand", roof),
    ...three("hazard-pond", (k) => pond(k, false)),
    ...three("hazard-pond-bed", (k) => pond(k, true)),
    ...three("hazard-thorn", thorn),
    ["grass-bottom-left", soil("bl")],
    ["grass-bottom", soil("b")],
    ["grass-bottom-right", soil("br")],
  ];
}

// ---------------------------------------------------------------- backdrops

function sky(): RgbaImage {
  return rects(image(48, 600), [0, 0, 48, 600, "skin1"], [0, 200, 48, 400, "tan"]);
}

function clouds(): RgbaImage {
  const im = image(360, 160);
  for (const [x, y, parts] of [
    [
      20,
      40,
      [
        [0, 10, 56, 26],
        [12, 2, 38, 26],
        [30, 6, 60, 26],
      ],
    ],
    [
      200,
      100,
      [
        [0, 8, 70, 26],
        [16, 0, 48, 26],
        [42, 4, 74, 26],
      ],
    ],
  ] as const) {
    for (const [a, b, c, e] of parts) {
      ellipse("cream", [x + a, y + b, x + c, y + e], im);
    }
    fill(im, [x, y + 20, 74, 6, "cream"]);
  }
  return im;
}

function treetops(): RgbaImage {
  const im = image(360, 420);
  (
    [
      [-16, 112, 112, 130],
      [68, 64, 126, 148],
      [180, 140, 108, 122],
      [262, 92, 116, 136],
    ] as const
  ).forEach(([x, top, width, height], i) =>
    nature.broadleaf(im, x, top, width, height, 420, "zone-peach-shade", "brown", 8, i * 3),
  );
  return im;
}

function city(): RgbaImage {
  const im = image(360, 200);
  for (const [x, w, top] of [
    [0, 40, 100],
    [40, 60, 60],
    [100, 36, 120],
    [136, 44, 0],
    [180, 60, 80],
    [240, 50, 40],
    [290, 40, 110],
    [330, 30, 70],
  ] as const) {
    fill(im, [x, top, w, 200 - top, "skin2"]);
  }
  // Water towers.
  for (const [tx, top] of [
    [10, 100],
    [190, 80],
  ] as const) {
    rects(
      im,
      [tx, top - 20, 14, 14, "skin2"],
      [tx + 2, top - 6, 2, 6, "skin2"],
      [tx + 10, top - 6, 2, 6, "skin2"],
    );
  }
  return im;
}

function farTrees(): RgbaImage {
  const im = rects(image(240, 120), [0, 94, 240, 26, "zone-peach-shade"]);
  (
    [
      [-32, 32, 80],
      [22, 20, 92],
      [88, 38, 82],
      [144, 24, 96],
      [208, 32, 80],
    ] as const
  ).forEach(([x, top, width], i) =>
    nature.broadleaf(im, x, top, width, 68, 120, "zone-peach", "zone-peach-shade", 4, i),
  );
  return im;
}

function tree(): RgbaImage {
  const im = image(96, 150);
  nature.broadleaf(im, 1, 0, 94, 78, 150, "brown", "zone-peach-shade", 10, 4);
  nature.leaves(im, "zone-peach-shade", [14, 4, 42, 36], 2);
  return im;
}

function benchLegs(): RgbaImage {
  const [edge, lip, wood] = BENCH;
  return rects(
    image(36, 24),
    [0, 12, 36, 4, wood],
    [0, 12, 36, 1, lip],
    [2, 16, 2, 8, edge],
    [32, 16, 2, 8, edge],
  );
}

function bandstand(): RgbaImage {
  const [edge] = ROOF;
  const im = rects(
    image(120, 84),
    [0, 72, 120, 12, STONE[2]],
    [0, 72, 120, 2, "cream"],
    [4, 54, 112, 3, edge],
  );
  for (const x of [6, 40, 76, 110]) {
    fill(im, [x, 6, 4, 66, edge]);
  }
  for (let x = 10; x < 110; x += 8) {
    fill(im, [x, 57, 2, 15, edge]);
  }
  return im;
}

function lamp(): RgbaImage {
  return rects(
    image(16, 84),
    [7, 10, 2, 74, "ink"],
    [2, 0, 12, 10, "ink"],
    [4, 2, 8, 6, "dslate"],
    [4, 80, 8, 4, "ink"],
  );
}

type BackdropDef = readonly [draw: () => RgbaImage, y: number, repeat: string];

export const BACKDROP_DEFS: ReadonlyMap<string, BackdropDef> = new Map<string, BackdropDef>([
  ["park-sky", [sky, 600, "x"]],
  ["park-clouds", [clouds, 200, "x"]],
  ["park-treetops", [treetops, 600, "x"]],
  ["park-city", [city, 540, "x"]],
  ["park-far-trees", [farTrees, 600, "x"]],
  ["park-tree", [tree, 600, "none"]],
  ["park-bench", [benchLegs, 600, "none"]],
  ["park-bandstand", [bandstand, 600, "none"]],
  ["park-lamp", [lamp, 600, "none"]],
]);

// ---------------------------------------------------------------- sprites

/** park-boat, 72x18: the deck line on row 0, the hull below; frame 1 drops the keel 1px. */
function boat(frame = 0): pixel.Frame {
  const g = new pixel.Grid(72, 18);
  g.rect(1, 0, 70, 1, "dbrown");
  g.rect(1, 1, 70, 2, "cream");
  g.rect(1, 3, 70, 2, "tan");
  g.rect(0, 1, 1, 5, "dbrown");
  g.rect(71, 1, 1, 5, "dbrown");
  g.rect(1, 5, 70, 1, "dbrown");
  const keel = 16 + frame;
  let last: readonly [x0: number, x1: number, y: number] | undefined;
  for (let y = 6; y < keel; y++) {
    // The hull rounds in towards the keel.
    const inset = 1 + Math.floor((y - 5) ** 2 / (frame ? 6 : 5));
    const x0 = inset;
    const x1 = 71 - inset;
    if (x1 <= x0) {
      break;
    }
    g.rect(x0, y, x1 - x0 + 1, 1, "rust");
    g.p(x0 - 1, y, "dbrown");
    g.p(x1 + 1, y, "dbrown");
    if (y === 6) {
      g.rect(x0, y, x1 - x0 + 1, 1, "ochre");
    } // lit along the top
    // Shade underneath, lower right.
    if (y >= keel - 3) {
      g.rect(x0 + Math.floor((x1 - x0) / 3), y, Math.floor(((x1 - x0) * 2) / 3) + 1, 1, "dbrown");
    }
    last = [x0, x1, y];
  }
  if (!last) {
    throw new Error("park-boat has no hull rows");
  }
  const [x0, x1, y] = last;
  g.rect(x0, y + 1, x1 - x0 + 1, 1, "dbrown");
  for (const x of [20, 50]) {
    g.rect(x, 3, 2, 2, "dbrown");
  } // the oarlocks' rowlocks, 2px, on the gunwale
  return g.px;
}

/** park-gate, 36x60: an iron arch over a pale opening, its leaves swung openK quarters back. */
function gate(openK = 0): pixel.Frame {
  const g = new pixel.Grid(36, 60);
  g.rect(5, 12, 26, 48, "skin1"); // the way on, pale
  g.rect(5, 50, 26, 10, "brown");
  g.ell(18, 16, 13, 12, "ink"); // the arch: a 2px iron band
  g.ell(18, 16, 11, 10, "skin1");
  g.rect(5, 16, 26, 44, "skin1");
  g.rect(5, 50, 26, 10, "brown");
  // Posts with a plum lit edge.
  for (const x of [0, 31]) {
    g.rect(x, 12, 5, 48, "ink");
    g.rect(x + 1, 12, 1, 48, "plum");
    g.rect(x, 8, 5, 4, "ink"); // finial base
    g.rect(x + 1, 4, 3, 4, "forest"); // a leaf finial
    g.rect(x + 2, 2, 1, 2, "forest");
  }
  // Leaves along the arch.
  for (const [x, y, c] of [
    [8, 8, "ochre"],
    [13, 5, "rust"],
    [21, 5, "ochre"],
    [26, 8, "rust"],
    [17, 3, "ochre"],
  ] as const) {
    g.rect(x, y, 3, 2, c);
    g.p(x + 1, y + 2, c);
  }
  const half = Math.floor((13 * (4 - openK)) / 4); // each leaf's visible width
  for (const side of [0, 1]) {
    const x0 = side === 0 ? 5 : 31 - half;
    if (half <= 1) {
      g.rect(side === 0 ? 5 : 29, 18, 2, 40, "ink"); // fully open: edge-on against the post
      continue;
    }
    g.rect(x0, 20, half, 2, "ink");
    g.rect(x0, 48, half, 2, "ink");
    for (let bx = x0; bx < x0 + half; bx += 4) {
      g.rect(bx, 18, 2, 40, "ink");
    }
    const cx = x0 + Math.floor(half / 2);
    g.rect(cx - 2, 32, 4, 2, "ink"); // a scroll with a leaf
    g.rect(cx - 1, 30, 2, 2, "forest");
  }
  return g.px;
}

// Tags that play once and hold their last frame; every other tag loops.
const ONCE = { "park-gate": ["open"] };

function* sprites(): Generator<pixel.SpriteEntry> {
  yield ["park-boat", [["idle", [boat(0), boat(1)], 400]]];
  yield [
    "park-gate",
    [
      ["idle", [gate(0)], 400],
      ["open", [1, 2, 3, 4].map((k) => gate(k)), 80],
    ],
  ];
}

// ---------------------------------------------------------------- build

function tilesetImage(items: readonly Tile[]): RgbaImage {
  const rows = Math.ceil(items.length / COLUMNS);
  const im = image(COLUMNS * T, rows * T);
  items.forEach(([, t], i) => over([(i % COLUMNS) * T, Math.floor(i / COLUMNS) * T], t, im));
  return im;
}

export async function build(): Promise<void> {
  mkdirSync(pixel.TILESETS, { recursive: true });
  mkdirSync(BACKDROPS_DIR, { recursive: true });
  const tileset = await pixel.writeTileset(
    { columns: COLUMNS, hitboxes: HITBOXES, key: TILESET, size: T },
    tiles(),
  );
  const backdrops = [...BACKDROP_DEFS].map(([key, [draw, y, repeat]]) => {
    const im = draw();
    writeImage(`${BACKDROPS_DIR}/${key}.png`, backgroundTones.apply(key, im));
    return backdropEntry({ bottom: y, repeat }, key, im);
  });
  pixel.updateManifest("tilesets", [tileset]);
  pixel.updateManifest("backdrops", backdrops);
  await pixel.build({ once: ONCE }, [...sprites()]);
  console.log("built", TILESET, "and", backdrops.length, "backdrops");
}

// ---------------------------------------------------------------- preview: two example chunks

// Chunk 1 (cols 0-59): grass at row 50 with a path, a bench, a tree with its branch, then five
// 2-row steps up to row 40 at the seam. Chunk 2 (cols 60-119): row 40 with a pond,
// five 2-row steps up to a terrace at row 30 with the bandstand, a drop back to row 40 and a thorn
// hedge before the right edge.
const STEPS: readonly (readonly [col: number, row: number])[] = [
  ...[0, 1, 2, 3, 4].map((i) => [30 + 2 * i, 48 - 2 * i] as const),
  ...[0, 1, 2, 3, 4].map((i) => [94 + 2 * i, 38 - 2 * i] as const),
];
const POND = [76, 85] as const;
const LEDGES = [
  ["bench", 48, 10, 3],
  ["branch", 44, 16, 6],
  ["bandstand", 24, 104, 8],
] as const;
const THORNS = [112, 3, 39] as const;
const BOAT = [78, 40] as const; // col, the pond row its deck sits on
const GATE = [116, 40] as const; // col, the ground row it stands on

type Top = readonly [row: number, kind: string];

function range(start: number, stop: number): number[] {
  return Array.from({ length: Math.max(0, stop - start) }, (_, i) => start + i);
}

function tops(): Map<number, Top> {
  const m = new Map<number, Top>();
  for (const c of range(0, 30)) {
    m.set(c, [50, c >= 8 && c <= 21 ? "path" : "grass"]);
  }
  STEPS.forEach(([c, r], i) => {
    for (const cc of [c, c + 1]) {
      m.set(cc, [r, i % 2 ? "stair" : "grass"]);
    }
  });
  for (const c of [...range(40, 76), ...range(86, 94), ...range(112, 120)]) {
    m.set(c, [40, "grass"]);
  }
  for (const c of range(104, 112)) {
    m.set(c, [30, "grass"]);
  }
  return m;
}

function example(chars = true): RgbaImage {
  const t = new Map(tiles());
  const tile = (name: string) => t.get(name) as RgbaImage;
  const im = image(1440, 720, "ink");
  const art = new Map([...BACKDROP_DEFS].map(([k, [fn]]) => [k, fn()]));
  const put = (key: string, x: number, groundRow = 50, extra = 0) => {
    const p = art.get(key) as RgbaImage;
    const y = (BACKDROP_DEFS.get(key) as BackdropDef)[1] - 600 + groundRow * T + extra;
    over([x, y - p.height], p, im);
  };
  for (const key of ["park-sky", "park-clouds", "park-treetops", "park-city", "park-far-trees"]) {
    for (let x = 0; x < 1440; x += (art.get(key) as RgbaImage).width) {
      put(key, x);
    }
  }
  put("park-tree", 16 * T - 6);
  put("park-lamp", 4 * T);
  put("park-lamp", 88 * T, 40);
  put("park-bench", 10 * T);
  put("park-bandstand", 104 * T - 12, 30);
  const m = tops();
  const exposed = (c: number, row: number) =>
    (!m.has(c - 1) || (m.get(c - 1) as Top)[0] > row ? "l" : "") +
    (!m.has(c + 1) || (m.get(c + 1) as Top)[0] > row ? "r" : "");
  for (const [c, [top, kind]] of m) {
    const k = exposed(c, top);
    const name =
      kind === "path"
        ? c % 2
          ? "path-top-joint"
          : "path-top"
        : kind === "stair"
          ? k.includes("l")
            ? "step-stair-left"
            : "step-stair"
          : undefined;
    over([c * T, top * T], name ? tile(name) : grass(k), im);
    for (let r = top + 1; r < 60; r++) {
      const lk = exposed(c, r);
      const fillTile = r === top + 1 ? turf(lk) : soil(lk, (c * 7 + r * 3) % 5 === 0);
      over([c * T, r * T], fillTile, im);
    }
  }
  for (let c = POND[0]; c <= POND[1]; c++) {
    const side = c === POND[0] ? "-left" : c === POND[1] ? "-right" : "";
    over([c * T, 40 * T], tile(`hazard-pond${side}`), im);
    over([c * T, 41 * T], tile(`hazard-pond-bed${side}`), im);
    for (let r = 42; r < 60; r++) {
      over([c * T, r * T], soil("", (c * 7 + r * 3) % 5 === 0), im);
    }
  }
  for (const [name, row, c0, w] of LEDGES) {
    for (let c = c0; c < c0 + w; c++) {
      const side = c === c0 ? "-left" : c === c0 + w - 1 ? "-right" : "";
      over([c * T, row * T], tile(`one-way-${name}${side}`), im);
    }
  }
  const [t0, tw, trow] = THORNS;
  for (let c = t0; c < t0 + tw; c++) {
    const side = c === t0 ? "-left" : c === t0 + tw - 1 ? "-right" : "";
    over([c * T, trow * T], tile(`hazard-thorn${side}`), im);
  }
  const [bx, brow] = BOAT;
  over([bx * T, brow * T], frameImage(boat(0)), im);
  const [gx, grow] = GATE;
  over([gx * T, grow * T - 60], frameImage(gate(0)), im);
  if (chars) {
    const bird = cropBox([0, 0, 48, 42], readImage(`${pixel.SPRITES}/bird.png`));
    over([14 * T - 24, 50 * T - 42], bird, im);
  }
  return opaque(im);
}

/** The worst lip against what is directly behind each walkable top (WCAG), and where it is. */
function walkableCheck(im: RgbaImage): readonly [ratio: number, at: string] {
  let worst: readonly [number, string] = [99.0, "None"];
  const spots: (readonly [x: number, row: number])[] = [...tops()].map(([c, [top]]) => [
    c * T + 6,
    top,
  ]);
  for (const [, row, c0, w] of LEDGES) {
    for (let c = c0; c < c0 + w; c++) {
      spots.push([c * T + 6, row]);
    }
  }
  const hex = (x: number, y: number) =>
    [...im.data.subarray((y * im.width + x) * 4, (y * im.width + x) * 4 + 3)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
  for (const [x, row] of spots) {
    const r = pixel.contrast(hex(x, row * T + 1), hex(x, row * T - 1));
    if (r < worst[0]) {
      worst = [r, `(${Math.floor(x / T)}, ${row})`];
    }
  }
  return worst;
}

function preview(out: string): void {
  const ex = example();
  const [ratio, at] = walkableCheck(example(false));
  console.log(`worst walkable lip against its backdrop: ${ratio.toFixed(2)}:1 at col, row ${at}`);
  const tileset = tilesetImage(tiles());
  const bg = image(tileset.width, tileset.height, "dslate");
  over([0, 0], tileset, bg);
  const ts = resizeNearest(tileset.width * 4, tileset.height * 4, opaque(bg));
  const sheet = image(ex.width, ex.height + 16 + ts.height, "ink");
  over([0, 0], ex, sheet);
  over([0, ex.height + 16], ts, sheet);
  writeFileSync(out, encodeRgbPng(PNG, opaque(sheet)));
}

if (import.meta.main) {
  run(() => commands({ usage: USAGE, build, preview }));
}
