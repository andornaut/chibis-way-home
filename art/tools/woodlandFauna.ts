/**
 * Naturalistic decorative woodland fauna. No actors, collision, dialogue, plot or interaction.
 *
 * Usage: node art/tools/woodlandFauna.ts build | preview OUT.png, from the repository root.
 * background-deer 32x24, bottom-centre 16,24: idle 2x900ms and graze 4x300ms, all loop, once [].
 * Adult body, small head, slender neck and tapered planted legs with fixed hoof patches. Muted
 * coat, no clothes or exaggerated eyes.
 * background-swallow 144x96, centre 72,48: flight 4x120ms loop, once []. Flat zone-fauna
 * silhouette with pointed swept wings, a long forked tail and a small head and streamlined body.
 * Animation contains pose changes only; gameplay owns placement and movement. Native dimensions
 * also define viewport intersection. Neither sprite declares a hitbox or contact mask. Tech owns
 * decorative background depth and parallax.
 */

import { ellipse, polygon } from "@andornaut/art-kit/draw";
import { channel } from "@andornaut/art-kit/raster";
import { blankImage } from "@andornaut/art-kit/rgbaImage";

import { run } from "./cli.ts";
import * as pixel from "./pixel.ts";
import { Grid } from "./pixel.ts";

const USAGE = "Usage: woodlandFauna.ts build | preview OUT.png";
const ONCE = { "background-deer": [], "background-swallow": [] };
const ON = { fill: [255, 255, 255, 255] } as const;

type Path = readonly (readonly [x: number, y: number])[];

function deer(state = "idle", phase = 0): pixel.Frame {
  const g = new Grid(32, 24);
  for (const [root, foot, far] of [
    [9, 9, false],
    [12, 14, true],
    [20, 20, true],
    [23, 23, false],
  ] as const) {
    const colour = far ? "plum" : "dbrown";
    if (root < 16) {
      g.tri([root - 1, 13], [root + 3, 16], [foot + 1, 19], colour);
      g.rect(foot, 18, 2, 2, colour);
    } else {
      g.tri([root - 1, 13], [root + 2, 14], [foot + 1, 19], colour);
    }
    g.rect(foot + 1, 18, 1, 5, colour);
    g.rect(foot, 22, 2, 2, colour);
  }
  g.ell(15, 12, 9, 4, "dbrown");
  g.ell(14, 12, 7, 2, "zone-peach-shade");
  g.tri([7, 11], [3, 9], [4, 12], "dbrown");
  if (state === "graze") {
    const hy = 17 + ([0, 1, 2, 1][phase] as number);
    g.tri([21, 9], [28, hy - 2], [24, hy + 2], "dbrown");
    g.ell(27, hy, 4, 2, "dbrown");
    g.rect(29, hy, 2, 2, "plum");
    g.tri([25, hy - 1], [24, hy - 6], [27, hy - 3], "dbrown");
  } else {
    g.tri([20, 13], [23, 4], [26, 9], "dbrown");
    g.ell(27, 5, 4, 2, "dbrown");
    g.rect(29, 5, 2, 2, "plum");
    g.rect(24 + phase, 0, 2, 5, "dbrown");
  }
  return g.px;
}

const WINGS: readonly Path[] = [
  [
    [88, 46],
    [99, 41],
    [89, 31],
    [72, 19],
    [48, 8],
    [30, 2],
    [44, 18],
    [56, 32],
    [69, 43],
    [78, 49],
  ],
  [
    [88, 47],
    [100, 41],
    [86, 34],
    [69, 26],
    [42, 15],
    [15, 11],
    [32, 23],
    [49, 35],
    [69, 46],
    [78, 50],
  ],
  [
    [88, 44],
    [100, 48],
    [98, 60],
    [78, 79],
    [35, 91],
    [54, 73],
    [66, 57],
    [76, 46],
  ],
  [
    [88, 47],
    [101, 42],
    [87, 30],
    [64, 17],
    [32, 10],
    [48, 27],
    [62, 41],
    [72, 48],
  ],
];
const FAR_WINGS: readonly Path[] = [
  [
    [90, 42],
    [96, 27],
    [84, 10],
    [71, 8],
    [75, 28],
    [75, 43],
  ],
  [
    [92, 43],
    [93, 31],
    [79, 24],
    [51, 30],
    [73, 41],
  ],
  [
    [90, 48],
    [94, 60],
    [81, 75],
    [62, 79],
    [69, 62],
    [74, 49],
  ],
  [
    [91, 43],
    [96, 30],
    [80, 16],
    [65, 18],
    [73, 34],
    [77, 43],
  ],
];

/** Native swept-wing silhouette, keeping the head, torso and forked tail stable in flight. */
function swallow(phase: number): pixel.Frame {
  // A binary mask: white drawn on a clear image, read back from its alpha.
  const mask = blankImage(144, 96);
  const shape = (path: Path) =>
    polygon(
      ON,
      path.map(([x, y]) => ({ x, y })),
      mask,
    );
  shape(FAR_WINGS[phase] as Path);
  shape([
    [8, 30],
    [58, 41],
    [67, 47],
    [50, 50],
    [22, 43],
  ]);
  shape([
    [8, 67],
    [60, 54],
    [67, 47],
    [51, 47],
    [22, 55],
  ]);
  ellipse(ON, { x0: 54, y0: 40, x1: 119, y1: 57 }, mask);
  ellipse(ON, { x0: 111, y0: 34, x1: 129, y1: 49 }, mask);
  shape([
    [126, 38],
    [138, 41],
    [128, 44],
  ]);
  shape(WINGS[phase] as Path);
  const alpha = channel(3, mask).data;
  const colour = pixel.hex("bg-woodland-fauna");
  return Array.from({ length: 96 }, (_, y) =>
    Array.from({ length: 144 }, (_, x) => (alpha[y * 144 + x] ? colour : null)),
  );
}

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield [
    "background-deer",
    [
      ["idle", [0, 1].map((i) => deer("idle", i)), 900],
      ["graze", [0, 1, 2, 3].map((i) => deer("graze", i)), 300],
    ],
  ];
  yield ["background-swallow", [["flight", [0, 1, 2, 3].map(swallow), 120]]];
}

if (import.meta.main) {
  run(() =>
    pixel.main(
      {
        doc: USAGE,
        grounds: [pixel.hex("zone-green"), pixel.hex("forest")],
        once: ONCE,
      },
      sprites,
    ),
  );
}
