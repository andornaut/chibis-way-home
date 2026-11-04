/**
 * Large planted background deer: 216x144, bottom-centre anchor (108, 144).
 *
 * Usage: node art/tools/largeWildlife.ts build | preview OUT.png, from the repository root.
 * Idle: 1000, 180, 180, 1000ms. Graze: 350, 300, 300, 650, 650, 350, 300, 350ms.
 * Both tags loop, once []. Flat woodland fauna tone, binary alpha, no outlines or interior detail.
 * Export: six columns and two rows make a 1296x288 sheet.
 * Four hoof patches at x33,46,126,138 occupy y140..143 in every frame.
 * Naturalistic compact torso, fixed planted limbs, articulated grazing neck and head.
 * Placement uses native dimensions and ordinary world camera movement. No locomotion,
 * contact mask, hitbox, portrait, interaction or dialogue.
 */

import { exportAseprite } from "@andornaut/art-kit/generate";
import { polygon } from "@andornaut/art-kit/draw";
import { blankImage } from "@andornaut/art-kit/rgbaImage";

import { commands, run } from "./cli.ts";
import * as pixel from "./pixel.ts";

const SRC = "art/scenery";
const KEY = "background-deer-large";
const USAGE = "Usage: largeWildlife.ts build | preview OUT.png";
const [W, H] = [216, 144];
const COLOUR = pixel.K["bg-woodland-fauna"] as string;
const C = { fill: [...pixel.rgb(COLOUR), 255] } as const;
const IDLE_MS = [1000, 180, 180, 1000];
const GRAZE_MS = [350, 300, 300, 650, 650, 350, 300, 350];
const ONCE: Record<string, string[]> = { [KEY]: [] };

type Path = readonly (readonly [x: number, y: number])[];

const BODY: Path = [
  [28, 77],
  [30, 70],
  [34, 66],
  [41, 64],
  [58, 64],
  [80, 63],
  [102, 62],
  [121, 61],
  [134, 59],
  [143, 61],
  [149, 67],
  [152, 77],
  [152, 88],
  [148, 99],
  [138, 104],
  [128, 103],
  [117, 98],
  [104, 95],
  [89, 94],
  [73, 95],
  [58, 97],
  [45, 98],
  [36, 96],
  [30, 90],
];
const NECK_UP: Path = [
  [127, 67],
  [139, 49],
  [158, 34],
  [173, 38],
  [159, 63],
  [148, 93],
  [137, 99],
];
const NECK_DOWN: Path = [
  [127, 67],
  [148, 66],
  [165, 85],
  [178, 109],
  [168, 119],
  [150, 100],
  [137, 98],
];
const HEAD: Path = [
  [-14, -8],
  [0, -10],
  [13, -6],
  [27, -3],
  [29, 2],
  [24, 6],
  [10, 7],
  [-4, 10],
  [-14, 5],
];

function draw(tag: string, i: number): Uint8Array {
  const im = blankImage(W, H);
  const fill = (path: Path) =>
    polygon(
      C,
      path.map(([x, y]) => ({ x, y })),
      im,
    );
  for (const dx of [13, 0]) {
    fill([
      [29 + dx, 75],
      [44 + dx, 79],
      [49 + dx, 91],
      [52 + dx, 101],
      [47 + dx, 109],
      [35 + dx, 123],
      [36 + dx, 139],
      [31 + dx, 139],
      [31 + dx, 122],
      [38 + dx, 110],
      [40 + dx, 103],
      [31 + dx, 94],
    ]);
  }
  for (const dx of [12, 0]) {
    const fore: Path = [
      [128 + dx, 75],
      [143 + dx, 78],
      [145 + dx, 99],
      [141 + dx, 111],
      [142 + dx, 127],
      [143 + dx, 139],
      [138 + dx, 139],
      [136 + dx, 125],
      [135 + dx, 110],
      [131 + dx, 100],
    ];
    fill(fore.map(([x, y]) => [x - 16, y] as const));
  }
  for (const x of [33, 46, 126, 138]) {
    fill([
      [x - 2, 140],
      [x + 3, 140],
      [x + 4, 143],
      [x - 3, 143],
    ]);
  }
  fill(BODY.map(([x, y]) => [pixel.round(28 + (x - 28) * 0.87), y] as const));
  fill([
    [34, 70],
    [25, 66],
    [20, 59 + Number(i === 3 && tag === "idle")],
    [28, 64],
    [39, 66],
  ]);
  const t = tag === "graze" ? ([0, 0.22, 0.55, 0.9, 1, 0.65, 0.28, 0][i] as number) : 0;
  const mix = ([ax, ay]: readonly [number, number], [bx, by]: readonly [number, number]) =>
    [pixel.round(ax + (bx - ax) * t), pixel.round(ay + (by - ay) * t)] as const;
  const neck = NECK_UP.map((a, k) => mix(a, NECK_DOWN[k] as readonly [number, number]));
  fill(neck.map(([x, y]) => [x - 16, y] as const));
  const [hx, hy] = mix([160, 42], [163, 113]);
  const angle = 42 * t * (Math.PI / 180);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const pt = ([x, y]: readonly [number, number]) =>
    [pixel.round(hx + x * cos - y * sin), pixel.round(hy + x * sin + y * cos)] as const;
  fill(HEAD.map(pt));
  const ear = tag === "idle" && i === 1 ? 2 : 0;
  fill(
    (
      [
        [-9, -4],
        [-17, -20 + ear],
        [-10, -19],
        [-2, -7],
      ] as Path
    ).map(pt),
  );
  fill(
    (
      [
        [0, -6],
        [7, -21],
        [11, -18],
        [7, -3],
      ] as Path
    ).map(pt),
  );
  return im.data;
}

function frame(tag: string, phase: number): pixel.Frame {
  const data = draw(tag, phase);
  return Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) => (data[(y * W + x) * 4 + 3] ? COLOUR : null)),
  );
}

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield [
    KEY,
    [
      ["idle", [0, 1, 2, 3].map((i) => frame("idle", i)), IDLE_MS],
      ["graze", [0, 1, 2, 3, 4, 5, 6, 7].map((i) => frame("graze", i)), GRAZE_MS],
    ],
  ];
}

async function build(): Promise<void> {
  const executable = pixel.which("aseprite");
  if (executable === undefined) throw new Error("aseprite is not on PATH");
  for (const [key, tags] of sprites()) {
    await exportAseprite(
      executable,
      pixel.PALETTE,
      tags,
      `${SRC}/${key}.aseprite`,
      `${pixel.SPRITES}/${key}.png`,
      `${pixel.SPRITES}/${key}.json`,
      { key, columns: 6 },
    );
    pixel.updateManifest("sprites", [
      { key, png: `sprites/${key}.png`, json: `sprites/${key}.json`, once: ONCE[key] },
    ]);
  }
  console.log("built", KEY);
}

const GROUNDS = [pixel.K["zone-green"] as string, pixel.K.forest as string];

if (import.meta.main)
  run(() =>
    commands({
      usage: USAGE,
      build,
      preview: (out) => pixel.preview({ out, grounds: GROUNDS }, [...sprites()]),
    }),
  );
