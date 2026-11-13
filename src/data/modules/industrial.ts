import { redCeiling } from "../chunkTemplates.ts";
import { GANTRY_RIDE_TRANSIT } from "../forcedTransit.ts";
import { GANTRY_BEHAVIOUR } from "../obstacleBehaviours.ts";
import type { ChunkModule, Instance, TerrainRect } from "../types/index.ts";

// Industrial outskirts halves on the lower route (row 80), below the underground roof the zone
// frame adds at row 35. The crane halves retain their dedicated observation and ride sequence.
const ROWS = 120;
const ROW = 80;

const floor = (col: number, cols: number, row: number): TerrainRect => ({
  col,
  cols,
  look: "ground",
  row,
  rows: ROWS - row,
});
// A red-topped pit floor across `cols` columns at `row`.
const red = (col: number, cols: number, row: number): readonly Instance[] => [
  { character: "red-edge-top", col, cols, role: "edge-top", row: row - 1 },
  { character: "red-edge-support", col, cols, role: "support", row, rows: ROWS - row },
];

// The crane's rail, its banks (the module's footings) and its pit, in module tiles.
const RAIL = -8;
const PIT = { col: 4, cols: 22 } as const;

const MODULE_LIST: readonly ChunkModule[] = [
  // Two successive full-jump steps, then supported descents back to the lower route.
  {
    difficulty: 3,
    encounters: 0,
    entry: { row: ROW },
    exit: { row: ROW },
    id: "industrial-double-step",
    objects: [],
    route: {
      profile: "recovery",
      targets: [
        { at: { col: 9, row: 75 } },
        { at: { col: 15, row: 70 } },
        { at: { col: 21, row: 75 } },
      ],
    },
    sides: ["left", "right"],
    solids: [
      floor(0, 6, ROW),
      floor(6, 6, 75),
      floor(12, 6, 70),
      floor(18, 6, 75),
      floor(24, 6, ROW),
    ],
    zones: ["industrial"],
  },
  // Staggered raised landings over a red-floored gap wider than an ordinary running jump.
  {
    difficulty: 3,
    encounters: 0,
    entry: { row: ROW },
    exit: { row: ROW },
    id: "industrial-staggered-bridge",
    objects: [
      { character: "platform-ledge", col: 10, cols: 4, role: "ledge", row: 76 },
      { character: "platform-ledge", col: 18, cols: 4, role: "ledge", row: 73 },
      ...red(6, 18, 90),
    ],
    route: {
      profile: "recovery",
      targets: [{ at: { col: 12, row: 76 } }, { at: { col: 20, row: 73 } }],
    },
    sides: ["left", "right"],
    solids: [floor(0, 6, ROW), floor(24, 6, ROW)],
    zones: ["industrial"],
  },
  // A short-press jump over a red strip beneath a red ceiling, with clear banks at both edges.
  {
    difficulty: 4,
    encounters: 0,
    entry: { row: ROW },
    exit: { row: ROW },
    id: "industrial-low-roof-strip",
    objects: [...redCeiling(8, 16, 72), ...red(16, 3, ROW)],
    route: { profile: "recovery", targets: [{ at: { col: 22, row: ROW } }] },
    sides: ["left", "right"],
    solids: [floor(0, 16, ROW), floor(19, 11, ROW)],
    zones: ["industrial"],
  },
  // Two climbs reach a vent deck with supported observation and recovery on either side.
  {
    difficulty: 4,
    encounters: 0,
    entry: { row: ROW },
    exit: { row: ROW },
    id: "industrial-vent-stair",
    objects: [{ character: "warned-vent", col: 15, row: 66 }],
    route: {
      profile: "recovery",
      targets: [
        { at: { col: 9, row: 76 } },
        { at: { col: 12, row: 72 }, xRange: { max: 12, min: 12 } },
        { at: { col: 20, row: 72 }, xRange: { max: 20, min: 20 } },
        { at: { col: 23, row: 76 } },
      ],
    },
    sides: ["left", "right"],
    solids: [
      floor(0, 7, ROW),
      floor(7, 5, 76),
      floor(12, 10, 72),
      floor(22, 4, 76),
      floor(26, 4, ROW),
    ],
    zones: ["industrial"],
  },
  // Grade 2: a flat run with a 2-tile red strip to jump, from which the crane ahead is in view.
  {
    difficulty: 2,
    encounters: 0,
    entry: { row: ROW },
    exit: { row: ROW },
    id: "crane-lookout",
    objects: red(13, 2, ROW),
    route: { profile: "recovery" },
    sides: ["left"],
    solids: [floor(0, 13, ROW), floor(15, 15, ROW)],
    zones: ["industrial"],
  },
  // Grade 4: the gantry crane ride. The container docks flush with the near bank, its lid level
  // with both banks, and shuttles across the red-floored pit under the rail. Its first near-dock
  // pause runs 2 s (wait-far's pause, then wait-near's), so it meets Chibi's arrival from the
  // chunk's entry.
  {
    difficulty: 4,
    encounters: 0,
    entry: { row: ROW },
    exit: { row: ROW },
    id: "crane-ride",
    objects: [
      {
        backdropSpan: true,
        character: "freight-gantry-rail",
        col: PIT.col,
        row: ROW + RAIL - 2,
      },
      {
        behaviour: { ...GANTRY_BEHAVIOUR, initial: "wait-far" },
        character: "freight-crane-container",
        col: PIT.col,
        forcedTransit: GANTRY_RIDE_TRANSIT,
        row: ROW,
        tether: { art: "freight-crane-cable", row: RAIL },
      },
      ...red(PIT.col, PIT.cols, ROW + 8),
    ],
    route: { profile: "recovery" },
    sides: ["right"],
    solids: [floor(0, PIT.col, ROW), floor(PIT.col + PIT.cols, 30 - PIT.col - PIT.cols, ROW)],
    zones: ["industrial"],
  },
];

export const INDUSTRIAL_MODULES: Readonly<Record<string, ChunkModule>> = Object.fromEntries(
  MODULE_LIST.map((module) => [module.id, module]),
);
