/**
 * Pebble, the pigeon antagonist, and a separate falling white-block hazard. Neither adds story or
 * text.
 *
 * Anticipate-lift appends load 120ms, lift 160ms and return-brace 200ms, playing once and holding
 * its final prepared pose. The visual lift stays inside the existing frame and reach envelope;
 * world position and physical movement stay unchanged. Gameplay owns the tell window. New frames
 * have exact alpha-derived contact masks.
 *
 * Usage: node art/tools/pigeonAntagonist.ts build | preview OUT.png, from the repository root.
 * Sources: art/antagonists/. Exports: public/art/sprites/.
 *
 * pigeon-antagonist: 48x48, facing right; bottom-centre anchor 24,48. Fixed hitbox 2,2,44,46
 * contains every pose and its mirror. Perched feet end on row 46, with their outline on 47. Grey
 * and lilac feathers, a cream breast, short beak and rounded head distinguish this pigeon from
 * Chibi. No clothes or red outline. Tags in frame order: idle 2x400ms; prepare 2x160ms; fly
 * 4x100ms; drop 2x100ms; rest 2x400ms; frustration 4x120ms; swoop 4x100ms; prepare-air 2x160ms.
 * These earlier tags loop. Prepare raises the head; prepare-air tucks the feet, draws the wings
 * back and aims the head before an airborne attack. Fly flaps; drop tucks the feet and lifts the
 * tail; frustration shakes the head and flaps one wing. Generic gameplay owns movement, perching,
 * spotting, projectile release and state durations. The art does not add a physical perch.
 *
 * pigeon-poop: 12x12, full-cell hitbox 0,0,12,12, tag idle 1x400ms, loop, once []. A plain white
 * square with a 1px ink border keeps this user-approved white hazard visible on pale sky. No
 * splatter or effect.
 *
 * Preview includes a native contact sheet and an illustrative industrial-lavender scene/GIF, not a
 * simulation. The GIF shows each frame for its own tag duration.
 */

import { readFileSync, writeFileSync } from "node:fs";

import { encodeGif } from "@andornaut/art-kit/gif";
import { decodePng, encodeRgbaPng, encodeRgbPng } from "@andornaut/art-kit/png";
import {
  composite,
  crop,
  fill,
  filledImage,
  grayscale,
  resizeNearest,
} from "@andornaut/art-kit/raster";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { commands, run } from "./cli.ts";
import { frameImage, rgba } from "./imageArt.ts";
import * as pixel from "./pixel.ts";
import { Grid } from "./pixel.ts";

const SRC = "art/antagonists";
const KEY = "pigeon-antagonist";
const POOP = "pigeon-poop";
const USAGE = "Usage: pigeonAntagonist.ts build | preview OUT.png";
const ONCE = { [KEY]: ["anticipate-lift"], [POOP]: [] };
const HITBOX: Record<string, pixel.HitboxTuple> = { [KEY]: [2, 2, 44, 46], [POOP]: [0, 0, 12, 12] };
const PNG = { deflateLevel: 9, deflateStrategy: 3, filterType: -1 };
const navy = () => pixel.hex("navy");

/** Near wing's broad feather groups, with no one-pixel texture. */
function wing(g: Grid, pose: string, lift: number): void {
  if (pose === "up") {
    g.blob(14, 19 - lift, 6, 10, "grey", "slate", "lgrey");
    g.rect(9, 12 - lift, 3, 9, "slate");
    g.rect(13, 9 - lift, 2, 10, "slate");
  } else if (pose === "half") {
    g.blob(13, 27 - lift, 9, 6, "grey", "slate", "lgrey");
    g.rect(7, 27 - lift, 8, 2, "slate");
  } else if (pose === "down") {
    g.blob(17, 35 - lift, 6, 9, "grey", "slate", "lgrey");
    g.rect(13, 37 - lift, 3, 4, "slate");
  } else {
    g.blob(19, 33 - lift, 9, 6, "slate", null, "grey");
    g.rect(13, 35 - lift, 9, 2, "navy");
  }
}

/** Head below the breast and wings swept upward distinguish a contact dive from level flight. */
function swoop(phase: number): pixel.Frame {
  const g = new Grid(48, 48);
  g.tri([5, 15], [18, 16], [20, 28], "slate");
  g.blob(24, 27, 12, 10, "grey", "slate", "lgrey");
  g.ell(30, 31, 7, 8, "cream");
  for (const [x, y, rx, ry] of [
    [13, 13 + (phase % 2) * 4, 6, 9],
    [23, 16 + (phase % 2) * 4, 5, 9],
  ] as const) {
    g.blob(x, y, rx, ry, "grey", "slate", "lgrey");
    g.rect(x - 2, y - 5, 2, 8, "slate");
  }
  g.rect(22, 36, 5, 2, "pink");
  g.ell(32, 30, 7, 7, "zone-purple-shade");
  const hx = 34;
  const hy = 33 + ([0, 1, 0, -1][phase] as number);
  g.blob(hx, hy, 8, 7, "grey", "slate", "lgrey");
  g.tri([39, hy + 3], [43, hy + 8], [36, hy + 6], "brown");
  g.rect(36, hy - 1, 3, 3, "ink");
  g.rect(36, hy - 1, 2, 2, "cream");
  return g.outlined({ edge: navy });
}

/** Held airborne anticipation: tucked feet, swept-back wings and a forward/downward head aim. */
function airPose(liftWings: boolean, phase: number): pixel.Frame {
  const g = new Grid(48, 48);
  g.tri([5, 25], [19, 25], [18, 37], "slate");
  g.blob(25, 29, 12, 10, "grey", "slate", "lgrey");
  g.ell(31, 30, 7, 9, "cream");
  g.rect(23, 38, 4, 2, "pink");
  g.rect(29, 38, 4, 2, "pink");
  // Both wings draw behind the breast rather than continuing the regular wingbeat.
  if (liftWings) {
    g.blob(14, 17 - phase * 3, 6, 9, "grey", "slate", "lgrey");
    g.tri([8, 6 - phase * 2], [20, 15], [17, 27], "slate");
    g.rect(10, 10 - phase * 2, 2, 8, "slate");
  } else {
    g.blob(14, 19 - phase, 8, 7, "grey", "slate", "lgrey");
    g.tri([6, 12 - phase], [20, 18], [17, 28], "slate");
    g.rect(9, 16 - phase, 7, 2, "lgrey");
  }
  g.ell(30, 25, 7, 7, "zone-purple-shade");
  const hx = 33;
  const hy = 21 + phase;
  g.blob(hx, hy, 8, 7, "grey", "slate", "lgrey");
  g.tri([39, hy + 1], [43, hy + 6], [37, hy + 5], "brown");
  g.rect(35, hy - 2, 4, 3, "ink");
  g.rect(35, hy - 2, 2, 2, "cream");
  return g.outlined({ edge: navy });
}

function prepareAir(phase: number): pixel.Frame {
  return airPose(false, phase);
}

function wingPose(state: string, phase: number): string {
  if (state === "fly") {
    return ["up", "half", "down", "half"][phase] as string;
  }
  if (state === "drop") {
    return ["up", "half"][phase] as string;
  }
  if (state === "frustration" && phase % 2) {
    return "half";
  }
  return "folded";
}

function draw(state = "idle", phase = 0): pixel.Frame {
  if (state === "prepare-air") {
    return prepareAir(phase);
  }
  if (state === "swoop") {
    return swoop(phase);
  }
  const g = new Grid(48, 48);
  const air = state === "fly" || state === "drop";
  const lift = air
    ? ([3, 4, 3, 4][phase % 4] as number)
    : state === "idle" || state === "rest"
      ? phase % 2
      : 0;
  const shake = state === "frustration" ? ([-1, 1, -1, 1][phase] as number) : 0;
  const alert = state === "prepare" ? 1 + phase : 0;
  // A short pointed tail and upright breast supply the pigeon silhouette.
  const tailY = state === "drop" ? 29 - lift : 35 - lift;
  g.tri([5, tailY - 2], [18, tailY - 4], [17, tailY + 6], "slate");
  if (!air) {
    for (const x of [21, 29]) {
      g.rect(x, 41, 2, 5, "pink");
      g.rect(x - 2, 45, 6, 2, "pink");
    }
  } else {
    for (const x of [24, 30]) {
      g.rect(x, 39 - lift, 4, 2, "pink");
    }
  }
  g.blob(25, 33 - lift, 13, 11, "grey", "slate", "lgrey");
  g.ell(31, 33 - lift, 7, 10, "cream");
  g.ell(29, 25 - lift, 7, 7, "zone-purple-shade");
  wing(g, wingPose(state, phase), lift);
  const hx = 30 + shake;
  const hy = 17 - lift - alert;
  g.blob(hx, hy, 9, 8, "grey", "slate", "lgrey");
  g.tri([hx + 8, hy + 1], [hx + 13, hy + 4], [hx + 8, hy + 5], "brown");
  // A soft dot eye, never an angry brow; alert and rest use distinct eye shapes.
  if (state === "rest") {
    g.rect(hx + 3, hy - 1, 4, 1, "ink");
  } else {
    g.rect(hx + 3, hy - 3, state === "prepare" ? 4 : 3, 3, "ink");
    g.rect(hx + 3, hy - 3, 2, 2, "cream");
  }
  return g.outlined({ edge: navy });
}

function poop(): pixel.Frame {
  const g = new Grid(12, 12);
  g.rect(0, 0, 12, 12, "ink");
  g.rect(1, 1, 10, 10, "white");
  return g.px;
}

function anticipateLift(phase: number): pixel.Frame {
  return airPose(phase === 1, phase === 0 ? 0 : 1);
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const STATES = [
  ["idle", 2, 400],
  ["prepare", 2, 160],
  ["fly", 4, 100],
  ["drop", 2, 100],
  ["rest", 2, 400],
  ["frustration", 4, 120],
  ["swoop", 4, 100],
  ["prepare-air", 2, 160],
] as const;

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield [
    KEY,
    [
      ...STATES.map(
        ([state, count, ms]) => [state, range(count).map((i) => draw(state, i)), ms] as const,
      ),
      ["anticipate-lift", range(3).map(anticipateLift), [120, 160, 200]],
    ],
  ];
  yield [POOP, [["idle", [poop()], 400]]];
}

/** Fill the inclusive box x0, y0 to x1, y1 with colour c. */
function box(target: RgbaImage, x0: number, y0: number, x1: number, y1: number, c: string): void {
  fill({ rect: { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 } }, rgba(c), target);
}

function context(bird: RgbaImage, state = "idle", phase = 0): RgbaImage {
  const im = filledImage(rgba("zone-purple"), 720, 360);
  for (const [x, y, w] of [
    [0, 110, 150],
    [170, 150, 130],
    [470, 95, 180],
    [650, 150, 70],
  ] as const) {
    box(im, x, y, x + w, 260, "zone-purple-shade");
  }
  box(im, 0, 260, 719, 359, "dslate");
  box(im, 0, 260, 719, 260, "navy");
  box(im, 0, 261, 719, 262, "white");
  // Plain post illustrates placement only; the reusable physical structure belongs to gameplay.
  box(im, 215, 220, 238, 259, "slate");
  box(im, 215, 220, 238, 220, "navy");
  box(im, 215, 221, 238, 222, "white");
  const px = ["idle", "prepare", "rest", "frustration"].includes(state) ? 203 : 300;
  const py = px === 203 ? 172 : 120;
  composite({ x: px, y: py }, frameImage(draw(state, phase)), im);
  composite({ x: 440, y: 218 }, bird, im);
  if (state === "drop") {
    composite({ x: 319, y: 174 + phase * 10 }, frameImage(poop()), im);
  }
  return im;
}

async function preview(out: string): Promise<void> {
  const tags: pixel.Tags = ([...sprites()][0] as pixel.SpriteEntry)[1];
  const sheet = filledImage(rgba("zone-purple"), 720, Math.max(360, tags.length * 56 + 16));
  tags.forEach(([, frames], row) => {
    frames.forEach((px, col) =>
      composite({ x: 24 + col * 72, y: 8 + row * 56 }, frameImage(px), sheet),
    );
  });
  composite({ x: 368, y: 24 }, frameImage(poop()), sheet);
  writeFileSync(out, encodeRgbaPng(PNG, sheet));
  const stem = out.replace(/\.[^./]*$/, "");
  const bird = crop(
    { x: 0, y: 0, width: 48, height: 42 },
    decodePng(readFileSync("public/art/sprites/bird.png")),
  );
  const scene = context(bird, "prepare-air", 0);
  writeFileSync(`${stem}-context.png`, encodeRgbaPng(PNG, scene));
  writeFileSync(`${stem}-phone.png`, encodeRgbaPng(PNG, resizeNearest(864, 432, scene)));
  // The luma plane as an opaque grey image.
  const luma = grayscale(scene).data;
  const grey = filledImage([0, 0, 0, 255], scene.width, scene.height);
  luma.forEach((v, i) => grey.data.set([v, v, v], i * 4));
  writeFileSync(`${stem}-grey.png`, encodeRgbPng(PNG, grey));
  const frames = tags.flatMap(([state, poses]) => poses.map((_, i) => context(bird, state, i)));
  const durations = tags.flatMap(([, poses, ms]) =>
    poses.map((_, i) => (typeof ms === "number" ? ms : ((ms as readonly number[])[i] as number))),
  );
  writeFileSync(`${stem}.gif`, encodeGif({ loop: 0, durations }, frames));
}

if (import.meta.main) {
  run(() =>
    commands({
      usage: USAGE,
      build: () =>
        pixel.build({ contacts: [KEY], hitboxes: HITBOX, once: ONCE, srcDir: SRC }, [...sprites()]),
      preview,
    }),
  );
}
