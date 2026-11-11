/**
 * Pebble's 48x48 dialogue portrait, matching the grey/lilac/cream pigeon encounter sprite.
 *
 * Usage: node art/tools/pigeonPortrait.ts build | preview OUT.png, from the repository root.
 * One right-facing neutral frame, 1000ms loop, once []. Transparent ground, ink outline, no hitbox
 * or contact. The head and upper chest fill the 48x48 frame; the chest crops at the bottom edge.
 */

import { run } from "./cli.ts";
import * as pixel from "./pixel.ts";
import { Grid } from "./pixel.ts";

const KEY = "portrait-pigeon";
const USAGE = "Usage: pigeonPortrait.ts build | preview OUT.png";

function portrait(): pixel.Frame {
  const g = new Grid(48, 48);
  g.blob(19.5, 49, 19, 19, "grey", "slate", "lgrey");
  g.ell(31, 48, 10.5, 19, "cream", "zone-peach");
  g.ell(21, 32, 10.5, 13, "zone-purple-shade");
  g.blob(11, 46, 10.5, 9, "slate", null, "grey");
  g.blob(26, 19, 13.5, 13, "grey", "slate", "lgrey");
  g.tri([37, 22], [45, 25], [37, 27], "brown");
  g.rect(32, 15, 4, 4, "ink");
  g.rect(32, 15, 2, 2, "white");
  return g.outlined({ edge: () => pixel.hex("ink") });
}

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield [KEY, [["neutral", [portrait()], 1000]]];
}

const OPTIONS: pixel.MainOptions = {
  grounds: [pixel.hex("dslate"), pixel.hex("lgrey")],
  usage: USAGE,
};

export function build(): Promise<void> {
  return pixel.build(OPTIONS, [...sprites()]);
}

if (import.meta.main) {
  run(() => pixel.main(OPTIONS, sprites));
}
