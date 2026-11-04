/**
 * Fert the ferret: the villain's sprite and its dialogue portrait.
 *
 * Usage, from the repository root:
 *   node art/tools/ferret.ts build            write public/art/sprites/<key>.png + .json
 *   node art/tools/ferret.ts preview OUT.png  contact sheet of every frame on slate, tan and cream
 *
 * Design: a champagne ferret standing up on its hind legs, modelled on a natural ferret rather than
 * a chibi: a long, slinky body stood upright with a small forward arch, a small wedge head held
 * level, short dark legs and a tapering tail touching the ground behind as a third contact point.
 * A talking villain, cute with a touch of slyness, never scary, never fought. Facing left (the game
 * mirrors it).
 *
 * Drawn facing right, then mirrored. The body is a quadratic-Bezier spine from the hip (low) to the
 * neck (high), its control point behind the back, stamped as 13 overlapping discs: each first in
 * the shade colour (offset down and right), then the lit rim (offset up and left), then the coat
 * between, which leaves a shade crescent along the belly and a lit rim on the back. The head is an
 * ellipse with a forward wedge to a pink nose, one round ear behind, a pale band across the face
 * and a skin2 mask round the eye.
 *
 * Colour, kept apart from the cream bird: a skin1 (champagne) coat with a skin2 shade crescent, a
 * cream rim, a white face band, brown legs and tail with dark-brown far legs, a skin2 mask, a pink
 * nose, and a dark-brown outline (the bird's is dark slate). Against the bird's cream, the coat is
 * 1.24:1 and the shade 2.12:1 (WCAG), and the outline and the legs, tail and mask sit well below
 * anything on the bird. Accents: the plum stovepipe with a red band and a red bow tie under the
 * jaw, outlined in ink.
 *
 * Eyes: round, 5px across with the corners cut, ink with a 2x2 white glint top-left and a 1px cream
 * glint bottom-right, under a soft 1px brown lid line across the top that dips at the outer corner,
 * so the look stays a little sly. Scheming, the lid drops to half: the lower half of the eye shows
 * under a 2px lid.
 *
 * ferret, 64x80. Feet on rows 76 to 78, outline on row 79 (the frame's bottom row). Anchor: the
 * frame's bottom edge sits on the collision box's bottom edge, and its body-centre x, 32 (between
 * columns 31 and 32), sits on the box centre, so mirroring it does not move it.
 *
 * | Tag    | Frame | ms  | Pose                                                            | Lift |
 * | ------ | ----- | --- | --------------------------------------------------------------- | ---- |
 * | idle   | 0     | 400 | rest: paws at the chest, round eye, small smile                 | 0    |
 * | idle   | 1     | 400 | breath: body, head and hat 1px up, feet and tail planted        | 1    |
 * | scheme | 0     | 160 | paws steepled under the chin, the lid at half, a sly smile      | 0    |
 * | scheme | 1     | 160 | the tap: the near paw 1px down and forward, apart from the far  | 0    |
 * | talk   | 0     | 150 | rest, mouth closed                                              | 0    |
 * | talk   | 1     | 150 | mouth open, head and hat 1px up                                 | 0    |
 *
 * Lift is how far the body sits above its rest row, in pixels. Every tag loops (ONCE is empty).
 *
 * States: idle idle; move none, falls back to idle (it stands where it is placed); react none,
 * falls back to scheme (the pleased steeple when its plan works); talk talk; quirk scheme (an idle
 * tic).
 *
 * portrait-ferret, 64x64: its head and neck facing right towards the text (as portrait-bird), cut
 * off by the frame's bottom edge, with one ink outer line on a transparent ground (the dialogue
 * box's 68x68 frame supplies the backing). The same face, eyes and hat, larger. Tags, one frame
 * each at 1000ms: neutral (round eye, small smile), smug (the lid at half, a wider smile), annoyed
 * (a short brow dipped towards the snout, the lid at a third, the mouth turned down).
 */

import { run } from "./cli.ts";
import * as pixel from "./pixel.ts";
import { Grid } from "./pixel.ts";

const USAGE = "Usage: ferret.ts build | preview OUT.png";
const W = 64;
const H = 80;
const GROUND = 78; // the feet's bottom row; the outline is row 79
const COAT = {
  coat: "skin1",
  shade: "skin2",
  rim: "cream",
  leg: "brown",
  far: "dbrown",
  band: "white",
  mask: "skin2",
  ear: "skin2",
  nose: "pink",
  edge: "dbrown",
} as const;
const HAT = ["plum", "dbrown", "red"] as const; // crown, rim light, band
const BOW = ["red", "dred"] as const;
const ACCENTS = new Set([...HAT, ...BOW].map((c) => pixel.hexc(c)));
// Body, in pixels from the hip, facing right: hip, chest and neck radii; the neck's offset from the
// hip; the arch (the control point's x offset, negative is behind); the head's radii and snout.
const RADII = [9, 8, 5.5] as const;
const NECK = [6, -31] as const;
const ARCH = -5;
const HEAD = [8.5, 7, 9] as const;

type Point = readonly [x: number, y: number];
type EyeState = "open" | "third" | "half";
type Mouth = "open" | "smile" | "grin" | "pout";
type Paws = "rest" | "steeple" | "tap";

export function rect(g: Grid, x: number, y: number, w: number, h: number, c: string | null): void {
  g.rect(pixel.round(x), pixel.round(y), pixel.round(w), pixel.round(h), c);
}

/** A thick stroke: discs of radius r from a to b. */
export function discLine(g: Grid, a: Point, b: Point, r: number, c: string): void {
  const [x0, y0] = a;
  const [x1, y1] = b;
  const n = Math.max(2, Math.trunc(Math.hypot(x1 - x0, y1 - y0) * 2));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    g.ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, c);
  }
}

/**
 * A round eye with its top-left at x, y: 5x5 (7x7 when big) with the corners cut, a 2x2 white
 * glint top-left and a 1px cream glint bottom-right, under a soft brown lid that dips at the outer
 * corner. state: open, half (the lid lowered to half: sly), third (a little lowered, for annoyed).
 */
export function eye(g: Grid, x: number, y: number, state: EyeState, big = false): void {
  const n = big ? 7 : 5;
  rect(g, x, y, n, n, "ink");
  for (const [cx, cy] of [
    [x, y],
    [x + n - 1, y],
    [x, y + n - 1],
    [x + n - 1, y + n - 1],
  ] as const) {
    g.p(cx, cy, null);
  }
  rect(g, x + 1, y + 1, 2, 2, "white");
  g.p(x + n - 2, y + n - 2, "cream");
  const lid = { open: 0, third: Math.floor(n / 3), half: Math.floor(n / 2) }[state];
  if (lid) {
    rect(g, x, y, n, lid, COAT.mask);
  }
  rect(g, x, y + lid - 1, n, 1, "brown"); // the lid line, soft
  g.p(x + n, y + lid, "brown"); // dipping at the outer corner
}

/**
 * The plum stovepipe: a crown 8 wide and 14 tall (scaled by k) with a dark-brown rim light on its
 * left and a red band, on a brim 14 wide; its bottom on row bottom.
 */
export function hat(g: Grid, cx: number, bottom: number, k = 1.0): void {
  const cw = pixel.round(8 * k);
  const ch = pixel.round(14 * k);
  const bw = pixel.round(14 * k);
  const bh = Math.max(2, pixel.round(2 * k));
  const band = Math.max(2, pixel.round(2 * k));
  const half = Math.floor(cw / 2);
  rect(g, cx - half, bottom - bh - ch, cw, ch, HAT[0]);
  rect(g, cx - half, bottom - bh - ch, Math.max(1, pixel.round(k)), ch, HAT[1]);
  rect(g, cx - half, bottom - bh - band - 2, cw, band, HAT[2]);
  rect(g, cx - Math.floor(bw / 2), bottom - bh, bw, bh, HAT[0]);
  rect(g, cx - Math.floor(bw / 2), bottom - bh, pixel.round(3 * k), 1, HAT[1]);
}

export function bowTie(g: Grid, x: number, y: number, k = 1.0): void {
  const a = 5 * k;
  const b = 3 * k;
  g.tri([x - a, y - b], [x, y], [x - a, y + b], BOW[0]);
  g.tri([x + a, y - b], [x, y], [x + a, y + b], BOW[0]);
  rect(g, x - k, y - k, 3 * k, 3 * k, BOW[1]);
}

interface FaceOptions {
  eyeState: EyeState;
  mouth: Mouth;
  big?: boolean;
  brow?: boolean;
}

/**
 * The head facing right, centred on ex, ey: one round ear behind, the cranium, a wedge to the
 * nose, the pale band across the face, the mask round the eye, the eye, the nose and the mouth.
 * Returns the snout tip.
 */
export function face(
  { big = false, brow = false, eyeState, mouth }: FaceOptions,
  g: Grid,
  ex: number,
  ey: number,
  rx: number,
  ry: number,
  snout: number,
): Point {
  const c = COAT;
  g.ell(ex - rx * 0.55, ey - ry * 0.8, rx * 0.32, rx * 0.32, c.ear);
  g.ell(ex - rx * 0.55, ey - ry * 0.8, rx * 0.15, rx * 0.15, c.rim);
  g.ell(ex, ey, rx, ry, c.coat, c.shade, c.rim);
  const tip: Point = [ex + rx + snout - 4, ey + ry * 0.3];
  g.tri([ex + 1, ey - ry + 1], tip, [ex + 1, ey + ry - 0.5], c.coat);
  g.tri([ex - rx * 0.3, ey - ry + 1], tip, [ex - rx * 0.3, ey + ry - 0.5], c.band);
  const n = big ? 7 : 5;
  const exx = pixel.round(ex + rx * 0.05);
  const eyy = pixel.round(ey - ry * 0.45);
  g.ell(exx + n / 2, eyy + n / 2, n * 0.85, n * 0.62, c.mask);
  eye(g, exx, eyy, eyeState, big);
  if (brow) {
    // dipped towards the snout
    for (let i = 0; i <= n; i++) {
      rect(g, exx - 1 + i, eyy - 3 + Math.floor(i / 3), 1, 2, "dbrown");
    }
  }
  const s = big ? 2 : 1;
  rect(g, tip[0] - 2 * s, tip[1] - 2 * s, 3 * s, 2 * s, c.nose);
  const mx = tip[0] - 4 * s - 4;
  const my = tip[1] + 1 + s;
  if (mouth === "open") {
    rect(g, mx, my, 5 * s, 2 * s, "plum");
  } else if (mouth === "smile") {
    rect(g, mx, my, 4 * s, s, c.shade);
    g.p(mx - 1, my - 1, c.shade);
  } else if (mouth === "grin") {
    rect(g, mx - 2 * s, my, 7 * s, s, c.shade);
  } else if (mouth === "pout") {
    rect(g, mx, my, 4 * s, s, c.shade);
    g.p(mx - 1, my + 1, c.shade);
  }
  return tip;
}

/** The outer line: ink round the hat and bow tie, dark brown round the ferret. */
export function outline(g: Grid): pixel.Frame {
  return g.outlined({
    edge: (col) => (ACCENTS.has(col) ? pixel.hexc("ink") : pixel.hexc(COAT.edge)),
  });
}

interface DrawOptions {
  lift?: number;
  headDy?: number;
  paws?: Paws;
  eyeState?: EyeState;
  mouth?: Mouth;
}

function draw({
  eyeState = "open",
  headDy = 0,
  lift = 0,
  mouth = "smile",
  paws = "rest",
}: DrawOptions = {}): pixel.Frame {
  const c = COAT;
  const g = new Grid(W, H);
  const hx = 30;
  const hy = GROUND - 13 - lift;
  const nx = hx + NECK[0];
  const ny = hy + NECK[1];
  const mx = (hx + nx) / 2 + ARCH;
  const my = (hy + ny) / 2;

  const spine = (t: number): Point => [
    (1 - t) ** 2 * hx + 2 * t * (1 - t) * mx + t * t * nx,
    (1 - t) ** 2 * hy + 2 * t * (1 - t) * my + t * t * ny,
  ];

  const [rh, rc, rn] = RADII;
  const radius = (t: number): number =>
    t < 0.5 ? rh + (rc - rh) * t * 2 : rc + (rn - rc) * (t - 0.5) * 2;

  // the tail, tapering back to the ground behind; the far hind foot
  discLine(g, [hx - 4, hy + 4], [hx - 14, GROUND - 2], 2, c.leg);
  discLine(g, [hx - 14, GROUND - 2], [hx - 24, GROUND - 1], 1.2, c.leg);
  discLine(g, [hx + 2, hy + 4 + lift], [hx + 4, GROUND - 2], 2, c.far);
  rect(g, hx + 3, GROUND - 2, 8, 3, c.far);
  // the body: shade, rim, coat
  const steps = Array.from({ length: 13 }, (_, k) => k / 12);
  for (const t of steps) {
    const [x, y] = spine(t);
    g.ell(x + 0.8, y + 0.8, radius(t), radius(t), c.shade);
  }
  for (const t of steps) {
    const [x, y] = spine(t);
    g.ell(x - 0.9, y - 0.9, radius(t) - 1.2, radius(t) - 1.2, c.rim);
  }
  for (const t of steps) {
    const [x, y] = spine(t);
    g.ell(x - 0.4, y - 0.4, radius(t) - 1.6, radius(t) - 1.6, c.coat);
  }
  // the near hind leg: a haunch and a flat foot
  g.ell(hx + 1, hy + 2, rh - 1, rh - 0.5, c.coat, c.shade);
  discLine(g, [hx + 3, hy + 5 + lift], [hx + 4, GROUND - 2], 2, c.leg);
  rect(g, hx + 1, GROUND - 2, 10, 3, c.leg);
  // the head, level
  const [rx, ry, snout] = HEAD;
  const ex = nx + 3;
  const ey = ny - ry + 1 + headDy;
  face({ eyeState, mouth }, g, ex, ey, rx, ry, snout);
  // the arms, short and dark, their paws a 3x2 cap in the rim colour
  const [sx, sy] = spine(0.8);
  if (paws === "steeple" || paws === "tap") {
    const dy = paws === "tap" ? 1 : 0;
    discLine(g, [sx + 2, sy + 2], [ex + 5, ey + ry + 3], 1.6, c.far);
    discLine(g, [sx + 3, sy + 3], [ex + 5 + dy, ey + ry + 4 + dy], 1.6, c.leg);
    rect(g, ex + 4 + dy, ey + ry + 1 + dy, 4, 4, c.leg);
    rect(g, ex + 5 + dy, ey + ry + 1 + dy, 3, 2, c.rim);
  } else {
    discLine(g, [sx + 2, sy + 2], [sx + 6, sy + 7], 1.6, c.far);
    discLine(g, [sx + 3, sy + 3], [sx + 7, sy + 8], 1.6, c.leg);
    rect(g, sx + 7, sy + 8, 3, 2, c.rim);
  }
  bowTie(g, ex + 2, ey + ry + 2);
  hat(g, ex - 1, pixel.round(ey - ry + 2));
  return outline(g).map((row) => [...row].reverse()); // mirror to face left
}

function ferretTags(): pixel.Tags {
  return [
    ["idle", [draw(), draw({ lift: 1 })], 400],
    [
      "scheme",
      [
        draw({ eyeState: "half", mouth: "grin", paws: "steeple" }),
        draw({ eyeState: "half", mouth: "grin", paws: "tap" }),
      ],
      160,
    ],
    ["talk", [draw(), draw({ headDy: -1, mouth: "open" })], 150],
  ];
}

// ------------------------------------------------------------------------------------ portrait

type Expression = "neutral" | "smug" | "annoyed";

/** 64x64: the head and neck facing right, cut off by the bottom edge, one ink outer line. */
function portrait(expr: Expression): pixel.Frame {
  const c = COAT;
  const g = new Grid(64, 64);
  // the neck, a thick stroke from below the frame up to the head: shade, then the rim, then the coat
  discLine(g, [23, 72], [29, 42], 11, c.shade);
  discLine(g, [21, 71], [27, 41], 10, c.rim);
  discLine(g, [22, 71], [28, 41], 9.5, c.coat);
  const eyeState = ({ neutral: "open", smug: "half", annoyed: "third" } as const)[expr];
  const mouth = ({ neutral: "smile", smug: "grin", annoyed: "pout" } as const)[expr];
  const ex = 26;
  const ey = 33;
  face({ big: true, brow: expr === "annoyed", eyeState, mouth }, g, ex, ey, 14, 11, 12);
  bowTie(g, 31, 52, 1.4);
  hat(g, 24, ey - 9, 1.4);
  return g.outlined({ edge: () => pixel.hexc("ink") });
}

function portraitTags(): pixel.Tags {
  return (["neutral", "smug", "annoyed"] as const).map((e) => [e, [portrait(e)], 1000]);
}

// Tags that play once and hold their last frame; every other tag loops.
const ONCE: Record<string, readonly string[]> = {};

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield ["ferret", ferretTags()];
  yield ["portrait-ferret", portraitTags()];
}

if (import.meta.main) {
  run(() => pixel.main({ doc: USAGE, once: ONCE }, sprites));
}
