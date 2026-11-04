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
 * - parcel-open: 72x36, no repeat, bottom-left y 600. An opened cardboard box in three-quarter view
 *   from above and in front, lit from the top left, behind the cream bird. Tan flaps with cream lit
 *   edges: the back flap leans back, the side flaps splay out and the front flap folds down over
 *   the brown front face, casting a dark-brown line. A tan rim encloses a dark-brown and plum
 *   interior; the right side is dark brown. Cream tape, torn at the rim, and a cream label with two
 *   marks. Ink outline and a flat bottom row. Nonlethal scenery, with no light walkable lip or red
 *   band.
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

/** Fill each quadrilateral, its corners in order round its edge, with its colour on g. */
function quads(
  list: readonly (readonly [colour: string, corners: readonly [XY, XY, XY, XY]])[],
  g: pixel.Grid,
): void {
  for (const [colour, [a, b, c, d]] of list) {
    g.tri(a, b, c, colour);
    g.tri(a, c, d, colour);
  }
}

/** The opened box: front face x 12 to 49 over rows 18 to 34, the opening 8px deep behind it. */
function parcel(): RgbaImage {
  const g = new pixel.Grid(72, 36);
  const [left, right, top, depth] = [12, 49, 18, 8];
  const [back, width] = [top - depth, right - left + 1];
  const backLeft: XY = [left + depth, back];
  const backRight: XY = [right + depth, back];
  // The back flap leans back from the back rim; the side flaps splay out from the side rims. Each
  // has a lit top edge.
  quads(
    [
      ["tan", [backLeft, backRight, [right + depth + 3, back - 7], [left + depth + 3, back - 7]]],
      ["tan", [[left, top], backLeft, [9, 2], [1, 10]]],
      ["cream", [backLeft, [9, 2], [8, 4], [left + depth - 1, back + 2]]],
      ["tan", [[right, top], backRight, [70, 6], [62, 14]]],
      ["cream", [backRight, [70, 6], [69, 8], [right + depth - 1, back + 2]]],
    ],
    g,
  );
  g.rect(left + depth + 3, back - 7, width, 1, "cream");
  // Box: the front face, the shaded right side and the opening inside the rim.
  g.rect(left, top, width, 35 - top, "brown");
  for (let k = 1; k <= depth; k++) {
    const y = top - k;
    g.rect(right + k, y, 1, 35 - top, "dbrown");
    g.rect(left + k, y, width, 1, k > depth / 2 ? "dbrown" : "plum");
    g.p(left + k, y, "tan");
    g.p(right + k, y, "tan");
  }
  g.rect(left + depth, back, width, 1, "tan");
  // Front flap folded down over the face, its lit fold on the rim and its shadow below.
  g.rect(left, top, width, 1, "cream");
  g.rect(left, top + 1, width, 4, "tan");
  g.rect(left, top + 5, width, 1, "dbrown");
  // Packing tape down the centre, torn where the box was opened.
  g.rect(29, top - 2, 2, 2, "cream");
  g.rect(31, top - 1, 2, 1, "cream");
  g.rect(29, top + 1, 4, 4, "cream");
  g.rect(29, top + 6, 4, 6, "cream");
  // Shipping label with two marks.
  g.rect(37, 27, 9, 6, "cream");
  g.rect(39, 28, 5, 1, "dbrown");
  g.rect(39, 30, 3, 1, "dbrown");
  return frameImage(g.outlined({ edge: () => pixel.hex("ink") }));
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
