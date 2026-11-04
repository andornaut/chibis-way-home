/**
 * Pebble's 64x64 dialogue portrait, matching the grey/lilac/cream pigeon encounter sprite.
 *
 * Usage: node art/tools/pigeonPortrait.ts build | preview OUT.png, from the repository root.
 * One right-facing neutral frame, 1000ms loop, once []. Transparent ground, ink outline, no hitbox
 * or contact. The head and upper chest fill the existing 64x64 portrait slot; the chest crops at
 * the bottom edge.
 */

import { run } from "./cli.ts";
import * as pixel from "./pixel.ts";
import { Grid } from "./pixel.ts";

const KEY = "portrait-pigeon";
const SRC = "art/antagonists";
const USAGE = "Usage: pigeonPortrait.ts build | preview OUT.png";

function portrait(): pixel.Frame {
  const g = new Grid(64, 64);
  g.blob(26, 65, 25, 25, "grey", "slate", "lgrey");
  g.ell(41, 64, 14, 25, "cream", "zone-peach");
  g.ell(28, 43, 14, 17, "zone-purple-shade");
  g.blob(15, 61, 14, 12, "slate", null, "grey");
  g.blob(35, 25, 18, 17, "grey", "slate", "lgrey");
  g.tri([50, 29], [60, 33], [50, 36], "brown");
  g.rect(43, 20, 5, 5, "ink");
  g.rect(43, 20, 2, 2, "white");
  return g.outlined({ edge: () => pixel.hex("ink") });
}

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield [KEY, [["neutral", [portrait()], 1000]]];
}

if (import.meta.main) {
  run(() =>
    pixel.main(
      { doc: USAGE, grounds: [pixel.hex("dslate"), pixel.hex("lgrey")], srcDir: SRC },
      sprites,
    ),
  );
}
