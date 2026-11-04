/**
 * Chibi the bird: the protagonist's sprite and his dialogue portrait.
 *
 * Usage, from the repository root:
 *   node art/tools/bird.ts build            write art/bird/<key>.aseprite and
 *                                           public/art/sprites/<key>.png + .json
 *   node art/tools/bird.ts preview OUT.png  contact sheet of every frame on slate, tan and cream
 *
 * Design: a wide, round cream blob of a bird with a small round head set into the top of his body
 * at the front, a square ink dot eye, a short plain orange bill, a flat tan wing patch and tiny
 * orange stub feet. His back dips at the nape, so his round head sits up above the back line, and
 * ends in a short tail tip at the rear. Cel shading: a tan crescent on the lower right and a white
 * rim on the upper left. Dark-slate outline. Facing right (the game mirrors him). No bow.
 *
 * bird, 48x42. Collision body 24x36 (2x3 tiles of 12px), anchored bottom-centre: the frame's
 * bottom edge sits on the body's bottom edge, and his body-centre x, 24 (the frame's centre line,
 * between columns 23 and 24), sits on the body's centre, so mirroring him does not move it. Feet
 * on rows 39 and 40, the outline on row 41. The 24x36 body covers columns 12 to 35 and rows 6 to
 * 41. At rest his back and tail overhang it 8px on the left and his head and bill 10px on the
 * right, and he stops 2px below its top. The raised wing overhangs up to 5px above (flutter 0);
 * the jump crouch and land squash push his tail out to 11 and 12px on the left.
 *
 * | Tag     | Frame | ms  | Pose                                                         | Lift | Body w x h | Shadow w |
 * | ------- | ----- | --- | ------------------------------------------------------------ | ---- | ---------- | -------- |
 * | idle    | 0     | 400 | rest                                                         | 0    | 33 x 26    | 34       |
 * | idle    | 1     | 400 | breath: body and head 1px up, feet planted                   | 1    | 33 x 26    | 34       |
 * | walk    | 0     | 130 | near foot forward and 2px up, far foot back                  | 0    | 33 x 26    | 34       |
 * | walk    | 1     | 130 | passing: feet together, body 1px up                          | 1    | 33 x 26    | 32       |
 * | walk    | 2     | 130 | far foot forward and 2px up (behind the body), near back     | 0    | 33 x 26    | 34       |
 * | walk    | 3     | 130 | passing                                                      | 1    | 33 x 26    | 32       |
 * | jump    | 0     | 80  | crouch: squash, wing lifting                                 | 0    | 38 x 22    | 38       |
 * | jump    | 1     | 100 | lift: stretch, 3px up, feet tucked, wing half raised         | 3    | 29 x 30    | 26       |
 * | flutter | 0     | 100 | wing up (the signature pose)                                 | 2    | 33 x 26    | 26       |
 * | flutter | 1     | 100 | wing back                                                    | 2    | 33 x 26    | 26       |
 * | flutter | 2     | 100 | wing level: the downstroke lifts the body 1px                | 3    | 33 x 26    | 26       |
 * | flutter | 3     | 100 | wing back                                                    | 2    | 33 x 26    | 26       |
 * | land    | 0     | 100 | contact: squash, feet planted wide                           | 0    | 39 x 22    | 40       |
 * | land    | 1     | 80  | recover: half squash                                         | 0    | 36 x 24    | 36       |
 * | death   | 0     | 100 | small recoil, closed eye, feet visible                       | 1    | 34 x 24    | 36       |
 * | death   | 1     | 120 | pronounced fall tilt, closed eye, visible tucked soles       | 1    | 34 x 24    | 33       |
 * | death   | 2     | 80  | brief impact squash, rounded belly, feet hidden              | -2   | 38 x 16    | 39       |
 * | death   | 3     | 400 | spring to round sitting rest, soft contact ends, feet hidden | -2   | 34 x 21    | 39       |
 *
 * Dash appends frames 18 to 20 after death, with 60, 130 and 60ms durations. The wing lifts up and
 * back, then recovers, while the head, torso and feet retain the rest pose. Its rounded tip and
 * shoulder stay inside the 48x42 frame. Dash plays once; gameplay selects it only during the
 * active dash and restores locomotion as soon as the dash ends. The 250ms art sequence matches the
 * current configured burst. Player collision remains the fixed 24x36 body; bird alpha is not
 * registered for silhouette contact.
 *
 * Double-jump appends frames 21 to 24, four 60ms frames played once. A quick raised upstroke,
 * level downstroke and recovery use a broad rounded wing, while the head, torso and tucked feet
 * hold the existing lift-2 airborne pose. Gameplay selects this 240ms sequence only on an accepted
 * second jump, ending it on landing or when its visual duration finishes; active dash takes
 * priority.
 *
 * Lift is how far the body's bottom edge sits above its rest row, in pixels. Body w x h is the
 * body's superellipse; normal locomotion keeps its area within 2% of rest. Shadow w is for a
 * ground shadow the game may draw under him: the land contact frame's is the largest. flutter and
 * jump 1 are airborne, so their shadow is the game's to place. jump, land, death, dash and
 * double-jump play once and hold their last frame (the manifest's "once"); every other tag loops.
 * After land, play idle. Death is appended after the existing tags; frame indices stay fixed.
 * Death has no baked world movement: the runtime uses frame 0 for recoil, holds frame 1 during the
 * physical fall, then shows frame 2 on support and springs back to seated frame 3, held while the
 * retry card is open. The camera stays fixed. Durations above are art playback defaults; gameplay
 * owns state timing and falling behaviour. The death impact briefly compresses the body; the final
 * pose is a full, round sit with a short flat belly centre and rounded contact ends, resting on
 * the frame bottom. Feet show during recoil and fall, not on support. The body-centre and
 * frame-bottom anchor do not move.
 *
 * States: idle idle; move walk, and in the air jump, flutter and land; react none, falls back to
 * land (its squash reads as a flinch); death death; talk none, falls back to idle (the portrait
 * carries the speech); quirk none.
 *
 * portrait-bird, 64x64: his head and the top of his body, facing right towards the text, cut off
 * by the frame's bottom edge, on a transparent ground (the dialogue box's 68x68 frame supplies the
 * backing), with one ink outer line. Tags: neutral (dot eye), happy (eye closed in an upward arc),
 * worried (dot eye under a brow slanting down to the back, the bill a little lower). One frame
 * each.
 */

import { crop, frameToRgba, paste, rotateNearest } from "@andornaut/art-kit/raster";
import { blankImage } from "@andornaut/art-kit/rgbaImage";

import * as pixel from "./pixel.ts";
import { Grid, K } from "./pixel.ts";

const SRC = "art/bird";
const USAGE = "Usage: bird.ts build | preview OUT.png";
export const W = 48;
export const H = 42;
export const BOX_W = 24; // collision body
export const BOX_H = 36;
const C = W / 2; // body centre x: the frame's centre line
export const BRX = 16.4; // body superellipse at rest
export const BRY = 13.0;
const POWER = 2.15;
export const HEAD_R = 9.2; // head radius
export const NAPE_DROP = 3; // how far the body's top dips at the nape, below the back of his head, in px
export const BACK_FLAT = 2; // how far the middle of his back is pressed down, to soften its hump, in px
export const HEAD_X = 0.43; // head centre: right of the body centre and above it, in body radii
export const HEAD_UP = 0.62;
export const BODY_BOTTOM = H - 3; // the body's bottom edge at rest; the feet fill the two rows under it
export const BASE = "cream";
export const SHADE = "tan";
export const LIGHT = "white";
export const WING = "tan"; // a flat patch, no line
export const OUTLINE = "dslate";

export type Inside = (x: number, y: number) => boolean;
type Colour = string | null;

const radians = (degrees: number) => degrees * (Math.PI / 180);

/**
 * Fill a shape cel-shaded from a top-left light: sh is a crescent ks px deep along the lower-right
 * rim (pixels that leave the shape when moved ks px down and right), li a kl px rim on the upper
 * left.
 */
export function cel(
  g: Grid,
  inside: Inside,
  base: Colour,
  sh: Colour,
  li: Colour,
  ks: number,
  kl: number,
): void {
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++)
      if (inside(x, y))
        g.p(x, y, !inside(x + ks, y + ks) ? sh : li && !inside(x - kl, y - kl) ? li : base);
}

/** Inside test for an ellipse rotated by ang radians. */
export function inEll(cx: number, cy: number, rx: number, ry: number, ang = 0.0): Inside {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  return (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    const u = dx * ca + dy * sa;
    const v = -dx * sa + dy * ca;
    return (u / rx) ** 2 + (v / ry) ** 2 <= 1;
  };
}

/**
 * His body: the superellipse with its top pressed down drop px at the nape (napeX, where his back
 * meets the back of his head), easing to nothing over 0.55 of the body's radius either side, so
 * the head sits up above the back line; and pressed down flat px over the middle of his back,
 * between the nape and the tail, so the back line is gentle rather than humped.
 */
export function inBody(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  napeX: number,
  drop: number,
  flat: number,
): Inside {
  const ease = (d: number, width: number) => {
    const w = Math.max(0.0, 1 - Math.abs(d) / width);
    return w * w * (3 - 2 * w);
  };
  return (x, y) => {
    const px = x + 0.5;
    let yy = y;
    if (y + 0.5 < cy)
      yy = y - drop * ease(px - napeX, rx * 0.55) - flat * ease(px - (cx - rx * 0.4), rx * 0.6);
    return (Math.abs(px - cx) / rx) ** POWER + (Math.abs(yy + 0.5 - cy) / ry) ** POWER <= 1;
  };
}

export function inBlob(cx: number, cy: number, rx: number, ry: number, power = POWER): Inside {
  return (x, y) =>
    (Math.abs(x + 0.5 - cx) / rx) ** power + (Math.abs(y + 0.5 - cy) / ry) ** power <= 1;
}

export function flat(g: Grid, inside: Inside, c: Colour): void {
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (inside(x, y)) g.p(x, y, c);
}

export type Wing =
  | readonly ["fold", number]
  | readonly ["raise", number]
  | readonly ["dash", number]
  | readonly ["double-jump", number];
/** [dx, up] for one foot: its left column relative to the body centre, and its lift. */
export type Foot = readonly [dx: number, up: number];
export type Feet = readonly [far: Foot, near: Foot] | "tucked" | "hidden";

export interface DrawOptions {
  lift?: number;
  bw?: number;
  bh?: number;
  wing?: Wing;
  feet?: Feet;
  eye?: "open" | "closed" | "dead";
  headSquash?: number;
  seated?: boolean;
}

/**
 * One 48x42 frame.
 *
 * lift: body bottom edge this many px above its rest row. bw, bh: body radii. wing: ["fold", dy]
 * or ["raise", degrees], the raised wing's direction in screen degrees (180 straight back, above
 * 180 up and back). feet: [[dx, up], [dx, up]] for the far foot (drawn behind the body) and the
 * near foot, each its left column relative to the body centre, or "tucked" (soles just under the
 * belly), or "hidden" (no feet drawn). headSquash compresses the head vertically while retaining
 * its bottom edge. Its default preserves the normal round head. seated rounds the lower belly into
 * a short flat contact centre without visible feet.
 */
export function draw({
  bh = BRY,
  bw = BRX,
  eye = "open",
  feet = [
    [-5, 0],
    [2, 0],
  ],
  headSquash = 1,
  lift = 0,
  seated = false,
  wing = ["fold", 0],
}: DrawOptions = {}): pixel.Frame {
  const g = new Grid(W, H);
  const bottom = BODY_BOTTOM - lift;
  const bcy = bottom - bh;
  const hcx = C + HEAD_X * BRX;
  let hcy = bcy - HEAD_UP * bh;
  hcy += HEAD_R * (1 - headSquash);
  const headRy = HEAD_R * headSquash;

  const foot = (i: 0 | 1) => {
    if (typeof feet === "string") return;
    const [dx, up] = feet[i];
    g.rect(Math.trunc(C + dx), H - 3 - up, 4, 2, "orange");
  };

  if (feet !== "tucked" && feet !== "hidden") foot(0);
  // a short tail tip at the lowered rear, its root under the body
  cel(g, inEll(C - bw + 1, bcy - 1, 4.4, 2.2, -0.45), BASE, SHADE, null, 1, 1);
  let body = inBody(C, bcy, bw, bh, hcx - HEAD_R * 0.7, NAPE_DROP, BACK_FLAT);
  if (seated) {
    const upper = body;
    const halfBase = 7.5;
    body = (x, y) => {
      if (y + 0.5 < bcy) return upper(x, y);
      const dx = Math.max(0, Math.abs(x + 0.5 - C) - halfBase);
      return (dx / (bw - halfBase)) ** 2 + ((y + 0.5 - bcy) / bh) ** 2 <= 1;
    };
  }
  cel(g, body, BASE, SHADE, LIGHT, 3, 1);
  if (feet === "tucked") {
    for (const dx of [-5, 2]) g.rect(Math.trunc(C + dx), bottom, 4, 1, "orange");
  } else if (feet !== "hidden") {
    foot(1);
  }
  const [kind, val] = wing;
  if (kind === "raise") {
    // up and back from the top of his back, its root behind the head
    const a = radians(val);
    // foreshortened as it comes down: 19px pointing up, 14px level
    const ln = 14 + 5 * Math.min(1.0, Math.max(0.0, (val - 186) / 50));
    const sx = C - 5;
    const sy = bcy - bh * 0.45;
    cel(
      g,
      inEll(sx + Math.cos(a) * ln * 0.5, sy + Math.sin(a) * ln * 0.5, ln * 0.5, ln * 0.27, a),
      WING,
      "brown",
      null,
      1,
      1,
    );
  }
  if (kind === "dash" || kind === "double-jump") {
    // The wing pivots from its shoulder while the head, torso and feet retain the rest pose.
    let angle: number, length: number, sx: number, sy: number, halfWidth: number;
    let tipRadius: number;
    if (kind === "dash") {
      angle = [196, 218, 206][val] as number;
      length = [13, 20, 16][val] as number;
      [sx, sy, halfWidth, tipRadius] = [C + 1, bcy + 1, 4, 2];
    } else {
      angle = [218, 240, 180, 210][val] as number;
      length = [16, 18, 17, 15][val] as number;
      [sx, sy, halfWidth, tipRadius] = [C - 5, bcy - bh * 0.4, 4, 3];
    }
    const a = radians(angle);
    const wingShape: Inside = (x, y) => {
      const dx = x + 0.5 - sx;
      const dy = y + 0.5 - sy;
      const along = dx * Math.cos(a) + dy * Math.sin(a);
      const across = -dx * Math.sin(a) + dy * Math.cos(a);
      if (along < 0) return (along / 3) ** 2 + (across / halfWidth) ** 2 <= 1;
      const taper = length - tipRadius;
      if (along <= taper)
        return Math.abs(across) <= halfWidth - ((halfWidth - tipRadius) * along) / taper;
      return (along - taper) ** 2 + across ** 2 <= tipRadius ** 2;
    };
    cel(g, wingShape, WING, "brown", null, 1, 1);
  }
  cel(g, inEll(hcx, hcy, HEAD_R, headRy), BASE, SHADE, LIGHT, 3, 1);
  if (kind === "fold") {
    // on the body's side, its tip pointing back
    cel(g, inEll(C - 2, bcy + 2 + val, BRX * 0.5, BRY * 0.3, -0.3), WING, "brown", null, 1, 1);
  }
  const billH = pixel.round(5 * headSquash);
  g.rect(Math.trunc(hcx + HEAD_R - 2), Math.trunc(hcy), 7, billH, "orange"); // bill
  g.rect(Math.trunc(hcx + HEAD_R - 2), Math.trunc(hcy) + billH - 1, 7, 1, "ochre");
  const ey = Math.trunc(hcy - headRy * 0.55);
  if (eye === "dead") {
    // Ink is already the darkest palette colour; wider diagonal tips strengthen the death mark.
    ["##.##", ".###.", "..#..", ".###.", "##.##"].forEach((row, y) => {
      [...row].forEach((mark, x) => {
        if (mark === "#") g.p(Math.trunc(hcx) + x, ey + y, "ink");
      });
    });
  } else {
    g.rect(Math.trunc(hcx), eye === "open" ? ey : ey + 2, 4, eye === "open" ? 4 : 1, "ink");
  }
  return g.outlined({ edge: () => K[OUTLINE] as string });
}

// Squash and stretch: [bw, bh] keep bw * bh within 2% of the rest pose's 16.4 * 13.0 = 213.2.
export const SQUASH_CROUCH = [18.9, 11.2] as const;
export const STRETCH_LIFT = [14.4, 14.8] as const;
export const SQUASH_LAND = [19.6, 10.8] as const;
export const SQUASH_RECOVER = [17.8, 11.9] as const;

/**
 * frame rotated counter-clockwise by degrees about centre by nearest pixel, keeping its size, like
 * Pillow's rotate(degrees, NEAREST, center=centre). rotateNearest turns about the image centre, so
 * the frame is padded transparent below and right until centre is the middle, then cropped back;
 * the padding leaves every sampled row of the original frame unchanged.
 */
function rotated(
  { centre: [cx, cy], degrees }: { centre: readonly [number, number]; degrees: number },
  frame: pixel.Frame,
): pixel.Frame {
  const h = frame.length;
  const w = frame[0]?.length ?? 0;
  if (!(Number.isInteger(2 * cx) && Number.isInteger(2 * cy) && 2 * cx >= w && 2 * cy >= h))
    throw new RangeError(`centre ${cx},${cy} is not on or past the middle of a ${w}x${h} frame`);
  const padded = blankImage(2 * cx, 2 * cy);
  paste({ at: { x: 0, y: 0 } }, frameToRgba({ resolveRgb: pixel.rgb }, frame), padded);
  const image = crop({ height: h, width: w, x: 0, y: 0 }, rotateNearest(degrees, padded));
  const hex = (i: number) =>
    [...image.data.subarray(i, i + 3)].map((v) => v.toString(16).padStart(2, "0")).join("");
  return Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => {
      const i = (y * w + x) * 4;
      return image.data[i + 3] ? hex(i) : null;
    }),
  );
}

/** A pronounced clockwise tilt, with visible tucked soles and no baked world translation. */
export function fallingPose(): pixel.Frame {
  const px = draw({ bh: 12, bw: 17, eye: "closed", feet: "tucked", lift: 1, wing: ["fold", 2] });
  return rotated({ centre: [C, 29], degrees: -20 }, px);
}

export function birdTags(): pixel.Tags {
  // feet stay planted while the body rises
  const idle = [
    draw(),
    draw({
      feet: [
        [-5, -1],
        [2, -1],
      ],
      lift: 1,
    }),
  ];
  const passing = () =>
    draw({
      feet: [
        [-4, -1],
        [1, -1],
      ],
      lift: 1,
    });
  const walk = [
    draw({
      feet: [
        [-7, 0],
        [4, 2],
      ],
    }),
    passing(),
    draw({
      feet: [
        [4, 2],
        [-7, 0],
      ],
    }),
    passing(),
  ];
  const jump = [
    draw({
      bh: SQUASH_CROUCH[1],
      bw: SQUASH_CROUCH[0],
      feet: [
        [-6, 0],
        [3, 0],
      ],
      wing: ["fold", -1],
    }),
    draw({
      bh: STRETCH_LIFT[1],
      bw: STRETCH_LIFT[0],
      feet: "tucked",
      lift: 3,
      wing: ["raise", 206],
    }),
  ];
  // wing angles: up (the signature pose), back, level (the downstroke lifts the body 1px), back
  const flutter = [236, 212, 186, 212].map((a) =>
    draw({ feet: "tucked", lift: 2 + Number(a === 186), wing: ["raise", a] }),
  );
  const land = [
    draw({
      bh: SQUASH_LAND[1],
      bw: SQUASH_LAND[0],
      feet: [
        [-8, 0],
        [5, 0],
      ],
      wing: ["raise", 196],
    }),
    draw({
      bh: SQUASH_RECOVER[1],
      bw: SQUASH_RECOVER[0],
      feet: [
        [-6, 0],
        [3, 0],
      ],
      wing: ["fold", -1],
    }),
  ];
  return [
    ["idle", idle, 400],
    ["walk", walk, 130],
    ["jump", jump, [80, 100]],
    ["flutter", flutter, 100],
    ["land", land, [100, 80]],
    [
      "death",
      [
        draw({ bh: 12, bw: 17, eye: "closed", lift: 1, wing: ["fold", 2] }),
        fallingPose(),
        draw({
          bh: 8,
          bw: 19,
          eye: "closed",
          feet: "hidden",
          headSquash: 0.82,
          lift: -2,
          seated: true,
          wing: ["fold", 2],
        }),
        draw({
          bh: 10.5,
          bw: 17,
          eye: "dead",
          feet: "hidden",
          headSquash: 0.95,
          lift: -2,
          seated: true,
          wing: ["fold", 2],
        }),
      ],
      [100, 120, 80, 400],
    ],
    ["dash", [0, 1, 2].map((phase) => draw({ wing: ["dash", phase] })), [60, 130, 60]],
    [
      "double-jump",
      [0, 1, 2, 3].map((phase) => draw({ feet: "tucked", lift: 2, wing: ["double-jump", phase] })),
      60,
    ],
  ];
}

/** 64x64: his head and the top of his body facing right, cut off by the bottom edge. */
export function portrait(expr: string): pixel.Frame {
  const g = new Grid(64, 64);
  const hcx = 30.0;
  const hcy = 28.0;
  const hr = 19.0;
  cel(g, inBlob(24, 64, 34, 22, 2.6), BASE, SHADE, LIGHT, 4, 1); // the top of his body, the head set into it
  cel(g, inEll(14, 56, 13, 5.5, -0.25), WING, "brown", null, 2, 1);
  cel(g, inEll(hcx, hcy, hr, hr), BASE, SHADE, LIGHT, 4, 1);
  const by = Math.trunc(hcy + 1) + (expr === "worried" ? 2 : 0);
  g.rect(Math.trunc(hcx + hr - 4), by, 13, 9, "orange"); // bill
  g.rect(Math.trunc(hcx + hr - 4), by + 7, 13, 2, "ochre");
  const ex = Math.trunc(hcx + 1);
  const ey = Math.trunc(hcy - hr * 0.5);
  if (expr === "happy") {
    // closed: an upward arc
    [4, 2, 1, 0, 0, 1, 2, 4].forEach((dy, i) => g.rect(ex - 1 + i, ey + 1 + dy, 1, 2, "ink"));
  } else {
    g.rect(ex, ey, 7, 7, "ink");
    if (expr === "worried") {
      // brow slanting down to the back
      for (let i = 0; i < 8; i++) g.rect(ex - 2 + i, ey - 5 + Math.floor((7 - i) / 3), 1, 2, "ink");
    }
  }
  return g.outlined({ edge: () => K.ink as string });
}

export function portraitTags(): pixel.Tags {
  return ["neutral", "happy", "worried"].map((e) => [e, [portrait(e)], 1000] as const);
}

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield ["bird", birdTags()];
  yield ["portrait-bird", portraitTags()];
}

// Tags that play once and hold their last frame; every other tag loops.
export const ONCE = { bird: ["jump", "land", "death", "dash", "double-jump"] };

if (import.meta.main) {
  await pixel.main({ doc: USAGE, once: ONCE, srcDir: SRC }, sprites);
}
