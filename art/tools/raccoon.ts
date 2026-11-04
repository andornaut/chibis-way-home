/**
 * The climbing raccoon antagonist, separate from the retained pedestrian/room cast.
 *
 * Anticipate-lift appends load 120ms, lift 160ms and return-brace 200ms, playing once and holding
 * its final prepared pose. The visual lift stays inside the existing frame and reach envelope;
 * world position and physical movement stay unchanged. Gameplay owns the tell window. New frames
 * have exact alpha-derived contact masks.
 *
 * Usage, from the repository root:
 *   node art/tools/raccoon.ts build
 *   node art/tools/raccoon.ts preview OUT.png
 *
 * raccoon-antagonist: 48x48, facing right in a three-quarter front view; mirrored for left. Fixed
 * frame-bottom centre (24, 48), feet on row 46 with outline on 47 when standing. Every limb and the
 * banded tail stay inside hitbox (2, 2, 44, 46) for all poses. Contact is always lethal; no red
 * contact outline is baked into the art.
 *
 * The round grey head, cream face band, paired ink masks, rounded ears and thick banded tail
 * identify the animal. Grey fur has slate crescents and lgrey rims; the muzzle and belly are cream.
 * A closed navy/ink outline keeps the silhouette readable against industrial lavender. No clothing,
 * names, portraits or teeth.
 *
 * Tags, in frame order:
 * - idle: 2x400ms, quiet breathing, paws lowered, feet planted.
 * - climb: 4x120ms, opposite paws grip at alternating heights, opposite feet rise, torso lifts on
 *   passing poses.
 * - prepare: 1x400ms, visibly compressed and tense before the drop, paws held against the torso.
 * - drop: 2x100ms, splayed limbs then tucked paws and feet during descent.
 * - rest: 2x400ms, settled after landing; still lethal, never a safe state.
 * - frustration: 4x120ms, head shaking and alternating raised paws, feet planted.
 * - walk: 4x120ms, alternating grounded steps and opposite swinging paws.
 * - rush: 4x80ms, lowered forward head and body, longer strides and forward reaching paws.
 *
 * All earlier motion tags loop. The generic behaviour state machine owns state timing and physical
 * movement; frame durations are art cycle defaults. Build writes
 * art/antagonists/raccoon-antagonist.aseprite and its PNG/JSON export.
 */

import { run } from "./cli.ts";
import * as pixel from "./pixel.ts";
import { Grid } from "./pixel.ts";

const SRC = "art/antagonists";
const KEY = "raccoon-antagonist";
const ONCE = { [KEY]: ["anticipate-lift"] };
const HITBOX: Record<string, pixel.HitboxTuple> = { [KEY]: [2, 2, 44, 46] };
const USAGE = "Usage: raccoon.ts build | preview OUT.png";

type Point = readonly [number, number];

/** A thick oval tail with broad alternating bands; its tip curls towards the body. */
function tail(g: Grid, lift = 0): void {
  for (let y = 34 - lift; y < 44 - lift; y++) {
    for (let x = 3; x < 21; x++) {
      if (((x + 0.5 - 12) / 8.5) ** 2 + ((y + 0.5 - (39 - lift)) / 4.3) ** 2 <= 1)
        g.p(x, y, Math.floor((x - 3) / 3) % 2 === 0 ? "cream" : "ink");
    }
  }
}

/** Three-pixel connected arm, ending in a substantial dark gripping paw. */
function arm(g: Grid, start: Point, paw: Point, far = false): void {
  const [x0, y0] = start;
  const [x1, y1] = paw;
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const t = i / Math.max(1, steps);
    g.ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 1.8, 1.8, far ? "slate" : "grey");
  }
  g.rect(x1 - 1, y1 - 1, 3, 3, "ink");
}

function draw(state = "idle", phase = 0): pixel.Frame {
  const g = new Grid(48, 48);
  const prepare = state === "prepare";
  const dropping = state === "drop";
  let lift =
    (state === "idle" || state === "rest") && phase ? 1 : state === "climb" ? phase % 2 : 0;
  const moving = state === "walk" || state === "rush";
  const rushing = state === "rush";
  if (moving) lift = phase % 2;
  if (dropping) lift = 1 + phase;
  let headLift = dropping ? 1 : lift;
  if (prepare) headLift = -3;
  if (rushing) headLift -= 3;
  tail(g, lift);
  // Far legs stand behind the round body; the near paw supplies the same ground anchor.
  let feet: readonly Point[] = [
    [22, 46],
    [32, 46],
  ];
  if (state === "climb") {
    const climbFeet: readonly (readonly Point[])[] = [
      [
        [22, 46],
        [32, 42],
      ],
      [
        [22, 45],
        [32, 45],
      ],
      [
        [22, 42],
        [32, 46],
      ],
      [
        [22, 45],
        [32, 45],
      ],
    ];
    feet = climbFeet[phase] as readonly Point[];
  } else if (moving) {
    const stride = (rushing ? [-3, 0, 3, 0] : [-2, 0, 2, 0])[phase] as number;
    feet = [
      [22 + stride, phase === 0 ? 44 : 46],
      [32 - stride, phase === 2 ? 44 : 46],
    ];
  } else if (dropping) {
    feet =
      phase === 0
        ? [
            [18, 44],
            [35, 43],
          ]
        : [
            [23, 43],
            [31, 43],
          ];
  }
  feet.forEach(([x, y], i) => {
    g.rect(x - 1, 38 - lift, 3, Math.max(1, y - (38 - lift)), i === 0 ? "slate" : "grey");
    g.rect(x - 2, y - 1, 4, 2, "ink");
  });
  let [bodyY, bodyH] = prepare ? [38, 8] : [35 - lift, 10];
  if (rushing) [bodyY, bodyH] = [37 - lift, 8];
  g.blob(26, bodyY, 10.5, bodyH, "grey", "slate", "lgrey");
  g.ell(27, bodyY + 1, 5.5, bodyH - 2, "cream");
  // Rounded ears and a large head keep the proportions distinct from the long-bodied dog.
  const shake = state === "frustration" ? ([-1, 1, -1, 1][phase] as number) : rushing ? 1 : 0;
  const hy = 18 - headLift;
  for (const x of [19 + shake, 37 + shake]) {
    g.ell(x, 9 - headLift, 4.5, 4.5, "grey", "slate");
    g.ell(x, 9 - headLift, 2.5, 2.5, "ink");
  }
  g.blob(28 + shake, hy, 13.5, 10.5, "grey", "slate", "lgrey");
  g.ell(28 + shake, hy + 3, 13, 5.5, "cream");
  g.rect(26 + shake, hy - 9, 3, 7, "slate");
  // The masks are paired patches; each carries a two-pixel square glint.
  for (const x of [21 + shake, 34 + shake]) {
    g.ell(x, hy + 1, 5, 3.7, "ink");
    g.rect(x - 1, hy - 1, 2, 2, "white");
  }
  g.blob(29 + shake, hy + 7, 6.5, 4.5, "cream");
  g.rect(28 + shake, hy + 4, 3, 2, "ink");
  g.rect(28 + shake, hy + 8, 3, 1, "slate");
  let near: Point;
  let far: Point;
  if (state === "climb") {
    const climbPaws: readonly (readonly [Point, Point])[] = [
      [
        [42, 13],
        [13, 26],
      ],
      [
        [42, 18],
        [13, 21],
      ],
      [
        [42, 25],
        [13, 11],
      ],
      [
        [42, 21],
        [13, 17],
      ],
    ];
    [near, far] = climbPaws[phase] as readonly [Point, Point];
  } else if (dropping) {
    [near, far] =
      phase === 0
        ? [
            [43, 22],
            [12, 25],
          ]
        : [
            [34, 36],
            [20, 35],
          ];
  } else if (moving) {
    if (rushing) {
      [near, far] =
        phase % 2 === 0
          ? [
              [42, 34],
              [15, 40],
            ]
          : [
              [38, 40],
              [14, 32],
            ];
    } else {
      [near, far] =
        phase % 2 === 0
          ? [
              [38, 35],
              [16, 40],
            ]
          : [
              [33, 40],
              [15, 35],
            ];
    }
  } else if (state === "frustration") {
    [near, far] =
      phase % 2 === 0
        ? [
            [42, 23],
            [13, 36],
          ]
        : [
            [40, 35],
            [12, 23],
          ];
  } else if (prepare) {
    [near, far] = [
      [35, 38],
      [20, 38],
    ];
  } else {
    [near, far] = [
      [35, 39 - lift],
      [19, 39 - lift],
    ];
  }
  arm(g, [34, 31 - lift], near);
  arm(g, [18, 31 - lift], far, true);
  return g.outlined({
    edge: (c) =>
      c === pixel.hex("cream") || c === pixel.hex("white") ? pixel.hex("ink") : pixel.hex("navy"),
  });
}

function anticipateLift(phase: number): pixel.Frame {
  if (phase !== 1) return draw("prepare");
  const frame = draw("idle");
  return [...frame.slice(2), ...Array.from({ length: 2 }, () => Array<null>(48).fill(null))];
}

const range = (count: number): number[] => Array.from({ length: count }, (_, i) => i);
const frames = (state: string, count: number): pixel.Frame[] =>
  range(count).map((i) => draw(state, i));

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield [
    KEY,
    [
      ["idle", frames("idle", 2), 400],
      ["climb", frames("climb", 4), 120],
      ["prepare", [draw("prepare")], 400],
      ["drop", frames("drop", 2), 100],
      ["rest", frames("rest", 2), 400],
      ["frustration", frames("frustration", 4), 120],
      ["walk", frames("walk", 4), 120],
      ["rush", frames("rush", 4), 80],
      ["anticipate-lift", range(3).map(anticipateLift), [120, 160, 200]],
    ],
  ];
}

if (import.meta.main)
  run(() =>
    pixel.main(
      {
        contacts: [KEY],
        doc: USAGE,
        grounds: [pixel.hex("zone-purple"), pixel.hex("slate"), pixel.hex("cream")],
        hitboxes: HITBOX,
        once: ONCE,
        srcDir: SRC,
      },
      sprites,
    ),
  );
