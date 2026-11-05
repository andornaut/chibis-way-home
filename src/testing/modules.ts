import type { ChunkModule, TerrainRect } from "../data/types";

const floor = (col: number, cols: number, row: number): TerrainRect => ({
  col,
  cols,
  look: "ground",
  row,
  rows: 120 - row,
});

// Small Blue modules on the row-80 seam: a step either half may fill, a red strip for the right
// half and Archie's patrol for the left half.
export const FIXTURE_MODULES: Readonly<Record<string, ChunkModule>> = {
  "fixture-patrol": {
    difficulty: 4,
    encounters: 1,
    entry: { row: 80 },
    escapes: [
      {
        area: { col: 4, cols: 4, row: 76, rows: 4 },
        from: { col: 3, row: 80 },
        id: "door",
        kind: "door",
        to: { col: 9, row: 80 },
      },
    ],
    exit: { row: 80 },
    id: "fixture-patrol",
    objects: [{ character: "dog-antagonist", col: 22, role: "antagonist", row: 76 }],
    route: { profile: "encounter" },
    sides: ["left"],
    slots: [{ area: { col: 4, cols: 4, row: 76, rows: 4 }, id: "door", kind: "door" }],
    solids: [floor(0, 30, 80)],
    zones: ["blue"],
  },
  "fixture-red-strip": {
    difficulty: 4,
    encounters: 0,
    entry: { row: 80 },
    exit: { row: 80 },
    id: "fixture-red-strip",
    objects: [{ character: "red-edge-top", col: 12, cols: 6, row: 79 }],
    route: { profile: "primary" },
    sides: ["right"],
    slots: [{ area: { col: 22, cols: 4, row: 76, rows: 4 }, id: "door", kind: "door" }],
    solids: [floor(0, 30, 80)],
    zones: ["blue"],
  },
  "fixture-step": {
    difficulty: 3,
    encounters: 0,
    entry: { row: 80 },
    exit: { row: 80 },
    id: "fixture-step",
    objects: [],
    route: { profile: "primary", targets: [{ at: { col: 14, row: 77 } }] },
    sides: ["left", "right"],
    solids: [floor(0, 30, 80), { col: 12, cols: 4, look: "ground", row: 77, rows: 3 }],
    zones: ["blue", "countryside"],
  },
};
