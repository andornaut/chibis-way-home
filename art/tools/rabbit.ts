/**
 * Home-city rabbit antagonist, facing right with upright ears and a small round tail.
 *
 * Frustration: four 120ms looping headshake and raised wing/paw poses, fixed feet, no world
 * displacement.
 *
 * Usage: node art/tools/rabbit.ts build | preview OUT.png, from the repository root.
 * 48x48 frames, bottom centre (24,48), fixed mirrored hitbox (2,2,44,46) enclosing every visible
 * pixel. Soft grey-brown, cream and quiet warm ear accents distinguish the rabbit from the other
 * antagonists. Idle 2x400ms, hop 4x100ms, rest 2x400ms; all loop. Gameplay owns hop displacement
 * and state durations. Hop poses compress, extend, tuck and land without baking world movement
 * into the frame anchor. Every state remains lethal. No red contact outline, portrait, clothing,
 * name or dialogue is included.
 */

import * as bird from "./bird.ts";
import { run } from "./cli.ts";
import * as pixel from "./pixel.ts";
import { Grid, K } from "./pixel.ts";

const KEY = "rabbit-antagonist";
const SRC = "art/antagonists";
const ONCE = { [KEY]: [] };
const HITBOX: Record<string, pixel.HitboxTuple> = { [KEY]: [2, 2, 44, 46] };
const USAGE = "Usage: rabbit.ts build | preview OUT.png";
const SHAKE = [-2, 1, 2, -1] as const;
const EAR_TILT = [-0.35, 0.25, 0.35, -0.25] as const;

function draw(state = "idle", phase = 0): pixel.Frame {
  const g = new Grid(48, 48);
  const squash = state === "hop" && (phase === 0 || phase === 3);
  const tuck = state === "hop" && phase === 2;
  const resting = state === "rest";
  const lift = phase % 2 && state !== "hop" ? 1 : 0;
  let by = !tuck ? 35 - lift : 32;
  const bh = squash ? 9 : 11;
  let hx = 31;
  let hy = squash ? 25 - lift : 22 - lift;
  if (tuck) {
    hy -= 2;
  }
  if (state === "frustration") {
    by = 35;
    hx = 31 + (SHAKE[phase] as number);
    hy = 22;
  }
  // Ears stay upright and recognisable even in the compressed preparation pose.
  for (const [baseEx, ey, baseAngle] of [
    [25, hy - 10, -0.12],
    [33, hy - 11, 0.12],
  ] as const) {
    let ex = baseEx;
    let angle = baseAngle;
    if (state === "frustration") {
      ex += SHAKE[phase] as number;
      angle += EAR_TILT[phase] as number;
    }
    bird.cel(g, bird.inEll(ex, ey, 3, 6, angle), "grey", "dslate", "lgrey", 1, 1);
    g.rect(ex - 1, ey - 3, 2, 6, "tan");
  }
  bird.cel(g, bird.inEll(9, by - 1, 4, 4), "cream", "lgrey", "white", 1, 1);
  bird.cel(g, bird.inEll(22, by, 13, bh), "grey", "dslate", "lgrey", 2, 1);
  // Broad haunch and short foreleg make a rabbit silhouette rather than a dog gait.
  bird.cel(g, bird.inEll(17, by + 3, 7, 6), "lgrey", "grey", null, 2, 1);
  if (tuck) {
    bird.cel(g, bird.inEll(27, 39, 6, 3), "cream", "lgrey", null, 1, 1);
  } else {
    g.rect(14, 43, 10, 4, "cream");
    g.rect(30, !squash ? 37 : 40, 4, !squash ? 10 : 7, "lgrey");
    g.rect(29, 45, 9, 2, "cream");
  }
  bird.cel(g, bird.inEll(hx, hy, 8, 7), "grey", "dslate", "lgrey", 2, 1);
  bird.cel(g, bird.inEll(36, hy + 3, 5, 3), "cream", "lgrey", null, 1, 1);
  g.rect(38, hy + 1, 3, 2, "brown");
  g.rect(33, hy - 2, 3, resting ? 1 : 3, "ink");
  if (state === "frustration") {
    g.ell(39, phase % 2 === 0 ? 33 : 37, 3, 3, "lgrey");
  }
  return g.outlined({
    edge: (c) => (c === K.grey || c === K.dslate ? pixel.hex("navy") : pixel.hex("dslate")),
  });
}

const STATES = [
  ["idle", 2, 400],
  ["hop", 4, 100],
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

if (import.meta.main) {
  run(() =>
    pixel.main(
      {
        doc: USAGE,
        grounds: [pixel.hex("zone-peach"), pixel.hex("slate"), pixel.hex("cream")],
        hitboxes: HITBOX,
        once: ONCE,
        srcDir: SRC,
      },
      sprites,
    ),
  );
}
