/**
 * The first antagonist dog and its dialogue portrait, facing right with no baked hazard outline.
 *
 * Anticipate-lift appends load 120ms, lift 160ms and return-brace 200ms, playing once and holding
 * its final prepared pose. The visual lift stays inside the existing frame and reach envelope;
 * world position and physical movement stay unchanged. Gameplay owns the tell window. New frames
 * have exact alpha-derived contact masks.
 *
 * Usage: node art/tools/antagonists.ts build | preview OUT.png, from the repository root.
 * Sources: art/antagonists/. Exports: public/art/sprites/.
 *
 * dog-antagonist is Archie, an Australian Shepherd with a brown coat, white blaze, ruff and paws.
 * Frame 60x40, feet on row 39; all visible pixels stay inside hitbox x2,y2,width56,height38.
 * Contact is lethal in every state, including crouch and rest. The game does not draw a red
 * contact rectangle or silhouette outline; the hitbox remains collision metadata.
 * Tags: idle 2x400ms; walk 4x120ms; crouch 1x400ms; rush 2x80ms; rest 2x400ms;
 * frustration 4x120ms; pounce 4x100ms. These earlier tags loop; gameplay owns state duration and
 * the pounce arc. The torso clears the ground above straight chibi legs, tapering into white
 * stockings and small paws. Hindlegs attach near the rump; forelegs attach beneath the shoulder.
 * Walk exchanges diagonal pairs; rush alternates extension and gathered limbs.
 * Crouch bends the limbs beneath the lowered torso. Frustration lifts the torso 3px then 5px with
 * folded ears kept inside the frame, a headshake and lifted forepaw, followed by a planted landing.
 * Pounce uses a crouched takeoff, two extended airborne poses and a compressed landing.
 * Rest closes the eye. Idle breath lifts the torso 1px while the feet stay planted.
 * All frame alpha is paired with exact contact silhouettes and requires physics review when
 * changed.
 *
 * portrait-dog is 64x64, right-facing towards text, transparent behind, chest cut off at the
 * bottom, with one ink outer line. Tag neutral: 1x1000ms. It shares the brown and white coat, rose
 * ears, red bandana and sky/amber eyes.
 */

import { arc, ellipse, line, point, polygon, rectangle } from "@andornaut/art-kit/draw";
import { composite, fill, type Rgba } from "@andornaut/art-kit/raster";
import { blankImage, type RgbaImage } from "@andornaut/art-kit/rgbaImage";

import { run } from "./cli.ts";
import { rgba } from "./imageArt.ts";
import * as pixel from "./pixel.ts";

const SRC = "art/antagonists";
const USAGE = "Usage: antagonists.ts build | preview OUT.png";
const ONCE = { "dog-antagonist": ["anticipate-lift"], "portrait-dog": [] };
const HITBOX: Record<string, pixel.HitboxTuple> = { "dog-antagonist": [2, 2, 56, 38] };
const CLEAR: Rgba = [0, 0, 0, 0];

type Xy = readonly [x: number, y: number];
/** Hindleg and foreleg offsets, then their lifts. */
type Stride = readonly [rear: number, front: number, rearLift: number, frontLift: number];

const WALK: readonly Stride[] = [
  [-3, 3, 0, 0],
  [0, 0, -3, 2],
  [3, -3, 0, 0],
  [0, 0, 2, -3],
];
const RUSH: readonly Stride[] = [
  [-6, 7, -2, -5],
  [4, -3, -5, 0],
];

/** Drawing helpers on one image: flat x, y coordinates and inclusive boxes. */
function drawer(image: RgbaImage) {
  const points = (xy: readonly Xy[]) => xy.map(([x, y]) => ({ x, y }));
  const box = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });
  return {
    polygon: (xy: readonly Xy[], colour: string) =>
      polygon({ fill: rgba(colour) }, points(xy), image),
    ellipse: (b: readonly [number, number, number, number], colour: string) =>
      ellipse({ fill: rgba(colour) }, box(...b), image),
    rectangle: (b: readonly [number, number, number, number], colour: string) =>
      rectangle({ fill: rgba(colour) }, box(...b), image),
    arc: (
      b: readonly [number, number, number, number],
      start: number,
      end: number,
      colour: string,
      width = 1,
    ) => arc({ fill: rgba(colour), width }, box(...b), start, end, image),
    line: (xy: readonly Xy[], colour: string, width = 1) =>
      line({ fill: rgba(colour), width }, points(xy), image),
    point: (xy: Xy, colour: string) => point(rgba(colour), points([xy]), image),
  };
}

/** Keep straight chibi legs attached to the rump and shoulder inside the fixed frame. */
function dogImage(state: string, phase = 0): RgbaImage {
  const im = blankImage(60, 40);
  let d = drawer(im);
  const crouch = state === "crouch" || (state === "pounce" && (phase === 0 || phase === 3));
  const airborne = state === "pounce" && (phase === 1 || phase === 2);
  const rush = state === "rush" || airborne;
  const hop = state === "frustration" ? ([0, 3, 5, 0][phase] as number) : 0;
  const bob = (state === "patrol" || state === "rest") && phase % 2 ? -1 : 0;
  let by = (crouch ? 20 : rush ? 16 : 14) + bob - hop;
  let hy = (crouch ? 13 : rush ? 10 : 6) + bob - hop;
  if (airborne) {
    by -= 3;
    hy -= 3;
  }
  if (state === "pounce" && phase === 3) {
    by += 2;
    hy += 2;
  }
  if (state === "frustration") hy = Math.max(5, hy + ([1, 0, 1, 2][phase] as number));
  // The bobtail attaches at the rump, above the hindlimb roots.
  d.polygon(
    [
      [5, by + 3],
      [11, by + 4],
      [13, by + 10],
      [6, by + 10],
      [3, by + 7],
    ],
    "plum",
  );
  d.polygon(
    [
      [5, by + 4],
      [10, by + 5],
      [11, by + 8],
      [6, by + 8],
    ],
    "brown",
  );
  d.rectangle([4, by + 5, 6, by + 7], "white");

  const limb = ([x, y]: Xy, [ax, ay]: Xy, [tx, ty]: Xy, far = false) => {
    // Straight chibi legs taper gently from the rump or shoulder into small white paws.
    d.polygon(
      [
        [x - 2, y],
        [x + 2, y],
        [ax + 2, ay],
        [tx + 3, ty - 2],
        [tx + 3, ty],
        [ax - 2, ty],
        [ax - 2, ay],
      ],
      "plum",
    );
    d.line(
      [
        [x, y + 1],
        [ax, ay],
      ],
      far ? "dbrown" : "brown",
      3,
    );
    d.line(
      [
        [ax, ay - 2],
        [ax, ty - 1],
        [tx + 2, ty - 1],
      ],
      far ? "lgrey" : "white",
      2,
    );
  };

  const ground = 39 - hop - (airborne ? 3 : 0);
  // Each table gives straight hindleg and foreleg strokes for a diagonal pair.
  let [rear, front, rearLift, frontLift] = [0, 0, 0, 0];
  if (state === "walk") {
    [rear, front, rearLift, frontLift] = WALK[phase] as Stride;
  } else if (rush) {
    [rear, front, rearLift, frontLift] = RUSH[phase % 2] as Stride;
  }
  if (state === "frustration" && (phase === 1 || phase === 2)) frontLift = -6;
  // Far legs remain visible in the belly gap and exchange support with the near pair.
  limb(
    [17, by + 9],
    [20 - rear, ground + frontLift - 2],
    [20 - rear, ground + frontLift - 1],
    true,
  );
  limb(
    [34, by + 8],
    [31 - front, ground + rearLift - 2],
    [31 - front, ground + rearLift - 1],
    true,
  );
  // The belly clears the ground so the four legs read as limbs rather than white blocks.
  d.ellipse([9, by, 41, by + 15], "plum");
  d.ellipse([10, by + 1, 40, by + 14], "dbrown");
  d.ellipse([10, by + 1, 38, by + 11], "brown");
  d.arc([11, by + 1, 37, by + 12], 190, 275, "skin2", 2);
  d.polygon(
    [
      [31, by + 2],
      [39, by + 2],
      [44, by + 10],
      [39, by + 16],
      [34, by + 15],
      [29, by + 9],
    ],
    "lgrey",
  );
  d.polygon(
    [
      [32, by + 2],
      [38, by + 2],
      [42, by + 9],
      [37, by + 14],
      [33, by + 12],
      [30, by + 8],
    ],
    "white",
  );
  limb([12, by + 8], [12 + rear, ground + rearLift - 2], [12 + rear, ground + rearLift]);
  limb([38, by + 8], [38 + front, ground + frontLift - 2], [38 + front, ground + frontLift]);
  // A broad skull, folded rose ears and projecting white muzzle retain Archie's identity.
  const shake = state === "frustration" ? ([-1, 1, -1, 0][phase] as number) : 0;
  const head = blankImage(im.width, im.height);
  d = drawer(head);
  d.polygon(
    [
      [39, hy + 4],
      [43, hy - 3],
      [48, hy + 5],
    ],
    "plum",
  );
  d.polygon(
    [
      [40, hy + 3],
      [43, hy - 1],
      [46, hy + 4],
    ],
    "dbrown",
  );
  d.ellipse([31, hy, 53, hy + 20], "plum");
  d.ellipse([32, hy + 1, 52, hy + 19], "brown");
  d.polygon(
    [
      [44, hy + 1],
      [47, hy + 2],
      [48, hy + 10],
      [51, hy + 14],
      [42, hy + 14],
      [44, hy + 7],
    ],
    "white",
  );
  d.polygon(
    [
      [44, hy + 11],
      [54, hy + 10],
      [57, hy + 12],
      [57, hy + 16],
      [52, hy + 19],
      [44, hy + 18],
      [41, hy + 15],
    ],
    "plum",
  );
  d.polygon(
    [
      [44, hy + 12],
      [54, hy + 11],
      [56, hy + 13],
      [56, hy + 15],
      [51, hy + 17],
      [44, hy + 17],
      [43, hy + 15],
    ],
    "white",
  );
  d.rectangle([54, hy + 11, 57, hy + 13], "ink");
  d.polygon(
    [
      [32, hy + 5],
      [34, hy - 2],
      [41, hy + 3],
      [38, hy + 11],
      [34, hy + 10],
    ],
    "plum",
  );
  d.polygon(
    [
      [33, hy + 5],
      [35, hy],
      [39, hy + 4],
      [37, hy + 9],
      [35, hy + 8],
    ],
    "brown",
  );
  d.polygon(
    [
      [35, hy],
      [31, hy + 3],
      [37, hy + 4],
    ],
    "dbrown",
  );
  d.polygon(
    [
      [33, hy + 18],
      [46, hy + 20],
      [39, hy + 24],
    ],
    "red",
  );
  d.polygon(
    [
      [39, hy + 21],
      [46, hy + 20],
      [39, hy + 24],
    ],
    "dred",
  );
  if (state === "rest") {
    d.line(
      [
        [47, hy + 7],
        [50, hy + 7],
      ],
      "ink",
    );
  } else {
    d.rectangle([47, hy + 5, 50, hy + 9], "ink");
    d.rectangle([47, hy + 6, 49, hy + 8], "sky");
    d.rectangle([49, hy + 7, 50, hy + 8], "ink");
    d.point([47, hy + 6], "white");
  }
  composite({ x: shake, y: 0 }, head, im);
  // Keep all poses inside the declared reach box, including the hop's raised ears.
  fill({ rect: { x: 0, y: 0, width: 2, height: 40 } }, CLEAR, im);
  fill({ rect: { x: 58, y: 0, width: 2, height: 40 } }, CLEAR, im);
  fill({ rect: { x: 0, y: 0, width: 60, height: 2 } }, CLEAR, im);
  return im;
}

function pixels(im: RgbaImage): pixel.Frame {
  const hex = (v: number) => v.toString(16).padStart(2, "0");
  return Array.from({ length: im.height }, (_, y) =>
    Array.from({ length: im.width }, (_, x) => {
      const i = (y * im.width + x) * 4;
      const p = im.data;
      return p[i + 3]
        ? `${hex(p[i] as number)}${hex(p[i + 1] as number)}${hex(p[i + 2] as number)}`
        : null;
    }),
  );
}

function portraitImage(): RgbaImage {
  const im = blankImage(64, 64);
  const d = drawer(im);
  d.ellipse([12, 33, 54, 85], "ink");
  d.ellipse([13, 34, 53, 84], "lgrey");
  d.ellipse([13, 34, 50, 82], "white");
  // High rose ears have a forward folded tip, rather than a long drop to the jaw.
  d.polygon(
    [
      [15, 22],
      [19, 3],
      [32, 13],
    ],
    "ink",
  );
  d.polygon(
    [
      [17, 20],
      [20, 5],
      [30, 13],
    ],
    "brown",
  );
  d.polygon(
    [
      [20, 5],
      [12, 11],
      [22, 12],
    ],
    "dbrown",
  );
  d.polygon(
    [
      [43, 19],
      [48, 3],
      [57, 16],
    ],
    "ink",
  );
  d.polygon(
    [
      [44, 18],
      [48, 5],
      [55, 15],
    ],
    "brown",
  );
  d.polygon(
    [
      [48, 5],
      [58, 10],
      [48, 12],
    ],
    "dbrown",
  );
  d.ellipse([15, 10, 57, 47], "ink");
  d.ellipse([16, 11, 56, 46], "dbrown");
  d.ellipse([16, 11, 53, 43], "brown");
  d.arc([17, 12, 52, 42], 190, 275, "skin2", 2);
  // An asymmetric blaze widens into a white muzzle between the odd-coloured eyes.
  d.polygon(
    [
      [42, 11],
      [46, 12],
      [47, 25],
      [51, 32],
      [39, 32],
      [43, 23],
    ],
    "white",
  );
  d.ellipse([36, 28, 62, 44], "ink");
  d.ellipse([37, 29, 61, 43], "lgrey");
  d.ellipse([37, 29, 60, 41], "white");
  d.rectangle([56, 29, 61, 33], "plum");
  d.rectangle([56, 29, 58, 30], "dbrown");
  for (const [x, y, iris, width] of [
    [35, 22, "sky", 5],
    [49, 21, "amber", 4],
  ] as const) {
    d.rectangle([x, y, x + width, y + 5], "ink");
    d.rectangle([x + 1, y + 1, x + width - 1, y + 4], iris);
    d.rectangle([x + width - 2, y + 3, x + width - 1, y + 4], "ink");
    d.rectangle([x + 1, y + 1, x + 2, y + 2], "white");
    d.line(
      [
        [x, y - 1],
        [x + width, y - 1],
      ],
      "ochre",
    );
  }
  d.polygon(
    [
      [17, 44],
      [52, 44],
      [35, 62],
    ],
    "ink",
  );
  d.polygon(
    [
      [19, 45],
      [50, 45],
      [35, 60],
    ],
    "red",
  );
  d.polygon(
    [
      [35, 47],
      [50, 45],
      [35, 60],
    ],
    "dred",
  );
  d.point([14, 22], "ink");
  return im;
}

function anticipateLift(phase: number): pixel.Frame {
  return pixels(phase === 1 ? dogImage("frustration", 2) : dogImage("crouch"));
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export function* sprites(): Generator<pixel.SpriteEntry> {
  yield [
    "dog-antagonist",
    [
      ["idle", range(2).map((i) => pixels(dogImage("patrol", i))), 400],
      ["walk", range(4).map((i) => pixels(dogImage("walk", i))), 120],
      ["crouch", [pixels(dogImage("crouch"))], 400],
      ["rush", range(2).map((i) => pixels(dogImage("rush", i))), 80],
      ["rest", range(2).map((i) => pixels(dogImage("rest", i))), 400],
      ["frustration", range(4).map((i) => pixels(dogImage("frustration", i))), 120],
      ["pounce", range(4).map((i) => pixels(dogImage("pounce", i))), 100],
      ["anticipate-lift", range(3).map(anticipateLift), [120, 160, 200]],
    ],
  ];
  yield ["portrait-dog", [["neutral", [pixels(portraitImage())], 1000]]];
}

if (import.meta.main)
  run(() =>
    pixel.main(
      { contacts: ["dog-antagonist"], doc: USAGE, hitboxes: HITBOX, once: ONCE, srcDir: SRC },
      sprites,
    ),
  );
