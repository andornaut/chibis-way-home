/**
 * Boss removal: the puff that replaces a boss when it leaves the stage.
 *
 * Usage: node art/tools/bossRemoval.ts build | preview OUT.png, from the repository root.
 *
 * boss-removal, 64x64, centre anchor (32, 32): the game places the frame centre on the boss
 * sprite's frame centre, hides the boss at frame 0 and removes the puff after the last frame. One
 * sheet serves all six bosses in both facings: the silhouette is left-right symmetric, and the
 * sprite has no flip, hit box or contact mask. Each frame is a union of round lobes drawn back to
 * front: hazard red with a dred crescent along each lobe's lower-right rim and a cream highlight on
 * its upper left, inside a fixed 1px ink rim. Lobes of radius 3 or less are flat red with one cream
 * fleck. Opaque bounds are in frame pixels.
 *
 * | Tag  | Frame | ms  | Pose                                                               |
 * | ---- | ----- | --- | ------------------------------------------------------------------ |
 * | puff | 0     | 100 | lobed cloud, x 3-60, y 6-58: covers every boss frame, both facings |
 * | puff | 1     | 100 | swells to x 1-62: a central lobe ringed by six parting lobes       |
 * | puff | 2     | 100 | four small domed clouds on the diagonals, apart                    |
 * | puff | 3     | 100 | the four clouds smaller and further out                            |
 * | puff | 4     | 100 | eight sparse specks near the frame edges, nearly clear             |
 *
 * puff plays once (ONCE). Every lobe is red, never gold or orange, and the blobs are domed cloud
 * fragments rather than balls, so the puff does not read as a pickup.
 */

import { run } from "./cli.ts";
import * as pixel from "./pixel.ts";
import { Grid } from "./pixel.ts";

const KEY = "boss-removal";
const ONCE = { [KEY]: ["puff"] };
const SIZE = 64;
const USAGE = "Usage: bossRemoval.ts build | preview OUT.png";

/** [centre x, centre y, x radius, y radius] in frame pixels, drawn in order (later in front). */
type Lobe = readonly [cx: number, cy: number, rx: number, ry: number];

/** A round lobe on the vertical centre line. */
const mid = (cy: number, r: number): Lobe => [32, cy, r, r];

/** One lobe on each side of the vertical centre line, so the silhouette is symmetric. */
function pair(dx: number, cy: number, rx: number, ry = rx): Lobe[] {
  return [
    [32 - dx, cy, rx, ry],
    [32 + dx, cy, rx, ry],
  ];
}

/**
 * A small cloud on each side, centred dx from the vertical centre line at height cy: a domed main
 * lobe of radius r with a lower shoulder lobe in front of it on each side, so a blob reads as a
 * cloud fragment, not a ball.
 */
function blobs(dx: number, cy: number, r: number): Lobe[] {
  return [
    ...pair(dx, cy, r),
    ...pair(dx + r * 0.75, cy + r * 0.3, Math.max(2, Math.round(r * 0.65))),
    ...pair(dx - r * 0.75, cy + r * 0.35, Math.max(2, Math.round(r * 0.55))),
  ];
}

const FRAMES: readonly (readonly Lobe[])[] = [
  [
    mid(17, 10),
    ...pair(14, 19, 11, 10),
    ...pair(19, 36, 9, 15),
    [32, 33, 21, 19],
    ...pair(15, 47, 11, 10),
    mid(48, 10),
  ],
  [...pair(16, 16, 10), ...pair(21, 33, 9), mid(32, 14), ...pair(16, 48, 10)],
  [...blobs(17, 18, 8), ...blobs(17, 46, 8)],
  [...blobs(20, 14, 5), ...blobs(21, 50, 5)],
  [...pair(24, 8, 2), ...pair(28, 30, 2), ...pair(25, 56, 2), ...pair(19, 52, 1)],
];

function puff(lobes: readonly Lobe[]): pixel.Frame {
  const g = new Grid(SIZE, SIZE);
  for (const [cx, cy, rx, ry] of lobes) {
    // A lobe of radius 3 or less is too small for a crescent: flat red with one cream fleck.
    if (rx <= 3) {
      g.ell(cx, cy, rx, ry, "red");
      g.p(Math.floor(cx - rx / 2), Math.floor(cy - ry / 2), "cream");
    } else {
      g.cel(cx, cy, rx, ry, "red", "dred", "cream");
    }
  }
  return g.outlined({ edge: () => pixel.hex("ink") });
}

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield [KEY, [["puff", FRAMES.map(puff), 100]]];
}

const OPTIONS: pixel.MainOptions = { once: ONCE, usage: USAGE };

export function build(): Promise<void> {
  return pixel.build(OPTIONS, [...sprites()]);
}

if (import.meta.main) {
  run(() => pixel.main(OPTIONS, sprites));
}
