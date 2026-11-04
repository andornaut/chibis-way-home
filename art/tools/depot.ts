/**
 * Static parcel-depot modules in the street's blue-grey palette.
 *
 * Usage: node art/tools/depot.ts build | preview OUT.png, from the repository root. Build writes
 * three plain PNG backdrops and merges their manifest entries. These static backdrops have no
 * sprite sheets, animation tags or collision.
 *
 * - depot-wall: 48x180, repeat x, bottom-left y 600. Corrugated slate wall, subdued grey ribs and
 *   dark base.
 * - depot-loading-bay: 120x120, no repeat, bottom-left y 600. Raised roller shutter over a dark
 *   opening, with a cream parcel icon on a navy plaque. The opening is scenery, not a room door or
 *   a platform.
 * - parcel-open: 72x36, no repeat, bottom-left y 600. Warm cardboard with open side flaps, a dark
 *   interior and a brown front, behind the cream bird. Nonlethal scenery, with no light walkable
 *   lip.
 *
 * All three share the gameplay plane's scroll factor (1, 1). Positions and terrain belong to game
 * data. The illustrative preview uses a 720px depot wall, one bay at x 360, the parcel at x 24 and
 * ground y 600. It shows the bird at centre x 60, then clear of the parcel at centre x 132. It
 * makes no physics claim.
 */

import { opaque, paste } from "@andornaut/art-kit/raster";

import * as backgroundTones from "./backgroundTones.ts";
import { commands, run } from "./cli.ts";
import * as floor1 from "./floor1.ts";
import {
  backdropEntry,
  BACKDROPS_DIR,
  cropBox,
  frameImage,
  image,
  line,
  over,
  polygon,
  readImage,
  rectangle,
  type RgbaImage,
  spriteFrame,
  writeImage,
  writeRgbImage,
  type XY,
} from "./imageArt.ts";
import * as pixel from "./pixel.ts";
import { drawLabel } from "./previewText.ts";

const FLOOR_Y = 600;
const USAGE = "Usage: depot.ts build | preview OUT.png";

function wall(): RgbaImage {
  const im = image(48, 180);
  rectangle("slate", [0, 0, 47, 179], im);
  for (const x of [0, 16, 32]) {
    rectangle("dslate", [x, 5, x + 1, 179], im);
    rectangle("grey", [x + 2, 5, x + 3, 179], im);
  }
  rectangle("dslate", [0, 0, 47, 7], im);
  rectangle("grey", [0, 2, 47, 3], im);
  rectangle("dslate", [0, 172, 47, 179], im);
  return im;
}

function loadingBay(): RgbaImage {
  const im = image(120, 120);
  rectangle("slate", [0, 0, 119, 119], im);
  rectangle("navy", [4, 28, 115, 119], im);
  rectangle("dslate", [8, 32, 111, 119], im);
  rectangle("navy", [8, 100, 111, 119], im);
  rectangle("grey", [4, 24, 115, 49], im);
  for (const y of [28, 36, 44]) {
    rectangle("slate", [6, y, 113, y + 1], im);
  }
  rectangle("dslate", [0, 24, 5, 119], im);
  rectangle("dslate", [114, 24, 119, 119], im);
  rectangle("grey", [4, 112, 9, 119], im);
  rectangle("grey", [110, 112, 115, 119], im);
  rectangle("navy", [40, 0, 79, 23], im);
  const [x, y] = [50, 1];
  line(
    { colour: "cream", width: 2 },
    [
      [x, y + 4],
      [x + 10, y],
      [x + 20, y + 4],
      [x + 10, y + 9],
      [x, y + 4],
      [x, y + 16],
      [x + 10, y + 21],
      [x + 20, y + 16],
      [x + 20, y + 4],
    ],
    im,
  );
  line(
    { colour: "cream", width: 2 },
    [
      [x + 10, y + 9],
      [x + 10, y + 21],
    ],
    im,
  );
  return im;
}

function parcel(): RgbaImage {
  const im = image(72, 36);
  polygon(
    { colour: "dbrown" },
    [
      [9, 12],
      [17, 4],
      [55, 4],
      [63, 12],
      [63, 34],
      [9, 34],
    ],
    im,
  );
  polygon(
    { colour: "plum" },
    [
      [12, 12],
      [18, 7],
      [54, 7],
      [60, 12],
      [54, 19],
      [18, 19],
    ],
    im,
  );
  polygon(
    { colour: "tan", outline: "dbrown" },
    [
      [9, 12],
      [0, 4],
      [8, 1],
      [25, 10],
      [18, 19],
    ],
    im,
  );
  polygon(
    { colour: "tan", outline: "dbrown" },
    [
      [63, 12],
      [71, 3],
      [62, 0],
      [47, 10],
      [54, 19],
    ],
    im,
  );
  polygon(
    { colour: "brown", outline: "dbrown" },
    [
      [10, 20],
      [35, 24],
      [61, 20],
      [61, 34],
      [10, 34],
    ],
    im,
  );
  rectangle("tan", [32, 24, 36, 33], im);
  rectangle("cream", [15, 24, 24, 28], im);
  return im;
}

export function assets(): Record<string, readonly [image: RgbaImage, repeat: string]> {
  return {
    "depot-loading-bay": [loadingBay(), "none"],
    "depot-wall": [wall(), "x"],
    "parcel-open": [parcel(), "none"],
  };
}

export function build(): void {
  const entries = Object.entries(assets()).map(([key, [im, repeat]]) => {
    writeImage(`${BACKDROPS_DIR}/${key}.png`, backgroundTones.apply(key, im));
    return backdropEntry({ bottom: FLOOR_Y, repeat }, key, im);
  });
  pixel.updateManifest("backdrops", entries);
  console.log("built", Object.keys(assets()).join(", "));
}

/** Runs of a street backdrop from x0 to x1 standing on y, cropped at x1. */
function streetRuns(
  runs: readonly (readonly [key: string, x0: number, x1: number, y: number])[],
  im: RgbaImage,
): void {
  for (const [key, x0, x1, y] of runs) {
    const def = floor1.BACKDROP_DEFS.get(key);
    if (!def) {
      throw new Error(`floor1 has no backdrop ${key}`);
    }
    const p = frameImage(def[0]().px);
    for (let x = x0; x < x1; x += p.width) {
      const q = cropBox([0, 0, Math.min(p.width, x1 - x), p.height], p);
      over([x, y - q.height], q, im);
    }
  }
}

function context(birdCentre = 60): RgbaImage {
  const im = image(720, 720, "lgrey");
  streetRuns(
    ["street-sky", "street-city-far", "street-city-mid"].map(
      (key) => [key, 0, 720, FLOOR_Y] as const,
    ),
    im,
  );
  const wallIm = readImage(`${BACKDROPS_DIR}/depot-wall.png`);
  const bayIm = readImage(`${BACKDROPS_DIR}/depot-loading-bay.png`);
  const parcelIm = readImage(`${BACKDROPS_DIR}/parcel-open.png`);
  for (let x = 0; x < 720; x += wallIm.width) {
    over([x, FLOOR_Y - wallIm.height], wallIm, im);
  }
  over([360, FLOOR_Y - bayIm.height], bayIm, im);
  const tiles = new Map(
    floor1.streetTilesCool()[0].map(([name, g]) => [name, frameImage(g.px)] as const),
  );
  for (let row = 50; row < 60; row++) {
    for (let col = 0; col < 60; col++) {
      const key = row === 50 ? (col % 2 ? "sidewalk-top-joint" : "sidewalk-top") : "sidewalk-face";
      over([col * 12, row * 12], tiles.get(key) as RgbaImage, im);
    }
  }
  over([24, FLOOR_Y - parcelIm.height], parcelIm, im);
  const bird = spriteFrame("bird");
  const at: XY = [birdCentre - Math.floor(bird.width / 2), FLOOR_Y - bird.height];
  over(at, bird, im);
  return opaque(im);
}

function preview(out: string): void {
  const sheet = image(1456, 752, "ink");
  (
    [
      [60, "Start: parcel x24, bird centre x60"],
      [132, "Bird clear of the opened parcel"],
    ] as const
  ).forEach(([centre, label], i) => {
    const x = 8 + i * 728;
    drawLabel({ x, y: 6, colour: "cream" }, label, sheet);
    paste({ at: { x, y: 28 } }, context(centre), sheet);
  });
  writeRgbImage(out, sheet);
}

if (import.meta.main) {
  run(() => commands({ usage: USAGE, build, preview }));
}
