// Archie's arena in the Blue cityscape: high ground against his charges, first a shop doorway
// nook his body cannot enter, then an overpass gantry over a red-edged pit.
import type { ChunkArena, Instance, TerrainRect } from "../types";

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
const ledge = (col: number, cols: number, row: number): Instance => ({
  character: "platform-ledge",
  col,
  cols,
  role: "ledge",
  row,
});
// A red-edged pit floor `row` deep under a gap in the street.
const redPit = (col: number, cols: number, row: number): readonly Instance[] => [
  { character: "red-edge-top", col, cols, role: "edge-top", row: row - 1 },
  { character: "red-edge-support", col, cols, role: "support", row, rows: ROWS - row },
];

// Boundary: a shop doorway nook (a two-row step under a solid awning three rows above it) past a
// run-up from the entry, then an overpass deck (row 74) with a signal gantry ledge above it. The
// street ends at a pier that rises to the deck, before a red-edged pit. The awning roof and the
// deck close the loop over the street.
const CITY_BOUNDARY: ChunkArena = {
  boss: "dog-antagonist",
  difficulty: 4,
  entry: { row: FLOOR },
  exit: { row: FLOOR },
  id: "arena-dog-city-boundary",
  objects: [
    ledge(26, 16, 74),
    ledge(30, 8, 68),
    ...redPit(48, 3, 84),
    { character: "dog-antagonist", col: 51, role: "antagonist", row: 76 },
  ],
  refuges: [
    { at: { col: 17, row: 78 }, kind: "high-ground", width: 3 },
    { at: { col: 31, row: 68 }, kind: "high-ground", width: 6 },
  ],
  route: {},
  routes: [
    {
      id: "gantry",
      waypoints: [
        { col: 28, row: 74 },
        { col: 34, row: 68 },
      ],
    },
    {
      id: "nook",
      waypoints: [
        { col: 8, row: FLOOR },
        { col: 18, row: 78 },
      ],
    },
    {
      id: "overpass",
      waypoints: [
        { col: 18, row: 78 },
        { col: 26, row: FLOOR },
        { col: 31, row: FLOOR },
        { col: 40, row: FLOOR },
        { col: 40, row: 74 },
        { col: 30, row: 74 },
        { col: 19, row: 74 },
        { col: 8, row: FLOOR },
        { col: 18, row: 78 },
      ],
    },
    {
      id: "street",
      waypoints: [
        { col: 26, row: FLOOR },
        { col: 54, row: FLOOR },
      ],
    },
  ],
  solids: [
    ground(0, 48, FLOOR),
    ground(51, 9, FLOOR),
    slab(42, 3, 74, 6),
    slab(14, 10, 78, 2),
    slab(16, 6, 74, 1),
  ],
  stage: "city-boundary",
};

export const ARCHIE_ARENAS: readonly ChunkArena[] = [CITY_BOUNDARY];
