/**
 * The retained character catalogue for rooms and reference, at outdoor scale beside the bird.
 *
 * These assets have no current world placements. Friendly background flavour requires a muted
 * palette; friendly animals never appear in the foreground.
 *
 * Usage, from the repository root:
 *   node art/tools/cast.ts build            write public/art/sprites/<key>.png + .json
 *   node art/tools/cast.ts preview OUT.png  contact sheet of every frame on slate, tan and cream
 *
 * Every sprite faces right (the game mirrors it for left), its feet on the frame's bottom rows and
 * the outline on the last row, and its body centre on the frame's centre line, so mirroring it does
 * not move it. Outlines are coloured: two ramp steps darker than the fill, stepped further down the
 * ramp until they hold 3:1 on the sidewalk (skin2). None of them is a hazard or a pickup, and none
 * carries a hit box.
 *
 * pigeon, 22x22: a small pigeon at true street scale, placed in groups. A grey body with an lgrey
 * rim light on its back and head and a slate shade, slate wing and tail, a dslate wing bar and tail
 * band, a bold green-and-mauve neck sheen, an ink eye, a navy beak and pink feet. Feet on row 20,
 * outline on row 21 (navy); centre x 11: tail tip to beak spans columns 0 to 21.
 *
 * | Tag  | Frame | ms  | Pose                                           |
 * | ---- | ----- | --- | ---------------------------------------------- |
 * | idle | 0     | 600 | stand, head up                                 |
 * | idle | 1     | 140 | peck: head down to the sidewalk, tail up       |
 * | idle | 2     | 140 | stand                                          |
 * | idle | 3     | 140 | peck                                           |
 * | flee | 0     | 80  | crouch, wings lifting                          |
 * | flee | 1     | 80  | leap: 3px up, wings half raised, feet dangling |
 * | fly  | 0     | 90  | 4px up, wings up, feet tucked                  |
 * | fly  | 1     | 90  | wings down                                     |
 *
 * flee plays once and holds; the game then loops fly while it moves the pigeon up and away.
 *
 * dog-pug, 44x32: a chibi fawn pug with a big round head, a black mask and ears, a curled tail and
 * a sky-blue collar. Feet on rows 29 and 30, outline on row 31; centre x 22: tail to nose spans
 * columns 2 to 42.
 *
 * | Tag  | Frame | ms  | Pose                                                                      |
 * | ---- | ----- | --- | ------------------------------------------------------------------------- |
 * | idle | 0     | 400 | rest                                                                      |
 * | idle | 1     | 400 | breath: body and head 1px up, the tail 1px up                             |
 * | walk | 0-3   | 120 | four legs: diagonal pairs swap; passing frames 1 and 3 raise the body 1px |
 * | perk | 0     | 80  | ears up, head lifted, tail high                                           |
 * | perk | 1     | 80  | a little hop: 2px up                                                      |
 * | talk | 0     | 150 | rest, mouth closed                                                        |
 * | talk | 1     | 150 | mouth open                                                                |
 *
 * perk plays once and holds.
 *
 * pedestrian-cat, 34x50: an orange tabby (amber rim, rust shade and stripes, cream muzzle) in a
 * mauve A-line coat over two stub legs, a cream tote bag on a purple strap. Feet on rows 47 and 48,
 * outline on row 49; centre x 17, the coat's centre line.
 *
 * pedestrian-raccoon, 36x50, its own body, after a knitted raccoon: front-on, the face turned 1px
 * towards the facing side. Slate fur with dslate shade; tall ears with ink insides; a dslate
 * forehead stripe; a cream face band flaring wider than the head over ink masks that slant down and
 * out, each with a 2x2 white glint; an ink nose over a wide, round cream muzzle, jaw and cheeks that
 * run down into a cream belly, a small dslate smile; the head sits low and snug on a round, full
 * body, with no neck showing; dslate arms across the belly with ink paws together; ink feet; a short
 * tail out to the lower left in 3px ink and cream bands, its cream tip curling up. No grey. Feet on
 * rows 47 and 48, outline on row 49; centre x 18, the body's centre line.
 *
 * Both pedestrians walk the same two-leg cycle:
 *
 * | Tag  | Frame | ms  | Pose                                                            |
 * | ---- | ----- | --- | --------------------------------------------------------------- |
 * | walk | 0     | 140 | the near foot lifted 2px, the arm (or the raccoon's paws) swung |
 * | walk | 1     | 140 | passing: both feet down, the body 1px up                        |
 * | walk | 2     | 140 | the other foot lifted 2px, the arm swung the other way          |
 * | walk | 3     | 140 | passing                                                         |
 * | idle | 0     | 400 | rest                                                            |
 * | idle | 1     | 400 | breath: the body 1px up, feet planted                           |
 *
 * Character states (the README's Character states table):
 *
 * | Character          | idle   | move   | react                      | talk                       | quirk |
 * | ------------------ | ------ | ------ | -------------------------- | -------------------------- | ----- |
 * | pigeon             | `idle` | `fly`  | `flee`, then `fly`         | none, falls back to `idle` | none  |
 * | dog-pug            | `idle` | `walk` | `perk`                     | `talk`                     | none  |
 * | pedestrian-cat     | `idle` | `walk` | none, falls back to `idle` | none, falls back to `idle` | none  |
 * | pedestrian-raccoon | `idle` | `walk` | none, falls back to `idle` | none, falls back to `idle` | none  |
 */

import { run } from "./cli.ts";
import * as pixel from "./pixel.ts";
import { contrast, darker, Grid, K } from "./pixel.ts";

const USAGE = "Usage: cast.ts build | preview OUT.png";
const SIDEWALK = pixel.hex("skin2");

type Point = readonly [x: number, y: number];
type RectSpec = readonly [x: number, y: number, w: number, h: number, c: string];

/** Two ramp steps darker, then down the ramp until it holds 3:1 on the sidewalk. */
function edge(c: string): string {
  let e = darker(c, 2);
  while (contrast(e, SIDEWALK) < 3 && e !== K.ink) {
    e = darker(e);
  }
  return e;
}

/** The frame with its coloured outline, moved shift px right (negative: left). */
function done(g: Grid, shift = 0): pixel.Frame {
  let px = g.outlined({ edge });
  if (shift > 0) {
    if (!px.every((row) => row.slice(-shift).every((c) => c === null))) {
      throw new Error("the shift would clip the sprite");
    }
    px = px.map((row) => [...Array<null>(shift).fill(null), ...row.slice(0, -shift)]);
  } else if (shift < 0) {
    if (!px.every((row) => row.slice(0, -shift).every((c) => c === null))) {
      throw new Error("the shift would clip the sprite");
    }
    px = px.map((row) => [...row.slice(-shift), ...Array<null>(-shift).fill(null)]);
  }
  return px;
}

function rects(g: Grid, x0: number, y0: number, specs: readonly RectSpec[]): void {
  for (const [x, y, w, h, c] of specs) {
    g.rect(x0 + x, y0 + y, w, h, c);
  }
}

/** A line drawn with a square brush w px wide. */
function stroke(g: Grid, x0: number, y0: number, x1: number, y1: number, c: string, w = 1): void {
  const round = pixel.round;
  const n = Math.max(Math.abs(round(x1) - round(x0)), Math.abs(round(y1) - round(y0)), 1);
  for (let i = 0; i <= n; i++) {
    g.rect(round(x0 + ((x1 - x0) * i) / n), round(y0 + ((y1 - y0) * i) / n), w, w, c);
  }
}

// ---------------------------------------------------------------- pigeon

const PIGEON = {
  body: "grey",
  light: "lgrey",
  shade: "slate",
  wing: "slate",
  bar: "dslate",
  beak: "navy",
  eye: "ink",
  sheen: "green",
  sheen2: "mauve",
  foot: "pink",
} as const;

type PigeonPose = "stand" | "peck" | "crouch" | "leap" | "up" | "down";

/** One pigeon, 22x22, facing right. pose: stand, peck, crouch, leap, up, down. */
function pigeon(pose: PigeonPose): pixel.Frame {
  const palette = PIGEON;
  const g = new Grid(22, 22);
  const lift = { stand: 0, peck: 0, crouch: -1, leap: 3, up: 4, down: 4 }[pose];
  const bx = 4;
  const by = 11 - lift; // the body box's top left
  const tailDy = pose === "peck" ? -2 : 0;
  // tail: a wedge back and down with a navy band at the tip
  rects(g, bx, by, [
    [-2, 1 + tailDy, 3, 1, palette.wing],
    [-3, 2 + tailDy, 4, 1, palette.wing],
    [-3, 2 + tailDy, 2, 1, palette.bar],
  ]);
  // far wing, raised behind the body
  if (pose === "leap" || pose === "up") {
    const tip: Point = pose === "leap" ? [bx + 2, by - 4] : [bx + 1, by - 6];
    g.tri([bx + 3, by + 1], [bx + 8, by + 1], tip, palette.bar);
  }
  // body: rim light along the back, shade crescent underneath
  rects(g, bx, by, [
    [4, 0, 5, 1, palette.light],
    [2, 1, 9, 1, palette.body],
    [1, 2, 12, 1, palette.body],
    [0, 3, 13, 2, palette.body],
    [1, 5, 11, 1, palette.body],
    [3, 6, 7, 1, palette.shade],
    [10, 4, 3, 1, palette.shade],
    [8, 5, 4, 1, palette.shade],
    [2, 1, 2, 1, palette.light],
  ]);
  // near wing
  if (pose === "stand" || pose === "peck") {
    rects(g, bx, by, [
      [3, 2, 6, 2, palette.wing],
      [4, 4, 6, 1, palette.wing],
      [4, 3, 4, 1, palette.bar],
    ]);
  } else if (pose === "crouch") {
    rects(g, bx, by, [
      [2, 1, 6, 2, palette.wing],
      [3, 3, 6, 1, palette.wing],
      [3, 2, 4, 1, palette.bar],
    ]);
  } else if (pose === "leap" || pose === "up") {
    const tip: Point = pose === "leap" ? [bx + 4, by - 4] : [bx + 3, by - 6];
    g.tri([bx + 4, by + 2], [bx + 10, by + 2], tip, palette.wing);
    rects(g, bx, by, [[4, -1, 3, 1, palette.bar]]);
  } else {
    // down
    g.tri([bx + 4, by + 2], [bx + 10, by + 2], [bx + 2, by + 9], palette.wing);
    rects(g, bx, by, [[4, 5, 3, 1, palette.bar]]);
  }
  // neck, head, eye, beak
  const [hx, hy] = pose === "peck" ? [14, 13] : [14, 5 - lift + (pose === "crouch" ? 1 : 0)];
  if (pose === "peck") {
    rects(g, 1, 0, [
      [12, 11, 3, 3, palette.body],
      [12, 11, 3, 1, palette.sheen],
      [12, 12, 3, 1, palette.sheen],
      [12, 13, 3, 1, palette.sheen2],
    ]);
  } else {
    rects(g, hx, hy, [
      [-1, 5, 4, 2, palette.body],
      [-1, 5, 3, 1, palette.sheen],
      [-1, 6, 3, 1, palette.sheen],
      [-1, 7, 3, 1, palette.sheen2],
    ]);
  }
  rects(g, hx, hy, [
    [1, 0, 3, 1, palette.light],
    [0, 1, 5, 4, palette.body],
    [0, 1, 1, 2, palette.light],
    [2, 2, 2, 2, palette.eye],
    [5, 3, 2, 1, palette.beak],
  ]);
  // legs and feet
  if (pose === "stand" || pose === "peck") {
    rects(g, 1, 0, [
      [8, 18, 1, 2, palette.foot],
      [11, 18, 1, 2, palette.foot],
      [7, 20, 3, 1, palette.foot],
      [10, 20, 3, 1, palette.foot],
    ]);
  } else if (pose === "crouch") {
    rects(g, 1, 0, [
      [7, 20, 3, 1, palette.foot],
      [10, 20, 3, 1, palette.foot],
    ]);
  } else if (pose === "leap") {
    rects(g, 1, 0, [
      [8, by + 7, 1, 2, palette.foot],
      [11, by + 7, 1, 2, palette.foot],
    ]);
  } else {
    rects(g, 1, 0, [[8, by + 7, 3, 1, palette.foot]]);
  }
  return done(g);
}

function pigeonTags(): pixel.Tags {
  const stand = pigeon("stand");
  const peck = pigeon("peck");
  return [
    ["idle", [stand, peck, stand, peck], [600, 140, 140, 140]],
    ["flee", [pigeon("crouch"), pigeon("leap")], 80],
    ["fly", [pigeon("up"), pigeon("down")], 90],
  ];
}

// ---------------------------------------------------------------- pug

const PUG = {
  body: "tan",
  light: "cream",
  shade: "brown",
  mask: "ink",
  ear: "ink",
  nose: "ink",
  collar: "sky",
} as const;

interface PugOptions {
  legs?: readonly [number, number, number, number];
  lift?: number;
  mouth?: boolean;
  earsUp?: number;
  tail?: number;
  look?: number;
}

/** The pug, 44x32, facing right. legs: foot x offsets (back near, back far, front near, front far). */
function pug({
  earsUp = 0,
  legs = [0, 0, 0, 0],
  lift = 0,
  look = 0,
  mouth = false,
  tail = 0,
}: PugOptions = {}): pixel.Frame {
  const dark = PUG;
  const g = new Grid(44, 32);
  const gy = 30;
  const by = 19 - lift;
  const [bl, bf, fl, ff] = legs;
  for (const x of [12 + bf, 27 + ff]) {
    g.rect(x, by + 3, 4, gy - by - 2, dark.shade);
  } // far legs
  g.ell(7, by - 6 - tail, 3.5, 3, dark.body); // curled tail
  g.ell(7.5, by - 6 - tail, 1.6, 1.3, dark.shade);
  g.blob(17, by, 11, 7, dark.body, dark.shade, dark.light);
  for (const x of [10 + bl, 25 + fl]) {
    // near legs
    g.rect(x, by + 3, 4, gy - by - 2, dark.body);
    g.rect(x, gy - 1, 4, 2, dark.shade);
  }
  const hx = 32;
  const hy = 12 - lift + look;
  g.blob(hx, hy, 8.5, 7.5, dark.body, dark.shade, dark.light);
  g.blob(hx + 6, hy + 2, 4, 3.2, dark.mask); // black muzzle
  g.rect(hx + 9, hy, 2, 2, dark.nose);
  if (mouth) {
    g.rect(hx + 5, hy + 5, 4, 2, "dred");
    g.rect(hx + 6, hy + 6, 2, 1, "pink");
  }
  g.rect(hx + 2, hy - 2, 3, 3, "ink"); // eye with a catchlight
  g.p(hx + 2, hy - 2, "white");
  g.tri([hx - 6, hy - 6], [hx - 1, hy - 8 - earsUp], [hx - 2, hy - 2], dark.ear);
  g.rect(hx - 6, hy + 5, 4, 3, dark.collar);
  return done(g, -1);
}

function pugTags(): pixel.Tags {
  const walk = [
    [2, -2, 2, -2],
    [0, 0, 0, 0],
    [-2, 2, -2, 2],
    [0, 0, 0, 0],
  ] as const;
  return [
    ["idle", [pug(), pug({ lift: 1, tail: 1 })], 400],
    ["walk", walk.map((legs, i) => pug({ legs, lift: i % 2, tail: i % 2 })), 120],
    ["perk", [pug({ earsUp: 1, look: -1, tail: 2 }), pug({ earsUp: 1, lift: 2, look: -1 })], 80],
    ["talk", [pug(), pug({ mouth: true })], 150],
  ];
}

// ---------------------------------------------------------------- pedestrian-cat (the coat body)

const CAT = {
  fur: "orange",
  light: "amber",
  shade: "rust",
  face: "cream",
  coat: "mauve",
  coatSh: "purple",
  coatLi: "pink",
  leg: "rust",
  ear: "orange",
} as const;
// (step, lift): lifted, passing, other lifted, passing
const WALK = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, 1],
] as const;

/**
 * An A-line coat from the shoulders (y 24) to the hem (y 41), 12px wide at the top and 18 at the
 * hem, lit down its left edge and shaded down its right.
 */
function coat(g: Grid, palette: typeof CAT, lift: number): void {
  for (let y = 24 - lift; y < 42 - lift; y++) {
    const w = pixel.round(12 + (6 * (y - 24 + lift)) / 17);
    const x0 = 16 - Math.floor(w / 2);
    g.rect(x0, y, w, 1, palette.coat);
    g.rect(x0, y, 2, 1, palette.coatLi);
    g.rect(x0 + w - 2, y, 2, 1, palette.coatSh);
  }
}

/**
 * The cat, 34x50, facing right. step: 1 near foot forward and lifted, -1 far foot forward and
 * lifted, 0 passing.
 */
function cat(step = 0, lift = 0): pixel.Frame {
  const palette = CAT;
  const g = new Grid(34, 50);
  const gy = 48;
  const hy = 15 - lift;
  stroke(g, 9, 40 - lift, 3, 32 - lift, palette.fur, 3); // tail
  stroke(g, 3, 32 - lift, 4, 25 - lift, palette.fur, 3);
  const farX = 17 - 3 * step;
  const nearX = 13 + 3 * step;
  const farUp = step === -1 ? 2 : 0;
  const nearUp = step === 1 ? 2 : 0;
  g.rect(farX, 41 - lift, 4, gy - 40 + lift - farUp, palette.shade);
  coat(g, palette, lift);
  g.rect(nearX, 41 - lift, 4, gy - 40 + lift - nearUp, palette.leg);
  g.rect(nearX, gy - 1 - nearUp, 5, 2, palette.shade);
  g.tri([9, hy - 4], [14, hy - 7], [9, hy - 13], palette.ear);
  g.tri([17, hy - 7], [22, hy - 5], [21, hy - 13], palette.ear);
  g.tri([18, hy - 7], [21, hy - 6], [20.5, hy - 11], "pink");
  g.blob(16, hy, 10, 9, palette.fur, palette.shade, palette.light);
  g.blob(23, hy + 3, 4.5, 3.5, palette.face);
  g.rect(27, hy + 1, 2, 2, "pink");
  g.rect(19, hy - 3, 3, 3, "ink");
  g.p(19, hy - 3, "white");
  g.rect(12, hy - 6, 2, 4, palette.shade); // tabby stripes
  g.rect(15, hy - 7, 2, 3, palette.shade);
  g.rect(12, 25 - lift, 2, 9, "purple"); // tote bag on a strap, behind the swinging arm
  g.rect(7, 33 - lift, 9, 10, "cream");
  g.rect(7, 33 - lift, 9, 2, "white");
  g.rect(18 + step, 27 - lift, 3, 9, palette.coatSh); // near sleeve, swinging
  g.rect(18 + step, 36 - lift, 3, 2, palette.fur);
  return done(g, 1);
}

function catTags(): pixel.Tags {
  return [
    ["walk", WALK.map(([s, lift]) => cat(s, lift)), 140],
    ["idle", [cat(), cat(0, 1)], 400],
  ];
}

// ---------------------------------------------------------------- pedestrian-raccoon (its own body)

const RACCOON = {
  fur: "slate",
  shade: "dslate",
  dark: "ink",
  cream: "cream",
  glint: "white",
} as const;

/**
 * A short, thick tail lying out to the lower left, its cream tip curling up 1px: 3px dark and
 * cream bands.
 */
function raccoonTail(g: Grid, lift: number, sway: number): void {
  const palette = RACCOON;
  const bands = [
    [9, 3, palette.dark],
    [6, 3, palette.cream],
    [3, 3, palette.dark],
    [1, 2, palette.cream],
  ] as const;
  g.rect(10, 40 - lift, 4, 6, palette.fur);
  bands.forEach(([x, w, c], i) => {
    const curl = (i === bands.length - 1 ? 1 : 0) + (i >= bands.length - 2 ? sway : 0);
    const top = 41 - lift - curl;
    g.rect(x, top, w, 5, c);
    if (i === bands.length - 1) {
      g.p(x, top, null);
    }
  });
}

/**
 * The raccoon, 36x50, front-on with the face 1px towards the facing side. step: 1 the near (right)
 * foot lifted, -1 the far (left) foot lifted, 0 passing. lift raises everything above the feet.
 */
function raccoon(step = 0, lift = 0): pixel.Frame {
  const palette = RACCOON;
  const g = new Grid(36, 50);
  const gy = 48;
  const fx = 1;
  const light = lift;
  raccoonTail(g, light, step ? 1 : 0);
  for (const [side, x] of [
    [-1, 13],
    [1, 20],
  ] as const) {
    // legs, dark paws
    const up = step === side ? 2 : 0;
    g.rect(x, 42 - light, 4, gy - 42 + light + 1 - up, side < 0 ? palette.shade : palette.fur);
    g.rect(x, gy - 1 - up, 4, 2, palette.dark);
  }
  g.blob(18, 36 - light, 9, 9, palette.fur, palette.shade); // body, round and full
  g.blob(18.5 + fx, 36.5 - light, 5, 6, palette.cream); // the belly, meeting the round jaw
  for (const side of [-1, 1]) {
    // arms across the lower belly, paws together in front
    const dy = step * side;
    for (let i = 0; i < 5; i++) {
      g.rect(side < 0 ? 10 + i : 26 - i, 36 - light + dy + Math.floor(i / 3), 1, 2, palette.shade);
    }
    g.rect(side < 0 ? 15 + fx : 20 + fx, 38 - light + dy, 2, 2, palette.dark);
  }
  const hy = 2 - light; // the head sits low and snug on the body
  g.tri([6, 13 + hy], [14, 9 + hy], [8, 0 + hy], palette.fur); // tall ears, dark insides
  g.tri([22, 9 + hy], [30, 13 + hy], [28, 0 + hy], palette.fur);
  g.tri([8.5, 11 + hy], [13, 9 + hy], [9, 3 + hy], palette.dark);
  g.tri([23, 9 + hy], [27.5, 11 + hy], [27, 3 + hy], palette.dark);
  g.blob(18, 15 + hy, 10.5, 8.5, palette.fur, palette.shade); // head
  g.ell(18.5 + fx, 20 + hy, 13, 3.8, palette.cream); // face band, flaring wider than the head
  g.ell(13 + fx, 16.5 + hy, 4.2, 2.4, palette.cream);
  g.ell(24 + fx, 16.5 + hy, 4.2, 2.4, palette.cream);
  g.rect(17 + fx, 7 + hy, 3, 10, palette.shade); // forehead stripe
  for (const [cx, ox] of [
    [12.5, 10],
    [24.5, 27],
  ] as const) {
    // masks, slanting down and out
    g.ell(cx + fx, 20 + hy, 5, 3.3, palette.dark);
    g.ell(ox + fx, 21.5 + hy, 3, 2, palette.dark);
  }
  g.blob(18.5 + fx, 25 + hy, 6.5, 4, palette.cream); // a wide, round muzzle, jaw and cheeks
  g.rect(17 + fx, 21 + hy, 3, 2, palette.dark); // nose
  for (const x of [13, 24]) {
    g.rect(x + fx, 18 + hy, 2, 2, palette.glint);
  }
  for (const [x, y] of [
    [16, 25],
    [17, 26],
    [18, 26],
    [19, 26],
    [20, 25],
  ] as const) {
    g.p(x + fx, y + hy, palette.shade);
  } // small smile
  return done(g);
}

function raccoonTags(): pixel.Tags {
  return [
    ["walk", WALK.map(([s, lift]) => raccoon(s, lift)), 140],
    ["idle", [raccoon(), raccoon(0, 1)], 400],
  ];
}

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield ["pigeon", pigeonTags()];
  yield ["dog-pug", pugTags()];
  yield ["pedestrian-cat", catTags()];
  yield ["pedestrian-raccoon", raccoonTags()];
}

const ONCE = { pigeon: ["flee"], "dog-pug": ["perk"] };

if (import.meta.main) {
  run(() => pixel.main({ doc: USAGE, once: ONCE }, sprites));
}
