/**
 * Reusable countryside appearance skins, independent of layouts, collision and zone assignment.
 *
 * Usage: node art/tools/countryside.ts build | preview OUT.png, from the repository root. Plain PNG,
 * no animation. Canonical countryside zone-yellow and its shade supply wheat atmosphere. Existing
 * house colours supply outlines, quiet foliage and water. No palette changes. Water is distant
 * decoration, not a hazard surface.
 *
 * tiles-countryside: 12px, eight columns, 28 cells, 96x48. Families country-ground, hay-stack,
 * riverbank, timber-crossing each use top/top-left/top-right/top-joint/face/face-left/face-right.
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
 */

import { opaque } from "@andornaut/art-kit/raster";

import * as backgroundTones from "./backgroundTones.ts";
import { commands, run } from "./cli.ts";
import {
  backdropEntry,
  BACKDROPS_DIR,
  canvasOf,
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
  if (suffix.startsWith("top")) {
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

export const BACKDROPS: Readonly<Record<string, readonly [draw: () => RgbaImage, repeat: string]>> =
  {
    "countryside-far": [far, "x"],
    "countryside-sky": [sky, "x"],
    "farmland-barn": [barn, "none"],
    "farmland-fence": [fence, "x"],
    "farmland-mid": [farmlandMid, "x"],
    "river-mid": [riverMid, "x"],
    "river-reeds": [reeds, "x"],
  };

export async function build(): Promise<void> {
  const entry = await pixel.writeTileset(
    { key: TILESET },
    tiles().map(([name, tile]) => [name, canvasOf(tile)] as const),
  );
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
