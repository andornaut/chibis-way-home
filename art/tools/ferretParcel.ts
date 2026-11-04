/**
 * Fert's active thrown parcel: 24x24 canvas, bottom-centre 12,24, visible 16x16 at hitbox
 * 4,8,16,16.
 *
 * Usage: node art/tools/ferretParcel.ts build | preview OUT.png, from the repository root.
 * Tag idle 1x400ms LOOP, once []. Ink 1px outside edge encloses a canonical red 2px danger band,
 * then simple brown cardboard and cream tape. No spikes, text or new mechanics. Runtime owns arc,
 * spawn and lifetime; no travel is baked into the single frame. This active projectile differs
 * from nonlethal opening parcels.
 */

import { run } from "./cli.ts";
import * as pixel from "./pixel.ts";
import { Grid } from "./pixel.ts";

const KEY = "ferret-parcel";
const ONCE = { [KEY]: [] };
const HITBOX: Record<string, pixel.HitboxTuple> = { [KEY]: [4, 8, 16, 16] };
const USAGE = "Usage: ferretParcel.ts build | preview OUT.png";

function draw(): pixel.Frame {
  const g = new Grid(16, 16);
  g.rect(0, 0, 16, 16, "ink");
  g.rect(1, 1, 14, 14, "red");
  g.rect(3, 3, 10, 10, "brown");
  g.rect(3, 3, 10, 2, "zone-peach");
  g.rect(7, 3, 2, 10, "cream");
  g.rect(3, 8, 10, 2, "cream");
  const padded = new Grid(24, 24);
  g.px.forEach((row, y) =>
    row.forEach((colour, x) => {
      if (colour) {
        padded.p(x + 4, y + 8, colour);
      }
    }),
  );
  return padded.px;
}

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield [KEY, [["idle", [draw()], 400]]];
}

if (import.meta.main) {
  run(() =>
    pixel.main(
      {
        doc: USAGE,
        grounds: [pixel.hex("zone-red"), pixel.hex("slate")],
        hitboxes: HITBOX,
        once: ONCE,
      },
      sprites,
    ),
  );
}
