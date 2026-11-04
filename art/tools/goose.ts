/**
 * Trixi, the countryside goose antagonist with oversized glasses: a long-necked cream-and-grey
 * bird, distinct from the round bird.
 *
 * Anticipate-lift appends load 120ms, lift 160ms and return-brace 200ms, playing once and holding
 * its final prepared pose. The visual lift stays inside the existing frame and reach envelope;
 * world position and physical movement stay unchanged. Gameplay owns the tell window. New frames
 * have exact alpha-derived contact masks.
 *
 * Usage, from the repository root:
 *   node art/tools/goose.ts build
 *   node art/tools/goose.ts preview OUT.png
 *
 * goose-antagonist: 48x48, facing right and mirrored for left, bottom centre (24,48). Standing
 * feet occupy rows 45..46 with their outline on 47. All visible pixels remain inside the fixed
 * hitbox (2,2,44,46), also when mirrored. No red outline, portrait or story details are baked into
 * this asset; oversized ink glasses are the costume cue.
 *
 * A narrow upright neck, small round head, cream feather mass with pale grey shade, grey wing and
 * warm orange bill/feet distinguish the goose from the bird. Warn raises a broad wing and the
 * neck. Rush lowers the neck forward into a short committed charge; rest is still lethal, never a
 * safe state. No teeth or scary snarl.
 *
 * Tags in frame order: idle 2x400ms; walk 4x120ms; warn 2x160ms; rush 4x80ms; rest 2x400ms.
 * Frustration appends 4x120ms: a short headshake and low wing flaps, feet planted. Set-trap appends
 * 4x120ms: a groundward head and wing placement gesture; no trap type or object is depicted. All
 * earlier motion tags loop. These are art cycle defaults; gameplay owns state durations and all
 * physical movement. The build writes art/antagonists/goose-antagonist.aseprite and its PNG/JSON
 * exports.
 *
 * goose-trap: 24x12, bottom-centre 12,12, fixed contact bounds 0,8,24,4. Warning loops 4x120ms
 * with an amber edge and moving 2px yellow tick over a 1px ink rim. Armed loops 1x400ms with the
 * shared solid 4px bright-red panel on rows 8..11, transparent above. No spikes or teeth. Generic
 * gameplay owns the visible arming delay and enables collision only when armed; metadata declares
 * the fixed shape only.
 */

import * as bird from "./bird.ts";
import * as obstacles from "./obstacles.ts";
import * as pixel from "./pixel.ts";
import { Grid, K } from "./pixel.ts";

const KEY = "goose-antagonist";
const SRC = "art/antagonists";
const TRAP = "goose-trap";
const ONCE = { [KEY]: ["anticipate-lift"], [TRAP]: [] };
const HITBOX: Record<string, pixel.HitboxTuple> = {
  [KEY]: [2, 2, 44, 46],
  [TRAP]: [0, 8, 24, 4],
};
const USAGE = "Usage: goose.ts build | preview OUT.png";

type Point = readonly [number, number];

/** A smooth, connected feathered neck from overlapping three-pixel-radius discs. */
function neckShape(points: readonly Point[]): bird.Inside {
  const discs: bird.Inside[] = [];
  for (let p = 0; p + 1 < points.length; p++) {
    const [x0, y0] = points[p] as Point;
    const [x1, y1] = points[p + 1] as Point;
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const t = i / Math.max(1, steps);
      discs.push(bird.inEll(x0 + t * (x1 - x0), y0 + t * (y1 - y0), 3.2, 3.2));
    }
  }
  return (x, y) => discs.some((f) => f(x, y));
}

function draw(state = "idle", phase = 0): pixel.Frame {
  const g = new Grid(48, 48);
  const moving = state === "walk" || state === "rush";
  const rushing = state === "rush";
  const warning = state === "warn";
  const resting = state === "rest";
  const lift = moving ? phase % 2 : state === "idle" || state === "rest" ? phase : 0;
  const by = 34 - lift;
  // Feet remain the ground reference even while the torso rises on a passing pose.
  const stride = moving ? ([-2, 0, 2, 0][phase] as number) : 0;
  [17 + stride, 27 - stride].forEach((x, i) => {
    const up = moving && (phase === 0 || phase === 2) && i === Math.floor(phase / 2) ? 2 : 0;
    g.rect(x, 41 - lift, 2, 5 + lift - up, "orange");
    g.rect(x - 1, 45 - up, 5, 2, "orange");
  });
  // The warning wing is a broad feather shape, not a flash or contact marker.
  if (warning) {
    const angle = phase === 0 ? -0.65 : -0.78;
    bird.cel(g, bird.inEll(14, 20 - phase, 4, 12, angle), "lgrey", "grey", "white", 2, 1);
  }
  bird.cel(g, bird.inEll(7, by - 2, 3.8, 2.5, -0.4), "cream", "lgrey", null, 1, 1);
  bird.cel(g, bird.inEll(21, by, 14.5, 9.5), "cream", "lgrey", "white", 3, 1);
  let hx: number;
  let hy: number;
  let points: Point[];
  if (rushing) {
    [hx, hy] = [37, 25 - lift];
    points = [
      [28, by - 1],
      [31, 28 - lift],
      [34, 25 - lift],
      [hx, hy],
    ];
  } else if (warning) {
    [hx, hy] = [33 + phase, 8];
    points = [
      [28, by - 2],
      [31, 23],
      [30, 14],
      [hx, hy + 1],
    ];
  } else {
    [hx, hy] = resting ? [32, 12 - lift] : [33, 10 - lift];
    points = [
      [28, by - 2],
      [30, 23 - lift],
      [30, 16 - lift],
      [hx, hy + 1],
    ];
  }
  if (state === "set-trap") {
    [hx, hy] = (
      [
        [33, 10],
        [35, 19],
        [35, 30],
        [33, 19],
      ] as const
    )[phase] as Point;
    points = [
      [28, by - 2],
      [29, 26],
      [32, 23],
      [hx, hy + 1],
    ];
  }
  if (state === "frustration") {
    hx += [-1, 1, -1, 1][phase] as number;
    hy += [1, 0, 1, 0][phase] as number;
    points[points.length - 1] = [hx, hy + 1];
  }
  bird.cel(g, neckShape(points), "cream", "lgrey", "white", 2, 1);
  bird.cel(g, bird.inEll(hx, hy, 5.5, 5), "cream", "lgrey", "white", 2, 1);
  // A short bill and high dot eye retain a soft expression while keeping the neck unmistakable.
  g.rect(Math.trunc(hx + 4), Math.trunc(hy), 4, 3, "orange");
  g.rect(Math.trunc(hx + 4), Math.trunc(hy) + 2, 4, 1, "ochre");
  g.rect(Math.trunc(hx + 1), Math.trunc(hy - 2), 3, resting ? 1 : 3, "ink");
  if (!warning) bird.cel(g, bird.inEll(20, by + 1, 8, 4.5, -0.2), "grey", "dslate", null, 2, 1);
  if (state === "frustration") {
    const angle = phase % 2 ? -0.45 : 0.4;
    bird.cel(g, bird.inEll(19, phase % 2 ? 30 : 35, 11, 4, angle), "lgrey", "grey", "white", 2, 1);
  }
  if (state === "set-trap") {
    const y = [35, 38, 41, 38][phase] as number;
    bird.cel(g, bird.inEll(25, y, 8, 3, 0.3), "grey", "dslate", null, 2, 1);
  }
  const px = g.outlined({
    edge: (c) => (c === K.grey || c === K.dslate ? (K.navy as string) : (K.dslate as string)),
  });
  return glasses({ resting }, px, hx, hy);
}

/** Oversized paired ink rims, a short bridge and temple, contained inside the shared contact box. */
function glasses(
  { resting = false }: { resting?: boolean },
  px: pixel.Frame,
  hx: number,
  hy: number,
): pixel.Frame {
  const g = new Grid(48, 48);
  g.px = px.map((row) => [...row]);
  g.rect(hx - 9, hy - 2, 5, 2, "ink");
  for (const x of [hx - 4, hx + 3]) {
    g.ell(x, hy - 1, 4, 4, "ink");
    g.ell(x, hy - 1, 2.6, 2.6, "lgrey");
  }
  g.rect(hx - 1, hy - 2, 3, 2, "ink");
  g.rect(hx + 3, hy - 1, 2, resting ? 1 : 2, "ink");
  return g.px;
}

/** Repeat the canonical top-contact strip; only warning colour and its moving tick differ. */
function trap(state = "armed", phase = 0): pixel.Frame {
  const tile = obstacles.hazard("top");
  const red = pixel.rgb("red");
  const g = new Grid(24, 12);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 24; x++) {
      const i = (y * tile.width + (x % 12)) * 4;
      const c = [...tile.data.subarray(i, i + 4)] as [number, number, number, number];
      if (c[3]) {
        const isRed = c[0] === red[0] && c[1] === red[1] && c[2] === red[2];
        const hex = c
          .slice(0, 3)
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("");
        g.p(x, y, state === "warning" && isRed ? "amber" : hex);
      }
    }
  }
  if (state === "warning") {
    g.rect(0, 8, 24, 1, null);
    g.rect(0, 11, 24, 1, "ink");
    g.rect(2 + phase * 4, 9, 2, 2, "yellow");
  }
  return g.px;
}

function anticipateLift(phase: number): pixel.Frame {
  return draw("warn", phase === 1 ? 1 : 0);
}

const STATES = [
  ["idle", 2, 400],
  ["walk", 4, 120],
  ["warn", 2, 160],
  ["rush", 4, 80],
  ["rest", 2, 400],
  ["frustration", 4, 120],
  ["set-trap", 4, 120],
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
  yield [
    TRAP,
    [
      ["warning", [0, 1, 2, 3].map((i) => trap("warning", i)), 120],
      ["armed", [trap()], 400],
    ],
  ];
}

if (import.meta.main) {
  await pixel.main(
    {
      contacts: [KEY],
      doc: USAGE,
      grounds: [K["zone-green"] as string, K.slate as string, K.cream as string],
      hitboxes: HITBOX,
      once: ONCE,
      srcDir: SRC,
    },
    sprites,
  );
}
