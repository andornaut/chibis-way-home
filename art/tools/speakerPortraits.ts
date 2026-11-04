/**
 * Trixi and Kiwi dialogue portraits matching their existing antagonist identities.
 *
 * Usage: node art/tools/speakerPortraits.ts build | preview OUT.png, from the repository root.
 * portrait-goose and portrait-raccoon: 64x64, facing right, transparent ground, chest cropped at
 * the bottom and one ink outer contour. Each has one neutral 1000ms looping frame, once []. Use the
 * standard unmirrored dialogue portrait slot with its top-left origin. Neither portrait declares a
 * hitbox, contact mask or slice. Trixi retains cream feathers, a long neck, grey wing, orange bill
 * and oversized ink-rimmed glasses. Kiwi retains rounded ears, grey/slate fur, paired ink masks, a
 * cream face band and muzzle, and white eye glints, without accessories.
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
  g.blob(39, 22, 14, 12, "cream", "lgrey", "white");
  g.tri([49, 23], [61, 29], [48, 33], "orange");
  g.rect(49, 30, 9, 2, "ochre");
  g.rect(23, 19, 11, 2, "ink");
  for (const x of [33, 48]) {
    g.ell(x, 21, 8, 7, "ink");
    g.ell(x, 21, 6, 5, "lgrey");
    g.rect(x, 19, 3, 4, "ink");
    g.rect(x - 3, 18, 2, 2, "white");
  }
  g.rect(40, 19, 3, 2, "ink");
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

if (import.meta.main) {
  run(() =>
    pixel.main(
      { grounds: [pixel.hex("dslate"), pixel.hex("lgrey")], once: ONCE, usage: USAGE },
      sprites,
    ),
  );
}
