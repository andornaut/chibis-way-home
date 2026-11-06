/**
 * Trixi and Kiwi dialogue portraits matching their existing antagonist identities.
 *
 * Usage: node art/tools/speakerPortraits.ts build | preview OUT.png, from the repository root.
 * portrait-goose and portrait-raccoon: 64x64, facing right, transparent ground, chest cropped at
 * the bottom and one ink outer contour. Each has one neutral 1000ms looping frame, once []. Use the
 * standard unmirrored dialogue portrait slot with its top-left origin. Neither portrait declares a
 * hitbox, contact mask or slice. Trixi retains cream feathers, a long neck, grey wing, orange bill
 * and round ink-rimmed glasses: one lens over a white eye and ink pupil, sized within the head.
 * Kiwi retains rounded ears, grey/slate fur, paired ink masks, a cream face band and muzzle, and
 * white eye glints, without accessories.
 */

import { run } from "./cli.ts";
import * as pixel from "./pixel.ts";
import { Grid } from "./pixel.ts";

const ONCE = { "portrait-goose": [], "portrait-raccoon": [] };
const USAGE = "Usage: speakerPortraits.ts build | preview OUT.png";

function goose(): pixel.Frame {
  const g = new Grid(64, 64);
  g.blob(21, 70, 26, 22, "cream", "lgrey", "white");
  g.ell(14, 65, 16, 14, "grey", "dslate", "lgrey");
  g.ell(28, 52, 10, 22, "cream", "lgrey", "white");
  g.ell(34, 35, 8, 17, "cream", "lgrey", "white");
  g.blob(37, 23, 15, 13, "cream", "lgrey", "white");
  // A tapered bill with a raised base, a nostril and an ochre lower edge.
  g.tri([48, 20], [62, 28], [47, 32], "orange");
  g.rect(48, 29, 12, 3, "ochre");
  g.rect(53, 24, 2, 1, "ochre");
  // One round lens inside the head over a visible eye; a short bridge and the temple to the crown.
  g.rect(24, 19, 11, 2, "ink");
  g.ell(40, 20, 6, 6, "ink");
  g.ell(40, 20, 4, 4, "white");
  g.rect(41, 18, 3, 4, "ink");
  g.rect(37, 17, 2, 2, "lgrey");
  g.rect(45, 18, 4, 2, "ink");
  return g.outlined({ edge: () => pixel.hex("ink") });
}

function raccoon(): pixel.Frame {
  const g = new Grid(64, 64);
  g.blob(30, 71, 25, 26, "grey", "slate", "lgrey");
  g.ell(35, 68, 15, 22, "cream", "lgrey");
  for (const x of [17, 48]) {
    g.ell(x, 12, 8, 8, "grey", "slate", "lgrey");
    g.ell(x, 12, 4, 4, "ink");
  }
  g.blob(33, 30, 23, 20, "grey", "slate", "lgrey");
  g.ell(35, 37, 22, 11, "cream", "lgrey");
  g.rect(30, 12, 5, 14, "slate");
  for (const [x, y] of [
    [23, 31],
    [44, 29],
  ] as const) {
    g.ell(x, y, 8, 6, "ink");
    g.rect(x - 2, y - 3, 2, 2, "white");
  }
  g.ell(41, 43, 13, 8, "cream", "lgrey");
  g.rect(43, 36, 5, 3, "ink");
  g.rect(41, 45, 6, 1, "slate");
  return g.outlined({ edge: () => pixel.hex("ink") });
}

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield ["portrait-goose", [["neutral", [goose()], 1000]]];
  yield ["portrait-raccoon", [["neutral", [raccoon()], 1000]]];
}

const OPTIONS: pixel.MainOptions = {
  grounds: [pixel.hex("dslate"), pixel.hex("lgrey")],
  once: ONCE,
  usage: USAGE,
};

export function build(): Promise<void> {
  return pixel.build(OPTIONS, [...sprites()]);
}

if (import.meta.main) {
  run(() => pixel.main(OPTIONS, sprites));
}
