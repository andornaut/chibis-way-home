/**
 * Cool pastel route-map assets, with six themed destinations and standard modal controls.
 *
 * Usage, from the repository root:
 *   node art/tools/map.ts build            write Aseprite sources, PNG/JSON and manifest entries
 *   node art/tools/map.ts preview OUT.png  contact sheet on pale steel, cream and slate
 *
 * The map uses a 720x360 view and six 35x35 zone markers, centred on the 12px grid:
 * Blue cityscape (126,90), Industrial outskirts (354,90), Countryside (582,90), Woodland (582,222),
 * Home city (354,222), Apartment (126,222). The route follows that order without forks.
 *
 * map-paper is a 32x32 nine-slice, margins 13,13,13,13, with a pale steel lgrey face and grey/slate
 * rules. Meaningful marks use dslate, navy or slate. Selection never uses lethal red.
 * map-zone keeps its existing tags and frame positions: normal cream disc with a dslate ring;
 * current adds an outer dslate ring; visited is navy with a cream tick badge; locked replaces the
 * icon with a dslate padlock; unbuilt is a broken slate ring and question mark. Shape carries each
 * state as well as colour.
 *
 * map-icon-<destination> is 14x14, centred over normal/current/visited nodes. Both tags use a muted
 * primary backing, an ink landmark and a dslate edge; the visited marker supplies its completion
 * tick. Locked/unbuilt nodes show no icon. The street and generic zone icons remain available.
 * map-region-<destination> is a 120x60 static illustration placed at cx-60, cy-36, behind paths and
 * markers. These decorative buildings, fields and trees keep destination identity visible while its
 * marker is locked or unbuilt. No region depicts a playable layout.
 *
 * Paths and labels are runtime drawings. Open paths are 4px solid dslate; built, locked paths are
 * 2px slate dashes (6 on, 4 off); unbuilt paths are 2x2 slate dots every 6px. Zone names use
 * font-title at 2x, ink, with at most 212px of visible ink, centred under their markers. Visible
 * capitals occupy cy+20..29, with an lgrey knock-out behind.
 * Back to title is ui-button at 164,300,192,48; Continue is ui-button-primary at 364,300,192,48.
 *
 * map-bird remains 26x22 with idle 2x400ms, centred on the current node and standing on its top
 * ring. Legacy map-fork and pen marks remain available but the six-zone V1 route needs no fork
 * markers.
 *
 * The stage picker reuses the content-fitted ui-settings-card, with a zone heading and standard
 * 24x24 close X included in the measured content union. Add 16px outer padding on all four sides.
 * Its two 48px stage buttons use equal widths derived from their actual labels and the shared
 * control padding. The latest available stage uses ui-button-primary with white text; the other
 * uses ui-button with ink. It opens only when more than one stage is unlocked. Close, back and
 * outside taps return to the map.
 */

import * as pixel from "./pixel.ts";
import { Grid } from "./pixel.ts";
import * as zoneThemes from "./zoneThemes.ts";

const SRC = "art/map";
const USAGE = "Usage: map.ts build | preview OUT.png";

type Points = (readonly [number, number])[];

/** A bitmap from strings: '#' is set. */
function bm(...rows: readonly string[]): Points {
  const points: Points = [];
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "#") points.push([x, y]);
    });
  });
  return points;
}

function stamp(g: Grid, pts: Points, x: number, y: number, c: string): void {
  for (const [px, py] of pts) g.p(x + px, y + py, c);
}

/** A filled disc on a centre pixel, 2r+1 across. */
function disc(g: Grid, cx: number, cy: number, r: number, c: string): void {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) g.p(cx + x, cy + y, c);
}

/** A ring w px thick whose outer edge is radius r; broken leaves eight gaps, one every 45 degrees. */
function ring(
  { broken = false }: { broken?: boolean },
  g: Grid,
  cx: number,
  cy: number,
  r: number,
  w: number,
  c: string,
): void {
  for (let y = -r - 1; y < r + 2; y++)
    for (let x = -r - 1; x < r + 2; x++) {
      // Integer coordinates: the square root of the exact sum is correctly rounded, like math.hypot.
      const distance = Math.sqrt(x * x + y * y);
      if (r - w + 0.5 < distance && distance <= r + 0.5) {
        if (broken && (Math.atan2(y, x) * (180 / Math.PI) + 360) % 45 > 30) continue;
        g.p(cx + x, cy + y, c);
      }
    }
}

function diamond(g: Grid, cx: number, cy: number, r: number, c: string): void {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) if (Math.abs(x) + Math.abs(y) <= r) g.p(cx + x, cy + y, c);
}

// ---------------------------------------------------------------- paper

/** 32x32 nine-slice: pale steel, a 2px slate rule 6px in and a 2px grey rule 11px in. */
function paper(): pixel.Frame {
  const g = new Grid(32, 32);
  g.rect(0, 0, 32, 32, "lgrey");
  for (const [inset, c] of [
    [6, "slate"],
    [11, "grey"],
  ] as const) {
    const n = 32 - 2 * inset;
    g.rect(inset, inset, n, 2, c);
    g.rect(inset, 32 - inset - 2, n, 2, c);
    g.rect(inset, inset, 2, n, c);
    g.rect(32 - inset - 2, inset, 2, n, c);
  }
  g.rect(13, 13, 6, 6, "lgrey");
  return g.px;
}

/** 20x11: a hill's outline, a 2px stroke stepping 2px per 2px. */
function hill(): pixel.Frame {
  const g = new Grid(20, 11);
  for (let i = 0; i < 10; i++) g.rect(i * 2, Math.trunc(Math.abs(i - 4.5) * 2), 2, 2, "tan");
  return g.px;
}

/** 22x4: three 2px humps. */
function wave(): pixel.Frame {
  const g = new Grid(22, 4);
  [2, 0, 0, 2, 2, 0, 0, 2, 2, 0, 0].forEach((dy, i) => g.rect(i * 2, dy, 2, 2, "tan"));
  return g.px;
}

/** 25x33: an N over a four-point star, arms tapering from 3px to 1px. */
function compass(): pixel.Frame {
  const g = new Grid(25, 33);
  stamp(g, bm("##..##", "###.##", "######", "##.###", "##..##"), 9, 0, "tan");
  const cx = 12;
  const cy = 20;
  for (let k = 0; k < 13; k++) {
    const w = k < 4 ? 3 : k < 9 ? 2 : 1;
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ] as const) {
      const x = cx + dx * k;
      const y = cy + dy * k;
      if (dx === 0) g.rect(x - Math.floor(w / 2), y, w, 1, "tan");
      else g.rect(x, y - Math.floor(w / 2), 1, w, "tan");
    }
  }
  diamond(g, cx, cy, 3, "tan");
  return g.px;
}

// ---------------------------------------------------------------- icons, 14x14, 2px strokes

const ICONS: Record<string, readonly string[]> = {
  street: [
    "##############",
    "##############",
    "##..........##",
    "##..##..##..##",
    "##..##..##..##",
    "##..........##",
    "##..##..##..##",
    "##..##..##..##",
    "##..........##",
    "##...####...##",
    "##...####...##",
    "##...####...##",
    "##############",
    "##############",
  ],
  // a map pin: a ring on a point
  zone: [
    "....######....",
    "...########...",
    "..###....###..",
    "..##......##..",
    "..##......##..",
    "..##......##..",
    "..###....###..",
    "...########...",
    "....######....",
    ".....####.....",
    ".....####.....",
    "......##......",
    "......##......",
    "..............",
  ],
  // Small landmarks use thick clusters and a different silhouette for each destination.
  apartment: [
    "..##########..",
    "..##########..",
    "..##..##..##..",
    "..##..##..##..",
    "..##########..",
    "..##..##..##..",
    "..##..##..##..",
    "..##########..",
    "..##..##..##..",
    "..##..##..##..",
    "..##########..",
    "..###....###..",
    "..###....###..",
    "..##########..",
  ],
  "blue-cityscape": [
    "......####....",
    "......####....",
    "..####.##.####",
    "..####.##.####",
    "..##...##...##",
    "..##...##...##",
    "..####.##.####",
    "..####.##.####",
    "..##...##...##",
    "..##...##...##",
    "..####.##.####",
    "..####.##.####",
    "..############",
    "..############",
  ],
  countryside: [
    "......##......",
    "....######....",
    "..##########..",
    "##############",
    "##..........##",
    "##...####...##",
    "##...####...##",
    "##...####...##",
    "##############",
    "..............",
    "##############",
    "##############",
    "..##########..",
    "....######....",
  ],
  "home-city": [
    "...##.........",
    "...##.##......",
    "....######....",
    "...########...",
    "..##########..",
    ".############.",
    "##..........##",
    "##..##..##..##",
    "##..##..##..##",
    "##..........##",
    "##...####...##",
    "##...####...##",
    "##############",
    "##############",
  ],
  industrial: [
    "..##..........",
    "..##..........",
    "..##..##..##..",
    "..##.###.###..",
    "..##########..",
    "..##########..",
    "..##..##..##..",
    "..##..##..##..",
    "..##########..",
    "..##########..",
    "..###....###..",
    "..###....###..",
    "..##########..",
    "..##########..",
  ],
  woodland: [
    "...##....##...",
    "..####..####..",
    ".############.",
    "##############",
    "..####..####..",
    ".############.",
    "##############",
    "##############",
    "...##....##...",
    "...##....##...",
    "...##....##...",
    "...##....##...",
    "..####..####..",
    "..####..####..",
  ],
};

function outlinedBlock(g: Grid, colour: string, box: readonly [number, number, number, number]) {
  const [x, y, w, h] = box;
  g.rect(x, y, w, h, "dslate");
  g.rect(x + 1, y + 1, w - 2, h - 2, colour);
}

/** 120x60 theme fragments, predominantly the destination's muted primary, with a clear marker opening. */
function region(kind: string): pixel.Frame {
  const g = new Grid(120, 60);
  const primary = (zoneThemes.THEMES[kind] as zoneThemes.Theme).primary;
  const shade = `${primary}-shade`;
  if (["blue-cityscape", "home-city", "apartment", "industrial"].includes(kind)) {
    if (kind === "industrial") {
      for (const x of [2, 86]) {
        outlinedBlock(g, primary, [x + 4, 10, 7, 26]);
        g.tri([x, 34], [x + 18, 22], [x + 34, 34], "dslate");
        g.tri([x + 2, 34], [x + 18, 24], [x + 32, 34], primary);
        outlinedBlock(g, primary, [x, 34, 32, 24]);
        g.rect(x + 2, 50, 28, 6, shade);
        g.rect(x + 8, 40, 4, 4, "dslate");
        g.rect(x + 20, 40, 4, 4, "dslate");
      }
    } else if (kind === "home-city") {
      for (const x of [2, 86]) {
        g.tri([x, 30], [x + 16, 18], [x + 32, 30], "dslate");
        g.tri([x + 3, 29], [x + 16, 20], [x + 29, 29], shade);
        outlinedBlock(g, primary, [x + 3, 30, 26, 28]);
        g.rect(x + 6, 48, 20, 2, shade);
        g.rect(x + 8, 36, 4, 6, "dslate");
        g.rect(x + 20, 36, 4, 6, "dslate");
      }
    } else if (kind === "apartment") {
      for (const x of [6, 94]) {
        outlinedBlock(g, primary, [x, 8, 20, 50]);
        for (const y of [16, 28, 40]) {
          g.rect(x + 4, y, 4, 4, "dslate");
          g.rect(x + 12, y, 4, 4, "dslate");
        }
        g.rect(x + 8, 50, 6, 7, shade);
      }
    } else {
      for (const [x, w, top] of [
        [2, 20, 20],
        [22, 14, 6],
        [86, 16, 14],
        [102, 16, 28],
      ] as const) {
        outlinedBlock(g, primary, [x, top, w, 58 - top]);
        g.rect(x + 2, 50, w - 4, 6, shade);
      }
    }
  } else if (kind === "countryside") {
    for (const x of [0, 82]) {
      g.tri([x, 44], [x + 18, 34], [x + 37, 44], "dslate");
      g.tri([x + 2, 44], [x + 18, 36], [x + 35, 44], primary);
      outlinedBlock(g, primary, [x, 44, 38, 14]);
      g.rect(x + 4, 48, 29, 2, shade);
      g.rect(x + 10, 54, 26, 2, shade);
    }
  } else if (kind === "woodland") {
    for (const [x, y] of [
      [12, 34],
      [28, 42],
      [92, 38],
      [108, 30],
    ] as const) {
      g.rect(x - 2, y + 2, 4, 20, "dslate");
      g.tri([x, y - 22], [x - 12, y + 6], [x + 12, y + 6], "dslate");
      g.tri([x, y - 19], [x - 10, y + 5], [x + 10, y + 5], primary);
      g.tri([x, y - 14], [x - 12, y + 14], [x + 12, y + 14], "dslate");
      g.tri([x, y - 11], [x - 10, y + 13], [x + 10, y + 13], primary);
      g.rect(x - 6, y + 10, 12, 2, shade);
    }
  }
  return g.px;
}

const QMARK = bm(
  "..####..",
  ".##..##.",
  ".....##.",
  "....##..",
  "...##...",
  "...##...",
  "........",
  "...##...",
  "...##...",
);
const TICK = bm("....##", "...##.", "##.##.", ".###..", "..#...");
const LOCK = bm(
  "...####...",
  "..######..",
  ".##....##.",
  ".##....##.",
  ".##....##.",
  "##########",
  "##########",
  "####..####",
  "####..####",
  "#####.####",
  "##########",
  "##########",
);

function icon(c: string, primary: string | undefined, rows: readonly string[]): pixel.Frame {
  const g = new Grid(14, 14);
  if (primary) {
    // A muted primary backing keeps its colour visible between the dark landmark's bold strokes.
    g.rect(0, 0, 14, 14, "dslate");
    g.rect(1, 1, 12, 12, primary);
    stamp(g, bm(...rows), 0, 0, "ink");
  } else {
    stamp(g, bm(...rows), 0, 0, c);
  }
  return g.px;
}

// ---------------------------------------------------------------- markers

function zone(state: string): pixel.Frame {
  const g = new Grid(35, 35);
  const c = 17;
  if (state === "unbuilt") {
    disc(g, c, c, 12, "cream");
    ring({ broken: true }, g, c, c, 12, 2, "slate");
    stamp(g, QMARK, c - 4, c - 4, "slate");
    return g.px;
  }
  if (state === "current") ring({}, g, c, c, 17, 2, "dslate");
  if (state === "visited") {
    disc(g, c, c, 12, "navy");
    disc(g, 27, 26, 6, "cream");
    ring({}, g, 27, 26, 6, 2, "dslate");
    stamp(g, TICK, 24, 24, "dslate");
    return g.px;
  }
  disc(g, c, c, 12, "cream");
  ring({}, g, c, c, 12, 2, "dslate");
  if (state === "locked") stamp(g, LOCK, c - 5, c - 6, "dslate");
  return g.px;
}

function fork(state: string): pixel.Frame {
  const g = new Grid(29, 29);
  const c = 14;
  if (state === "unbuilt") {
    for (const [dx, dy] of [
      [0, -7],
      [0, 7],
      [-7, 0],
      [7, 0],
    ] as const)
      diamond(g, c + dx, c + dy, 2, "slate");
    return g.px;
  }
  if (state === "current") ring({}, g, c, c, 14, 2, "dslate");
  diamond(g, c, c, 8, "navy");
  if (state !== "visited") diamond(g, c, c, 5, "cream");
  return g.px;
}

/** 26x22, facing right; frame 1 lifts everything but the feet 1px. */
function bird(frame: number): pixel.Frame {
  const up = frame;
  const g = new Grid(26, 22);
  g.ell(10.5, 13.5 - up, 9.5, 6.5, "cream", "tan", "white");
  g.tri([1.5, 9 - up], [6, 10 - up], [3, 13 - up], "cream");
  g.ell(16.5, 6.5 - up, 5, 5, "cream", null, "white");
  g.rect(21, 6 - up, 3, 3, "orange");
  g.rect(17, 5 - up, 2, 2, "ink");
  g.ell(8.5, 12.5 - up, 5, 2, "tan");
  g.rect(7, 20, 3, 1, "orange");
  g.rect(12, 20, 3, 1, "orange");
  return g.outlined({ edge: () => pixel.K.dslate });
}

// ---------------------------------------------------------------- the set

const SLICES: Record<string, pixel.Margins> = { "map-paper": [13, 13, 13, 13] };
const ONCE: Record<string, readonly string[]> = {};

export function* sprites(): Generator<pixel.SpriteEntry> {
  const one = (frame: pixel.Frame, tag = "rest"): pixel.Tags => [[tag, [frame], 100]];
  yield ["map-compass", one(compass())];
  yield ["map-bird", [["idle", [bird(0), bird(1)], 400]]];
  yield [
    "map-fork",
    ["normal", "current", "visited", "unbuilt"].map((s) => [s, [fork(s)], 100] as const),
  ];
  yield ["map-hill", one(hill())];
  for (const key of Object.keys(ICONS).sort()) {
    const primary = Object.hasOwn(zoneThemes.THEMES, key)
      ? (zoneThemes.THEMES[key] as zoneThemes.Theme).primary
      : undefined;
    const rows = ICONS[key] as readonly string[];
    yield [
      `map-icon-${key}`,
      [
        ["normal", [icon("dslate", primary, rows)], 100],
        ["visited", [icon("cream", primary, rows)], 100],
      ],
    ];
  }
  yield ["map-paper", one(paper())];
  for (const key of Object.keys(zoneThemes.THEMES).sort())
    yield [`map-region-${key}`, one(region(key))];
  yield ["map-wave", one(wave())];
  yield [
    "map-zone",
    ["normal", "current", "visited", "locked", "unbuilt"].map((s) => [s, [zone(s)], 100] as const),
  ];
}

if (import.meta.main) {
  await pixel.main(
    {
      doc: USAGE,
      grounds: ["c0cbdc", "ead4aa", "5a6988"],
      once: ONCE,
      slices: SLICES,
      srcDir: SRC,
    },
    sprites,
  );
}
