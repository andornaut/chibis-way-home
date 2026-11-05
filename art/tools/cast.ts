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
 * Character states (the style guide's Character states table):
 *
 * | Character | idle   | move   | react                      | talk                       | quirk |
 * | --------- | ------ | ------ | -------------------------- | -------------------------- | ----- |
 * | pigeon    | `idle` | `fly`  | `flee`, then `fly`         | none, falls back to `idle` | none  |
 * | dog-pug   | `idle` | `walk` | `perk`                     | `talk`                     | none  |
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

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield ["pigeon", pigeonTags()];
  yield ["dog-pug", pugTags()];
}

const ONCE = { pigeon: ["flee"], "dog-pug": ["perk"] };

const OPTIONS: pixel.MainOptions = { once: ONCE, usage: USAGE };

export function build(): Promise<void> {
  return pixel.build(OPTIONS, [...sprites()]);
}

if (import.meta.main) {
  run(() => pixel.main(OPTIONS, sprites));
}
