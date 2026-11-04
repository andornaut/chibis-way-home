/**
 * Cute owl antagonist, 48x48, bottom-centre anchor 24,48. No portrait, dialogue or species
 * physics.
 *
 * Frustration: four 120ms looping headshake and raised wing/paw poses, fixed feet, no world
 * displacement.
 *
 * Usage: node art/tools/owl.ts build | preview OUT.png, from the repository root. Every pose uses
 * hitbox 2,2,44,46, including mirrors. Idle 2x400ms, prepare 2x160ms, drop 2x100ms, return
 * 4x120ms, rest 2x400ms; all loop, once []. Prepare lowers the head; drop spreads wings for the
 * swoop; return alternates wingbeats; rest settles. All states retain the ordinary lethal-contact
 * runtime meaning. No red outline or state paint. Grey/cream face discs, quiet brown breast and
 * dark rounded wings distinguish the owl from the bird. Flight wings remain inside the same 48px
 * footprint. Sprite state motion does not alter the collision box.
 */

import { run } from "./cli.ts";
import * as pixel from "./pixel.ts";
import { Grid } from "./pixel.ts";

const SRC = "art/antagonists";
const KEY = "owl-antagonist";
const ONCE = { [KEY]: [] };
const HITBOX: Record<string, pixel.HitboxTuple> = { [KEY]: [2, 2, 44, 46] };
const USAGE = "Usage: owl.ts build | preview OUT.png";

function draw(state = "idle", phase = 0): pixel.Frame {
  const g = new Grid(48, 48);
  const flying = state === "drop" || state === "return";
  let lift = flying ? 2 + (phase % 2) : state === "idle" || state === "rest" ? phase : -1 - phase;
  if (state === "frustration") lift = 0;
  if (flying) {
    const up = state === "return" && phase % 2 === 0;
    for (const x of [9, 39]) g.ell(x, up ? 20 : 32, 5, up ? 13 : 8, "grey", "slate", "lgrey");
  }
  g.blob(24, 34 - lift, 11, 11, "zone-peach-shade", "brown", "grey");
  g.ell(24, 36 - lift, 7, 8, "cream", "zone-peach");
  if (!flying) {
    for (const x of [15, 33]) {
      g.ell(
        x,
        state === "frustration" ? (phase % 2 === 0 ? 24 : 31) : 33 - lift,
        state === "frustration" ? 5 : 4,
        9,
        "grey",
        "slate",
        "lgrey",
      );
    }
  }
  const hx = state === "frustration" ? ([-2, 1, 2, -1][phase] as number) : 0;
  const hy = 18 - lift;
  g.blob(24 + hx, hy, 14, 12, "grey", "slate", "lgrey");
  for (const eyeX of [18, 30]) {
    const x = eyeX + hx;
    g.ell(x, hy + 1, 6.5, 8, "cream", "zone-peach");
    g.ell(x, hy + 1, 3, 4, "ink");
    g.rect(x - 1, hy - 1, 2, 2, "white");
  }
  g.tri([21 + hx, hy + 5], [27 + hx, hy + 5], [24 + hx, hy + 10], "brown");
  // Feet stay visible without suggesting a perch or a standable wing edge.
  for (const x of [19, 28]) g.rect(x, flying ? 42 : 44, 3, 3, "brown");
  return g.outlined({ edge: () => pixel.hex("navy") });
}

const STATES = [
  ["idle", 2, 400],
  ["prepare", 2, 160],
  ["drop", 2, 100],
  ["return", 4, 120],
  ["rest", 2, 400],
  ["frustration", 4, 120],
] as const;

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield [
    KEY,
    STATES.map(
      ([state, count, ms]) =>
        [state, Array.from({ length: count }, (_, i) => draw(state, i)), ms] as const,
    ),
  ];
}

if (import.meta.main)
  run(() =>
    pixel.main(
      {
        doc: USAGE,
        grounds: [pixel.hex("zone-green"), pixel.hex("slate"), pixel.hex("cream")],
        hitboxes: HITBOX,
        once: ONCE,
        srcDir: SRC,
      },
      sprites,
    ),
  );
