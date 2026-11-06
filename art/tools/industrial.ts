/**
 * Reusable industrial appearance pack, independent of layouts, collision and zone assignment.
 *
 * Usage: node art/tools/industrial.ts build | preview OUT.png, from the repository root. Outputs
 * are plain PNG backdrops and a tileset, not animations.
 *
 * The primary and shade come from the industrial destination in zoneThemes.ts. Existing house
 * colours supply steel outlines, muted wood and safe white lips. No palette values or existing art
 * are changed.
 *
 * Tiles: tiles-industrial, 12px, eight columns, 40 cells in a 96x60 PNG. Each material has ten
 * keys: top, top-left, top-right, top-joint, face, face-left and face-right, then, after all four
 * families, bottom-left, bottom and bottom-right: the face closed by a 2px dslate band along its
 * bottom, as the side tiles close their open side. Families, in export order:
 * - industrial-floor: concrete; warehouse ground look.
 * - crate-stack: muted wooden packing cases; warehouse raised look.
 * - terminal-floor: steel/concrete apron; freight ground look.
 * - container-stack: corrugated lavender steel; freight raised look.
 * The suffixes are the same rendering semantics for every family. These are skins, not new
 * archetypes. Top tiles alone carry the dark edge and white walkable lip. Shared one-way ledges,
 * red hazard strips and movers keep tiles-platforming; this pack does not duplicate their artwork
 * or behaviour.
 *
 * Backdrops, bottom-left anchored at default y 600:
 * - industrial-sky: 48x600, repeat x; flat smoky lavender, suggested scroll factor 0,0.
 * - industrial-far: 720x600, repeat x; distant window-free factories and tanks, factor 0.15,0.05.
 * - warehouse-mid: 720x600, repeat x; low sawtooth warehouses, factor 0.4,0.15.
 * - freight-mid: 720x600, repeat x; distant container stacks and service cranes, factor 0.4,0.15.
 * - warehouse-wall: 48x240, repeat x; broad panels and quiet transom windows, factor 1,1.
 * - warehouse-loading-bay: 120x144, no repeat; closed roller door, factor 1,1.
 * - freight-gantry: 144x192, no repeat; posts and an overhead service beam, factor 1,1.
 * - freight-gantry-rail: 48x24, repeat x; a lattice girder (the freight-gantry beam's dslate frame,
 *   zone-purple web and slate lattice) with a lit slate trolley rail hung on brackets 2px below it,
 *   factor 1,1. Place its bottom on the crane tether's top row; no lip or collision.
 * Near pieces align to the local floor. They have no collision or white safe lips; place their beam
 * and post silhouettes clear of the route. Existing street-door art supplies room entrances
 * independently.
 *
 * Sprites, for the gantry crane ride (once: none):
 * - freight-crane-container: 72x36, bottom-centre on a 6x3 footprint, tag idle (1 frame). Rows 0 to
 *   2 are the standable lid: a navy edge over a 2px white lip, nothing above row 0. Below, a dslate
 *   top rail, a zone-purple-shade corrugated body with 2px zone-purple ridges every 6px, dslate
 *   corner posts in the outer 6px carrying the two slate lifting lugs (and two lower castings), a
 *   dslate bottom rail and an ink outline on the sides and bottom.
 * - freight-crane-cable: 8x8, centred on the tether line. cable (1 frame): a 4px steel rope, ink
 *   sides over slate and dslate strands that swap every 4 rows, so it repeats end to end. hook
 *   (1 frame): the rope's last 2 rows into a slate hook block on two ink feet, its bottom row
 *   resting on the lid's centre.
 * No red, amber or round pickup shapes.
 *
 * The preview compares Warehouse and Freight terminal on identical illustrative geometry at
 * 720x360, with the native tileset exported separately. This is not a validated stage or
 * reachability claim.
 */

import { opaque } from "@andornaut/art-kit/raster";

import * as backgroundTones from "./backgroundTones.ts";
import { commands, run } from "./cli.ts";
import {
  backdropEntry,
  BACKDROPS_DIR,
  cropBox,
  ellipse,
  image,
  over,
  polygon,
  readImage,
  rect,
  type RgbaImage,
  skinForeground,
  writeImage,
  writeRgbImage,
} from "./imageArt.ts";
import * as pixel from "./pixel.ts";
import { drawLabel } from "./previewText.ts";
import { THEMES } from "./zoneThemes.ts";

const T = 12;
const TILESET = "tiles-industrial";
const BOTTOM = 600;
const PRIMARY = (THEMES.industrial as { primary: string }).primary;
const SHADE = `${PRIMARY}-shade`;
const FAMILIES = ["industrial-floor", "crate-stack", "terminal-floor", "container-stack"] as const;
const SUFFIXES = ["top", "top-left", "top-right", "top-joint", "face", "face-left", "face-right"];
// Appended after every family's SUFFIXES, so the earlier indices hold.
const BOTTOM_SUFFIXES = ["bottom-left", "bottom", "bottom-right"];
const USAGE = "Usage: industrial.ts build | preview OUT.png";

type Family = (typeof FAMILIES)[number];

function material(family: Family, suffix: string): RgbaImage {
  const fill = {
    "industrial-floor": SHADE,
    "crate-stack": "zone-peach-shade",
    "terminal-floor": "slate",
    "container-stack": PRIMARY,
  }[family];
  const im = image(T, T, fill);
  if (family === "crate-stack") {
    rect("zone-red-shade", [0, 0, 2, 12], im);
    rect("zone-red-shade", [0, 0, 12, 2], im);
  } else if (family === "container-stack") {
    rect(SHADE, [0, 0, 2, 12], im);
  }
  if (suffix.endsWith("left")) {
    rect("dslate", [0, 0, 2, T], im);
  }
  if (suffix.endsWith("right")) {
    rect("dslate", [10, 0, 12, T], im);
  }
  if (suffix.startsWith("bottom")) {
    rect("dslate", [0, 10, 12, 12], im);
  }
  if (suffix.startsWith("top")) {
    const top = {
      "industrial-floor": PRIMARY,
      "crate-stack": "zone-peach",
      "terminal-floor": "grey",
      "container-stack": SHADE,
    }[family];
    rect("navy", [0, 0, T, 1], im);
    rect("white", [0, 1, T, 3], im);
    rect(top, [0, 3, T, 5], im);
    if (suffix === "top-joint") {
      rect("dslate", [10, 3, 12, 7], im);
    }
  }
  return im;
}

export function tiles(): [string, RgbaImage][] {
  return [SUFFIXES, BOTTOM_SUFFIXES].flatMap((suffixes) =>
    FAMILIES.flatMap((family) =>
      suffixes.map((suffix): [string, RgbaImage] => [
        `${family}-${suffix}`,
        material(family, suffix),
      ]),
    ),
  );
}

function sky(): RgbaImage {
  return image(48, 600, PRIMARY);
}

function far(): RgbaImage {
  const im = image(720, 600);
  // Broad factory halls, a few attached stacks and tanks, without window grids or contour bands.
  for (const [x, width, top] of [
    [12, 144, 366],
    [196, 126, 332],
    [370, 156, 384],
    [568, 136, 350],
  ] as const) {
    rect(SHADE, [x, top, x + width, 600], im);
    rect(SHADE, [x + 16, top - 14, x + width - 16, top], im);
  }
  for (const [x, top] of [
    [62, 270],
    [238, 248],
    [620, 282],
  ] as const) {
    rect(SHADE, [x, top, x + 14, 430], im);
    rect(SHADE, [x - 2, top, x + 16, top + 6], im);
  }
  for (const [x, top] of [
    [144, 398],
    [510, 410],
  ] as const) {
    ellipse(SHADE, [x, top, x + 42, top + 22], im);
    rect(SHADE, [x, top + 11, x + 43, 600], im);
  }
  return im;
}

function warehouseMid(): RgbaImage {
  const im = image(720, 600);
  for (const [x, width, top] of [
    [12, 192, 456],
    [258, 144, 426],
    [468, 228, 466],
  ] as const) {
    rect("slate", [x, top, x + width, 600], im);
    for (let start = x; start < x + width; start += 48) {
      polygon(
        { colour: "slate" },
        [
          [start, top],
          [start + 38, top - 20],
          [start + 48, top],
        ],
        im,
      );
    }
    rect(SHADE, [x + 12, top + 26, x + width - 12, top + 38], im);
    rect("zone-purple-shade", [x + width - 24, top + 38, x + width - 12, 600], im);
  }
  return im;
}

function freightMid(): RgbaImage {
  const im = image(720, 600);
  for (const [x, width, top] of [
    [18, 168, 510],
    [238, 144, 474],
    [446, 240, 522],
  ] as const) {
    rect("slate", [x, top, x + width, 600], im);
    rect(SHADE, [x, top, x + width, top + 4], im);
    for (let y = top + 42; y < 600; y += 42) {
      rect(SHADE, [x, y, x + width, y + 2], im);
    }
  }
  for (const [x, top] of [
    [118, 388],
    [478, 362],
  ] as const) {
    rect("slate", [x, top, x + 10, 600], im);
    rect("slate", [x + 120, top, x + 130, 600], im);
    rect("slate", [x - 8, top, x + 142, top + 14], im);
    polygon(
      { colour: "slate" },
      [
        [x + 10, top],
        [x + 64, top - 32],
        [x + 120, top],
      ],
      im,
    );
    rect("slate", [x + 68, top + 14, x + 70, top + 64], im);
  }
  return im;
}

function warehouseWall(): RgbaImage {
  const im = image(48, 240, SHADE);
  rect("slate", [0, 0, 48, 8], im);
  rect("dslate", [0, 8, 3, 240], im);
  rect(PRIMARY, [3, 8, 5, 232], im);
  rect("slate", [43, 8, 48, 240], im);
  rect("dslate", [8, 28, 40, 60], im);
  rect(PRIMARY, [10, 30, 38, 58], im);
  rect("slate", [23, 30, 25, 58], im);
  rect("slate", [10, 44, 38, 46], im);
  rect("slate", [5, 146, 43, 150], im);
  rect("dslate", [0, 230, 48, 240], im);
  return im;
}

function loadingBay(): RgbaImage {
  const im = image(120, 144, SHADE);
  rect("slate", [2, 4, 118, 144], im);
  rect("dslate", [8, 16, 112, 144], im);
  rect("slate", [12, 20, 108, 144], im);
  for (let y = 24; y < 140; y += 12) {
    rect("dslate", [12, y, 108, y + 2], im);
    rect(SHADE, [12, y + 2, 108, y + 4], im);
  }
  rect("dslate", [12, 136, 108, 144], im);
  rect("grey", [54, 126, 66, 130], im);
  rect(PRIMARY, [2, 4, 6, 140], im);
  rect("dslate", [114, 4, 118, 144], im);
  return im;
}

function gantry(): RgbaImage {
  const im = image(144, 192);
  rect("dslate", [6, 14, 18, 192], im);
  rect(SHADE, [9, 20, 15, 186], im);
  rect("dslate", [126, 14, 138, 192], im);
  rect(SHADE, [129, 20, 135, 186], im);
  rect("dslate", [0, 8, 144, 28], im);
  rect(PRIMARY, [4, 12, 140, 24], im);
  for (let x = 14; x < 132; x += 24) {
    polygon(
      { colour: "slate" },
      [
        [x, 12],
        [x + 10, 24],
        [x + 16, 24],
        [x + 6, 12],
      ],
      im,
    );
  }
  rect("dslate", [0, 184, 24, 192], im);
  rect("dslate", [120, 184, 144, 192], im);
  rect("slate", [60, 28, 84, 42], im);
  rect("dslate", [71, 42, 73, 78], im);
  rect("dslate", [66, 76, 78, 80], im);
  return im;
}

function gantryRail(): RgbaImage {
  const im = image(48, 24);
  rect("dslate", [0, 0, 48, 19], im);
  rect(PRIMARY, [0, 4, 48, 15], im);
  for (const x of [2, 26]) {
    polygon(
      { colour: "slate" },
      [
        [x, 4],
        [x + 10, 14],
        [x + 16, 14],
        [x + 6, 4],
      ],
      im,
    );
  }
  // The trolley rail hangs 2px below the girder on brackets every 24px.
  for (const x of [10, 34]) {
    rect("dslate", [x, 19, x + 4, 21], im);
  }
  rect(PRIMARY, [0, 21, 48, 22], im);
  rect("slate", [0, 22, 48, 24], im);
  return im;
}

const CONTAINER = "freight-crane-container";
const CABLE = "freight-crane-cable";

function container(): pixel.Frame {
  const g = new pixel.Grid(72, 36);
  g.rect(0, 3, 72, 33, "ink");
  g.rect(1, 3, 70, 32, "zone-purple-shade");
  for (let x = 8; x < 64; x += 6) {
    g.rect(x, 5, 2, 27, "zone-purple");
  }
  g.rect(1, 3, 70, 2, "dslate");
  g.rect(1, 32, 70, 3, "dslate");
  for (const x of [1, 66]) {
    g.rect(x, 3, 5, 32, "dslate");
    for (const y of [5, 27]) {
      g.rect(x, y, 5, 5, "slate");
      g.rect(x + 2, y + 1, 2, 3, "ink");
    }
  }
  g.rect(0, 0, 72, 1, "navy");
  g.rect(0, 1, 72, 2, "white");
  return g.px;
}

/** Rows y to y + n of the rope: ink sides, slate and dslate strands swapping every 4 rows. */
function rope(g: pixel.Grid, y: number, n: number): void {
  for (let j = y; j < y + n; j++) {
    const twist = Math.floor(j / 4) % 2 === 0;
    g.p(2, j, "ink");
    g.p(3, j, twist ? "slate" : "dslate");
    g.p(4, j, twist ? "dslate" : "slate");
    g.p(5, j, "ink");
  }
}

function cable(): pixel.Frame {
  const g = new pixel.Grid(8, 8);
  rope(g, 0, 8);
  return g.px;
}

function hook(): pixel.Frame {
  const g = new pixel.Grid(8, 8);
  rope(g, 0, 2);
  g.rect(1, 2, 6, 4, "ink");
  g.rect(2, 3, 4, 1, "slate");
  g.rect(2, 4, 4, 1, "dslate");
  g.rect(1, 6, 2, 1, "ink");
  g.rect(5, 6, 2, 1, "ink");
  g.rect(0, 7, 3, 1, "ink");
  g.rect(5, 7, 3, 1, "ink");
  return g.px;
}

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield [CONTAINER, [["idle", [container()], 1000]]];
  yield [
    CABLE,
    [
      ["cable", [cable()], 1000],
      ["hook", [hook()], 1000],
    ],
  ];
}

const ONCE = { [CONTAINER]: [], [CABLE]: [] };

export const BACKDROPS: Readonly<Record<string, readonly [draw: () => RgbaImage, repeat: string]>> =
  {
    "freight-gantry": [gantry, "none"],
    "freight-gantry-rail": [gantryRail, "x"],
    "freight-mid": [freightMid, "x"],
    "industrial-far": [far, "x"],
    "industrial-sky": [sky, "x"],
    "warehouse-loading-bay": [loadingBay, "none"],
    "warehouse-mid": [warehouseMid, "x"],
    "warehouse-wall": [warehouseWall, "x"],
  };

export async function build(): Promise<void> {
  const entry = await pixel.writeTileset({ key: TILESET }, tiles());
  pixel.updateManifest("tilesets", [entry]);
  const entries = Object.entries(BACKDROPS).map(([key, [draw, repeat]]) => {
    const im = draw();
    writeImage(`${BACKDROPS_DIR}/${key}.png`, backgroundTones.apply(key, im));
    return backdropEntry({ bottom: BOTTOM, repeat }, key, im);
  });
  pixel.updateManifest("backdrops", entries);
  await pixel.build({ once: ONCE }, [...sprites()]);
  console.log("built", TILESET, "and", entries.length, "backdrops");
}

/** Identical geometry with different skins; no simulation or stage-design assertion. */
function context(skin: "warehouse" | "freight"): RgbaImage {
  const im = image(720, 720, PRIMARY);
  for (const key of [
    "industrial-sky",
    "industrial-far",
    skin === "warehouse" ? "warehouse-mid" : "freight-mid",
  ]) {
    const p = readImage(`${BACKDROPS_DIR}/${key}.png`);
    for (let x = 0; x < 720; x += p.width) {
      over([x, BOTTOM - p.height], p, im);
    }
  }
  let ground: string;
  let raised: string;
  if (skin === "warehouse") {
    const wall = readImage(`${BACKDROPS_DIR}/warehouse-wall.png`);
    for (let x = 0; x < 240; x += 48) {
      over([x, BOTTOM - wall.height], wall, im);
    }
    over([0, 456], readImage(`${BACKDROPS_DIR}/warehouse-loading-bay.png`), im);
    [ground, raised] = ["industrial-floor", "crate-stack"];
  } else {
    over([432, 408], readImage(`${BACKDROPS_DIR}/freight-gantry.png`), im);
    [ground, raised] = ["terminal-floor", "container-stack"];
  }
  skinForeground({ tiles: new Map(tiles()), ground, raised }, im);
  return cropBox([0, 360, 720, 720], opaque(im));
}

async function preview(out: string): Promise<void> {
  const sheet = image(1456, 392, "ink");
  (
    [
      ["warehouse", "Warehouse / concrete + muted wooden crates"],
      ["freight", "Freight terminal / apron + corrugated containers"],
    ] as const
  ).forEach(([skin, label], i) => {
    const x = 8 + i * 728;
    drawLabel({ x, y: 6, colour: "cream" }, label, sheet);
    over([x, 24], context(skin), sheet);
  });
  writeRgbImage(out, sheet);
}

if (import.meta.main) {
  run(() => commands({ usage: USAGE, build, preview }));
}
