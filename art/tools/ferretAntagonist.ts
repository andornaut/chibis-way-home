/**
 * Compact apartment ferret encounter skin retaining the established champagne ferret identity.
 *
 * Anticipate-lift appends load 120ms, lift 160ms and return-brace 200ms, playing once and holding
 * its final prepared pose. The visual lift stays inside the existing frame and reach envelope;
 * world position and physical movement stay unchanged. Gameplay owns the tell window. New frames
 * have exact alpha-derived contact masks.
 *
 * Frustration: four 120ms looping headshake and raised wing/paw poses, fixed feet, no world
 * displacement.
 *
 * Usage: node art/tools/ferretAntagonist.ts build | preview OUT.png, from the repository root.
 * 48x48 facing right, bottom centre (24,48), fixed hitbox (2,2,44,46), stable when mirrored.
 * Champagne and cream slender body, small wedge head, warm brown legs and tapering tail, plum
 * stovepipe with red band and red bow. Cute and sly, no teeth, red contact outline, dialogue or
 * new story details. Idle 2x400ms, walk 4x120ms, crouch 2x140ms, rush 4x80ms, rest 2x400ms. These
 * earlier tags loop. Throw 4x100ms loops: wind-up, raised paw, release, recovery; local release
 * offset 39,26. Art cycles do not set gameplay state duration or bake world movement into the
 * sprite anchor. All states are lethal. The original 64x80 story ferret and its portraits remain
 * separate and unchanged.
 */

import * as bird from "./bird.ts";
import { run } from "./cli.ts";
import * as ferret from "./ferret.ts";
import * as pixel from "./pixel.ts";
import { Grid } from "./pixel.ts";

const KEY = "ferret-antagonist";
const SRC = "art/antagonists";
const ONCE = { [KEY]: ["anticipate-lift"] };
const HITBOX: Record<string, pixel.HitboxTuple> = { [KEY]: [2, 2, 44, 46] };
const USAGE = "Usage: ferretAntagonist.ts build | preview OUT.png";
const THROW_TARGETS = [
  [24, 29],
  [29, 22],
  [39, 26],
  [34, 31],
] as const;

function draw(state = "idle", phase = 0): pixel.Frame {
  const g = new Grid(48, 48);
  const moving = state === "walk" || state === "rush";
  const low = state === "crouch" || state === "rush";
  const lift = moving || state === "idle" || state === "rest" ? phase % 2 : 0;
  let hx = low ? 33 : 29;
  const hy = low ? 27 - lift : 19 - lift;
  if (state === "frustration") {
    hx += [-2, 1, 2, -1][phase] as number;
  }
  const hip = [20, 36 - lift] as const;
  // Tail and feet keep their ground reference as the slender spine bends forward.
  ferret.discLine(g, [17, 38], [10, 44], 2, "brown");
  ferret.discLine(g, [10, 44], [5, 46], 1, "brown");
  const stride = moving ? ([-2, 0, 2, 0][phase] as number) : 0;
  for (const [x, delta, colour] of [
    [19, stride, "dbrown"],
    [26, -stride, "brown"],
  ] as const) {
    ferret.discLine(g, [x, 38 - lift], [x + delta, 44], 2, colour);
    g.rect(x + delta - 1, 44, 6, 3, colour);
  }
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    const x = hip[0] + (hx - 3 - hip[0]) * t - 3 * (1 - t) * t;
    const y = hip[1] + (hy + 4 - hip[1]) * t;
    bird.cel(g, bird.inEll(x, y, 6 - 2 * t, 6 - t), "skin1", "skin2", "cream", 1, 1);
  }
  // Compact wedge, pale face band and soft lid preserve the recognisable expression.
  bird.cel(g, bird.inEll(hx, hy, 6, 5), "skin1", "skin2", "cream", 1, 1);
  g.tri([hx, hy - 3], [hx + 10, hy + 2], [hx, hy + 4], "skin1");
  g.tri([hx, hy - 2], [hx + 9, hy + 2], [hx, hy + 2], "cream");
  g.ell(hx - 4, hy - 4, 2, 2, "skin2");
  g.rect(hx + 7, hy + 1, 2, 2, "pink");
  g.rect(hx + 1, hy - 1, 3, 3, "ink");
  g.p(hx + 1, hy - 1, "white");
  g.rect(hx + 1, hy - 2, 3, 1, "brown");
  // The hat stays upright, even during the lower committed rush.
  ferret.hat(g, hx - 1, hy - 4, 0.6);
  ferret.bowTie(g, hx - 2, hy + 6, 0.55);
  const pawX = low ? hx + 1 : hx - 4;
  g.ell(pawX, hy + 10, 2.5, 2, "brown");
  if (state === "frustration") {
    const pawY = hy + (phase % 2 === 0 ? 7 : 11);
    ferret.discLine(g, [hx - 3, hy + 9], [hx + 5, pawY], 1.8, "brown");
    g.ell(hx + 5, pawY, 3, 2.5, "brown");
  }
  if (state === "throw") {
    const target = THROW_TARGETS[phase] as (typeof THROW_TARGETS)[number];
    ferret.discLine(g, [hx - 4, hy + 9], target, 1.8, "brown");
    g.ell(target[0], target[1], 2.5, 2, "brown");
    // A light palm separates the release gesture from the connected brown forearm.
    for (let y = target[1] - 1; y < target[1] + 1; y++) {
      for (let x = target[0] - 1; x < target[0] + 1; x++) {
        if (g.px[y]?.[x] === pixel.K.brown) {
          g.p(x, y, "tan");
        }
      }
    }
  }
  if (state === "rest") {
    g.rect(hx + 1, hy, 3, 1, "skin2");
  }
  return ferret.outline(g);
}

function anticipateLift(phase: number): pixel.Frame {
  if (phase !== 1) {
    return draw("crouch", phase === 0 ? 0 : 1);
  }
  const frame = draw("idle");
  return [...frame.slice(2), ...Array.from({ length: 2 }, () => Array(48).fill(null))];
}

const STATES = [
  ["idle", 2, 400],
  ["walk", 4, 120],
  ["crouch", 2, 140],
  ["rush", 4, 80],
  ["rest", 2, 400],
  ["frustration", 4, 120],
  ["throw", 4, 100],
] as const;

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield [
    KEY,
    [
      ...STATES.map(
        ([state, count, ms]) =>
          [state, Array.from({ length: count }, (_, i) => draw(state, i)), ms] as const,
      ),
      ["anticipate-lift", [0, 1, 2].map(anticipateLift), [120, 160, 200]],
    ],
  ];
}

if (import.meta.main) {
  run(() =>
    pixel.main(
      {
        contacts: [KEY],
        doc: USAGE,
        grounds: [pixel.hex("zone-red"), pixel.hex("slate")],
        hitboxes: HITBOX,
        once: ONCE,
        srcDir: SRC,
      },
      sprites,
    ),
  );
}
