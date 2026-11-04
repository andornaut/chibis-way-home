/**
 * Bini: a dark-brown quadruped bear, 48x48, bottom-centre anchor (24, 48).
 *
 * Usage: node art/tools/bear.ts build | preview OUT.png, from the repository root.
 * The broad high shoulders, compact barrel body, small round ears, short muzzle, compact tail and
 * four heavy plantigrade paws define the bear's silhouette. Idle, preparation, growl, maul, rest,
 * frustration and anticipation retain four planted paw contacts. Walk and rush exchange diagonal
 * support naturally. Body poses use a dark-brown coat, plum shade, brown rim and warm pale muzzle.
 * All opaque pixels, including both facings, fit reach box (2, 2, 44, 46). Exact per-frame alpha
 * silhouettes define contact independently of that box.
 *
 * Existing tags and indices retain their frame counts and art timings: idle 2x400ms; prepare
 * 2x160ms; growl 4x120ms; walk 4x120ms; rush 4x80ms; maul 3x100ms; rest 2x400ms; frustration
 * 4x120ms; prepare-attack 2x160ms. These tags loop. Anticipate-lift appends load 120ms, grounded
 * compression 160ms and return-brace 200ms, plays once and holds its planted final pose. Gameplay
 * owns tell duration and physical movement; art adds no world displacement. The growl mouth anchor
 * remains (36, 22).
 *
 * Portrait-bear: 64x64, right-facing neutral/annoyed, one 1000ms frame each, loops. The portrait
 * retains the phone with its green road and cream/red dog motif; the quadruped world body has no
 * held phone. No new dialogue or accessory. Bear-growl-wave: unchanged 48x32, left-centre anchor
 * (0, 16), pulse 4x100ms once. Its rightward grey/cream sound arcs have no contact; runtime owns
 * the effect.
 */

import * as pixel from "./pixel.ts";
import { Grid, K } from "./pixel.ts";

const SRC = "art/antagonists";
const KEY = "bear-antagonist";
const PORTRAIT = "portrait-bear";
const WAVE = "bear-growl-wave";
const ONCE = { [KEY]: ["anticipate-lift"], [PORTRAIT]: [], [WAVE]: ["pulse"] };
const HITBOX: Record<string, pixel.HitboxTuple> = { [KEY]: [2, 2, 44, 46] };
export const MOUTH = [36, 22] as const;
const USAGE = "Usage: bear.ts build | preview OUT.png";

type Point = readonly [number, number];

function phone(g: Grid, x: number, y: number): void {
  g.rect(x, y, 9, 13, "ink");
  g.rect(x + 1, y + 1, 7, 10, "forest");
  g.rect(x + 4, y + 1, 2, 10, "zone-green");
  g.rect(x + 2, y + 4, 4, 3, "cream");
  g.rect(x + 5, y + 3, 2, 3, "cream");
  g.rect(x + 4, y + 6, 2, 2, "red");
  g.rect(x + 3, y + 11, 3, 1, "grey");
}

/** Embed the upper limb under the moving coat and taper towards the paw. */
function leg(g: Grid, far: boolean, root: Point, foot: Point): void {
  const colour = far ? "plum" : "dbrown";
  const [rx, ry] = root;
  const [fx, fy] = foot;
  const steps = Math.max(Math.abs(fx - rx), Math.abs(fy - 2 - ry));
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const width = (far ? 3 : 4) * (1 - t) + 2.5 * t;
    g.ell(rx + (fx - rx) * t, ry + (fy - 2 - ry) * t, width, 3, colour);
  }
}

function draw(state = "idle", phase = 0): pixel.Frame {
  const g = new Grid(48, 48);
  const walk = state === "walk" || state === "rush";
  const stride = walk ? ([-1, 0, 1, 0][phase] as number) : 0;
  const bob = walk
    ? ([0, 1, 0, 1][phase] as number)
    : state === "idle" || state === "rest"
      ? phase
      : 0;
  const compress =
    state === "anticipate-lift"
      ? ([1, 3, 1][phase] as number)
      : state === "prepare-attack"
        ? 1 + phase
        : state === "prepare"
          ? 1
          : 0;
  const headshift =
    state === "frustration"
      ? ([-1, 1, 0, -1][phase] as number)
      : state === "maul" && phase === 1
        ? 1
        : 0;
  const bodyY = 27 + compress - bob;
  const shoulderY = 25 + compress - bob;
  let headY = 19 + Math.min(compress, 1) - bob;
  if (state === "growl") headY = 19;
  if (state === "rest") headY += 1;
  const feet: Point[] = [];
  const roots: Point[] = [
    [12, bodyY + 4],
    [18, bodyY + 5],
    [28, shoulderY + 7],
    [34, shoulderY + 4],
  ];
  [9, 17, 29, 38].forEach((x, i) => {
    const up =
      walk && ((phase === 0 && (i === 0 || i === 2)) || (phase === 2 && (i === 1 || i === 3)))
        ? 2
        : 0;
    const xx = x + (i === 0 || i === 2 ? stride : -stride);
    const foot: Point = [xx, 44 - up];
    feet.push(foot);
    leg(g, i === 1 || i === 2, roots[i] as Point, foot);
  });
  g.ell(5, 32 + compress, 2, 2, "dbrown", "plum");
  g.blob(22, bodyY, 16, 11 - compress * 0.5, "dbrown", "plum");
  g.rect(11, 16 + compress - bob, 8, 2, "brown");
  g.ell(29, shoulderY, 10, 12 - compress * 0.5, "dbrown", "plum", "brown");
  for (const x of [26 + headshift, 37 + headshift]) {
    g.ell(x, headY - 11, 3, 3, "dbrown", "plum", "brown");
    g.ell(x, headY - 11, 1.5, 1.5, "plum");
  }
  g.blob(33 + headshift, headY, 11, 10, "dbrown", "plum", "brown");
  g.ell(38 + headshift, headY + 3, 5.5, 4, "tan", "brown", "cream");
  g.rect(41 + headshift, headY, 3, 3, "ink");
  g.rect(35 + headshift, headY - 4, 3, 3, "ink");
  g.rect(35 + headshift, headY - 4, 2, 2, "white");
  if (state === "rest") g.rect(35 + headshift, headY - 4, 3, 2, "dbrown");
  if (state === "growl" || state === "maul") {
    g.ell(36 + headshift, headY + 3, 3, 2 + (phase % 2), "ink");
    g.rect(35 + headshift, headY + 4, 3, 1, "brown");
  }
  if (state === "prepare" || state === "prepare-attack")
    g.rect(34 + headshift, headY - 6, 4, 1, "plum");
  feet.forEach(([x, y], i) => {
    const back = i === 1 || i === 2;
    g.blob(x, y, back ? 3 : 3.5, 3, back ? "plum" : "dbrown", "ink", "brown");
  });
  return g.outlined({ edge: () => K.ink });
}

function portrait(annoyed = false): pixel.Frame {
  const g = new Grid(64, 64);
  g.blob(29, 60, 24, 22, "dbrown", "plum", "brown");
  for (const x of [17, 42]) {
    g.ell(x, 15, 7, 7, "dbrown", "plum", "tan");
    g.ell(x, 15, 3, 3, "plum");
  }
  g.blob(33, 32, 22, 20, "dbrown", "plum", "brown");
  g.ell(46, 40, 13, 9, "cream", "tan");
  g.rect(53, 35, 5, 4, "ink");
  g.rect(37, 25, 4, 5, "ink");
  g.rect(37, annoyed ? 26 : 25, 2, 2, "white");
  g.rect(37, annoyed ? 24 : 22, 6, 2, "plum");
  phone(g, 45, 51);
  return g.outlined({ edge: () => K.ink });
}

function wave(phase: number): pixel.Frame {
  const g = new Grid(48, 32);
  for (const radius of [12 + phase * 2, 26 + phase * 2, 40 + phase * 2]) {
    for (let y = 3; y < 29; y++) {
      for (let x = 2; x < 46; x++) {
        const d = ((x + 10) ** 2 + ((y - 16) * 1.7) ** 2) ** 0.5;
        if (radius - 2 <= d && d <= radius) g.p(x, y, phase % 2 === 0 ? "cream" : "lgrey");
      }
    }
  }
  return g.outlined({ edge: () => K.dslate });
}

function anticipateLift(phase: number): pixel.Frame {
  return draw("anticipate-lift", phase);
}

const STATES: readonly (readonly [state: string, count: number, ms: number])[] = [
  ["idle", 2, 400],
  ["prepare", 2, 160],
  ["growl", 4, 120],
  ["walk", 4, 120],
  ["rush", 4, 80],
  ["maul", 3, 100],
  ["rest", 2, 400],
  ["frustration", 4, 120],
  ["prepare-attack", 2, 160],
];

const range = (count: number): number[] => Array.from({ length: count }, (_, i) => i);

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield [
    KEY,
    [
      ...STATES.map(
        ([state, count, ms]) =>
          [state, range(count).map((i) => draw(state, i)), ms] as pixel.AsepriteTag,
      ),
      ["anticipate-lift", range(3).map(anticipateLift), [120, 160, 200]],
    ],
  ];
  yield [
    PORTRAIT,
    [
      ["neutral", [portrait()], 1000],
      ["annoyed", [portrait(true)], 1000],
    ],
  ];
  yield [WAVE, [["pulse", range(4).map(wave), 100]]];
}

if (import.meta.main) {
  await pixel.main(
    {
      contacts: [KEY],
      doc: USAGE,
      grounds: [K["zone-green"], K.slate],
      hitboxes: HITBOX,
      once: ONCE,
      srcDir: SRC,
    },
    sprites,
  );
}
