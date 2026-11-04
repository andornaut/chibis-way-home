/**
 * Achievement art: the nav icon and one glyph per achievement.
 *
 * Usage: node art/tools/achievementIcons.ts build | preview OUT.png, from the repository root.
 * preview writes the review board: every achievement unlocked and locked at 1x on navy and lgrey
 * and at 4x on navy, labelled with its ID in font-body, and the nav icon at 1x and 4x on the nav
 * button's dslate face.
 *
 * - icon-achievements, 20x20, one tag rest (100ms): the nav icon, a trophy cup with two handles, a
 *   stem and a stepped foot, cream with tan on its lower-right edges and no outline, like
 *   icon-home-nav. It goes in ui-icon-button at button + (8,6), or (8,8) pressed.
 * - icon-achievement, 16x16: one tag per achievement ID, in ACHIEVEMENTS order. Each tag has frame
 *   0 unlocked (full colour, ink outlines) and frame 1 locked (the same alpha geometry in flat
 *   grey, the muted skill glyphs' colour), 100ms each, looping. Transparent ground, no contact box,
 *   hit box or slice. The game picks a tag by ID and a frame by state; nothing is tinted at runtime.
 *
 * Families, each with a silhouette that survives the flat locked fill:
 * - escape-<boss>: the boss's head (HEADS) with an amber exit arrow at the lower right.
 * - clean-<boss>: the same head over a green laurel wreath open at the top.
 * - zone-<zone>: the zone's emblem (EMBLEMS) in its zone primary and shade, outlined ink, with ink
 *   and dslate details. Fence gaps and apartment windows are transparent, so they hold when locked.
 * - spotless-<zone>: the same emblem with a yellow sparkle at each upper corner.
 * - all-gifts: a red gift box with a yellow ribbon and bow.
 * - just-a-bird: Chibi, cream with an orange bill, facing a small zone-peach house.
 * Every part carries its own ink outline. An overlaid part (arrow, laurel, sparkle, house) knocks a
 * 1px transparent gap out of what it covers, so the parts stay separate shapes when locked.
 */

import { composite, filledImage, resizeNearest } from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { commands, run } from "./cli.ts";
import { frameImage, writeRgbImage } from "./imageArt.ts";
import * as pixel from "./pixel.ts";
import { drawLabel } from "./previewText.ts";

type Boss = "archie" | "bini" | "fert" | "kiwi" | "pebble" | "trixi";
type Zone =
  | "apartment-building"
  | "blue-cityscape"
  | "countryside"
  | "home-city"
  | "industrial-outskirts"
  | "woodland";
type Art =
  | readonly ["escape" | "clean", Boss]
  | readonly ["zone" | "spotless", Zone]
  | readonly ["all-gifts" | "just-a-bird"];

/** Achievement ID, what earns it and its art, in tag order. */
export const ACHIEVEMENTS: readonly (readonly [id: string, earns: string, art: Art])[] = [
  ["escape-archie", "First escape from Archie the dog", ["escape", "archie"]],
  ["escape-pebble", "First escape from Pebble the pigeon", ["escape", "pebble"]],
  ["escape-trixi", "First escape from Trixi the goose", ["escape", "trixi"]],
  ["escape-bini", "First escape from Bini the bear", ["escape", "bini"]],
  ["escape-kiwi", "First escape from Kiwi the raccoon", ["escape", "kiwi"]],
  ["escape-fert", "First escape from Fert the ferret", ["escape", "fert"]],
  ["clean-archie", "Archie's third stage cleared without dying", ["clean", "archie"]],
  ["clean-pebble", "Pebble's third stage cleared without dying", ["clean", "pebble"]],
  ["clean-trixi", "Trixi's third stage cleared without dying", ["clean", "trixi"]],
  ["clean-bini", "Bini's third stage cleared without dying", ["clean", "bini"]],
  ["clean-kiwi", "Kiwi's third stage cleared without dying", ["clean", "kiwi"]],
  ["clean-fert", "Fert's third stage cleared without dying", ["clean", "fert"]],
  ["zone-blue-cityscape", "Blue cityscape cleared", ["zone", "blue-cityscape"]],
  ["zone-industrial-outskirts", "Industrial outskirts cleared", ["zone", "industrial-outskirts"]],
  ["zone-countryside", "Countryside cleared", ["zone", "countryside"]],
  ["zone-woodland", "Woodland cleared", ["zone", "woodland"]],
  ["zone-home-city", "Home city cleared", ["zone", "home-city"]],
  ["zone-apartment-building", "Apartment building cleared", ["zone", "apartment-building"]],
  ["all-gifts", "Own Dash, Double jump and Speedy", ["all-gifts"]],
  [
    "spotless-blue-cityscape",
    "Every Blue cityscape stage in one run with no deaths",
    ["spotless", "blue-cityscape"],
  ],
  [
    "spotless-industrial-outskirts",
    "Every Industrial outskirts stage in one run with no deaths",
    ["spotless", "industrial-outskirts"],
  ],
  [
    "spotless-countryside",
    "Every Countryside stage in one run with no deaths",
    ["spotless", "countryside"],
  ],
  ["spotless-woodland", "Every Woodland stage in one run with no deaths", ["spotless", "woodland"]],
  [
    "spotless-home-city",
    "Every Home city stage in one run with no deaths",
    ["spotless", "home-city"],
  ],
  [
    "spotless-apartment-building",
    "Every Apartment stage in one run with no deaths",
    ["spotless", "apartment-building"],
  ],
  ["just-a-bird", "Get home without ever selecting a skill", ["just-a-bird"]],
];

const SRC = "art/ui";
const ICON = "icon-achievement";
const NAV = "icon-achievements";
const SIDE = 16;
const LOCKED = "grey";
const USAGE = "Usage: achievementIcons.ts build | preview OUT.png";

type Legend = Readonly<Record<string, string>>;
/** Rows of legend characters; "." is transparent. */
type Bitmap = readonly string[];

// ---------------------------------------------------------------- parts

// Shared legend letters: k ink, w white, y yellow, a amber, g green, G dgreen.
const SHARED: Legend = {
  k: "ink",
  w: "white",
  y: "yellow",
  a: "amber",
  o: "orange",
  g: "green",
  G: "dgreen",
};

interface Part {
  rows: Bitmap;
  legend: Legend;
}

const HEADS: Readonly<Record<Boss, Part>> = {
  // brown with dark rose ears, a white blaze and muzzle, an ink nose and the red bandana
  archie: {
    legend: { b: "brown", d: "dbrown", l: "lgrey", r: "red", R: "dred" },
    rows: [
      ".kk......kk.",
      "kddk....kddk",
      "kdbbkkkkbbdk",
      "kbbbbwwbbbbk",
      "kbkbbwwbbkbk",
      "kbkbwwwwbkbk",
      "kbbwwkkwwbbk",
      ".kbwwwwwwbk.",
      ".krrrrrrrrk.",
      "..krrrrrRk..",
      "...krrRRk...",
      "....kkkk....",
    ],
  },
  // a round grey head facing right, a short brown bill and the purple neck
  pebble: {
    legend: { g: "grey", s: "slate", l: "lgrey", b: "brown", p: "zone-purple-shade", w: "white" },
    rows: [
      "...kkkkk....",
      "..kllgggk...",
      ".klggggggk..",
      ".kgggggkwgk.",
      "kggggggkkgkk",
      "kgggggggggbk",
      "kgggggggskk.",
      "kpggggggsk..",
      "kppgggggsk..",
      "kpppppsssk..",
      ".kpppppssk..",
      "..kkkkkkk...",
    ],
  },
  // cream feathers, the oversized round glasses, an orange bill and the long neck
  trixi: {
    legend: { c: "cream", l: "lgrey", o: "orange", h: "ochre", w: "white" },
    rows: [
      "..kkkkkk.....",
      ".kcccccck....",
      "kckkcckkck...",
      "kkwlkkwlkkkk.",
      "kklkkklkkoook",
      "kckkcckkkhhk.",
      ".kcccccckk...",
      "..kccclk.....",
      "..kccclk.....",
      "..kccclk.....",
      "..kccclk.....",
      "..kkkkkk.....",
    ],
  },
  // dark brown, facing right: round ears, a cream muzzle and an ink nose
  bini: {
    legend: { d: "dbrown", p: "plum", b: "brown", c: "cream", t: "tan" },
    rows: [
      ".kkk...kkk...",
      "kdpdk.kdpdk..",
      "kdddkkkdddk..",
      "kbdddddddddk.",
      "kbdddkdddddk.",
      "kddddddccccck",
      "kddddddcccckk",
      "kddddddccctk.",
      ".kdddddtttk..",
      "..kkkkkkkk...",
    ],
  },
  // grey with rounded ears, the paired ink mask with white glints, a cream band and pointed
  // cheeks
  kiwi: {
    legend: { g: "grey", s: "slate", l: "lgrey", c: "cream", w: "white" },
    rows: [
      ".kk......kk.",
      "kgsk....ksgk",
      "kggkkkkkkggk",
      "kggggssggggk",
      "kcccgssgccck",
      "kkkkkggkkkkk",
      "kkwkkggkkwkk",
      "kkkkccccckkk",
      "kgccckkcccgk",
      ".kgccccccgk.",
      "..kggggggk..",
      "...kkkkkk...",
    ],
  },
  // the plum top hat with its red band over a champagne head facing right, the white mask band
  // and a pink nose
  fert: {
    legend: { h: "plum", d: "dbrown", r: "red", s: "skin1", t: "skin2", w: "white", p: "pink" },
    rows: [
      "...kkkkk....",
      "...kdhhk....",
      "...kdhhk....",
      "...krrrk....",
      ".kkkkkkkkk..",
      "..ksswwwsk..",
      ".kssskwwwkk.",
      ".ksssswwwwpk",
      ".ktsssswwkk.",
      ".kttsssskk..",
      "..kttsssk...",
      "...kkkkk....",
    ],
  },
};

/** The exit arrow, amber, pointing right. */
const ARROW: Part = {
  legend: {},
  rows: [".kk...", "kaak..", "kaaak.", ".kaaak", "kaaak.", "kaak..", ".kk..."],
};

/** Two laurel sprigs curving up from the foot, open at the top. */
const LAUREL: Part = {
  legend: {},
  rows: [
    "k..............k",
    "kk............kk",
    "kgk..........kgk",
    "kGgk........kgGk",
    "kgGk........kGgk",
    ".kGgk......kgGk.",
    "..kGgk....kgGk..",
    "...kkGgkkgGkk...",
    ".....kkkkkk.....",
  ],
};

/** A four-point sparkle. */
const SPARKLE: Part = {
  legend: {},
  rows: ["..k..", ".kyk.", "kyyyk", ".kyk.", "..k.."],
};

const ZONE_PRIMARY: Readonly<Record<Zone, string>> = {
  "apartment-building": "zone-red",
  "blue-cityscape": "zone-blue",
  countryside: "zone-yellow",
  "home-city": "zone-peach",
  "industrial-outskirts": "zone-purple",
  woodland: "zone-green",
};

// p is the zone primary, s its shade, d dslate detail.
const EMBLEMS: Readonly<Record<Zone, Bitmap>> = {
  // three towers of different heights with ink windows
  "blue-cityscape": [
    ".....kk.....",
    "....kppk....",
    "....kppk....",
    "...kkppkk...",
    "...kpkpsk.kk",
    "kkkkppppkkpk",
    "kppkpkpskpsk",
    "kpskppppkksk",
    "kppkpkpskpsk",
    "kpskppppkpsk",
    "kppkppppkpsk",
    "kkkkkkkkkkkk",
  ],
  // a sawtooth factory with a tall chimney and a puff of smoke
  "industrial-outskirts": [
    ".......kkk..",
    "......klllk.",
    ".......kkkk.",
    "........kpk.",
    "........kpk.",
    "k...k...kpk.",
    "kk..kk..kpk.",
    "kpk.kpk.kpk.",
    "kppkkppkkpk.",
    "kpppppppppk.",
    "kpkkpkkppsk.",
    "kpkkpkkppsk.",
    "kkkkkkkkkkk.",
  ],
  // a picket fence before a wheat field
  countryside: [
    "..k...k...k.",
    ".kpk.kpk.kpk",
    ".kpk.kpk.kpk",
    "kkpkkkpkkkpk",
    "kppppppppppk",
    "kkpkkkpkkkpk",
    ".kpk.kpk.kpk",
    "kkpkkkpkkkpk",
    "kppppppppppk",
    "kkpkkkpkkkpk",
    ".kpk.kpk.kpk",
    ".kkk.kkk.kkk",
  ],
  // a conifer on a short trunk
  woodland: [
    ".....kk.....",
    "....kppk....",
    "...kppppk...",
    "..kpppppsk..",
    "...kppppk...",
    "..kppppppk..",
    ".kpppppppsk.",
    "..kppppppk..",
    ".kppppppppk.",
    "kpppppppppsk",
    "kkkkkddkkkkk",
    ".....kdk....",
    ".....kkk....",
  ],
  // a pitched-roof house with a chimney, a window and a door
  "home-city": [
    "........kk..",
    ".....kk.kpk.",
    "....kppkkpk.",
    "...kppppkpk.",
    "..kppppppsk.",
    ".kppppppppsk",
    "kkkppppppkkk",
    "..kpkkppppk.",
    "..kpkkpkkpk.",
    "..kpppkkkpk.",
    "..kpppkkkpk.",
    "..kkkkkkkkk.",
  ],
  // a tall apartment block under a dslate cornice, with open windows and an ink door
  "apartment-building": [
    "kkkkkkkkkkkk",
    "kddddddddddk",
    "kkkkkkkkkkkk",
    ".kpppppppsk.",
    ".kp..p..psk.",
    ".kp..p..psk.",
    ".kpppppppsk.",
    ".kp..p..psk.",
    ".kp..p..psk.",
    ".kpppppppsk.",
    ".kppkkpppsk.",
    ".kppkkpppsk.",
    ".kkkkkkkkkk.",
  ],
};

/** A gift box with a ribbon and bow. */
const GIFT: Part = {
  legend: { r: "red", R: "dred", c: "cream", t: "tan" },
  rows: [
    "...kk..kk...",
    "..kyykkyyk..",
    "..kyakkayk..",
    "kkkkkyykkkkk",
    "krrrryyrrrRk",
    "kkkkkyykkkkk",
    ".krrryyrrRk.",
    ".krrryyrrRk.",
    ".krrryyrrRk.",
    ".kRRRyaRRRk.",
    ".kkkkkkkkkk.",
  ],
};

/** Chibi facing right: the round cream head, an orange bill, a tan wing and the tail tip. */
const BIRD: Part = {
  legend: { c: "cream", t: "tan" },
  rows: [
    "....kkkk...",
    "...kcccck..",
    "...kcckcck.",
    "...kcccckkk",
    "k..kccccook",
    "kk.kcccckkk",
    "kckkcccctk.",
    "kccccccctk.",
    ".kcttttctk.",
    "..kkkkkkk..",
  ],
};

/** A small house with a door. */
const HOUSE: Part = {
  legend: { p: "zone-peach", s: "zone-peach-shade" },
  rows: ["...kk...", "..kppk..", ".kppppk.", "kppppppk", ".kpkkpk.", ".kpkkpk.", ".kkkkkk."],
};

// ---------------------------------------------------------------- composition

function partFrame(part: Part): pixel.Frame {
  const legend = { ...SHARED, ...part.legend };
  return part.rows.map((row) =>
    [...row].map((ch) => {
      if (ch === ".") return null;
      const colour = legend[ch];
      if (colour === undefined) throw new Error(`no colour for ${ch}`);
      return pixel.hexc(colour);
    }),
  );
}

/**
 * Put part's frame on frame with its top-left at x, y. With knock, every frame pixel within one
 * pixel (8 neighbours) of the part's ink that the part does not cover turns transparent first.
 */
function place(
  { knock = false, x, y }: { x: number; y: number; knock?: boolean },
  part: pixel.Frame,
  frame: pixel.Frame,
): void {
  const at = (px: number, py: number): boolean =>
    Boolean(part[py - y]?.[px - x]) && px - x >= 0 && py - y >= 0;
  if (knock)
    for (let py = 0; py < SIDE; py++)
      for (let px = 0; px < SIDE; px++) {
        if (at(px, py)) continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++)
          for (let dx = -1; dx <= 1 && !near; dx++) near = at(px + dx, py + dy);
        if (near) (frame[py] as pixel.Frame[number])[px] = null;
      }
  part.forEach((row, j) =>
    row.forEach((colour, i) => {
      const px = x + i;
      const py = y + j;
      if (colour && px >= 0 && px < SIDE && py >= 0 && py < SIDE)
        (frame[py] as pixel.Frame[number])[px] = colour;
    }),
  );
}

function blank(): pixel.Frame {
  return new pixel.Grid(SIDE, SIDE).px;
}

function emblem(zone: Zone): Part {
  const p = ZONE_PRIMARY[zone];
  return { legend: { p, s: `${p}-shade`, d: "dslate", l: "lgrey" }, rows: EMBLEMS[zone] };
}

/** The part centred horizontally with its bottom on row bottom. */
function centred(part: pixel.Frame, bottom = SIDE): { x: number; y: number } {
  const w = (part[0] ?? []).length;
  return { x: Math.floor((SIDE - w) / 2), y: bottom - part.length };
}

function unlocked(art: Art): pixel.Frame {
  const f = blank();
  if (art[0] === "escape") {
    place({ x: 0, y: 0 }, partFrame(HEADS[art[1]]), f);
    place({ knock: true, x: 10, y: 9 }, partFrame(ARROW), f);
  } else if (art[0] === "clean") {
    const head = partFrame(HEADS[art[1]]);
    place(centred(head, 13), head, f);
    place({ knock: true, x: 0, y: 7 }, partFrame(LAUREL), f);
  } else if (art[0] === "zone" || art[0] === "spotless") {
    const e = partFrame(emblem(art[1]));
    place(centred(e, 15), e, f);
    if (art[0] === "spotless") {
      place({ knock: true, x: 0, y: 0 }, partFrame(SPARKLE), f);
      place({ knock: true, x: 11, y: 0 }, partFrame(SPARKLE), f);
    }
  } else if (art[0] === "all-gifts") {
    const gift = partFrame(GIFT);
    place(centred(gift, 14), gift, f);
  } else {
    place({ x: 0, y: 3 }, partFrame(BIRD), f);
    place({ knock: true, x: 8, y: 8 }, partFrame(HOUSE), f);
  }
  return f;
}

/** The same alpha geometry in one flat grey. */
function locked(frame: pixel.Frame): pixel.Frame {
  const grey = pixel.hexc(LOCKED);
  return frame.map((row) => row.map((colour) => (colour ? grey : null)));
}

// a is cream, o tan on the lower-right edges, as icon-home-nav
const TROPHY_20 = [
  "..aaaaaaaaaaao..",
  "aaaaaaaaaaaaaooo",
  "a..aaaaaaaaao..o",
  "a..aaaaaaaaao..o",
  ".a.aaaaaaaaao.o.",
  "..aaaaaaaaaaoo..",
  "....aaaaaaao....",
  ".....aaaaao.....",
  "......aaao......",
  "......aaao......",
  "......aaao......",
  ".....aaaaao.....",
  "....aaaaaaao....",
  "...aaaaaaaaao...",
  "...oooooooooo...",
];

function trophy(): pixel.Frame {
  const g = new pixel.Grid(20, 20);
  const x0 = Math.floor((20 - (TROPHY_20[0] as string).length) / 2);
  const y0 = Math.floor((20 - TROPHY_20.length) / 2);
  TROPHY_20.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== ".") g.p(x0 + x, y0 + y, ch === "a" ? "cream" : "tan");
    }),
  );
  return g.px;
}

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield [NAV, [["rest", [trophy()], 100]]];
  yield [
    ICON,
    ACHIEVEMENTS.map(([id, , art]) => {
      const f = unlocked(art);
      return [id, [f, locked(f)], 100] as const;
    }),
  ];
}

// ---------------------------------------------------------------- review board

const ZOOM = 4;
const GAP = 8;
const LABEL_W = 232;
const CELL_W = LABEL_W + 4 * (SIDE + GAP) + 2 * (SIDE * ZOOM + GAP) + GAP;
const CELL_H = SIDE * ZOOM + 2 * GAP;
const COLUMNS = 2;

function well(colour: string, at: { x: number; y: number }, im: RgbaImage, sheet: RgbaImage): void {
  composite(
    { x: at.x - 2, y: at.y - 2 },
    filledImage([...pixel.rgb(colour), 255], im.width + 4, im.height + 4),
    sheet,
  );
  composite(at, im, sheet);
}

function preview(out: string): void {
  const rows = Math.ceil(ACHIEVEMENTS.length / COLUMNS);
  const top = 20 * ZOOM + 3 * GAP;
  const sheet = filledImage(
    [...pixel.rgb("ink"), 255],
    COLUMNS * CELL_W + GAP,
    top + rows * CELL_H + GAP,
  );
  const nav = frameImage(trophy());
  drawLabel({ colour: "cream", x: GAP, y: GAP }, NAV, sheet);
  well("dslate", { x: LABEL_W, y: GAP }, nav, sheet);
  well(
    "dslate",
    { x: LABEL_W + 20 + 2 * GAP, y: GAP },
    resizeNearest(20 * ZOOM, 20 * ZOOM, nav),
    sheet,
  );
  ACHIEVEMENTS.forEach(([id, , art], i) => {
    const x0 = GAP + Math.floor(i / rows) * CELL_W;
    const y0 = top + (i % rows) * CELL_H;
    const frames = [unlocked(art)];
    frames.push(locked(frames[0] as pixel.Frame));
    const ims = frames.map(frameImage);
    drawLabel({ colour: "cream", x: x0, y: y0 + GAP + 22 }, id, sheet);
    let x = x0 + LABEL_W;
    const midY = y0 + GAP + (SIDE * ZOOM - SIDE) / 2;
    for (const ground of ["navy", "lgrey"])
      for (const im of ims) {
        well(ground, { x, y: midY }, im, sheet);
        x += SIDE + GAP;
      }
    x += GAP;
    for (const im of ims) {
      well("navy", { x, y: y0 + GAP }, resizeNearest(SIDE * ZOOM, SIDE * ZOOM, im), sheet);
      x += SIDE * ZOOM + GAP;
    }
  });
  writeRgbImage(out, sheet);
}

async function build(): Promise<void> {
  await pixel.build({ srcDir: SRC }, [...sprites()]);
}

if (import.meta.main) run(() => commands({ usage: USAGE, build, preview }));
