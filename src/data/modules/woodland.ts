import { redCeiling } from "../chunkTemplates.ts";
import type { ChunkModule, Instance, TerrainRect } from "../types/index.ts";

// Woodland halves on the lower route (row 80). The gust ravine fills the right half and its
// lookout the left half in front of it. Neither holds an encounter.
const ROWS = 120;

const floor = (col: number, cols: number, row: number): TerrainRect => ({
  col,
  cols,
  look: "ground",
  row,
  rows: ROWS - row,
});

const red = (col: number, cols: number, row: number): readonly Instance[] => [
  { character: "red-edge-top", col, cols, role: "edge-top", row: row - 1 },
  { character: "red-edge-support", col, cols, role: "support", row, rows: ROWS - row },
];

// A broad root terrace holds safe observation and recovery on either side of a warned vent.
const ventTerrace: ChunkModule = {
  difficulty: 4,
  encounters: 0,
  entry: { row: 80 },
  exit: { row: 80 },
  id: "woodland-vent-terrace",
  objects: [{ character: "warned-vent", col: 14, row: 70 }],
  route: {
    profile: "recovery",
    targets: [
      { at: { col: 11, row: 76 }, xRange: { max: 11, min: 10 } },
      { at: { col: 20, row: 76 }, xRange: { max: 21, min: 20 } },
    ],
  },
  sides: ["left", "right"],
  solids: [floor(0, 6, 80), floor(6, 18, 76), floor(24, 6, 80)],
  zones: ["woodland"],
};

// A raised bough returns to grounded recovery before a separate root climb.
const boughReturn: ChunkModule = {
  difficulty: 2,
  encounters: 0,
  entry: { row: 80 },
  exit: { row: 80 },
  id: "woodland-bough-return",
  objects: [{ character: "platform-ledge", col: 6, cols: 6, role: "ledge", row: 76 }],
  route: {
    profile: "recovery",
    targets: [
      { at: { col: 9, row: 76 } },
      { at: { col: 15, row: 80 }, xRange: { max: 15, min: 14 } },
      { at: { col: 21, row: 75 } },
    ],
  },
  sides: ["left", "right"],
  solids: [floor(0, 18, 80), floor(18, 6, 75), floor(24, 6, 80)],
  zones: ["woodland"],
};

// Two successive climbs reach a crown terrace before supported descents to the seam.
const crownStair: ChunkModule = {
  difficulty: 2,
  encounters: 0,
  entry: { row: 80 },
  exit: { row: 80 },
  id: "woodland-crown-stair",
  objects: [],
  route: {
    profile: "recovery",
    targets: [
      { at: { col: 9, row: 76 } },
      { at: { col: 16, row: 71 } },
      { at: { col: 22, row: 76 } },
    ],
  },
  sides: ["left", "right"],
  solids: [floor(0, 6, 80), floor(6, 7, 76), floor(13, 6, 71), floor(19, 5, 76), floor(24, 6, 80)],
  zones: ["woodland"],
};

// Descending ledges cross a red-floored hollow; the last ledge recovers the exit bank.
const hollowDescent: ChunkModule = {
  difficulty: 3,
  encounters: 0,
  entry: { row: 80 },
  exit: { row: 80 },
  id: "woodland-hollow-descent",
  objects: [
    { character: "platform-ledge", col: 6, cols: 6, role: "ledge", row: 84 },
    { character: "platform-ledge", col: 12, cols: 7, role: "ledge", row: 88 },
    { character: "platform-ledge", col: 19, cols: 5, role: "ledge", row: 84 },
    ...red(6, 18, 96),
  ],
  route: {
    profile: "recovery",
    targets: [
      { at: { col: 9, row: 84 } },
      { at: { col: 15, row: 88 } },
      { at: { col: 22, row: 84 } },
    ],
  },
  sides: ["left", "right"],
  solids: [floor(0, 6, 80), floor(24, 6, 80)],
  zones: ["woodland"],
};

// Staggered islands divide a red-floored ravine wider than an ordinary running jump.
const dividedRavine: ChunkModule = {
  difficulty: 3,
  encounters: 0,
  entry: { row: 80 },
  exit: { row: 80 },
  id: "woodland-divided-ravine",
  objects: red(6, 20, 90),
  route: {
    profile: "recovery",
    targets: [{ at: { col: 12, row: 76 } }, { at: { col: 22, row: 79 } }],
  },
  sides: ["left", "right"],
  solids: [floor(0, 6, 80), floor(10, 5, 76), floor(20, 4, 79), floor(26, 4, 80)],
  zones: ["woodland"],
};

// A short step approaches a gap with a raised landing, then a supported descent.
const rootGap: ChunkModule = {
  difficulty: 3,
  encounters: 0,
  entry: { row: 80 },
  exit: { row: 80 },
  id: "woodland-root-gap",
  objects: red(12, 11, 90),
  route: {
    profile: "recovery",
    targets: [{ at: { col: 9, row: 77 } }, { at: { col: 24, row: 74 } }],
  },
  sides: ["left", "right"],
  solids: [floor(0, 6, 80), floor(6, 6, 77), floor(23, 3, 74), floor(26, 4, 80)],
  zones: ["woodland"],
};

// A short climb reaches two red gaps beneath a raised branch, with a landing between them.
const raisedBranchChannel: ChunkModule = {
  difficulty: 5,
  encounters: 0,
  entry: { row: 80 },
  exit: { row: 80 },
  id: "woodland-raised-branch-channel",
  objects: [...redCeiling(7, 17, 69), ...red(10, 2, 77), ...red(18, 2, 77)],
  route: {
    profile: "recovery",
    targets: [
      { at: { col: 8, row: 77 } },
      { at: { col: 15, row: 77 } },
      { at: { col: 22, row: 77 } },
    ],
  },
  sides: ["left", "right"],
  solids: [floor(0, 6, 80), floor(6, 4, 77), floor(12, 6, 77), floor(20, 5, 77), floor(25, 5, 80)],
  zones: ["woodland"],
};

// Three full-jump climbs reach the canopy; two supported descents return to the lower route.
const canopyReturn: ChunkModule = {
  difficulty: 2,
  encounters: 0,
  entry: { row: 80 },
  exit: { row: 80 },
  id: "woodland-canopy-return",
  objects: [],
  route: {
    profile: "recovery",
    targets: [
      { at: { col: 8, row: 76 } },
      { at: { col: 14, row: 72 } },
      { at: { col: 20, row: 68 } },
      { at: { col: 24, row: 74 } },
    ],
  },
  sides: ["left", "right"],
  solids: [
    floor(0, 6, 80),
    floor(6, 5, 76),
    floor(11, 6, 72),
    floor(17, 6, 68),
    floor(23, 3, 74),
    floor(26, 4, 80),
  ],
  zones: ["woodland"],
};

// The gust ravine: from the entry run (row 80), jumps across three 4-col pockets (row 82) by two
// cover posts (tops at row 77) to the exit run. The emitter stands on the exit run at col 25 and
// blows left across cols 4 to 25 in rows 76 to 80: Chibi on a post top or in the last pocket is in
// the band, behind a post he is not, and the push carries him at worst into a pocket, which climbs
// back out. The band stays 4 cols clear of both module edges.
const ravine: ChunkModule = {
  difficulty: 4,
  encounters: 0,
  entry: { row: 80 },
  exit: { row: 80 },
  id: "gust-ravine",
  objects: [{ character: "woodland-gust-emitter", col: 25, row: 76 }],
  route: { profile: "recovery", targets: [{ at: { col: 17, row: 77 } }] },
  sides: ["right"],
  solids: [
    floor(0, 6, 80),
    floor(6, 4, 82),
    floor(10, 2, 77),
    floor(12, 4, 82),
    floor(16, 2, 77),
    floor(18, 4, 82),
    floor(22, 8, 80),
  ],
  zones: ["woodland"],
};

// The ravine's lookout: a rise 5 rows up, a full jump, from which the leaf stream shows before the
// ravine.
const lookout: ChunkModule = {
  difficulty: 2,
  encounters: 0,
  entry: { row: 80 },
  exit: { row: 80 },
  id: "ravine-lookout",
  objects: [],
  route: { profile: "recovery", targets: [{ at: { col: 15, row: 75 } }] },
  sides: ["left"],
  solids: [floor(0, 10, 80), floor(10, 10, 75), floor(20, 10, 80)],
  zones: ["woodland"],
};

export const WOODLAND_MODULES: Readonly<Record<string, ChunkModule>> = Object.fromEntries(
  [
    lookout,
    ravine,
    raisedBranchChannel,
    canopyReturn,
    rootGap,
    crownStair,
    hollowDescent,
    dividedRavine,
    ventTerrace,
    boughReturn,
  ].map((module) => [module.id, module]),
);
