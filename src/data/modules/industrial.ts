import { GANTRY_RIDE_TRANSIT } from "../forcedTransit.ts";
import { GANTRY_BEHAVIOUR } from "../obstacleBehaviours.ts";
import type { ChunkModule, Instance, TerrainRect } from "../types/index.ts";

// Industrial outskirts halves on the lower route (row 80), below the underground roof the zone
// frame adds at row 35: the gantry crane ride and the observation half before it.
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
