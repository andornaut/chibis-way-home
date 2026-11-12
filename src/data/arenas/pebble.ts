// Pebble's arena in the Industrial outskirts: a solid container roof as cover against his
// droppings, tall enough overhead that he can follow under it.
import type { ChunkArena, Instance, TerrainRect } from "../types/index.ts";

const ROWS = 120;
const FLOOR = 80;

const ground = (col: number, cols: number, row: number): TerrainRect => ({
  col,
  cols,
  look: "ground",
  row,
  rows: ROWS - row,
});
const slab = (col: number, cols: number, row: number, rows: number): TerrainRect => ({
  col,
  cols,
  look: "raised",
  row,
  rows,
});
// A red-edged pit floor `row` deep under a gap in the yard.
const redPit = (col: number, cols: number, row: number): readonly Instance[] => [
  { character: "red-edge-top", col, cols, role: "edge-top", row: row - 1 },
  { character: "red-edge-support", col, cols, role: "support", row, rows: ROWS - row },
];

// Freight terminal: one long container roof (row 74) with five rows of cover under it wraps the
// loop, which runs under the roof and back over its top by crate steps at both ends, so Pebble
// above the roof must fly round an end to reach Chibi under it. The left half under the roof is
// the first refuge; the right half ends at a crate beside a red-edged pit before the exit. Pebble
// starts on the roof between Chibi and the exit.
const FREIGHT_TERMINAL: ChunkArena = {
  boss: "pigeon-antagonist",
  difficulty: 5,
  entry: { row: FLOOR },
  exit: { row: FLOOR },
  id: "arena-pigeon-freight-terminal",
  objects: [
    { character: "pigeon-antagonist", col: 36, role: "antagonist", row: 70 },
    ...redPit(49, 3, 84),
  ],
  refuges: [
    { at: { col: 15, row: FLOOR }, kind: "cover", width: 7 },
    { at: { col: 33, row: FLOOR }, kind: "cover", width: 7 },
  ],
  route: {},
  routes: [
    {
      id: "roof",
      waypoints: [
        { col: 11, row: FLOOR },
        { col: 20, row: FLOOR },
        { col: 35, row: FLOOR },
        { col: 44, row: FLOOR },
        { col: 47, row: 77 },
        { col: 38, row: 74 },
        { col: 20, row: 74 },
        { col: 8, row: 77 },
        { col: 11, row: FLOOR },
      ],
    },
    {
      id: "yard",
      waypoints: [
        { col: 11, row: FLOOR },
        { col: 28, row: FLOOR },
        { col: 55, row: FLOOR },
      ],
    },
  ],
  solids: [
    ground(0, 49, FLOOR),
    ground(52, 8, FLOOR),
    slab(6, 4, 77, 3),
    slab(13, 30, 74, 1),
    slab(46, 3, 77, 3),
  ],
  stage: "freight-terminal",
};

export const PEBBLE_ARENAS: readonly ChunkArena[] = [FREIGHT_TERMINAL];
