/**
 * Reusable woodland appearance skins.
 *
 * Usage: node art/tools/woodland.ts build | preview OUT.png, from the repository root. Plain PNG,
 * no animations. Canonical woodland zone-green and shade, existing house palette only.
 * tiles-woodland: 12px, eight columns, 28 cells in 96x48. Families forest-ground/root-stack/
 * ravine-ground/stone-stack each use top/top-left/top-right/top-joint/face/face-left/face-right.
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
  skinForeground,
  writeImage,
  writeRgbImage,
} from "./imageArt.ts";
import * as nature from "./nature.ts";
import * as pixel from "./pixel.ts";
import { mod } from "./pixel.ts";
import { drawLabel } from "./previewText.ts";
import { THEMES } from "./zoneThemes.ts";

const T = 12;
const TILESET = "tiles-woodland";
const BOTTOM = 600;
const PRIMARY = (THEMES.woodland as { primary: string }).primary;
const SHADE = `${PRIMARY}-shade`;
const FAMILIES = ["forest-ground", "root-stack", "ravine-ground", "stone-stack"] as const;
const SUFFIXES = ["top", "top-left", "top-right", "top-joint", "face", "face-left", "face-right"];
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
  if (suffix.startsWith("top")) {
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
  return FAMILIES.flatMap((family) =>
    SUFFIXES.map((suffix): [string, RgbaImage] => [
      `${family}-${suffix}`,
      material(family, suffix),
    ]),
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
