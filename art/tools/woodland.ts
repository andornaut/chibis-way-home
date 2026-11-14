/**
 * Reusable woodland appearance skins.
 *
 * Usage: node art/tools/woodland.ts build | preview OUT.png, from the repository root. Plain PNG,
 * no animations. Canonical woodland zone-green and shade, existing house palette only.
 * tiles-woodland: 12px, eight columns, 52 cells in 96x84. Families forest-ground/root-stack/
 * ravine-ground/stone-stack each use top/top-left/top-right/top-joint/face/face-left/face-right,
 * then, after all four, bottom-left/bottom/bottom-right: the face closed by a 2px dslate band along
 * its bottom, as the side tiles close their open side; then slab-left/slab/slab-right: a one-row
 * block, the top's edge and lip over the bottom's closing band.
 * Generic geometry unchanged. Only top tiles have dark edge and white lip. Shared ledges, hazards
 * and movers retain tiles-platforming.
 *
 * Backdrops bottom-left y 600: woodland-sky 48x600 repeat x factor 0,0; woodland-far 720x600 repeat
 * x .15,.05; forest-mid/ravine-mid 720x600 repeat x .4,.15; forest-tree 96x216 none, forest-shrub
 * 48x48 repeat x, ravine-rock 72x72 none at 1,1. Near pieces align local floor. Decor has no
 * collision, white safe lips or red hazard marking. Natural decor uses tonal fills without dark
 * contour bands. Keep silhouettes clear of required routes. Distant ravine water is decorative
 * only. Large overlapping far and middle canopies span the upper texture bands; trunks extend to
 * the base. The birch middle and conifer far/middle variants keep 720x600/repeat x/bottom 600 and
 * the same parallax contracts. No actors or natural hidden lethality. Context uses identical
 * illustrative geometry, not validated stages.
 *
 * Sprites, for the ravine gusts (once: none). Green leaves (green, dgreen), tan leaves (tan,
 * brown) and short pale streaks (white heads, lgrey tails), all binary alpha and mostly clear. No
 * red, amber, round pickup shapes or long horizontal pale bands, so nothing reads as a ledge.
 * - woodland-gust-emitter: 12x48, bottom-centre on a 1x4 footprint at the ravine wall, facing right
 *   (mirrored for left). A dslate and navy draft fissure down the left edge with a brown ivy stem
 *   and five leaf clusters. calm (2 x 400ms): the leaves hang and sway. warning (4 x 120ms): the
 *   leaves bend right and the first leaves and streaks leave the wall. gust (4 x 80ms): the leaves
 *   lie flat, short streaks pour from the fissure and the stream field runs beyond it.
 * - woodland-gust-stream: 48x48, tag pulse (4 x 80ms, loop). Eleven leaves and eight streaks that
 *   move 12px right per frame and wrap at 48px, so the pulse tiles seamlessly left to right and
 *   loops. The renderer repeats it across the band, bottom on the band bottom.
 */

import { opaque } from "@andornaut/art-kit/raster";

import { TILE as T } from "../../src/data/screen.ts";
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
  skinForeground,
  writeImage,
  writeRgbImage,
} from "./imageArt.ts";
import * as nature from "./nature.ts";
import * as pixel from "./pixel.ts";
import { mod } from "./pixel.ts";
import { drawLabel } from "./previewText.ts";
import { THEMES } from "./zoneThemes.ts";

const TILESET = "tiles-woodland";
const BOTTOM = 600;
const PRIMARY = (THEMES.woodland as { primary: string }).primary;
const SHADE = `${PRIMARY}-shade`;
const FAMILIES = ["forest-ground", "root-stack", "ravine-ground", "stone-stack"] as const;
const SUFFIXES = ["top", "top-left", "top-right", "top-joint", "face", "face-left", "face-right"];
// Appended after every family's SUFFIXES, bottoms then slabs, so the earlier indices hold.
const BOTTOM_SUFFIXES = ["bottom-left", "bottom", "bottom-right"];
const SLAB_SUFFIXES = ["slab-left", "slab", "slab-right"];
const USAGE = "Usage: woodland.ts build | preview OUT.png";

type Family = (typeof FAMILIES)[number];

function material(family: Family, suffix: string): RgbaImage {
  const fill = {
    "forest-ground": "zone-green-shade",
    "root-stack": "zone-yellow-shade",
    "ravine-ground": "slate",
    "stone-stack": "grey",
  }[family];
  const im = image(T, T, fill);
  if (family === "root-stack") {
    rect("brown", [0, 8, 12, 10], im);
    rect("brown", [4, 0, 6, 8], im);
  } else if (family === "stone-stack") {
    rect("slate", [0, 8, 12, 10], im);
    rect("slate", [4, 0, 6, 8], im);
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

/** Large irregular broadleaf crowns on branching trunks, wrapped at the repeat boundary. */
function woodlandMass(
  im: RgbaImage,
  [x, top, width, height]: readonly [number, number, number, number],
  colour: string,
  trunkWidth: number,
): void {
  for (const shift of [-720, 0, 720]) {
    nature.broadleaf(
      im,
      x + shift,
      top,
      width,
      height,
      600,
      colour,
      colour,
      trunkWidth,
      mod(Math.trunc(x), 11),
    );
  }
}

function far(): RgbaImage {
  const im = image(720, 600);
  // Continuous overlapping forest canopy, with trunks visible down to the texture's base.
  for (const mass of [
    [-60, 34, 190, 242],
    [76, 8, 204, 272],
    [224, 48, 182, 238],
    [352, 18, 208, 264],
    [504, 46, 192, 242],
    [636, 12, 196, 268],
  ] as const) {
    woodlandMass(im, mass, SHADE, 18);
  }
  return im;
}

function forestMid(): RgbaImage {
  const im = image(720, 600);
  // Large near-middle trees overlap the distant canopy without a decorative contour band.
  for (const mass of [
    [-84, 144, 236, 232],
    [110, 108, 224, 254],
    [304, 164, 242, 230],
    [506, 126, 244, 252],
  ] as const) {
    woodlandMass(im, mass, "forest", 30);
  }
  return im;
}

function ravineMid(): RgbaImage {
  const im = image(720, 600);
  // Dense bank-side woods frame the ravine; its central opening remains visually open.
  for (const [x, top, width] of [
    [-62, 116, 236],
    [558, 132, 230],
  ] as const) {
    woodlandMass(im, [x, top, width, 242], "forest", 26);
  }
  polygon(
    { colour: SHADE },
    [
      [0, 450],
      [124, 428],
      [212, 458],
      [274, 470],
      [350, 542],
      [422, 478],
      [514, 444],
      [626, 432],
      [719, 450],
      [719, 600],
      [0, 600],
    ],
    im,
  );
  polygon(
    { colour: "slate" },
    [
      [0, 510],
      [106, 482],
      [208, 510],
      [274, 514],
      [350, 584],
      [422, 532],
      [510, 494],
      [628, 486],
      [719, 510],
      [719, 600],
      [0, 600],
    ],
    im,
  );
  polygon(
    { colour: "zone-blue-shade" },
    [
      [312, 600],
      [350, 568],
      [388, 600],
    ],
    im,
  );
  return im;
}

/** Natural tapered spruce crowns with irregular drooping boughs and connected trunks. */
function conifers(middle = false): RgbaImage {
  const im = image(720, 600);
  const colour = middle ? "forest" : SHADE;
  for (const [x, sourceTop, width] of [
    [-40, 28, 156],
    [92, 68, 136],
    [206, 12, 172],
    [356, 50, 148],
    [482, 22, 174],
    [632, 62, 142],
  ] as const) {
    const top = middle ? sourceTop + 62 : sourceTop;
    for (const shift of [-720, 0, 720]) {
      nature.spruce(im, x + shift, top, width, 300, 600, colour, colour, mod(Math.trunc(x), 7));
    }
  }
  return im;
}

/** Middle-distance birches: leafy crowns above slender pale, sparsely marked trunks. */
function birches(): RgbaImage {
  const im = image(720, 600);
  for (const [x, sourceTop, sourceWidth] of [
    [-38, 18, 158],
    [104, 52, 146],
    [226, 6, 166],
    [378, 38, 152],
    [510, 16, 160],
    [652, 54, 140],
  ] as const) {
    const top = sourceTop + 20;
    const width = Math.trunc(sourceWidth * 0.76);
    for (const shift of [-720, 0, 720]) {
      const left = x + shift;
      nature.broadleaf(
        im,
        left,
        top,
        width,
        150,
        600,
        "forest",
        "lgrey",
        9,
        mod(Math.trunc(x), 11),
      );
      const centre = Math.trunc(left + width * 0.52);
      for (let y = top + 160; y < 590; y += 46) {
        rect("slate", [centre - 2, y, centre + 2, y + 2], im);
      }
    }
  }
  return im;
}

function tree(): RgbaImage {
  const im = image(96, 216);
  nature.broadleaf(im, 1, 4, 92, 148, 216, SHADE, "zone-peach-shade", 14, 3);
  return im;
}

function shrub(): RgbaImage {
  const im = image(48, 48);
  for (const x of [8, 18, 31, 40]) {
    nature.branch(im, SHADE, [24, 48], [x, 18 + (x % 7)], 3);
  }
  for (const [x, y, width, height, seed] of [
    [0, 18, 28, 24, 2],
    [17, 10, 29, 31, 5],
    [8, 28, 36, 20, 8],
  ] as const) {
    nature.leaves(im, SHADE, [x, y, width, height], seed);
  }
  nature.leaves(im, PRIMARY, [19, 12, 19, 18], 7);
  return im;
}

function rock(): RgbaImage {
  const im = image(72, 72);
  polygon(
    { colour: "slate" },
    [
      [0, 70],
      [4, 42],
      [20, 20],
      [44, 12],
      [62, 32],
      [71, 70],
    ],
    im,
  );
  polygon(
    { colour: "slate" },
    [
      [4, 67],
      [8, 44],
      [22, 24],
      [43, 16],
      [59, 34],
      [67, 67],
    ],
    im,
  );
  polygon(
    { colour: "grey" },
    [
      [8, 44],
      [22, 24],
      [43, 16],
      [51, 26],
      [32, 44],
    ],
    im,
  );
  return im;
}

const EMITTER = "woodland-gust-emitter";
const STREAM = "woodland-gust-stream";
const STREAM_SIZE = 48;
const STREAM_STEP = STREAM_SIZE / 4;

type Leaf = "green" | "tan";

const LEAF_COLOURS: Readonly<Record<Leaf, readonly [light: string, shade: string]>> = {
  green: ["green", "dgreen"],
  tan: ["tan", "brown"],
};

// Four flutter poses, as [dx, dy, shade] cells: flat, tipped up, edge-on and tipped down.
const LEAF_POSES: readonly (readonly (readonly [number, number, boolean])[])[] = [
  [
    [1, 0, false],
    [2, 0, false],
    [0, 1, false],
    [1, 1, true],
    [2, 1, true],
    [3, 1, true],
  ],
  [
    [2, 0, false],
    [3, 0, false],
    [1, 1, false],
    [2, 1, true],
    [0, 2, true],
    [1, 2, true],
  ],
  [
    [0, 0, false],
    [1, 0, false],
    [2, 0, true],
    [3, 0, true],
  ],
  [
    [0, 0, false],
    [1, 0, false],
    [1, 1, true],
    [2, 1, false],
    [2, 2, true],
    [3, 2, true],
  ],
];
const BOB = [0, 1, 0, -1];

/** A leaf in a flutter pose, wrapped at wrap px when given. */
function leaf(
  g: pixel.Grid,
  [x, y]: readonly [number, number],
  kind: Leaf,
  pose: number,
  wrap = 0,
): void {
  const [light, shade] = LEAF_COLOURS[kind];
  for (const [dx, dy, dark] of LEAF_POSES[mod(pose, 4)] as (readonly [number, number, boolean])[]) {
    g.p(wrap ? mod(x + dx, wrap) : x + dx, y + dy, dark ? shade : light);
  }
}

/** A pale streak heading right: a 2px lgrey tail behind a white head of length px. */
function streak(g: pixel.Grid, [x, y]: readonly [number, number], length: number, wrap = 0): void {
  for (let i = 0; i < length + 2; i++) {
    g.p(wrap ? mod(x + i, wrap) : x + i, y, i < 2 ? "lgrey" : "white");
  }
}

// The stream's field at frame 0: [x, y, kind, pose] leaves and [x, y] streaks, staggered so no
// streaks line up into a band.
const FIELD_LEAVES: readonly (readonly [number, number, Leaf, number])[] = [
  [3, 6, "green", 0],
  [20, 2, "tan", 3],
  [34, 9, "green", 2],
  [27, 15, "green", 1],
  [9, 18, "tan", 0],
  [42, 21, "green", 3],
  [15, 26, "green", 2],
  [39, 30, "tan", 3],
  [24, 35, "green", 0],
  [6, 38, "tan", 2],
  [32, 42, "green", 1],
];
const FIELD_STREAKS: readonly (readonly [number, number])[] = [
  [30, 5],
  [10, 11],
  [33, 18],
  [0, 24],
  [19, 30],
  [44, 34],
  [12, 43],
  [20, 46],
];
const STREAK_LENGTH = 5;

/** The moving field at frame f, shifted right 12px per frame; wrap 48 tiles it seamlessly. */
function field(g: pixel.Grid, f: number, { minX = 0, wrap = 0 } = {}): void {
  const at = (x: number): number => mod(x + f * STREAM_STEP, STREAM_SIZE);
  for (const [x, y] of FIELD_STREAKS) {
    if (at(x) >= minX) {
      streak(g, [at(x), y], STREAK_LENGTH, wrap);
    }
  }
  for (const [x, y, kind, pose] of FIELD_LEAVES) {
    if (at(x) >= minX) {
      leaf(g, [at(x), y + (BOB[mod(pose + f, 4)] as number)], kind, pose + f, wrap);
    }
  }
}

function stream(f: number): pixel.Frame {
  const g = new pixel.Grid(STREAM_SIZE, STREAM_SIZE);
  field(g, f, { wrap: STREAM_SIZE });
  return g.px;
}

// Ivy clusters on the emitter stem: [y, kind].
const IVY: readonly (readonly [number, Leaf])[] = [
  [3, "green"],
  [12, "tan"],
  [21, "green"],
  [30, "green"],
  [39, "tan"],
];
// Each cluster's three leaves as [dx, dy, pose], hanging, leaning and flat.
const CLUSTERS: readonly (readonly (readonly [number, number, number])[])[] = [
  [
    [5, 1, 3],
    [4, 5, 1],
    [7, 3, 3],
  ],
  [
    [6, 0, 0],
    [5, 4, 0],
    [8, 2, 1],
  ],
  [
    [6, 0, 2],
    [5, 4, 2],
    [8, 2, 2],
  ],
];

/** The draft fissure and ivy stem, unchanged in every frame. */
function wall(): pixel.Grid {
  const g = new pixel.Grid(12, 48);
  g.rect(0, 0, 4, 48, "dslate");
  for (const [y, h] of [
    [0, 9],
    [12, 14],
    [29, 8],
    [40, 8],
  ] as const) {
    g.rect(0, y, 3, h, "navy");
  }
  for (let y = 1; y < 48; y++) {
    g.p(mod(Math.floor(y / 6), 2) ? 4 : 5, y, "brown");
  }
  return g;
}

/** The ivy bent by bend (0 hang, 1 lean, 2 flat), each cluster nudged right by sway. */
function ivy(g: pixel.Grid, bend: number, sway: number): void {
  for (const [y, kind] of IVY) {
    for (const [dx, dy, pose] of CLUSTERS[bend] as (readonly [number, number, number])[]) {
      leaf(g, [dx + (dy ? 0 : sway), y + dy], kind, pose);
    }
  }
}

/** Calm or warning frame, with loose leaves and short streaks leaving the wall. */
function emitter(
  bend: number,
  sway: number,
  loose: readonly (readonly [x: number, y: number, kind: Leaf, pose: number])[] = [],
  streaks: readonly (readonly [x: number, y: number, length: number])[] = [],
): pixel.Frame {
  const g = wall();
  for (const [x, y, length] of streaks) {
    streak(g, [x, y], length);
  }
  ivy(g, bend, sway);
  for (const [x, y, kind, pose] of loose) {
    leaf(g, [x, y], kind, pose);
  }
  return g.px;
}

/** Gust frame: flat ivy, streaks pouring from the fissure and the stream's field beyond it. */
function gust(f: number): pixel.Frame {
  const g = wall();
  IVY.forEach(([y], i) => {
    streak(g, [4 + mod(f * 3 + i * 2, 6), y + 7], 3);
  });
  ivy(g, 2, mod(f, 2));
  field(g, f, { minX: 6 });
  return g.px;
}

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield [
    EMITTER,
    [
      ["calm", [emitter(0, 0), emitter(0, 1)], 400],
      [
        "warning",
        [
          emitter(1, 0, [[9, 10, "green", 0]]),
          emitter(1, 1, [[10, 9, "green", 1]], [[7, 27, 2]]),
          emitter(
            1,
            0,
            [
              [10, 10, "green", 2],
              [9, 28, "tan", 0],
            ],
            [[7, 19, 3]],
          ),
          emitter(
            1,
            1,
            [
              [9, 19, "tan", 3],
              [10, 28, "tan", 1],
              [10, 37, "green", 0],
            ],
            [
              [7, 36, 3],
              [7, 10, 3],
            ],
          ),
        ],
        120,
      ],
      ["gust", [0, 1, 2, 3].map(gust), 80],
    ],
  ];
  yield [STREAM, [["pulse", [0, 1, 2, 3].map(stream), 80]]];
}

const ONCE = { [EMITTER]: [], [STREAM]: [] };

export const BACKDROPS: Readonly<Record<string, readonly [draw: () => RgbaImage, repeat: string]>> =
  {
    "forest-mid": [forestMid, "x"],
    "forest-mid-birch": [birches, "x"],
    "forest-mid-conifers": [() => conifers(true), "x"],
    "forest-shrub": [shrub, "x"],
    "forest-tree": [tree, "none"],
    "ravine-mid": [ravineMid, "x"],
    "ravine-rock": [rock, "none"],
    "woodland-far": [far, "x"],
    "woodland-far-conifers": [() => conifers(), "x"],
    "woodland-sky": [sky, "x"],
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
function context(skin: "forest" | "ravine"): RgbaImage {
  const im = image(720, 720, PRIMARY);
  for (const key of [
    "woodland-sky",
    "woodland-far",
    skin === "forest" ? "forest-mid" : "ravine-mid",
  ]) {
    const p = readImage(`${BACKDROPS_DIR}/${key}.png`);
    for (let x = 0; x < 720; x += p.width) {
      over([x, BOTTOM - p.height], p, im);
    }
  }
  let ground: string;
  let raised: string;
  if (skin === "forest") {
    over([0, 384], readImage(`${BACKDROPS_DIR}/forest-tree.png`), im);
    for (let x = 120; x < 240; x += 48) {
      over([x, 552], readImage(`${BACKDROPS_DIR}/forest-shrub.png`), im);
    }
    [ground, raised] = ["forest-ground", "root-stack"];
  } else {
    for (let x = 432; x < 672; x += 48) {
      over([x, 528], readImage(`${BACKDROPS_DIR}/ravine-rock.png`), im);
    }
    [ground, raised] = ["ravine-ground", "stone-stack"];
  }
  skinForeground({ tiles: new Map(tiles()), ground, raised }, im);
  return cropBox([0, 360, 720, 720], opaque(im));
}

async function preview(out: string): Promise<void> {
  const sheet = image(1456, 392, "ink");
  (
    [
      ["forest", "Forest paths / earth + roots"],
      ["ravine", "Ravine / bank + stone"],
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
