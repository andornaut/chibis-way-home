/**
 * Reusable countryside appearance skins, independent of layouts, collision and zone assignment.
 *
 * Usage: node art/tools/countryside.ts build | preview OUT.png, from the repository root. Plain PNG,
 * no animation. Canonical countryside zone-yellow and its shade supply wheat atmosphere. Existing
 * house colours supply outlines, quiet foliage and water. No palette changes. Water is distant
 * decoration, not a hazard surface.
 *
 * tiles-countryside: 12px, eight columns, 52 cells, 96x84. Families country-ground, hay-stack,
 * riverbank, timber-crossing each use top/top-left/top-right/top-joint/face/face-left/face-right,
 * then, after all four, bottom-left/bottom/bottom-right: the face closed by a 2px dslate band along
 * its bottom, as the side tiles close their open side; then slab-left/slab/slab-right: a one-row
 * block, the top's edge and lip over the bottom's closing band.
 * Same generic geometry and collision as existing skins. Only top cells have dark edge and white
 * safe lip. Existing shared ledges, hazards and movers retain tiles-platforming. These are
 * appearance packs, not zone-specific archetypes.
 *
 * Backdrops bottom-left anchored at default y 600: countryside-sky 48x600 repeat x factor 0,0;
 * countryside-far 720x600 repeat x factor .15,.05; farmland-mid and river-mid 720x600 repeat x
 * factor .4,.15; farmland-barn 120x144 none, farmland-fence 48x48 repeat x, river-reeds 48x72
 * repeat x factor 1,1. Near decor aligns with local floor, has no collision, white safe lip or red
 * hazard marking. Keep near silhouettes clear of the route. Tonal silhouettes have no dark contour
 * bands. No new actors, doors or mechanics. Preview geometry is illustrative only.
 *
 * The windmill sails use countryside-windmill and two sprites in the countryside timber ramp
 * (zone-peach, zone-peach-shade, brown, dbrown):
 * - countryside-windmill: 144x240, no repeat, bottom-left on the module floor, gameplay plane at
 *   1,1. A grey stone plinth with a door, a tapering boarded smock tower with one window, a curb
 *   and a domed cap. The windshaft boss is centred on pixel 72,72, the hub the sails orbit. No
 *   sails, lip or collision.
 * Sprites (once: none):
 * - windmill-sail-ledge: 60x12, bottom-centre on a 5x1 footprint, tag idle (1 frame). Rows 0 to 2
 *   are the standable top: a navy edge over a 2px white lip, nothing above row 0. Below, a
 *   zone-peach and zone-peach-shade timber deck with brown plank joints, a dbrown outline and a
 *   small centre clamp. No sail cloth.
 * - windmill-spoke: 8x8, tag idle (1 frame). A clipped-corner lattice node: dbrown frame, a
 *   zone-peach-shade cell crossed by a brown brace, a 1px clear margin. Placed unrotated every
 *   segment from the hub centre to the ledge's top centre, it reads as a dotted, stepped spar in
 *   any direction.
 * No red, amber or round pickup shapes.
 */

import { opaque } from "@andornaut/art-kit/raster";

import * as backgroundTones from "./backgroundTones.ts";
import { commands, run } from "./cli.ts";
import {
  backdropEntry,
  BACKDROPS_DIR,
  cropBox,
  image,
  line,
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
const TILESET = "tiles-countryside";
const BOTTOM = 600;
const PRIMARY = (THEMES.countryside as { primary: string }).primary;
const SHADE = `${PRIMARY}-shade`;
const FAMILIES = ["country-ground", "hay-stack", "riverbank", "timber-crossing"] as const;
const SUFFIXES = ["top", "top-left", "top-right", "top-joint", "face", "face-left", "face-right"];
// Appended after every family's SUFFIXES, bottoms then slabs, so the earlier indices hold.
const BOTTOM_SUFFIXES = ["bottom-left", "bottom", "bottom-right"];
const SLAB_SUFFIXES = ["slab-left", "slab", "slab-right"];
const USAGE = "Usage: countryside.ts build | preview OUT.png";

type Family = (typeof FAMILIES)[number];

function material(family: Family, suffix: string): RgbaImage {
  const fill = {
    "country-ground": SHADE,
    "hay-stack": SHADE,
    riverbank: "zone-green-shade",
    "timber-crossing": "zone-peach-shade",
  }[family];
  const im = image(T, T, fill);
  if (family === "hay-stack") {
    rect(PRIMARY, [0, 0, 12, 2], im);
    rect("brown", [4, 0, 6, 12], im);
  } else if (family === "timber-crossing") {
    rect("brown", [0, 8, 12, 10], im);
    rect("zone-yellow-shade", [0, 0, 2, 8], im);
  } else if (family === "country-ground") {
    rect("brown", [0, 8, 12, 10], im);
  }
  if (suffix.endsWith("left")) {
    rect("dslate", [0, 0, 2, T], im);
  }
  if (suffix.endsWith("right")) {
    rect("dslate", [10, 0, 12, T], im);
  }
  if (suffix.startsWith("bottom") || suffix.startsWith("slab")) {
    rect("dslate", [0, 10, 12, 12], im);
  }
  if (suffix.startsWith("top") || suffix.startsWith("slab")) {
    rect("navy", [0, 0, 12, 1], im);
    rect("white", [0, 1, 12, 3], im);
    rect(family !== "riverbank" ? PRIMARY : "zone-green", [0, 3, 12, 5], im);
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
  polygon(
    { colour: SHADE },
    [
      [0, 424],
      [88, 398],
      [192, 414],
      [286, 380],
      [396, 406],
      [500, 392],
      [614, 410],
      [719, 424],
      [719, 600],
      [0, 600],
    ],
    im,
  );
  polygon(
    { colour: "zone-peach" },
    [
      [0, 478],
      [142, 446],
      [292, 466],
      [454, 436],
      [610, 454],
      [719, 478],
      [719, 600],
      [0, 600],
    ],
    im,
  );
  return im;
}

function farmlandMid(): RgbaImage {
  const im = image(720, 600);
  polygon(
    { colour: "zone-green-shade" },
    [
      [0, 484],
      [152, 458],
      [306, 480],
      [460, 450],
      [610, 470],
      [719, 484],
      [719, 600],
      [0, 600],
    ],
    im,
  );
  polygon(
    { colour: SHADE },
    [
      [0, 526],
      [198, 494],
      [380, 516],
      [552, 490],
      [719, 526],
      [719, 600],
      [0, 600],
    ],
    im,
  );
  polygon(
    { colour: PRIMARY },
    [
      [20, 536],
      [180, 510],
      [294, 524],
      [114, 556],
    ],
    im,
  );
  polygon(
    { colour: "zone-peach-shade" },
    [
      [420, 558],
      [568, 516],
      [686, 542],
      [540, 582],
    ],
    im,
  );
  // Small distant barn keeps a complete wall below its roof.
  rect("zone-peach-shade", [540, 468, 592, 506], im);
  polygon(
    { colour: SHADE },
    [
      [534, 470],
      [566, 448],
      [598, 470],
    ],
    im,
  );
  return im;
}

function riverMid(): RgbaImage {
  const im = image(720, 600);
  polygon(
    { colour: "zone-green-shade" },
    [
      [0, 478],
      [144, 454],
      [300, 484],
      [504, 460],
      [719, 478],
      [719, 600],
      [0, 600],
    ],
    im,
  );
  polygon(
    { colour: "zone-peach-shade" },
    [
      [0, 526],
      [188, 494],
      [386, 526],
      [570, 500],
      [719, 526],
      [719, 600],
      [0, 600],
    ],
    im,
  );
  polygon(
    { colour: "zone-blue-shade" },
    [
      [0, 548],
      [188, 516],
      [386, 548],
      [570, 522],
      [719, 548],
      [719, 600],
      [0, 600],
    ],
    im,
  );
  for (const [x, y, w] of [
    [30, 564, 120],
    [276, 548, 136],
    [526, 576, 150],
  ] as const) {
    rect("zone-blue", [x, y, x + w, y + 4], im);
  }
  return im;
}

function barn(): RgbaImage {
  const im = image(120, 144);
  polygon(
    { colour: SHADE },
    [
      [0, 40],
      [60, 0],
      [119, 40],
      [119, 143],
      [0, 143],
    ],
    im,
  );
  polygon(
    { colour: PRIMARY },
    [
      [4, 42],
      [60, 6],
      [116, 42],
      [116, 140],
      [4, 140],
    ],
    im,
  );
  polygon(
    { colour: "brown" },
    [
      [0, 40],
      [60, 0],
      [119, 40],
      [119, 48],
      [60, 12],
      [0, 48],
    ],
    im,
  );
  rect(PRIMARY, [6, 48, 114, 58], im);
  rect("brown", [28, 68, 92, 144], im);
  rect("zone-peach-shade", [32, 72, 88, 140], im);
  rect("brown", [58, 72, 62, 140], im);
  polygon(
    { colour: "brown" },
    [
      [32, 76],
      [36, 72],
      [88, 132],
      [88, 140],
    ],
    im,
  );
  rect("brown", [48, 26, 72, 42], im);
  rect(PRIMARY, [52, 30, 68, 38], im);
  return im;
}

function fence(): RgbaImage {
  const im = image(48, 48);
  for (const y of [14, 28]) {
    rect("brown", [0, y, 48, y + 6], im);
    rect(SHADE, [0, y, 48, y + 3], im);
  }
  for (const x of [6, 30]) {
    rect("brown", [x, 6, x + 8, 48], im);
    rect("zone-peach-shade", [x + 2, 8, x + 6, 46], im);
  }
  return im;
}

function reeds(): RgbaImage {
  const im = image(48, 72);
  for (const [x, top] of [
    [8, 22],
    [22, 8],
    [36, 30],
  ] as const) {
    rect("zone-green-shade", [x, top, x + 3, 72], im);
    polygon(
      { colour: "zone-green-shade" },
      [
        [x, 64],
        [x - 7, top + 10],
        [x - 4, top + 8],
        [x + 3, 64],
      ],
      im,
    );
    polygon(
      { colour: "zone-green-shade" },
      [
        [x, 68],
        [x + 8, top + 18],
        [x + 11, top + 20],
        [x + 3, 72],
      ],
      im,
    );
    rect("brown", [x - 1, top - 6, x + 4, top + 5], im);
  }
  return im;
}

/** The hub the sails orbit, in windmill pixels. */
export const WINDMILL_HUB = [72, 72] as const;

function windmill(): RgbaImage {
  const im = image(144, 240);
  // Boarded smock tower, lit from the top-left: a shaded right flank and converging board seams.
  polygon(
    { colour: "zone-peach-shade" },
    [
      [32, 216],
      [52, 92],
      [92, 92],
      [112, 216],
    ],
    im,
  );
  polygon(
    { colour: "brown" },
    [
      [88, 216],
      [80, 92],
      [92, 92],
      [112, 216],
    ],
    im,
  );
  for (const [bottom, top] of [
    [52, 61],
    [72, 72],
  ] as const) {
    line(
      { colour: "brown" },
      [
        [bottom, 215],
        [top, 93],
      ],
      im,
    );
  }
  line(
    { colour: "dbrown" },
    [
      [100, 215],
      [86, 93],
    ],
    im,
  );
  rect("dbrown", [64, 140, 80, 158], im);
  rect("dslate", [67, 143, 77, 155], im);
  // Stone plinth and door.
  rect("slate", [26, 212, 118, 240], im);
  rect("grey", [28, 214, 116, 238], im);
  for (const [x, y] of [
    [40, 220],
    [94, 222],
    [34, 230],
    [104, 230],
  ] as const) {
    rect("slate", [x, y, x + 8, y + 2], im);
  }
  rect("dbrown", [60, 196, 84, 240], im);
  rect("brown", [63, 199, 81, 240], im);
  rect("dbrown", [71, 199, 73, 240], im);
  // Curb and domed cap.
  rect("dbrown", [44, 88, 100, 94], im);
  polygon(
    { colour: "brown" },
    [
      [42, 88],
      [44, 70],
      [52, 56],
      [64, 48],
      [80, 48],
      [92, 56],
      [100, 70],
      [102, 88],
    ],
    im,
  );
  polygon(
    { colour: "zone-peach-shade" },
    [
      [48, 84],
      [50, 70],
      [56, 60],
      [66, 53],
      [74, 53],
      [62, 62],
      [56, 74],
      [54, 84],
    ],
    im,
  );
  polygon(
    { colour: "dbrown" },
    [
      [90, 88],
      [94, 72],
      [90, 60],
      [96, 64],
      [101, 76],
      [102, 88],
    ],
    im,
  );
  // Windshaft boss: a clipped dbrown square, never a round blob, centred on the hub.
  const [hx, hy] = WINDMILL_HUB;
  rect("plum", [hx - 7, hy - 5, hx + 8, hy + 6], im);
  rect("plum", [hx - 5, hy - 7, hx + 6, hy + 8], im);
  rect("dbrown", [hx - 5, hy - 5, hx + 6, hy + 6], im);
  rect("brown", [hx - 4, hy - 4, hx + 1, hy - 2], im);
  rect("plum", [hx - 1, hy - 1, hx + 2, hy + 2], im);
  return im;
}

const SAIL_LEDGE = "windmill-sail-ledge";
const SPOKE = "windmill-spoke";

function sailLedge(): pixel.Frame {
  const g = new pixel.Grid(60, 12);
  g.rect(0, 3, 60, 7, "dbrown");
  g.rect(1, 3, 58, 2, "zone-peach");
  g.rect(1, 5, 58, 3, "zone-peach-shade");
  g.rect(1, 8, 58, 1, "brown");
  for (const x of [12, 24, 35, 47]) {
    g.rect(x, 5, 1, 3, "brown");
  }
  // Centre clamp where the spar meets the deck.
  g.rect(25, 10, 10, 2, "dbrown");
  g.rect(27, 10, 6, 1, "brown");
  g.rect(0, 0, 60, 1, "navy");
  g.rect(0, 1, 60, 2, "white");
  return g.px;
}

function spoke(): pixel.Frame {
  const g = new pixel.Grid(8, 8);
  g.rect(2, 1, 4, 6, "dbrown");
  g.rect(1, 2, 6, 4, "dbrown");
  g.rect(2, 2, 4, 4, "zone-peach-shade");
  for (let i = 0; i < 4; i++) {
    g.p(2 + i, 5 - i, "brown");
  }
  g.p(2, 2, "zone-peach");
  return g.px;
}

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield [SAIL_LEDGE, [["idle", [sailLedge()], 1000]]];
  yield [SPOKE, [["idle", [spoke()], 1000]]];
}

const ONCE = { [SAIL_LEDGE]: [], [SPOKE]: [] };

export const BACKDROPS: Readonly<Record<string, readonly [draw: () => RgbaImage, repeat: string]>> =
  {
    "countryside-far": [far, "x"],
    "countryside-sky": [sky, "x"],
    "countryside-windmill": [windmill, "none"],
    "farmland-barn": [barn, "none"],
    "farmland-fence": [fence, "x"],
    "farmland-mid": [farmlandMid, "x"],
    "river-mid": [riverMid, "x"],
    "river-reeds": [reeds, "x"],
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
function context(skin: "farmland" | "river"): RgbaImage {
  const im = image(720, 720, PRIMARY);
  for (const key of [
    "countryside-sky",
    "countryside-far",
    skin === "farmland" ? "farmland-mid" : "river-mid",
  ]) {
    const p = readImage(`${BACKDROPS_DIR}/${key}.png`);
    for (let x = 0; x < 720; x += p.width) {
      over([x, BOTTOM - p.height], p, im);
    }
  }
  let ground: string;
  let raised: string;
  if (skin === "farmland") {
    over([0, 456], readImage(`${BACKDROPS_DIR}/farmland-barn.png`), im);
    for (let x = 120; x < 240; x += 48) {
      over([x, 552], readImage(`${BACKDROPS_DIR}/farmland-fence.png`), im);
    }
    [ground, raised] = ["country-ground", "hay-stack"];
  } else {
    for (let x = 432; x < 672; x += 48) {
      over([x, 528], readImage(`${BACKDROPS_DIR}/river-reeds.png`), im);
    }
    [ground, raised] = ["riverbank", "timber-crossing"];
  }
  skinForeground({ tiles: new Map(tiles()), ground, raised }, im);
  return cropBox([0, 360, 720, 720], opaque(im));
}

async function preview(out: string): Promise<void> {
  const sheet = image(1456, 392, "ink");
  (
    [
      ["farmland", "Farmland / earth + bound hay"],
      ["river", "River crossing / bank + timber"],
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
