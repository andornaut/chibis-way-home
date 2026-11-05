/**
 * Apartment environment core, reusable independently of layouts and collision.
 *
 * Usage: node art/tools/apartment.ts build | preview OUT.png, from the repository root. Plain PNGs,
 * no animation. Canonical zone-red dusty rose dominates walls and exterior haze. Existing wood,
 * sage and blue accents only. tiles-apartment: six families apartment-wood/tile/plaster/stone/
 * brick/metal, each seven standard suffixes: top/top-left/top-right/top-joint/face/face-left/
 * face-right. 42 cells, 12px, 8 columns, 96x72. Only safe top cells carry the dark edge and
 * two-pixel white lip. Shared ledges, hazards and movers retain tiles-platforming.
 *
 * Backdrops: apartment-sky 48x720, apartment-far 720x720, apartment-exterior-mid 720x720, all
 * repeat x; apartment-wall-lobby/restaurant/pool/spa/residential 48x144 repeat x; apartment-facade
 * 48x180 repeat x. All bottom-left, default y 720. Near walls/facade align to local floor and move
 * with terrain (factor 1,1). Suggested outdoor factors: sky 0,0 far .15,.05 mid .4,.15. Keep gaps
 * open to the distant layers. Wall names indicate materials, not room behaviour. Pool wall tiles
 * depict no water or hidden danger. No actors, stairs, props, story, route layout or physics. Decor
 * carries no white safe lip or hazard red. Preview assembles short illustrative sections on common
 * geometry, not a validated playable stage.
 *
 * Sprites, for the swinging chandelier (once: none), in brass: tan face, brown and dbrown shade,
 * cream glass. No yellow, gold, orange or round coin-like blob:
 * - apartment-chandelier: 72x24, bottom-centre on a 6x2 footprint, tag idle (2 x 300ms). Rows 0 to 2
 *   are the standable rim top: a navy edge over a 2px white lip across the full width, nothing
 *   above row 0. Below, the tan and brown rim with a dbrown edge, five dbrown-framed cream glass
 *   candle cups with white candles, an elongated cream drop under each cup and four short drops
 *   between them. The second frame moves only cream and white pixels inside the cups.
 * - apartment-chandelier-chain: 6x6, tag idle (1 frame). A dbrown brass link, tan lit top-left,
 *   brown shade, clear 2x2 eye. Placed unrotated from the mount centre to the rim's top centre.
 * - apartment-chandelier-mount: 24x12, bottom-centre on a 2x1 footprint, tag idle (1 frame). A
 *   ceiling rose: a dbrown plate, a stepped tan and brown dome with a dbrown pivot boss on the
 *   sprite centre (12,6) and a hook ring below.
 */

import * as backgroundTones from "./backgroundTones.ts";
import { commands, run } from "./cli.ts";
import {
  backdropEntry,
  BACKDROPS_DIR,
  cropBox,
  image,
  over,
  rect,
  type RgbaImage,
  spriteFrame,
  writeImage,
  writeRgbImage,
} from "./imageArt.ts";
import * as pixel from "./pixel.ts";
import { drawLabel } from "./previewText.ts";
import { THEMES } from "./zoneThemes.ts";

const T = 12;
const TILESET = "tiles-apartment";
const BOTTOM = 720;
const PRIMARY = (THEMES.apartment as { primary: string }).primary;
const SHADE = `${PRIMARY}-shade`;
const NAMES = ["wood", "tile", "plaster", "stone", "brick", "metal"] as const;
const FAMILIES = NAMES.map((name) => `apartment-${name}`);
const SUFFIXES = ["top", "top-left", "top-right", "top-joint", "face", "face-left", "face-right"];
const STYLES = ["lobby", "restaurant", "pool", "spa", "residential"] as const;
const USAGE = "Usage: apartment.ts build | preview OUT.png";

type Name = (typeof NAMES)[number];

function material(name: Name, suffix: string): RgbaImage {
  const fill = {
    wood: "zone-peach-shade",
    tile: "lgrey",
    plaster: SHADE,
    stone: "grey",
    brick: PRIMARY,
    metal: "slate",
  }[name];
  const im = image(T, T, fill);
  if (name === "wood" || name === "brick") {
    rect(name === "wood" ? "brown" : SHADE, [0, 8, 12, 10], im);
  } else if (name === "tile") {
    rect("grey", [0, 10, 12, 12], im);
    rect("grey", [10, 0, 12, 10], im);
  } else if (name === "stone") {
    rect("slate", [0, 10, 12, 12], im);
  } else if (name === "metal") {
    rect("dslate", [0, 8, 12, 10], im);
  }
  if (suffix.endsWith("left")) {
    rect("navy", [0, 0, 2, 12], im);
  }
  if (suffix.endsWith("right")) {
    rect("navy", [10, 0, 12, 12], im);
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
  return NAMES.flatMap((name) =>
    SUFFIXES.map((suffix): [string, RgbaImage] => [
      `apartment-${name}-${suffix}`,
      material(name, suffix),
    ]),
  );
}

function sky(): RgbaImage {
  return image(48, 720, PRIMARY);
}

function far(): RgbaImage {
  const im = image(720, 720);
  for (const [x, width, top] of [
    [-12, 132, 104],
    [158, 100, 54],
    [298, 152, 132],
    [492, 112, 78],
    [642, 96, 112],
  ] as const) {
    rect("zone-peach-shade", [x, top, x + width, 720], im);
    rect("zone-peach-shade", [x + 14, top - 14, x + width - 14, top], im);
    rect("zone-peach-shade", [x + width - 28, top - 28, x + width - 18, top], im);
  }
  return im;
}

function exteriorMid(): RgbaImage {
  const im = image(720, 720);
  for (const [x, width, top] of [
    [24, 162, 162],
    [248, 126, 108],
    [442, 146, 186],
    [636, 72, 138],
  ] as const) {
    rect(SHADE, [x, top, x + width, 720], im);
    rect("zone-peach-shade", [x, top, x + width, top + 8], im);
    rect("zone-peach", [x + 8, top + 8, x + 14, 720], im);
    for (let y = top + 30; y < 690; y += 48) {
      for (let windowX = x + 22; windowX < x + width - 20; windowX += 28) {
        rect(PRIMARY, [windowX, y, windowX + 12, y + 18], im);
      }
    }
  }
  return im;
}

function wall(style: (typeof STYLES)[number]): RgbaImage {
  const im = image(48, 144, PRIMARY);
  rect(SHADE, [0, 0, 48, 6], im);
  rect(SHADE, [0, 132, 48, 144], im);
  if (style === "lobby") {
    rect("zone-peach-shade", [0, 90, 48, 132], im);
    rect("brown", [0, 90, 48, 94], im);
    rect("brown", [22, 94, 24, 132], im);
  } else if (style === "restaurant") {
    rect(SHADE, [0, 84, 48, 132], im);
    rect("zone-peach", [0, 84, 48, 90], im);
    rect(PRIMARY, [4, 100, 44, 124], im);
  } else if (style === "pool") {
    rect("zone-blue", [0, 96, 48, 132], im);
    for (const x of [0, 24]) {
      rect("zone-blue-shade", [x, 96, x + 2, 132], im);
    }
    rect("zone-blue-shade", [0, 112, 48, 114], im);
  } else if (style === "spa") {
    rect("zone-green", [0, 102, 48, 132], im);
    rect("zone-green-shade", [0, 100, 48, 104], im);
    rect(SHADE, [22, 8, 24, 98], im);
  } else {
    rect(SHADE, [0, 98, 48, 132], im);
    rect(PRIMARY, [4, 106, 44, 124], im);
  }
  return im;
}

function facade(): RgbaImage {
  const im = image(48, 180, PRIMARY);
  rect(SHADE, [0, 0, 48, 8], im);
  rect(SHADE, [0, 170, 48, 180], im);
  for (const y of [28, 100]) {
    rect("dslate", [8, y, 40, y + 48], im);
    rect("zone-blue-shade", [11, y + 3, 37, y + 45], im);
    rect("slate", [23, y + 3, 25, y + 45], im);
    rect("slate", [11, y + 24, 37, y + 26], im);
  }
  return im;
}

const CHANDELIER = "apartment-chandelier";
const CHAIN = "apartment-chandelier-chain";
const MOUNT = "apartment-chandelier-mount";
// Candle cup centres: a cup spans x - 4 to x + 3, so the five sit symmetric about the centre line.
const CUPS = [8, 22, 36, 50, 64];

/** The chandelier; flicker moves only cream and white pixels inside the cups. */
function chandelier(flicker: boolean): pixel.Frame {
  const g = new pixel.Grid(72, 24);
  // Brass rim: tan face, brown shade, dbrown bottom and ends, under the standable top.
  g.rect(0, 3, 72, 4, "dbrown");
  g.rect(1, 3, 70, 2, "tan");
  g.rect(1, 5, 70, 1, "brown");
  for (const x of CUPS) {
    g.rect(x - 1, 7, 2, 2, "dbrown");
    g.rect(x - 3, 9, 6, 1, "brown");
    g.rect(x - 4, 10, 8, 4, "dbrown");
    g.rect(x - 3, 10, 6, 4, "cream");
    g.rect(x - 3, 14, 6, 2, "dbrown");
    g.rect(x - 2, 14, 4, 2, "cream");
    g.rect(x - 2, 16, 4, 1, "dbrown");
    g.rect(x - 1, 17, 2, 1, "brown");
    // Candle and flame glow, white on the cream glass.
    g.rect(x - 1, 12, 2, 3, "white");
    if (flicker) {
      g.p(x - 2, 11, "white");
      g.p(x - 1, 12, "cream");
    } else {
      g.p(x, 11, "white");
    }
    // Glass drop under the cup: a brown cap over an elongated cream drop.
    g.rect(x - 1, 18, 2, 1, "dbrown");
    g.rect(x - 1, 19, 2, 4, "cream");
    g.p(x - 1, 19, "white");
    g.rect(x - 1, 23, 2, 1, "brown");
  }
  for (const x of CUPS.slice(0, -1).map((cup) => cup + 7)) {
    g.rect(x - 1, 7, 2, 1, "brown");
    g.rect(x - 1, 8, 2, 3, "cream");
  }
  g.rect(0, 0, 72, 1, "navy");
  g.rect(0, 1, 72, 2, "white");
  return g.px;
}

function chain(): pixel.Frame {
  const g = new pixel.Grid(6, 6);
  g.rect(1, 0, 4, 6, "dbrown");
  g.rect(0, 1, 6, 4, "dbrown");
  g.rect(1, 1, 3, 3, "tan");
  g.rect(4, 1, 1, 4, "brown");
  g.rect(1, 4, 4, 1, "brown");
  g.rect(2, 2, 2, 2, null);
  return g.px;
}

function mount(): pixel.Frame {
  const g = new pixel.Grid(24, 12);
  g.rect(0, 0, 24, 3, "dbrown");
  g.rect(1, 1, 22, 1, "brown");
  for (const [y, inset] of [
    [3, 3],
    [5, 5],
    [7, 8],
  ] as const) {
    g.rect(inset, y, 24 - inset * 2, 2, "dbrown");
    g.rect(inset + 1, y, 11 - inset, 2, "tan");
    g.rect(12, y, 11 - inset, 2, "brown");
  }
  g.rect(5, 3, 3, 1, "cream");
  // Pivot boss on the centre, then the hook ring the chain hangs from.
  g.rect(10, 4, 4, 4, "dbrown");
  g.rect(10, 9, 4, 3, "dbrown");
  g.rect(11, 10, 2, 1, null);
  return g.px;
}

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield [CHANDELIER, [["idle", [chandelier(false), chandelier(true)], 300]]];
  yield [CHAIN, [["idle", [chain()], 1000]]];
  yield [MOUNT, [["idle", [mount()], 1000]]];
}

const ONCE = { [CHANDELIER]: [], [CHAIN]: [], [MOUNT]: [] };

export const BACKDROPS: Readonly<Record<string, readonly [draw: () => RgbaImage, repeat: string]>> =
  {
    "apartment-exterior-mid": [exteriorMid, "x"],
    "apartment-facade": [facade, "x"],
    "apartment-far": [far, "x"],
    "apartment-sky": [sky, "x"],
    ...Object.fromEntries(
      STYLES.map((style) => [`apartment-wall-${style}`, [() => wall(style), "x"] as const]),
    ),
  };

export async function build(): Promise<void> {
  pixel.updateManifest("tilesets", [await pixel.writeTileset({ key: TILESET }, tiles())]);
  const entries = Object.entries(BACKDROPS).map(([key, [draw, repeat]]) => {
    const im = draw();
    writeImage(`${BACKDROPS_DIR}/${key}.png`, backgroundTones.apply(key, im));
    return backdropEntry({ bottom: BOTTOM, repeat }, key, im);
  });
  pixel.updateManifest("backdrops", entries);
  await pixel.build({ once: ONCE }, [...sprites()]);
  console.log("built", TILESET, "and", entries.length, "backdrops");
}

/** Material contact sheet on common illustrative geometry; no route or stair behaviour claim. */
function context(): RgbaImage {
  const im = image(720, 360, PRIMARY);
  over([0, 0], cropBox([0, 360, 720, 720], far()), im);
  over([0, 0], cropBox([0, 360, 720, 720], exteriorMid()), im);
  const labels = ["Lobby", "Restaurant", "Pool", "Spa", "Residential", "Exterior"];
  STYLES.forEach((style, i) => {
    for (let x = i * 120; x < i * 120 + 120; x += 48) {
      const width = Math.min(48, (i + 1) * 120 - x);
      for (const y of [-48, 96]) {
        over([x, y], cropBox([0, 0, width, 144], wall(style)), im);
      }
    }
  });
  over([672, 60], facade(), im);
  const ts = new Map(tiles());
  const tile = (name: string): RgbaImage => ts.get(name) as RgbaImage;
  FAMILIES.forEach((family, i) => {
    for (let y = 240; y < 360; y += 12) {
      for (let x = i * 120; x < (i + 1) * 120; x += 12) {
        over([x, y], tile(`${family}-${y === 240 ? "top" : "face"}`), im);
      }
    }
    for (let x = i * 120 + 48; x < i * 120 + 96; x += 12) {
      over([x, 216], tile(`${family}-top`), im);
      over([x, 228], tile(`${family}-face`), im);
    }
    drawLabel({ x: i * 120 + 4, y: 76, colour: "ink" }, labels[i] as string, im);
  });
  over([12, 198], spriteFrame("bird"), im);
  return im;
}

async function preview(out: string): Promise<void> {
  writeRgbImage(out, context());
}

if (import.meta.main) {
  run(() => commands({ usage: USAGE, build, preview }));
}
