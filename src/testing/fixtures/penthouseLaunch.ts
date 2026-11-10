import type { Instance, TerrainRect } from "../../data/types";

// Static geometry and observed launch state captured from the held Penthouse candidate.
// This fixture does not admit that arena to the production pool.
const slab = (col: number, cols: number, row: number, rows = 1): TerrainRect => ({
  col,
  cols,
  look: "raised",
  row,
  rows,
});
export const PENTHOUSE_LAUNCH = {
  goal: { x: 696, y: 600 },
  objects: [
    { character: "red-edge-top", col: 4, cols: 4, role: "edge-top", row: 56 },
    { character: "red-edge-support", col: 4, cols: 4, role: "support", row: 57, rows: 63 },
    { character: "ferret-antagonist", col: 44, role: "antagonist", row: 46 },
  ] satisfies readonly Instance[],
  solids: [
    { ...slab(0, 4, 50, 70), look: "ground" },
    { ...slab(8, 52, 50, 70), look: "ground" },
    slab(50, 6, 38, 12),
    slab(16, 10, 32),
    slab(32, 12, 32),
    slab(14, 6, 44),
    slab(8, 6, 38),
    slab(38, 6, 44),
    slab(44, 6, 38),
    slab(26, 1, 46, 4),
    slab(33, 1, 46, 4),
  ] satisfies readonly TerrainRect[],
  state: { vx: -240, x: 431, y: 564 },
};
