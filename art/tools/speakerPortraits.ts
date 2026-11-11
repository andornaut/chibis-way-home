/**
 * Trixi and Kiwi dialogue portraits matching their existing antagonist identities.
 *
 * Usage: node art/tools/speakerPortraits.ts build | preview OUT.png, from the repository root.
 * portrait-goose and portrait-raccoon: 48x48, facing right, transparent ground, chest cropped at
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
  const g = new Grid(48, 48);
  g.blob(16, 52, 19.5, 16.5, "cream", "lgrey", "white");
  g.ell(10.5, 49, 12, 10.5, "grey", "dslate", "lgrey");
  g.ell(21, 39, 7.5, 16.5, "cream", "lgrey", "white");
  g.ell(25.5, 26, 6, 13, "cream", "lgrey", "white");
  g.blob(28, 17, 11, 10, "cream", "lgrey", "white");
  // A tapered bill with a raised base, a nostril and an ochre lower edge.
  g.tri([36, 15], [46, 21], [35, 24], "orange");
  g.rect(36, 22, 9, 2, "ochre");
  g.rect(40, 18, 2, 1, "ochre");
  // One round lens inside the head over a visible eye; a short bridge and the temple to the crown.
  g.rect(18, 15, 8, 1, "ink");
  g.ell(30, 15.5, 4.5, 4.5, "ink");
  g.ell(30, 15.5, 3, 3, "white");
  g.rect(31, 14, 2, 3, "ink");
  g.p(28, 13, "lgrey");
  g.rect(34, 14, 3, 1, "ink");
  return g.outlined({ edge: () => pixel.hex("ink") });
}

function raccoon(): pixel.Frame {
  const g = new Grid(48, 48);
  g.blob(22.5, 53, 19, 19.5, "grey", "slate", "lgrey");
  g.ell(26, 51, 11, 16.5, "cream", "lgrey");
  for (const x of [13, 36]) {
    g.ell(x, 9, 6, 6, "grey", "slate", "lgrey");
    g.ell(x, 9, 3, 3, "ink");
  }
  g.blob(25, 22.5, 17, 15, "grey", "slate", "lgrey");
  g.ell(26, 28, 16.5, 8, "cream", "lgrey");
  g.rect(22, 9, 4, 10, "slate");
  for (const [x, y] of [
    [17, 23],
    [33, 22],
  ] as const) {
    g.ell(x, y, 6, 4.5, "ink");
    g.rect(x - 2, y - 2, 2, 2, "white");
  }
  g.ell(31, 32, 10, 6, "cream", "lgrey");
  g.rect(32, 27, 4, 2, "ink");
  g.rect(31, 34, 4, 1, "slate");
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
