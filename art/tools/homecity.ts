/**
 * Reusable peach home-city environment skins, independent of layouts and gameplay geometry.
 *
 * Usage: node art/tools/homecity.ts build | preview OUT.png, from the repository root. Plain PNG
 * exports. Canonical home-city zone-peach and its shade dominate; house colours add quiet roofs,
 * windows and foliage. No new palette, animals, doors, story text or mechanics. Near scenery has no
 * collision or safe white lip.
 *
 * tiles-homecity: 12px tiles, eight columns, 52 cells, 96x84. Families outskirts-ground,
 * brick-stack, neighbourhood-ground and stoop-stack use top/top-left/top-right/top-joint/face/
 * face-left/face-right, then, after all four, bottom-left/bottom/bottom-right: the face closed by
 * a 2px dslate band along its bottom, as the side tiles close their open side; then slab-left/slab/
 * slab-right: a one-row block, the top's edge and lip over the bottom's closing band. Only terrain
 * tops carry the navy edge and two white safe rows. Shared ledges, movers and red hazards retain
 * tiles-platforming. All material families use the existing generic terrain-renderer geometry.
 *
 * Backdrops, bottom-left anchored at default world y 600:
 * - homecity-sky: 48x600, repeat x, factor 0,0.
 * - homecity-far: 720x600, repeat x, factor 0.15,0.05; broad low-rise silhouettes without window
 *   grids.
 * - outskirts-mid: 720x600, repeat x, factor 0.4,0.15; spaced residential roofs and quiet wall
 *   planes.
 * - neighbourhood-mid: 720x600, repeat x, factor 0.4,0.15; familiar terraced homes and subdued
 *   garden crowns.
 * - outskirts-wall: 48x144, repeat x, factor 1,1; low brick boundary wall aligned with the local
 *   floor.
 * - neighbourhood-wall: 48x180, repeat x, factor 1,1; quiet residential facade, never a dense
 *   shopfront.
 * - homecity-awning: 96x36, no repeat, factor 1,1; plain muted fabric without stripes or text.
 *
 * Sprite homecity-awning-ledge, 96x36, bottom-centre on an 8x3 footprint with the wall on the left:
 * a retracting awning striped in cream and zone-red-shade with a dbrown hem and outline, on a slate
 * wall plate with a dslate folding arm. Its standable top is row 0: a navy edge over a 2px white lip
 * across the full width, drawn only in out and warning; retracted and extending have no lip or
 * navy edge. No hazard red. Tags (once: extending):
 * - out: 1 frame, fully extended, a scalloped hem under the stripes.
 * - warning: 3 x 100ms, looping: about a quarter rolled up, the hem wound into a tube that shudders
 *   1px; rows 0 to 3 stay identical to out, so the standable edge never moves.
 * - retracted: 1 frame, a rolled tube at the wall and the arm folded down the wall.
 * - extending: 3 x 130ms, once: the canvas unrolling from the wall to 30, 54 and 78px, its top a
 *   dbrown edge.
 *
 * Physical ledges and room doors are placed separately by gameplay. The comparison preview uses
 * identical illustrative geometry, not a validated stage or reachability claim. A theme changes
 * appearance only.
 */

import { opaque } from "@andornaut/art-kit/raster";

import * as backgroundTones from "./backgroundTones.ts";
import { commands, run } from "./cli.ts";
import {
  backdropEntry,
  BACKDROPS_DIR,
  cropBox,
  image,
  over,
  polygon,
  readImage,
  rect,
  type RgbaImage,
  terrainBlock,
  writeImage,
  writeRgbImage,
} from "./imageArt.ts";
import * as nature from "./nature.ts";
import * as pixel from "./pixel.ts";
import { drawLabel } from "./previewText.ts";
import { THEMES } from "./zoneThemes.ts";

const T = 12;
const TILESET = "tiles-homecity";
const PRIMARY = (THEMES["home-city"] as { primary: string }).primary;
const SHADE = `${PRIMARY}-shade`;
const BOTTOM = 600;
const FAMILIES = [
  "outskirts-ground",
  "brick-stack",
  "neighbourhood-ground",
  "stoop-stack",
] as const;
const SUFFIXES = ["top", "top-left", "top-right", "top-joint", "face", "face-left", "face-right"];
// Appended after every family's SUFFIXES, bottoms then slabs, so the earlier indices hold.
const BOTTOM_SUFFIXES = ["bottom-left", "bottom", "bottom-right"];
const SLAB_SUFFIXES = ["slab-left", "slab", "slab-right"];
const USAGE = "Usage: homecity.ts build | preview OUT.png";

type Family = (typeof FAMILIES)[number];

function material(family: Family, suffix: string): RgbaImage {
  const im = image(T, T, SHADE);
  if (family === "brick-stack") {
    rect(PRIMARY, [0, 0, 12, 2], im);
    rect("zone-red-shade", [0, 9, 12, 11], im);
    rect("zone-red-shade", [5, 2, 7, 9], im);
  } else if (family === "stoop-stack") {
    rect(PRIMARY, [0, 0, 12, 3], im);
    rect("zone-red-shade", [0, 10, 12, 12], im);
  } else if (family === "neighbourhood-ground") {
    rect(PRIMARY, [0, 0, 12, 2], im);
    rect("zone-red-shade", [0, 10, 12, 12], im);
  }
  if (suffix.endsWith("left")) {
    rect("dslate", [0, 0, 2, 12], im);
  }
  if (suffix.endsWith("right")) {
    rect("dslate", [10, 0, 12, 12], im);
  }
  if (suffix.startsWith("bottom") || suffix.startsWith("slab")) {
    rect("dslate", [0, 10, 12, 12], im);
  }
  if (suffix.startsWith("top") || suffix.startsWith("slab")) {
    rect("navy", [0, 0, 12, 1], im);
    rect("white", [0, 1, 12, 3], im);
    rect(PRIMARY, [0, 3, 12, 5], im);
    if (suffix === "top-joint") {
      rect("dslate", [10, 3, 12, 7], im);
    }
  }
  return im;
}

export function tiles(): [string, RgbaImage][] {
  return [SUFFIXES, BOTTOM_SUFFIXES, SLAB_SUFFIXES].flatMap((suffixes) =>
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
  for (const [x, width, top] of [
    [-20, 110, 420],
    [126, 102, 398],
    [262, 136, 438],
    [434, 96, 384],
    [572, 166, 416],
  ] as const) {
    rect(SHADE, [x, top + 18, x + width, 600], im);
    polygon(
      { colour: SHADE },
      [
        [x - 4, top + 20],
        [x + Math.floor(width / 2), top],
        [x + width + 4, top + 20],
      ],
      im,
    );
    rect(SHADE, [x + width - 24, top + 4, x + width - 16, top + 20], im);
  }
  return im;
}

/** Warm complete plaster planes, a quiet rose roof and sparse attached window recesses. */
function house(
  {
    height,
    top,
    width,
    windows = true,
    x,
  }: { x: number; top: number; width: number; height: number; windows?: boolean },
  im: RgbaImage,
): void {
  rect(PRIMARY, [x, top + 18, x + width, top + height], im);
  rect("zone-yellow", [x, top + 18, x + 8, top + height], im);
  polygon(
    { colour: "zone-red-shade" },
    [
      [x - 4, top + 20],
      [x + Math.floor(width / 2), top],
      [x + width + 4, top + 20],
    ],
    im,
  );
  rect("zone-red-shade", [x + width - 20, top + 2, x + width - 12, top + 16], im);
  if (windows) {
    for (const offset of [16, width - 28]) {
      rect(SHADE, [x + offset, top + 44, x + offset + 12, top + 64], im);
    }
  }
}

function outskirtsMid(): RgbaImage {
  const im = image(720, 600);
  for (const [x, top, width] of [
    [-24, 426, 96],
    [126, 402, 108],
    [300, 430, 96],
    [462, 402, 108],
    [648, 426, 96],
  ] as const) {
    house({ x, top, width, height: 600 - top }, im);
  }
  return im;
}

function neighbourhoodMid(): RgbaImage {
  const im = image(720, 600);
  for (const [x, top, width] of [
    [-12, 408, 84],
    [108, 390, 96],
    [240, 414, 84],
    [360, 390, 96],
    [492, 408, 84],
    [624, 414, 108],
  ] as const) {
    house({ x, top, width, height: 600 - top }, im);
  }
  // Natural branching garden trees remain entirely decorative behind play.
  for (const [x, top, width] of [
    [82, 510, 46],
    [336, 498, 54],
    [592, 514, 48],
  ] as const) {
    nature.broadleaf(
      im,
      x - Math.floor(width / 2),
      top,
      width,
      64,
      600,
      "zone-green-shade",
      SHADE,
      4,
      x % 11,
    );
  }
  return im;
}

function outskirtsWall(): RgbaImage {
  const im = image(48, 144, PRIMARY);
  rect(PRIMARY, [0, 0, 48, 6], im);
  rect("zone-red-shade", [0, 6, 48, 9], im);
  for (let y = 24; y < 144; y += 24) {
    rect("zone-red-shade", [0, y, 48, y + 2], im);
    const x = Math.floor(y / 24) % 2 ? 12 : 36;
    rect("zone-red-shade", [x, y - 18, x + 2, y], im);
  }
  rect("zone-red-shade", [0, 138, 48, 144], im);
  return im;
}

function neighbourhoodWall(): RgbaImage {
  const im = image(48, 180, PRIMARY);
  rect(PRIMARY, [0, 0, 48, 9], im);
  rect("zone-red-shade", [0, 9, 48, 12], im);
  rect("zone-red-shade", [10, 30, 38, 78], im);
  rect("dslate", [13, 33, 35, 74], im);
  rect("zone-red-shade", [23, 33, 25, 74], im);
  rect("zone-red-shade", [13, 52, 35, 54], im);
  rect(PRIMARY, [8, 78, 40, 84], im);
  rect("zone-red-shade", [0, 168, 48, 180], im);
  return im;
}

function awning(): RgbaImage {
  const im = image(96, 36);
  polygon(
    { colour: "zone-red-shade" },
    [
      [0, 16],
      [12, 0],
      [83, 0],
      [95, 16],
      [95, 25],
      [0, 25],
    ],
    im,
  );
  polygon(
    { colour: PRIMARY },
    [
      [2, 16],
      [14, 2],
      [81, 2],
      [93, 16],
    ],
    im,
  );
  rect(SHADE, [2, 17, 94, 24], im);
  rect("zone-red-shade", [12, 25, 15, 36], im);
  rect("zone-red-shade", [81, 25, 84, 36], im);
  return im;
}

const AWNING_LEDGE = "homecity-awning-ledge";
const AWNING_W = 96;
const AWNING_H = 36;
const STRIPE = 8;
const SHOULDER = [3, 30] as const;
// Cream and zone-red-shade stripes separate from the zone-peach walls behind; dbrown, one ramp
// step below zone-red-shade, outlines them.
const LEDGE_LIGHT = "cream";
const LEDGE_DARK = "zone-red-shade";
const LEDGE_EDGE = "dbrown";

type Canvas = pixel.Grid;

function stripes(
  { bottom, length, top }: { length: number; top: number; bottom: number },
  g: Canvas,
): void {
  for (let x = 0; x < length; x += STRIPE) {
    g.rect(
      x,
      top,
      Math.min(STRIPE, length - x),
      bottom - top,
      (x / STRIPE) % 2 ? LEDGE_DARK : LEDGE_LIGHT,
    );
  }
}

/** Scalloped hem tabs under the stripes, one per stripe, rows top to top + 3, edged dbrown. */
function hem({ length, top }: { length: number; top: number }, g: Canvas): void {
  for (let x = 0; x + STRIPE <= length; x += STRIPE) {
    const c = (x / STRIPE) % 2 ? LEDGE_DARK : LEDGE_LIGHT;
    g.rect(x, top, STRIPE, 1, c);
    g.rect(x + 1, top + 1, STRIPE - 2, 1, c);
    g.p(x, top + 1, LEDGE_EDGE);
    g.p(x + STRIPE - 1, top + 1, LEDGE_EDGE);
    g.p(x + 1, top + 2, LEDGE_EDGE);
    g.p(x + STRIPE - 2, top + 2, LEDGE_EDGE);
    g.rect(x + 2, top + 2, STRIPE - 4, 1, c);
    g.rect(x + 2, top + 3, STRIPE - 4, 1, LEDGE_EDGE);
  }
}

/** A horizontal rolled-fabric tube, rows top to top + 3, from x0 to x1. */
function tube({ top, x0, x1 }: { top: number; x0: number; x1: number }, g: Canvas): void {
  g.rect(x0, top, x1 - x0, 4, LEDGE_EDGE);
  g.rect(x0 + 1, top + 1, x1 - x0 - 2, 2, LEDGE_DARK);
  g.rect(x0 + 1, top + 1, x1 - x0 - 2, 1, LEDGE_LIGHT);
}

/** The wall plate and a 2px dslate arm from the shoulder to end. */
function mount(end: readonly [number, number] | null, g: Canvas): void {
  if (end) {
    const [sx, sy] = SHOULDER;
    g.line(sx, sy, end[0], end[1], "dslate");
    g.line(sx, sy + 1, end[0], end[1] + 1, "dslate");
  } else {
    g.rect(2, 12, 2, 20, "dslate");
  }
  g.rect(0, 24, 4, 10, "dslate");
  g.rect(0, 25, 3, 8, "slate");
}

/** The standable top: a navy edge over a 2px white lip and a dbrown underside row. */
function lip(g: Canvas): void {
  g.rect(0, 0, AWNING_W, 1, "navy");
  g.rect(0, 1, AWNING_W, 2, "white");
  g.rect(0, 3, AWNING_W, 1, LEDGE_EDGE);
}

function awningOut(): pixel.Frame {
  const g = new pixel.Grid(AWNING_W, AWNING_H);
  mount([64, 16], g);
  lip(g);
  stripes({ length: AWNING_W, top: 4, bottom: 13 }, g);
  g.rect(AWNING_W - 1, 3, 1, 10, LEDGE_EDGE);
  hem({ length: AWNING_W, top: 13 }, g);
  return g.px;
}

/** A quarter rolled up: shorter stripes over a tube that bobs by dy and shifts by dx. */
function awningWarning(dx: number, dy: number): pixel.Frame {
  const g = new pixel.Grid(AWNING_W, AWNING_H);
  mount([64 + dx, 14 + dy], g);
  lip(g);
  stripes({ length: AWNING_W, top: 4, bottom: 10 + dy }, g);
  g.rect(AWNING_W - 1, 3, 1, 7 + dy, LEDGE_EDGE);
  tube({ top: 10 + dy, x0: Math.max(0, dx), x1: AWNING_W + Math.min(0, dx) }, g);
  return g.px;
}

function awningRetracted(): pixel.Frame {
  const g = new pixel.Grid(AWNING_W, AWNING_H);
  mount(null, g);
  g.rect(1, 0, 10, 12, LEDGE_EDGE);
  g.rect(0, 1, 12, 10, LEDGE_EDGE);
  g.rect(2, 2, 8, 8, LEDGE_DARK);
  g.rect(3, 3, 4, 2, LEDGE_LIGHT);
  return g.px;
}

/** Unrolling from the wall to length, with no lip: a dbrown top edge. */
function awningExtending(length: number): pixel.Frame {
  const g = new pixel.Grid(AWNING_W, AWNING_H);
  mount([Math.round(length * 0.66), 16], g);
  g.rect(0, 0, length, 1, LEDGE_EDGE);
  stripes({ length, top: 1, bottom: 13 }, g);
  g.rect(length - 1, 0, 1, 13, LEDGE_EDGE);
  hem({ length, top: 13 }, g);
  g.rect(0, 0, 6, 8, LEDGE_EDGE);
  g.rect(1, 1, 4, 6, LEDGE_DARK);
  return g.px;
}

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield [
    AWNING_LEDGE,
    [
      ["out", [awningOut()], 1000],
      ["warning", [awningWarning(0, 0), awningWarning(1, 1), awningWarning(-1, 0)], 100],
      ["retracted", [awningRetracted()], 1000],
      ["extending", [30, 54, 78].map(awningExtending), 130],
    ],
  ];
}

const ONCE = { [AWNING_LEDGE]: ["extending"] };

/** Key to drawing, repeat and suggested scroll factor. */
export const BACKDROPS: Readonly<
  Record<
    string,
    readonly [draw: () => RgbaImage, repeat: string, factor: readonly [number, number]]
  >
> = {
  "homecity-sky": [sky, "x", [0, 0]],
  "homecity-far": [far, "x", [0.15, 0.05]],
  "outskirts-mid": [outskirtsMid, "x", [0.4, 0.15]],
  "neighbourhood-mid": [neighbourhoodMid, "x", [0.4, 0.15]],
  "outskirts-wall": [outskirtsWall, "x", [1, 1]],
  "neighbourhood-wall": [neighbourhoodWall, "x", [1, 1]],
  "homecity-awning": [awning, "none", [1, 1]],
};

function registry(): pixel.ManifestEntry[] {
  return Object.entries(BACKDROPS).map(([key, [draw, repeat]]) =>
    backdropEntry({ bottom: BOTTOM, repeat }, key, draw()),
  );
}

export async function build(): Promise<void> {
  const entry = await pixel.writeTileset({ key: TILESET }, tiles());
  for (const [key, [draw]] of Object.entries(BACKDROPS)) {
    writeImage(`${BACKDROPS_DIR}/${key}.png`, backgroundTones.apply(key, draw()));
  }
  pixel.updateManifest("tilesets", [entry]);
  pixel.updateManifest("backdrops", registry());
  await pixel.build({ once: ONCE }, [...sprites()]);
}

function context(kind: "outskirts" | "neighbourhood"): RgbaImage {
  const im = image(720, 720, PRIMARY);
  for (const key of [
    "homecity-sky",
    "homecity-far",
    kind === "outskirts" ? "outskirts-mid" : "neighbourhood-mid",
  ]) {
    const p = (BACKDROPS[key] as (typeof BACKDROPS)[string])[0]();
    for (let x = 0; x < 720; x += p.width) {
      over([x, 600 - p.height], p, im);
    }
  }
  let ground: string;
  let raised: string;
  if (kind === "outskirts") {
    for (let x = 0; x < 192; x += 48) {
      over([x, 456], outskirtsWall(), im);
    }
    [ground, raised] = ["outskirts-ground", "brick-stack"];
  } else {
    for (let x = 0; x < 192; x += 48) {
      over([x, 420], neighbourhoodWall(), im);
    }
    over([240, 492], awning(), im);
    [ground, raised] = ["neighbourhood-ground", "stoop-stack"];
  }
  const ts = new Map(tiles());
  for (const [col, row, width, height, family] of [
    [0, 50, 60, 10, ground],
    [20, 46, 6, 4, raised],
    [32, 42, 7, 8, raised],
    [45, 38, 6, 12, raised],
  ] as const) {
    terrainBlock({ tiles: ts, family, col, row, width, height }, im);
  }
  const bird = cropBox([0, 0, 48, 42], readImage(`${pixel.SPRITES}/bird.png`));
  over([72, 558], bird, im);
  return opaque(cropBox([0, 360, 720, 720], im));
}

async function preview(out: string): Promise<void> {
  const board = image(1456, 392, "ink");
  (["outskirts", "neighbourhood"] as const).forEach((kind, i) => {
    drawLabel({ x: 8 + i * 728, y: 6, colour: "cream" }, kind, board);
    over([8 + i * 728, 24], context(kind), board);
  });
  writeRgbImage(out, board);
}

if (import.meta.main) {
  run(() => commands({ usage: USAGE, build, preview }));
}
