/**
 * Small naturalistic decorative reeds, 24x24, bottom-centre 12,24. No collision or interaction.
 *
 * Usage: node art/tools/backgroundFlora.ts build | preview OUT.png, from the repository root.
 * background-reeds: sway 4x300ms LOOP, once []. Lanceolate leaves and narrow seedheads bend with
 * the wind; roots stay planted. No world translation, bright points of interest or hazard colours.
 * Gameplay owns placement and timing. Use the existing scenery animation and parallax contracts; do
 * not float rooted flora independently of its supporting ground plane. Sprite bounds 0,0,24,24, no
 * hitbox or contact mask.
 */

import { run } from "./cli.ts";
import * as pixel from "./pixel.ts";
import { Grid } from "./pixel.ts";

const KEY = "background-reeds";
const ONCE = { [KEY]: [] };
const USAGE = "Usage: backgroundFlora.ts build | preview OUT.png";

function draw(phase: number): pixel.Frame {
  const g = new Grid(24, 24);
  const bend = [-1, 0, 1, 0][phase] as number;
  for (const [root, tip, top] of [
    [10, 8, 5],
    [13, 14, 2],
    [16, 19, 8],
  ] as const) {
    for (let y = top; y < 24; y++) {
      const x = root + ((tip + bend - root) * (24 - y)) / (24 - top);
      g.rect(Math.trunc(x), y, 2, 1, "zone-green-shade");
    }
    g.rect(tip + bend, top, 2, 4, "zone-peach-shade");
  }
  for (const [[x, y], [ex, ey]] of [
    [
      [2 + bend, 10],
      [11, 22],
    ],
    [
      [21 + bend, 12],
      [15, 23],
    ],
    [
      [4 + bend, 17],
      [13, 24],
    ],
  ] as const) {
    g.tri([x, y], [ex - 1, ey], [(x + ex) / 2, (y + ey) / 2 - 2], "zone-green-shade");
    g.tri([x, y], [ex + 1, ey], [(x + ex) / 2 + 2, (y + ey) / 2], "zone-green");
  }
  return g.px;
}

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield [KEY, [["sway", [0, 1, 2, 3].map(draw), 300]]];
}

if (import.meta.main) {
  run(() =>
    pixel.main(
      {
        grounds: [pixel.hex("zone-green"), pixel.hex("forest")],
        once: ONCE,
        usage: USAGE,
      },
      sprites,
    ),
  );
}
